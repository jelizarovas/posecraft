import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:process.env.MOBILE==='1'?{width:390,height:844}:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.NIGHT==='1')await page.addInitScript(()=>localStorage.setItem('portfolio-theme','dark'));
 await page.goto(base+'/');await page.locator('.wwwzard-live[data-posecraft-ready="true"]').waitFor();
 const actor=page.locator('[data-actor="wwzard"]');
 const hat=actor.locator('[data-fragment="hat-crown"]');
 const box=await hat.boundingBox();await page.mouse.click(box.x+box.width*.5,box.y+box.height*.5);
 await page.waitForFunction(()=>document.querySelector('[data-actor="wwzard"]')?.getAttribute('data-activity')==='greet',{},{timeout:12000});
 await page.waitForTimeout(850);
 const sleeve=actor.locator('[data-part="left-sleeve"],[data-source-part="left-sleeve"]').first();
 const fingers=actor.locator('[data-part="wave-fingers"]').first();
 assert(await fingers.count(), 'deployed scene includes the open-hand silhouette');
 const bounds=await fingers.boundingBox();assert(bounds?.height>5 && bounds?.width>3, 'fingers extend visibly during the wave');
 const raised=await sleeve.getAttribute('d');assert(raised,'sleeve contour is rendered');
 await fs.mkdir('test-results/portfolio-wave',{recursive:true});
 await page.screenshot({path:'test-results/portfolio-wave/greeting.png'});
 await page.waitForTimeout(350);assert.notEqual(await sleeve.getAttribute('d'),raised,'forearm contour sways while greeting');
 await page.waitForFunction(()=>document.querySelector('[data-actor="wwzard"]')?.getAttribute('data-activity')!=='greet',{},{timeout:5000});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({actualHatClick:true,bentElbowContourSway:true,completes:true,errors}));
}finally{await browser.close();}
