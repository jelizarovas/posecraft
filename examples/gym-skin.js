import {spatialKinematics} from '../src/spatial.js';

const tau=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,t)=>a+(b-a)*t;
// A slender neck joins a lower shoulder line; chest volume stays below the jaw.
const rows=[[-86,8,6],[-73,27,11],[-64,33,14],[-53,30,15],[-36,27,15],[-10,22,13],[12,26,13]];
const round=n=>+n.toFixed(5);
function binding(pack){const pose={};for(const side of ['left','right']){pose[side+'Upper.rotation']=side==='left'?180:0;pose[side+'Thigh.rotation']=90;}return spatialKinematics(pack,pose);}
function skinBuilder(bind){
 const vertices=[],triangles=[],points=[];
 const add=(p,weights)=>{const total=weights.reduce((n,w)=>n+w[1],0);points.push({...p});vertices.push({weights:weights.filter(w=>w[1]>1e-6).map(([id,value])=>{const joint=bind[id],m=joint.m,x=p.x-joint.x,y=p.y-joint.y,z=p.z-joint.z;return {joint:id,x:round(m[0]*x+m[3]*y+m[6]*z),y:round(m[1]*x+m[4]*y+m[7]*z),z:round(m[2]*x+m[5]*y+m[8]*z),weight:round(value/total)};})});return vertices.length-1;};
 const connect=(a,b)=>{for(let i=0;i<a.length;i++){const j=(i+1)%a.length;triangles.push([a[i],a[j],b[i]],[a[j],b[j],b[i]]);}};
 const cap=(ring,p,weights)=>{const center=add(p,weights);for(let i=0;i<ring.length;i++)triangles.push([ring[i],ring[(i+1)%ring.length],center]);};
 return {vertices,triangles,points,add,connect,cap};
}
function torsoWeights(x,y){const pelvis=clamp((y+35)/35),side=x<0?'left':'right',shoulder=clamp((Math.abs(x)-22)/13)*clamp((y+88)/12)*clamp((-y-48)/16)*.55;return [['torso',(1-pelvis)*(1-shoulder)],['pelvis',pelvis*(1-shoulder)],[side+'Upper',shoulder]];}
function legWeights(side,y){if(y<28){const t=clamp((y+8)/36);return [['pelvis',1-t],[side+'Thigh',t]];}if(y<65){const t=clamp((y-36)/24);return [[side+'Thigh',1-t],[side+'Calf',t]];}return [[side+'Calf',1]];}
function armWeights(side,d){if(d<30){const torso=.25*(1-clamp(d/14));return [['torso',torso],[side+'Upper',1-torso]];}if(d<55){const t=clamp((d-30)/20);return [[side+'Upper',1-t],[side+'Lower',t]];}const t=clamp((d-69)/7);return [[side+'Lower',1-t],[side+'Hand',t]];}
function splitLegs(builder,ring,garment=false){
 const center=builder.add({x:0,y:garment?17:18,z:0},[['pelvis',.5],['leftThigh',.25],['rightThigh',.25]]);
 for(const [side,sign]of [['right',1],['left',-1]]){
  let previous=(sign>0?ring.slice(0,9):[...ring.slice(8),ring[0]]).concat(center);
  const levels=garment?[[28,14,12]]:[[25,11,10],[43,9.5,8.7],[53,9,8],[69,8,7],[81,5.7,5.7]];
  // The first half-body loop includes the shared crotch edge. Subsequent
  // circular sections retain its winding around each leg, without a hip cap.
  const first=previous.map(index=>builder.points[index]),angles=first.map(p=>Math.atan2(p.z,(p.x-sign*16)));
  for(const [y,rx,rz]of levels){const next=angles.map(angle=>builder.add({x:sign*16+Math.cos(angle)*rx,y,z:Math.sin(angle)*rz},legWeights(side,y)));builder.connect(previous,next);previous=next;}
  // The calf terminates inside the shoe collar. Independent shoe yaw/pitch
  // must not turn the ankle cross-section edge-on or pull it into a point.
  if(!garment)builder.cap(previous,{x:sign*16,y:81,z:0},[[side+'Calf',1]]);
 }
}
// Orient shared edges consistently; a closed connected skin then has one
// unambiguous front/back classification throughout bending and rotation.
function orient(mesh){
 const edges=new Map();mesh.triangles.forEach((t,index)=>t.forEach((a,i)=>{const b=t[(i+1)%3],key=[Math.min(a,b),Math.max(a,b)].join(':');(edges.get(key)||edges.set(key,[]).get(key)).push({index,a,b});}));
 const seen=new Set();for(let start=0;start<mesh.triangles.length;start++){if(seen.has(start))continue;seen.add(start);const queue=[start];for(let q=0;q<queue.length;q++){const index=queue[q],t=mesh.triangles[index];for(let i=0;i<3;i++){const a=t[i],b=t[(i+1)%3],adjacent=edges.get([Math.min(a,b),Math.max(a,b)].join(':'));for(const neighbor of adjacent){if(seen.has(neighbor.index))continue;const n=mesh.triangles[neighbor.index],same=n.some((v,k)=>v===a&&n[(k+1)%3]===b);if(same)[n[1],n[2]]=[n[2],n[1]];seen.add(neighbor.index);queue.push(neighbor.index);}}}}
 return mesh;
}
function bodyMesh(bind){
 const b=skinBuilder(bind),rings=rows.map(([y,rx,rz])=>Array.from({length:16},(_,i)=>{const angle=i*tau/16,x=Math.sin(angle)*rx;return b.add({x,y,z:Math.cos(angle)*rz},torsoWeights(x,y));}));
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<16;i++){if((r===1||r===2)&&[3,4,11,12].includes(i))continue;const j=(i+1)%16;b.triangles.push([rings[r][i],rings[r][j],rings[r+1][i]],[rings[r][j],rings[r+1][j],rings[r+1][i]]);}
 b.cap(rings[0],{x:0,y:-87,z:0},[['torso',1]]);
 for(const [side,sign,s]of [['right',1,4],['left',-1,12]]){
  let previous=[rings[1][s-1],rings[1][s],rings[1][s+1],rings[2][s+1],rings[3][s+1],rings[3][s],rings[3][s-1],rings[2][s-1]];
  // A ring at the shoulder pivot keeps the branch round as the arm drops.
  for(const [d,radius]of [[0,9],[7,11],[22,11.5],[39,9],[47,8.7],[69,7],[76,6],[80,7],[84,5.5],[86,2.5]]){const next=Array.from({length:8},(_,i)=>{const angle=(3+i)*Math.PI/4;return b.add({x:sign*(34+d),y:-68+Math.cos(angle)*radius,z:Math.sin(angle)*radius*.85},armWeights(side,d));});b.connect(previous,next);previous=next;}
  b.cap(previous,{x:sign*120.6,y:-68,z:0},[[side+'Hand',1]]);
 }
 splitLegs(b,rings.at(-1));
 const used=new Set(b.triangles.flat()),remap=new Map(),points=[];const vertices=b.vertices.filter((vertex,index)=>{if(!used.has(index))return false;remap.set(index,remap.size);points.push(b.points[index]);return true;});
 const mesh=orient({vertices,triangles:b.triangles.map(t=>t.map(index=>remap.get(index)))});
 // A small front/back expansion at the bending left elbow restores the
 // volume that linear weight blending would otherwise pinch away.
 const offsets=points.flatMap((p,vertex)=>p.x< -65&&p.x> -82&&Math.abs(p.y+68)<11?[{vertex,z:round(Math.sign(p.z)*1.6)}]:[]);
 mesh.correctives=[{joint:'leftLower',channel:'rotation',min:20,max:120,offsets}];return {mesh,points};
}
function surfaceMesh(bind,body,select,thickness){
 const normals=body.points.map(()=>({x:0,y:0,z:0}));for(const triangle of body.mesh.triangles){const [a,b,c]=triangle.map(i=>body.points[i]),u={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},v={x:c.x-a.x,y:c.y-a.y,z:c.z-a.z},normal={x:u.y*v.z-u.z*v.y,y:u.z*v.x-u.x*v.z,z:u.x*v.y-u.y*v.x};for(const index of triangle)for(const axis of ['x','y','z'])normals[index][axis]+=normal[axis];}
 const b=skinBuilder(bind),remap=new Map(),triangles=body.mesh.triangles.filter(t=>select(t.map(i=>body.points[i])));for(const t of triangles)for(const index of t)if(!remap.has(index)){const p=body.points[index],normal=normals[index],length=Math.hypot(normal.x,normal.y,normal.z)||1;remap.set(index,b.add({x:p.x+normal.x/length*thickness,y:p.y+normal.y/length*thickness,z:p.z+normal.z/length*thickness},body.mesh.vertices[index].weights.map(w=>[w.joint,w.weight])));}
 b.triangles=triangles.map(t=>t.map(i=>remap.get(i)));return {vertices:b.vertices,triangles:b.triangles};
}
function clippedSurface(bind,body,outline,rear=false,thickness=.9){
 const vertices=[],triangles=[],area=outline.reduce((sum,a,i)=>{const b=outline[(i+1)%outline.length];return sum+a.x*b.y-b.x*a.y;},0);if(area<0)outline=[...outline].reverse();
 const lerpVertex=(a,b,t)=>{const weights=new Map();for(const [v,f]of [[a,1-t],[b,t]])for(const w of v.weights){let p=weights.get(w.joint);if(!p){p={joint:w.joint,x:0,y:0,z:0,weight:0};weights.set(w.joint,p);}const s=w.weight*f;p.weight+=s;p.x+=w.x*s;p.y+=w.y*s;p.z+=(w.z||0)*s;}return {x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),z:mix(a.z,b.z,t),weights:[...weights.values()].filter(w=>w.weight>1e-8).map(w=>({...w,x:w.x/w.weight,y:w.y/w.weight,z:w.z/w.weight}))};};
 for(const face of body.mesh.triangles){const points=face.map(i=>body.points[i]),z=points.reduce((sum,p)=>sum+p.z,0)/3;if(rear?z>=-2:z<=2)continue;let polygon=face.map(i=>({...body.points[i],weights:body.mesh.vertices[i].weights}));
  for(let k=0;k<outline.length&&polygon.length;k++){const a=outline[k],b=outline[(k+1)%outline.length],side=p=>(b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x),next=[];for(let i=0;i<polygon.length;i++){const p=polygon[i],q=polygon[(i+1)%polygon.length],u=side(p),v=side(q);if(u>=-1e-8)next.push(p);if((u< -1e-8&&v>1e-8)||(u>1e-8&&v< -1e-8))next.push(lerpVertex(p,q,u/(u-v)));}polygon=next;}
  if(polygon.length<3)continue;const indices=polygon.map(p=>{const index=vertices.length;vertices.push({weights:p.weights.map(w=>{const m=bind[w.joint].m,offset=(rear?-1:1)*thickness;return {...w,x:round(w.x+m[6]*offset),y:round(w.y+m[7]*offset),z:round(w.z+m[8]*offset),weight:round(w.weight)};})});return index;});for(let i=1;i<indices.length-1;i++)triangles.push([indices[0],indices[i],indices[i+1]]);
 }
 return {vertices,triangles};
}
function torsoPoint(x,y,rear=false){let i=rows.findIndex((row,index)=>index<rows.length-1&&y>=row[0]&&y<=rows[index+1][0]);if(i<0)i=y<rows[0][0]?0:rows.length-2;const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0])),rx=mix(a[1],b[1],t),rz=mix(a[2],b[2],t);return {x,y,z:(rear?-1:1)*(rz*Math.sqrt(Math.max(.01,1-(x/rx)**2))+.65)};}
function patchMesh(bind,points,weights=point=>torsoWeights(point.x,point.y)){const b=skinBuilder(bind),ring=points.map(p=>b.add(p,weights(p))),center=points.reduce((p,v)=>({x:p.x+v.x/points.length,y:p.y+v.y/points.length,z:p.z+v.z/points.length}),{x:0,y:0,z:0});center.z=center.z<0?Math.min(...points.map(p=>p.z))-.2:Math.max(...points.map(p=>p.z))+.2;b.cap(ring,center,weights(center));return {vertices:b.vertices,triangles:b.triangles};}
function ribbonMesh(bind,points,width,rear=false){const b=skinBuilder(bind);for(const [x,y]of points)for(const sign of [-1,1]){const p=torsoPoint(x+sign*width/2,y,rear);b.add(p,torsoWeights(p.x,p.y));}for(let i=0;i<points.length-1;i++){const n=i*2;b.triangles.push([n,n+1,n+2],[n+1,n+3,n+2]);}return {vertices:b.vertices,triangles:b.triangles};}
const meshPart=(part,mesh,extra={})=>({...part,d:'M0 0L0 0Z',spatial:{order:part.spatial?.order||0,mesh},...extra});

