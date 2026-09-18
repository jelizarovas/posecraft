import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gymPreparationReviews} from '../examples/gym-preparation.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5181').replace(/\/$/,''),review=gymPreparationReviews.find(r=>r.clip==='tired-breaths');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
async function seek(t){await page.locator('#demo-scrub').fill(String(t));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(+document.querySelector('#demo-art svg').dataset.sceneTime-t)<.025,t);}
const opacity=id=>page.locator('#demo-art [data-actor="atlas"] [data-part="'+id+'"]').getAttribute('opacity').then(Number);
try{
 await fs.mkdir('test-results',{recursive:true});await page.route('**/favicon.ico',route=>route.fulfill({status:204,body:''}));await page.goto(base+'/demos.html#gym-routine');await page.getByLabel('Action variations',{exact:true}).selectOption(review.clip);await page.waitForFunction(label=>document.querySelector('#demo-caption').textContent.includes(label),review.label);assert.equal(await page.locator('#demo-scrub').getAttribute('max'),String(review.duration));assert.equal(await page.locator('#demo-beat').inputValue(),'grip');
 await seek(0);assert.equal(await opacity('breath-mouth'),0);assert.equal(await opacity('breath-air'),0);
 for(const [index,time]of [1.12,2.48,3.84].entries()){
  await seek(time);assert.ok(await opacity('breath-mouth')>.9,'visible exhale mouth '+(index+1));assert.ok(await opacity('breath-air')>.6,'visible exhale air '+(index+1));assert.ok(!/NaN|Infinity|undefined/.test(await page.locator('#demo-art').innerHTML()));await page.locator('#demo-art').screenshot({path:'test-results/gym-breath-'+(index+1)+'.png'});
 }
 for(const time of [1.6,2.96,4.8]){await seek(time);assert.ok(await opacity('breath-mouth')<.01,'mouth settles between breath-outs');assert.ok(await opacity('breath-air')<.01,'air clears between breath-outs');}
 await page.locator('#demo-speed').selectOption('0.25');await page.locator('#demo-loop-beat').check();await page.locator('#demo-reset').click();assert.equal(await page.locator('#gym-grip-review').inputValue(),review.clip);assert.equal(await page.locator('#demo-scrub').getAttribute('max'),'4.8');await seek(0);assert.equal(await opacity('breath-mouth'),0);
 await page.locator('#edit-demo').click();await page.locator('#character-workspace').click();await page.locator('#actors').selectOption('atlas');await page.locator('#clip').selectOption(review.clip);assert.equal(await page.locator('#clip').inputValue(),review.clip);assert.equal(await page.locator('#art [data-part="breath-mouth"]').count(),1);assert.equal(await page.locator('#art [data-part="breath-air"]').count(),1);
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/demos.html#gym-routine');await page.locator('#gym-grip-review').selectOption(review.clip);await seek(2.48);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));await page.screenshot({path:'test-results/gym-preparation-mobile.png'});assert.deepEqual(errors,[]);console.log('Preparation browser passed:three distinct breath-outs,mouth/air visibility,slowplay/loop/reset,Studio clip and compact mobile.');
}finally{await browser.close();}
