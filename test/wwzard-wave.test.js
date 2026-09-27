import assert from 'node:assert/strict';
import test from 'node:test';
import { gzipSync } from 'node:zlib';
import { assertDocument, IllustrationController, renderSVG } from '@posecraft/runtime';
import { illustrationFeatures } from '@posecraft/runtime/features';
import { createWwwzardHomeScene } from '../examples/wwwzard-home.js';
import { createWwwzardContactScene } from '../examples/wwwzard-contact.js';

import {pathBounds} from '../src/render-geometry.js';

const pose = controller => controller.frame().actors.find(actor => actor.id === 'wwzard').pose;

test('Home and Contact save a connected upright-palm wave through the public runtime', () => {
  const home = createWwwzardHomeScene();
  const contact = createWwwzardContactScene();
  assertDocument(home);
  assertDocument(contact);
  assert.deepEqual(contact.packs.wwzard.clips.sent.tracks, home.packs.wwzard.clips.greet.tracks);
  for (const scene of [home, contact]) {
    const sleeve = scene.packs.wwzard.parts.find(part => part.id === 'left-sleeve');
    const hand = scene.packs.wwzard.parts.find(part => part.id === 'left-hand');
    assert.equal(sleeve.spatial.morph.layers.filter(layer => layer.channel === 'waveNear.bend').length, 1);
    assert.ok(sleeve.spatial.morph.layers.length <= 8);
    const wavingPalm=hand.spatial.morph.layers.find(layer=>layer.channel==='waveNear.bend');
    assert.ok(wavingPalm);const bounds=pathBounds(wavingPalm.target);
    assert(bounds.height/bounds.width<1.5,'raised palm must not stretch into a long finger');
    assert(scene.packs.wwzard.parts.find(p=>p.id==='left-thumb').spatial.morph.layers.some(layer=>layer.channel==='waveNear.bend'),'thumb follows the raised palm');
    const fingers = scene.packs.wwzard.parts.find(part => part.id === 'wave-fingers');
    assert(fingers, 'wave must have visible open fingers, not just a rounded fist');
    assert.equal(fingers.transform, hand.transform, 'fingers use the palm local origin');
    assert.equal(fingers.joint, hand.joint);
    assert.equal(pathBounds(fingers.d).width, 0, 'extra fingers disappear at rest');
    assert(pathBounds(fingers.spatial.morph.target).height > 25, 'open silhouette extends above the palm');
    assert.equal(sleeve.spatial.depthSplit.low.channel, 'waveNear.z');
    const controller = new IllustrationController(scene, illustrationFeatures);
    controller.previewClip('wwzard', scene === home ? 'greet' : 'sent', .9);
    const raised = pose(controller);
    assert.ok(raised['leftHand.y'] < -80);
    assert.ok(raised['leftHand.x'] < -110);
    assert.ok(raised['waveNear.bend'] > .9);
    assert.ok(raised['waveNear.z'] > 35, 'raised forearm must clear the desk');
    assert.ok(raised['torso.rotation'] > 0, 'body leads the viewer-facing gesture');
    assert.ok(renderSVG(scene, controller.frame()).includes('data-part="left-hand"'));
    controller.dispose();
  }
  assert.ok(gzipSync(JSON.stringify(home)).length < 30 * 1024);
});

test('forearm sway and delayed head follow-through have no adjacent-frame snap', () => {
  const controller = new IllustrationController(createWwwzardHomeScene(), illustrationFeatures);
  const channels = {
    'leftHand.x': 4, 'leftHand.y': 4, 'leftHand.rotation': 3,
    'waveNear.bend': .08, 'waveNear.z': 4,
    'head.rotation': 1, 'hat.rotation': .5,
  };
  let previous;
  for (let frame = 0; frame <= 132; frame++) {
    controller.previewClip('wwzard', 'greet', frame / 60);
    const current = pose(controller);
    if (previous) for (const [channel, maximum] of Object.entries(channels))
      assert.ok(Math.abs((current[channel] ?? 0) - (previous[channel] ?? 0)) < maximum,
        channel + ' snapped at frame ' + frame);
    previous = current;
  }
  assert.equal(pose(controller)['waveNear.bend'], 0);
  controller.dispose();
});
