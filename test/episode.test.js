import test from 'node:test';
import assert from 'node:assert/strict';
import {episodeExample} from '../examples/episode.js';
import {assertEpisode,EpisodeController,episodeDuration,motionValue} from '../src/episode.js';
import {renderSVG} from '../src/svg.js';

test('episode cuts reuse scenes and support absolute out-of-order frame sampling',()=>{
 const c=new EpisodeController(episodeExample);assert.equal(episodeDuration(c.project),10);assert.equal(c.frame(2.999).shot,'wide');assert.equal(c.frame(3).shot,'hello');assert.equal(c.frame(6).scene,'workshop');assert.equal(c.frame(10).localTime,4);
 const frame=c.frame(4.5);c.frame(9);c.frame(0);assert.deepEqual(c.frame(4.5),frame);assert.ok(frame.camera.zoom>1.3&&frame.camera.zoom<1.7);assert.throws(()=>c.frame(11));
});
test('camera frames wrap the scene while actor placements remain independent',()=>{
 const d=structuredClone(episodeExample);d.shots[0].actors.ona.placement={x:[[0,100,'linear'],[3,300]]};const c=new EpisodeController(d),f=c.frame(1.5);assert.equal(f.actors[0].placement.x,200);
 const svg=renderSVG(d.scenes.courtyard,f);assert.match(svg,/viewBox="0 0 1280 720"/);assert.match(svg,/data-camera/);assert.match(svg,/translate\(200 /);assert.equal(d.scenes.courtyard.actors[0].transform.x,230);
});
test('seeded layers are bounded and repeatable, and baking reproduces each frame',()=>{
 const m={kind:'noise',joint:'head',channel:'rotation',amplitude:7,frequency:1.5,seed:42};const values=Array.from({length:200},(_,i)=>motionValue(m,i/24));assert.ok(values.every(v=>Math.abs(v)<=7));assert.deepEqual(values,values.map((_,i)=>motionValue(m,i/24)));assert.notDeepEqual(values,values.map((_,i)=>motionValue({...m,seed:43},i/24)));
 const d=structuredClone(episodeExample),original=new EpisodeController(d),keys=original.bakeMotion('inside','dummy');d.shots[2].actors.dummy.pose={'root.rotation':keys};delete d.shots[2].actors.dummy.motion;const baked=new EpisodeController(d);
 for(let i=0;i<=96;i++)assert.ok(Math.abs(original.frame(6+i/24).actors[1].pose['root.rotation']-baked.frame(6+i/24).actors[1].pose['root.rotation'])<1e-8);
});
test('episode import validates camera, scene references, cues, poses and resource limits',()=>{
 const extra=structuredClone(episodeExample);extra.shots[0].camera.width=[[0,'invalid']];assert.throws(()=>assertEpisode(extra),/camera channel/);
 for(const change of [d=>d.shots[0].camera.zoom=[[0,0]],d=>d.shots[0].scene='missing',d=>d.shots[0].actors.ona.clip='missing',d=>d.shots[0].actors.ona.pose={'head.rotation':[[0,999]]},d=>d.shots[0].duration=-1,d=>d.shots[1].actors.ona.motion.seed=NaN,d=>d.shots[1].id=d.shots[0].id,d=>delete d.id]){const d=structuredClone(episodeExample);change(d);assert.throws(()=>assertEpisode(d));}
 assert.deepEqual(assertEpisode(JSON.parse(JSON.stringify(episodeExample))),episodeExample);
});
