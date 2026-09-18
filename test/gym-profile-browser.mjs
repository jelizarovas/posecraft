import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5199').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/demos.html#gym-routine');await page.locator('#scene-full-set').click();
 for(const [name,time]of [['profile-right',31.52],['profile-left',55],['raised-arms',6.8],['reclining',42]]){
  await page.locator('#demo-scrub').fill(String(time));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(Number(document.querySelector('#demo-art svg')?.dataset.sceneTime)-t)<.03,time);
  assert.equal(await page.locator('#demo-art [data-part="trunk"]').count(),1);
  const beard=page.locator('#demo-art [data-part="beard"]');assert.equal(await beard.count(),1);assert.ok((await beard.boundingBox()).height>4,'beard retains a visible authored silhouette');
  await page.locator('#demo-art').screenshot({path:`test-results/atlas-${name}.png`});
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#demo-scrub').fill('31.52');await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(()=>Math.abs(Number(document.querySelector('#demo-art svg')?.dataset.sceneTime)-31.52)<.03);await page.screenshot({path:'test-results/atlas-profile-phone.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
 console.log('Atlas profiles, raised arms and bench render without errors; phone gallery fits.');
}finally{await browser.close();}
