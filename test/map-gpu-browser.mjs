import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=process.env.POSECRAFT_URL||'http://localhost:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];
  await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:'export function createHotContext(){return {on(){},accept(){},dispose(){},prune(){}}} export function updateStyle(id,css){let e=document.getElementById(id);if(!e){e=document.createElement("style");e.id=id;document.head.append(e)}e.textContent=css} export function removeStyle(id){document.getElementById(id)?.remove()}'}));
  await page.route('**/favicon.ico',r=>r.fulfill({status:204}));page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/play.html?renderer=webgl2');await page.waitForFunction(()=>window.mapPlay?.view);
  await page.evaluate(()=>mapPlay.view.ready);
  await page.waitForFunction(()=>{const s=mapPlay.view.stats();return !s.terrainCache?.pending&&!s.sceneryCache?.pending;},null,{timeout:60000});
  const first=await page.evaluate(()=>mapPlay.view.stats());
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/map-gpu-town.png'});
  assert.equal(first.renderer,'webgl2',first.rendererFallback);assert.equal(first.art.failed,0);assert.ok(first.gpu.drawCalls>0);assert.ok(first.gpu.textureBytes<=first.gpu.maxTextureBytes);
  await page.evaluate(()=>{mapPlay.townLife?.dispose();mapPlay.view.pause();mapPlay.view.zoomTo(.75);});
  await page.waitForFunction(()=>{const s=mapPlay.view.stats();return s.camera.zoom===.75&&!s.terrainCache.pending&&!s.sceneryCache.pending;},null,{timeout:60000});
  const wide=await page.evaluate(()=>mapPlay.view.stats());
  await page.evaluate(()=>mapPlay.view.zoomTo(2.5));await page.waitForFunction(()=>mapPlay.view.stats().camera.zoom===2.5);
  const back=await page.evaluate(()=>mapPlay.view.stats());
  assert.equal(back.renderer,'webgl2',back.rendererFallback);assert.equal(back.terrainCache.tileBuilds,wide.terrainCache.tileBuilds,'Warm camera zoom does not rebuild terrain');assert.equal(back.gpu.uploads,wide.gpu.uploads,'Warm camera zoom does not upload textures');
  assert.equal(back.gpu.geometryBuilds,wide.gpu.geometryBuilds,'Warm camera zoom reuses immutable GPU vertex buffers');
  for(const zoom of [.45,5]){
    await page.evaluate(zoom=>mapPlay.view.zoomTo(zoom),zoom);
    await page.waitForFunction(zoom=>{const s=mapPlay.view.stats();return s.camera.zoom===zoom&&!s.terrainCache.pending&&!s.sceneryCache.pending;},zoom,{timeout:60000});
    const s=await page.evaluate(()=>mapPlay.view.stats());assert.equal(s.renderer,'webgl2',s.rendererFallback);assert.ok(s.gpu.textureBytes<=s.gpu.maxTextureBytes);
  }
  await page.evaluate(()=>{const t=mapPlay.map.terraces.find(t=>t.id==='middle-falls');mapPlay.view.zoomTo(.85);mapPlay.view.panTo(t.x+t.width/2,t.y+t.height*.6);});
  await page.waitForFunction(()=>{const s=mapPlay.view.stats();return !s.terrainCache.pending&&!s.sceneryCache.pending;},null,{timeout:60000});
  const cliffs=await page.evaluate(()=>mapPlay.view.stats());assert.equal(cliffs.renderer,'webgl2',cliffs.rendererFallback);
  await page.screenshot({path:'test-results/map-gpu-cliffs.png'});
  const saved=await page.evaluate(()=>mapPlay.view.snapshot().scene);
  // Losing the context must preserve gameplay and the existing input canvas.
  await page.evaluate(()=>document.querySelector('#game canvas[aria-hidden]').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForFunction(()=>mapPlay.view.stats().renderer==='canvas2d');
  const fallback=await page.evaluate(()=>({stats:mapPlay.view.stats(),canvasCount:document.querySelectorAll('#game canvas').length}));assert.equal(fallback.canvasCount,1);
  assert.deepEqual(await page.evaluate(()=>mapPlay.view.snapshot().scene),saved,'Context loss preserves the existing gameplay controller and state');
  assert.deepEqual(errors,[]);await writeFile('test-results/map-gpu-smoke.json',JSON.stringify({first,wide,back,fallback},null,2));
  await page.evaluate(()=>mapPlay.view.dispose());assert.equal(await page.locator('#game canvas').count(),0);
  const pixels=await page.evaluate(async()=>{
    const {createMapGpu}=await import('/src/map-gpu.js'),canvas=document.createElement('canvas'),gpu=createMapGpu(canvas),source=document.createElement('canvas');source.width=source.height=8;const ctx=source.getContext('2d');ctx.fillStyle='#f00';ctx.fillRect(0,0,8,4);ctx.fillStyle='#00f';ctx.fillRect(0,4,8,4);
    const draw=()=>{gpu.begin({width:128,height:128,dpr:1,camera:{x:0,y:0},zoom:1});gpu.drawImage(source,-32,-32,64,64);gpu.polygon([{x:-60,y:-60},{x:-40,y:-60},{x:-40,y:-40},{x:-60,y:-40}],[0,1,0,.5]);gpu.end();};draw();
    const gl=canvas.getContext('webgl2'),pixel=(x,y)=>{const p=new Uint8Array(4);gl.readPixels(x,128-y,1,1,gl.RGBA,gl.UNSIGNED_BYTE,p);return [...p];},top=pixel(64,40),bottom=pixel(64,88),alpha=pixel(12,12),before=gpu.stats();draw();const after=gpu.stats(),error=gl.getError();gpu.dispose();return{top,bottom,alpha,before,after,error,disposed:gpu.stats()};
  });
  assert.deepEqual(pixels.top,[255,0,0,255]);assert.deepEqual(pixels.bottom,[0,0,255,255]);assert.ok(Math.abs(pixels.alpha[0]-109)<=1&&Math.abs(pixels.alpha[1]-242)<=1&&Math.abs(pixels.alpha[2]-106)<=1,'Premultiplied alpha blends correctly');assert.equal(pixels.error,0);assert.equal(pixels.before.uploads,pixels.after.uploads);assert.equal(pixels.disposed.textureBytes,0);assert.equal(pixels.disposed.geometryBytes,0);
  const plain=await page.evaluate(async()=>{
    const [{mountMap},{generateMap}]=await Promise.all([import('/src/map-browser.js'),import('/src/map.js')]),map=generateMap({width:16,height:16,seed:2});
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;width:128px;height:128px';document.body.append(host);
    const view=mountMap(host,map,{renderer:'webgl2',execution:'main',autoplay:false});await view.ready;
    for(let i=0;i<200;i++){await new Promise(requestAnimationFrame);if(view.stats().terrainCache&&!view.stats().terrainCache.pending&&!view.stats().sceneryCache.pending)break;}
    const stats=view.stats();view.dispose();
    const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};
    let fallback;try{fallback=mountMap(host,map,{renderer:'auto',execution:'main',autoplay:false});}finally{HTMLCanvasElement.prototype.getContext=original;}
    await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const unsupported=fallback.stats();fallback.dispose();host.remove();return{stats,unsupported};
  });
  assert.equal(plain.stats.renderer,'webgl2');assert.equal(plain.stats.terrainCache.pending,false,'Untextured maps settle without an endless preparation loop');assert.equal(plain.unsupported.renderer,'canvas2d');assert.equal(plain.unsupported.rendererFallback,'WebGL2 unavailable');
  await page.goto(base+'/map-editor.html?renderer=webgl2');await page.locator('.map-host canvas[aria-hidden]').waitFor();
  await page.locator('[data-action="home"]').click();await page.locator('[data-action="zoom-out"]').click();
  const popupPromise=page.waitForEvent('popup');await page.locator('[data-action="play"]').click();const popup=await popupPromise;await popup.waitForURL('**/play.html?draft=1&renderer=webgl2');await popup.close();
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,first:first.gpu,wide:wide.gpu,back:back.gpu,fallback:fallback.stats.rendererFallback}));
}finally{await browser.close();}
