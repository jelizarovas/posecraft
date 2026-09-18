import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {validateDocument} from '../src/schema.js';
import {DocumentStore} from '../src/commands.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
function fixture(){const d=createDrawing();d.packs.drawing.clips.idle={duration:2,loop:true,tracks:{'root.rotation':[[0,0],[2,30]]},events:[{time:.25,name:'hand:reach'},{time:.25,name:'prop:touch'},{time:1.5,name:'hand:release'}]};return d;}
test('clip markers accept simultaneous distinct labels and reject malformed persisted events',()=>{
 const d=fixture();assert.equal(validateDocument(d).valid,true);
 for(const events of [null,{},[{time:NaN,name:'x'}],[{time:3,name:'x'}],[{time:0,name:''}],[{time:0,name:' x'}],[{time:0,name:'x\n'}],[{time:0,name:'x'.repeat(81)}],[{time:1,name:'x'},{time:.5,name:'y'}],[{time:.5,name:'x'},{time:.5,name:'x'}],Array.from({length:129},(_,i)=>({time:i/100,name:'x'}))]){const changed=structuredClone(d);changed.packs.drawing.clips.idle.events=events;assert.equal(validateDocument(changed).valid,false,JSON.stringify(events));}
});
test('invalid marker transaction preserves history and current document',()=>{
 const store=new DocumentStore(fixture()),before=structuredClone(store.document);assert.throws(()=>store.transact([{op:'set',path:['packs','drawing','clips','idle','events'],value:[{time:-1,name:'reach'}]}]));assert.deepEqual(store.document,before);assert.equal(store.past.length,0);
});
test('saved clip markers agree in full and lightweight replay, and preview emits none',()=>{
 const d=fixture(),full=new SceneController(d),lite=new IllustrationController(d),read=c=>{const events=[];c.subscribe(e=>{if(e.type==='marker')events.push({name:e.name,cycle:e.cycle});});c.previewClip(d.actors[0].id,'idle',1);c.frame();assert.equal(events.length,0);c.clearPreview(d.actors[0].id);for(let i=0;i<300;i++)c.step(1/120);return events;};
 try{const a=read(full),b=read(lite);assert.deepEqual(a,b);assert.deepEqual(a.map(e=>e.name),['hand:reach','prop:touch','hand:release','hand:reach','prop:touch']);}finally{full.dispose();lite.dispose();}
});
