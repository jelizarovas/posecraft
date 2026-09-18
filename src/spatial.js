import {hairShellPath} from './hair-shell.js';
import {clamp} from './index.js';
export const spatialChannels={opacity:{min:0,max:1},yaw:{min:-180,max:180},pitch:{min:-90,max:90},z:{min:-500,max:500},bend:{min:0,max:1}};
export function poseDefaults(pack){return Object.fromEntries(pack.joints.flatMap(j=>[[j.id+'.rotation',j.rotation],[j.id+'.x',0],[j.id+'.y',0],...(pack.spatial?Object.keys(spatialChannels).map(k=>[j.id+'.'+k,k==='opacity'?1:0]):[])]));}
const I=[1,0,0,0,1,0,0,0,1],rad=Math.PI/180;
const mul=(a,b)=>Array.from({length:9},(_,i)=>{const row=Math.floor(i/3),col=i%3;return a[row*3]*b[col]+a[row*3+1]*b[col+3]+a[row*3+2]*b[col+6];});
const apply=(m,x,y,z)=>({x:m[0]*x+m[1]*y+m[2]*z,y:m[3]*x+m[4]*y+m[5]*z,z:m[6]*x+m[7]*y+m[8]*z});
const rotationMatrix=({rotation=0,yaw=0,pitch=0})=>{const r=rotation*rad,y=yaw*rad,p=pitch*rad,c=Math.cos,s=Math.sin;return mul(mul([c(r),-s(r),0,s(r),c(r),0,0,0,1],[c(y),0,s(y),0,1,0,-s(y),0,c(y)]),[1,0,0,0,c(p),-s(p),0,s(p),c(p)]);};
const wrapRotation=value=>((value+180)%360+360)%360-180;
/** Author an end joint's orientation in the actor's world frame. Ancestors are
 * ordered root to parent; joint records may supply nonzero rest rotations. */
