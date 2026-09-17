import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assertDocument,validateDocument} from '../src/schema.js';
import {SceneController,STEP} from '../src/scene.js';
import {renderSVG} from '../src/svg.js';
const library=Object.fromEntries(['ona','wwwzard','rusty','dummy'].map(id=>[id,JSON.parse(fs.readFileSync(new URL(`../examples/characters/${id}.json`,import.meta.url)))]));

test('all library actions and emotions stay finite and inside joint limits',()=>{
 for(const [id,d] of Object.entries(library)){
  assertDocument(d);const pack=d.packs[id],c=new SceneController(d);
  for(const action of Object.keys(pack.clips))for(const emotion of pack.inputs.emotion.options){
   c.setInput(id,'action',action);c.setInput(id,'emotion',emotion);c.setAcceleration(6000,-6000);
   for(let i=0;i<20;i++)c.step(1/30);
   const a=c.frame().actors[0];assert.equal(a.state,action);
   for(const j of pack.joints){const r=a.pose[j.id+'.rotation'];assert.ok(r>=j.min&&r<=j.max,`${id}/${action}/${emotion}/${j.id}`);}
   assert.ok(Object.values(a.pose).every(Number.isFinite));assert.ok(!renderSVG(d,c.frame()).includes('NaN'));
  }
 }
});
test('actor inputs and appearance survive serialization and remain independent',()=>{
 const d=structuredClone(library.ona);d.actors[0].inputs={action:'dance',emotion:'happy',hair:'bob'};d.actors[0].appearance={eyes:'#4488cc'};
 d.actors.push({...structuredClone(d.actors[0]),id:'guest',inputs:{action:'sleep',emotion:'sad',hair:'none'},appearance:{eyes:'#885522'}});
 const copy=assertDocument(JSON.parse(JSON.stringify(d))),c=new SceneController(copy);c.step(.1);
 assert.deepEqual(c.frame().actors.map(a=>a.state),['dance','sleep']);assert.deepEqual(c.frame().actors.map(a=>a.inputs.hair),['bob','none']);
 const svg=renderSVG(copy,c.frame());assert.ok(svg.includes('fill="#4488cc"'));assert.ok(svg.includes('fill="#885522"'));
 const before=svg;c.setInput('ona','hair','ponytail');assert.notEqual(renderSVG(copy,c.frame()),before);assert.equal(c.frame().actors[1].inputs.hair,'none');
});
test('paused authored preview keeps its pose while container reaction starts, brakes, and settles',()=>{
 const c=new SceneController(library.ona);c.previewClip('ona','wave',.45,{'head.rotation':12});
 c.setAcceleration(1800,0);for(let i=0;i<20;i++)c.step(STEP);const start=c.frame().actors[0];assert.ok(start.spring.x<-2);assert.equal(start.pose['head.rotation'],12);
 c.setAcceleration(-1800,0);for(let i=0;i<40;i++)c.step(STEP);assert.ok(c.frame().actors[0].spring.x>2);assert.equal(c.frame().actors[0].pose['head.rotation'],12);
 c.setAcceleration(0,0);for(let i=0;i<720;i++)c.step(STEP);assert.ok(Math.abs(c.frame().actors[0].spring.x)<.001);
 c.previewClip('ona','wave',.45,{'head.rotation':999});assert.equal(c.frame().actors[0].pose['head.rotation'],25);
 c.clearPreview('ona');assert.equal(c.frame().actors[0].state,'idle');assert.throws(()=>c.previewClip('ona','missing',0));assert.throws(()=>c.previewClip('ona','wave',0,{'missing.rotation':2}));
});
test('variant geometry and persisted inputs reject unsafe or unknown values',()=>{
 for(const mutate of [d=>d.actors[0].inputs={hair:'unknown'},d=>d.packs.ona.parts.find(p=>p.variants).variants.happy={d:'<script/>'},d=>d.packs.ona.parts.find(p=>p.variants).variants.happy={transform:'url(https://example.com)'},d=>d.packs.ona.expressions.happy={'missing.rotation':10}]){const d=structuredClone(library.ona);mutate(d);assert.equal(validateDocument(d).valid,false);}
});

test('asynchronous mouse samples preserve visible onset and braking',()=>{
 const c=new SceneController(library.ona);let time=0,x=0;const samples=[];
 const sample=()=>{c.sampleHost({x,y:0,time});c.step(1/60);time+=1/60;samples.push(c.frame().actors[0].spring.x);};
 for(let i=0;i<20;i++)sample();
 // Mouse updates only every second display frame; empty frames used to cancel the impulse.
 for(let i=0;i<24;i++){if(i%2===0)x+=10;sample();}
 const onset=Math.min(...samples);samples.length=0;for(let i=0;i<60;i++)sample();
 assert.ok(onset<-5,`start lean ${onset}`);assert.ok(Math.max(...samples)>2,'braking reverses the lean');
 for(let i=0;i<300;i++)sample();assert.ok(Math.abs(c.frame().actors[0].spring.x)<.001);
});
