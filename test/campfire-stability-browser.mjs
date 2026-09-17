import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/demos.html#campfire-night');await page.locator('#demo-art svg').waitFor();await page.waitForFunction(()=>document.querySelector('#demo-status').textContent.includes('4 characters'));
 for(const t of [0,.48,1,1.52,2,2.24,2.52,2.76,3]){
  await page.locator('#demo-scrub').fill(String(t));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(+document.querySelector('#demo-art svg').dataset.sceneTime-t)<.03,t);
  const hair=await page.locator('#demo-art [data-actor="camper-2"] [data-part="camp-hair-shell"]');assert.equal(await hair.getAttribute('opacity'),'1');assert.equal(await hair.getAttribute('visibility'),'visible');assert.ok((await hair.getAttribute('d')).length>100,'Opaque hair contour at '+t);
  if(t===2.52)await page.screenshot({path:'test-results/camp-hair-profile.png'});
 }
 for(const size of [{width:1366,height:768},{width:1024,height:700},{width:390,height:844},{width:320,height:844}]){
  await page.setViewportSize(size);const boxes=[];
  for(const text of ['Maple: fire','Maple: offering marshmallow / Juniper: eating shared marshmallow / Ember: pointing at meteor / Clover: watching meteor']){
   await page.locator('#demo-caption').evaluate((node,text)=>node.textContent=text,text);boxes.push(await page.locator('#demo-stage').boundingBox());
  }
  for(const k of ['x','y','width','height'])assert.ok(Math.abs(boxes[0][k]-boxes[1][k])<.1,`Caption shifts scene at ${size.width}: ${k}`);
  assert.ok(boxes[1].height>50);const footer=await page.locator('.demo-footer').boundingBox();assert.ok(footer.y+footer.height<=size.height+1);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  if(size.width<400){const lines=await page.locator('#demo-caption').evaluate(node=>{const r=document.createRange();r.selectNodeContents(node);return r.getClientRects().length;});assert.ok(lines>1,'The tested caption actually wraps');await page.screenshot({path:`test-results/camp-stable-${size.width}.png`});}
 }
 assert.deepEqual(errors,[]);console.log('Campfire stability passed: no missing hair in opening turn, and no stage movement from wrapped captions at desktop, tablet and phone widths.');
}finally{await browser.close();}
