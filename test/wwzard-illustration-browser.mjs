import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {compileScene} from '../tools/compile-scene.mjs';

const supplied=process.env.BASE_URL||process.env.POSECRAFT_URL;
const server=supplied?null:await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:0,hmr:false},appType:'mpa'});
if(server)await server.listen();
const base=(supplied||server.resolvedUrls.local[0]).replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[];
await fs.mkdir('test-results',{recursive:true});
const compiledRoot=await fs.mkdtemp(path.resolve('test-results/wwzard-browser-compiled-'));
const compiledManifest=await compileScene(createWwzardIllustration(),compiledRoot);
const fixture=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body{margin:0;font:16px system-ui;background:#f5f3fb;color:#322b4f}header,article,footer{padding:24px;max-width:1040px;margin:auto}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin:24px auto;max-width:1040px}
.stage{width:100%;aspect-ratio:540/520;overflow:hidden;background:white;border-radius:12px}.stage svg{width:100%;height:100%;display:block}
#below{margin-top:1800px;width:min(90vw,400px)}@media(max-width:600px){.grid{display:block}.stage{margin-bottom:16px}}
</style><header><h1>A page with other things to do</h1><p>The illustration lives beside readable content.</p></header><article><p>Scroll and interact with the surrounding page.</p><button id="host-button">Host button</button><output id="clicks">0</output><div class="grid" id="grid"></div><div id="below" class="stage"></div></article><footer>End of page</footer>`;

const context=await browser.newContext({viewport:{width:1200,height:800},reducedMotion:'no-preference'});
const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
await page.route('**/wwzard-browser-host',route=>route.fulfill({contentType:'text/html',body:fixture}));
try{
  await page.goto(base+'/wwzard-browser-host');
  await page.evaluate(()=>{document.querySelector('#host-button').onclick=()=>document.querySelector('#clicks').textContent=String(Number(document.querySelector('#clicks').textContent)+1);});
  const sample=()=>page.evaluate(async()=>{
    const gaps=[];let last;
    for(let i=0;i<140;i++)await new Promise(resolve=>requestAnimationFrame(now=>{if(last!==undefined&&i>=20)gaps.push(now-last);last=now;resolve();}));
    gaps.sort((a,b)=>a-b);
    return {p50:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)],p99:gaps[Math.floor(gaps.length*.99)],missed25:gaps.filter(gap=>gap>25).length/gaps.length,samples:gaps.length};
  });
  const baseline=await sample();
  await page.evaluate(async()=>{
    const [{createWwzardIllustration},{mountExport}]=await Promise.all([import('/examples/wwzard-illustration.js'),import('/src/illustration-entry.js')]);
    window.scene=createWwzardIllustration();window.mountExport=mountExport;window.mounts=[];
    window.addStage=async()=>{const el=document.createElement('div');el.className='stage';document.querySelector('#grid').append(el);const player=await mountExport(el,scene);mounts.push({el,player});return mounts.length;};
  });
  await page.evaluate(()=>addStage());
  await page.waitForFunction(()=>mounts[0].player.controller.time>.1);
  assert.equal(await page.locator('.grid svg').count(),1);
  const one=await sample();
  await page.evaluate(async()=>{await addStage();await addStage();});
  await page.waitForFunction(()=>mounts.every(m=>m.player.controller.time>.1));
  const painting=await page.evaluate(()=>{const gradients=[...document.querySelectorAll('.grid linearGradient[data-part-gradient]')],ids=gradients.map(node=>node.id);return {gradients:gradients.length,uniqueIds:new Set(ids).size===ids.length,paintedParts:document.querySelectorAll('.grid [data-part][fill^="url(#"]').length};});
  assert.ok(painting.gradients>0&&painting.paintedParts>0,'saved linear gradients paint the replacement artwork');
  assert.equal(painting.uniqueIds,true,'multiple embeds keep gradient definitions isolated');
  const reuse=await page.evaluate(async()=>{const [{library},{assertDocument}]=await Promise.all([import('/examples/library.js'),import('/src/schema.js')]);assertDocument(library.wwzard);return {samePack:JSON.stringify(library.wwzard.packs.wwzard)===JSON.stringify(scene.packs.wwzard),clips:Object.keys(library.wwzard.packs.wwzard.clips),actorPack:library.wwzard.actors[0].pack};});
  assert.equal(reuse.samePack,true,'Studio library reuses the saved Wwzard rig and acting clips');
  assert.equal(reuse.actorPack,'wwzard');
  for(const baseClip of ['close','open','closed-idle','closed-pause'])for(const suffix of ['','--disappointed','--angry'])assert.ok(reuse.clips.includes(baseClip+suffix),'library retains '+baseClip+suffix);
  await page.locator('#host-button').click();
  assert.equal(await page.locator('#clicks').textContent(),'1','host input remains responsive with three embeds');
  const three=await sample();
  const host=await page.evaluate(()=>({viewport:[innerWidth,innerHeight],scrollWidth:document.documentElement.scrollWidth,domNodes:document.querySelectorAll('*').length,svgNodes:[...document.querySelectorAll('.grid svg')].map(svg=>svg.querySelectorAll('*').length),heapBytes:performance.memory?.usedJSHeapSize??null,userAgent:navigator.userAgent,renderer:scene.renderer||'svg'}));
  assert.equal(host.scrollWidth<=host.viewport[0],true,'three embeds must not cause horizontal scroll');
  assert.ok(three.p95<=25,`three-embed p95 frame gap ${three.p95.toFixed(1)} ms exceeds 25 ms target`);
  await page.evaluate(()=>mounts.forEach(({player},i)=>{player.dispatch(['mood-disappointed','mood-normal','mood-angry'][i]);player.dispatch('close-laptop');}));
  await page.waitForFunction(()=>mounts.every(({player})=>player.controller.frame().behavior.variables.laptopClosed),{},{timeout:45000});
  const closedThree=await sample();
  assert.ok(closedThree.p95<=25,`three closed-idle embeds p95 ${closedThree.p95.toFixed(1)} ms exceeds 25 ms target`);
  await page.evaluate(async()=>{const el=document.querySelector('#below');window.offscreen=await mountExport(el,scene);});
  await page.waitForTimeout(250);
  const hiddenStart=await page.evaluate(()=>offscreen.controller.time);
  await page.waitForTimeout(350);
  const hiddenEnd=await page.evaluate(()=>offscreen.controller.time);
  assert.ok(hiddenEnd-hiddenStart<.025,`offscreen scene advanced by ${(hiddenEnd-hiddenStart).toFixed(3)}s`);
  await page.locator('#below').scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>offscreen.controller.time>0.08);
  const resumed=await page.evaluate(()=>offscreen.controller.time);
  assert.ok(resumed<1,'offscreen resume cannot accumulate the hidden wall-clock interval');
  await page.evaluate(()=>{offscreen.dispose();for(const mount of mounts)mount.player.dispose();});
  const disposedStart=await page.evaluate(()=>[offscreen.controller.time,...mounts.map(m=>m.player.controller.time)]);
  await page.waitForTimeout(250);
  assert.deepEqual(await page.evaluate(()=>[offscreen.controller.time,...mounts.map(m=>m.player.controller.time)]),disposedStart,'disposed embeds stop advancing');

  const runtimeRequests=[];
  page.on('request',request=>{if(request.url().includes('/runtime/')&&request.url().endsWith('.js'))runtimeRequests.push(request.url());});
  await page.goto(`${base}/test-results/${path.basename(compiledRoot)}/`);
  await page.waitForFunction(()=>window.posecraft?.controller?.time>.08);
  assert.equal(await page.locator('#error').isVisible(),false);
  assert.equal(await page.locator('#posecraft svg').count(),1,'the compiled website renders its own saved scene');
  await page.evaluate(()=>posecraft.dispatch('visitor'));
  await page.waitForFunction(()=>posecraft.controller.frame().behavior.variables.pending===true);
  assert.equal(compiledManifest.runtime,'illustration');
  assert.ok(runtimeRequests.length>0&&runtimeRequests.every(url=>!/(physics|3d|planck)/i.test(url)),'compiled playback fetches only its illustration runtime');

  await page.setViewportSize({width:390,height:844});
  await page.goto(base+'/wwzard.html');
  await page.waitForFunction(()=>window.posecraft?.controller);
  const mobile=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,stage:document.querySelector('#illustration').getBoundingClientRect().toJSON(),svgCount:document.querySelectorAll('#illustration svg').length}));
  assert.ok(mobile.scrollWidth<=mobile.width,'phone-width host page does not scroll horizontally');
  assert.equal(mobile.svgCount,1);
  await page.locator('#hello').click();
  await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.variables.pending===true);
  await page.locator('#study summary').click();
  await page.locator('#clip').selectOption('curious');
  const before=await page.evaluate(()=>({time:posecraft.controller.time,behavior:posecraft.controller.frame().behavior}));
  await page.locator('#scrub').fill('0.5');
  const preview=await page.evaluate(()=>({time:posecraft.controller.time,behavior:posecraft.controller.frame().behavior,clip:posecraft.controller.frame().actors.find(a=>a.id==='wwzard').clip,playing:posecraft.controller.playing}));
  assert.equal(preview.clip,'curious','scrub renders the selected authored clip');
  assert.equal(preview.time,before.time,'scrub does not reset live scene time');
  assert.deepEqual(preview.behavior,before.behavior,'scrub does not reset graph memory');
  assert.equal(preview.playing,false);
  await page.locator('#live').click();
  await page.waitForFunction(()=>posecraft.controller.playing&&posecraft.controller.time>0);
  assert.notEqual(await page.evaluate(()=>posecraft.controller.frame().actors.find(a=>a.id==='wwzard').clip),'curious','live playback releases preview ownership');

  const reduced=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  const still=await reduced.newPage();still.on('pageerror',error=>errors.push(error.message));
  try{
    await still.goto(base+'/wwzard.html');await still.waitForFunction(()=>window.posecraft?.controller);
    await still.waitForTimeout(250);
    assert.equal(await still.evaluate(()=>posecraft.controller.time),0,'reduced motion does not autoplay');
    await still.locator('#hello').click();
    await still.waitForFunction(()=>posecraft.controller.frame().behavior.variables.pending===true,{timeout:1500});
    assert.equal(await still.evaluate(()=>posecraft.controller.time),0,'reduced input does not start a continuous loop');
    await still.locator('#study summary').click();await still.locator('#clip').selectOption('greet');await still.locator('#scrub').fill('0.5');
    assert.equal(await still.evaluate(()=>posecraft.controller.frame().actors.find(a=>a.id==='wwzard').clip),'greet');
  }finally{await reduced.close();}
  assert.deepEqual(errors,[]);
  const report={environment:{platform:process.platform,arch:process.arch,node:process.version,cpu:os.cpus()[0]?.model,browser:host.userAgent,renderer:host.renderer,physicalPhone:false,emulation:'390px viewport and reduced-motion media in desktop Edge'},desktop:{viewport:host.viewport,baseline,one,three,closedThree,domNodes:host.domNodes,svgNodes:host.svgNodes,jsHeapBytes:host.heapBytes,painting},reuse,compiled:{runtime:compiledManifest.runtime,runtimeRequests},mobile,offscreen:{hiddenAdvanceSeconds:hiddenEnd-hiddenStart,resumedTimeSeconds:resumed},preview:{preservedTime:preview.time,preservedBehaviorState:preview.behavior.state}};
  await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/wwzard-browser-performance.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}finally{await context.close();await browser.close();if(server)await server.close();}
