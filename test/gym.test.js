import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymModes,gymPhase,gymPose,gymTiming} from '../examples/gym.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip,forwardKinematics} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {renderSVG} from '../src/svg.js';
const sample=(d,time,mode='workout')=>sampleClip(d.packs.atlas.clips[mode],time);
const world=(d,time,mode='workout')=>spatialKinematics(d.packs.atlas,sample(d,time,mode));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('gym is portable editable scene data with cached independent copies and bounded tracks',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(createGym())));assert.deepEqual(Object.keys(d.packs.atlas.clips),gymModes);assert.equal(d.packs.atlas.clips.workout.duration,60);assert.ok(d.groups.some(g=>g.id==='athlete'));assert.ok(d.packs.atlas.parts.some(p=>p.spatial?.softLimb));
 for(const c of Object.values(d.packs.atlas.clips))for(const keys of Object.values(c.tracks)){assert.ok(keys.length<=1000);assert.ok(keys.every(k=>k.every(v=>typeof v==='string'||Number.isFinite(v))));}
 d.packs.atlas.parts[0].fill='#000000';assert.notEqual(createGym().packs.atlas.parts[0].fill,'#000000');assert.equal(d.actors.find(a=>a.id==='atlas').inputs.action,'workout');
});
test('automatic workout contains eight full pull-ups then failed six and seven sets',()=>{
 const d=createGym();for(const [mode,rounds]of [['workout',[8,6,7]],['full-set',[8]],['fail-six',[6]],['fail-seven',[7]]])for(let cycle=0;cycle<rounds.length;cycle++){
  let count=0,previous=Infinity;for(let i=0;i<=720;i++){const t=cycle*20+1.2+i/100,y=sample(d,t,mode)['root.y'];if(previous>=245&&y<245)count++;previous=y;}assert.equal(count,rounds[cycle],`${mode} round${cycle}`);assert.equal(gymPhase(cycle*20+8.4,mode).completed,rounds[cycle]);assert.equal(gymPhase(cycle*20+8.5,mode).failed,rounds[cycle]<8);
 }
 const failure=sample(d,7.1,'fail-six');assert.ok(failure['effort-lines.opacity']>.2);assert.ok(failure['sweat.opacity']>.5);assert.equal(gymPhase(14.99).benchReps,2);assert.equal(gymPhase(15).benchReps,3);
});
test('both pull-up grips stay on the stationary bar between keys including failure shakes',()=>{
 const d=createGym();let max=0;for(const mode of ['full-set','fail-six','fail-seven'])for(let i=0;i<550;i++){const t=1.2+i*7.2/550,w=world(d,t,mode);for(const [name,side]of [['left',-1],['right',1]])max=Math.max(max,distance(w[name+'Hand'],{x:180+43*side,y:150}));}assert.ok(max<1.4,`maximum grip error ${max}px`);
});
test('barbell stays in its rack while athlete walks and hands track all three bench reps',()=>{
 const d=createGym();for(const t of [0,3,8.9,9.8,10.65,11.5,15,16.8,19]){const w=world(d,t);assert.ok(distance(w.barbell,{x:585,y:245})<.001,`rack drift at${t}`);}
 let max=0,reps=0,wasLow=false;for(let i=0;i<=300;i++){const t=12+i/100,w=world(d,t);for(const [name,side]of [['left',-1],['right',1]])max=Math.max(max,distance(w[name+'Hand'],{x:w.barbell.x+side*40,y:w.barbell.y}));const low=w.barbell.y>277;if(low&&!wasLow)reps++;wasLow=low;}assert.equal(reps,3);assert.ok(max<1.4,`bench hand error ${max}px`);
});
test('walk, dismount, lying and loop boundaries remain continuous and finite',()=>{
 const d=createGym();for(const mode of gymModes){const duration=d.packs.atlas.clips[mode].duration;let previous=world(d,0,mode);for(let i=1;i<=duration*60;i++){const t=i/60,next=world(d,t,mode);for(const point of Object.values(next))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));for(const name of ['root','head','leftHand','rightHand','leftFoot','rightFoot'])assert.ok(distance(next[name],previous[name])<18,`${mode} ${name} jumps at${t}: ${distance(next[name],previous[name])}`);previous=next;}}
 const afterWalk=world(d,10.65),back=world(d,18.4);assert.ok(afterWalk.root.x>600);assert.equal(back.root.x,180);assert.equal(gymTiming.benchStart,12);
});
test('serialized standard clips render muscular anatomy and station props without a custom runtime',()=>{
 const d=createGym(),c=new SceneController(d);c.previewClip('atlas','full-set',12.5,{});const f=c.frame(),a=f.actors.find(a=>a.id==='atlas'),w=forwardKinematics(d.packs.atlas.joints,a.pose),svg=renderSVG(d,f);assert.ok(Number.isFinite(w.leftHand.x));assert.match(svg,/data-part="left-pec"/);assert.match(svg,/data-part="barbell-shaft"/);assert.match(svg,/data-part="pullup-frame"/);assert.match(svg,/data-part="sweat-drop"/);c.dispose();
});


test('resting stance has soft straight knees and planted feet below hips',()=>{
 const d=createGym();for(const t of [0,18.4,19.5]){const w=world(d,t),p=sample(d,t);for(const name of ['left','right']){assert.ok(Math.abs(p[name+'Calf.rotation'])<20);assert.ok(Math.abs(w[name+'Foot'].x-w[name+'Thigh'].x)<3);assert.ok(Math.abs(w[name+'Foot'].y-383)<.01);}}
 const bench=world(d,12.5);assert.ok(Math.abs(bench.leftFoot.x-bench.rightFoot.x)<45);assert.ok(Math.abs(bench.leftFoot.y-383)<.01);assert.ok(Math.abs(bench.rightFoot.y-383)<.01);
 const a=sample(d,9.2),b=sample(d,9.45);assert.ok(Math.abs(a['leftCalf.rotation']-b['leftCalf.rotation'])>10,'walking has a distinct knee swing');
});
