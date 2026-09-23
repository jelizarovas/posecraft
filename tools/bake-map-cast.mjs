// Deterministic 16-heading batch baker for authentic Littlelands NPCs & Animals
// Renders all 16 directions (22.5° steps) with locked orthographic camera & lighting.

import {chromium} from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';

// 1. Static server to host posecraft for headless Playwright
function startServer(port = 5250) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let reqPath = req.url.split('?')[0];
      if (reqPath === '/') reqPath = '/index.html';
      const filePath = path.join(process.cwd(), reqPath);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ct = filePath.endsWith('.js') || filePath.endsWith('.mjs') ? 'application/javascript'
                 : filePath.endsWith('.html') ? 'text/html'
                 : filePath.endsWith('.json') || filePath.endsWith('.gltf') ? 'application/json'
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

console.log('Starting local static server on port 5250...');
const server = await startServer(5250);

const browser = await chromium.launch({
  headless: true,
  ...(process.platform === 'win32' ? {channel: 'msedge'} : {})
});

try {
  const page = await browser.newPage({viewport: {width: 1280, height: 960}});
  await page.goto('http://127.0.0.1:5250/index.html');

  console.log('Evaluating 16-heading baking pipeline in browser WebGL...');
  const results = await page.evaluate(async () => {
    const T = await import('/node_modules/three/build/three.module.js');
    const {createCastDefinitions} = await import('/tools/cast-definitions.mjs');

    const castDefs = createCastDefinitions(T);
    const TAU = Math.PI * 2;

    const subjects = [
      {
        id: 'npc-farmer',
        name: 'Mara',
        type: 'npc',
        frameWidth: 128,
        frameHeight: 176,
        camWidth: 0.945454545,
        camHeight: 1.3,
        lookY: 0.9,
        actions: [
          {name: 'idle', frames: 8, duration: 1.6},
          {name: 'walk', frames: 12, duration: 1.333},
          {name: 'turn', frames: 8, duration: 0.8},
          {name: 'work', frames: 16, duration: 1.6},
          {name: 'interact', frames: 12, duration: 1.2}
        ]
      },
      {
        id: 'npc-miller',
        name: 'Bram',
        type: 'npc',
        frameWidth: 128,
        frameHeight: 176,
        camWidth: 0.945454545,
        camHeight: 1.3,
        lookY: 0.9,
        actions: [
          {name: 'idle', frames: 8, duration: 1.6},
          {name: 'walk', frames: 12, duration: 1.333},
          {name: 'turn', frames: 8, duration: 0.8},
          {name: 'work', frames: 12, duration: 1.333},
          {name: 'interact', frames: 12, duration: 1.2}
        ]
      },
      {
        id: 'npc-child-1',
        name: 'Pip',
        type: 'npc',
        frameWidth: 128,
        frameHeight: 176,
        camWidth: 0.945454545,
        camHeight: 1.3,
        lookY: 0.9,
        actions: [
          {name: 'idle', frames: 8, duration: 1.6},
          {name: 'walk', frames: 12, duration: 1.333},
          {name: 'turn', frames: 8, duration: 0.8},
          {name: 'work', frames: 12, duration: 1.2},
          {name: 'interact', frames: 12, duration: 1.2}
        ]
      },
      {
        id: 'ewe-cream',
        name: 'Cream Ewe',
        type: 'animal',
        frameWidth: 176,
        frameHeight: 144,
        camWidth: 1.35,
        camHeight: 1.1,
        lookY: 0.55,
        actions: [
          {name: 'idle', frames: 8, duration: 1.6},
          {name: 'walk', frames: 12, duration: 1.333},
          {name: 'turn', frames: 8, duration: 0.8},
          {name: 'graze', frames: 16, duration: 1.6},
          {name: 'interact', frames: 12, duration: 1.2}
        ]
      },
      {
        id: 'cow-brown-white',
        name: 'Brown-and-white Cow',
        type: 'animal',
        frameWidth: 176,
        frameHeight: 144,
        camWidth: 1.85,
        camHeight: 1.5,
        lookY: 0.85,
        actions: [
          {name: 'idle', frames: 8, duration: 1.6},
          {name: 'walk', frames: 12, duration: 1.5},
          {name: 'turn', frames: 8, duration: 0.8},
          {name: 'graze', frames: 16, duration: 1.6},
          {name: 'interact', frames: 12, duration: 1.2}
        ]
      },
      {
        id: 'hen-brown',
        name: 'Brown Hen',
        type: 'animal',
        frameWidth: 96,
        frameHeight: 96,
        camWidth: 0.45,
        camHeight: 0.45,
        lookY: 0.22,
        actions: [
          {name: 'idle', frames: 8, duration: 1.6},
          {name: 'walk', frames: 12, duration: 1.0},
          {name: 'turn', frames: 8, duration: 0.8},
          {name: 'peck', frames: 16, duration: 1.6},
          {name: 'interact', frames: 12, duration: 1.2}
        ]
      }
    ];

    const outData = [];

    for (const subj of subjects) {
      const builder = castDefs[subj.id];
      if (!builder) continue;

      const actor = builder();
      const scene = new T.Scene();
      const root = new T.Group();
      scene.add(root);
      root.add(actor.root);

      // Locked Lighting setup matching Littlelands specifications
      scene.add(new T.HemisphereLight(0xe3deca, 0x33372a, 2.1));
      const key = new T.DirectionalLight(0xffe2ae, 3.2);
      key.position.set(-3, 6, 4);
      scene.add(key);
      const fill = new T.DirectionalLight(0xb5c2c9, 0.6);
      fill.position.set(4, 2, -3);
      scene.add(fill);

      // Camera: Orthographic isometric
      const camera = new T.OrthographicCamera(
        -subj.camWidth, subj.camWidth,
        subj.camHeight, -subj.camHeight,
        0.1, 40
      );
      camera.position.set(4, 3.266, 4).add(new T.Vector3(0, subj.lookY, 0));
      camera.lookAt(0, subj.lookY, 0);

      const renderer = new T.WebGLRenderer({alpha: true, antialias: true, preserveDrawingBuffer: true});
      renderer.setSize(subj.frameWidth, subj.frameHeight);
      renderer.setClearColor(0, 0);
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.toneMapping = T.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;

      camera.updateMatrixWorld(true);
      const ground = new T.Vector3(0, 0, 0).project(camera);
      const anchorY = (1 - ground.y) / 2;

      const subjectManifest = {
        id: subj.id,
        name: subj.name,
        type: subj.type,
        height: actor.height,
        anchorY,
        actions: {}
      };

      const actionOutputs = [];

      for (const act of subj.actions) {
        const atlas = document.createElement('canvas');
        atlas.width = subj.frameWidth * act.frames;
        atlas.height = subj.frameHeight * 16;
        const ctx = atlas.getContext('2d', {willReadFrequently: true});

        for (let d = 0; d < 16; d++) {
          root.rotation.y = Math.PI / 2 - d * Math.PI * 2 / 16;
          for (let f = 0; f < act.frames; f++) {
            const t = f / act.frames;
            actor.setPose(act.name, t);
            scene.updateMatrixWorld(true);
            renderer.render(scene, camera);
            ctx.drawImage(renderer.domElement, f * subj.frameWidth, d * subj.frameHeight);
          }
        }

        // Color extrusion padding (2px) to prevent black halos on transparent borders
        const imgData = ctx.getImageData(0, 0, atlas.width, atlas.height);
        const pixels = imgData.data;
        const w = atlas.width, h = atlas.height;
        // Simple 1-pass edge dilation
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const idx = (y * w + x) * 4;
            if (pixels[idx + 3] === 0) {
              // check neighbors
              for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const nIdx = ((y + dy) * w + (x + dx)) * 4;
                if (pixels[nIdx + 3] > 64) {
                  pixels[idx] = pixels[nIdx];
                  pixels[idx + 1] = pixels[nIdx + 1];
                  pixels[idx + 2] = pixels[nIdx + 2];
                  pixels[idx + 3] = 1; // subtle edge bleed for mipmapping
                  break;
                }
              }
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);

        const pngUrl = atlas.toDataURL('image/png').split(',')[1];
        const webpUrl = atlas.toDataURL('image/webp', 0.92).split(',')[1];

        subjectManifest.actions[act.name] = {
          frames: act.frames,
          directions: 16,
          frameWidth: subj.frameWidth,
          frameHeight: subj.frameHeight,
          duration: act.duration,
          anchorY,
          rootMotion: 'map-owned'
        };

        actionOutputs.push({
          action: act.name,
          frames: act.frames,
          png: pngUrl,
          webp: webpUrl
        });
      }

      renderer.dispose();

      outData.push({
        id: subj.id,
        type: subj.type,
        manifest: subjectManifest,
        actions: actionOutputs
      });
    }

    return outData;
  });

  console.log(`Baking complete for ${results.length} subjects. Writing assets to disk...`);

  for (const subj of results) {
    const subPath = subj.type === 'npc' ? `public/assets/map/npcs/${subj.id}` : `public/assets/map/animals/${subj.id}`;
    await mkdir(subPath, {recursive: true});

    // Write manifest
    await writeFile(`${subPath}/render-manifest.json`, JSON.stringify(subj.manifest, null, 2));

    for (const act of subj.actions) {
      // Write atlas webp & png
      await writeFile(`${subPath}/${act.action}-page-00.webp`, Buffer.from(act.webp, 'base64'));
      await writeFile(`${subPath}/${act.action}-page-00.png`, Buffer.from(act.png, 'base64'));
      console.log(`  Exported ${subj.id}: ${act.action} (${act.frames} frames x 16 headings)`);
    }

    // Also copy contact sheet preview to art-source
    const artPreviewDir = `art-source/littlelands/${subj.id}/previews`;
    await mkdir(artPreviewDir, {recursive: true});
    const walkAction = subj.actions.find(a => a.action === 'walk') || subj.actions[0];
    if (walkAction) {
      await writeFile(`${artPreviewDir}/walk-contact-sheet.png`, Buffer.from(walkAction.png, 'base64'));
    }
  }

  console.log('All cast atlases and manifests successfully baked and deployed!');
} finally {
  await browser.close();
  server.close();
}
