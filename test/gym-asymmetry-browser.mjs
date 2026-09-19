import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gymAsymmetryReviews} from '../examples/gym-asymmetry.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5181').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await fs.mkdir('test-results',{recursive:true});await page.goto(base+'/demos.html?legacy=1#gym-routine');
 for(const review of gymAsymmetryReviews){await page.locator('#gym-grip-review').selectOption(review.clip);await page.locator('#demo-scrub').fill('1.64');await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(()=>Math.abs(+document.querySelector('#demo-art svg')?.dataset.sceneTime-1.64)<.03);assert.ok(!/NaN|Infinity/.test(await page.locator('#demo-art').innerHTML()));await page.locator('#demo-art').screenshot({path:'test-results/gym-asymmetry-'+review.clip+'.png'});}
 const download=page.waitForEvent('download');await page.locator('#download-demo').click();const doc=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));
 for(const review of gymAsymmetryReviews){const recipe=doc.behaviorGraph.activities[review.kind],variant=recipe[review.failed?'failureVariants':'variants'].find(v=>v.clip===review.clip);assert.ok(variant.weightInfluences.some(m=>m.variable==='fatigue'&&m.weight>0));assert.equal(doc.contacts.filter(c=>c.clip===review.clip).length,2);assert.equal(doc.packs.atlas.clips[review.clip].duration,3.6);}
 await page.locator('#edit-demo').click();await page.locator('#character-workspace').click();await page.locator('#actors').selectOption('atlas');for(const review of gymAsymmetryReviews){await page.locator('#clip').selectOption(review.clip);assert.equal(await page.locator('#clip').inputValue(),review.clip);}
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/demos.html?legacy=1#gym-routine');await page.locator('#gym-grip-review').selectOption('pull-lead-left');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));assert.deepEqual(errors,[]);console.log('Asymmetric gym browser passed: eight previews, fatigue weights and grips in export, Studio clips and phone layout.');
}finally{await browser.close();}
