import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {projectMap} from '../src/map.js';

function fixture(width=20,height=20){return {format:'posecraft-map',version:1,id:'test-map',name:'Test map',width,height,seed:1,tileSize:{width:72,height:36},terrain:Array(width*height).fill(0),props:[],actors:[{id:'hero',x:2.5,y:2.5,speed:8}]};}
async function until(c,promise){let done=false,error,result;promise.then(v=>{done=true;result=v;},e=>{done=true;error=e;});for(let i=0;i<5000&&!done;i++){if(i%20===0)await new Promise(r=>setTimeout(r,0));c.advance(1/60);}assert.ok(done,'map command must settle');if(error)throw error;return result;}

test('character moves around footprints to a free object edge and completes before host callbacks',async()=>{
 const map=fixture();map.props=[{id:'wall',kind:'rock',x:5,y:0,width:2,height:7},{id:'chest',kind:'chest',x:10,y:3,width:1,height:1}];let interacted=0;const c=new MapController(map,{execution:'main',onEvent:e=>{if(e.type==='map.object.interacted'){interacted++;c.cancel('hero');}}});try{const request=c.moveTo('hero','chest');const event=await until(c,request);assert.equal(event.type,'map.actor.arrived');assert.equal(interacted,1);assert.equal(c.snapshot().objects.chest.opened,true);const a=c.actorPosition('hero');assert.equal(Math.abs(a.x-10.5)+Math.abs(a.y-3.5),1);assert.equal(c.isMoving,false);}finally{c.dispose();}
});
test('blocked clicks leave active movement intact; cancellation and replacement settle exact requests',async()=>{
 const map=fixture();map.terrain[1*map.width+1]=2;const c=new MapController(map,{execution:'main'});try{const first=c.moveTo('hero',{x:15,y:15});await assert.rejects(c.moveTo('hero',{x:1,y:1}),/blocked/);await until(c,first);const old=c.moveTo('hero',{x:2,y:2}),rejected=assert.rejects(old,{name:'AbortError'}),next=c.moveTo('hero',{x:17,y:17});await rejected;await until(c,next);assert.equal(c.actorPosition('hero').x,17.5);const pending=c.moveTo('hero',{x:2,y:2}),cancelled=assert.rejects(pending,{name:'AbortError'});c.cancel('hero');await cancelled;assert.equal(c.isMoving,false);}finally{c.dispose();}
});
test('replacement reentrancy leaves only the newest command running',async()=>{
 let newer,reentered=false;const c=new MapController(fixture(),{execution:'main',onEvent:e=>{if(e.type==='map.command.cancelled'&&!reentered){reentered=true;newer=c.moveTo('hero',{x:18,y:18});}}});try{const first=c.moveTo('hero',{x:10,y:10}),a=assert.rejects(first,{name:'AbortError'}),second=c.moveTo('hero',{x:12,y:12}),b=assert.rejects(second,{name:'AbortError'});await a;await b;await until(c,newer);assert.equal(c.actorPosition('hero').x,18.5);assert.equal(c.active.size,0);}finally{c.dispose();}
});
test('semantic map save is atomic, does not replay interaction, and preserves special object IDs',async()=>{
 const map=fixture();map.props=[{id:'__proto__',kind:'chest',x:4,y:4,width:1,height:1}];let interactions=0;const c=new MapController(map,{execution:'main',onEvent:e=>{if(e.type==='map.object.interacted')interactions++;}});try{await until(c,c.moveTo('hero','__proto__'));const saved=JSON.parse(JSON.stringify(c.snapshot()));await until(c,c.moveTo('hero',{x:15,y:15}));const invalid=structuredClone(saved);invalid.actors[0].x=-1;assert.throws(()=>c.restore(invalid),/position/);assert.equal(c.actorPosition('hero').x,15.5);const pending=c.moveTo('hero',{x:8,y:8}),cancelled=assert.rejects(pending,{name:'AbortError'});c.restore(saved);await cancelled;assert.equal(interactions,1);assert.deepEqual(c.snapshot(),saved);assert.equal(Object.getPrototypeOf(c.objects),null);}finally{c.dispose();}
});
test('viewport frame queries local actor chunks rather than cloning the whole cast',()=>{
 const map=fixture(128,128);map.actors=Array.from({length:4096},(_,i)=>({id:'a'+i,x:i%64*2+.5,y:Math.floor(i/64)*2+.5,speed:3}));const c=new MapController(map,{execution:'main'});try{const p=projectMap(map,{x:10,y:10}),frame=c.visibleFrame({x:p.x-250,y:p.y-180,width:500,height:360});assert.ok(frame.actors.length>0);assert.ok(frame.candidateActors<500,frame.candidateActors);assert.ok(frame.actors.length<100);assert.equal(c.frame().actors.length,4096);}finally{c.dispose();}
});
test('movement continues logically outside a viewport and idle actors never advance',async()=>{
 const c=new MapController(fixture(128,128),{execution:'main'});try{const p=c.moveTo('hero',{x:100,y:100});await until(c,p);const a=c.actorPosition('hero'),frame=c.visibleFrame({x:-200,y:0,width:400,height:300});assert.equal(frame.actors.length,0);assert.equal(a.x,100.5);c.advance(.1);assert.deepEqual(c.actorPosition('hero'),a);}finally{c.dispose();}
});

test('four allocated searches share work and cancelling them releases queued routes',async()=>{
 const map=fixture(128,128);
 for(let y=0;y<map.height;y++)map.terrain[y*map.width+64]=2;
 map.actors=Array.from({length:9},(_,i)=>({id:'a'+i,x:2.5,y:2.5+i,speed:8}));
 const c=new MapController(map,{execution:'main'});
 try{
  const blocked=map.actors.slice(0,4).map(a=>c.moveTo(a.id,{x:100,y:100}));
  const queued=map.actors.slice(4).map(a=>c.moveTo(a.id,{x:25,y:25}));
  for(let i=0;i<20&&[...c.active.values()].filter(j=>j.pathJob).length<4;i++)await new Promise(r=>setTimeout(r,0));
  const searches=[...c.active.values()].filter(j=>j.pathJob);
  assert.equal(searches.length,4,'only four searches allocate their map-sized buffers');
  assert.equal(c.active.size,9,'other movement requests remain queued');
  for(let i=0;i<20&&searches.some(j=>j.pathJob.result.visited===0);i++)await new Promise(r=>setTimeout(r,0));
  assert.ok(searches.every(j=>j.pathJob.result.visited>0),'allocated searches all receive work');
  const cancellations=blocked.map(p=>assert.rejects(p,{name:'AbortError'}));
  for(const a of map.actors.slice(0,4))c.cancel(a.id);
  await Promise.all(cancellations);
  await until(c,Promise.all(queued));
  for(const a of map.actors.slice(4)){const state=c.actorPosition(a.id);assert.equal(state.x,25.5);assert.equal(state.y,25.5);}
  assert.equal(c.active.size,0);
 }finally{c.dispose();}
});
