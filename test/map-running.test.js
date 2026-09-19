import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {sampleMapActor} from '../src/map-character.js';

const makeMap=()=>({format:'posecraft-map',version:1,id:'running',name:'Running',width:64,height:24,seed:1,tileSize:{width:64,height:32},terrain:Array(64*24).fill(0),props:[],actors:[{id:'hero',x:2.5,y:12.5,speed:3.2}]});
async function start(map,options,target={x:60.5,y:12.5}){
 const controller=new MapController(map,{execution:'main'});await controller.ready;const saved=controller.snapshot();saved.actors[0].facing=0;controller.restore(saved);
 let unsubscribe;const ready=new Promise(resolve=>{unsubscribe=controller.subscribe(e=>{if(e.type==='map.route.ready'){unsubscribe();resolve();}});});const completed=controller.moveTo('hero',target,options);await ready;return{controller,completed};
}

test('running arrives at the same target faster while preserving walk default and idle lifecycle',async()=>{
 const times=[];
 for(const gait of [undefined,'run']){const {controller,completed}=await start(makeMap(),gait?{gait}:{});try{
   assert.equal(controller.actorPosition('hero').gait,gait||'walk');assert.equal(controller.actorPosition('hero').running,gait==='run');
   let elapsed=0;while(controller.isMoving&&elapsed<25){controller.advance(1/120);elapsed+=1/120;}
   const event=await completed,actor=controller.actorPosition('hero');assert.equal(event.gait,gait||'walk');assert.equal(actor.x,60.5);assert.equal(actor.y,12.5);assert.equal(actor.walking,false);assert.equal(actor.running,false);assert.equal(actor.gait,'walk');times.push(elapsed);
 }finally{controller.dispose();}}
 assert.ok(times[0]/times[1]>1.7&&times[0]/times[1]<1.85,`Running should travel about 1.8 times as fast: ${times}`);
});

test('invalid gait preserves an existing movement and cancellation resets running state',async()=>{
 const {controller,completed}=await start(makeMap(),{gait:'run'});try{
   controller.advance(.1);const before=controller.actorPosition('hero');assert.throws(()=>controller.moveTo('hero',{x:3,y:3},{gait:'teleport'}),/gait/);assert.deepEqual(controller.actorPosition('hero'),before);assert.equal(controller.isMoving,true);
   controller.cancel('hero');await assert.rejects(completed,{name:'AbortError'});assert.equal(controller.actorPosition('hero').running,false);assert.equal(controller.actorPosition('hero').gait,'walk');
 }finally{controller.dispose();}
});

test('running follows obstacle routes without cutting blocked corners',async()=>{
 const map=makeMap();map.actors[0].speed=12;for(let y=0;y<20;y++)map.terrain[y*map.width+14]=2;
 const {controller,completed}=await start(map,{gait:'run'},{x:24.5,y:12.5});try{
   let steps=0;while(controller.isMoving&&steps++<2000){controller.advance(1/120);const actor=controller.actorPosition('hero');assert.equal(controller.index.isBlocked(Math.floor(actor.x),Math.floor(actor.y)),false);}
   assert.ok(steps<2000);await completed;assert.equal(controller.actorPosition('hero').x,24.5);
 }finally{controller.dispose();}
});

test('running trajectory and phase agree at 30 and 120 frame updates per second',async()=>{
 const states=[];
 for(const rate of [30,120]){const {controller,completed}=await start(makeMap(),{gait:'run'});try{for(let i=0;i<rate*4;i++)controller.advance(1/rate);states.push(controller.actorPosition('hero'));controller.cancel('hero');await assert.rejects(completed,{name:'AbortError'});}finally{controller.dispose();}}
 for(const field of ['x','y','facing','phase'])assert.ok(Math.abs(states[0][field]-states[1][field])<1e-7,field);
});

test('running stance feet cancel root displacement in all eight projected directions',()=>{
 for(let facing=0;facing<Math.PI*2;facing+=Math.PI/4){
   const distance=.025,phase=.5,a=sampleMapActor({facing,phase,walking:true,gait:'run'}),b=sampleMapActor({facing,phase:phase+distance*Math.PI*2,walking:true,gait:'run'});
   assert.equal(a.limbs[0].gait.stance,true);assert.equal(b.limbs[0].gait.stance,true);
   const x=(Math.cos(facing)-Math.sin(facing))*32*distance,y=(Math.cos(facing)+Math.sin(facing))*16*distance;
   assert.ok(Math.abs(b.limbs[0].foot.x+x-a.limbs[0].foot.x)<1e-8);assert.ok(Math.abs(b.limbs[0].foot.y+y-a.limbs[0].foot.y)<1e-8);
 }
});

test('running has flight, forward lean and higher hands without exceeding actor culling bounds',()=>{
 const walking=sampleMapActor({facing:-Math.PI/4,phase:.46*Math.PI*2,walking:true}),running=sampleMapActor({facing:-Math.PI/4,phase:.46*Math.PI*2,walking:true,gait:'run'});
 assert.ok(walking.limbs.some(l=>l.gait.stance));assert.ok(running.limbs.every(l=>!l.gait.stance&&l.gait.lift>0));assert.ok(running.point(0,0,33).x>walking.point(0,0,33).x);
 assert.ok(running.limbs.reduce((sum,l)=>sum+l.hand.y,0)<walking.limbs.reduce((sum,l)=>sum+l.hand.y,0));
 for(let facing=0;facing<Math.PI*2;facing+=Math.PI/4)for(let phase=0;phase<Math.PI*2;phase+=.1){const sample=sampleMapActor({facing,phase,walking:true,gait:'run'});for(const limb of sample.limbs)for(const key of ['hip','knee','foot','shoulder','elbow','hand']){const p=limb[key];assert.ok(p.x>-22&&p.x<22);assert.ok(p.y>-50&&p.y<8);}}
 for(const reduced of [false,true]){const sample=sampleMapActor({facing:1,phase:2,walking:reduced,gait:'run'},reduced);assert.equal(sample.running,false);assert.equal(sample.bob,0);}
});
