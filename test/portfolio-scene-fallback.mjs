import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 let aborted=0;
 await page.route('**/wwwzard-stories.scene-*.js',async route=>{aborted++;await route.abort();});
 await page.goto((process.env.PORTFOLIO_URL||'http://192.168.0.17:5256')+'/stories');
 await page.locator('.portfolio-character .section-wwwzard-motion').waitFor();
 await page.waitForTimeout(700);
 assert.equal(aborted,1);
 assert.equal(await page.locator('.portfolio-character').getAttribute('data-posecraft-ready'),'false');
 assert.equal(await page.locator('.portfolio-character-runtime svg').count(),0);
 assert.equal(await page.locator('.portfolio-character .section-wwwzard-motion').isVisible(),true);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({failedSceneDownload:true,artworkFallback:true,uncaughtErrors:0}));
}finally{await browser.close();}
