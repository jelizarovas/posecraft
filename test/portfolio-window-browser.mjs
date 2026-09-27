import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,channel:'msedge'});
const errors=[];
await fs.mkdir('test-results/portfolio-window',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 page.on('pageerror',error=>errors.push(error.message));
 for(const route of ['/','/contact']){
  await page.goto(base+route);await page.locator('[data-posecraft-ready="true"]').waitFor();
  const sky=page.locator('[data-actor="sky"]');
  await sky.waitFor();
  const cloudX=()=>sky.locator('[data-joint="clouds"]').evaluate(node=>node.transform.baseVal.consolidate().matrix.e);
  const before=await cloudX();
  await page.waitForTimeout(700);
  const drifting=await cloudX();assert(drifting>before,'clouds drift behind the fixed frame');
  const points=await page.evaluate(()=>{
   const svg=document.querySelector('[data-actor="room"]').ownerSVGElement;
   return [195,150].map(x=>{const p=new DOMPoint(x,280).matrixTransform(svg.getScreenCTM());return{x:p.x,y:p.y};});
  });
  await page.mouse.move(points[0].x,points[0].y);await page.waitForTimeout(30);await page.mouse.move(points[1].x,points[1].y);
  await page.waitForFunction(()=>document.querySelector('[data-actor="room"]')?.getAttribute('data-activity')==='gustLeft');
  await page.waitForTimeout(350);assert(await cloudX()>drifting,'leaf gusts do not restart the sky');
  await page.screenshot({path:`test-results/portfolio-window/${route==='/'?'home':'contact'}.png`});
 }
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 reduced.on('pageerror',error=>errors.push(error.message));
 await reduced.goto(base);const clouds=reduced.locator('[data-actor="sky"] [data-joint="clouds"]');await clouds.waitFor();
 const rest=await clouds.getAttribute('transform');await reduced.waitForTimeout(700);
 assert.equal(await clouds.getAttribute('transform'),rest,'reduced motion keeps the sky still');
 assert.equal(await reduced.evaluate(()=>document.documentElement.scrollWidth),390);
 await reduced.screenshot({path:'test-results/portfolio-window/mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({homeAndContact:true,cloudDrift:true,gustIndependent:true,reducedMotion:true,phoneWidth:true,physicalPhone:false}));
}finally{await browser.close();}
