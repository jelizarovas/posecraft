import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/play.html');
 await page.waitForFunction(()=>window.mapPlay);
 await page.evaluate(async()=>{
  mapPlay.view.dispose();
  const {mountMap}=await import('/src/map-browser.js');
  const map={format:'posecraft-map',version:1,id:'run-retarget',name:'Run retarget',width:64,height:64,seed:1,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(4096).fill(0),props:[],actors:[{id:'hero',x:32,y:32,speed:2}]};
  window.events=[];window.view=mountMap(document.querySelector('#game'),map,{reducedMotion:false,onEvent:e=>events.push(e)});
  await view.controller.ready;await view.ready;
 });
 const tap=async(x,y)=>{
  const p=await page.evaluate(({x,y})=>view.mapToScreen({x,y}),{x,y});
  await page.touchscreen.tap(p.x,p.y);
 };
 await tap(28,32);await tap(28,32);
 await page.waitForFunction(()=>view.controller.actorPosition('hero').running);
 await page.waitForTimeout(360);
 const beforeTurn=await page.evaluate(()=>view.controller.actorPosition('hero'));
 await tap(32,36);
 assert.equal(await page.evaluate(()=>events.filter(e=>e.type==='map.move.started').at(-1).gait),'run','Single tap preserves running');
 assert.equal(await page.evaluate(()=>view.controller.actorPosition('hero').skidding),true,'Running retarget starts braking');
 await page.waitForTimeout(70);
 assert.ok(await page.evaluate(x=>view.controller.actorPosition('hero').x<x,beforeTurn.x),'The character briefly continues left despite the new destination to the right');
 // Repeated retargeting also preserves the requested gait while a new route is pending.
 await tap(35,32);
 assert.equal(await page.evaluate(()=>events.filter(e=>e.type==='map.move.started').at(-1).gait),'run');
 await page.waitForFunction(()=>events.some(e=>e.type==='map.actor.arrived'&&e.gait==='run'&&Math.abs(e.x-35)<.01),null,{timeout:15000});
 assert.equal(await page.evaluate(()=>view.controller.actorPosition('hero').running),false);
 await tap(34,32);
 assert.equal(await page.evaluate(()=>events.filter(e=>e.type==='map.move.started').at(-1).gait),'walk','A new journey after stopping defaults to walking');
 assert.deepEqual(errors,[]);
 console.log('Passed: touch run, single-tap retargets, repeated retargets, and walking after arrival.');
}finally{await browser.close();}
