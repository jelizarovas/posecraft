import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createGameExample} from '../examples/game-scene.js';
import {assertDocument} from '../src/schema.js';
import {describeGameScene} from '../src/game-bindings.js';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5196').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const page=await browser.newPage({viewport:{width:1366,height:900},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')));
const change=async(id,value)=>{await page.locator('#game-'+id).fill(String(value));await page.locator('#game-'+id).dispatchEvent('change');};
const open=async()=>{await page.locator('#scene-workspace').click();await page.locator('#scene-game').click();};
const choose=(id,value)=>page.locator('#game-'+id).selectOption(value);
try{
 await page.goto(base+'/');await page.locator('#art svg').waitFor();await page.locator('#file').setInputFiles({name:'game.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(createGameExample()))});await open();
 assert.equal(await page.locator('#game-actor').inputValue(),'shopkeeper');
 await choose('alias','notice');await change('alias-name','observe');assert.equal((await saved()).game.actors.shopkeeper.reactions.surprise.action,'observe');
 await page.locator('#undo').click();assert.equal((await saved()).game.actors.shopkeeper.actions.observe,undefined);assert.equal((await saved()).game.actors.shopkeeper.reactions.surprise.action,'notice');await page.locator('#redo').click();await choose('alias','observe');
 await page.locator('#game-alias-remove').click();assert.match(await page.locator('#game-error').textContent(),/reactions using this alias/);assert.equal((await saved()).game.actors.shopkeeper.actions.observe,'nod');
 await choose('reaction','surprise');await choose('reaction-action','nod');await page.locator('#game-alias-remove').click();assert.equal((await saved()).game.actors.shopkeeper.actions.observe,undefined);
 await page.locator('#game-alias-add').click();await change('alias-name','greet');await choose('alias-clip','wave');await page.locator('#game-reaction-add').click();await change('reaction-name','welcome');await choose('reaction-action','greet');await choose('reaction-emotion','happy');
 await choose('gaze','head');await change('gaze-angle',18);await page.locator('#game-speech').uncheck();await choose('locomotion','planar');assert.ok((await saved()).game.actors.shopkeeper.locomotion.clip);await change('speed',90);await change('clearance',14);await change('cellSize',24);
 const revision=(await saved()).revision;await change('speed',0);assert.equal((await saved()).revision,revision);assert.match(await page.locator('#game-error').textContent(),/Speed/);await change('speed',90);
 await choose('actor','friend');await choose('locomotion','float');await change('speed',65);await page.locator('#game-speech').check();
 await page.locator('#game-tab-anchors').click();await page.locator('#game-anchor-add').click();await change('anchor-name','shop.arrival');await change('anchor-x',420);await change('anchor-y',310);
 await choose('anchor-type','joint');await choose('anchor-actor','shopkeeper');await choose('anchor-joint','head');await change('anchor-offsetX',7);await change('anchor-offsetY',-4);
 assert.deepEqual((await saved()).game.anchors['shop.arrival'],{type:'joint',actor:'shopkeeper',joint:'head',offsetX:7,offsetY:-4});
 await choose('anchor-type','object');await choose('anchor-node','shop-light');await change('anchor-offsetX',5);await page.locator('#game-anchor-add').click();await change('anchor-name','door.handle');await choose('anchor-type','prop');await choose('anchor-node','door');await change('anchor-offsetY',10);
 const beforeInvalid=(await saved()).revision;await change('anchor-name','constructor');assert.equal((await saved()).revision,beforeInvalid);assert.match(await page.locator('#game-error').textContent(),/name starting/);await change('anchor-name','door.handle');await change('anchor-name','shop.arrival');assert.equal((await saved()).revision,beforeInvalid);assert.match(await page.locator('#game-error').textContent(),/already exists/);
 await choose('anchor','home');await page.locator('#game-anchor-remove').click();assert.equal((await saved()).game.anchors.home,undefined);await page.locator('#undo').click();assert.ok((await saved()).game.anchors.home);
 const expected=await saved();assertDocument(expected);const caps=describeGameScene(expected);assert.equal(caps.actors.find(a=>a.id==='friend').locomotion,'float');assert.ok(caps.actors.find(a=>a.id==='shopkeeper').reactions.includes('welcome'));
 const download=page.waitForEvent('download');await page.locator('#save').click();const file=await download;const bytes=await fs.readFile(await file.path());assert.deepEqual(JSON.parse(bytes).game,expected.game);
 await page.reload();await open();await page.locator('#game-tab-anchors').click();await choose('anchor','door.handle');assert.equal(await page.locator('#game-anchor-node').inputValue(),'door');assert.equal(await page.locator('#game-anchor-offsetY').inputValue(),'10');
 // Reopen the saved file after replacing the current document, not just the draft.
 await page.locator('#file').setInputFiles({name:'original.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(createGameExample()))});await page.locator('#file').setInputFiles({name:'saved-game.json',mimeType:'application/json',buffer:bytes});assert.deepEqual((await saved()).game,expected.game);await open();await page.locator('#game-tab-actors').click();await choose('actor','friend');assert.equal(await page.locator('#game-locomotion').inputValue(),'float');assert.equal(await page.locator('#game-speed').inputValue(),'65');
 await page.screenshot({path:'test-results/game-studio-desktop.png'});await page.setViewportSize({width:390,height:844});await page.locator('#inspector-panel').click();await page.locator('#game-locomotion').scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:'test-results/game-studio-mobile.png'});
 await page.setViewportSize({width:1366,height:900});const unbound=createGameExample();delete unbound.game;unbound.requiredFeatures=unbound.requiredFeatures.filter(f=>f!=='game-bindings');await page.locator('#file').setInputFiles({name:'unbound.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(unbound))});await open();await page.locator('#game-tab-anchors').click();await page.locator('#game-anchor-add').click();assert.ok((await saved()).requiredFeatures.includes('game-bindings'));assert.equal(Object.keys((await saved()).game.anchors).length,1);await page.locator('#undo').click();assert.equal((await saved()).game,undefined);assert.ok(!(await saved()).requiredFeatures.includes('game-bindings'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,aliasesAndReactions:true,referencePreservingRename:true,gazeSpeech:true,planarAndFloat:true,allAnchorTypes:true,undo:true,invalidAtomic:true,saveReopen:true,newBindings:true,mobileFit:true}));
}finally{await browser.close();}
