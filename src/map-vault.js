import {continuousSegmentClear,propCollisionParts,propHitsSegment} from './map-collision.js';
import {groundHeight} from './map-art-layout.js';

function hitInterval(part,from,to,radius){
 const dx=to.x-from.x,dy=to.y-from.y;
 if(part.shape==='circle'){
  const px=from.x-part.x,py=from.y-part.y,r=part.radius+radius,a=dx*dx+dy*dy,b=2*(px*dx+py*dy),c=px*px+py*py-r*r,d=b*b-4*a*c;
  if(d<0||a<1e-12)return null;const root=Math.sqrt(d);return[Math.max(0,(-b-root)/(2*a)),Math.min(1,(-b+root)/(2*a))];
 }
 let low=0,high=1;
 for(const[start,delta,min,max]of[[from.x,dx,part.x-radius,part.x+part.width+radius],[from.y,dy,part.y-radius,part.y+part.height+radius]]){
  if(Math.abs(delta)<1e-10){if(start<min||start>max)return null;continue;}
  let a=(min-start)/delta,b=(max-start)/delta;if(a>b)[a,b]=[b,a];low=Math.max(low,a);high=Math.min(high,b);if(low>high)return null;
 }
 return[Math.max(0,low),Math.min(1,high)];
}

function traversalGeometry(prop,from,to,radius){
 const intervals=propCollisionParts(prop).map(part=>hitInterval(part,from,to,radius)).filter(interval=>interval&&interval[0]<=interval[1]).sort((a,b)=>a[0]-b[0]);
 if(!intervals.length)return null;
 let [entry,exit]=intervals[0];
 for(let i=1;i<intervals.length&&intervals[i][0]<=exit+1e-6;i++)exit=Math.max(exit,intervals[i][1]);
 const dx=to.x-from.x,dy=to.y-from.y,length=Math.hypot(dx,dy),middle=(entry+exit)/2;
 return{center:{x:from.x+dx*middle,y:from.y+dy*middle},entry:entry*length,exit:exit*length};
}

/** Find a nearby route crossing with a clear takeoff, flight corridor and landing. */
export function planMapVault(index,actor,route,routeIndex,gait){
 const radius=index.map.navigation.radius,running=gait==='run',lead=running?1.0:.38,look=lead+.8;
 let from=actor,walked=0;
 for(let i=routeIndex;i<route.length&&walked<look;i++){
  const end=route[i],dx=end.x-from.x,dy=end.y-from.y,length=Math.hypot(dx,dy);if(length<1e-8){from=end;continue;}
  const ux=dx/length,uy=dy/length,scan=Math.min(length,look-walked),to={x:from.x+ux*scan,y:from.y+uy*scan},seen=new Set();
  const candidates=[];
  for(let y=Math.floor(Math.min(from.y,to.y))-1;y<=Math.floor(Math.max(from.y,to.y))+1;y++)for(let x=Math.floor(Math.min(from.x,to.x))-1;x<=Math.floor(Math.max(from.x,to.x))+1;x++)for(const prop of index.propsAt(x,y)){
   if(seen.has(prop.id)||prop.traversal?.kind!=='vault'||(prop.traversal.activation??'auto')!=='auto')continue;seen.add(prop.id);
   if(!propHitsSegment(prop,from,to,radius))continue;
   const crossing=traversalGeometry(prop,from,to,radius);if(!crossing)continue;
   if(crossing.entry<0)continue;candidates.push({prop,along:crossing.entry});
  }
  candidates.sort((a,b)=>a.along-b.along);
  for(const {prop,along}of candidates){
   const crossing=traversalGeometry(prop,from,to,radius);if(!crossing)continue;
   const {center}=crossing;if(walked+crossing.entry>lead)continue;
   const landingDistance=Math.min(length,crossing.exit+(running?.55:.35));
   const landing={x:from.x+ux*landingDistance,y:from.y+uy*landingDistance};
   if(!continuousSegmentClear(index,landing,landing,radius)||!continuousSegmentClear(index,actor,landing,radius,{ignoreProp:prop.id}))continue;
   const distance=Math.hypot(landing.x-actor.x,landing.y-actor.y),speed=actor.speed*(running?1.8:1);
   if(distance<.15)continue;
   const vaultCrossing=traversalGeometry(prop,actor,landing,radius);if(!vaultCrossing)continue;
   const startZ=groundHeight(index.map,actor),endZ=groundHeight(index.map,landing);
   let height=prop.traversal.height+(running?.65:.35),valid=true;
   for(const t of [vaultCrossing.entry/distance,vaultCrossing.exit/distance]){
    if(t<=.01||t>=.99){valid=false;break;}
    const clearance=groundHeight(index.map,center)+prop.traversal.height+.06-(startZ+(endZ-startZ)*t);
    height=Math.max(height,clearance/(4*t*(1-t)));
   }
   if(!valid||height>(running?1.8:1.35))continue;
   const style=prop.traversal.style??(prop.kind==='rock'?'rock':'branch');
   const duration=style==='branch'?Math.max(running?.88:1,Math.min(1.25,distance/speed)):Math.max(.38,Math.min(.8,distance/speed));
   return{object:prop.id,start:{x:actor.x,y:actor.y},landing,elapsed:0,duration,height,heading:Math.atan2(landing.y-actor.y,landing.x-actor.x),startZ,endZ,action:style==='rock'?null:'vault',style,supportPoint:{x:center.x,y:center.y,z:groundHeight(index.map,center)+prop.traversal.height}};
  }
  walked+=length;from=end;
 }
 return null;
}
