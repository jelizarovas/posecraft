import test from 'node:test';
import assert from 'node:assert/strict';
import {compileSpritePuppet,sampleSpritePuppet,validateSpritePuppet} from '../src/sprite-puppet.js';
import example from '../examples/characters/porch-zombie.puppet.json' with {type:'json'};

const rig=compileSpritePuppet(example);
const pose=(seconds,part)=>sampleSpritePuppet(rig,seconds).find(p=>p.id===part);
const image=(seconds,part)=>example.atlas.images[pose(seconds,part).tile];
test('direction, expression and hand drawings change independently of the waving arm',()=>{
  assert.equal(image(0,'head'),'profile');
  assert.equal(image(.6,'body'),'torsoQuarter');
  assert.equal(image(1.3,'head'),'blink');
  assert.equal(image(2.6,'rightHand'),'fist');
  assert.equal(image(2.7,'rightHand'),'uncurl');
  assert.equal(image(3,'rightHand'),'four');
  assert.equal(image(4,'head'),'whistle');
  assert.equal(image(4.35,'head'),'blinkWhistle');
  assert.equal(image(4.35,'rightHand'),'four');
  assert.ok(Math.abs(pose(1.85,'leftHand').rotation-pose(2.17,'leftHand').rotation)>20);
  assert.deepEqual(sampleSpritePuppet(rig,0),sampleSpritePuppet(rig,example.clip.duration));
});
test('a second bind pose with one arm segment keeps its authored wrist position and bend at rest',()=>{
  const doc=structuredClone(example);
  doc.clip.tracks={};doc.clip.loop=false;
  const bindings={body:{x:1,y:2,rotation:30,size:1},leftShoulder:{x:-4,y:6,rotation:12,size:.8},
    leftHand:{x:-7,y:11,rotation:50,size:.6}};
  const result=sampleSpritePuppet(compileSpritePuppet(doc,bindings),0);
  for(const p of result)for(const field of ['x','y','rotation','size'])assert.ok(Math.abs(p[field]-bindings[p.id][field])<1e-9);
});
test('a malformed drawing key fails before replacing an open puppet',()=>{
  const doc=structuredClone(example);doc.clip.tracks.grip[0][1]=99;
  assert.throws(()=>validateSpritePuppet(doc),/grip/);
});
