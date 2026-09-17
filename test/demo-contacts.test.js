import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {createLoveseat} from '../examples/loveseat.js';
import {SceneController} from '../src/scene.js';
import {assertDocument} from '../src/schema.js';
test('Atlas grip windows repeat across the full workout and release between stations',()=>{
 const d=assertDocument(createGym()),c=new SceneController(d);
 assert.equal(d.contacts.filter(c=>c.period===60).length,4);assert.equal(d.contacts.filter(c=>c.clip==='bench-failed').length,2);
 for(const [time,count,kind]of [[7,2,'pullup'],[27,0,null],[42,2,'bench'],[67,2,'pullup'],[102,2,'bench'],[127,2,'pullup'],[162,2,'bench']]){
  c.previewClip('atlas','workout',time);const active=c.frame().contacts.filter(v=>v.active);assert.equal(active.length,count);
  for(const contact of active){assert.ok(contact.id.endsWith(kind));assert.ok(contact.error<.2,`${contact.id} gap ${contact.error} at ${time}`);}
 }
 // Editing the shared station target changes the solved grip, not the authored keys.
 const before=JSON.stringify(d.packs.atlas.clips),changed=structuredClone(d);changed.contacts.find(v=>v.id==='left-pullup').target.offsetX+=5;
 const edited=new SceneController(changed);edited.previewClip('atlas','workout',7);assert.ok(edited.frame().contacts.find(v=>v.id==='left-pullup').error<.2);assert.equal(JSON.stringify(changed.packs.atlas.clips),before);edited.dispose();c.dispose();
});
test('Loveseat contact windows release the resting hand and retain three supporting grips',()=>{
 const d=assertDocument(createLoveseat()),c=new SceneController(d);assert.ok(d.contacts.length<=16);
 for(const [clip,t,count]of [['carry',1,4],['carry',4.9,3],['carry',8,4],['carry',10.9,3],['rest-left',3,3],['rest-right',3,3]]){
  for(const a of d.actors)c.previewClip(a.id,clip,t);const active=c.frame().contacts.filter(v=>v.active);assert.equal(active.length,count,`${clip} at ${t}`);for(const v of active)assert.ok(v.error<.2,`${v.id}: ${v.error}`);
 }
 c.dispose();
});
