import {forwardKinematics,constrainPose,sampleClip,clamp,wrapAngle} from './index.js';
const rad=Math.PI/180;
export function restPose(pack){return Object.fromEntries(pack.joints.flatMap(j=>[[j.id+'.rotation',j.rotation],[j.id+'.x',0],[j.id+'.y',0]]));}
// Extents of authored collision proxies, in scene units relative to the actor's anchor.
function extents(actor,pack,pose){
 const world=forwardKinematics(pack.joints,pose),points=[],r=actor.transform.rotation*rad;
 for(const [id,b] of Object.entries(pack.physics.bodies)){const j=world[id],angle=(j.rotation+actor.transform.rotation)*rad;
  for(const x of [b.x-b.width/2,b.x+b.width/2])for(const y of [b.y-b.height/2,b.y+b.height/2])points.push({x:(j.x*Math.cos(r)-j.y*Math.sin(r)+x*Math.cos(angle)-y*Math.sin(angle))*actor.transform.scale,y:(j.x*Math.sin(r)+j.y*Math.cos(r)+x*Math.sin(angle)+y*Math.cos(angle))*actor.transform.scale});
 }
 return {left:Math.min(...points.map(p=>p.x)),right:Math.max(...points.map(p=>p.x)),bottom:Math.max(...points.map(p=>p.y)),top:Math.min(...points.map(p=>p.y))};
}
export function standingTarget(document,actor,pack,x,nearY=actor.transform.y){
 const pose=restPose(pack),root=pack.physics.root;pose[root+'.rotation']-=actor.transform.rotation;const box=extents(actor,pack,pose),scale=actor.transform.scale;
 x=clamp(x,4-box.left,document.bounds.width-4-box.right);let floor=document.bounds.height;
 for(const p of document.props||[]){if(!p.collider.enabled||Math.abs(p.rotation)>12)continue;const c=p.collider,a=p.rotation*rad,top=p.y+c.y-c.height/2+(x-p.x-c.x)*Math.tan(a);
  if(x+box.left>=p.x+c.x-c.width/2&&x+box.right<=p.x+c.x+c.width/2&&top>=nearY-10&&top<floor)floor=top;
 }
 const y=floor-box.bottom-1,r=-actor.transform.rotation*rad,dx=(x-actor.transform.x)/scale,dy=(y-actor.transform.y)/scale;pose[root+'.x']=dx*Math.cos(r)-dy*Math.sin(r);pose[root+'.y']=dx*Math.sin(r)+dy*Math.cos(r);
 return {x,y,floor,pose,box};
}
function routeClear(document,actor,pack,from,to){
 const steps=Math.ceil(Math.abs(to.x-from.x)/12)||1;
 for(let i=0;i<=steps;i++){const x=from.x+(to.x-from.x)*i/steps,y=from.y+(to.y-from.y)*i/steps;
  const support=standingTarget(document,actor,pack,x,y);if(Math.abs(support.floor-(y+from.box.bottom+1))>28)return false;
  for(const p of document.props||[]){if(!p.collider.enabled)continue;const c=p.collider,a=p.rotation*rad,hx=Math.abs(Math.cos(a))*c.width/2+Math.abs(Math.sin(a))*c.height/2,hy=Math.abs(Math.sin(a))*c.width/2+Math.abs(Math.cos(a))*c.height/2;
   if(x+from.box.right>p.x+c.x-hx+2&&x+from.box.left<p.x+c.x+hx-2&&y+from.box.bottom>p.y+c.y-hy+5&&y+from.box.top<p.y+c.y+hy-2)return false;
  }
 }
 return true;
}
export class RecoveryMotion{
 constructor(document,actor,pack,frame,{walkX}={}){
  this.document=document;this.actor=actor;this.pack=pack;this.time=0;this.root=pack.physics.root;
  this.start={...frame.pose,[this.root+'.x']:frame.world[this.root].x-pack.joints.find(j=>j.id===this.root).x,[this.root+'.y']:frame.world[this.root].y-pack.joints.find(j=>j.id===this.root).y};
  const r=actor.transform.rotation*rad,w={x:this.start[this.root+'.x'],y:this.start[this.root+'.y']},x=actor.transform.x+(w.x*Math.cos(r)-w.y*Math.sin(r))*actor.transform.scale,y=actor.transform.y+(w.x*Math.sin(r)+w.y*Math.cos(r))*actor.transform.scale;
  this.from=standingTarget(document,actor,pack,x,y);this.to=standingTarget(document,actor,pack,walkX??actor.transform.x);
  this.blocked=!routeClear(document,actor,pack,this.from,this.to);if(this.blocked)this.to=this.from;
  this.duration=Math.max(.2,Math.abs(this.to.x-this.from.x)/75);this.standDuration=walkX===undefined?1.25:0;this.phase=this.standDuration?'getting-up':'walking';this.pose={...this.start};
 }
 tick(dt){
  this.time+=dt;
  if(this.time<this.standDuration){const t=this.time/this.standDuration,s=t*t*(3-2*t);this.phase='getting-up';this.pose={...this.from.pose};for(const key of Object.keys(this.pose)){const start=this.start[key]??this.pose[key];this.pose[key]=start+(key.endsWith('.rotation')?wrapAngle(this.from.pose[key]-start):this.from.pose[key]-start)*s;}}
  else{const time=this.time-this.standDuration,t=clamp(time/this.duration,0,1),root=this.root;this.phase=t<1?(this.standDuration?'returning':'walking'):this.blocked?'blocked':'home';this.pose={...this.to.pose};
   this.pose[root+'.x']=this.from.pose[root+'.x']+(this.to.pose[root+'.x']-this.from.pose[root+'.x'])*t;this.pose[root+'.y']=this.from.pose[root+'.y']+(this.to.pose[root+'.y']-this.from.pose[root+'.y'])*t;
   if(t<1&&Math.abs(this.to.x-this.from.x)>2){const envelope=Math.min(1,t*8,(1-t)*8),cycle=Math.sin(time*9);
    if(this.pack.clips.walk){for(const [key,value] of Object.entries(sampleClip(this.pack.clips.walk,time))){if(!key.startsWith(root+'.'))this.pose[key]+=(value-this.pose[key])*envelope;}}
    else for(const [id,amount] of [['leftThigh',22],['rightThigh',-22],['leftCalf',18],['rightCalf',-18],['leftArm',12],['rightArm',-12],['frontPaw',15],['backPaw',-12]])if(this.pack.joints.some(j=>j.id===id))this.pose[id+'.rotation']+=cycle*amount*envelope;
    this.pose[root+'.y']-=Math.abs(cycle)*2*envelope;
   }
  }
  const rootAngle=this.pose[this.root+'.rotation'];this.pose=constrainPose(this.pack.joints,this.pose);this.pose[this.root+'.rotation']=rootAngle;return this.phase;
 }
}
