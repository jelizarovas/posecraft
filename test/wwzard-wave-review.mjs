import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { createWwzardIllustration } from '../examples/wwzard-illustration.js';
import { IllustrationController, renderSVG } from '@posecraft/runtime';

const scene = createWwzardIllustration();
const controller = new IllustrationController(scene);
const output = 'test-results/wwzard-wave.png';
await fs.mkdir('test-results', { recursive: true });
const frames = [];
for (let index = 0; index <= 22; index++) {
  const time = index / 10;
  controller.previewClip('wwzard', 'greet', time);
  frames.push({ time, svg: renderSVG(scene, controller.frame()) });
}
const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
});
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 800 } });
  await page.setContent(`<style>body{margin:0;background:#eeeaf4;font:14px system-ui;color:#54465e}main{display:grid;grid-template-columns:repeat(4,310px)}figure{margin:0;background:#fff}svg{display:block;width:300px;height:309px}figcaption{padding:4px 10px 10px}</style><main>${frames.map(({ time, svg }) => `<figure>${svg}<figcaption>${time.toFixed(1)}s</figcaption></figure>`).join('')}</main>`);
  await page.screenshot({ path: output, fullPage: true });
  controller.previewClip('wwzard', 'greet', .85);
  await page.setContent(`<style>body{margin:0;background:white}svg{display:block;width:600px;height:619px}</style>${renderSVG(scene, controller.frame())}`);
  await page.screenshot({ path: 'test-results/wwzard-wave-detail.png' });
  console.log(output);
} finally {
  await browser.close();
}
