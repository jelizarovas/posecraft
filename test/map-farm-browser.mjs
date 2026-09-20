import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5246/play.html');await page.waitForFunction(()=>window.mapPlay?.townLife);
 await page.evaluate(()=>mapPlay.view.ready);
 await page.waitForFunction(()=>{const art=mapPlay.view.stats().art;return art?.loaded===art?.requested;});
 const art=await page.evaluate(()=>mapPlay.view.stats().art);assert.equal(art.failed,0);assert.equal(art.loaded,art.requested);
 await mkdir('test-results',{recursive:true});
 for(const [name,x,y,zoom] of [['farm-crops',39,52,2.5],['farm-corn-fence',34,69,2.5],['farm-pastures',74,82,2.5],['farm-creek',88,68,2.2],['farm-mine',89,48,3]]){
  await page.evaluate(({x,y,zoom})=>{mapPlay.view.zoomTo(zoom);mapPlay.view.panTo(x,y);},{x,y,zoom});
  await page.waitForTimeout(700);await page.waitForFunction(()=>!mapPlay.view.stats().terrainCache?.pending);await page.screenshot({path:`test-results/${name}.png`});
 }
 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{mapPlay.view.zoomTo(3);mapPlay.view.panTo(68,81);});await page.waitForTimeout(500);
 await page.screenshot({path:'test-results/farm-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Passed: farm assets load, desktop regions and mobile render without errors.');
 await page.evaluate(()=>{mapPlay.townLife.dispose();mapPlay.view.dispose();});
}finally{await browser.close();}
