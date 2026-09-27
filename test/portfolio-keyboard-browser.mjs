import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256',out='test-results/contact-keyboard';
await fs.mkdir(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/contact');await page.locator('[data-posecraft-ready="true"]').waitFor();
 const pose=()=>page.evaluate(()=>Object.fromEntries(['left','right'].map(side=>{
   const node=document.querySelector(`[data-actor="wwzard"] [data-joint="${side==='left'?'right':'left'}Hand"]`),m=node.transform.baseVal.consolidate().matrix;
   return [side,{x:m.e,y:m.f}];
 })));
 const field=page.getByPlaceholder('Your name');await field.focus();const rest=await pose();
 // In this three-quarter drawing, his anatomical left is the far hand.
 assert(rest.left.x>rest.right.x&&rest.left.y<rest.right.y,'left key target is the far hand, not the viewer-left joint name');
 for(const key of ['q','a','z']){
   await page.keyboard.down(key);await page.waitForTimeout(230);const held=await pose();
   assert(Math.abs(held.left.x-rest.left.x)>2,'left-side key moves the left hand');
   assert(Math.abs(held.right.x-rest.right.x)<.2,'left-side key leaves right hand at rest');
   await page.screenshot({path:`${out}/${key}.png`});
   await page.keyboard.up(key);await page.waitForTimeout(260);
 }
 await page.keyboard.press('q');await page.waitForTimeout(60);assert(Math.abs((await pose()).left.x-rest.left.x)>1,'a brief tap stays visible');await page.waitForTimeout(300);
 await field.fill('Held deletion');await page.waitForTimeout(400);
 await page.keyboard.down('Backspace');await page.waitForTimeout(240);const held=await pose();
 assert(Math.abs(held.right.x-rest.right.x)>3);assert(Math.abs(held.left.x-rest.left.x)<.2);
 const gripFingers=page.locator('[data-actor="wwzard"] [data-part="left-grip-fingers"]');
 await page.screenshot({path:out+'/backspace-typing.png'});
 assert.equal(await gripFingers.getAttribute('opacity'),'0','lid-gripping fingertips must remain hidden during active deletion');
 await page.keyboard.down('Backspace');await page.waitForTimeout(750);
 assert(Math.abs((await pose()).right.x-held.right.x)<.2,'autorepeat holds its position');
 await page.screenshot({path:out+'/held-backspace.png'});
 assert.equal(await gripFingers.getAttribute('opacity'),'0','lid-gripping fingertips must remain hidden while holding Backspace');
 await page.keyboard.down('q');await page.waitForTimeout(220);assert(Math.abs((await pose()).left.x-rest.left.x)>2,'both hands may hold independently');
 await page.keyboard.up('q');await page.waitForTimeout(260);assert(Math.abs((await pose()).right.x-held.right.x)<.2);
 await field.blur();await page.waitForTimeout(260);assert(Math.abs((await pose()).right.x-rest.right.x)<.2,'blur releases held hand');
 await page.keyboard.up('Backspace');
 await field.focus();await field.evaluate(el=>el.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'文'})));
 await page.waitForTimeout(90);const mobile=await pose();assert(Math.abs(mobile.left.y-rest.left.y)>2||Math.abs(mobile.right.y-rest.right.y)>2,'software input produces a short tap');
 await page.waitForTimeout(400);assert(Math.abs((await pose()).left.x-rest.left.x)<.2);
 await page.getByPlaceholder('Email or phone').fill('preview@example.invalid');
 await page.getByPlaceholder('A role, a project, or a quick hello').fill('Keyboard check');
 await page.waitForFunction(()=>document.querySelector('[data-actor="wwzard"]')?.getAttribute('data-activity')==='prepared');
 await page.getByPlaceholder('Write your message').fill('Held deletion with a plane');
 await page.keyboard.down('Backspace');await page.waitForTimeout(240);
 assert.equal(await gripFingers.getAttribute('opacity'),'0','one-handed deletion also hides lid-gripping fingertips');
 await page.screenshot({path:out+'/plane-backspace.png'});
 await page.keyboard.up('Backspace');
 await page.screenshot({path:out+'/desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/mobile.png'});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),390);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({leftKeys:true,heldBackspace:true,independentRelease:true,blurCleanup:true,softwareKeyboard:true,errors}));
}finally{await browser.close();}
