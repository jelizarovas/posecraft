import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';

const fixture=()=>({format:'posecraft-map',version:1,id:'steering',name:'Direct control',seed:1,width:16,height:16,tileSize:{width:64,height:32},navigation:{mode:'continuous',radius:.12},terrain:Array(256).fill(0),props:[],actors:[{id:'hero',x:3.5,y:5.5,speed:3,stride:2.4}]});
const run=(c,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)c.advance(1/60);};

test('steering accelerates along the held direction and stops after release',async()=>{
 const events=[],c=new MapController(fixture(),{execution:'main',onEvent:e=>events.push(e.type)});
 try{
  const done=c.steer('hero',{x:1,y:0});run(c,1);
  let hero=c.actorPosition('hero');
  assert.ok(hero.x>5.8&&hero.x<6.6,`walks about three tiles a second (${hero.x})`);assert.equal(hero.y,5.5);
  assert.equal(hero.walking,true);assert.ok(Math.abs(hero.facing)<1e-6);assert.equal(c.isMoving,true);
  c.steer('hero',{x:1,y:0},{gait:'run'});run(c,.5);assert.equal(c.actorPosition('hero').running,true);
  c.steer('hero',null);const stopAt=c.actorPosition('hero').x;run(c,1);
  hero=c.actorPosition('hero');assert.ok(hero.x>stopAt&&hero.x-stopAt<1,'momentum carries briefly, then stops');
  assert.equal(hero.walking,false);assert.equal(c.isMoving,false);
  assert.equal((await done).type,'map.steer.stopped');
  assert.deepEqual(events.filter(type=>type==='map.move.started').length,1);
 }finally{c.dispose();}
});

test('steering slides along walls and never enters water',()=>{
 const map=fixture();map.props=[{id:'wall',kind:'house',x:5,y:2,width:1,height:8}];map.terrain[5*16+2]=2;
 const c=new MapController(map,{execution:'main'});
 try{
  c.steer('hero',{x:1,y:1});run(c,1.5);
  let hero=c.actorPosition('hero');
  assert.ok(hero.x<5-.11,'the wall stops progress along x');assert.ok(hero.y>6.5,'the diagonal slides along the wall');
  c.steer('hero',{x:-1,y:0});run(c,2);hero=c.actorPosition('hero');
  assert.equal(c.index.isPointBlocked(hero.x,hero.y),false);
  c.steer('hero',null);run(c,1);
 }finally{c.dispose();}
});

test('a hop lifts the actor, keeps momentum and lands on open ground',()=>{
 const events=[],c=new MapController(fixture(),{execution:'main',onEvent:e=>events.push(e.type)});
 try{
  assert.equal(c.jump('hero'),true);assert.equal(c.jump('hero'),false,'no double jump');
  run(c,.25);let hero=c.actorPosition('hero');assert.equal(hero.jumping,true);assert.ok(hero.lift>.3);
  assert.equal(hero.x,3.5,'a standing hop stays in place');
  run(c,.6);hero=c.actorPosition('hero');assert.equal(hero.jumping,false);assert.equal(hero.lift,0);
  assert.deepEqual(events.filter(type=>type.startsWith('map.jump')),['map.jump.started','map.jump.landed']);
  c.steer('hero',{x:1,y:0});run(c,1);const before=c.actorPosition('hero').x;
  c.jump('hero');run(c,.1);c.steer('hero',{x:-1,y:0});
  run(c,.6);hero=c.actorPosition('hero');assert.ok(hero.x>before+1,'no air control: the hop carries forward');
  assert.equal(hero.jumping,false);
  run(c,1);assert.ok(c.actorPosition('hero').x<hero.x,'held input resumes after landing');
  c.steer('hero',null);run(c,1);assert.equal(c.isMoving,false);
 }finally{c.dispose();}
});

test('steering into a low crossing vaults it; a click replaces steering',async()=>{
 const map=fixture();map.props=[{id:'low-rock',kind:'rock',x:6,y:5,width:1,height:1,collision:{shape:'circle',radius:.25},traversal:{kind:'vault',height:.5}}];
 const events=[],c=new MapController(map,{execution:'main',onEvent:e=>events.push(e.type)});
 try{
  const steering=c.steer('hero',{x:1,y:0},{gait:'run'});run(c,2);
  assert.ok(events.includes('map.vault.started')&&events.includes('map.vault.landed'));
  assert.ok(c.actorPosition('hero').x>7);
  const move=c.moveTo('hero',{x:10.5,y:10.5});
  await assert.rejects(steering,{name:'AbortError'});
  for(let i=0;i<600&&c.active.size;i++){c.advance(1/60);await new Promise(r=>setTimeout(r,0));}
  assert.equal((await move).type,'map.actor.arrived');
 }finally{c.dispose();}
});