export function setWorldOrientation(pose,jointId,ancestors,target){
 let parent=I;for(const ancestor of ancestors){const id=typeof ancestor==='string'?ancestor:ancestor.id;parent=mul(parent,rotationMatrix({rotation:pose[id+'.rotation']??ancestor.rotation??0,yaw:pose[id+'.yaw']||0,pitch:pose[id+'.pitch']||0}));}
 const inverse=[parent[0],parent[3],parent[6],parent[1],parent[4],parent[7],parent[2],parent[5],parent[8]],m=mul(inverse,rotationMatrix(target));
 let yaw=Math.asin(clamp(-m[6],-1,1))/rad,rotation,pitch;
 if(Math.hypot(m[0],m[3])<1e-7){rotation=Math.atan2(-m[1],m[4])/rad;pitch=0;}
 else{rotation=Math.atan2(m[3],m[0])/rad;pitch=Math.atan2(m[7],m[8])/rad;}
 if(pitch>90){pitch-=180;yaw=180-yaw;rotation+=180;}else if(pitch< -90){pitch+=180;yaw=-180-yaw;rotation+=180;}
 pose[jointId+'.rotation']=wrapRotation(rotation);pose[jointId+'.yaw']=wrapRotation(yaw);pose[jointId+'.pitch']=clamp(pitch,-90,90);return pose;
}
export function spatialKinematics(pack,pose){
 const world={};
 for(const j of pack.joints){const p=world[j.parent]||{x:0,y:0,z:0,m:I},r=(pose[j.id+'.rotation']??j.rotation)*rad,y=(pose[j.id+'.yaw']||0)*rad,t=(pose[j.id+'.pitch']||0)*rad,c=Math.cos,s=Math.sin;
  const m=mul(mul(mul(p.m,[c(r),-s(r),0,s(r),c(r),0,0,0,1]),[c(y),0,s(y),0,1,0,-s(y),0,c(y)]),[1,0,0,0,c(t),-s(t),0,s(t),c(t)]),offset=apply(p.m,j.x+(pose[j.id+'.x']||0),j.y+(pose[j.id+'.y']||0),0);
  world[j.id]={x:p.x+offset.x,y:p.y+offset.y,z:p.z+offset.z,layerDepth:(p.layerDepth||0)+(pose[j.id+'.z']||0),m};
 }
 return world;
}
const numbers=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const turnaroundCache=new WeakMap();
export function turnaroundPath(part,angle){
 let compiled=turnaroundCache.get(part);if(!compiled){compiled=part.spatial.turnaround.views.map(view=>({angle:view.angle,values:view.d.match(numbers).map(Number),d:view.d}));turnaroundCache.set(part,compiled);}
 const yaw=((angle%360)+360)%360,index=compiled.findIndex((view,i)=>i<compiled.length-1&&yaw>=view.angle&&yaw<compiled[i+1].angle),a=compiled[Math.max(0,index)],b=compiled[Math.max(0,index)+1],t=(yaw-a.angle)/(b.angle-a.angle);let n=0;
 return a.d.replace(numbers,()=>String(+(a.values[n]+(b.values[n]-a.values[n++])*t).toFixed(4)));
}
const morphCache=new WeakMap();
export function morphPath(part,value){
 if(!part.spatial?.morph)return part.d;let compiled=morphCache.get(part);
 if(!compiled){compiled={a:part.d.match(numbers).map(Number),b:part.spatial.morph.target.match(numbers).map(Number)};morphCache.set(part,compiled);}
 let i=0;const t=clamp(value||0,0,1);return part.d.replace(numbers,()=>String(+(compiled.a[i]+(compiled.b[i]-compiled.a[i++])*t).toFixed(4)));
}
// The outline of overlapping round volumes has no ribbon normals to reverse at
// a folded elbow or wrist. Only the external silhouette is stroked: no internal bones.
const skinCircle=Array.from({length:12},(_,i)=>({x:Math.cos(i*Math.PI/6),y:Math.sin(i*Math.PI/6)})),skinCache=new WeakMap();
function skinEnvelope(volumes){
 const cross=(a,b)=>a.x*b.y-a.y*b.x,sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),at=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
 const hull=circles=>{const points=circles.flatMap(c=>skinCircle.map(v=>({x:c.x+v.x*c.r,y:c.y+v.y*c.r}))).sort((a,b)=>a.x-b.x||a.y-b.y),half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(sub(out.at(-1),out.at(-2)),sub(p,out.at(-1)))<=1e-9)out.pop();out.push(p);}return out;};return [...half(points).slice(0,-1),...half(points.reverse()).slice(0,-1)];};
 const shapes=volumes.map(hull),segments=[];
 const inside=(point,shape)=>{let edge=false;for(let k=0;k<shape.length;k++){const a=shape[k],b=shape[(k+1)%shape.length],side=cross(sub(b,a),sub(point,a));if(side< -1e-7)return 0;if(Math.abs(side)<1e-7)edge=true;}return edge?1:2;};
 // Split polygon edges at overlaps, then keep only the external boundary of
 // the three volumes. Folding one volume over another cannot twist that edge.
 shapes.forEach((shape,index)=>{for(let k=0;k<shape.length;k++){
  const a=shape[k],b=shape[(k+1)%shape.length],direction=sub(b,a),cuts=[0,1];
  shapes.forEach((other,j)=>{if(j===index)return;for(let n=0;n<other.length;n++){const c=other[n],d=other[(n+1)%other.length],edge=sub(d,c),denominator=cross(direction,edge);if(Math.abs(denominator)<1e-9)continue;const t=cross(sub(c,a),edge)/denominator,u=cross(sub(c,a),direction)/denominator;if(t>1e-8&&t<1-1e-8&&u>=-1e-8&&u<=1+1e-8)cuts.push(t);}});
  cuts.sort((a,b)=>a-b);for(let n=1;n<cuts.length;n++){const t=cuts[n-1],u=cuts[n];if(u-t<1e-8)continue;const middle=at(a,b,(t+u)/2);if(shapes.some((other,j)=>{if(j===index)return false;const overlap=inside(middle,other);return overlap===2||j<index&&overlap===1;}))continue;segments.push({start:at(a,b,t),end:at(a,b,u)});}
 }});
 const f=p=>Number(p.x.toFixed(4))+' '+Number(p.y.toFixed(4));let path='';
 while(segments.length){let segment=segments.shift();const contour=[segment.start];
  for(;;){contour.push(segment.end);if(Math.hypot(segment.end.x-contour[0].x,segment.end.y-contour[0].y)<1e-5){contour.pop();break;}let next=-1,distance=Infinity;for(let i=0;i<segments.length;i++){const d=Math.hypot(segments[i].start.x-segment.end.x,segments[i].start.y-segment.end.y);if(d<distance){distance=d;next=i;}}if(next<0||distance>1e-4)break;segment=segments.splice(next,1)[0];}
  if(contour.length<3)continue;path+='M'+f(at(contour.at(-1),contour[0],.5));for(let i=0;i<contour.length;i++)path+='Q'+f(contour[i])+' '+f(at(contour[i],contour[(i+1)%contour.length],.5));path+='Z';
 }return path;
}

