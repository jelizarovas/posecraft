import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(30000);
const change=async(id,v)=>{await page.locator('#'+id).fill(String(v));await page.locator('#'+id).dispatchEvent('change');};
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2.demo.campfire-night')));
try{
 console.log('gallery');await page.goto(base+'/demos.html#campfire-night');await page.locator('#camp-fire').waitFor();await page.waitForTimeout(700);
 assert.equal(await page.locator('#demo-scrub').isVisible(),false);assert.equal(await page.locator('#demo-time').textContent(),'Live illustration');
 await page.locator('#camp-fire').click();await page.getByRole('button',{name:'Light fire',exact:true}).waitFor();await page.waitForTimeout(200);assert.match(await page.locator('#demo-caption').textContent(),/cold|fire|shiver/);
 await page.locator('#camp-fire').click();await page.getByRole('button',{name:'Put fire out',exact:true}).waitFor();
 console.log('studio');await page.locator('#edit-demo').click();await page.locator('#scene-behaviors').click();await page.locator('#behavior-state').waitFor();assert.equal(await page.locator('#behavior-presentation').inputValue(),'live');
 await page.locator('[data-behavior-page="branches"]').click();await page.locator('#behavior-edge').selectOption('recover');await change('edge-min',3);await change('edge-max',4);assert.deepEqual((await saved()).behaviorGraph.edges.find(e=>e.id==='recover').after,{min:3,max:4});
 await page.locator('#undo').click();assert.equal((await saved()).behaviorGraph.edges.find(e=>e.id==='recover').after.max,14);await page.locator('#redo').click();
 await page.locator('[data-behavior-page="states"]').click();await change('behavior-new-state','resting');await page.locator('#behavior-add-state').click();assert.ok((await saved()).behaviorGraph.states.resting);await page.locator('#action-add').click();assert.equal((await saved()).behaviorGraph.states.resting.actions[0].type,'event');await change('action-event-0','rest-start');await page.locator('#action-add-type').selectOption('input');await page.locator('#action-add').click();await page.locator('#action-actor-1').selectOption('camper-1');await page.locator('#action-input-1').selectOption('emotion');await page.locator('#action-value-1').selectOption('happy');assert.equal((await saved()).behaviorGraph.states.resting.actions[1].value,'happy');
 console.log('events');await page.locator('[data-behavior-page="events"]').click();await change('behavior-test-event','extinguish-fire');await page.locator('#behavior-test').click();await page.waitForFunction(()=>document.querySelector('#behavior-live')?.textContent.includes('cold'));
 await page.locator('[data-behavior-page="pointer"]').click();await page.locator('#pointer-binding').selectOption('camper-0-head');await change('pointer-resistance',.9);assert.equal((await saved()).interactions.find(i=>i.id==='camper-0-head').resistance,.9);
 await page.locator('[data-behavior-page="export"]').click();assert.match(await page.locator('#behavior-fields').textContent(),/Physics-free/);const download=page.waitForEvent('download');await page.locator('#behavior-export').click();const file=await download;const html=await fs.readFile(await file.path(),'utf8');assert.ok(html.includes('rest-start'));assert.ok(html.includes('/runtime/illustration.js'));assert.ok(!html.includes('demo-scrub'));
 await page.screenshot({path:'test-results/live-studio.png'});await page.reload();await page.locator('#scene-behaviors').click();await page.locator('[data-behavior-page="branches"]').click();await page.locator('#behavior-edge').selectOption('recover');assert.equal(await page.locator('#edge-min').inputValue(),'3');
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/demos.html#campfire-night');await page.locator('#camp-fire').waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:'test-results/live-campfire-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Live gallery, fire controls, Studio graph edits/undo/reload, pointer authoring, website download and mobile passed.');
}finally{await browser.close();}
