import {spatialKinematics} from './spatial.js';
import {forwardKinematics} from './index.js';
import {nodeVisible} from './scene-graph.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),rad=Math.PI/180;
const finite=(n,a=-10000,b=10000)=>Number.isFinite(n)&&n>=a&&n<=b;
const record=v=>v&&typeof v==='object'&&!Array.isArray(v);
const fields=(v,keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k));
const id=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/.test(v);
export function validateSceneObjects(doc,check){
 const objects=Array.isArray(doc.objects)?doc.objects:[];
 check(doc.objects===undefined||Array.isArray(doc.objects)&&objects.length<=64,'objects','Expected up to 64 shared objects.');
 const ids=new Set();
 for(const [i,o]of objects.entries()){
  const p='objects.'+i;check(fields(o,['id','name','shape','x','y','radius','width','height','rotation','fill','mass','restitution','friction','damping','category','mask','depth','enabled','owner']),p,'Unknown shared object field.');if(!record(o))continue;
  check(id(o.id)&&!ids.has(o.id),p+'.id','Expected unique object ID.');ids.add(o.id);check(typeof o.name==='string'&&o.name.length>0&&o.name.length<=100,p+'.name','Expected object name.');
  check(['circle','box'].includes(o.shape),p+'.shape','Expected circle or static box.');for(const k of ['x','y'])check(finite(o[k]),p+'.'+k,'Expected finite position.');
  check(/^#[0-9a-fA-F]{6}$/.test(o.fill),p+'.fill','Expected six digit color.');check(finite(o.mass,0,100),p+'.mass','Mass is 0..100; zero is static.');
  if(o.shape==='circle')check(finite(o.radius,4,200),p+'.radius','Radius is 4..200.');else{check(o.mass===0,p+'.mass','Box objects are static collision surfaces.');for(const k of ['width','height'])check(finite(o[k],1,2000),p+'.'+k,'Size is 1..2000.');}
  for(const [k,a,b]of [['rotation',-180,180],['restitution',0,1],['friction',0,1],['damping',0,10],['depth',-10000,10000]])if(o[k]!==undefined)check(finite(o[k],a,b),p+'.'+k,'Value is outside its supported range.');
  for(const k of ['category','mask'])if(o[k]!==undefined)check(Number.isInteger(o[k])&&finite(o[k],0,65535),p+'.'+k,'Expected collision bit mask.');
  if(o.enabled!==undefined)check(typeof o.enabled==='boolean',p+'.enabled','Expected boolean.');
  if(o.owner!==undefined){check(o.mass>0,p+'.owner','Static objects cannot have an owner.');const a=doc.actors.find(a=>a.id===o.owner?.actor);check(fields(o.owner,['actor','joint','offsetX','offsetY','breakDistance'])&&doc.packs[a?.pack]?.joints.some(j=>j.id===o.owner.joint),p+'.owner','Expected an existing actor joint.');for(const k of ['offsetX','offsetY','breakDistance'])if(o.owner?.[k]!==undefined)check(finite(o.owner[k],k==='breakDistance'?1:-200,500),p+'.owner.'+k,'Invalid grip offset or break distance.');}
 }
 if(doc.objectPhysics!==undefined){const p=doc.objectPhysics;check(fields(p,['gravity','floorY','actorCollisions']), 'objectPhysics','Unknown shared physics setting.');if(record(p)){if(p.gravity!==undefined)check(finite(p.gravity,0,3000),'objectPhysics.gravity','Gravity is 0..3000 pixels/s².');if(p.floorY!==undefined)check(finite(p.floorY,0,doc.bounds.height),'objectPhysics.floorY','Floor must be inside scene.');if(p.actorCollisions!==undefined)check(typeof p.actorCollisions==='boolean','objectPhysics.actorCollisions','Expected boolean.');}}
 if(objects.length)check(doc.requiredFeatures?.includes('scene-objects'),'requiredFeatures','Declare scene-objects for shared props.');
}

/** A contact point in scene coordinates, including a rotated/scaled actor. */
export function objectGrip(document,frame,owner){
 const actor=document.actors.find(a=>a.id===owner.actor),f=frame.actors.find(a=>a.id===owner.actor);if(!actor||!f||!nodeVisible(document,actor))return null;
 const pack=document.packs[actor.pack],j=(pack.spatial?spatialKinematics(pack,f.pose):f.world||forwardKinematics(pack.joints,f.pose))[owner.joint];if(!j)return null;
 const t=f.placement||actor.transform,c=Math.cos(t.rotation*rad),s=Math.sin(t.rotation*rad),ox=owner.offsetX||0,oy=owner.offsetY||0;
 const x=j.x+(j.m?j.m[0]*ox+j.m[1]*oy:Math.cos(j.rotation*rad)*ox-Math.sin(j.rotation*rad)*oy),y=j.y+(j.m?j.m[3]*ox+j.m[4]*oy:Math.sin(j.rotation*rad)*ox+Math.cos(j.rotation*rad)*oy);
 return {x:t.x+(x*c-y*s)*t.scale,y:t.y+(x*s+y*c)*t.scale,rotation:t.rotation+(j.m?Math.atan2(j.m[3],j.m[0])/rad:j.rotation)};
}

export function validateObjectCommand(document,command){
 if(!fields(command,['type','object','actor','joint','from','vx','vy','x','y','offsetX','offsetY','maxDistance','enabled'])||!['attach','transfer','release','impulse','place','enable'].includes(command.type)||!document.objects?.some(o=>o.id===command.object))throw Error('Invalid shared object command.');
 for(const k of ['vx','vy','x','y','offsetX','offsetY','maxDistance'])if(command[k]!==undefined&&!finite(command[k],k==='maxDistance'?0:-2000,2000))throw Error('Invalid object command coordinates.');
 if(['attach','transfer'].includes(command.type)){const a=document.actors.find(a=>a.id===command.actor);if(!document.packs[a?.pack]?.joints.some(j=>j.id===command.joint))throw Error('Grip needs an existing actor joint.');}
 if(command.type==='transfer'&&typeof command.from!=='string')throw Error('Transfer must name the current owner.');
 if(command.type==='enable'&&typeof command.enabled!=='boolean')throw Error('Enable needs a boolean.');
 if(command.type==='place'&&![command.x,command.y].every(Number.isFinite))throw Error('Place needs a finite position.');
 return structuredClone(command);
}

/** Fixed-step shared circles with swept substeps, static oriented boxes, collision
 * filtering and single-owner grips. Actor fixtures are kinematic; impact events
 * let the physical controller deliver the opposite impulse to a ragdoll. */
export class SceneObjects {
 constructor(document,{onEvent=()=>{}}={}){this.document=document;this.onEvent=onEvent;this.config={gravity:900,floorY:document.bounds.height-10,actorCollisions:true,...document.objectPhysics};this.reset();}
 reset(){this.time=0;this.bodies=(this.document.objects||[]).map(o=>({...structuredClone(o),vx:0,vy:0,rotation:o.rotation||0,enabled:o.enabled!==false,owner:o.owner?structuredClone(o.owner):null,previousX:o.x,previousY:o.y}));this.events=[];this.contacts=new Set();return this;}
 snapshot(){return {version:1,time:this.time,bodies:structuredClone(this.bodies),contacts:[...this.contacts]};}
 restore(state){if(state?.version!==1||state.bodies.length!==this.bodies.length||state.bodies.some((b,i)=>b.id!==this.bodies[i].id))throw Error('Incompatible object checkpoint.');this.time=state.time;this.bodies=structuredClone(state.bodies);this.contacts=new Set(state.contacts);this.events=[];}
 emit(event){const e={...event,time:this.time};this.events.push(e);if(this.events.length>128)this.events.shift();this.onEvent(e);}
 drainEvents(){const events=this.events;this.events=[];return events;}
 command(raw,frame){const c=validateObjectCommand(this.document,raw),b=this.bodies.find(b=>b.id===c.object);if(!b.mass&&c.type!=='enable')throw Error('Static objects cannot be carried or thrown.');
  if(c.type==='enable'){b.enabled=c.enabled;if(!b.enabled)b.owner=null;return true;}
  if(!b.enabled)return false;
  if(c.type==='attach'||c.type==='transfer'){
   if(c.type==='attach'&&b.owner||c.type==='transfer'&&b.owner?.actor!==c.from)return false;
   const owner={actor:c.actor,joint:c.joint,offsetX:c.offsetX||0,offsetY:c.offsetY||0},p=objectGrip(this.document,frame,owner);if(!p||Math.hypot(b.x-p.x,b.y-p.y)>(c.maxDistance??b.radius+6))return false;
   const from=b.owner?.actor;b.owner=owner;b.x=p.x;b.y=p.y;b.vx=b.vy=0;this.emit({type:'object-attached',object:b.id,actor:owner.actor,from});return true;
  }
  if(c.actor&&b.owner?.actor!==c.actor)return false;
  if(c.type==='place'){b.owner=null;b.x=c.x;b.y=c.y;b.vx=b.vy=0;return true;}
  if(c.type==='release'){const actor=b.owner?.actor,p=b.owner?objectGrip(this.document,frame,b.owner):null;if(p){b.x=p.x;b.y=p.y;b.rotation=p.rotation;}b.owner=null;b.ignoreActor=actor;b.ignoreUntil=this.time+.3;b.vx=clamp(c.vx??b.vx,-2000,2000);b.vy=clamp(c.vy??b.vy,-2000,2000);this.emit({type:'object-released',object:b.id,actor});return true;}
  if(b.owner)return false;b.vx=clamp(b.vx+(c.vx||0),-2000,2000);b.vy=clamp(b.vy+(c.vy||0),-2000,2000);return true;
 }
 tick(dt,frame){if(!finite(dt,0,1/30))throw Error('Shared objects require a bounded fixed step.');if(!dt)return;this.time+=dt;const nextContacts=new Set();
  for(const b of this.bodies){b.previousX=b.x;b.previousY=b.y;if(b.owner){const p=objectGrip(this.document,frame,b.owner);if(!p||this.time>dt+1e-9&&Math.hypot(b.x-p.x,b.y-p.y)>(b.owner.breakDistance??500)){const actor=b.owner.actor;b.owner=null;this.emit({type:'object-grip-broken',object:b.id,actor});}else{b.vx=clamp((p.x-b.x)/dt,-2000,2000);b.vy=clamp((p.y-b.y)/dt,-2000,2000);b.x=p.x;b.y=p.y;b.rotation=p.rotation;}}}
  const fixtures=[];for(const p of this.document.props||[])if(p.collider.enabled&&nodeVisible(this.document,p)){const a=p.rotation*rad,c=Math.cos(a),s=Math.sin(a),q=p.collider;fixtures.push({id:p.id,x:p.x+q.x*c-q.y*s,y:p.y+q.x*s+q.y*c,width:q.width,height:q.height,rotation:p.rotation,restitution:q.bounce,friction:q.friction});}
  for(const b of this.bodies)if(b.enabled&&b.shape==='box')fixtures.push(b);
  const actorFixtures=[];if(this.config.actorCollisions)for(const actor of this.document.actors){if(!nodeVisible(this.document,actor))continue;const pack=this.document.packs[actor.pack],f=frame.actors.find(a=>a.id===actor.id);if(!f)continue;for(const [joint,shape]of Object.entries(pack.physics?.bodies||{})){const point=objectGrip(this.document,frame,{actor:actor.id,joint,offsetX:shape.x,offsetY:shape.y});if(point)actorFixtures.push({...point,actor:actor.id,joint,radius:Math.max(2,Math.min(shape.width,shape.height)*(f.placement||actor.transform).scale/2)});}}
  const substeps=Math.max(1,Math.min(16,Math.ceil(dt*2000/3))),h=dt/substeps;
  const hit=(b,key,normal,impulse,actor,joint)=>{nextContacts.add(key);if(!this.contacts.has(key)&&!this._hits.has(key)&&impulse>1){this._hits.add(key);this.emit({type:'object-impact',object:b.id,actor,joint,x:b.x,y:b.y,impulseX:normal.x*impulse,impulseY:normal.y*impulse});}};this._hits=new Set();
  for(let step=0;step<substeps;step++){
   for(const b of this.bodies){if(!b.enabled||!b.mass||b.owner)continue;b.vy=clamp(b.vy+this.config.gravity*h,-2000,2000);const damp=Math.exp(-(b.damping??.05)*h);b.vx*=damp;b.vy*=damp;b.x+=b.vx*h;b.y+=b.vy*h;const r=b.radius,e=b.restitution??.6;
    for(const [axis,lo,hi]of [['x',r,this.document.bounds.width-r],['y',r,this.config.floorY-r]]){if(b[axis]<lo||b[axis]>hi){const normal={x:0,y:0};normal[axis]=b[axis]<lo?1:-1;const v='v'+axis,impulse=-(1+e)*b[v]*normal[axis]*b.mass;b[axis]=clamp(b[axis],lo,hi);if(b[v]*normal[axis]<0)b[v]*=-e;if(axis==='y'&&normal.y<0){b.vx*=Math.exp(-(b.friction??.5)*h*15);if(Math.abs(b.vy)<8)b.vy=0;}hit(b,'wall:'+b.id+axis+normal[axis],normal,impulse);}}
    for(const f of actorFixtures){if(b.ignoreActor===f.actor&&this.time<b.ignoreUntil||!((b.mask??65535)&2)||!((b.category??1)&65535))continue;const dx=b.x-f.x,dy=b.y-f.y,d=Math.hypot(dx,dy),radius=r+f.radius;if(d>=radius)continue;const n={x:d?dx/d:1,y:d?dy/d:0};b.x=f.x+n.x*radius;b.y=f.y+n.y*radius;const speed=b.vx*n.x+b.vy*n.y;if(speed<0){const impulse=-(1+e)*speed;b.vx+=n.x*impulse;b.vy+=n.y*impulse;hit(b,b.id+':'+f.actor+':'+f.joint,n,impulse*b.mass,f.actor,f.joint);}}
    for(const box of fixtures){if(!((b.mask??65535)&(box.category??1))||!((box.mask??65535)&(b.category??1)))continue;const a=(box.rotation||0)*rad,c=Math.cos(a),s=Math.sin(a),dx=b.x-box.x,dy=b.y-box.y,x=dx*c+dy*s,y=-dx*s+dy*c,px=clamp(x,-box.width/2,box.width/2),py=clamp(y,-box.height/2,box.height/2);let nx=x-px,ny=y-py,d=Math.hypot(nx,ny);if(d>=r)continue;if(d<1e-8){if(box.width/2-Math.abs(x)<box.height/2-Math.abs(y)){nx=x<0?-1:1;ny=0;d=-(box.width/2-Math.abs(x));}else{nx=0;ny=y<0?-1:1;d=-(box.height/2-Math.abs(y));}}else{nx/=d;ny/=d;}const n={x:nx*c-ny*s,y:nx*s+ny*c};b.x+=n.x*(r-d);b.y+=n.y*(r-d);const speed=b.vx*n.x+b.vy*n.y;if(speed<0){const impulse=-(1+Math.min(e,box.restitution??e))*speed;b.vx+=n.x*impulse;b.vy+=n.y*impulse;hit(b,b.id+':'+box.id,n,impulse*b.mass);}}
   }
   for(let i=0;i<this.bodies.length;i++)for(let j=i+1;j<this.bodies.length;j++){const a=this.bodies[i],b=this.bodies[j];if(!a.enabled||!b.enabled||a.shape!=='circle'||b.shape!=='circle'||!((a.mask??65535)&(b.category??1))||!((b.mask??65535)&(a.category??1)))continue;const wa=a.mass&&!a.owner?1/a.mass:0,wb=b.mass&&!b.owner?1/b.mass:0;if(!wa&&!wb)continue;const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),sum=a.radius+b.radius;if(d>=sum)continue;const nx=d?dx/d:1,ny=d?dy/d:0,overlap=sum-d;a.x-=nx*overlap*wa/(wa+wb);a.y-=ny*overlap*wa/(wa+wb);b.x+=nx*overlap*wb/(wa+wb);b.y+=ny*overlap*wb/(wa+wb);const speed=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;if(speed<0){const impulse=-(1+Math.min(a.restitution??.6,b.restitution??.6))*speed/(wa+wb);a.vx-=nx*impulse*wa;a.vy-=ny*impulse*wa;b.vx+=nx*impulse*wb;b.vy+=ny*impulse*wb;hit(a,a.id+':'+b.id,{x:-nx,y:-ny},impulse);}}
  }
  this.contacts=nextContacts;delete this._hits;
 }
 apply(frame){return {...frame,objects:this.bodies.map(b=>({...b,...(b.owner?objectGrip(this.document,frame,b.owner)||{}:{}),owner:b.owner?{...b.owner}:null,visible:b.enabled,depth:b.depth??this.config.floorY}))};}
}

export function objectEventPayload(event){return {...(event.actor?{actor:event.actor}:{}),...(event.object?{object:event.object}:{}),...(event.game?{game:event.game}:{}),...(Number.isFinite(event.x)&&Number.isFinite(event.y)?{x:event.x,y:event.y}:{})};}
