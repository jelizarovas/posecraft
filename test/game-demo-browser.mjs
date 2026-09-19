import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {assertDocument} from '../src/schema.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5223').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await fs.mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:960}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/game-demo.html');await page.waitForFunction(()=>window.gameDemo?.player?.controller?.frame()?.actors?.length);
 await page.locator('#repair').click();await page.locator('#continue').waitFor({state:'visible',timeout:30000});
 assert.match(await page.locator('#speech').textContent(),/You fixed it/);await page.locator('#continue').click();
 await page.waitForFunction(()=>document.querySelector('#quest').textContent==='The shop is open.');
 assert.equal(await page.evaluate(()=>gameDemo.player.controller.frame().objects.find(o=>o.id==='shop-light').enabled),true);
 await page.screenshot({path:'test-results/game-demo-complete.png'});
 await page.locator('#reset').click();await page.locator('#repair').click();await page.locator('#cancel').click();
 assert.equal(await page.locator('#cancel').isDisabled(),true);assert.equal(await page.locator('#continue').isHidden(),true);
 await page.locator('#reduced').check();await page.locator('#repair').click();await page.locator('#continue').waitFor({state:'visible'});
 await page.locator('#reset').click();assert.equal(await page.locator('#continue').isHidden(),true);
 const downloadPromise=page.waitForEvent('download');await page.locator('#download').click();const download=await downloadPromise;
 const data=assertDocument(JSON.parse(await fs.readFile(await download.path(),'utf8')));assert.equal(data.game.anchors['shop.sign'].prop,'shop');
 await page.locator('#manifest-toggle').click();assert.match(await page.locator('#manifest').textContent(),/"inspect"/);await page.locator('#manifest-toggle').click();
 await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'test-results/game-demo-mobile.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,quest:true,hostDialogue:true,cancellation:true,reducedMotion:true,portableBindings:true,mobile:true}));
}finally{await browser.close();}
