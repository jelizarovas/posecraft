import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {propHitsSegment} from '../src/map-collision.js';

const fixture=()=>({format:'posecraft-map',version:1,id:'vault',name:'Rock hops',seed:1,width:16,height:16,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(256).fill(0),props:[{id:'rock',kind:'rock',x:5,y:5,width:1,height:1,collision:{shape:'circle',radius:.25},traversal:{kind:'vault',height:.5}}],actors:[{id:'hero',x:3.25,y:5.5,speed:3}]});
async function drive(c,until=()=>!c.active.size,check=()=>{}){
 for(let i=0;i<10000&&!until();i++){
  c.advance(1/60);const actor=c.actorPosition('hero');check(actor);
  if(!actor.jumping)assert.equal(c.index.isPointBlocked(actor.x,actor.y),false,'Ground contact stays clear');
  if(i%10===0)await new Promise(r=>setTimeout(r,0));
 }
 assert.ok(until(),'Traversal completes');
}

test('walk hops and running jumps clear rocks, with earlier running takeoff',async()=>{
 const results=[];
 for(const gait of ['walk','run']){
  const events=[],c=new MapController(fixture(),{execution:'main',onEvent:e=>events.push(e)});
  try{
   const done=c.moveTo('hero',{x:9,y:5.5},{gait});let peak=0,airFrames=0;
   await drive(c,undefined,a=>{
    if(a.jumping)assert.equal(a.traversalAction,null,'rocks keep the procedural jump render path');
    if(a.jumping){airFrames++;peak=Math.max(peak,a.lift);if(propHitsSegment(c.map.props[0],a,a,.12))assert.ok(a.lift>=.5,'Feet clear the rock top');}
   });await done;
   assert.ok(airFrames>15);assert.ok(peak>.75);assert.equal(events.filter(e=>e.type==='map.vault.started').length,1);
   assert.equal(c.actorPosition('hero').lift,0);results.push(events.find(e=>e.type==='map.vault.started').x);
  }finally{c.dispose();}
 }
 assert.ok(results[0]-results[1]>.45,'Running takes off at least half a cell earlier');
});

test('airborne running redirect rolls forward, recovers, then runs to the latest target',async()=>{
 const events=[],c=new MapController(fixture(),{execution:'main',onEvent:e=>events.push(e)});
 try{
  c.moveTo('hero',{x:10,y:5.5},{gait:'run'}).catch(()=>{});
  await drive(c,()=>c.actorPosition('hero').jumpProgress>.2&&c.actorPosition('hero').jumping);
  const airborne=c.actorPosition('hero');
  const replaced=c.moveTo('hero',{x:2,y:9},{gait:'run'});const rejected=assert.rejects(replaced,{name:'AbortError'});
  const done=c.moveTo('hero',{x:2,y:11},{gait:'run'});await rejected;
  await drive(c,()=>c.actorPosition('hero').rolling);
  const landed=c.actorPosition('hero');assert.ok(landed.x>airborne.x);assert.equal(landed.y,5.5);
  assert.equal(events.filter(e=>e.type==='map.move.started').length,1,'New direction waits for recovery');
  c.advance(.08);assert.ok(c.actorPosition('hero').x>landed.x,'Roll moves with the old momentum');
  assert.equal(c.actorPosition('hero').facing,airborne.facing);
  await drive(c);await done;
  const a=c.actorPosition('hero');assert.equal(a.x,2);assert.equal(a.y,11);assert.equal(a.rolling,false);
  const recovery=events.findIndex(e=>e.type==='map.roll.finished'),restart=events.findIndex((e,i)=>i>recovery&&e.type==='map.move.started');
  assert.ok(recovery>0&&restart>recovery);assert.equal(events[restart].gait,'run');
 }finally{c.dispose();}
});

test('blocked landing detours instead of walking across the rock',async()=>{
 const map=fixture();map.props.push({id:'wall',kind:'house',x:6,y:5,width:1,height:1});
 const c=new MapController(map,{execution:'main'});
 try{const done=c.moveTo('hero',{x:9,y:5.5},{gait:'run'});await drive(c);await done;assert.equal(c.actorPosition('hero').x,9);}finally{c.dispose();}
});

test('cancellation in flight lands safely; saves never retain an airborne position',async()=>{
 const c=new MapController(fixture(),{execution:'main'});
 try{
  const move=c.moveTo('hero',{x:10,y:5.5},{gait:'run'}),cancelled=assert.rejects(move,{name:'AbortError'});
  await drive(c,()=>c.actorPosition('hero').jumping&&c.actorPosition('hero').jumpProgress>.4);
  const saved=c.snapshot();assert.equal(c.index.isPointBlocked(saved.actors[0].x,saved.actors[0].y),false);
  c.cancel('hero');await drive(c);await cancelled;assert.equal(c.actorPosition('hero').lift,0);
  c.restore(saved);assert.equal(c.actorPosition('hero').jumping,false);assert.equal(c.actorPosition('hero').rolling,false);
 }finally{c.dispose();}
});
