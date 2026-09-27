import test from 'node:test';
import assert from 'node:assert/strict';
import {createWwwzardHomeScene} from '../examples/wwwzard-home.js';
import {createWwwzardContactScene} from '../examples/wwwzard-contact.js';
import {createWwwzardStoriesScene} from '../examples/wwwzard-stories.js';
import {createWwwzardProjectsScene} from '../examples/wwwzard-projects.js';
import {IllustrationController,assertDocument} from '@posecraft/runtime';
import {illustrationFeatures} from '@posecraft/runtime/features';
import {sampleMaterialLighting} from '../src/material-lighting.js';

test('every portfolio scene saves an independent night input and preserves its action',()=>{
 for(const factory of [createWwwzardHomeScene,createWwwzardContactScene,createWwwzardStoriesScene,createWwwzardProjectsScene]){
  const scene=assertDocument(JSON.parse(JSON.stringify(factory()))),c=new IllustrationController(scene,illustrationFeatures);
  const source=scene.materialLighting.weight.actor,state=c.frame().behavior.state;
  assert.equal(sampleMaterialLighting(scene,c.frame()),null);
  c.setInput(source,'night',1);
  assert.equal(sampleMaterialLighting(scene,c.frame()).weight,1);
  assert.equal(c.frame().behavior.state,state,'changing theme must not restart an action');
  c.setInput(source,'night',0);assert.equal(sampleMaterialLighting(scene,c.frame()),null);c.dispose();
 }
});

test('screen light responds to typing and scrolling and shuts off at the closed lid',()=>{
 const scene=createWwwzardHomeScene(),c=new IllustrationController(scene,illustrationFeatures);c.setInput('sky','night',1);
 const gain=()=>sampleMaterialLighting(scene,c.frame()).lights[1].intensity;
 c.previewClip('wwzard','rest',0);c.previewClip('screen','still',0);const resting=gain();
 c.previewClip('wwzard','work',0);assert(gain()>resting);
 c.previewClip('wwzard','doomscroll',.7);const bright=gain();c.previewClip('wwzard','doomscroll',1.2);assert(gain()<bright);
 c.previewClip('screen','laptop',3);assert.equal(gain(),0,'closed lid occludes light independently of the character action');
 c.dispose();
});

test('prepared one-handed typing also changes the screen illumination',()=>{
 const scene=createWwwzardContactScene(),c=new IllustrationController(scene,illustrationFeatures);c.setInput('sky','night',1);
 c.dispatch('almost-done');for(let i=0;i<100;i++)c.step(1/60);
 const gain=()=>sampleMaterialLighting(scene,c.frame()).lights[1].intensity;
 const before=gain();c.dispatch('typing');assert(gain()>before);
 c.dispatch('ready');assert(Math.abs(gain()-before)<.001);c.dispose();
});
