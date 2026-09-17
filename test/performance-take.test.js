import test from 'node:test';
import assert from 'node:assert/strict';
import {performanceFeatures,PerformanceRetargeter,assertTake,sampleTake,applyTake} from '../src/performance.js';
import {EpisodeController,assertEpisode} from '../src/episode.js';
import {episodeExample} from '../examples/episode.js';
const pack=episodeExample.scenes.courtyard.packs.ona;
const features=(roll=0,expression='neutral',hands={})=>({face:true,roll,expression,hands});
const makeTake=()=>({kind:'performance-take',schemaVersion:1,duration:1,frames:[{time:0,pose:{'head.rotation':0},emotion:'neutral'},{time:.5,pose:{'head.rotation':20},emotion:'happy'},{time:1,pose:{'head.rotation':-20},emotion:'surprised'}]});
test('calibration respects rest angles, smooths movement, clamps limits and releases lost tracking',()=>{
 for(const p of [pack,episodeExample.scenes.courtyard.packs.dummy]){const r=new PerformanceRetargeter(p),head=p.joints.find(j=>j.id==='head');assert.throws(()=>r.sample(features(),0),/Calibrate/);assert.throws(()=>r.calibrate({face:false}),/visible/);r.calibrate(features(5));assert.equal(r.sample(features(5),0).pose['head.rotation'],head.rotation);const moved=r.sample(features(85),.1);assert.ok(moved.pose['head.rotation']>head.rotation&&moved.pose['head.rotation']<=head.max);const lost=r.sample({face:false,hands:{}},1);assert.ok(lost.pose['head.rotation']<moved.pose['head.rotation']);assert.equal(lost.emotion,'neutral');}
});
test('visual expressions and unmirrored hand labels map to rig channels',()=>{
 const p=Array.from({length:478},()=>({x:.5,y:.5}));p[33]={x:.3,y:.4};p[263]={x:.7,y:.5};const f=performanceFeatures({face:p,blendshapes:{jawOpen:.8},hands:[]});assert.equal(f.expression,'surprised');assert.ok(f.roll>0);assert.equal(performanceFeatures({face:p,blendshapes:{eyeBlinkLeft:.8,eyeBlinkRight:.8}}).expression,'sleepy');
 const r=new PerformanceRetargeter(pack);r.calibrate(features());const pose=r.sample(features(0,'happy',{left:{y:.2,roll:0,gesture:'open'}}),0);assert.ok(pose.pose['leftArm.rotation']>pack.joints.find(j=>j.id==='leftArm').rotation);assert.equal(pose.gestures.left,'open');assert.equal(pose.gestures.right,'lost');
});
test('takes interpolate pose while holding expression states and reject invalid imports',()=>{
 const take=makeTake();assertTake(take,pack);assert.equal(sampleTake(take,.25).pose['head.rotation'],10);assert.equal(sampleTake(take,.49).emotion,'neutral');assert.equal(sampleTake(take,.5).emotion,'happy');
 for(const mutate of [t=>t.duration=31,t=>t.frames[1].pose['head.rotation']=100,t=>t.frames[1].time=0,t=>t.frames[0].time=.1,t=>t.frames[1].emotion='unknown',t=>t.frames[1].pose={constructor:1}]){const t=makeTake();mutate(t);assert.throws(()=>assertTake(t,pack));}
});
test('baked take matches every sampled frame and preserves poses outside its interval',()=>{
 const p=structuredClone(episodeExample),original=new EpisodeController(p),take=makeTake();applyTake(p,'wide','ona',take,.5);assertEpisode(p);const c=new EpisodeController(p);
 for(let i=0;i<=24;i++){const t=i/24,a=c.frame(.5+t).actors[0],b=sampleTake(take,t);assert.ok(Math.abs(a.pose['head.rotation']-b.pose['head.rotation'])<1e-8);assert.equal(a.inputs.emotion,b.emotion);}
 for(const t of [0,2])assert.ok(Math.abs(c.frame(t).actors[0].pose['head.rotation']-original.frame(t).actors[0].pose['head.rotation'])<1);
 assert.equal(c.frame(2).actors[0].inputs.emotion,original.frame(2).actors[0].inputs.emotion);
});
test('take bake truncates at shot end, removes conflicting procedural layer and expression keys validate',()=>{
 const p=structuredClone(episodeExample);applyTake(p,'hello','ona',makeTake(),2.5);assertEpisode(p);assert.equal(p.shots[1].actors.ona.motion,undefined);assert.equal(p.shots[1].actors.ona.pose['head.rotation'].at(-1)[0],3);
 const bad=structuredClone(p);bad.shots[1].actors.ona.expressions=[[0,'happy'],[0,'sad']];assert.throws(()=>assertEpisode(bad),/expression keys/);
});
