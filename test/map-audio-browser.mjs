import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from '@playwright/test';

const repo = fileURLToPath(new URL('..', import.meta.url));
const port = 5295;
const server = spawn(process.execPath, [path.join(repo, 'node_modules/vite/bin/vite.js'), '--host', '0.0.0.0', '--port', String(port), '--strictPort'], {
  cwd: repo, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true
});
let log = '';
const started = new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error(`Vite did not listen on ${port}\n${log}`)), 30000);
  const onData = chunk => {
    log += chunk.toString();
    if (log.includes(`:${port}`)) { clearTimeout(timer); resolve(); }
  };
  server.stdout.on('data', onData);
  server.stderr.on('data', onData);
  server.on('exit', code => { clearTimeout(timer); reject(new Error(`Vite exited ${code}\n${log}`)); });
});
async function stop(){
  if (server.exitCode !== null || server.killed) return;
  if (process.platform === 'win32') {
    await new Promise(resolve => spawn('taskkill', ['/pid', String(server.pid), '/t', '/f'], {stdio: 'ignore', windowsHide: true}).on('exit', resolve));
  } else server.kill('SIGTERM');
}

const browser = await chromium.launch({headless: true, ...(process.platform === 'win32' ? {channel: 'msedge'} : {})}).catch(error => stop().then(() => { throw error; }));
try {
  await started;
  const page = await browser.newPage({viewport: {width: 1280, height: 720}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${port}/play.html`);
  await page.waitForFunction(() => window.mapPlay?.view);
  await page.evaluate(() => mapPlay.view.ready);
  await page.evaluate(() => mapPlay.townLife?.dispose());
  const before = await page.evaluate(() => ({context: mapPlay.audio.context, cues: mapPlay.audio.recentCues().length}));
  assert.equal(before.context, null, 'AudioContext must not exist before a gesture');
  assert.equal(before.cues, 0);
  await page.mouse.click(640, 400);
  await page.waitForFunction(() => mapPlay.audio.context?.state === 'running');
  const destination = await page.evaluate(() => {
    const {view, map} = mapPlay;
    const actor = view.controller.actors.get(map.actors[0].id);
    for (const [dx, dy] of [[4, 0], [0, 4], [-4, 0], [0, -4], [5, 2], [3, 3]]) {
      const point = {x: actor.x + dx, y: actor.y + dy};
      if (!view.controller.index.isPointBlocked(point.x, point.y, 0.12)) return point;
    }
    throw new Error('No walkable destination');
  });
  await page.evaluate(point => { mapPlay.view.controller.moveTo(mapPlay.map.actors[0].id, point, {gait: 'walk'}); }, destination);
  await page.waitForFunction(() => mapPlay.audio.recentCues().some(cue => cue.name === 'step'), null, {timeout: 10000});
  const heard = await page.evaluate(() => {
    const cues = mapPlay.audio.recentCues();
    const step = cues.find(cue => cue.name === 'step');
    return {step, early: cues.some(cue => cue.time < 0), state: mapPlay.audio.context.state};
  });
  assert.equal(heard.state, 'running');
  assert.equal(heard.early, false);
  assert.ok(heard.step.gain > 0 && heard.step.gain <= 0.2, `step gain ${heard.step.gain}`);
  assert.ok(['grass', 'road', 'sand'].includes(heard.step.surface), heard.step.surface);
  await page.getByRole('button', {name: 'Open game settings'}).click();
  const volume = page.getByLabel('Volume');
  await volume.evaluate(input => {
    input.value = '0.2';
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
  });
  await page.getByLabel('Sound', {exact: true}).uncheck();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('posecraft-map-play-settings-v1')));
  assert.equal(saved.volume, 0.2);
  assert.equal(saved.sound, false);
  assert.equal(typeof saved.volume, 'number');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed: true, surface: heard.step.surface, gain: heard.step.gain, port}));
} finally {
  await browser.close();
  await stop();
}
