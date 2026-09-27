import test from 'node:test';
import assert from 'node:assert/strict';
import {assertDocument} from '../src/schema.js';
import {createWwwzardHomeScene} from '../examples/wwwzard-home.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';

test('window toggles repeat without advancing the animation clock',()=>{
 const scene=createWwwzardHomeScene(),binding=scene.interactions.find(b=>b.event==='window-theme-toggle'),events=[];
 assert.equal(binding.cooldown,0);
 const pointer=new ScenePointerInteraction(scene,{dispatch:event=>events.push(event)});
 const click={binding:binding.id,phase:'click',x:350,y:80};
 pointer.input(click);pointer.input(click);assert.equal(events.length,2);
 delete binding.cooldown;pointer.reset();events.length=0;
 pointer.input(click);pointer.input(click);assert.equal(events.length,1);
 pointer.step(.81);pointer.input(click);assert.equal(events.length,2);
 for(const cooldown of [-1,11,NaN]){binding.cooldown=cooldown;assert.throws(()=>assertDocument(scene));}
});
test('proximity and direction survive a portable scene roundtrip',()=>{
 const scene=createWwwzardHomeScene();assertDocument(scene);
 const restored=assertDocument(JSON.parse(JSON.stringify(scene)));
 assert.deepEqual(restored.interactions,scene.interactions);
 for(const direction of ['left','right'])assert(restored.interactions.some(b=>b.direction===direction&&b.radius===95&&b.joint==='plantCenter'));
});
test('invalid proximity contracts are rejected',()=>{
 for(const patch of [{radius:-1},{radius:1001},{radius:95,joint:undefined},{direction:'up'},{gesture:'click',radius:95}]){
  const scene=createWwwzardHomeScene();Object.assign(scene.interactions.find(b=>b.direction==='left'),patch);assert.throws(()=>assertDocument(scene));
 }
});
