import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5189').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/test-results/grip-worker',r=>r.fulfill({contentType:'text/html',body:'<main id="panel"></main>'}));await page.goto(base+'/test-results/grip-worker');
 await page.evaluate(async()=>{
  const [{createCatch},{WorkerSceneController},{createObjectTools}]=await Promise.all([import('/examples/catch.js'),import('/src/worker.js'),import('/studio/object-tools.js')]);
  const doc=createCatch();doc.objectGames=[];doc.actors[1].transform={...doc.actors[0].transform};const controller=new WorkerSceneController(doc);await controller.ready;await new Promise(resolve=>{controller.onFrame=()=>{controller.onFrame=null;resolve();};controller.step(1/120);});
  const receive=controller.receive.bind(controller);controller.receive=m=>m.type==='frame'?setTimeout(()=>receive(m),150):receive(m);
  window.qa={doc,controller,messages:[]};const panel=createObjectTools({getDocument:()=>window.qa.doc,getController:()=>controller,notify:m=>window.qa.messages.push(m),commit:commands=>{for(const c of commands)window.qa.doc[c.path[0]]=c.value;}});window.qa.panel=panel;panel.render(document.getElementById('panel'));
 });
 await page.locator('#object-owner').selectOption('fern');await page.locator('#object-joint').selectOption('rightWrist');await page.locator('#object-transfer-from').selectOption('pip');await page.locator('#object-transfer').click();
 assert.match(await page.locator('#object-live-owner').textContent(),/Waiting/);assert.equal(await page.evaluate(()=>qa.messages.length),0);assert.ok(await page.locator('#object-transfer').isDisabled());
 await page.waitForFunction(()=>qa.messages.length===1);assert.equal(await page.evaluate(()=>qa.messages[0]),'Object command applied.');assert.match(await page.locator('#object-live-owner').textContent(),/fern \/ rightWrist/);
 // Valid owner but distant receiving grip: only the acknowledged result rejects it.
 await page.evaluate(()=>{qa.controller.previewClip('pip','idle',0,{'root.x':-150});});await page.waitForFunction(()=>!qa.controller.inFlight&&!qa.controller.queue.length);
 await page.locator('#object-owner').selectOption('pip');await page.locator('#object-joint').selectOption('rightWrist');await page.locator('#object-transfer-from').selectOption('fern');await page.locator('#object-transfer').click();assert.match(await page.locator('#object-live-owner').textContent(),/Waiting/);await page.waitForFunction(()=>qa.messages.length===2);assert.match(await page.evaluate(()=>qa.messages[1]),/Grip unchanged/);assert.equal(await page.evaluate(()=>qa.controller.frame().objects[0].owner.actor),'fern');
 await page.locator('#object-drop').click();await page.waitForFunction(()=>qa.messages.length===3);assert.match(await page.locator('#object-live-owner').textContent(),/none/);assert.equal(await page.evaluate(()=>qa.messages[2]),'Object command applied.');
 const small=await page.evaluate(async()=>{
  qa.controller.dispose();const {createCatch}=await import('/examples/catch.js');const results=[];
  for(const size of [800,80,20,10]){qa.doc=createCatch();qa.doc.bounds={...qa.doc.bounds,width:size,height:size===800?450:size};qa.doc.objectGames[0].navigation=null;qa.panel.render(document.getElementById('panel'));document.getElementById('object-navigation-enabled').click();results.push({size,navigation:qa.doc.objectGames[0].navigation,checked:document.getElementById('object-navigation-enabled').checked,message:qa.messages.at(-1)});}
  return results;
 });
 for(const {size,navigation:n} of small.slice(0,3)){assert.ok(n,`navigation in ${size}px scene`);assert.ok(Math.min(n.bounds.width,n.bounds.height)>2*n.clearance+n.cellSize*Math.SQRT2);assert.ok(n.bounds.x+n.bounds.width<=size);assert.ok(Object.values(n.bounds).every(Number.isFinite));}
 assert.equal(small[3].checked,false);assert.match(small[3].message,/too small/);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,workerAck:true,rejectedTransfer:true,releaseAck:true,smallNavigationDefaults:true,nullNavigationSafe:true}));
}finally{await browser.close();}
