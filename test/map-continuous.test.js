import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {MapIndex} from '../src/map.js';
import {MapNavigationJob} from '../src/map-navigation.js';
import {continuousSegmentClear} from '../src/map-collision.js';
const fixture=()=>({format:'posecraft-map',version:1,id:'continuous',name:'Continuous movement',seed:1,width:16,height:16,tileSize:{width:64,height:32},navigation:{mode:'continuous',radius:.12},terrain:Array(256).fill(0),props:[],actors:[{id:'hero',x:3.25,y:5.5,speed:3,stride:2.4}]});
async function drive(c,until=()=>!c.active.size){for(let i=0;i<10000&&!until();i++){c.advance(1/60);if(i%12===0)await new Promise(r=>setTimeout(r,0));}assert.ok(until(),'movement must settle');}
test('exact sub-tile steps and turn-only actions preserve continuous positions',async()=>{
 const c=new MapController(fixture(),{execution:'main'});
 try{
  const done=c.moveTo('hero',{x:3.31,y:5.43});await drive(c);await done;let a=c.actorPosition('hero');assert.equal(a.x,3.31);assert.equal(a.y,5.43);
  const phase=a.phase;const turn=c.faceTo('hero',{x:2,y:5.43});assert.equal(c.actorPosition('hero').turning,true);await drive(c);await turn;
  a=c.actorPosition('hero');assert.equal(a.x,3.31);assert.equal(a.y,5.43);assert.ok(Math.abs(Math.sin(a.facing))<1e-6&&Math.cos(a.facing)<0);assert.equal(a.phase,phase);
  const saved=c.snapshot();c.restore(saved);assert.equal(c.actorPosition('hero').facing,a.facing);
 }finally{c.dispose();}
});
test('a trunk uses a small curved detour inside its tile; walls remain solid',()=>{
 const map=fixture();map.props=[{id:'trunk',kind:'tree',x:5,y:5,width:1,height:1,collision:{shape:'circle',radius:.24}}];const index=new MapIndex(map);
 const job=new MapNavigationJob(map,index,map.actors[0],{x:7.2,y:5.5});while(job.result.status==='pending')job.step(64);
 assert.equal(job.result.status,'complete');const path=job.result.path;
 assert.ok(path.every(p=>Math.abs(p.y-5.5)<.7),'No whole-tile detour around a narrow trunk');
 assert.ok(path.slice(1).every((p,i)=>continuousSegmentClear(index,path[i],p,.12)));
 assert.equal(index.isPointBlocked(5.1,5.1),false);assert.equal(index.isPointBlocked(5.5,5.5),true);
 map.props[0].collision=undefined;const walls=new MapIndex(map);assert.equal(walls.isPointBlocked(5.1,5.1),true);
});
test('small authored rocks vault, defer a turn until landing, and save on safe ground',async()=>{
 const map=fixture();map.props=[{id:'low-rock',kind:'rock',x:5,y:5,width:1,height:1,collision:{shape:'circle',radius:.25},traversal:{kind:'vault',height:.5}}];const events=[];
 const c=new MapController(map,{execution:'main',onEvent:e=>events.push(e)});
 try{
  const move=c.moveTo('hero',{x:8.1,y:5.5});move.catch(()=>{});await drive(c,()=>c.actorPosition('hero').lift>.1);
  const airborne=c.actorPosition('hero'),saved=c.snapshot();assert.ok(airborne.lift>0);assert.equal(c.index.isPointBlocked(saved.actors[0].x,saved.actors[0].y),false);
  const turn=c.faceTo('hero',{x:3,y:5.5});assert.equal(c.afterVault.size,1);
  await drive(c);await turn;assert.equal(c.actorPosition('hero').lift,0);assert.equal(c.index.isPointBlocked(c.actorPosition('hero').x,c.actorPosition('hero').y),false);
  assert.ok(events.find(e=>e.type==='map.vault.started'));assert.ok(events.find(e=>e.type==='map.vault.landed'));assert.ok(events.find(e=>e.type==='map.actor.faced'));
  const replacement=new MapController(map,{execution:'main'});replacement.restore(saved);replacement.dispose();
 }finally{c.dispose();}
});
test('water and building corners cannot be crossed by continuous routes',()=>{
 const map=fixture();map.props=[{id:'wall',kind:'house',x:5,y:3,width:2,height:5}];map.terrain[8*16+5]=2;
 const index=new MapIndex(map),job=new MapNavigationJob(map,index,map.actors[0],{x:8.3,y:5.5});while(job.result.status==='pending')job.step(32);
 assert.equal(job.result.status,'complete');assert.ok(job.result.path.slice(1).every((p,i)=>continuousSegmentClear(index,job.result.path[i],p,.12)));
});
