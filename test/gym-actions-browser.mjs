import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createGym} from '../examples/gym.js';
import {BehaviorRuntime} from '../src/behaviors.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5181').replace(/\/$/,''),g=new BehaviorRuntime(createGym());let drinking,drinkEnd,failing;
for(let i=0;i<180*120;i++){g.tick(1/120);const a=g.snapshot().actions.atlas;if(drinking===undefined&&a?.activity.startsWith('drink-'))drinking=g.time;if(drinkEnd===undefined&&g.variables.drinks>0)drinkEnd=g.time;if(failing===undefined&&a?.success===false)failing=g.time;}
assert.ok(drinking!==undefined&&drinkEnd!==undefined&&failing!==undefined,'default live scene shows failed attempts and water breaks');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));
const vars=()=>page.locator('#demo-art svg').getAttribute('data-behavior-variables').then(JSON.parse),action=()=>page.locator('#demo-art svg').getAttribute('data-action').then(JSON.parse);
async function seek(t){t=Math.round(t*25)/25;if(await page.locator('#demo-scrub').isHidden())await page.locator('#gym-review').click();await page.locator('#demo-scrub').fill(String(t));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(+document.querySelector('#demo-art svg').dataset.sceneTime-t)<.03,t);}
try{
 await fs.mkdir('test-results',{recursive:true});await page.goto(base+'/demos.html#gym-routine');await page.locator('#gym-thirsty').waitFor();assert.equal(await page.locator('#demo-scrub').isVisible(),false);assert.match(await page.locator('#demo-time').textContent(),/Paused|Live illustration/);
 await page.locator('#gym-thirsty').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#demo-art svg').dataset.behaviorVariables).dehydration>=80);await page.locator('#demo-play').click();await page.locator('#gym-tired').click();await page.waitForFunction(()=>JSON.parse(document.querySelector('#demo-art svg').dataset.behaviorVariables).fatigue>=85);await page.locator('#demo-play').click();
 await page.locator('#demo-reset').click();await seek(failing+.3);assert.equal((await action()).success,false);await page.locator('#demo-art').screenshot({path:'test-results/gym-live-failure.png'});
 await seek(drinking+2.2);assert.match((await action()).activity,/^drink-/);const opacity=await page.locator('#demo-art [data-part="water-bottle-body"]').getAttribute('opacity');assert.ok(Number(opacity)>.8);await page.screenshot({path:'test-results/gym-live-drinking.png'});await seek(drinkEnd+.1);assert.ok((await vars()).drinks>0);assert.ok((await vars()).dehydration<45);
 await page.locator('#scene-review-workout').click();assert.equal(await page.locator('#demo-scrub').isVisible(),true);assert.equal(await page.locator('#demo-beat').isVisible(),true);assert.equal(await page.locator('#demo-art svg').getAttribute('data-behavior-state'),null);
 await page.setViewportSize({width:390,height:844});await page.locator('#scene-workout').click();await page.locator('#gym-thirsty').waitFor();await page.waitForTimeout(200);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));await page.screenshot({path:'test-results/gym-live-mobile.png'});assert.deepEqual(errors,[]);console.log('Gym live browser passed: stat controls, failure variation, drinking, recovery effects, fixed review mode and compact mobile layout.');
}finally{await browser.close();}
