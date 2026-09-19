import {PathJob,navigationObstacles,segmentClear} from './navigation.js';
import {sampleClip,wrapAngle} from './index.js';

// A navigation radius is authored in scene units. It is not inferred from art.
// The path planner does bounded work on the same simulation worker as motion.
export class GameNavigationMotion {
 constructor(document,entry,frame,target,binding){
  this.document=document;this.entry=entry;this.root=entry.pack.physics?.root??entry.pack.joints.find(j=>!j.parent).id;
  this.base={...frame.pose};this.pose={...frame.pose};this.placement=frame.placement??entry.actor.transform;
  const p=frame.world[this.root],r=this.placement.rotation*Math.PI/180,scale=this.placement.scale;
  this.start={x:this.placement.x+(p.x*Math.cos(r)-p.y*Math.sin(r))*scale,y:this.placement.y+(p.x*Math.sin(r)+p.y*Math.cos(r))*scale};
  this.point={...this.start};this.target={...target};this.binding=binding;this.speed=0;this.distance=0;this.time=0;this.done=false;this.error=null;this.duration=Infinity;
  this.area={x:0,y:0,...document.bounds};this.clearance=binding.clearance??12;this.shapes=navigationObstacles(document);
  if(segmentClear(this.shapes,this.start,target,{clearance:this.clearance,area:this.area}))this.setRoute([this.start,target]);
  else this.job=new PathJob(document,{start:this.start,end:target,clearance:this.clearance,cellSize:binding.cellSize??20});
 }
 setRoute(points){
  // Keep endpoints exact. Connect them conservatively to the cell-center path.
  const raw=[this.start,...points,this.target],route=[raw[0]];
  for(let i=1;i<raw.length;i++){
   if(!segmentClear(this.shapes,raw[i-1],raw[i],{clearance:this.clearance,area:this.area})){this.error='No clear route to target.';return;}
   if(Math.hypot(raw[i].x-route.at(-1).x,raw[i].y-route.at(-1).y)>1e-6)route.push(raw[i]);
  }
  // Remove one redundant corner at a time, with linear bounded work.
  this.route=[];for(const p of route){if(this.route.length>1&&segmentClear(this.shapes,this.route.at(-2),p,{clearance:this.clearance,area:this.area}))this.route.pop();this.route.push(p);}
  this.index=1;this.total=this.route.slice(1).reduce((n,p,i)=>n+Math.hypot(p.x-this.route[i].x,p.y-this.route[i].y),0);
  if(!this.total){this.done=true;this.duration=0;}
 }
 tick(dt,immediate=false,currentDocument=this.document){
  if(this.error||this.done)return;
  if(this.job){this.job.step(immediate?4096:64);if(immediate)for(let i=0;i<8&&!this.job.done;i++)this.job.step(4096);if(!this.job.done)return;if(!this.job.result.path){this.error='No route to target.';return;}this.setRoute(this.job.result.path);this.job=null;if(this.error)return;}
  this.time+=dt;const speed=this.binding.speed??90,acceleration=speed*4,remaining=this.total-this.distance;
  const liveShapes=navigationObstacles(currentDocument);
  this.speed=Math.min(speed,this.speed+acceleration*dt,Math.sqrt(Math.max(0,2*acceleration*remaining)));
  let travel=immediate?remaining:Math.min(remaining,Math.max(.01,this.speed)*dt);
  while(this.index<this.route.length&&travel>=0){const to=this.route[this.index];if(!segmentClear(liveShapes,this.point,to,{clearance:this.clearance,area:this.area})){this.error='Route became blocked.';return;}const dx=to.x-this.point.x,dy=to.y-this.point.y,d=Math.hypot(dx,dy),step=Math.min(d,travel);if(d){this.point.x+=dx/d*step;this.point.y+=dy/d*step;this.heading=Math.atan2(dx,dy)*180/Math.PI;}this.distance+=step;travel-=step;if(d-step<1e-6)this.index++;else break;}
  if(this.index>=this.route.length){this.point={...this.target};this.done=true;this.speed=0;}
  const r=-this.placement.rotation*Math.PI/180,dx=(this.point.x-this.start.x)/this.placement.scale,dy=(this.point.y-this.start.y)/this.placement.scale;
  const clip=this.binding.clip&&this.entry.pack.clips[this.binding.clip];
  this.pose={...this.entry.runtime.definition.defaults,...(clip?sampleClip({...clip,loop:true},this.time):this.base)};
  this.pose[this.root+'.x']=(this.base[this.root+'.x']??0)+dx*Math.cos(r)-dy*Math.sin(r);
  this.pose[this.root+'.y']=(this.base[this.root+'.y']??0)+dx*Math.sin(r)+dy*Math.cos(r);
  if(this.entry.pack.spatial&&this.heading!==undefined){const old=this.yaw??this.base[this.root+'.yaw']??0;this.yaw=old+wrapAngle(this.heading-old)*Math.min(1,dt*10);this.pose[this.root+'.yaw']=this.yaw;}
 }
}
