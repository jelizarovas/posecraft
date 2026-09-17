import { World, Vec2, Box, RevoluteJoint } from 'planck';
import { clamp, wrapAngle } from './index.js';
const UNIT=50, RAD=Math.PI/180;
export const behaviorDefaults={mode:'animated',resistance:.65,gravity:1,bounce:.15,strategy:'auto',autoFace:true};
export const behaviorModes=['animated','floating','ragdoll','protective'];
export function behaviorConfig(value={}){return {...behaviorDefaults,...value};}

// One articulated character and a rectangular container. Fixtures are authored
// collision proxies, not inferred from SVG. Characters do not collide with each other.
export class PhysicalCharacter {
 constructor(document,actor,pack,frame,config){
  if(!pack.physics)throw new Error(`${pack.name} has no collision profile.`);
  this.actor=actor;this.pack=pack;this.config=behaviorConfig(config);this.bounds=document.bounds;this.time=0;this.lastImpact=-1;this.contacts=[];this.pendingImpact=null;this.stable=0;this.recoveryTime=0;
  this.world=new World(Vec2(0,0));this.world.setAutoClearForces(false);this.world.setContinuousPhysics(false);this.bodies=new Map();this.joints=new Map();
  const wall=this.world.createBody();const w=document.bounds.width/UNIT,h=document.bounds.height/UNIT;
  for(const [x,y,hx,hy] of [[w/2,h+.2,w/2+.4,.2],[w/2,-.2,w/2+.4,.2],[-.2,h/2,.2,h/2],[w+.2,h/2,.2,h/2]])wall.createFixture(Box(hx,hy,Vec2(x,y)),{friction:.75,restitution:0,userData:{wall:true}});
  for(const j of pack.joints){const spec=pack.physics.bodies[j.id];if(!spec)continue;
   const point=this.toScene(frame.world[j.id]),angle=(frame.world[j.id].rotation+actor.transform.rotation)*RAD,s=actor.transform.scale/UNIT;
   const body=this.world.createDynamicBody({position:Vec2(point.x/UNIT,point.y/UNIT),angle,linearDamping:.12,angularDamping:.25,bullet:true});
   body.createFixture(Box(spec.width*s/2,spec.height*s/2,Vec2(spec.x*s,spec.y*s)),{density:spec.density||1,friction:.75,restitution:this.config.bounce,filterGroupIndex:-1,userData:{part:j.id}});
   this.bodies.set(j.id,body);
   if(j.parent){const parent=this.bodies.get(j.parent);if(!parent)throw new Error(`Physical parent missing for ${j.id}`);
    const link=this.world.createJoint(RevoluteJoint({enableLimit:true,lowerAngle:(j.min-j.rotation)*RAD,upperAngle:(j.max-j.rotation)*RAD,referenceAngle:j.rotation*RAD,collideConnected:false},parent,body,body.getPosition()));this.joints.set(j.id,link);
   }
  }
  this.root=this.bodies.get(pack.physics.root);this.head=this.bodies.get(pack.physics.head);
  const boxes=[...this.bodies.values()].map(b=>b.getFixtureList().getAABB(0)),minX=Math.min(...boxes.map(b=>b.lowerBound.x)),maxX=Math.max(...boxes.map(b=>b.upperBound.x)),minY=Math.min(...boxes.map(b=>b.lowerBound.y)),maxY=Math.max(...boxes.map(b=>b.upperBound.y));
  if(maxX-minX>w||maxY-minY>h)throw new Error('Character collision shapes do not fit the scene. Reduce its scale or enlarge the scene.');
  const dx=minX<0?-minX:maxX>w?w-maxX:0,dy=minY<0?-minY:maxY>h?h-maxY:0;
  if(dx||dy)for(const b of this.bodies.values()){const p=b.getPosition();b.setPosition(Vec2(p.x+dx,p.y+dy));}
  const arrivals=new WeakMap();
  this.world.on('begin-contact',contact=>{
   const a=contact.getFixtureA(),b=contact.getFixtureB(),m=contact.getWorldManifold(null);if(!m||(!a.getUserData()?.wall&&!b.getUserData()?.wall))return;
   const point=m.points[0],va=a.getBody().getLinearVelocityFromWorldPoint(point),vb=b.getBody().getLinearVelocityFromWorldPoint(point);
   arrivals.set(contact,Math.max(0,-((vb.x-va.x)*m.normal.x+(vb.y-va.y)*m.normal.y))*UNIT);
  });
  this.world.on('post-solve',(contact,impulse)=>{
   const a=contact.getFixtureA(),b=contact.getFixtureB(),dynamic=a.getBody().isDynamic()?a:b;
   if(!a.getUserData()?.wall&&!b.getUserData()?.wall)return;
   const speed=arrivals.get(contact)||0;arrivals.delete(contact);
   if(speed>90&&this.time-this.lastImpact>.4&&(!this.pendingImpact||speed>this.pendingImpact.speed))this.pendingImpact={speed,part:dynamic.getUserData()?.part,strength:clamp(speed/350,.1,1)};
  });
 }
 toScene(p){const t=this.actor.transform,a=t.rotation*RAD;return {x:t.x+(p.x*Math.cos(a)-p.y*Math.sin(a))*t.scale,y:t.y+(p.x*Math.sin(a)+p.y*Math.cos(a))*t.scale};}
 toLocal(p){const t=this.actor.transform,a=-t.rotation*RAD,x=p.x*UNIT-t.x,y=p.y*UNIT-t.y;return {x:(x*Math.cos(a)-y*Math.sin(a))/t.scale,y:(x*Math.sin(a)+y*Math.cos(a))/t.scale};}
 configure(config){this.config=behaviorConfig(config);for(const b of this.bodies.values())for(let f=b.getFixtureList();f;f=f.getNext())f.setRestitution(this.config.bounce);}
 command(type,strength=1){
  if(type==='drop'){
   const top=Math.min(...[...this.bodies.values()].map(b=>b.getFixtureList().getAABB(0).lowerBound.y))*UNIT;
   const lift=Math.max(0,Math.min(75,top-12))/UNIT;
   for(const b of this.bodies.values()){const p=b.getPosition();b.setPosition(Vec2(p.x,p.y-lift));b.setLinearVelocity(Vec2(0,2.8*strength));b.setAwake(true);}
  }else if(type==='toss'){
   for(const b of this.bodies.values()){const v=b.getLinearVelocity();b.setLinearVelocity(Vec2(v.x+4.5*strength,v.y-3.5*strength));b.setAwake(true);}this.root.setAngularVelocity(this.root.getAngularVelocity()+2.5*strength);
  }else if(type==='catch'){
   for(const b of this.bodies.values()){b.setLinearVelocity(Vec2(0,0));b.setAngularVelocity(0);}this.catchUntil=this.time+1;
  }else if(type==='tap'||type==='hurt'||type==='startle'){
   const b=this.head||this.root;b.applyLinearImpulse(Vec2(b.getMass()*1.4*strength,-b.getMass()*.4),b.getWorldCenter(),true);
  }
 }
 tick(dt,motion,target){
  this.time+=dt;const c=this.config,active=c.mode==='protective',floating=c.mode==='floating',caught=this.time<(this.catchUntil||0);
  this.world.setGravity(Vec2(0,caught?0:floating?0:9.8*c.gravity));
  const velocity=this.root.getLinearVelocity(),tilt=Math.abs(wrapAngle(this.root.getAngle()/RAD));
  let bottom=-Infinity,top=Infinity,right=-Infinity,left=Infinity;
  for(const b of this.bodies.values()){const box=b.getFixtureList().getAABB(0);bottom=Math.max(bottom,box.upperBound.y*UNIT);top=Math.min(top,box.lowerBound.y*UNIT);right=Math.max(right,box.upperBound.x*UNIT);left=Math.min(left,box.lowerBound.x*UNIT);}
  const vy=velocity.y*UNIT,vx=velocity.x*UNIT;
  const floorTime=vy>20?Math.max(0,(this.bounds.height-bottom)/vy):Infinity;
  const wallTime=Math.abs(vx)>30?Math.max(0,(vx>0?this.bounds.width-right:left)/Math.abs(vx)):Infinity;
  const predicted=Math.min(floorTime,wallTime)<.38;
  let state=floating?'floating':'falling',response=null;
  if(active){
   if(predicted){response=c.strategy==='auto'?(tilt>35?'protect':'brace'):c.strategy;state={protect:'protecting',brace:'bracing',curl:'curling'}[response];}
   else if(vy>45||tilt>35)state='falling';else state='calm';
  }
  const responsePose=this.pack.physics.responses[response]||{};
  for(const [id,j] of this.joints){const spec=this.pack.joints.find(j=>j.id===id),goal=clamp(responsePose[id+'.rotation']??target[id+'.rotation']??spec.rotation,spec.min,spec.max);
   j.enableMotor(active&&c.resistance>0);
   j.setMaxMotorTorque((this.bodies.get(id).getMass()+.1)*35*c.resistance);
   j.setMotorSpeed(clamp(((goal-spec.rotation)*RAD-j.getJointAngle())*12,-12,12));
  }
  for(const b of this.bodies.values()){
   const v=b.getLinearVelocity(),speed=Math.hypot(v.x,v.y);if(speed>12)b.setLinearVelocity(Vec2(v.x*12/speed,v.y*12/speed));b.setAngularVelocity(clamp(b.getAngularVelocity(),-12,12));
   b.applyForceToCenter(Vec2(-clamp(motion.ax,-2000,2000)/UNIT*b.getMass(),-clamp(motion.ay,-2000,2000)/UNIT*b.getMass()),true);
   b.setLinearDamping(floating?.08:.2+c.resistance*.3);b.setAngularDamping(active?.8:.12+c.resistance*.25);
  }
  // Explicit upright assistance, bounded by muscle strength. It applies torque,
  // never teleports the body or invents a support contact.
  if(active&&!response){const b=this.root;const torque=(-wrapAngle(b.getAngle()/RAD)*RAD*10-b.getAngularVelocity()*3)*b.getMass();b.applyTorque(clamp(torque,-60*c.resistance,60*c.resistance),true);}
  // Discrete 240 Hz contacts keep linked bodies together. Per-body continuous
  // collision correction can separate a chain; speed caps prevent wall tunneling.
  this.world.step(dt/2,20,20);this.world.step(dt/2,20,20);this.world.clearForces();
  this.contacts=[];for(let contact=this.world.getContactList();contact;contact=contact.getNext())if(contact.isTouching()){
   const a=contact.getFixtureA(),b=contact.getFixtureB();if(!a.getUserData()?.wall&&!b.getUserData()?.wall)continue;const m=contact.getWorldManifold(null);
   if(m)for(const p of m.points.slice(0,contact.getManifold().pointCount))this.contacts.push({x:p.x*UNIT,y:p.y*UNIT,part:(a.getUserData()?.part||b.getUserData()?.part),normal:{x:m.normal.x,y:m.normal.y}});
  }
  const supported=this.contacts.some(p=>p.y>this.bounds.height-4),speed=Math.hypot(...Object.values(this.root.getLinearVelocity()))*UNIT;
  this.stable=supported&&speed<35?this.stable+dt:0;
  if(this.stable>.25){state=active?(tilt<12?'calm':'recovering'):'resting';if(state==='recovering'){this.recoveryTime+=dt;if(this.recoveryTime>3)state='resting';}else this.recoveryTime=0;}
  if(caught)state='relieved';
  const impact=this.pendingImpact;this.pendingImpact=null;if(impact)this.lastImpact=this.time;
  const center=this.root.getWorldCenter();
  this.diagnostics={state,predictedImpact:predicted,timeToImpact:Number.isFinite(Math.min(floorTime,wallTime))?Math.min(floorTime,wallTime):null,contacts:this.contacts,center:{x:center.x*UNIT,y:center.y*UNIT},velocity:{x:vx,y:vy},mode:c.mode,resistance:c.resistance,impact};
  return this.diagnostics;
 }
 apply(pose){
  const world={};for(const j of this.pack.joints){const b=this.bodies.get(j.id);let w;
   if(b){const p=this.toLocal(b.getPosition());w={...p,rotation:b.getAngle()/RAD-this.actor.transform.rotation};pose[j.id+'.rotation']=j.parent?wrapAngle(w.rotation-world[j.parent].rotation):wrapAngle(w.rotation);}
   else{const parent=world[j.parent]||{x:0,y:0,rotation:0},a=parent.rotation*RAD,x=j.x+(pose[j.id+'.x']||0),y=j.y+(pose[j.id+'.y']||0);w={x:parent.x+x*Math.cos(a)-y*Math.sin(a),y:parent.y+x*Math.sin(a)+y*Math.cos(a),rotation:parent.rotation+(pose[j.id+'.rotation']??j.rotation)};}
   w.endX=w.x+j.length*Math.cos(w.rotation*RAD);w.endY=w.y+j.length*Math.sin(w.rotation*RAD);world[j.id]=w;
  }return {pose,world};
 }
}
