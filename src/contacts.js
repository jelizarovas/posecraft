import {clamp,forwardKinematics,wrapAngle} from './index.js';
import {spatialKinematics} from './spatial.js';
const rad=Math.PI/180,I=[1,0,0,0,1,0,0,0,1],cache=new WeakMap();
const apply=(m,p)=>[m[0]*p[0]+m[1]*p[1]+m[2]*p[2],m[3]*p[0]+m[4]*p[1]+m[5]*p[2],m[6]*p[0]+m[7]*p[1]+m[8]*p[2]];
const rz=(p,a)=>{const c=Math.cos(a*rad),s=Math.sin(a*rad);return [c*p[0]-s*p[1],s*p[0]+c*p[1],p[2]];};
function tail(pose,id){const y=(pose[id+'.yaw']||0)*rad,p=(pose[id+'.pitch']||0)*rad,cy=Math.cos(y),sy=Math.sin(y),cp=Math.cos(p),sp=Math.sin(p);return [cy,sy*sp,sy*cp,0,cp,-sp,-sy,cy*sp,cy*cp];}
function compilation(pack){let value=cache.get(pack);if(!value){value={joints:new Map(pack.joints.map(j=>[j.id,j]))};cache.set(pack,value);}return value;}
function basis(pack,pose){if(pack.spatial)return spatialKinematics(pack,pose);const world=forwardKinematics(pack.joints,pose);return Object.fromEntries(Object.entries(world).map(([id,p])=>{const c=Math.cos(p.rotation*rad),s=Math.sin(p.rotation*rad);return [id,{...p,z:0,m:[c,-s,0,s,c,0,0,0,1]}];}));}
function placement(actor,frame){return frame.placement||actor.transform;}
function scenePoint(p,t){const c=Math.cos(t.rotation*rad),s=Math.sin(t.rotation*rad);return {x:t.x+t.scale*(p.x*c-p.y*s),y:t.y+t.scale*(p.x*s+p.y*c)};}
function localPoint(p,t){const c=Math.cos(t.rotation*rad),s=Math.sin(t.rotation*rad),x=(p.x-t.x)/t.scale,y=(p.y-t.y)/t.scale;return {x:x*c+y*s,y:-x*s+y*c};}
function ranges(joint,offset,bend){const result=[];for(let k=-2;k<=2;k++){const a=offset+k*360+(bend===1?0:-180),b=a+180,low=Math.max(joint.min,a),high=Math.min(joint.max,b);if(low<=high)result.push([low,high]);}return result;}
function nearest(value,intervals){let best=intervals[0][0],error=Infinity;for(const [lo,hi] of intervals){const n=clamp(value,lo,hi),e=Math.abs(n-value);if(e<error){best=n;error=e;}}return best;}
// Each rotating joint traces a projected ellipse. Three endpoint samples compile
// that ellipse; bounded one-dimensional searches then avoid repeated whole-rig FK.
function minimize(evaluate,intervals,current){let best=current,error=evaluate(current);for(const [lo,hi] of intervals){const step=(hi-lo)/16;let at=lo,score=Infinity;for(let i=0;i<=16;i++){const angle=lo+step*i,e=evaluate(angle);if(e<score){score=e;at=angle;}}let a=Math.max(lo,at-step),b=Math.min(hi,at+step);for(let i=0;i<16;i++){const x=a+(b-a)/3,y=b-(b-a)/3;if(evaluate(x)<evaluate(y))b=y;else a=x;}const angle=(a+b)/2,e=evaluate(angle);if(e<error){error=e;best=angle;}if(score<error){error=score;best=at;}}return best;}
function ellipseObjective(endpoint,which,angles,target){const at=a=>endpoint(which===0?a:angles[0],which===1?a:angles[1]),p0=at(0),p90=at(90),p180=at(180),center=[(p0.x+p180.x)/2,(p0.y+p180.y)/2],a=[p0.x-center[0],p0.y-center[1]],b=[p90.x-center[0],p90.y-center[1]];return angle=>{const c=Math.cos(angle*rad),s=Math.sin(angle*rad),x=center[0]+a[0]*c+b[0]*s-target.x,y=center[1]+a[1]*c+b[1]*s-target.y;return x*x+y*y;};}
function mixRotation(a,b,weight,joint){if(weight===1)return b;if(joint.min===-180&&joint.max===180)return wrapAngle(a+wrapAngle(b-a)*weight);return clamp(a+(b-a)*weight,joint.min,joint.max);}
function orientEnd(pack,pose,end,before){const world=basis(pack,pose),parent=world[end.parent],v=apply(tail(pose,end.id),[1,0,0]),desired=Math.atan2(before.m[3],before.m[0]),axis=angle=>apply(parent.m,rz(v,angle)),error=angle=>{const p=axis(angle),length=Math.hypot(p[0],p[1]);if(length<1e-8)return 4;return (p[0]/length-Math.cos(desired))**2+(p[1]/length-Math.sin(desired))**2;};const current=pose[end.id+'.rotation']??end.rotation,solved=minimize(error,[[end.min,end.max]],current);pose[end.id+'.rotation']=solved;return error(solved)>.0004;}
/** Solve one connected upper/lower/end chain in the projected character plane. */
export function solveContact(pack,source,chain,target,{bend=1,weight=1,keepOrientation=true}={}){
 const map=compilation(pack).joints,upper=map.get(chain.upper),lower=map.get(chain.lower),end=map.get(chain.end);
 if(!upper||!lower||!end||lower.parent!==upper.id||end.parent!==lower.id)throw Error('Contact needs a connected upper, lower and end joint.');
 if(![target.x,target.y,weight].every(Number.isFinite)||weight<0||weight>1||![1,-1].includes(bend))throw Error('Invalid contact target or weight.');
 const pose={...source},world=basis(pack,pose),origin=world[upper.id],parent=upper.parent?world[upper.parent].m:I,upperTail=pack.spatial?tail(pose,upper.id):I,lowerTail=pack.spatial?tail(pose,lower.id):I;
 const first=[lower.x+(pose[lower.id+'.x']||0),lower.y+(pose[lower.id+'.y']||0),0],second=[end.x+(pose[end.id+'.x']||0),end.y+(pose[end.id+'.y']||0),0],last=apply(lowerTail,second);
 const endpoint=(u,l)=>{const rotated=rz(last,l),v=apply(parent,rz(apply(upperTail,[first[0]+rotated[0],first[1]+rotated[1],rotated[2]]),u));return {x:origin.x+v[0],y:origin.y+v[1]};};
 const a1=Math.atan2(first[1],first[0])/rad,a2=Math.atan2(second[1],second[0])/rad,l1=Math.hypot(...first),l2=Math.hypot(...second),allowed=ranges(lower,a1-a2,bend),lowerRanges=allowed.length?allowed:[[lower.min,lower.max]],initial=[source[upper.id+'.rotation']??upper.rotation,source[lower.id+'.rotation']??lower.rotation];
 const initialActual=world[end.id],initialError=Math.hypot(initialActual.x-target.x,initialActual.y-target.y),initialAllowed=allowed.some(([lo,hi])=>initial[1]>=lo&&initial[1]<=hi)&&initial[0]>=upper.min&&initial[0]<=upper.max;
 if(weight===0||initialError<.05&&initialAllowed)return {pose,actual:{x:initialActual.x,y:initialActual.y},error:initialError,limited:false};
 let angles=[clamp(initial[0],upper.min,upper.max),nearest(initial[1],lowerRanges)],best=angles.slice(),bestError=Infinity;
 const error=values=>{const p=endpoint(...values);return (p.x-target.x)**2+(p.y-target.y)**2;};
 // Analytic seeds select the requested bend branch. The projected solve also
 // handles yaw/pitch and authored translation offsets without changing them.
 const dx=target.x-origin.x,dy=target.y-origin.y,d=Math.hypot(dx,dy),beta=bend*Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*Math.max(1e-8,l1*l2)),-1,1)),parentAngle=Math.atan2(parent[3],parent[0])/rad;
 const seed=[clamp(wrapAngle((Math.atan2(dy,dx)-Math.atan2(l2*Math.sin(beta),l1+l2*Math.cos(beta)))/rad-parentAngle-a1),upper.min,upper.max),nearest(wrapAngle(beta/rad+a1-a2),lowerRanges)];
 // Exact fixed-point termination is lossless: the next deterministic pass would
 // receive identical angles and return the same result, even for distant targets.
 for(const start of [seed,angles]){angles=start.slice();for(let pass=0;pass<10;pass++){const previous=angles.slice();for(const which of [1,0])angles[which]=minimize(ellipseObjective(endpoint,which,angles,target),which===0?[[upper.min,upper.max]]:lowerRanges,angles[which]);const e=error(angles);if(e<bestError){bestError=e;best=angles.slice();}if(e<1e-8||angles.every((value,i)=>value===previous[i]))break;}}
 for(const [i,joint] of [upper,lower].entries())pose[joint.id+'.rotation']=mixRotation(initial[i],best[i],weight,joint);
 let orientationLimited=false;if(keepOrientation&&weight>0)orientationLimited=orientEnd(pack,pose,end,world[end.id]);
 const actualWorld=basis(pack,pose)[end.id];return {pose,actual:{x:actualWorld.x,y:actualWorld.y},error:Math.hypot(actualWorld.x-target.x,actualWorld.y-target.y),limited:bestError>.25||orientationLimited||!allowed.length};
}
/** Apply contacts to a fresh frame. Cross-actor targets read the unconstrained
 * frame so mutual contacts cannot create history-dependent feedback loops. */
