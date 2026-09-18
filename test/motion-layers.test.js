import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatch} from '../examples/catch.js';
import {SceneController} from '../src/scene.js';
import {applyMotionLayers} from '../src/motion-layers.js';
import {validateDocument} from '../src/schema.js';
test('additive motion is deterministic, bounded and opt-out for authoring previews',()=>{
 const d=createCatch(),c=new SceneController(d),base=c.frame();d.motionLayers=[{id:'breath',actor:'pip',joint:'root',channel:'y',type:'sine',amplitude:2,frequency:1,phase:0,seed:17}];d.requiredFeatures.push('motion-layers');assert.equal(validateDocument(d).valid,true);base.time=base.effectsTime=.25;const f=applyMotionLayers(d,base);assert.equal(f.actors[0].pose['root.y'],base.actors[0].pose['root.y']+2);assert.deepEqual(applyMotionLayers(d,base),f);assert.equal(applyMotionLayers(d,base,{disabledActors:new Set(['pip'])}).actors[0],base.actors[0]);d.motionLayers[0].frequency=100;assert.equal(validateDocument(d).valid,false);c.dispose();
});
