import test from 'node:test';
import assert from 'node:assert/strict';
import {MapIndex} from '../src/map.js';
import {MapController} from '../src/map-runtime.js';
import {roundMapRoute,mapSegmentClear,angleDelta,MapRoutePreparation} from '../src/map-motion.js';
const fixture=()=>({format:'posecraft-map',version:1,id:'motion',name:'Motion',seed:1,width:20,height:20,tileSize:{width:72,height:36},terrain:Array(400).fill(0),props:[],actors:[{id:'hero',x:3.5,y:3.5,speed:3.5}]});
test('rounded corners preserve endpoints and provide gradual tangents',()=>{
 const index=new MapIndex(fixture()),path=[{x:2.5,y:2.5},{x:3.5,y:2.5},{x:3.5,y:3.5}],rounded=roundMapRoute(index,path);
 assert.deepEqual(rounded[0],path[0]);assert.deepEqual(rounded.at(-1),path.at(-1));assert.ok(rounded.length>path.length);
 const headings=rounded.slice(1).map((p,i)=>Math.atan2(p.y-rounded[i].y,p.x-rounded[i].x));
 assert.ok(headings.slice(1).every((h,i)=>Math.abs(angleDelta(headings[i],h))<.3));
 assert.ok(rounded.slice(1).every((p,i)=>mapSegmentClear(index,rounded[i],p)));
});

test('long route preparation yields before rounding and incrementally indexes every segment',()=>{
 const map=fixture();map.width=128;map.height=128;map.terrain=Array(128*128).fill(0);
 const index=new MapIndex(map),path=[];
 for(let y=1;y<127;y++)for(let x=1;x<127;x++)path.push({x:(y%2?x:127-x)+.5,y:y+.5});
 const preparation=new MapRoutePreparation(index,path[0],path);
 assert.equal(preparation.route.length,0,'constructor does no whole-route work');
 preparation.step(32);assert.equal(preparation.done,false);assert.ok(preparation.cursor<=33);
 let slices=1;
 while(!preparation.done){const prior=preparation.route.length;preparation.step(32);assert.ok(preparation.route.length-prior<=32*9);slices++;}
 assert.ok(slices>path.length/32,'both normalization and rounding are sliced');
 assert.deepEqual(preparation.route[0],path[0]);assert.deepEqual(preparation.route.at(-1),path.at(-1));
 const indexed=new Set([...preparation.routeChunks.values()].flat());
 assert.equal(indexed.size,preparation.route.length-1);
 const measured=preparation.route.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-preparation.route[i].x,p.y-preparation.route[i].y),0);
 assert.ok(Math.abs(measured-preparation.remaining)<1e-8);
});

test('cancelling while a long route is prepared never publishes a ready route',async()=>{
 const map=fixture();map.width=128;map.height=128;map.terrain=Array(128*128).fill(0);let ready=0;
 const c=new MapController(map,{execution:'main',onEvent:e=>{if(e.type==='map.route.ready')ready++;}});
 try{
  const promise=c.moveTo('hero',{x:120,y:120});await Promise.resolve();
  const job=c.active.get('hero'),path=[];
  for(let y=3;y<127;y++)for(let x=3;x<127;x++)path.push({x:(y%2?x:129-x)+.5,y:y+.5});
  job.planning=false;c.accept(job,{status:'complete',path,visited:1});
  assert.ok(job.preparation);assert.equal(job.route,null);
  const rejected=assert.rejects(promise,{name:'AbortError'});c.cancel('hero');await rejected;
  await new Promise(r=>setTimeout(r,10));
  assert.equal(ready,0);assert.equal(c.active.size,0);assert.equal(c.isMoving,false);
 }finally{c.dispose();}
});

test('maximum-speed traversal cannot pass an entire bend before its body turns',async()=>{
 const map=fixture();map.actors[0].speed=100;map.props=[{id:'wall',kind:'rock',x:3,y:4,width:1,height:2}];
 const c=new MapController(map,{execution:'main'});
 try{
  const ready=new Promise(resolve=>{const off=c.subscribe(e=>{if(e.type==='map.route.ready'){off();resolve();}});});
  const completion=c.moveTo('hero',{x:3.5,y:6.5});await ready;
  const actor=c.actors.get('hero'),job=c.active.get('hero');actor.facing=Math.atan2(job.route[1].y-actor.y,job.route[1].x-actor.x);
  c.advance(.1);assert.ok(c.isMoving,'cannot traverse the U-shaped detour in one frame');
  let prior=c.actorPosition('hero');
  for(let i=0;i<10000&&c.active.size;i++){
   c.advance(.001);const next=c.actorPosition('hero');
   assert.ok(Math.abs(angleDelta(prior.facing,next.facing))<=.007+1e-8);
   if(next.gaitWeight>0)assert.ok(Math.abs(angleDelta(next.facing,next.travelFacing))<=.66,'travel follows turned body');
   assert.ok(!c.index.isBlocked(next.x,next.y));prior=next;
  }
  assert.equal(c.active.size,0);await completion;assert.equal(prior.x,3.5);assert.equal(prior.y,6.5);
 }finally{c.dispose();}
});

test('fractional command replacement continues forward without reversing to the cell center',()=>{
 const index=new MapIndex(fixture()),start={x:3.9,y:3.5},path=[{x:3.5,y:3.5},{x:4.5,y:3.5},{x:5.5,y:3.5}];
 const preparation=new MapRoutePreparation(index,start,path);while(!preparation.step(8)){}
 assert.deepEqual(preparation.route[0],start);
 assert.ok(preparation.route.every(p=>p.x>=start.x));
});
test('rounding checks continuous foot clearance against expanded obstacle rectangles',()=>{
 const map=fixture();map.props=[{id:'wall',kind:'rock',x:4,y:4,width:3,height:4}];const index=new MapIndex(map);
 assert.equal(mapSegmentClear(index,{x:3.7,y:3.7},{x:4.3,y:4.3}),false);
 const path=[{x:3.5,y:6.5},{x:3.5,y:3.5},{x:7.5,y:3.5},{x:7.5,y:6.5}],rounded=roundMapRoute(index,path);
 assert.ok(rounded.slice(1).every((p,i)=>mapSegmentClear(index,rounded[i],p)));
 // A fractional replacement route close to a wall keeps its original corner.
 const tight=[{x:3.9,y:4.5},{x:3.9,y:3.9},{x:4.5,y:3.9}];
 assert.deepEqual(roundMapRoute(index,tight),tight);
});
test('a reverse command turns before travelling and facing never snaps on curves',async()=>{
 const c=new MapController(fixture(),{execution:'main'});try{
  const actor=c.actors.get('hero');actor.facing=0;
  const result=c.moveTo('hero',{x:1.5,y:3.5});await new Promise(resolve=>{const off=c.subscribe(e=>{if(e.type==='map.route.ready'){off();resolve();}});});
  let prior=c.actorPosition('hero'),settled=false;result.then(()=>settled=true);
  for(let i=0;i<1000&&!settled;i++){
   c.advance(1/60);const next=c.actorPosition('hero');assert.ok(Math.abs(angleDelta(prior.facing,next.facing))<=7/60+1e-8);
   if(i<8)assert.ok(Math.hypot(next.x-3.5,next.y-3.5)<1e-6,'no sliding backwards while facing away');
   prior=next;await Promise.resolve();
  }
  await result;assert.equal(prior.x,1.5);assert.equal(prior.y,3.5);
 }finally{c.dispose();}
});
