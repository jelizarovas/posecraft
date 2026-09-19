import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1366,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/demos.html#littlelands-map');
  await page.waitForFunction(()=>window.mapDemo?.view.stats().art.loaded===10);
  await page.evaluate(()=>{window.originalMapView=mapDemo.view;});
  const toggle=page.locator('#demo-fullscreen');
  await toggle.click();
  await page.waitForFunction(()=>document.fullscreenElement?.id==='demo-player');
  assert.equal(await toggle.getAttribute('aria-label'),'Exit fullscreen');
  assert.equal(await page.evaluate(()=>mapDemo.view===originalMapView),true);
  await page.evaluate(()=>{mapDemo.view.moveTo('hero','village-house').catch(()=>{});});
  await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.actor.arrived'&&e.target==='village-house'),{},{timeout:20000});
  // Browser-driven exit must update the toggle and restore the surrounding page.
  await page.evaluate(()=>document.exitFullscreen());
  await page.waitForFunction(()=>!document.querySelector('#demo-player').classList.contains('demo-fullscreen'));
  assert.equal(await page.locator('.demo-library').evaluate(e=>e.inert),false);
  // Unsupported and rejected requests use the same mounted player in a viewport overlay.
  await page.evaluate(()=>{document.querySelector('#demo-player').requestFullscreen=()=>Promise.reject(Error('Unsupported'));});
  await page.setViewportSize({width:390,height:844});
  await toggle.click();
  async function fits(){
    const b=await page.evaluate(()=>{
      const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,right:r.right};};
      return{player:rect('demo-player'),stage:rect('demo-stage'),button:rect('demo-fullscreen'),w:innerWidth,h:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert.equal(b.overflow,false);assert.equal(Math.round(b.player.w),b.w);assert.equal(Math.round(b.player.h),b.h);
    assert.equal(b.stage.x,0);assert.equal(b.stage.y,0);assert.equal(Math.round(b.stage.w),b.w);assert.equal(Math.round(b.stage.h),b.h);assert.equal(await page.locator('#demo-player button:visible').count(),1);assert.ok(b.button.b<=b.h&&b.button.right<=b.w,JSON.stringify(b));assert.ok(b.button.h>=44);
  }
  await fits();await page.screenshot({path:'test-results/demo-fullscreen-mobile.png'});
  await page.setViewportSize({width:844,height:390});await fits();
  await page.screenshot({path:'test-results/demo-fullscreen-landscape.png'});
  await page.keyboard.press('Escape');
  assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  await page.setViewportSize({width:390,height:844});
  // Shared fullscreen also preserves SVG, interactive scenes and the native 3D player.
  for(const id of ['campfire-night','ship-in-a-bottle','corner-shop','gym-routine']){
    await page.locator(`[data-demo="${id}"]`).click();
    await page.waitForFunction(()=>document.querySelector('#demo-art svg, #demo-art canvas'));
    await toggle.click();await fits();
    await page.screenshot({path:`test-results/demo-fullscreen-${id}.png`});
    await toggle.click();assert.equal(await toggle.getAttribute('aria-pressed'),'false');
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,native:true,fallback:true,mapNavigation:true,portrait:true,landscape:true,svg:true,game:true,workout:true}));
}finally{await browser.close();}
