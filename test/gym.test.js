import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymModes,gymPhase,gymPose,gymTiming,gymWalk} from '../examples/gym.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip,forwardKinematics} from '../src/index.js';
import {spatialKinematics,spatialParts} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {renderSVG} from '../src/svg.js';
const sample=(d,time,mode='workout')=>sampleClip(d.packs.atlas.clips[mode],time);
const world=(d,time,mode='workout')=>spatialKinematics(d.packs.atlas,sample(d,time,mode));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('gym is portable editable scene data with cached independent copies and bounded tracks',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(createGym())));assert.deepEqual(Object.keys(d.packs.atlas.clips),gymModes);assert.equal(d.packs.atlas.clips.workout.duration,180);assert.ok(d.groups.some(g=>g.id==='athlete'));assert.ok(d.packs.atlas.parts.some(p=>p.spatial?.softLimb));
 for(const c of Object.values(d.packs.atlas.clips))for(const keys of Object.values(c.tracks)){assert.ok(keys.length<=1000);assert.ok(keys.every(k=>k.every(v=>typeof v==='string'||Number.isFinite(v))));}
 d.packs.atlas.parts[0].fill='#000000';assert.notEqual(createGym().packs.atlas.parts[0].fill,'#000000');assert.equal(d.actors.find(a=>a.id==='atlas').inputs.action,'workout');
});
test('automatic workout contains eight full pull-ups then failed six and seven sets',()=>{
 const d=createGym();for(const [mode,rounds]of [['workout',[8,6,7]],['full-set',[8]],['fail-six',[6]],['fail-seven',[7]]])for(let cycle=0;cycle<rounds.length;cycle++){
  let count=0,previous=Infinity;for(let i=0;i<=720;i++){const t=cycle*60+6+i/40,y=sample(d,t,mode)['root.y'];if(previous>=245&&y<245)count++;previous=y;}assert.equal(count,rounds[cycle],`${mode} round${cycle}`);assert.equal(gymPhase(cycle*60+24,mode).completed,rounds[cycle]);assert.equal(gymPhase(cycle*60+24.1,mode).failed,rounds[cycle]<8);
 }
 const failure=sample(d,21,'fail-six');assert.ok(failure['effort-lines.opacity']>.2);assert.ok(failure['sweat.opacity']>.5);assert.equal(gymPhase(47.99).benchReps,2);assert.equal(gymPhase(48).benchReps,3);
});
test('both pull-up grips stay on the stationary bar between keys including failure shakes',()=>{
 const d=createGym();let max=0;for(const mode of ['full-set','fail-six','fail-seven'])for(let i=0;i<550;i++){const t=6+i*18/550,w=world(d,t,mode);for(const [name,side]of [['left',-1],['right',1]])max=Math.max(max,distance(w[name+'Hand'],{x:180+43*side,y:150}));}assert.ok(max<3.2,`maximum grip error ${max}px`);
});
test('barbell stays in its rack while athlete walks and hands track all three bench reps',()=>{
 const d=createGym();for(const t of [0,3,26.5,32,36,40,48,53,59]){const w=world(d,t);assert.ok(distance(w.barbell,{x:585,y:270})<.6,`rack drift at${t}`);}
 let max=0,reps=0,wasLow=false;for(let i=0;i<=700;i++){const t=41+i/100,w=world(d,t);for(const [name,side]of [['left',-1],['right',1]])max=Math.max(max,distance(w[name+'Hand'],{x:w.barbell.x+side*40,y:w.barbell.y}));const low=w.barbell.y>298;if(low&&!wasLow)reps++;wasLow=low;}assert.equal(reps,3);assert.ok(max<3.2,`bench hand error ${max}px`);
});
test('walk, dismount, lying and loop boundaries remain continuous and finite',()=>{
 const d=createGym();for(const mode of gymModes){const duration=d.packs.atlas.clips[mode].duration;let previous=world(d,0,mode);for(let i=1;i<=duration*60;i++){const t=i/60,next=world(d,t,mode);for(const point of Object.values(next))assert.ok(Number.isFinite(point.x)&&Number.isFinite(point.y));for(const name of ['root','head','leftHand','rightHand','leftFoot','rightFoot'])assert.ok(distance(next[name],previous[name])<18,`${mode} ${name} jumps at${t}: ${distance(next[name],previous[name])}`);previous=next;}}
 const afterWalk=world(d,36),back=world(d,59);assert.ok(afterWalk.root.x>600);assert.equal(back.root.x,180);assert.equal(gymTiming.benchStart,41);
});
test('serialized standard clips render muscular anatomy and station props without a custom runtime',()=>{
 const d=createGym(),c=new SceneController(d);c.previewClip('atlas','full-set',42,{});const f=c.frame(),a=f.actors.find(a=>a.id==='atlas'),w=forwardKinematics(d.packs.atlas.joints,a.pose),svg=renderSVG(d,f);assert.ok(Number.isFinite(w.leftHand.x));assert.match(svg,/data-part="left-pec"/);assert.match(svg,/data-part="barbell-shaft"/);assert.match(svg,/data-part="pullup-frame"/);assert.match(svg,/data-part="sweat-drop"/);c.dispose();
});


