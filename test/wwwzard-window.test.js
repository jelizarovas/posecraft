import assert from 'node:assert/strict';
import test from 'node:test';
import {gzipSync} from 'node:zlib';
import {createWwwzardHomeScene} from '../examples/wwwzard-home.js';
import {createWwwzardContactScene} from '../examples/wwwzard-contact.js';
import {windowPlacement,windowPoint} from '../examples/wwwzard-window.js';
import {assertDocument,IllustrationController} from '@posecraft/runtime';
import {applyMotionLayers,ActorBehaviorRuntime} from '@posecraft/runtime/features';
const options={motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime};
const advance=(c,time)=>{for(let elapsed=0;elapsed<time-1e-9;elapsed+=1/60)c.step(1/60);};
const actor=(c,id)=>c.frame().actors.find(a=>a.id===id);

test('shared window saves a horizontal clipped view farther behind the desk',()=>{
  const home=createWwwzardHomeScene(),contact=createWwwzardContactScene();
  for(const scene of [home,contact]){
    assertDocument(JSON.parse(JSON.stringify(scene)));
    assert.deepEqual(scene.actors.find(a=>a.id==='sky').transform,windowPlacement);
    assert.equal(scene.packs.sky.parts.find(p=>p.id==='window-horizon').d,'M315 171L420 171L420 240L315 240Z');
    assert.equal(scene.packs.sky.parts.find(p=>p.id==='window-cloud').spatial.mask,'window-sky');
    for(const id of ['window-frame','window-inner'])assert.ok(scene.packs.room.parts.find(p=>p.id===id).d.includes('ZM335 90L335 183L402 220L402 127Z'),'opaque frame must have an aperture');
  }
  assert.deepEqual(home.packs.sky,contact.packs.sky);
  assert.deepEqual(contact.actors.find(a=>a.id==='window').transform,windowPlacement);
  assert.ok(gzipSync(JSON.stringify(home)).length<=30*1024,'Home document transfer budget');
});

test('slow clouds keep their phase while room gusts and window activities run',()=>{
  const c=new IllustrationController(createWwwzardContactScene(),options);
  advance(c,4);const before=actor(c,'sky').pose['clouds.x'];
  c.dispatch('gust-left');advance(c,1);
  const during=actor(c,'sky').pose['clouds.x'];
  assert.ok(during>before+.9&&during<before+1.2,'gust must not restart or freeze the independent sky');
  c.dispatch('almost-done');advance(c,1.5);
  assert.ok(actor(c,'window').pose['windowHinge.bend']>.99);
  assert.ok(actor(c,'sky').pose['clouds.x']>during+1.4);
  c.dispose();
});

test('paper flight reaches the relocated opening and shrinks before crossing the frame',()=>{
  const scene=createWwwzardContactScene(),plane=scene.packs.plane;
  const c=new IllustrationController(scene,options);c.previewClip('plane','throw',.72);
  const pose=actor(c,'plane').pose,root=plane.joints.find(j=>j.id==='root');
  const destination=windowPoint(365,160);
  assert.ok(Math.abs(root.x+pose['root.x']-destination[0])<.001);
  assert.ok(Math.abs(root.y+pose['root.y']-destination[1])<.001);
  assert.ok(pose['root.bend']>=.65,'plane recedes before entering the smaller aperture');
  c.dispose();
});

test('day/night input keeps cloud timing while the sun sets before the crescent rises',()=>{
  const scene=createWwwzardContactScene(),c=new IllustrationController(scene,options);
  const sky=scene.packs.sky;
  const sun=sky.parts.find(p=>p.id==='window-sun'),moon=sky.parts.find(p=>p.id==='window-moon');
  assert.equal(sun.spatial.morph.frames[0].value,.48);
  assert.equal(moon.spatial.morph.frames[0].value,.52);
  assert.equal(moon.spatial.morph.frames[0].target,moon.d,'crescent waits below horizon');
  advance(c,5);const cloud=actor(c,'sky').pose['clouds.x'];
  c.setInput('sky','night',.5);
  let pose=actor(c,'sky').pose;
  assert.equal(pose['night.bend'],.5);assert.equal(pose['night.opacity'],.5);
  assert.equal(pose['stars.opacity'],0);
  assert.equal(pose['clouds.x'],cloud,'theme change cannot restart cloud drift');
  c.setInput('sky','night',1);pose=actor(c,'sky').pose;
  assert.equal(pose['night.bend'],1);assert.equal(pose['stars.opacity'],1);
  c.setInput('sky','night',0);pose=actor(c,'sky').pose;
  assert.equal(pose['night.bend'],0);assert.equal(pose['night.opacity'],0);assert.equal(pose['stars.opacity'],0);
  c.dispose();
});

test('window clicks emit one theme request without changing the hero activity',()=>{
  for(const factory of [createWwwzardHomeScene,createWwwzardContactScene]){
    const c=new IllustrationController(factory(),options),events=[];
    c.subscribe(event=>events.push(event));
    const before=c.frame().behavior.state;
    c.pointer({binding:'window-theme-sky',phase:'click',x:397,y:114});
    advance(c,1/60);
    assert.equal(c.frame().behavior.state,before);
    assert.equal(events.filter(event=>event.type==='theme-toggle').length,1);
    c.dispose();
  }
});
