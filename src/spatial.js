import {clamp} from './index.js';
export const spatialChannels={opacity:{min:0,max:1},yaw:{min:-180,max:180},pitch:{min:-90,max:90},z:{min:-500,max:500},bend:{min:0,max:1}};
export function poseDefaults(pack){return Object.fromEntries(pack.joints.flatMap(j=>[[j.id+'.rotation',j.rotation],[j.id+'.x',0],[j.id+'.y',0],...(pack.spatial?Object.keys(spatialChannels).map(k=>[j.id+'.'+k,k==='opacity'?1:0]):[])]));}
const I=[1,0,0,0,1,0,0,0,1],rad=Math.PI/180;
const mul=(a,b)=>Array.from({length:9},(_,i)=>{const row=Math.floor(i/3),col=i%3;return a[row*3]*b[col]+a[row*3+1]*b[col+3]+a[row*3+2]*b[col+6];});
const apply=(m,x,y,z)=>({x:m[0]*x+m[1]*y+m[2]*z,y:m[3]*x+m[4]*y+m[5]*z,z:m[6]*x+m[7]*y+m[8]*z});
export function spatialKinematics(pack,pose){
 const world={};
 for(const j of pack.joints){const p=world[j.parent]||{x:0,y:0,z:0,m:I},r=(pose[j.id+'.rotation']??j.rotation)*rad,y=(pose[j.id+'.yaw']||0)*rad,t=(pose[j.id+'.pitch']||0)*rad,c=Math.cos,s=Math.sin;
  const m=mul(mul(mul(p.m,[c(r),-s(r),0,s(r),c(r),0,0,0,1]),[c(y),0,s(y),0,1,0,-s(y),0,c(y)]),[1,0,0,0,c(t),-s(t),0,s(t),c(t)]),offset=apply(p.m,j.x+(pose[j.id+'.x']||0),j.y+(pose[j.id+'.y']||0),0);
  world[j.id]={x:p.x+offset.x,y:p.y+offset.y,z:p.z+offset.z,layerDepth:(p.layerDepth||0)+(pose[j.id+'.z']||0),m};
 }
 return world;
}
const numbers=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const morphCache=new WeakMap();
export function morphPath(part,value){
 if(!part.spatial?.morph)return part.d;let compiled=morphCache.get(part);
 if(!compiled){compiled={a:part.d.match(numbers).map(Number),b:part.spatial.morph.target.match(numbers).map(Number)};morphCache.set(part,compiled);}
 let i=0;const t=clamp(value||0,0,1);return part.d.replace(numbers,()=>String(+(compiled.a[i]+(compiled.b[i]-compiled.a[i++])*t).toFixed(4)));
}
// A continuous skin around a two-bone chain. The hand remains at the IK endpoint.
export function softLimbPath(pack,part,pose,world=spatialKinematics(pack,pose)){
 const skin=part.spatial.softLimb,origin=world[part.joint],elbow=world[skin.elbow],hand=world[skin.hand],e={x:elbow.x-origin.x,y:elbow.y-origin.y},h={x:hand.x-origin.x,y:hand.y-origin.y},tip={x:h.x+hand.m[0]*7,y:h.y+hand.m[3]*7},twist=.35+.65*Math.hypot(hand.m[1],hand.m[4]),left=[],right=[];
 for(let i=0;i<=16;i++){const t=Math.min(1,i/12),u=1-t,palm=Math.max(0,(i-12)/4),x=i<=12?2*u*t*e.x+t*t*h.x:h.x+(tip.x-h.x)*palm,y=i<=12?2*u*t*e.y+t*t*h.y:h.y+(tip.y-h.y)*palm,dx=i<=12?2*u*e.x+2*t*(h.x-e.x):tip.x-h.x,dy=i<=12?2*u*e.y+2*t*(h.y-e.y):tip.y-h.y,n=Math.hypot(dx,dy),nx=n>.001?-dy/n:1,ny=n>.001?dx/n:0,r=i<=12?skin.radius*(1-.36*t)*(1+(twist-1)*t*t)+Math.sin(Math.PI*t)*1.2:skin.radius*.64*twist*Math.sqrt(Math.max(.01,1-palm*palm));left.push([x+nx*r,y+ny*r]);right.push([x-nx*r,y-ny*r]);}
 const f=p=>p.map(v=>+v.toFixed(4)).join(' ');right.reverse();
 return 'M'+f(left[0])+' '+left.slice(1).map(p=>'L'+f(p)).join(' ')+' Q'+f([tip.x,tip.y])+' '+f(right[0])+' '+right.slice(1).map(p=>'L'+f(p)).join(' ')+' Q'+f([-e.x/(Math.hypot(e.x,e.y)||1)*skin.radius,-e.y/(Math.hypot(e.x,e.y)||1)*skin.radius])+' '+f(left[0])+'Z';
}
export function spatialParts(pack,frame){
 if(!pack.spatial)return null;let pose=frame.pose;if(frame.physics){const root=pack.joints.find(j=>j.parent===null),w=frame.world[root.id];pose={...pose,[root.id+'.x']:w.x-root.x,[root.id+'.y']:w.y-root.y};}const world=spatialKinematics(pack,pose),result=new Map();
 pack.parts.forEach((part,index)=>{const j=world[part.joint],s=part.spatial||{},m=j.m,offset=apply(m,0,0,s.depth||0),v=[m[0],m[3],m[1],m[4],j.x+offset.x,j.y+offset.y];
  // Volumes retain a side silhouette at profile. Limbs keep their true shortened axis.
  if(s.thickness){const axis=s.axis==='y'?2:0,other=axis===0?2:0,n=Math.hypot(v[axis],v[axis+1]),target=Math.hypot(n,s.thickness*Math.sqrt(Math.max(0,1-n*n))),length=Math.hypot(v[other],v[other+1]),sign=m[8]<0?-1:1;
   if(length>.001){v[axis]=(axis===0?v[3]:-v[1])/length*target*sign;v[axis+1]=(axis===0?-v[2]:v[0])/length*target*sign;}else{const a=(frame.world[part.joint].rotation+(axis===2?90:0))*rad;v[axis]=Math.cos(a)*target;v[axis+1]=Math.sin(a)*target;}}

  if(s.softLimb)v.splice(0,6,1,0,0,1,j.x,j.y);
  let facing=m[8];
  if(s.surface){const {x,width,depth}=s.surface,u=clamp(x/width,-.95,.95),z=depth*Math.sqrt(1-u*u),slope=-depth*u/(width*Math.sqrt(1-u*u)),point=apply(m,x,0,z);
   v[0]=m[0]+m[2]*slope;v[1]=m[3]+m[5]*slope;v[2]=m[1];v[3]=m[4];v[4]=j.x+point.x-v[0]*x;v[5]=j.y+point.y-v[1]*x;facing=m[8]-m[6]*slope;
  }
  // Depth is sampled at an authored part center, not just its attachment pivot.
  const center=apply(m,s.center?.[0]||0,s.center?.[1]||0,s.depth||0);
  result.set(part.id,{matrix:v,transform:`matrix(${v.map(n=>+n.toFixed(5)).join(' ')})`,depth:j.z+j.layerDepth+center.z+(s.order||0)*.001,index,visible:s.facing==='front'?facing>.035:s.facing==='back'?facing<-.035:true,d:s.softLimb?softLimbPath(pack,part,pose,world):s.morph?morphPath(part,frame.pose[s.morph.channel]):null});
 });
 return {world,parts:result,order:[...result.keys()].sort((a,b)=>result.get(a).depth-result.get(b).depth||result.get(a).index-result.get(b).index)};
}