function softLimbGeometry(pack,part,pose,world){
 const skin=part.spatial.softLimb,origin=world[part.joint],elbow=world[skin.elbow],hand=world[skin.hand],e={x:elbow.x-origin.x,y:elbow.y-origin.y},h={x:hand.x-origin.x,y:hand.y-origin.y},width=m=>.6+.4*Math.min(1,Math.hypot(m[1],m[4])),upper=width(origin.m),fore=width(elbow.m),wrist=width(hand.m),r=skin.radius,volumes=[[],[],[]];
 const key=[e.x,e.y,h.x,h.y,upper,fore,wrist,hand.m[0],hand.m[3],r],cached=skinCache.get(part);if(cached&&key.every((v,i)=>v===cached.key[i]))return cached;
 // Taper each actual bone independently. A rounded elbow replaces the old
 // shoulder-to-wrist quadratic, which cut across tightly folded poses.
 for(let i=0;i<=2;i++){const t=i/2;volumes[0].push({x:e.x*t,y:e.y*t,r:r*(.96-.22*t+.08*Math.sin(Math.PI*t))*upper});}
 for(let i=0;i<=2;i++){const t=i/2,twist=fore+(wrist-fore)*t*t*t;volumes[1].push({x:e.x+(h.x-e.x)*t,y:e.y+(h.y-e.y)*t,r:r*(.74-.16*t+.14*Math.sin(Math.PI*t))*twist});}
 // The wrist center stays exactly at the IK/contact point. Its projected axis
 // shapes a short rounded palm; a reversed axis simply overlaps the forearm.
 for(let i=0;i<=2;i++){const t=i/2;volumes[2].push({x:h.x+hand.m[0]*r*.72*t,y:h.y+hand.m[3]*r*.72*t,r:r*.58*wrist*(1-.55*t)});}
 const geometry={key,path:skinEnvelope(volumes),volumes,clips:null};skinCache.set(part,geometry);return geometry;
}
export function softLimbPath(pack,part,pose,world=spatialKinematics(pack,pose)){return softLimbGeometry(pack,part,pose,world).path;}

// A limb keeps one seamless outline, but each bone can be interleaved with
// other geometry. Clipping that outline avoids drawing artificial elbow seams.
function limbFragments(pack,part,pose,world,view){
 const skin=part.spatial.softLimb,geometry=softLimbGeometry(pack,part,pose,world);
 geometry.clips??=geometry.volumes.map(volume=>skinEnvelope([volume]));
 const upper=world[part.joint],fore=world[skin.elbow],hand=world[skin.hand],r=skin.radius;
 const depth=j=>j.z+j.layerDepth,order=(part.spatial.order||0)*.001,skinDepth=part.spatial.depth||0;
 return ['upper','forearm','palm'].map((kind,index)=>({
  ...view,partId:part.id,kind,clipD:geometry.clips[index],
  depth:(index===0?(depth(upper)+depth(fore))*.5:index===1?(depth(fore)+depth(hand))*.5:depth(hand)+hand.m[6]*r*.36)+[upper,fore,hand][index].m[8]*skinDepth+order
 }));
}

function attachSurfaces(pack,parts,fragments){
 const children=new Map(),attached=new Set(),byPart=new Map();
 for(const [id,fragment]of fragments)(byPart.get(fragment.partId)||byPart.set(fragment.partId,[]).get(fragment.partId)).push(id);
 for(const part of pack.parts){
  const hostId=part.spatial?.surfaceOf||part.spatial?.mask;
  if(!hostId||!parts.has(hostId)||hostId===part.id)continue;
  const host=pack.parts[parts.get(hostId).index],skin=host.spatial?.softLimb;
  const kind=skin?(part.joint===skin.hand?'palm':part.joint===skin.elbow?'forearm':'upper'):null,hostFragment=kind?hostId+'--'+kind:hostId;
  if(!fragments.has(hostFragment))continue;
  const view=parts.get(part.id),hostView=parts.get(hostId);view.depth=hostView.depth;view.visible&&=hostView.visible;
  for(const id of byPart.get(part.id)||[]){const fragment=fragments.get(id),target=skin&&fragment.kind!=='part'?hostId+'--'+fragment.kind:hostFragment;fragment.depth=fragments.get(target).depth;fragment.visible&&=fragments.get(target).visible;(children.get(target)||children.set(target,[]).get(target)).push(id);attached.add(id);}
 }
 const compare=(a,b)=>fragments.get(a).depth-fragments.get(b).depth||fragments.get(a).index-fragments.get(b).index;
 const order=[],visited=new Set(),emit=id=>{if(visited.has(id))return;visited.add(id);order.push(id);const decals=children.get(id)||[];decals.sort((a,b)=>{const pa=pack.parts[fragments.get(a).index],pb=pack.parts[fragments.get(b).index];return (pa.spatial?.order||0)-(pb.spatial?.order||0)||fragments.get(a).index-fragments.get(b).index;});for(const decal of decals)emit(decal);};
 for(const id of [...fragments.keys()].filter(id=>!attached.has(id)).sort(compare))emit(id);
 // Legacy masks can form chains or cycles. Preserve every stable slot even
 // when those older documents cannot express a single surface owner.
 for(const id of [...fragments.keys()].sort(compare))emit(id);
 return order;
}

