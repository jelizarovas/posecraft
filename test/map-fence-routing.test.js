import test from 'node:test';
import assert from 'node:assert/strict';
import {MapController} from '../src/map-runtime.js';
import {createTownMap} from '../examples/town-map.js';

const mapFixture=()=>({format:'posecraft-map',version:1,id:'fence-routing',name:'Fence routing',seed:1,width:16,height:12,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(192).fill(0),props:[{id:'fence',kind:'decoration',x:2,y:5,width:11,height:1,fence:{nodes:[{x:0,y:.5},{x:11,y:.5}],links:[[0,1]]},traversal:{activation:'auto',kind:'vault',height:.55,style:'branch',endpoints:[{x:5.5,y:-.45},{x:5.5,y:1.45}]}}],actors:[{id:'hero',x:3.25,y:3.5,speed:4,appearance:{kind:'villager',palette:'#668866'}},{id:'cow',x:11.25,y:3.5,speed:4,appearance:{kind:'livestock',image:'cow'}}],art:{images:{cow:{src:'https://example.com/cow.png',width:64,height:64,anchorX:.5,anchorY:1}}}});

async function drive(controller,id,promise,check=()=>{}){
 for(let i=0;i<10000&&controller.active.size;i++){controller.advance(1/60);check(controller.actorPosition(id));if(i%10===0)await new Promise(resolve=>setTimeout(resolve,0));}
 assert.equal(controller.active.size,0,'movement completes');return promise;
}

test('walking and oblique running routes vault a long fence at their local crossing',async()=>{
 for(const {gait,target,maxSupportX}of[{gait:'walk',target:{x:3.25,y:8.5},maxSupportX:3.5},{gait:'run',target:{x:5.25,y:8.5},maxSupportX:5.5}]){
  const events=[],controller=new MapController(mapFixture(),{execution:'main',onEvent:event=>events.push(event)});
  try{
   const move=controller.moveTo('hero',target,{gait});let support=null;
   await drive(controller,'hero',move,actor=>{if(actor.supportContact)support=actor.supportContact;});await move;
   assert.ok(events.some(event=>event.type==='map.vault.started'&&event.object==='fence'),`${gait} route vaults`);
   assert.ok(support,'vault supplies a hand support point');
   assert.ok(support.x<maxSupportX,'support stays near the route crossing rather than the fence midpoint');
   assert.ok(Math.abs(controller.actorPosition('hero').x-target.x)<1e-6);
  }finally{controller.dispose();}
 }
});

test('blocked fence landing shifts the crossing and never lands inside the corner obstacle',async()=>{
 const map=mapFixture();map.props.push({id:'landing-wall',kind:'house',x:2,y:6,width:2,height:1,collision:{shape:'rect',x:.7,y:0,width:1.1,height:1}});
 const events=[],controller=new MapController(map,{execution:'main',onEvent:event=>events.push(event)});
 try{
  const move=controller.moveTo('hero',{x:3.25,y:8.5},{gait:'run'});await drive(controller,'hero',move,actor=>{if(!actor.jumping)assert.equal(controller.index.isPointBlocked(actor.x,actor.y,.12),false);});await move;
  const landed=events.filter(event=>event.type==='map.vault.landed');
  assert.ok(landed.length<=1,'route performs at most one fence vault');
  for(const event of landed)assert.equal(controller.index.isPointBlocked(event.x,event.y,.12),false,'vault landing is collision-safe');
  assert.equal(controller.index.isPointBlocked(controller.actorPosition('hero').x,controller.actorPosition('hero').y,.12),false);
 }finally{controller.dispose();}
});

test('livestock routes around automatic fences unless vaulting is explicitly enabled',async()=>{
 const map=mapFixture(),controller=new MapController(map,{execution:'main'});
 try{
  const normal=controller.moveTo('cow',{x:11.25,y:8.5},{gait:'run'});let jumped=false;await drive(controller,'cow',normal,actor=>{jumped||=actor.jumping;});await normal;assert.equal(jumped,false);
  controller.actors.get('cow').x=11.25;controller.actors.get('cow').y=3.5;
  const allowed=controller.moveTo('cow',{x:11.25,y:8.5},{gait:'run',allowVault:true});await drive(controller,'cow',allowed,actor=>{jumped||=actor.jumping;});await allowed;assert.equal(jumped,true);
 }finally{controller.dispose();}
});

test('explicit fence target still uses authored endpoints after automatic routing is enabled',async()=>{
 const controller=new MapController(mapFixture(),{execution:'main'});
 try{const move=controller.moveTo('hero','fence');await drive(controller,'hero',move);await move;const actor=controller.actorPosition('hero');assert.ok(Math.abs(actor.x-7.5)<1e-6);assert.ok(Math.abs(actor.y-6.45)<1e-6);}finally{controller.dispose();}
});

test('generated town point routing automatically vaults a pasture span',async()=>{
 const map=createTownMap(),cx=Math.floor(map.width/2),cy=Math.floor(map.height/2),hero=map.actors[0];hero.x=cx;hero.y=cy+12.4;
 const events=[],controller=new MapController(map,{execution:'main',onEvent:event=>events.push(event)}),target={x:cx,y:cy+15.5};
 try{
  const move=controller.moveTo(hero.id,target,{gait:'walk'});await drive(controller,hero.id,move);await move;
  assert.ok(events.some(event=>event.type==='map.vault.started'&&event.object==='pasture-north-west-a'));
  const actor=controller.actorPosition(hero.id);assert.ok(Math.abs(actor.x-target.x)<1e-6&&Math.abs(actor.y-target.y)<1e-6);
 }finally{controller.dispose();}
});
