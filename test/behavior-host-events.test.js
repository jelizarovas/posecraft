import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {IllustrationController} from '../src/illustration.js';
import {SceneController} from '../src/scene.js';

test('explicit graph events reach host once, retain internal routing, and do not replay host effects',()=>{
 const scene=createDrawing();scene.presentation='live';scene.requiredFeatures=['behavior-graphs'];
 scene.behaviorGraph={seed:1,variables:{count:0},initial:'idle',states:{idle:{actions:[]}},edges:[],handlers:[
  {event:'toggle',actions:[{type:'event',event:'theme-toggle',actor:'character'}]},
  {event:'theme-toggle',actions:[{type:'add',variable:'count',value:1}]},
 ]};
 for(const Controller of [IllustrationController,SceneController]){
  const c=new Controller(scene,{behaviorFactory:BehaviorRuntime}),events=[];
  c.subscribe(event=>events.push(event));c.dispatch('toggle');c.step(.05);
  assert.equal(events.filter(event=>event.type==='theme-toggle').length,1);
  assert.equal(events.find(event=>event.type==='theme-toggle').actor,'character');
  assert.equal(c.frame().behavior.variables.count,1);
  c.seek(.05);assert.equal(events.filter(event=>event.type==='theme-toggle').length,1,'seek must not toggle the website theme again');
  c.dispose();
 }
});
