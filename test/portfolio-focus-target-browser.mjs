import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 if(process.env.NIGHT==='1')await page.addInitScript(()=>localStorage.setItem('portfolio-theme','dark'));
 await page.goto(base+'/contact');await page.locator('[data-posecraft-ready="true"]').waitFor();
 const head=()=>page.evaluate(()=>{const m=document.querySelector('[data-actor="wwzard"] [data-joint="head"]').transform.baseVal.consolidate().matrix;return {x:m.e,y:m.f,angle:Math.atan2(m.b,m.a)*180/Math.PI};});
 const name=page.getByPlaceholder('Your name'),message=page.getByPlaceholder('Write your message');
 await name.focus();await page.waitForTimeout(500);const top=await head();
 await fs.mkdir('test-results/focus-target',{recursive:true});await page.screenshot({path:'test-results/focus-target/name.png'});
 const angles=[top.angle];for(let i=0;i<4;i++){await page.keyboard.press('Tab');await page.waitForTimeout(450);angles.push((await head()).angle);}
 assert(await message.evaluate(e=>e===document.activeElement),'Tab reaches Message without pointer movement');
 const bottom=await head();assert(bottom.angle-top.angle>5,'top and bottom fields need distinct vertical gaze');
 await page.screenshot({path:'test-results/focus-target/message.png'});
 for(let i=0;i<4;i++)await page.keyboard.press('Shift+Tab');await page.waitForTimeout(500);
 assert(await name.evaluate(e=>e===document.activeElement));assert(Math.abs((await head()).angle-top.angle)<1,'Shift+Tab restores upper gaze');
 await page.setViewportSize({width:1100,height:900});await page.waitForTimeout(400);assert(Number.isFinite((await head()).angle));
 await message.click();await page.waitForTimeout(450);const clicked=await head();assert(clicked.angle>top.angle+4,'pointer focus follows field geometry too');
 await page.keyboard.down('q');await page.waitForTimeout(150);assert(Math.abs((await head()).angle-clicked.angle)<1,'typing leaves aimed head independent');await page.keyboard.up('q');
 await page.waitForTimeout(2800);assert(Math.abs((await head()).angle)<1,'gaze returns to laptop without losing field focus');
 await page.goto(base+'/');await page.setViewportSize({width:390,height:844});assert.deepEqual(errors,[]);
 console.log(JSON.stringify({tab:true,shiftTab:true,click:true,angles,typingIndependent:true,returnToLaptop:true,resizeAndDisposal:true,errors}));
} finally {await browser.close();}
