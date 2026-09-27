import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5255';
await fs.mkdir('test-results/laptop-toggle',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.NIGHT==='1')await page.addInitScript(()=>localStorage.setItem('portfolio-theme','dark'));
 await page.goto(base);
 const host=page.locator('.wwwzard-runtime[tabindex="0"]:visible');await host.waitFor();
 const waitActivity=name=>page.waitForFunction(name=>document.querySelector('.wwwzard-runtime [data-actor="wwzard"]')?.getAttribute('data-activity')===name,name,{timeout:8000});
 const clickLid=()=>host.locator('[data-source-part="lid-back"]').click({force:true});
 await clickLid();await waitActivity('laptopPuzzled');
 await clickLid();await waitActivity('open');
 assert.equal(await host.evaluate(el=>getComputedStyle(el).outlineStyle),'none','mouse click has no selection border');
 await page.waitForTimeout(1300);await page.screenshot({path:'test-results/laptop-toggle/opening.png'});
 // A new click reverses the opening before it can finish.
 await clickLid();await waitActivity('visitorClose');await page.waitForTimeout(180);
 await clickLid();await waitActivity('open');await waitActivity('work');
 await page.screenshot({path:'test-results/laptop-toggle/open.png'});
 // Keyboard activation remains available with its own focus indication.
 await host.focus();await page.keyboard.press('Enter');await waitActivity('visitorClose');
 assert.equal(await host.getAttribute('data-pointer-focus'),null);
 await page.keyboard.press('Enter');await waitActivity('open');
 assert.deepEqual(errors,[]);console.log(JSON.stringify({clickClosedToOpen:true,reverseMidMotion:true,mouseBorder:false,keyboardToggle:true,errors}));
}finally{await browser.close();}
