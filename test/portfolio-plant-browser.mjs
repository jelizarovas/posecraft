import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,channel:'msedge'});
await fs.mkdir('test-results/portfolio-plant',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 for(const route of ['/','/contact']){
  await page.goto(base+route);await page.locator('[data-posecraft-ready="true"]').waitFor();
  const leaf=page.locator('[data-part="plant-tall-leaf"]').first(),rest=await leaf.getAttribute('d');
  if(route==='/contact')await page.getByPlaceholder('Your name').focus();
  const point=(x,y)=>page.evaluate(({x,y})=>{const svg=document.querySelector('[data-actor="room"]').ownerSVGElement,p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return {x:p.x,y:p.y};},{x,y});
  for(const direction of ['Left','Right']){
   const from=await point(direction==='Left'?195:150,280),to=await point(direction==='Left'?150:195,280);
   if(route==='/contact')await page.keyboard.down('a');
   await page.mouse.move(from.x,from.y);await page.waitForTimeout(30);await page.mouse.move(to.x,to.y);
   await page.waitForFunction(direction=>document.querySelector('[data-actor="room"]')?.getAttribute('data-activity')==='gust'+direction,direction);
   await page.waitForTimeout(220);assert.notEqual(await leaf.getAttribute('d'),rest,'leaves visibly deform with pointer gust');
   if(route==='/contact')assert.equal(await page.locator('[data-actor="wwzard"]').getAttribute('data-activity'),'typing','plant movement does not interrupt typing');
   await page.screenshot({path:`test-results/portfolio-plant/${route==='/'?'home':'contact'}-${direction}.png`});
   if(route==='/contact')await page.keyboard.up('a');
   await page.waitForTimeout(1850);assert.equal(await leaf.getAttribute('d'),rest,'leaves settle back');
  }
  if(route==='/contact')await page.keyboard.up('a');
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({homeAndContact:true,bothDirections:true,visibleDeformation:true,settles:true,typingContinues:true,errors}));
}finally{await browser.close();}
