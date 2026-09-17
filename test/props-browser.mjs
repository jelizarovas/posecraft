import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'no-preference'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,'');
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')));
try{
 await page.goto(base);await page.getByRole('button',{name:'Add Dummy',exact:true}).click();
 const dummy=(await saved()).actors.find(a=>a.pack==='dummy');assert.ok(dummy);
 await page.locator('#delete').click(); // Test a clean dummy scene through the supported import path.
 await page.locator('#file').setInputFiles({name:'dummy.json',mimeType:'application/json',buffer:fs.readFileSync('examples/characters/dummy.json')});
 await page.locator('#reset').click();await page.locator('#bones').click();
 await page.getByRole('button',{name:'Add prop',exact:true}).click();
 await page.locator('#prop-name').fill('Landing pad');await page.locator('#prop-name').press('Tab');
 await page.locator('#prop-width').fill('300');await page.locator('#prop-width').press('Tab');
 await page.locator('#prop-box').click();await page.locator('#fit-box').click();
 await page.locator('#box-width').fill('260');await page.locator('#box-width').press('Tab');
 assert.equal((await saved()).props[0].collider.width,260);await page.locator('#undo').click();assert.equal((await saved()).props[0].collider.width,300);await page.locator('#redo').click();
 await page.locator('#box-x').fill('12');await page.locator('#box-x').press('Tab');
 await page.locator('#prop-enabled').uncheck();assert.equal((await saved()).props[0].collider.enabled,false);await page.locator('#prop-enabled').check();
 const before=(await saved()).props[0],box=await page.locator('#art [data-prop] rect').first().boundingBox();
 await page.mouse.move(box.x+box.width*.85,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width*.85+24,box.y+box.height/2-15,{steps:8});await page.mouse.up();
 const after=(await saved()).props[0];assert.ok(after.x>before.x+10);assert.ok(after.y<before.y-5);
 await page.locator('#undo').click();assert.equal((await saved()).props[0].x,before.x);
 await page.locator('#prop-shape').click();await page.locator('#prop-rotation').fill('-8');await page.locator('#prop-rotation').press('Tab');
 await page.screenshot({path:'test-results/dummy-props.png'});
 const download=page.waitForEvent('download');await page.locator('#export').click();await(await download).saveAs('test-results/props-roundtrip.json');
 await page.locator('#file').setInputFiles('test-results/props-roundtrip.json');assert.equal((await saved()).props[0].rotation,-8);
 await page.locator('[data-panel="feel"]').click();await page.locator('#motion-policy').selectOption('full');await page.locator('#body-mode').selectOption('protective');await page.locator('[data-interact="drop"]').click();await page.waitForTimeout(1300);
 assert.equal(await page.locator('#art [data-actor="dummy"]').getAttribute('data-motion-mode'),'protective');
 await page.screenshot({path:'test-results/dummy-fall.png'});
 for(const viewport of [{width:1024,height:700},{width:390,height:844}]){
  await page.setViewportSize(viewport);if(viewport.width<650){await page.locator('#scene-panel').click();}
  await page.locator('#props').selectOption((await saved()).props[0].id);
  if(viewport.width<650)await page.locator('#inspector-panel').click();
  await page.locator('#prop-box').click();const b=await page.locator('#remove-prop').boundingBox(),edge=await page.locator('.timeline').boundingBox();assert.ok(b.y+b.height<edge.y,'prop controls fit without scrolling');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+1));
 }
 await page.setViewportSize({width:1366,height:768});await page.goto(base+'/react-demo.html');await page.getByLabel('Demo character').selectOption('dummy');await page.getByLabel('Demo props').check();assert.equal(await page.locator('[data-prop]').count(),2);
 await page.getByLabel('Demo action').selectOption('wave');await page.getByRole('button',{name:'Drop',exact:true}).click();await page.waitForTimeout(1200);assert.equal(await page.locator('[data-actor="dummy"]').getAttribute('data-motion-mode'),'protective');
 assert.deepEqual(errors,[]);console.log('Dummy and props browser checks passed.');
}finally{await browser.close();}
