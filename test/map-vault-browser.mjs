import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {woodlandArt} from '../examples/woodland-map.js';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const art=structuredClone(woodlandArt);
 for(const name of ['jump','roll']){delete art.actors.hero[name];delete art.images['adventurer-'+name];}
 const map={format:'posecraft-map',version:1,id:'vault-browser',name:'Vault review',seed:1,width:16,height:16,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(256).fill(0),props:[{id:'rock',kind:'rock',x:5,y:5,width:1,height:1,collision:{shape:'circle',radius:.25},traversal:{kind:'vault',height:.5}}],actors:[{id:'hero',x:3.25,y:5.5,speed:3,stride:2.4}],art};
 const page=await browser.newPage({viewport:{width:620,height:620}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(map=>localStorage.setItem('posecraft-map-editor-draft-v1',JSON.stringify(map)),map);
 await page.goto(base+'/play.html?draft=1');
 await page.waitForFunction(()=>window.mapPlay);
 await page.evaluate(()=>mapPlay.view.ready);
 assert.equal(await page.evaluate(()=>mapPlay.map.art.actors.hero.roll.frames),16,'Old draft gains stock traversal artwork');
 await page.evaluate(()=>{
  window.traversalEvents=[];mapPlay.view.controller.subscribe(e=>traversalEvents.push(e));
  window.pauseTraversalAt=(field,min)=>new Promise(resolve=>{const poll=()=>{const a=mapPlay.view.controller.actorPosition('hero');if((field==='jumpProgress'?a.jumping:a.rolling)&&a[field]>=min){mapPlay.view.pause();resolve(a);}else requestAnimationFrame(poll);};poll();});
  mapPlay.view.moveTo('hero',{x:10,y:5.5},{gait:'run'}).catch(()=>{});
 });
 const jump=await page.evaluate(()=>pauseTraversalAt('jumpProgress',.4));
 assert.ok(jump.lift>.5);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/map-vault-jump.png'});
 await page.evaluate(()=>{mapPlay.view.moveTo('hero',{x:2,y:10},{gait:'run'}).catch(()=>{});mapPlay.view.play();});
 const roll=await page.evaluate(()=>pauseTraversalAt('rollProgress',.45));
 assert.ok(roll.x>jump.x);assert.equal(roll.facing,jump.facing);assert.equal(roll.lift,0);
 await page.screenshot({path:'test-results/map-vault-roll.png'});
 await page.evaluate(()=>mapPlay.view.play());
 await page.waitForFunction(()=>traversalEvents.some(e=>e.type==='map.actor.arrived'&&e.x===2&&e.y===10),null,{timeout:20000});
 const events=await page.evaluate(()=>traversalEvents);
 assert.ok(events.some(e=>e.type==='map.roll.finished'));assert.equal(events.at(-1).gait,'run');assert.deepEqual(errors,[]);
 console.log('Passed: old draft artwork upgrade, airborne run, momentum roll, recovery, worker replan and arrival.');
}finally{await browser.close();}
