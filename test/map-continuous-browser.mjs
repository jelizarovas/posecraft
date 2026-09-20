import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/demos.html#littlelands-map');
 await page.waitForFunction(()=>window.mapDemo?.view.stats().art.loaded===15&&!mapDemo.view.stats().terrainCache.pending);
 const canvas=page.locator('#demo-art canvas');
 await page.evaluate(()=>{mapDemo.view.stopFollowing();mapDemo.view.zoomTo(4);});
 await page.waitForFunction(()=>mapDemo.view.stats().camera.zoom===4&&!mapDemo.view.stats().terrainCache.pending);
 const origin=await page.evaluate(()=>mapDemo.view.controller.actorPosition('hero'));
 const goal={x:origin.x+.34,y:origin.y+.02};
 const position=await page.evaluate(goal=>mapDemo.view.mapToScreen(goal),goal);
 // Pointer coordinates are quantized by Chromium; permit less than 0.1 screen pixel.
 await canvas.tap({position});
 await page.waitForFunction(goal=>{const a=mapDemo.view.controller.actorPosition('hero');return !a.walking&&Math.hypot(a.x-goal.x,a.y-goal.y)<.001;},goal);
 const end=await page.evaluate(()=>mapDemo.view.controller.actorPosition('hero'));
 assert.equal(Math.floor(end.x),Math.floor(origin.x));assert.notEqual(end.x%1,.5);
 await page.evaluate(()=>mapDemo.view.stopFollowing());
 const target={x:goal.x-1,y:goal.y},aim=await page.evaluate(p=>mapDemo.view.mapToScreen(p),target),box=await canvas.boundingBox(),session=await page.context().newCDPSession(page);
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+aim.x,y:box.y+aim.y}]});
 await page.waitForTimeout(450);
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 await page.waitForFunction(()=>mapDemo.events.some(e=>e.type==='map.actor.faced'));
 const faced=await page.evaluate(()=>mapDemo.view.controller.actorPosition('hero'));
 assert.equal(faced.x,end.x);assert.equal(faced.y,end.y);assert.ok(Math.cos(faced.facing)<-.99);assert.equal(faced.phase,end.phase);
 const sprites=await page.evaluate(()=>({clips:mapDemo.map.art.actors.hero,execution:mapDemo.view.controller.stats.execution}));
 assert.equal(sprites.clips.walk.directions,16);assert.equal(sprites.clips.walk.frames,12);assert.equal(sprites.execution,'worker');
 await page.screenshot({path:'test-results/map-continuous-character.png'});
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,exactSubtileTap:true,holdToFace:true,stationaryTurn:true,worker:true,directions:16}));
}finally{await browser.close();}