export function spatialParts(pack,frame){
 if(!pack.spatial)return null;let pose=frame.pose;if(frame.physics){const root=pack.joints.find(j=>j.parent===null),w=frame.world[root.id];pose={...pose,[root.id+'.x']:w.x-root.x,[root.id+'.y']:w.y-root.y};}const world=spatialKinematics(pack,pose),result=new Map();
 pack.parts.forEach((part,index)=>{const j=world[part.joint],s=part.spatial||{},m=j.m,offset=apply(m,0,0,s.depth||0),v=[m[0],m[3],m[1],m[4],j.x+offset.x,j.y+offset.y];
  // Volumes retain a side silhouette at profile. Limbs keep their true shortened axis.
  if(s.thickness&&!s.turnaround){const axis=s.axis==='y'?2:0,other=axis===0?2:0,n=Math.hypot(v[axis],v[axis+1]),target=Math.hypot(n,s.thickness*Math.sqrt(Math.max(0,1-n*n))),length=Math.hypot(v[other],v[other+1]),sign=m[8]<0?-1:1;
   if(length>.001){v[axis]=(axis===0?v[3]:-v[1])/length*target*sign;v[axis+1]=(axis===0?-v[2]:v[0])/length*target*sign;}else{const a=(frame.world[part.joint].rotation+(axis===2?90:0))*rad;v[axis]=Math.cos(a)*target;v[axis+1]=Math.sin(a)*target;}}

  if(s.softLimb||s.hairShell)v.splice(0,6,1,0,0,1,j.x,j.y);
  let facing=m[8],turnPath=null;
  if(s.turnaround){const up=Math.hypot(m[1],m[4]),roll=(frame.world?.[part.joint]?.rotation||0)*rad,hx=up>.0001?m[4]/up:Math.cos(roll),hy=up>.0001?-m[1]/up:Math.sin(roll),angle=Math.atan2(m[2]*hx+m[5]*hy,m[8])/rad;v[0]=hx;v[1]=hy;turnPath=turnaroundPath(part,angle);}
  if(s.surface){const {x,width,depth}=s.surface,u=clamp(x/width,-.95,.95),z=depth*Math.sqrt(1-u*u),slope=-depth*u/(width*Math.sqrt(1-u*u)),point=apply(m,x,0,z);
   v[0]=m[0]+m[2]*slope;v[1]=m[3]+m[5]*slope;v[2]=m[1];v[3]=m[4];v[4]=j.x+point.x-v[0]*x;v[5]=j.y+point.y-v[1]*x;facing=m[8]-m[6]*slope;
  }
  // Front hair fades before profile; the rear covering fills the same interval.
  const frontCoverage=s.facingFade?clamp(facing/s.facingFade,0,1):1,opacity=s.facingFade?(s.facing==='back'?1-frontCoverage:frontCoverage):1;
  // Depth is sampled at an authored part center, not just its attachment pivot.
  const center=apply(m,s.center?.[0]||0,s.center?.[1]||0,s.depth||0);
  result.set(part.id,{matrix:v,transform:`matrix(${v.map(n=>+n.toFixed(5)).join(' ')})`,depth:j.z+j.layerDepth+center.z+(s.order||0)*.001,index,opacity,visible:turnPath&&(turnPath.match(numbers)||[]).every(n=>Number(n)===0)?false:s.facingFade?opacity>0:s.facing==='front'?facing>.035:s.facing==='back'?facing<-.035:true,d:turnPath??(s.hairShell?hairShellPath(s.hairShell,m,frame.inputs?.[part.variantInput]):s.softLimb?softLimbPath(pack,part,pose,world):s.morph?morphPath(part,frame.pose[s.morph.channel]):null)});
 });
 const fragments=new Map();for(const part of pack.parts){const view=result.get(part.id);if(part.spatial?.softLimb){for(const fragment of limbFragments(pack,part,pose,world,view))fragments.set(part.id+'--'+fragment.kind,fragment);}else fragments.set(part.id,{...view,partId:part.id,kind:'part'});}
 const fragmentOrder=attachSurfaces(pack,result,fragments),order=[],seen=new Set();for(const id of fragmentOrder){const partId=fragments.get(id).partId;if(!seen.has(partId)){order.push(partId);seen.add(partId);}}
 return {world,parts:result,order,fragments,fragmentOrder};
}
