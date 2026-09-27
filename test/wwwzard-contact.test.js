import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { createWwwzardContactScene } from '../examples/wwwzard-contact.js';
import { createWwzardIllustration } from '../examples/wwzard-illustration.js';
import { assertDocument, IllustrationController, renderSVG } from '@posecraft/runtime';
import { applyMotionLayers, ActorBehaviorRuntime } from '@posecraft/runtime/features';
import { compileScene } from '../tools/compile-scene.mjs';

const player = () => new IllustrationController(createWwwzardContactScene(), {motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
const step = (controller, seconds) => {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += 1 / 60) controller.step(1 / 60);
};
const event = (controller, name) => {
  controller.dispatch(name);
  controller.step(1 / 60);
};
const keyLeft = (controller, x, y) => {
  for (const [name,value] of Object.entries({keyLeftX:x,keyLeftNX:-x,keyLeftY:y,keyLeftNY:-y})) controller.setVariable(name,value);
};
const state = controller => controller.frame().behavior.state;
const actor = (controller, id) => controller.frame().actors.find(item => item.id === id);

test('keyboard input preserves hidden lid-grip fingers during deletion and one-handed typing',()=>{
  const c=player();
  for(const [clip,prefix] of [['typing','keyRight'],['prepared','keySolo']]){
    for(const [suffix,value] of Object.entries({X:1,NX:-1,Y:-1,NY:1}))c.setVariable(prefix+suffix,value);
    for(const time of [0,.24,.8,1.2]){
      c.previewClip('wwzard',clip,time);
      assert.equal(actor(c,'wwzard').pose['leftGrip.opacity'],0,`${clip} keeps the lid-grip overlay hidden`);
    }
  }
  c.dispose();
});

test('Contact is a portable, editable scene with the approved rig and all form events', () => {
  const scene = createWwwzardContactScene();
  assertDocument(scene);
  assert.deepEqual(scene.actors.map(item => item.id), ['sky', 'room', 'window', 'wwzard', 'desk', 'keyboard', 'screen', 'plane']);
  const contours = room => room.parts.filter(part=>!['window-mullion','window-mullion-shadow'].includes(part.id)).map(({joint,transform,spatial,...artwork}) => artwork);
  assert.deepEqual(contours(scene.packs.room), contours(createWwzardIllustration().packs.room), 'Contact reuses the approved plant and window contours, with a shared plant sway pivot');
  assert.deepEqual(scene.actors.find(actor => actor.id === 'plane').transform, scene.actors.find(actor => actor.id === 'wwzard').transform);
  assert.deepEqual(scene.lighting, { enabled: false });
  assert.deepEqual([...new Set(scene.behaviorGraph.edges.map(item => item.event).filter(Boolean))].sort(),
    ['almost-done', 'compose', 'error', 'laptop-click', 'ready', 'sending', 'sent', 'typing', 'visitor', 'wake']);
  assert.deepEqual(JSON.parse(JSON.stringify(scene)), scene);
  assertDocument(JSON.parse(JSON.stringify(scene)));
  assert.ok(gzipSync(JSON.stringify(scene)).length <= 30 * 1024);
  assert.ok(!JSON.stringify(scene).includes('studio-window'));
  const controller = new IllustrationController(scene, {motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
  assert.ok(renderSVG(scene, controller.frame()).includes('data-part="plane-top"'));
  controller.dispose();
});

test('typing responds, repeated input preserves progress, and prepared plane persists through input', () => {
  const controller = player();
  assert.equal(state(controller), 'ready');
  event(controller, 'typing');
  keyLeft(controller, -.6, -.5);
  step(controller, .1);
  assert.ok(actor(controller, 'wwzard').pose['rightHand.y'] < -4,
    'the input-driven hand position must be visible before the host idle event');
  step(controller, .5);
  const progress = controller.frame().behavior.actions.wwzard.progress;
  event(controller, 'typing');
  assert.equal(state(controller), 'typing');
  assert.ok(controller.frame().behavior.actions.wwzard.progress > progress);
  const typingStart = actor(controller, 'wwzard').pose['rightHand.y'];
  step(controller, 1.5);
  assert.equal(actor(controller, 'wwzard').pose['rightHand.y'], typingStart, 'held input must not oscillate');
  keyLeft(controller, 0, 0);
  assert.notEqual(actor(controller, 'wwzard').pose['rightHand.y'], typingStart);
  event(controller, 'almost-done');
  assert.equal(state(controller), 'preparing');
  step(controller, 1.6);
  assert.equal(state(controller), 'prepared');
  assert.ok(actor(controller, 'plane').pose['root.opacity'] > .9);
  event(controller, 'typing');
  event(controller, 'ready');
  assert.equal(state(controller), 'prepared');
  assert.ok(actor(controller, 'plane').pose['root.opacity'] > .9);
  controller.dispose();
});

test('field focus glances briefly without moving held typing hands, and error preempts attention', () => {
  const controller=player();event(controller,'typing');keyLeft(controller,-.6,-.5);step(controller,.4);
  const initial=actor(controller,'wwzard').pose;
  event(controller,'field-focus');step(controller,.5);
  const looking=actor(controller,'wwzard');
  assert.equal(state(controller),'typing');assert.equal(looking.clip,'typing');
  assert.equal(looking.inputs.attention,1);assert.ok(looking.pose['head.x']>initial['head.x']+5);
  assert.equal(looking.pose['rightHand.x'],initial['rightHand.x']);assert.equal(looking.pose['rightHand.y'],initial['rightHand.y']);
  step(controller,2.6);const returned=actor(controller,'wwzard');assert.equal(returned.inputs.attention,0);assert.equal(returned.pose['rightHand.x'],initial['rightHand.x']);assert.equal(returned.pose['rightHand.y'],initial['rightHand.y']);
  event(controller,'field-focus');step(controller,.4);assert.equal(actor(controller,'wwzard').inputs.attention,1);
  event(controller,'error');assert.equal(state(controller),'error');assert.equal(actor(controller,'wwzard').inputs.attention,0);assert.equal(controller.frame().actorBehaviors[0].state,'laptop');
  controller.dispose();
});

test('fast success waits for the complete plane throw before acknowledgement, close, nap, and wake', () => {
  const controller = player();
  event(controller, 'almost-done');
  step(controller, 1.6);
  event(controller, 'sending');
  event(controller, 'sent');
  assert.equal(state(controller), 'sending');
  step(controller, .7);
  assert.equal(state(controller), 'sending');
  assert.ok(actor(controller, 'plane').pose['root.x'] > 20);
  step(controller, .8);
  assert.equal(state(controller), 'acknowledged');
  step(controller, 2.4);
  assert.equal(state(controller), 'closing');
  step(controller, 6.2);
  assert.equal(state(controller), 'nap');
  assert.ok(actor(controller, 'screen').pose['hinge.bend'] > .95);
  event(controller, 'laptop-click');
  assert.equal(state(controller), 'opening');
  step(controller, 4.1);
  assert.equal(state(controller), 'ready');
  assert.ok(actor(controller, 'screen').pose['hinge.bend'] < .05);
  controller.dispose();
});

test('correcting a form error interrupts disbelief immediately without restarting repeated errors', () => {
  const controller = player();
  event(controller, 'error');
  step(controller, .08);
  const progress = controller.frame().behavior.actions.wwzard.progress;
  event(controller, 'error');
  assert.equal(state(controller), 'error');
  assert.ok(controller.frame().behavior.actions.wwzard.progress > progress);
  event(controller, 'typing');
  assert.equal(state(controller), 'typing');
  keyLeft(controller, -.6, -.5);
  step(controller, .12);
  assert.ok(actor(controller, 'wwzard').pose['rightHand.y'] < -4);
  event(controller, 'error');
  event(controller, 'almost-done');
  assert.equal(state(controller), 'preparing');
  event(controller, 'error');
  event(controller, 'sending');
  assert.equal(state(controller), 'preparingSend');
  event(controller, 'error');
  event(controller, 'ready');
  assert.equal(state(controller), 'preparingSend', 'idle cannot cancel a submitted letter');
  step(controller, 4.6);
  assert.equal(state(controller), 'prepared', 'failed submission retrieves a replacement');
  controller.dispose();
});

test('brief typing while asleep opens the laptop and resumes the saved typing intent', () => {
  const controller = player();
  event(controller, 'sending');
  event(controller, 'sent');
  step(controller, 11.3);
  assert.equal(state(controller), 'nap');
  event(controller, 'typing');
  assert.equal(state(controller), 'opening');
  step(controller, .45);
  event(controller, 'ready');
  assert.equal(state(controller), 'opening');
  step(controller, 3.7);
  assert.equal(state(controller), 'resumedTyping');
  assert.ok(actor(controller, 'screen').pose['hinge.bend'] < .05);
  step(controller, 1.3);
  assert.equal(state(controller), 'ready');
  controller.dispose();
});

test('opening gust recoils the character and leaves; later hover does not reset the window',()=>{
 const controller=player();event(controller,'almost-done');step(controller,.55);
 assert.ok(actor(controller,'window').pose['windowHinge.bend']>.5);
 assert.ok(actor(controller,'room').pose['windLeft.bend']>.5);
 assert.ok(actor(controller,'wwzard').pose['torso.x'] < -2);
 step(controller,1.2);event(controller,'gust-right');step(controller,.4);
 assert.equal(state(controller),'prepared');
 assert.ok(actor(controller,'room').pose['windRight.bend']>.5);
 assert.ok(actor(controller,'window').pose['windowHinge.bend']>.99);
 controller.dispose();
});

test('failed send keeps the window open and retrieves a plane for a successful retry', () => {
  const controller=player();event(controller,'sending');step(controller,3.1);
  assert.equal(state(controller),'waiting');
  assert.ok(actor(controller,'window').pose['windowHinge.bend']>.99);
  event(controller,'error');assert.equal(state(controller),'retrying');step(controller,1.6);
  assert.equal(state(controller),'prepared');assert.ok(actor(controller,'plane').pose['root.opacity']>.99);
  assert.ok(actor(controller,'window').pose['windowHinge.bend']>.99);
  event(controller,'sending');event(controller,'sent');step(controller,1.1);
  assert.equal(state(controller),'sending','success waits for the plane to clear the aperture');
  assert.ok(actor(controller,'window').pose['windowHinge.bend']>.99);
  step(controller,1.4);assert.equal(state(controller),'acknowledged');
  assert.ok(actor(controller,'window').pose['windowHinge.bend']<.01);
  controller.dispose();
});

test('fast failure waits for release, then retrieves a new plane without closing the window',()=>{
 const controller=player();event(controller,'sending');event(controller,'error');step(controller,1.7);
 assert.equal(state(controller),'sending');step(controller,1.4);assert.equal(state(controller),'retrying');
 step(controller,1.6);assert.equal(state(controller),'prepared');
 assert.ok(actor(controller,'window').pose['windowHinge.bend']>.99);controller.dispose();
});

test('all prepared typing uses the free hand while the grip remains still',()=>{
 const controller=player();event(controller,'almost-done');step(controller,1.7);
 const initial=actor(controller,'wwzard').pose;
 for(const [x,y]of [[.6,-.7],[-.4,-.6],[.5,-.3]]){
  for(const [key,value]of Object.entries({keySoloX:x,keySoloNX:-x,keySoloY:y,keySoloNY:-y}))controller.setVariable(key,value);
  keyLeft(controller,-.6,-.5);step(controller,.15);
  const current=actor(controller,'wwzard').pose;
  assert.ok(Math.abs(current['leftHand.x']-initial['leftHand.x'])>4);
  assert.equal(current['rightHand.x'],initial['rightHand.x']);
  assert.equal(current['rightHand.y'],initial['rightHand.y']);
 }
 controller.dispose();
});

test('direct send still prepares and throws a plane before a fast acknowledgement', () => {
  const controller = player();
  event(controller, 'sending');
  event(controller, 'sent');
  assert.equal(state(controller), 'preparingSend');
  step(controller, 1.6);
  assert.equal(state(controller), 'sending');
  step(controller, 1.5);
  assert.equal(state(controller), 'acknowledged');
  controller.dispose();
});

test('compose interrupts acknowledgement and reopens a sleeping character for a restored draft',()=>{
 const controller=player();event(controller,'sending');event(controller,'sent');step(controller,3.1);
 assert.equal(state(controller),'acknowledged');event(controller,'compose');assert.equal(state(controller),'ready');
 event(controller,'sending');event(controller,'sent');step(controller,11.3);assert.equal(state(controller),'nap');
 event(controller,'compose');assert.equal(state(controller),'opening');event(controller,'almost-done');step(controller,4.1);
 assert.equal(state(controller),'preparing');controller.dispose();
});

test('Contact website payload stays within the 100 KiB gzip budget', async () => {
  const scene = createWwwzardContactScene();
  await fs.mkdir('test-results', { recursive: true });
  const destination = await fs.mkdtemp(path.resolve('test-results/wwwzard-contact-export-'));
  const manifest = await compileScene(scene, destination);
  assert.equal(manifest.runtime, 'illustration');
  const modules = manifest.files.flatMap(file => file.modules);
  assert.ok(!modules.some(id => /planck|(?:^|\/)physics\.js|scene-3d|native-3d/i.test(id)));
  const runtime = (await Promise.all(manifest.files.map(async file =>
    gzipSync(await fs.readFile(path.join(destination, 'runtime', file.file))).length)))
    .reduce((sum, size) => sum + size, 0);
  const html = gzipSync(await fs.readFile(path.join(destination, 'index.html'))).length;
  const total = runtime + html;
  assert.ok(total <= 100 * 1024, String(total) + ' gzip bytes exceed the 100 KiB ceiling');
  await fs.writeFile('test-results/wwwzard-contact-budget.json', JSON.stringify({
    sceneGzipBytes: gzipSync(JSON.stringify(scene)).length,
    runtimeGzipBytes: runtime, htmlGzipBytes: html, transferGzipBytes: total,
    runtime: manifest.runtime,
  }, null, 2) + '\n');
});
