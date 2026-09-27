import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const out='test-results/portfolio-route-motion';await fs.mkdir(out,{recursive:true});
const errors=[];
try{
 for(const width of [1280,390]){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
  await page.goto(base);await page.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
  const nav=href=>page.locator(`.site-shell>header a[href="${href}"],.mobile-nav a[href="${href}"]`).filter({visible:true}).first();
  const settled=()=>page.waitForFunction(()=>!document.querySelector('.route-outgoing')&&!document.querySelector('[data-route-moving]'));
  for(const [href,direction]of [['/projects',-1],['/stories',-1],['/contact',-1],['/stories',1]]){
   await page.evaluate(()=>{window.departedSvg=document.querySelector('.site-scroll [data-actor="wwzard"]')?.closest('svg');});
   await nav(href).click();await page.waitForURL(url=>url.pathname===href);
   await page.waitForFunction(()=>!!document.querySelector('[data-route-moving]'));
   assert.equal(await page.locator('[data-page-motion]').getAttribute('data-route-moving'),String(direction));
   assert.equal(await page.locator('.route-outgoing').count(),1);
   assert.equal(await page.locator('.route-outgoing').getAttribute('aria-hidden'),'true');
   assert(await page.evaluate(()=>document.querySelector('.route-outgoing')?.contains(window.departedSvg)),'departure reuses the original renderer');
   const shapes=[];
   for(let i=0;i<3;i++){
    shapes.push(await page.locator('.route-outgoing [data-actor="wwzard"]').first().innerHTML());
    await page.waitForTimeout(55);
   }
   assert(new Set(shapes).size>1,'departing wizard stays animated during slide');
   await page.screenshot({path:`${out}/${width}-${href.slice(1)}-${direction}.png`});
   await settled();assert.equal(await page.locator('.site-scroll .portfolio-character-runtime svg').count(),1);
   assert(await page.evaluate(()=>!window.departedSvg.isConnected),'departed renderer is removed after travel');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'no page overflow');
  }
  await page.goBack();await page.waitForURL(url=>url.pathname==='/contact');await settled();
  await nav('/projects').click();await nav('/stories').click();await nav('/contact').click();
  await page.waitForURL(url=>url.pathname==='/contact');await settled();assert.equal(await page.locator('.route-outgoing').count(),0);
  await page.close();
 }
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 reduced.on('pageerror',e=>errors.push(e.message));await reduced.goto(base);
 await reduced.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
 await reduced.locator('.mobile-nav a[href="/projects"]').click();await reduced.waitForURL(url=>url.pathname==='/projects');
 assert.equal(await reduced.locator('.route-outgoing,[data-route-moving]').count(),0);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({menuDirection:true,liveDepartingReaction:true,widths:[1280,390],backAndRapidNavigation:true,reducedMotion:true,errors}));
}finally{await browser.close();}
