import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createWwwzardContactScene } from '../examples/wwwzard-contact.js';
import { IllustrationController, renderSVG } from '@posecraft/runtime';
import { applyMotionLayers, ActorBehaviorRuntime } from '@posecraft/runtime/features';

const scene = createWwwzardContactScene();
const controller = new IllustrationController(scene, {motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
const output = 'test-results/wwwzard-contact-review';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
try {
  const page = await browser.newPage({ viewport: { width: 720, height: 700 } });
  for (const [name, clip] of Object.entries(scene.packs.wwzard.clips)) {
    const count = Math.ceil(clip.duration * 5);
    const frames = [];
    for (let index = 0; index <= count; index++) {
      const time = Math.min(clip.duration, index / 5);
      controller.previewClip('wwzard', name, time);
      frames.push({ svg: renderSVG(scene, controller.frame()), time });
    }
    await page.setContent(`<style>body{margin:0;background:#eeeaf4;font:12px system-ui;color:#54465e}main{display:grid;grid-template-columns:repeat(4,180px)}figure{margin:0;background:#fff}svg{display:block;width:175px;height:233px}figcaption{padding:3px 9px 8px}</style><main>${frames.map(({ svg, time }) => `<figure>${svg}<figcaption>${name} ${time.toFixed(2)}s</figcaption></figure>`).join('')}</main>`);
    await page.screenshot({ path: `${output}/${name}.png`, fullPage: true });
  }
  const sequence = new IllustrationController(scene, {motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
  const frames = [];
  const capture = label => frames.push({ svg: renderSVG(scene, sequence.frame()), label });
  const step = seconds => {
    for (let i = 0; i < Math.round(seconds * 60); i++) sequence.step(1 / 60);
  };
  const send = event => { sequence.dispatch(event); step(1 / 60); };
  capture('ready');
  send('typing'); step(.5); capture('typing');
  send('almost-done');
  for (let i = 0; i < 5; i++) { step(.3); capture(`prepare ${(i + 1) * .3}s`); }
  step(.5); capture('plane held');
  send('typing'); step(.3); capture('plane held through typing');
  send('sending'); send('sent');
  for (let i = 0; i < 6; i++) { step(.25); capture(`throw ${(i + 1) * .25}s`); }
  step(2.2); capture('ack');
  for (let i = 0; i < 5; i++) { step(.8); capture(`close ${(i + 1) * .8}s`); }
  step(2); capture('nap');
  send('wake');
  for (let i = 0; i < 5; i++) { step(.8); capture(`open ${(i + 1) * .8}s`); }
  send('error');
  for (let i = 0; i < 5; i++) { step(.5); capture(`error ${(i + 1) * .5}s`); }
  await page.setContent(`<style>body{margin:0;background:#eeeaf4;font:12px system-ui;color:#54465e}main{display:grid;grid-template-columns:repeat(4,180px)}figure{margin:0;background:#fff}svg{display:block;width:175px;height:233px}figcaption{padding:3px 9px 8px}</style><main>${frames.map(({ svg, label }) => `<figure>${svg}<figcaption>${label}</figcaption></figure>`).join('')}</main>`);
  await page.screenshot({ path: `${output}/full-sequence.png`, fullPage: true });
  const quick = new IllustrationController(scene, {motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
  const quickFrames = [];
  const quickCapture = label => quickFrames.push({ svg: renderSVG(scene, quick.frame()), label });
  const quickStep = seconds => {
    for (let i = 0; i < Math.round(seconds * 60); i++) quick.step(1 / 60);
  };
  quickCapture('before input');
  quick.dispatch('typing');
  for (const [duration, label] of [[.12, 'typing 120ms'], [.12, 'typing 240ms'],
    [.12, 'typing 360ms'], [.09, 'typing 450ms']]) {
    quickStep(duration); quickCapture(label);
  }
  quick.dispatch('ready'); quickStep(.12); quickCapture('ready recovery');
  await page.setContent(`<style>body{margin:0;background:#eeeaf4;font:12px system-ui;color:#54465e}main{display:grid;grid-template-columns:repeat(6,180px)}figure{margin:0;background:#fff}svg{display:block;width:175px;height:233px}figcaption{padding:3px 9px 8px}</style><main>${quickFrames.map(({ svg, label }) => `<figure>${svg}<figcaption>${label}</figcaption></figure>`).join('')}</main>`);
  await page.screenshot({ path: `${output}/quick-typing.png`, fullPage: true });
  console.log(output);
} finally {
  await browser.close();
}
