import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],output='test-results/portfolio-interactions';await fs.mkdir(output,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});page.on('pageerror',e=>errors.push(e.message));
 const waitActivity=(value,timeout=12000)=>page.waitForFunction(value=>document.querySelector('[data-actor="wwzard"]')?.getAttribute('data-activity')===value,value,{timeout});
 const clickPart=async part=>{
  const p=await page.evaluate(part=>{
   for(const node of document.querySelectorAll(`[data-scene-part="${part}"],[data-source-part="${part}"]`)){
    const r=node.getBoundingClientRect();if(r.width>1&&r.height>1)return{x:r.x+r.width*.5,y:r.y+r.height*.5};
   }throw Error('No visible part '+part);
  },part);await page.mouse.click(p.x,p.y);
 };
 await page.goto(base+'/');await page.locator('.wwwzard-live[data-posecraft-ready="true"]').waitFor();
 assert.equal(await page.locator('.wwwzard-greet').count(),0,'no overlay intercepts the artwork');
 assert.equal(await page.locator('[data-actor="angerMeter"]').count(),0,'anger is internal, without a visible meter');
 await clickPart('lid-back');await waitActivity('visitorClose');await waitActivity('laptopPuzzled');
 await page.screenshot({path:output+'/home-puzzled.png'});await waitActivity('open');
 // Actual native pointer movement across blank scene space near the plant.
 const point=(x,y)=>page.evaluate(({x,y})=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector('.wwwzard-runtime svg').getScreenCTM());return{x:p.x,y:p.y};},{x,y});
 const from=await point(195,280),to=await point(150,280);
 await page.mouse.move(from.x,from.y);await page.waitForTimeout(25);await page.mouse.move(to.x,to.y);
 await page.waitForFunction(()=>document.querySelector('[data-actor="room"]')?.getAttribute('data-activity')==='gustLeft');
 await page.goto(base+'/stories');await page.locator('.portfolio-character[data-posecraft-ready="true"]').waitFor();
 await waitActivity('wwzard-turn',7000);
 const paths=[];for(let i=0;i<5;i++){paths.push(await page.locator('[data-source-part="turning-page"]').first().getAttribute('d'));await page.waitForTimeout(320);}
 assert(new Set(paths).size>=3,'autonomous page visibly changes shape, not only elapsed time');
 await page.screenshot({path:output+'/stories-turn.png'});
 await waitActivity('wwzard-reading');await clickPart('book-right-cover');await waitActivity('wwzard-turn',1500);
 await page.goto(base+'/projects');await page.locator('.portfolio-character[data-posecraft-ready="true"]').waitFor();
 await waitActivity('inspect',7000);await page.screenshot({path:output+'/projects-inspect.png'});
 await page.waitForTimeout(4000);await clickPart('car-body');await waitActivity('inspect',1500);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({homeDirectLidClick:true,automaticReopen:true,nearbyGust:true,visibleAutonomousPageTurn:true,bookClick:true,projectClick:true,errors}));
}finally{await browser.close();}
