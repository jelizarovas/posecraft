import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {assertMap} from '../src/map.js';

const fixture=(kind='vault')=>({format:'posecraft-map',version:1,id:'crossings',name:'Crossings',seed:1,width:14,height:12,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(168).fill(0),props:[{id:'crossing',kind:'decoration',x:5,y:3,width:1,height:5,collision:{shape:'rect',x:0,y:0,width:1,height:5},traversal:{kind,activation:'click',height:kind==='climb'?1:.55,style:'branch',endpoints:[{x:-.3,y:2.5},{x:1.3,y:2.5}]}}],actors:[{id:'hero',x:2.5,y:5.5,speed:4}]});
async function drive(c,done=()=>!c.active.size,check=()=>{}){for(let i=0;i<10000&&!done();i++){c.advance(1/60);check(c.actorPosition('hero'));if(i%10===0)await new Promise(r=>setTimeout(r,0));}assert.ok(done(),'movement completes');}

test('click traversal stays solid to ordinary routes and explicit click crosses to the far endpoint',async()=>{
 const map=fixture(),events=[],c=new MapController(map,{execution:'main',onEvent:e=>events.push(e)});
 try{
  await drive(c,undefined); // idle sanity
  const around=c.moveTo('hero',{x:8.5,y:5.5});await drive(c);await around;
  assert.equal(events.some(e=>e.type==='map.traversal.started'),false);
  assert.ok(Math.abs(c.actorPosition('hero').x-8.5)<1e-6);
  const cross=c.moveTo('hero','crossing');await drive(c);await cross;
  assert.ok(Math.abs(c.actorPosition('hero').x-4.7)<1e-6,'approach from the right exits on the left');
  assert.equal(events.filter(e=>e.type==='map.traversal.started').length,1);
 }finally{c.dispose();}
});

test('manual traversal reports direction from terrain heights and clears render metadata after landing',async()=>{
 const map=fixture('climb'),stride=map.width+1;map.elevations=Array.from({length:stride*(map.height+1)},(_,i)=>(i%stride)*.2);
 const c=new MapController(map,{execution:'main'});
 try{
  const up=c.moveTo('hero','crossing');let seen=false;
  await drive(c,()=>!c.active.size,a=>{if(a.traversalAction){seen=true;assert.equal(a.traversalAction,'climb-up');assert.ok(a.traversalProgress>=0&&a.traversalProgress<=1);}});await up;
  assert.equal(seen,true);assert.ok(Math.abs(c.actorPosition('hero').x-6.3)<1e-6);assert.equal(c.actorPosition('hero').traversalAction,null);
  const down=c.moveTo('hero','crossing');await drive(c,undefined,a=>{if(a.traversalAction)assert.equal(a.traversalAction,'climb-down');});await down;assert.equal(c.actorPosition('hero').x,4.7);
 }finally{c.dispose();}
});

test('authored click climb crosses one terrace wall while ordinary movement stays blocked',async()=>{
 const map=fixture('climb');map.terraces=[{id:'upper',x:6,y:0,width:8,height:12,heightOffset:3}];map.props[0].traversal.height=3;
 const c=new MapController(map,{execution:'main'});
 try{
  await assert.rejects(c.moveTo('hero',{x:7.5,y:5.5}),/unreachable|route/i);
  const up=c.moveTo('hero','crossing');await drive(c);await up;assert.ok(c.actorPosition('hero').x>6);assert.equal(c.actorPosition('hero').lift,0);
  const down=c.moveTo('hero','crossing');await drive(c);await down;assert.ok(c.actorPosition('hero').x<5);
 }finally{c.dispose();}
});

test('blocked exits reject before replacing movement and cancellation waits for a safe landing',async()=>{
 const blocked=fixture();blocked.terrain[5*blocked.width+6]=2;const a=new MapController(blocked,{execution:'main'});
 try{await assert.rejects(a.moveTo('hero','crossing'),/blocked/);assert.equal(a.isMoving,false);}finally{a.dispose();}
 const c=new MapController(fixture(),{execution:'main'});
 try{
  const crossing=c.moveTo('hero','crossing'),cancelled=assert.rejects(crossing,{name:'AbortError'});
  await drive(c,()=>c.actorPosition('hero').traversalProgress>.3);
  c.cancel('hero');await drive(c);await cancelled;
  const actor=c.actorPosition('hero');assert.equal(actor.x,6.3);assert.equal(actor.lift,0);assert.equal(actor.traversalAction,null);
 }finally{c.dispose();}
});

test('automatic rectangular branch vault uses its collider top for a stable hand contact',async()=>{
 const map=fixture();map.props=[{id:'branch',kind:'decoration',x:5,y:5,width:1,height:1,collision:{shape:'rect',x:.1,y:.35,width:.8,height:.3},traversal:{kind:'vault',height:.42,style:'branch'}}];
 const c=new MapController(map,{execution:'main'});
 try{
  const move=c.moveTo('hero',{x:9,y:5.5},{gait:'run'});let contact=false;
  await drive(c,undefined,a=>{if(a.supportContact){contact=true;assert.ok(Math.abs(a.supportContact.x-5.5)<1e-9);assert.ok(Math.abs(a.supportContact.y-5.5)<1e-9);assert.ok(Math.abs(a.supportContact.z-.42)<1e-9);assert.equal(a.traversalAction,'vault');assert.equal(c.frame().destination.x,9);}});await move;
  assert.equal(contact,true);assert.equal(c.actorPosition('hero').supportContact,null);
 }finally{c.dispose();}
});

test('support anchors accept one point per direction or a nullable per-frame matrix',()=>{
 const map=fixture(),image={src:'https://example.com/actor.png',width:64,height:64,anchorX:.5,anchorY:1},base={image:'actor',frames:2,directions:2,frameWidth:32,frameHeight:32};
 map.art={images:{actor:image},actors:{hero:{idle:base,walk:base,run:base,vault:{...base,supportAnchors:[[{x:4,y:5},null],[{x:7,y:8},{x:9,y:10}]],supportWindow:[.2,.62]}}}};
 assert.equal(assertMap(map),map);
 const bad=structuredClone(map);bad.art.actors.hero.vault.supportAnchors[0].pop();assert.throws(()=>assertMap(bad),/support anchors/);
});
