import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')));
const fixture=JSON.parse(fs.readFileSync(new URL('../examples/characters/ona.json',import.meta.url),'utf8'));
fixture.packs.ona.clips.wave={duration:2,loop:false,tracks:{'head.rotation':[[0,0],[.5,10,'linear'],[1,20],[2,0]],'rightArm.rotation':[[.5,-30],[1,-50],[2,0]]}};
fixture.actors[0].inputs.action='wave';
const keys=()=>saved().then(d=>d.packs.ona.clips.wave.tracks);
const key=(track,time)=>page.locator(`[data-track="${track}"][data-key="${time}"]`);
const input=async(id,value)=>{await page.locator('#keys-'+id).fill(String(value));await page.locator('#keys-'+id).dispatchEvent('input');};
async function compact(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1&&document.documentElement.scrollHeight<=innerHeight+1));const box=await page.locator('.timeline-editor').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=await page.evaluate(()=>innerWidth)+1&&box.y+box.height<=await page.evaluate(()=>innerHeight)+1);assert.ok(await page.locator('#keys-delete').isVisible());}
try{
 await page.goto(base);await page.locator('#art svg').waitFor();await page.locator('#file').setInputFiles({name:'timeline.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await page.locator('#edit-keys').click();
 await key('head.rotation',.5).click();await key('rightArm.rotation',.5).click({modifiers:['Shift']});assert.equal(await page.locator('#keys-count').textContent(),'2 selected');
 const before=await saved();await input('offset',.2);await page.locator('#keys-move').click();assert.equal((await saved()).revision,before.revision+1);assert.deepEqual((await keys())['head.rotation'][1],[.7,10,'linear']);assert.equal((await keys())['rightArm.rotation'][0][0],.7);
 const moved=await keys();await input('offset',.3);await page.locator('#keys-move').click();assert.match(await page.locator('#keys-message').textContent(),/overlap/);assert.deepEqual(await keys(),moved);
 await input('offset',.1);await page.locator('#keys-copy').click();assert.equal((await keys())['head.rotation'].length,5);await input('factor',1.125);await input('pivot',0);await page.locator('#keys-scale').click();assert.equal((await keys())['head.rotation'][2][0],.9);
 await page.locator('#keys-ease').selectOption('step');await page.locator('#keys-easing').click();assert.equal((await keys())['head.rotation'][2][2],'step');
 await page.locator('#keys-delete').click();assert.equal((await keys())['head.rotation'].length,4);await page.locator('#keys-undo').click();assert.equal((await keys())['head.rotation'].length,5);await page.locator('#keys-redo').click();assert.equal((await keys())['head.rotation'].length,4);
 await page.locator('#keys-add').check();await key('head.rotation',.7).click();await key('rightArm.rotation',.7).click();assert.equal(await page.locator('#keys-count').textContent(),'2 selected');
 await page.locator('#keys-filter').fill('head');assert.equal(await page.locator('[data-track-select]').count(),1);await page.locator('#keys-all').click();assert.equal(await page.locator('#keys-count').textContent(),'4 selected');await compact();await page.screenshot({path:'test-results/timeline-keys-desktop.png'});
 await page.locator('#keys-close').click();const durable=await keys();await page.reload();await page.locator('#art svg').waitFor();assert.deepEqual(await keys(),durable);await page.locator('#edit-keys').click();
 for(const [width,height] of [[768,1024],[390,844],[390,667]]){await page.setViewportSize({width,height});await compact();await page.screenshot({path:`test-results/timeline-keys-${width}-${height}.png`});}
 await page.locator('#keys-close').click();await page.locator('#key-time').fill('.4');await page.locator('#key-time').press('Tab');await page.locator('#add-key').click();assert.ok((await keys())['head.rotation'].some(k=>k[0]===.4),'original single-key editor remains usable');
 assert.deepEqual(errors,[]);console.log('Timeline browser checks passed: multi-track move/copy/scale/easing/delete, collision rejection, one revision, undo/redo, touch selection/filter, reload and compact desktop/tablet/phone.');
}finally{await browser.close();}
