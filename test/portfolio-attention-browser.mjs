import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'}),base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
await fs.mkdir('test-results/contact-attention',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/contact');await page.locator('[data-posecraft-ready="true"]').waitFor();
 const poses=()=>page.evaluate(()=>Object.fromEntries(['head','leftHand','rightHand'].map(joint=>{
   const m=document.querySelector(`[data-actor="wwzard"] [data-joint="${joint}"]`).transform.baseVal.consolidate().matrix;
   return [joint,{x:m.e,y:m.f,angle:Math.atan2(m.b,m.a)*180/Math.PI}];
 })));
 const rest=await poses();await page.getByPlaceholder('Your name').focus();await page.waitForTimeout(420);
 const glance=await poses();assert(Math.abs(glance.head.angle-rest.head.angle)>5,'focus creates visible head turn');
 assert(Math.abs(glance.leftHand.x-rest.leftHand.x)<.2,'focus does not start typing');
 await page.keyboard.down('q');await page.waitForTimeout(230);const held=await poses();
 assert(Math.abs(held.rightHand.x-rest.rightHand.x)>2,'typing continues while looking');
 assert(Math.abs(held.leftHand.x-rest.leftHand.x)<.2,'the other hand stays still');
 assert(Math.abs(held.head.angle-glance.head.angle)<.5,'key input does not restart or cancel glance');
 await page.screenshot({path:'test-results/contact-attention/typing-and-looking.png'});
 await page.waitForTimeout(2700);const returned=await poses();
 assert(Math.abs(returned.head.angle-rest.head.angle)<.5,'head returns without waiting for release');
 assert(Math.abs(returned.rightHand.x-held.rightHand.x)<.2,'held hand remains while head returns');
 await page.keyboard.up('q');await page.getByPlaceholder('Email or phone').focus();await page.waitForTimeout(420);
 assert(Math.abs((await poses()).head.angle-rest.head.angle)>5,'another field prompts another glance');
 await page.getByPlaceholder('Email or phone').blur();await page.waitForTimeout(650);
 assert(Math.abs((await poses()).head.angle-rest.head.angle)<.5,'blur returns gaze');
 await page.screenshot({path:'test-results/contact-attention/returned.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({focusGlance:true,independentTyping:true,heldKeyThroughReturn:true,refocus:true,blur:true,errors}));
}finally{await browser.close();}
