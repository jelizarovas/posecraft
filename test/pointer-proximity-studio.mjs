import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {assertDocument} from '@posecraft/runtime';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900},acceptDownloads:true,reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('http://127.0.0.1:5247/?demo=wwzard-desk');await page.locator('#clip').waitFor();
 await page.locator('#scene-workspace').click();await page.locator('#scene-behaviors').click();
 await page.locator('[data-behavior-page="pointer"]').click();
 await page.locator('#pointer-binding').selectOption('home-plant-left');
 await page.locator('#pointer-radius').fill('110');await page.locator('#pointer-radius').dispatchEvent('change');
 await page.locator('#pointer-direction').selectOption('right');
 const download=page.waitForEvent('download');await page.locator('#export').click();
 const saved=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));assertDocument(saved);
 const binding=saved.interactions.find(binding=>binding.id==='home-plant-left');
 assert.equal(binding.radius,110);assert.equal(binding.direction,'right');
 await page.goto('http://127.0.0.1:5247/');await page.locator('#clip').waitFor();
 await page.locator('#file').setInputFiles({name:'plant-interaction.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))});
 await page.locator('#scene-workspace').click();await page.locator('#scene-behaviors').click();
 await page.locator('[data-behavior-page="pointer"]').click();await page.locator('#pointer-binding').selectOption('home-plant-left');
 assert.equal(await page.locator('#pointer-radius').inputValue(),'110');assert.equal(await page.locator('#pointer-direction').inputValue(),'right');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({nearbyRadiusAndDirection:true,editSaveReopen:true}));
}finally{await browser.close();}
