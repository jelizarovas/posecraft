import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {spatialKinematics,spatialParts,setWorldOrientation,turnaroundPath} from '../src/spatial.js';
import {forwardKinematics,sampleClip,wrapAngle,constrainPose} from '../src/index.js';
const joint=(id,parent,rotation=0)=>({id,parent,x:0,y:0,rotation,length:0,min:-180,max:180});
const pack=createGym().packs.atlas;
function outlinePoints(path){const points=[];let point={x:0,y:0};for(const command of path.match(/[MLQZ][^MLQZ]*/g)||[]){const n=(command.slice(1).match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:e[-+]?\d+)?/gi)||[]).map(Number);if(command[0]==='M'||command[0]==='L'){point={x:n[0],y:n[1]};points.push(point);}else if(command[0]==='Q'){const a=point;for(let k=1;k<=6;k++){const t=k/6;points.push({x:(1-t)**2*a.x+2*(1-t)*t*n[0]+t*t*n[2],y:(1-t)**2*a.y+2*(1-t)*t*n[1]+t*t*n[3]});}point={x:n[2],y:n[3]};}}return points;}
const area=p=>p.reduce((sum,a,i)=>{const b=p[(i+1)%p.length];return sum+a.x*b.y-b.x*a.y;},0)/2;
const width=p=>Math.max(...p.map(p=>p.x))-Math.min(...p.map(p=>p.x));

test('directional body and shoe contours retain winding and volume through every rear/front mirror interval',()=>{
 for(const id of ['head-shape','hair','trunk','shorts','leftshoe','rightshoe']){
  const part=pack.parts.find(p=>p.id===id),anchors=part.spatial.turnaround.views.map(v=>outlinePoints(v.d)),sign=Math.sign(area(anchors[0])),minimum=Math.min(...anchors.map(p=>Math.abs(area(p))));let previous=null;
  for(let angle=0;angle<=360;angle++){
   const points=outlinePoints(turnaroundPath(part,angle)),a=area(points),w=width(points);assert.equal(Math.sign(a),sign,`${id} winding at ${angle}`);assert.ok(Math.abs(a)>minimum*.7,`${id} collapses at ${angle}`);if(previous)assert.ok(Math.abs(w-previous)<2,`${id} width jump at ${angle}`);previous=w;if(id.endsWith('shoe'))assert.ok(w>18,'shoe retains its heel/toe volume');
  }
 }
});

test('world end orientation cancels arbitrary ancestor yaw/pitch instead of adding the heading twice',()=>{
 const p={spatial:true,joints:[joint('root',null,12),joint('thigh','root'),joint('calf','thigh'),joint('foot','calf')],parts:[]},reference={spatial:true,joints:[joint('target',null)],parts:[]};
 for(let heading=-180;heading<=180;heading+=10)for(const bend of [-75,0,65]){
  const pose={'root.rotation':-9,'root.yaw':35,'thigh.rotation':110,'thigh.yaw':bend,'calf.rotation':-135,'calf.yaw':-bend*.6,'calf.pitch':18},target={rotation:12,yaw:heading,pitch:-14};setWorldOrientation(pose,'foot',p.joints.slice(0,3),target);
  const actual=spatialKinematics(p,pose).foot.m,expected=spatialKinematics(reference,{'target.rotation':target.rotation,'target.yaw':target.yaw,'target.pitch':target.pitch}).target.m;
  assert.ok(actual.every((v,i)=>Math.abs(v-expected[i])<1e-10),`world orientation ${heading}/${bend}`);assert.ok(Math.abs(pose['foot.pitch'])<=90);assert.ok(Math.abs(pose['foot.yaw'])<=180);
 }
});

test('corrected foot orientation keeps directional projection nondegenerate through an entire turn',()=>{
 const shoe=structuredClone(pack.parts.find(p=>p.id==='leftshoe'));shoe.joint='foot';delete shoe.spatial.surfaceOf;
 const p={spatial:true,joints:[joint('root',null),joint('thigh','root'),joint('calf','thigh'),joint('foot','calf')],parts:[shoe]};
 for(let angle=-180;angle<=180;angle++){
  const pose={'thigh.rotation':105,'thigh.yaw':-36,'calf.rotation':-110,'calf.yaw':45};setWorldOrientation(pose,'foot',['root','thigh','calf'],{rotation:0,yaw:angle,pitch:-12});const v=spatialParts(p,{pose,world:forwardKinematics(p.joints,pose)}).parts.get(shoe.id),m=v.matrix,det=Math.abs(m[0]*m[3]-m[1]*m[2]);assert.ok(det>.97,`shoe compression at ${angle}`);assert.ok(width(outlinePoints(v.d))>18);
 }
});

test('yaw interpolation takes the short rear seam while exact half turns keep authored direction',()=>{
 const clip=(a,b)=>({duration:1,loop:false,tracks:{'foot.yaw':[[0,a,'linear'],[1,b,'linear']]}});
 assert.equal(sampleClip(clip(179,-179),.5)['foot.yaw'],180);assert.equal(sampleClip(clip(-179,179),.5)['foot.yaw'],-180);assert.equal(sampleClip(clip(0,180),.5)['foot.yaw'],90);assert.equal(sampleClip(clip(0,-180),.5)['foot.yaw'],-90);
 const frames=[];for(let i=0;i<=60;i++)frames.push(sampleClip(clip(170,-170),i/60)['foot.yaw']);for(let i=1;i<frames.length;i++){assert.ok(Math.abs(wrapAngle(frames[i]-frames[i-1]))<1,'dense playback never spins through the front');assert.ok(Math.abs(frames[i])<=180,'activity bounds do not truncate seam motion');}
});

test('compressed asynchronous Euler tracks cross a chart seam without a physical flip and honor in-place edits',()=>{
 const rig={spatial:true,joints:[joint('foot',null)],parts:[]},clip={duration:1,loop:false,tracks:{'foot.rotation':[[0,-10,'linear'],[1,176,'linear']],'foot.yaw':[[0,81,'linear'],[.25,85.5,'linear'],[1,99,'linear']],'foot.pitch':[[0,89,'linear'],[1,-81,'linear']]}};
 let previous;for(let i=0;i<=120;i++){const pose=constrainPose(rig.joints,sampleClip(clip,i/120)),m=spatialKinematics(rig,pose).foot.m;if(previous)assert.ok(Math.hypot(...m.map((v,j)=>v-previous[j]))<.03,'physical orientation remains continuous across the Euler branch');previous=m;}
 const before=sampleClip(clip,.5);clip.tracks['foot.pitch'][1][1]=89;const after=sampleClip(clip,.5);assert.equal(after['foot.pitch'],89,'editing the same key array invalidates seam repair');assert.notDeepEqual(after,before);
 clip.tracks['foot.rotation']=[[0,170,'linear'],[1,-170,'linear']];const end=constrainPose(rig.joints,sampleClip(clip,1));assert.equal(end['foot.rotation'],-170,'unwrapped angular samples must not be clamped to the wrong endpoint');
 clip.tracks['foot.pitch'][1][1]=-81;clip.tracks['foot.rotation']=[[0,-10,'step'],[1,176,'linear']];assert.equal(sampleClip(clip,.5)['foot.rotation'],-10,'an intentional rotation cut is never smoothed by a pitch seam');
 clip.tracks['foot.rotation'][0][2]='linear';clip.tracks['foot.yaw'][1][2]='step';assert.equal(sampleClip(clip,.5)['foot.yaw'],85.5,'an overlapping asynchronous yaw cut remains a cut');
});
