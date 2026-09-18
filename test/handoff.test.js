import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandoff,handoffDuration} from '../examples/handoff.js';
import {validateDocument} from '../src/schema.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {SceneObjects,objectGrip} from '../src/scene-objects.js';
import {applyContacts} from '../src/contacts.js';
import {evaluatedProps} from '../src/scene-attachments.js';
import {inspectSceneFeatures} from '../src/scene-export.js';
const options={behaviorFactory:BehaviorRuntime,objectFactory:SceneObjects,contactSolver:applyContacts};
const near=(a,b,t=.001)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<t,JSON.stringify({a,b,t}));

test('handoff is portable editable data with one gift and independent art',()=>{const doc=createHandoff();assert.equal(validateDocument(doc).valid,true);assert.equal(validateDocument(JSON.parse(JSON.stringify(doc))).valid,true);assert.equal(handoffDuration,10);assert.equal(doc.objects.length,1);assert.equal(doc.props.filter(p=>p.attachment?.object==='gift').length,5);assert.ok(doc.props.filter(p=>p.attachment).every(p=>!p.collider.enabled));assert.equal(doc.packs.ona.clips.give.duration,10);assert.equal(doc.packs.ona.clips.receive.duration,10);const features=inspectSceneFeatures(doc);assert.equal(features.runtime,'illustration');assert.ok(features.features.includes('scene-objects'));});

test('gift reaches each receiving hand before single-owner transfer without a position jump',()=>{const doc=createHandoff(),controller=new SceneController(doc);let previous=controller.frame(),transfers=[];try{for(let i=1;i<=1260;i++){const frame=controller.step(1/120),gift=frame.objects[0],before=previous.objects[0];near(evaluatedProps(doc,frame).find(p=>p.id==='gift-box'),gift);assert.ok(Math.hypot(gift.x-before.x,gift.y-before.y)<1.2,'Gift jumped between frames');if(gift.owner.actor!==before.owner.actor){transfers.push({time:frame.time,to:gift.owner.actor});near(gift,before,.01);near(gift,objectGrip(doc,frame,gift.owner));}assert.ok(frame.actors.every(a=>Object.values(a.pose).every(Number.isFinite)));previous=frame;}assert.equal(transfers.length,2);assert.equal(transfers[0].to,'recipient');assert.equal(transfers[1].to,'giver');assert.ok(Math.abs(transfers[0].time-4)<1e-8);assert.ok(Math.abs(transfers[1].time-8)<1e-8);assert.equal(previous.behavior.variables.exchanges,1);}finally{controller.dispose();}});

test('full and website runtimes agree through both transfers and deterministic seek',()=>{const doc=createHandoff(),full=new SceneController(doc),lite=new IllustrationController(doc,options);try{for(const t of [0,3.2,3.8,4.05,5.6,7.8,8.05,10.2]){const a=full.seek(t),b=lite.seek(t);assert.deepEqual(b.objects,a.objects);assert.deepEqual(b.actors.map(a=>a.pose),a.actors.map(a=>a.pose));assert.deepEqual(evaluatedProps(doc,b),evaluatedProps(doc,a));}const expected=full.seek(4.05);full.seek(9);assert.deepEqual(full.seek(4.05),expected);}finally{full.dispose();lite.dispose();}});

test('moving the recipient out of reach blocks transfer instead of teleporting the gift',()=>{const doc=createHandoff();doc.actors.find(a=>a.id==='recipient').transform.x+=140;const controller=new SceneController(doc);try{const frame=controller.seek(4.1);assert.equal(frame.objects[0].owner.actor,'giver');near(frame.objects[0],objectGrip(doc,frame,{actor:'giver',joint:'rightWrist'}));}finally{controller.dispose();}});
