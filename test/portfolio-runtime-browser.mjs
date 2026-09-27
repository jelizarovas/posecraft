import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.PORTFOLIO_URL||'http://127.0.0.1:5255';
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[],requests=[];
await fs.mkdir('test-results/portfolio-runtime',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await page.goto(base);await page.locator('.wwwzard-live[data-posecraft-ready="true"] .wwwzard-runtime[tabindex="0"]').waitFor();
 assert.equal(await page.locator('.wwwzard-runtime svg').count(),1,'hidden mobile copy does not mount on desktop');
 await page.locator('.wwwzard-runtime[tabindex="0"]:visible').click();
 const initialTime=await page.locator('.wwwzard-runtime svg').getAttribute('data-scene-time');
 await page.waitForFunction(t=>document.querySelector('.wwwzard-runtime svg')?.getAttribute('data-scene-time')!==t,initialTime);
 await page.screenshot({path:'test-results/portfolio-runtime/desktop.png',fullPage:true});
 for(let i=0;i<3;i++){
  await page.locator('a[href="/projects"]:visible').first().click();await page.waitForURL('**/projects');
  await page.waitForFunction(()=>!document.querySelector('.route-outgoing'));
  assert.equal(await page.locator('.wwwzard-runtime svg').count(),0,'navigation unmounts the runtime');
  await page.locator('a[href="/"]:visible').first().click();await page.waitForURL(base+'/');
  await page.waitForFunction(()=>!document.querySelector('.route-outgoing'));
  await page.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
 }
 const mobile=await browser.newPage({viewport:{width:390,height:844}});mobile.on('pageerror',e=>errors.push(e.message));
 await mobile.goto(base);await mobile.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
 assert.equal(await mobile.locator('.wwwzard-runtime svg').count(),1,'hidden desktop copy does not mount on mobile');
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
 await mobile.screenshot({path:'test-results/portfolio-runtime/mobile.png',fullPage:true});
 const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});reduced.on('pageerror',e=>errors.push(e.message));
 await reduced.goto(base);await reduced.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
 const time=()=>reduced.locator('.wwwzard-runtime svg').getAttribute('data-scene-time');
 const start=await time();await reduced.waitForTimeout(250);assert.equal(await time(),start);
 await reduced.locator('.wwwzard-runtime[tabindex="0"]:visible').click();assert.equal(await time(),start);
 assert(!requests.some(url=>/localhost:5247|127\.0\.0\.1:5247|\/src\/|\/examples\//.test(url)),'production portfolio uses built installed-package assets');
 assert.deepEqual(errors,[]);
 const report={passed:true,productionURL:base,desktopAndMobile:true,physicalPhone:false,reducedMotion:true,navigationCycles:3,sourceCheckoutRequests:false};
 await fs.writeFile('test-results/portfolio-runtime/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