export function applyContacts(document,frame,{time=frame.localTime??frame.time,actorTimes={},actorClips={}}={}){
 if(!document.contacts?.length)return frame;
 const actors=new Map(document.actors.map(a=>[a.id,a])),base=new Map(frame.actors.map(a=>[a.id,a])),contexts=new Map(),result={...frame,actors:frame.actors.slice(),contacts:[]};
 const context=id=>{if(contexts.has(id))return contexts.get(id);const actor=actors.get(id),evaluated=base.get(id);if(!actor||!evaluated)return null;const pack=document.packs[actor.pack],value={actor,evaluated,pack,world:basis(pack,evaluated.pose),placement:placement(actor,evaluated)};contexts.set(id,value);return value;};
 for(const contact of document.contacts){const source=context(contact.actor);if(!source)continue;let target;
  if(contact.target.type==='point')target={x:contact.target.x,y:contact.target.y};else {const other=context(contact.target.actor),joint=other?.world[contact.target.joint];if(!joint)continue;const offset=apply(joint.m,[contact.target.offsetX||0,contact.target.offsetY||0,0]);target=scenePoint({x:joint.x+offset[0],y:joint.y+offset[1]},other.placement);}
  const index=result.actors.findIndex(a=>a.id===contact.actor),current=result.actors[index],elapsed=actorTimes[contact.actor]??current.clipTime??time,localTime=contact.period?((elapsed%contact.period)+contact.period)%contact.period:elapsed,clip=actorClips[contact.actor]??current.clip??source.pack.states[current.state]?.clip??current.state;
  let reason=!contact.enabled?'disabled':contact.weight===0?'weight':contact.clip&&contact.clip!==clip?'clip':localTime<contact.start-1e-8||localTime>contact.end+1e-8?'outside-window':current.physics||current.recovery?'physics':null;
  let pose=current.pose,limited=false;if(!reason){const solved=solveContact(source.pack,pose,contact.chain,localPoint(target,source.placement),contact);pose=solved.pose;limited=solved.limited;result.actors[index]={...current,pose,world:forwardKinematics(source.pack.joints,pose)};}
  const endpoint=basis(source.pack,pose)[contact.chain.end],actual=scenePoint(endpoint,source.placement),error=Math.hypot(actual.x-target.x,actual.y-target.y);result.contacts.push({id:contact.id,actor:contact.actor,active:!reason,reason,target,actual,error,limited});
 }
 return result;
}
