import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {woodlandArt} from '../examples/woodland-map.js';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/play.html');
 await page.waitForFunction(()=>window.mapPlay);
 await page.evaluate(()=>mapPlay.view.ready);
 assert.ok(await page.evaluate(()=>['showcase-branch','showcase-fence','showcase-ridge'].every(id=>mapPlay.map.props.some(p=>p.id===id))));
 await page.evaluate(async art=>{
  const {mountMap}=await import('/src/map-browser.js'),{editorImages,propBrushes}=await import('/examples/map-editor-catalog.js');
  mapPlay.townLife?.dispose();mapPlay.view.dispose();
  const prop=(id,x,y)=>({id,...structuredClone(propBrushes.find(b=>b.id===id).prop),x,y});
  const map={format:'posecraft-map',version:1,id:'crossing-browser',name:'Crossings',seed:1,width:24,height:24,tileSize:{width:48,height:24},navigation:{mode:'continuous',radius:.12},terrain:Array(576).fill(0),props:[prop('branches',4,4),prop('fence',8,8),prop('ridge',14,14)],actors:[{id:'hero',x:2.5,y:4.5,speed:3,stride:2.4}],art};
  Object.assign(map.art.images,editorImages);
  map.elevations=Array.from({length:625},(_,i)=>Math.max(0,Math.min(.8,(16-Math.floor(i/25))*.4)));
  window.mapPlay={map,view:mountMap(document.querySelector('#game'),map,{execution:'worker',onEvent:e=>(window.crossingEvents??=[]).push(e),onError:e=>{if(e.name!=='AbortError')throw e;}})};
  await mapPlay.view.ready;await mapPlay.view.controller.ready;mapPlay.view.zoomTo(3);mapPlay.view.focusActor('hero');
  window.pauseAction=()=>new Promise((resolve,reject)=>{const end=performance.now()+15000;const poll=()=>{const a=mapPlay.view.controller.actorPosition('hero');if(a.traversalAction&&a.traversalProgress>=.4){mapPlay.view.pause();resolve(a);}else if(performance.now()>end)reject(Error('No traversal reached its contact pose'));else requestAnimationFrame(poll);};poll();});
  window.placeHero=(x,y)=>{const state=mapPlay.view.controller.snapshot();Object.assign(state.actors[0],{x,y});mapPlay.view.controller.restore(state);mapPlay.view.focusActor('hero');mapPlay.view.play();};
 },structuredClone(woodlandArt));
 await page.evaluate(()=>{mapPlay.view.moveTo('hero',{x:6.5,y:4.5}).catch(()=>{});});
 const branch=await page.evaluate(()=>pauseAction());
 assert.equal(branch.traversalAction,'vault');assert.ok(branch.supportContact);
 await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/map-branch-contact.png'});
 await page.evaluate(()=>mapPlay.view.play());
 await page.waitForFunction(()=>!mapPlay.view.controller.active.size);
 // A real pointer click on the fence must reach its manual crossing action.
 await page.evaluate(()=>placeHero(9.5,9.7));
 await page.waitForTimeout(100);
 const click=await page.evaluate(()=>mapPlay.view.mapToScreen({x:9.5,y:8.5,z:.55+.8}));
 await page.screenshot({path:'test-results/map-fence-before.png'});
 await page.touchscreen.tap(click.x,click.y);
 let fence;try{fence=await page.evaluate(()=>pauseAction());}catch(error){console.log('Fence click',click,await page.evaluate(()=>({events:crossingEvents.slice(-8),actor:mapPlay.view.controller.actorPosition('hero')})));throw error;}
 assert.equal(fence.traversalAction,'vault');
 await page.screenshot({path:'test-results/map-fence-contact.png'});
 await page.evaluate(()=>mapPlay.view.play());
 await page.waitForFunction(()=>!mapPlay.view.controller.active.size);
 // Check the same ridge from each side against actual terrain elevations.
 for(const action of ['climb-up','climb-down']){
  await page.evaluate(action=>{const ridge=mapPlay.map.props.find(p=>p.id==='ridge'),points=ridge.traversal.endpoints.map(p=>({x:p.x+ridge.x,y:p.y+ridge.y})),entry=points.sort((a,b)=>a.y-b.y)[action==='climb-up'?1:0];placeHero(entry.x,entry.y);mapPlay.view.moveTo('hero','ridge').catch(()=>{});},action);
  const actor=await page.evaluate(()=>pauseAction());assert.equal(actor.traversalAction,action);
  await page.screenshot({path:`test-results/map-${action}.png`});
  await page.evaluate(()=>mapPlay.view.play());await page.waitForFunction(()=>!mapPlay.view.controller.active.size);
 }
 const idle=await page.evaluate(()=>{const f=mapPlay.view.controller.frame();return {destination:f.destination,actor:f.actors[0],art:mapPlay.view.stats().art};});
 assert.equal(idle.destination,null);assert.equal(idle.actor.traversalAction,null);assert.equal(idle.art.failed,0);
 assert.deepEqual(errors,[]);
 console.log('Passed: worker branches, actual fence click, up/down ridge action artwork, completion and cleared destination.');
}finally{await browser.close();}
