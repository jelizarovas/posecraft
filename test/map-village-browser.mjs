import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://localhost:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});

await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.routeWebSocket(/.*/,socket=>socket.close());
 await page.goto(base+'/play.html');
 await page.waitForFunction(()=>window.mapPlay?.view&&window.mapPlay?.townLife?.state);
 await page.evaluate(()=>mapPlay.view.ready);
 await page.waitForFunction(()=>{
  const stats=mapPlay.view.stats(),art=stats.art;
  return art.requested>0&&art.loaded===art.requested&&!stats.terrainCache?.pending&&!stats.sceneryCache?.pending;
 },null,{timeout:60000,polling:100});

 const population=await page.evaluate(()=>({
  actors:mapPlay.map.actors,
  livestockProps:mapPlay.map.props.filter(prop=>['farm-sheep','farm-cow','farm-chicken'].includes(prop.art)),
  art:mapPlay.view.stats().art,
  life:mapPlay.townLife.state()
 }));
 assert.deepEqual(population.art.failed,0,'Village art loads without failed images');
 assert.equal(population.actors.length,17,'The village has a hero and sixteen living residents');
 const hero=population.actors.find(actor=>actor.id==='hero');
 assert.ok(hero,'The player remains part of the village map');
 const residents=population.actors.filter(actor=>actor.id!=='hero');
 const adults=residents.filter(actor=>actor.npc?.species==='human');
 const children=residents.filter(actor=>actor.npc?.species==='child');
 const sheep=residents.filter(actor=>actor.npc?.species==='sheep');
 const cows=residents.filter(actor=>actor.npc?.species==='cow');
 const chickens=residents.filter(actor=>actor.npc?.species==='chicken');
 assert.equal(adults.length,6,'Six adult villagers are actors');
 assert.equal(children.length,2,'Two children are actors');
 assert.equal(sheep.length,3,'Three sheep are actors');
 assert.equal(cows.length,2,'Two cows are actors');
 assert.equal(chickens.length,3,'Three chickens are actors');
 assert.equal(population.livestockProps.length,0,'Livestock no longer exists as duplicate static props');

 const visualSignature=actor=>JSON.stringify(actor.appearance??actor.npc?.appearance??{color:actor.color,scale:actor.scale,variant:actor.variant});
 assert.equal(new Set(adults.map(visualSignature)).size,adults.length,'Every adult villager has a distinct appearance');
 assert.equal(new Set(children.map(visualSignature)).size,children.length,'The children have distinct appearances');

 const lifeActors=population.life.actors;
 assert.ok(lifeActors&&typeof lifeActors==='object','Village life reports actor state');
 assert.deepEqual(Object.keys(lifeActors).sort(),residents.map(actor=>actor.id).sort(),'Village life owns every non-player actor');
 for(const [id,state] of Object.entries(lifeActors)){
  assert.equal(typeof state.action,'string',`${id} reports its current action`);
  assert.ok(state.target===null||Number.isFinite(state.target?.x)&&Number.isFinite(state.target?.y),`${id} reports a null or finite target`);
  assert.equal(typeof state.moving,'boolean',`${id} reports whether its routine is moving`);
 }

 const before=await page.evaluate(()=>({
  hero:mapPlay.view.controller.actorPosition('hero'),
  camera:mapPlay.view.snapshot().camera,
  residents:Object.fromEntries(mapPlay.map.actors.filter(actor=>actor.id!=='hero').map(actor=>[actor.id,mapPlay.view.controller.actorPosition(actor.id)]))
 }));
 await page.waitForTimeout(8000);
 const after=await page.evaluate(()=>({
  hero:mapPlay.view.controller.actorPosition('hero'),
  camera:mapPlay.view.snapshot().camera,
  residents:Object.fromEntries(mapPlay.map.actors.filter(actor=>actor.id!=='hero').map(actor=>[actor.id,mapPlay.view.controller.actorPosition(actor.id)])),
  life:mapPlay.townLife.state()
 }));
 const moved=adults.concat(children).filter(actor=>{
  const a=before.residents[actor.id],b=after.residents[actor.id];
  return Math.hypot(a.x-b.x,a.y-b.y)>.15;
 });
 assert.ok(moved.length>=2,`Expected at least two villagers to change position in eight seconds, saw ${moved.map(actor=>actor.id).join(', ')||'none'}`);
 assert.equal(after.hero.x,before.hero.x,'Village routines do not move the hero on x');
 assert.equal(after.hero.y,before.hero.y,'Village routines do not move the hero on y');
 assert.deepEqual(after.camera,before.camera,'Village routines do not move or retarget the camera');
 assert.ok(Object.values(after.life.actors).some(state=>state.action!=='idle'),'Village state reflects an active routine');

 const center=(actors,fallback)=>actors.length?{
  x:actors.reduce((sum,actor)=>sum+after.residents[actor.id].x,0)/actors.length,
  y:actors.reduce((sum,actor)=>sum+after.residents[actor.id].y,0)/actors.length
 }:fallback;
 for(const [name,point,zoom] of [
  ['farmland',{x:35,y:48},2.25],
  ['pastures',center([...sheep,...cows],{x:70,y:82}),2.7],
  ['children',center(children,{x:64,y:64}),3.2]
 ]){
  await page.evaluate(({point,zoom})=>{mapPlay.view.zoomTo(zoom);mapPlay.view.panTo(point.x,point.y);},{point,zoom});
  await page.waitForTimeout(500);
  await page.waitForFunction(()=>!mapPlay.view.stats().terrainCache?.pending&&!mapPlay.view.stats().sceneryCache?.pending);
  await page.screenshot({path:`test-results/map-village-${name}.png`});
 }

 assert.deepEqual(errors,[],'Village play produces no page errors');
 console.log(JSON.stringify({passed:true,population:{adults:adults.length,children:children.length,sheep:sheep.length,cows:cows.length,chickens:chickens.length},moved:moved.map(actor=>actor.id),actions:Object.fromEntries(Object.entries(after.life.actors).map(([id,state])=>[id,state.action]))},null,2));
 await page.evaluate(()=>{mapPlay.townLife.dispose();mapPlay.view.dispose();});
}finally{
 await browser.close();
}