/** Replace separate limb envelopes with a connected, editable weighted skin. */
export function addGymSkin(pack){
 if(pack.parts.find(p=>p.id==='trunk')?.spatial?.mesh)return pack;
 const bind=binding(pack),body=bodyMesh(bind),removed=new Set(['leftarm','rightarm','leftleg','rightleg','leftgrip','rightgrip','shorts-stripe','abs','back-spine']),parts=[];
 for(const part of pack.parts){if(removed.has(part.id))continue;let replacement=part;
  if(part.id==='trunk')replacement=meshPart(part,body.mesh);
  else if(part.id==='shorts')replacement=meshPart(part,surfaceMesh(bind,body,points=>points.every(p=>p.y>=-10&&p.y<=25),0));
  else if(['left-pec','right-pec','back-scapula-left','back-scapula-right'].includes(part.id)){const side=part.id.includes('left')?-1:1,rear=part.id.startsWith('back'),anchors=[[31,-23],[15,-32],[3,-17],[3,-2],[20,4],[31,-5]].map(([x,y])=>({x:x*side,y:y-(rear?48:42)})),outline=anchors.flatMap((p,i)=>{const previous=anchors[(i+anchors.length-1)%anchors.length],next=anchors[(i+1)%anchors.length],a={x:(previous.x+p.x)/2,y:(previous.y+p.y)/2},b={x:(next.x+p.x)/2,y:(next.y+p.y)/2};return [a,{x:(a.x+2*p.x+b.x)/4,y:(a.y+2*p.y+b.y)/4}];});replacement=meshPart(part,clippedSurface(bind,body,outline,rear),{strokeWidth:0});}
  else if(part.id.endsWith('biceps')){const sign=part.id.startsWith('left')?-1:1,outline=Array.from({length:12},(_,i)=>({x:sign*54+Math.cos(i*tau/12)*9,y:-68+Math.sin(i*tau/12)*6}));replacement=meshPart(part,clippedSurface(bind,body,outline,false,.7));}
  else if(part.id.endsWith('shoe'))replacement={...part,spatial:{...part.spatial,surfaceOf:'trunk'}};
  parts.push(replacement);
 }
 const line=(id,points,rear=false)=>parts.push({id,joint:'torso',d:'M0 0L0 0Z',fill:'#a65f46',stroke:'none',strokeWidth:0,spatial:{order:23,mesh:ribbonMesh(bind,points,1.5,rear)}});
 for(let i=0;i<3;i++){const y=-39+i*10;line('skin-abs-'+i,[[-10,y],[0,y-3],[10,y]]);}line('skin-ab-center',[[0,-43],[0,-14]]);line('skin-spine',[[0,-72],[1,-45],[0,-16]],true);
 for(const [side,sign]of [['left',-1],['right',1]]){const points=[{x:sign*22,y:-6,z:7.7},{x:sign*25,y:-6,z:5.5},{x:sign*27,y:25,z:8},{x:sign*23.5,y:25,z:10}];parts.push({id:side+'-shorts-stripe',joint:'pelvis',d:'M0 0L0 0Z',fill:'#93d2be',stroke:'none',strokeWidth:0,spatial:{order:34,mesh:patchMesh(bind,points,p=>legWeights(side,p.y))}});}
 for(const part of parts)if(part.id!=='trunk'&&part.spatial?.mesh)part.spatial.surfaceOf='trunk';
 pack.parts=parts;return pack;
}
