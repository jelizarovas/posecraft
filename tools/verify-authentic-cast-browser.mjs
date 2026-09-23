import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import {mkdir, copyFile} from 'node:fs/promises';
import path from 'node:path';

function startServer(port = 5255) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/play.html';
      let filePath = path.join(process.cwd(), reqPath);
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        const publicPath = path.join(process.cwd(), 'public', reqPath);
        if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
          filePath = publicPath;
        }
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ct = filePath.endsWith('.js') || filePath.endsWith('.mjs') ? 'application/javascript'
                 : filePath.endsWith('.html') ? 'text/html'
                 : filePath.endsWith('.json') || filePath.endsWith('.gltf') ? 'application/json'
                 : filePath.endsWith('.webp') ? 'image/webp'
                 : filePath.endsWith('.png') ? 'image/png'
                 : filePath.endsWith('.css') ? 'text/css'
                 : 'application/octet-stream';
        res.writeHead(200, {'Content-Type': ct});
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

console.log('Starting verification static server on port 5255...');
const server = await startServer(5255);

const browser = await chromium.launch({
  headless: true,
  ...(process.platform === 'win32' ? {channel: 'msedge'} : {})
});

await mkdir('test-results/authentic-cast', {recursive: true});

try {
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  console.log('Opening play.html in browser...');
  await page.goto('http://127.0.0.1:5255/play.html');

  await page.waitForFunction(() => !!window.mapPlay?.view?.ready);
  await page.evaluate(() => window.mapPlay.view.ready);
  console.log('Map view is ready. Waiting for village simulation to tick...');

  // Wait 3 seconds for routines, movements, and texture decodes
  await page.waitForTimeout(3000);

  const stats = await page.evaluate(async () => {
    const {mapNpcRendererStats} = await import('/src/map-npc-renderer.js');
    return {
      rendererStats: mapNpcRendererStats(),
      actors: window.mapPlay.map.actors.map(a => ({
        id: a.id,
        name: a.name,
        pos: window.mapPlay.view.controller.actorPosition(a.id),
        appearance: a.appearance
      }))
    };
  });

  console.log('Renderer stats:', JSON.stringify(stats.rendererStats));

  // 1. Mara (npc-farmer) moved to the open road in front of the fields
  await page.evaluate(() => {
    const cx = Math.floor(window.mapPlay.map.width / 2);
    const cy = Math.floor(window.mapPlay.map.height / 2);
    window.mapPlay.townLife?.pause();
    const actor = window.mapPlay.view.controller.actors.get('npc-farmer');
    if (actor) {
      actor.x = cx - 17;
      actor.y = cy - 2;
      actor.facing = Math.PI * 0.75;
      actor.walking = false;
      actor.running = false;
      actor.lift = 0;
      window.mapPlay.view.controller.indexActor(actor);
    }
    window.mapPlay.view.panTo(cx - 17, cy - 2);
    window.mapPlay.view.zoomTo(3.2);
  });
  await page.waitForTimeout(600);
  await page.screenshot({path: 'test-results/authentic-cast/mara-review-2x.png'});
  console.log('Captured Mara at 3.0x on open road');

  // 2. Bram (npc-miller) near granary/road
  const bram = stats.actors.find(a => a.id === 'npc-miller');
  if (bram) {
    await page.evaluate(({x, y}) => {
      window.mapPlay.view.zoomTo(2.8);
      window.mapPlay.view.panTo(x, y);
    }, bram.pos);
    await page.waitForTimeout(600);
    await page.screenshot({path: 'test-results/authentic-cast/bram-review-2x.png'});
    console.log('Captured Bram at 2.8x');
  }

  // 3. Pip (npc-child-1) in plaza
  const pip = stats.actors.find(a => a.id === 'npc-child-1');
  if (pip) {
    await page.evaluate(({x, y}) => {
      window.mapPlay.view.zoomTo(2.8);
      window.mapPlay.view.panTo(x, y);
    }, pip.pos);
    await page.waitForTimeout(600);
    await page.screenshot({path: 'test-results/authentic-cast/pip-review-2x.png'});
    console.log('Captured Pip at 2.8x');
  }

  // 4. Pastures (Cream Ewes)
  const sheep = stats.actors.find(a => a.id === 'sheep-1');
  if (sheep) {
    await page.evaluate(({x, y}) => {
      window.mapPlay.view.zoomTo(2.6);
      window.mapPlay.view.panTo(x, y);
    }, sheep.pos);
    await page.waitForTimeout(600);
    await page.screenshot({path: 'test-results/authentic-cast/pasture-review-2x.png'});
    console.log('Captured Sheep at 2.6x');
  }

  // 5. Brown Cow close-up
  const cow = stats.actors.find(a => a.id === 'cow-1');
  if (cow) {
    await page.evaluate(({x, y}) => {
      window.mapPlay.view.zoomTo(2.6);
      window.mapPlay.view.panTo(x, y);
    }, cow.pos);
    await page.waitForTimeout(600);
    await page.screenshot({path: 'test-results/authentic-cast/cow-review-2x.png'});
    console.log('Captured Cow at 2.6x');
  }

  // 6. Chicken coop (Brown Hens)
  const chicken = stats.actors.find(a => a.id === 'chicken-1');
  if (chicken) {
    await page.evaluate(({x, y}) => {
      window.mapPlay.view.zoomTo(2.8);
      window.mapPlay.view.panTo(x, y);
    }, chicken.pos);
    await page.waitForTimeout(600);
    await page.screenshot({path: 'test-results/authentic-cast/chickens-review-2x.png'});
    console.log('Captured Chickens at 2.8x');
  }

  // 6. Wide town overview at 1.0x zoom
  await page.evaluate(() => {
    const cx = window.mapPlay.map.width / 2;
    const cy = window.mapPlay.map.height / 2;
    window.mapPlay.view.zoomTo(1.0);
    window.mapPlay.view.panTo(cx, cy);
  });
  await page.waitForTimeout(800);
  await page.screenshot({path: 'test-results/authentic-cast/town-overview-1x.png'});
  console.log('Captured Town overview at 1.0x');

  if (errors.length) {
    console.error('Page errors encountered:', errors);
  } else {
    console.log('SUCCESS: All in-game reviews captured without browser errors!');
  }
} finally {
  await browser.close();
  server.close();
}
