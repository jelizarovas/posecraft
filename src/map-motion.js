const distance=(a,b)=>Math.hypot(b.x-a.x,b.y-a.y);
import {continuousSegmentClear} from './map-collision.js';
const mix=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
export const angleDelta=(from,to)=>Math.atan2(Math.sin(to-from),Math.cos(to-from));

/** World-space braking. Sweep the body footprint even between visible frames. */
export function brakeMapMotion(index,position,velocity,dt,deceleration,radius){
 let x=position.x,y=position.y,speed=Math.hypot(velocity.x,velocity.y),travelled=0,blocked=false;
 const initial=speed,ux=speed?velocity.x/speed:0,uy=speed?velocity.y/speed:0;
 const steps=Math.max(1,Math.ceil(dt*Math.max(120,initial/.04))),h=dt/steps;
 for(let i=0;i<steps&&speed>0;i++){
  const time=Math.min(h,speed/deceleration),nextSpeed=Math.max(0,speed-deceleration*time),distance=(speed+nextSpeed)*time/2;
  const from={x,y},to={x:x+ux*distance,y:y+uy*distance};
  if(!continuousSegmentClear(index,from,to,radius)){
   let low=0,high=1;for(let n=0;n<10;n++){const t=(low+high)/2;if(continuousSegmentClear(index,from,mix(from,to,t),radius))low=t;else high=t;}
   x+=ux*distance*low;y+=uy*distance*low;travelled+=distance*low;speed=0;blocked=true;break;
  }
  x=to.x;y=to.y;travelled+=distance;speed=nextSpeed;
 }
 return{x,y,velocity:{x:ux*speed,y:uy*speed},travelled,blocked};
}

// Segment against expanded cell rectangles. Corner rounding must keep the
// character's feet clear, not just keep sampled curve points outside obstacles.
export function mapSegmentClear(index,a,b,radius=.16,{allowVault=true}={}){
 if(index.map.navigation?.mode==='continuous')return continuousSegmentClear(index,a,b,radius,{allowVault});
 for(let y=Math.floor(Math.min(a.y,b.y)-radius);y<=Math.floor(Math.max(a.y,b.y)+radius);y++)for(let x=Math.floor(Math.min(a.x,b.x)-radius);x<=Math.floor(Math.max(a.x,b.x)+radius);x++){
  if(!index.isBlocked(x,y))continue;
  let low=0,high=1;
  for(const [start,delta,min,max]of [[a.x,b.x-a.x,x-radius,x+1+radius],[a.y,b.y-a.y,y-radius,y+1+radius]]){
   if(Math.abs(delta)<1e-10){if(start<min||start>max){low=2;break;}}
   else{let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];low=Math.max(low,t0);high=Math.min(high,t1);if(low>high)break;}
  }
  if(low<=high)return false;
 }
 return true;
}

/** Incremental route normalization, rounding, length and viewport indexing. */
export class MapRoutePreparation {
 constructor(index,start,path,{allowVault=true}={}){
  this.clear=(a,b,radius=.16)=>mapSegmentClear(index,a,b,radius,{allowVault});
  this.index=index;this.source=path;this.input=[{x:start.x,y:start.y}];this.cursor=0;this.phase='normalize';
  // Replacing a command between cell centers should continue toward the next
  // waypoint when safe instead of first reversing to the cell center.
  if(path.length>1&&Math.floor(start.x)===Math.floor(path[0].x)&&Math.floor(start.y)===Math.floor(path[0].y)&&this.clear(start,path[1]))this.cursor=1;
  this.route=[];this.routeChunks=new Map();this.remaining=0;this.done=false;
 }
 append(p){
  const previous=this.route.at(-1),i=this.route.length;
  if(previous&&distance(previous,p)<1e-7)return;
  const next={x:p.x,y:p.y};this.route.push(next);
  if(!previous)return;
  this.remaining+=distance(previous,next);
  for(let y=Math.floor(Math.min(previous.y,next.y)/16);y<=Math.floor(Math.max(previous.y,next.y)/16);y++)for(let x=Math.floor(Math.min(previous.x,next.x)/16);x<=Math.floor(Math.max(previous.x,next.x)/16);x++){
   const key=x+','+y;if(!this.routeChunks.has(key))this.routeChunks.set(key,[]);this.routeChunks.get(key).push(i);
  }
 }
 step(budget=128){
  if(!Number.isInteger(budget)||budget<1||budget>10000)throw TypeError('Invalid route preparation budget.');
  let work=0;
  while(!this.done&&work++<budget){
   if(this.phase==='normalize'){
    if(this.cursor<this.source.length){const p=this.source[this.cursor++];if(distance(this.input.at(-1),p)>1e-7)this.input.push(p);continue;}
    this.source=null;this.cursor=1;
    if(this.index.map.navigation?.mode==='continuous'){this.phase='simplify';this.simplified=[this.input[0]];this.look= Math.min(this.input.length-1,12);}
    else{this.phase='round';this.append(this.input[0]);}continue;
   }
   if(this.phase==='simplify'){
    if(this.cursor>=this.input.length){this.input=this.simplified;this.simplified=null;this.phase='round';this.cursor=1;this.append(this.input[0]);continue;}
    const a=this.simplified.at(-1),b=this.input[this.look];
    if(this.look===this.cursor||this.clear(a,b,this.index.map.navigation.radius)){
      this.simplified.push(b);this.cursor=this.look+1;this.look=Math.min(this.input.length-1,this.cursor+11);
    }else this.look--;
    continue;
   }
   if(this.cursor>=this.input.length-1){this.append(this.input.at(-1));this.input=null;this.done=true;break;}
   const i=this.cursor++,a=this.input[i-1],b=this.input[i],c=this.input[i+1],incoming=distance(a,b),outgoing=distance(b,c);
   const turn=angleDelta(Math.atan2(b.y-a.y,b.x-a.x),Math.atan2(c.y-b.y,c.x-b.x));
   if(incoming<1e-6||outgoing<1e-6||Math.abs(turn)<.01||Math.abs(turn)>Math.PI-.05){this.append(b);continue;}
   const trim=Math.min(.32,incoming*.35,outgoing*.35),enter=mix(b,a,trim/incoming),leave=mix(b,c,trim/outgoing),curve=[enter];
   for(let n=1;n<=8;n++){const t=n/8;curve.push(mix(mix(enter,b,t),mix(b,leave,t),t));}
   const chain=[this.route.at(-1),...curve,c];
   if(chain.slice(1).every((p,n)=>this.clear(chain[n],p)))for(const p of curve)this.append(p);else this.append(b);
  }
  return this.done;
 }
}

/** Synchronous helper for small authored paths. Runtime uses scheduled preparation. */
export function roundMapRoute(index,path){
 if(!path.length)return [];
 const preparation=new MapRoutePreparation(index,path[0],path);
 while(!preparation.step(1024)){}
 return preparation.route;
}

export function routeHeading(actor,route,index,lookAhead=.12){
 let from=actor,target=route[index];
 for(let i=index;i<route.length;i++){
  const to=route[i],length=distance(from,to);
  if(length>=lookAhead){target=mix(from,to,lookAhead/length);break;}
  const next=route[i+1];
  if(next&&length>1e-9&&Math.abs(angleDelta(Math.atan2(to.y-from.y,to.x-from.x),Math.atan2(next.y-to.y,next.x-to.x)))>Math.PI/3){target=to;break;}
  lookAhead-=length;from=to;target=to;
 }
 return Math.atan2(target.y-actor.y,target.x-actor.x);
}