test('resting stance has soft straight knees and planted feet below hips',()=>{
 const d=createGym();for(const t of [0,59,59.5]){const w=world(d,t),p=sample(d,t);for(const name of ['left','right']){assert.ok(Math.abs(p[name+'Calf.rotation'])<20);assert.ok(Math.abs(w[name+'Foot'].x-w[name+'Thigh'].x)<3);assert.ok(Math.abs(w[name+'Foot'].y-383)<.01);}}
 const bench=world(d,42);assert.ok(Math.abs(bench.leftFoot.x-bench.rightFoot.x)<37);assert.ok(Math.abs(bench.leftFoot.y-383)<.6);assert.ok(Math.abs(bench.rightFoot.y-383)<.6);
 const knee=Array.from({length:50},(_,i)=>sample(d,30+i/50)['leftCalf.rotation']);assert.ok(Math.max(...knee)-Math.min(...knee)>20,'walking has a distinct knee swing');
});


test('world foot anchors stay planted during support and phases leave time to prepare and recover',()=>{
 const d=createGym();for(const [start,end,from,to]of [[29,36,180,710],[52.5,59,710,180]])for(let t=start+.02;t<end-.02;t+=.03){const a=gymWalk(t,start,end,from,to),b=gymWalk(t+.01,start,end,from,to),w=world(d,t);for(const name of ['left','right'])if(a.feet[name].planted&&b.feet[name].planted){assert.ok(Math.abs(a.feet[name].x-b.feet[name].x)<.001);assert.ok(distance(w[name+'Foot'],a.feet[name])<2.5,`support foot ${name} misses target at${t}`);}}
 assert.equal(gymPhase(2).phaseKey,'preparation');assert.equal(gymPhase(27,'fail-six').phaseKey,'recover');assert.equal(gymPhase(37).phaseKey,'sit');assert.equal(gymPhase(39).phaseKey,'recline');assert.equal(gymPhase(21,'fail-six').phaseKey,'failed-attempt');assert.ok(new Set(gymTiming.repDurations).size>5);
});


test('pull-up head passes behind the rail while wrapping hands stay in front',()=>{
 const d=createGym(),pack=d.packs.atlas,pose=sample(d,7),order=spatialParts(pack,{pose,world:forwardKinematics(pack.joints,pose)}).order,rail=order.indexOf('pullup-front-bar');assert.ok(rail>order.indexOf('head-shape'));assert.ok(rail>order.indexOf('eyes'));assert.ok(order.indexOf('leftgrip')>rail);assert.ok(order.indexOf('rightgrip')>rail);for(const t of [30.7,54.3]){const pose=sample(d,t),turned=spatialParts(pack,{pose,world:forwardKinematics(pack.joints,pose)}).order;assert.ok(turned.indexOf('eyes')>turned.indexOf('head-shape'),'face remains visible when turned');}
});

test('sit, recline and rise keep the bench feet planted and failure has anticipatory hesitation',()=>{
 const d=createGym();let drift=0;for(let t=36;t<52.5;t+=.04){const w=world(d,t);drift=Math.max(drift,distance(w.leftFoot,{x:692,y:383}),distance(w.rightFoot,{x:728,y:383}));}assert.ok(drift<2.5,`bench foot drift ${drift}`);
 assert.notEqual(gymPose(2,'full-set')['leftUpper.rotation'],gymPose(2,'fail-six')['leftUpper.rotation']);assert.ok(Math.abs(gymPose(27,'fail-six')['torso.rotation'])>Math.abs(gymPose(27,'full-set')['torso.rotation']));
});
