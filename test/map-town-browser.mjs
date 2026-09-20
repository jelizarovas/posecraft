import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1100,height:760}}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:5246/play.html');await page.waitForFunction(()=>window.mapPlay?.townLife);
 await page.evaluate(()=>mapPlay.view.ready);
 const before=await page.evaluate(()=>mapPlay.view.controller.frame().actors.map(a=>({id:a.id,x:a.x,y:a.y})));
 await page.waitForTimeout(3500);
 const after=await page.evaluate(()=>({actors:mapPlay.view.controller.frame().actors,tracking:mapPlay.view.cameraTracking(),art:mapPlay.view.stats().art,frame:mapPlay.view.controller.visibleFrame({x:-1000,y:0,width:3000,height:3000},[],{routeActor:'hero'})}));
 assert.equal(after.art.failed,0);assert.equal(after.art.loaded,after.art.requested);
 assert.equal(after.tracking.following,false,'Residents do not steal the camera');
 assert.equal(after.frame.destination,null,'Residents do not draw the player route');
 assert.ok(after.actors.filter(a=>a.id!=='hero'&&Math.hypot(a.x-before.find(b=>b.id===a.id).x,a.y-before.find(b=>b.id===a.id).y)>.1).length>=2,'Residents run independent routines while others may work or rest');
 await mkdir('test-results',{recursive:true});
 await page.evaluate(()=>{mapPlay.view.zoomTo(1.2);mapPlay.view.panTo(58,64);});await page.waitForTimeout(1200);
 await page.screenshot({path:'test-results/map-town-overview.png'});
 await page.evaluate(async()=>{await mapPlay.view.moveTo('hero','village-house');});
 assert.equal(await page.evaluate(()=>mapPlay.view.cameraTracking().actor),'hero');
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>mapPlay.view.zoomTo(2.5));await page.waitForTimeout(700);
 await page.screenshot({path:'test-results/map-town-mobile.png'});
 await page.evaluate(()=>{mapPlay.townLife.dispose();mapPlay.view.controller.cancel('hero');});
 assert.deepEqual(errors,[]);console.log('Passed: town art, NPC walking, player-only camera/routes, inn approach, mobile render and disposal.');
}finally{await browser.close();}
