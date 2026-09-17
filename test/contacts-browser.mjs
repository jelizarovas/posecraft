import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SceneController} from '../src/scene.js';
import {assertDocument} from '../src/schema.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.setDefaultTimeout(20000);page.on('pageerror',e=>errors.push(e.message));
const fixture=JSON.parse(fs.readFileSync(new URL('../examples/characters/dummy.json',import.meta.url),'utf8'));
fixture.groups=[{id:'cast',name:'Characters',parent:null}];fixture.actors[0].group='cast';
const source=fixture.actors[0].id,pack=fixture.packs[fixture.actors[0].pack];
fixture.actors.push({id:'handle',name:'Handle target',pack:'handle',transform:{x:250,y:220,scale:1,rotation:0},group:'cast',behavior:{mode:'animated'}});
fixture.packs.handle={name:'Handle',joints:[{id:'root',parent:null,x:0,y:0,length:0,rotation:0,min:-180,max:180}],parts:[{id:'dot',joint:'root',d:'M-5-5H5V5H-5Z',fill:'#8844aa'}],clips:{still:{duration:4,loop:true,tracks:{'root.x':[[0,0],[2,8],[4,0]]}}},states:{still:{clip:'still'}},initial:'still',inputs:{}};
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2'))),change=async(id,v)=>{await page.locator('#'+id).fill(String(v));await page.locator('#'+id).dispatchEvent('change');};
const selectActor=async id=>{await page.locator('#scene-workspace').click();await page.locator(`[data-scene-kind="actor"][data-scene-id="${id}"]`).click();};
try{
 await page.goto(base);await page.locator('#art svg').waitFor();await page.locator('#file').setInputFiles({name:'contacts.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await selectActor(source);await page.locator('#scene-contacts').click();await page.locator('#contact-add').click();await page.locator('#contact-end').waitFor();
 let d=await saved();assert.equal(d.contacts.length,1);assert.equal(d.contacts[0].chain.end,'leftFoot');assert.ok(d.requiredFeatures.includes('contacts'));const originalX=d.contacts[0].target.x;
 await change('contact-x',originalX+8);d=assertDocument(await saved());const c=new SceneController(d),f=c.frame(),diagnostic=f.contacts[0];assert.ok(diagnostic.active);assert.ok(Number.isFinite(diagnostic.error));assert.ok(diagnostic.error<2,'reachable authored foot target is solved');c.dispose();
 await page.waitForFunction(()=>document.querySelector('[data-contact-guide]'));await page.screenshot({path:'test-results/contacts-studio.png'});
 await change('contact-weight',.5);assert.equal((await saved()).contacts[0].weight,.5);await page.locator('#undo').click();assert.equal((await saved()).contacts[0].weight,1);await page.locator('#redo').click();assert.equal((await saved()).contacts[0].weight,.5);
 await page.locator('#contact-end').selectOption('leftHand');await page.locator('#contact-target-actor').selectOption('handle');await page.locator('#contact-target-joint').selectOption('root');await change('contact-x',3);await change('contact-y',-2);await change('contact-start',.5);await change('contact-end-time',1.5);await page.locator('#contact-clip').selectOption('idle');d=await saved();assert.deepEqual(d.contacts[0].target,{type:'joint',actor:'handle',joint:'root',offsetX:3,offsetY:-2});assert.equal(d.contacts[0].clip,'idle');
 const engine=new SceneController(d);assert.equal(engine.seek(.1).contacts[0].active,false);assert.equal(engine.seek(.75).contacts[0].active,true);assert.equal(engine.seek(2).contacts[0].active,false);engine.dispose();
 await page.reload();await page.locator('#art svg').waitFor();await selectActor(source);await page.locator('#scene-contacts').click();assert.equal(await page.locator('#contact-target-actor').inputValue(),'handle');assert.equal(await page.locator('#contact-start').inputValue(),'.5'.replace(/^\./,'0.'));
 const download=page.waitForEvent('download');await page.locator('#save').click();const output='test-results/contact-project.json';await(await download).saveAs(output);assert.equal(assertDocument(JSON.parse(fs.readFileSync(output))).contacts[0].target.actor,'handle');
 for(const size of [{width:1024,height:700},{width:390,height:844}]){await page.setViewportSize(size);if(size.width<600)await page.locator('#inspector-panel').click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:`test-results/contacts-${size.width}.png`});}
 await page.setViewportSize({width:1366,height:768});await selectActor('handle');await page.locator('#scene-edit-entity').click();await page.locator('#delete').click();assert.equal((await saved()).contacts.length,0,'deleting target cleans dependent contacts');await page.locator('#undo').click();assert.equal((await saved()).contacts.length,1);
 assert.deepEqual(errors,[]);console.log('Contact authoring passed: point/joint targets, live solve and guides, clip windows, undo/reload/export, target cleanup and compact layouts.');
}finally{await browser.close();}
