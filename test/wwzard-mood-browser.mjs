import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:0,hmr:false},appType:'mpa'});
await server.listen();
const base=server.resolvedUrls.local[0].replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:390,height:844},acceptDownloads:true});
const errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
  await page.goto(base+'/wwzard.html');
  await page.waitForFunction(()=>window.posecraft?.controller);
  await page.evaluate(()=>{const dispatch=posecraft.dispatch;window.sentEvents=[];posecraft.dispatch=(...args)=>{sentEvents.push(args[0]);return dispatch(...args);};});
  await page.locator('#close-laptop').click();
  await page.locator('#open-laptop').click();
  assert.deepEqual(await page.evaluate(()=>sentEvents.slice(-2)),['close-laptop','open-laptop']);
  assert.deepEqual(await page.locator('[data-mood]').allTextContents(),['Disappointed','Normal','Angry']);
  assert.equal(await page.locator('[data-mood="normal"]').getAttribute('aria-pressed'),'true');
  await page.locator('#study summary').click();
  assert.deepEqual((await page.locator('#clip option').evaluateAll(options=>options.map(option=>option.value))).slice(-4),['close','closed-idle','closed-pause','open']);
  for(const mood of ['normal','disappointed','angry']){
    await page.locator(`[data-mood="${mood}"]`).click();
    assert.equal(await page.locator(`[data-mood="${mood}"]`).getAttribute('aria-pressed'),'true');
    for(const baseClip of ['close','closed-idle','closed-pause','open']){
      await page.locator('#clip').selectOption(baseClip);
      await page.locator('#scrub').fill('0.5');
      const preview=await page.evaluate(()=>({hero:posecraft.controller.frame().actors.find(a=>a.id==='wwzard'),screen:posecraft.controller.frame().actors.find(a=>a.id==='screen')}));
      const selectedClip=mood==='normal'?baseClip:`${baseClip}--${mood}`;
      assert.equal(preview.hero.clip,selectedClip);
      assert.equal(preview.screen.clip,selectedClip);
      assert.equal(preview.hero.clipTime,preview.screen.clipTime);
    }
  }
  assert.equal(await page.evaluate(()=>posecraft.controller.frame().behavior.variables.mood),2);
  const downloadPromise=page.waitForEvent('download');
  await page.locator('#save').click();
  const download=await downloadPromise;
  const fs=await import('node:fs/promises');
  const saved=JSON.parse(await fs.readFile(await download.path(),'utf8'));
  assert.equal(saved.behaviorGraph.variables.mood,2);
  for(const baseClip of ['close','closed-idle','closed-pause','open']){
    assert.ok(saved.packs.wwzard.clips[`${baseClip}--angry`]);
    assert.ok(saved.packs.screen.clips[`${baseClip}--angry`]);
  }
  assert.ok(saved.behaviorGraph.handlers.some(handler=>handler.event==='close-laptop'));
  assert.ok(saved.behaviorGraph.handlers.some(handler=>handler.event==='open-laptop'));
  await page.goto(base+'/demos.html#wwzard-desk');
  await page.locator('#wwzard-mood-disappointed').waitFor();
  await page.locator('#wwzard-close-laptop').click();
  await page.locator('#wwzard-open-laptop').click();
  await page.locator('#wwzard-mood-disappointed').click();
  assert.equal(await page.locator('#wwzard-mood-disappointed').getAttribute('aria-pressed'),'true');
  const galleryDownloadPromise=page.waitForEvent('download');
  await page.locator('#download-demo').click();
  const galleryDownload=await galleryDownloadPromise;
  const galleryScene=JSON.parse(await fs.readFile(await galleryDownload.path(),'utf8'));
  assert.equal(galleryScene.behaviorGraph.variables.mood,0);
  assert.deepEqual(errors,[]);
  console.log('Wwzard laptop controls, mood study previews, and saved default passed.');
}finally{await browser.close();await server.close();}
