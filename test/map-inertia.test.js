import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {MapIndex} from '../src/map.js';
import {brakeMapMotion} from '../src/map-motion.js';
import {continuousSegmentClear} from '../src/map-collision.js';

const fixture=()=>({format:'posecraft-map',version:1,id:'inertia',name:'Inertia',seed:1,width:16,height:16,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(256).fill(0),props:[],actors:[{id:'hero',x:3.25,y:5.5,speed:3}]});
async function drive(c,until=()=>!c.active.size){
 for(let i=0;i<6000&&!until();i++){
  const before=c.actorPosition('hero');c.advance(1/60);const after=c.actorPosition('hero');
  assert.ok(continuousSegmentClear(c.index,before,after,.12),'Every movement segment remains collision safe');
  if(i%10===0)await new Promise(r=>setTimeout(r,0));
 }
 assert.ok(until(),'Movement settles');
}

test('running reversal keeps forward momentum, then reaches the new destination',async()=>{
 const c=new MapController(fixture(),{execution:'main'});
 try{
  const original=c.moveTo('hero',{x:13,y:5.5},{gait:'run'});const cancelled=assert.rejects(original,{name:'AbortError'});
  await drive(c,()=>c.actorPosition('hero').x>5);
  const start=c.actorPosition('hero'),done=c.moveTo('hero',{x:2.5,y:5.5},{gait:'run'});
  assert.equal(c.actorPosition('hero').skidding,true);assert.equal(c.isMoving,true);
  c.advance(1/60);assert.ok(c.actorPosition('hero').x>start.x,'Braking still travels in the original direction');
  await drive(c,()=>!c.actorPosition('hero').skidding);
  const stop=c.actorPosition('hero');assert.ok(stop.x-start.x>.4&&stop.x-start.x<1,'Visible but bounded stopping distance');
  await drive(c);await done;await cancelled;
  assert.equal(c.actorPosition('hero').x,2.5);assert.equal(c.actorPosition('hero').skidding,false);
 }finally{c.dispose();}
});

test('repeated retargets carry remaining momentum; cancel clears it',async()=>{
 const c=new MapController(fixture(),{execution:'main'});
 try{
  c.moveTo('hero',{x:13,y:5.5},{gait:'run'}).catch(()=>{});await drive(c,()=>c.actorPosition('hero').x>5);
  c.moveTo('hero',{x:5,y:11},{gait:'run'}).catch(()=>{});c.advance(.05);
  const before=c.actorPosition('hero');c.moveTo('hero',{x:2,y:3},{gait:'run'}).catch(()=>{});c.advance(.05);
  assert.ok(c.actorPosition('hero').x>before.x);assert.equal(c.actorPosition('hero').skidding,true);
  c.cancel('hero');const stopped=c.actorPosition('hero');c.advance(.1);
  assert.equal(c.actorPosition('hero').x,stopped.x);assert.equal(c.actorPosition('hero').skidding,false);assert.equal(c.isMoving,false);
 }finally{c.dispose();}
});

test('braking respects solid props, water, map edges, and timestep partitioning',()=>{
 const map=fixture();map.props=[{id:'wall',kind:'house',x:7,y:5,width:1,height:1}];map.terrain[7*16+7]=2;
 const index=new MapIndex(map);
 for(const [start,v]of [[{x:6.7,y:5.5},{x:8,y:0}],[{x:6.7,y:7.5},{x:8,y:0}],[{x:.3,y:3},{x:-8,y:0}]]){
  const result=brakeMapMotion(index,start,v,.1,18,.12);
  assert.equal(result.blocked,true);assert.equal(Math.hypot(result.velocity.x,result.velocity.y),0);
  assert.ok(continuousSegmentClear(index,start,result,.12));
 }
 const start={x:4,y:10},v={x:5,y:2},whole=brakeMapMotion(index,start,v,.25,20,.12);
 let split={...start,velocity:v};for(let i=0;i<15;i++)split=brakeMapMotion(index,split,split.velocity,1/60,20,.12);
 assert.ok(Math.hypot(whole.x-split.x,whole.y-split.y)<1e-8);
 const slower=brakeMapMotion(index,start,{x:2,y:0},1,20,.12);
 assert.ok(whole.travelled>slower.travelled,'Faster motion takes farther to brake');
});
