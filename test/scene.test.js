import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DocumentStore } from '../src/commands.js';
import { validateDocument } from '../src/schema.js';
import { SceneController, STEP } from '../src/scene.js';
import { renderSVG } from '../src/svg.js';
const scene = JSON.parse(fs.readFileSync(new URL('../examples/ona.posecraft.json',import.meta.url)));

test('repeated identical consumer inputs do not exhaust replay storage',()=>{
 const c=new SceneController(scene);for(let i=0;i<25000;i++)c.setInput('ona','greeting',true);
 assert.equal(c.log.length,1);c.setInput('ona','greeting',false);assert.equal(c.log.length,2);
});

test('Ona source artwork remains 31 independent vector paths and exports escaped labels',()=>{
 const c=new SceneController(scene);const svg=renderSVG(scene,c.frame(),{label:'<script>alert(1)</script>'});
 assert.equal((svg.match(/data-part=/g)||[]).length,31);assert.ok(!svg.includes('<script>'));assert.ok(svg.includes('&lt;script&gt;'));
});
test('documents and edits round trip; failed multi-command transaction is atomic and stale writes fail',()=>{
 const s=new DocumentStore(scene); const before=structuredClone(s.document);
 assert.throws(()=>s.transact([{op:'set',path:['name'],value:'Changed'},{op:'set',path:['actors',0,'pack'],value:'missing'}]));assert.deepEqual(s.document,before);
 s.transact([{op:'set',path:['actors',0,'transform','x'],value:125}],0); assert.throws(()=>s.transact([{op:'set',path:['name'],value:'stale'}],0),/Revision conflict/);
 assert.deepEqual(new DocumentStore(JSON.parse(JSON.stringify(s.document))).document,s.document);
 s.undo();assert.equal(s.document.actors[0].transform.x,before.actors[0].transform.x);assert.equal(s.document.revision,2);s.redo();assert.equal(s.document.actors[0].transform.x,125);
});
test('schema rejects version, missing parent, out-of-range keys, malicious paths, and unsupported features',()=>{
 for(const mutate of [d=>d.schemaVersion=2,d=>d.packs.ona.joints[0].parent='head',d=>d.packs.ona.clips.wave.tracks['rightArm.rotation'][0][1]=999,d=>d.packs.ona.parts[0].fill='url(https://evil.example)',d=>d.requiredFeatures=['fluids'],d=>d.packs.ona.parts[0].transform='"><script/>']){const d=structuredClone(scene);mutate(d);assert.equal(validateDocument(d).valid,false);}
 const d=structuredClone(scene);d.callback=()=>{};assert.equal(validateDocument(d).valid,false);
 assert.throws(()=>new DocumentStore(scene).transact([{op:'set',path:['__proto__','polluted'],value:true}])); assert.equal({}.polluted,undefined);
});
test('two character instances have independent state and leave their pack unchanged',()=>{
 const d=structuredClone(scene);d.actors.push({...structuredClone(d.actors[0]),id:'guest',name:'Guest'});const c=new SceneController(d);c.setInput('ona','greeting',true);c.step(.1);
 assert.equal(c.frame().actors[0].state,'wave');assert.equal(c.frame().actors[1].state,'idle');assert.deepEqual(d.packs,scene.packs);
});
test('input transitions blend while acceleration adds bounded motion, braking settles',()=>{
 const c=new SceneController(scene);c.setInput('ona','greeting',true);c.setAcceleration(3000,-1500);for(let i=0;i<60;i++)c.step(STEP);
 assert.equal(c.frame().actors[0].state,'wave');assert.ok(c.frame().actors[0].spring.x<-.1);assert.ok(c.frame().actors[0].spring.y>.1);
 c.setAcceleration(0,0);for(let i=0;i<1200;i++)c.step(STEP);
 assert.ok(Math.abs(c.frame().actors[0].spring.x)<1e-6);assert.ok(Object.values(c.frame().actors[0].pose).every(Number.isFinite));
});
test('translation measurement has no constant-velocity force and rejects teleport spikes',()=>{
 const c=new SceneController(scene);for(let i=0;i<60;i++){c.sampleHost({x:i*2,y:0,time:i/60});c.step(1/60);}assert.ok(Math.abs(c.motion.ax)<1e-7);
 c.sampleHost({x:1000,y:0,time:1,teleport:true});assert.deepEqual(c.motion,{ax:0,ay:0});
});
test('fixed steps agree across rendering cadence; replay seeking preserves physical state without emitting events',()=>{
 const run=dt=>{const c=new SceneController(scene);c.setInput('ona','greeting',true);c.setAcceleration(1500,600);for(let i=0;i<Math.round(1/dt);i++)c.step(dt);c.setAcceleration(0,0);for(let i=0;i<Math.round(1/dt);i++)c.step(dt);return c;};
 const a=run(1/60),b=run(1/30);assert.deepEqual(a.frame(),b.frame());const before=a.frame();let events=0;a.subscribe(()=>events++);a.seek(2);assert.deepEqual(a.frame(),before);assert.equal(events,0);
});
test('reduced motion retains state changes and disables decorative spring motion',()=>{
 const c=new SceneController(scene,{reducedMotion:true});c.setInput('ona','greeting',true);c.setAcceleration(6000,6000);c.step(.1);assert.equal(c.frame().actors[0].state,'wave');assert.equal(c.frame().actors[0].spring.x,0);
});
