import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';

const fixture=()=>({
 format:'posecraft-map',version:1,id:'blocked-vault-replan',name:'Blocked vault replan',seed:1,
 width:12,height:12,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},
 terrain:Array(144).fill(0),
 props:[{id:'high-rock',kind:'rock',x:5,y:5,width:1,height:1,collision:{shape:'circle',radius:.25},traversal:{activation:'auto',kind:'vault',height:4}}],
 actors:[{id:'hero',x:3.5,y:5.5,speed:4}],
});

const settle=()=>new Promise(resolve=>setTimeout(resolve,0));

async function waitForRoute(controller){
 for(let i=0;i<1000;i++){
  if(controller.active.get('hero')?.route)return;
  await settle();
 }
 assert.fail('route was not prepared');
}

for(const dt of [.05,.1])test(`blocked automatic vault replans safely at ${dt} second steps`,async()=>{
 const controller=new MapController(fixture(),{execution:'main'});
 try{
  const movement=controller.moveTo('hero',{x:8.5,y:5.5},{gait:'walk'});
  await waitForRoute(controller);
  let replanned=false;
  for(let i=0;i<1000&&controller.active.size;i++){
   assert.doesNotThrow(()=>controller.advance(dt));
   const job=controller.active.get('hero');
   if(job?.allowVault===false)replanned=true;
   if(i%5===0)await settle();
  }
  await movement;
  assert.equal(replanned,true,'blocked vault falls back to an ordinary route');
  const actor=controller.actorPosition('hero');
  assert.ok(Math.abs(actor.x-8.5)<1e-6&&Math.abs(actor.y-5.5)<1e-6,'movement reaches its target after replanning');
 }finally{controller.dispose();}
});
