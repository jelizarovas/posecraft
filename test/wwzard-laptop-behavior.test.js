import assert from 'node:assert/strict';
import test from 'node:test';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {assertDocument} from '../src/schema.js';

const createPlayer=scene=>new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
const actor=(frame,id)=>frame.actors.find(a=>a.id===id);
function until(player,predicate,seconds=25){
  for(let i=0;i<seconds*30;i++){
    const frame=player.step(1/30);
    if(predicate(frame))return frame;
  }
  assert.fail(`Expected behavior was not reached; current state: ${player.frame().behavior.state}`);
}

test('saved close interrupts work immediately and keeps both actors shut until requested open',()=>{
  const scene=JSON.parse(JSON.stringify(createWwzardIllustration()));
  assertDocument(scene);
  assert.equal(scene.packs.wwzard.clips.close.duration,scene.packs.screen.clips.close.duration);
  const player=createPlayer(scene);
  try{
    player.dispatch('close-laptop');
    const early=player.step(1/30);
    assert.equal(early.behavior.state,'closingLaptop');
    assert.equal(early.behavior.variables.laptopRequestedClosed,true);
    assert.equal(actor(early,'wwzard').activity,'close');
    const start=until(player,frame=>frame.behavior.state==='closingLaptop',10);
    assert.equal(start.behavior.variables.laptopRequestedClosed,true);
    assert.equal(actor(start,'wwzard').activity,'close');
    assert.equal(actor(start,'screen').activity,'closeScreen');
    assert.equal(actor(start,'wwzard').clipTime,actor(start,'screen').clipTime);
    let mid;
    for(let i=0;i<60;i++)mid=player.step(1/30);
    assert.equal(mid.behavior.state,'closingLaptop');
    assert.equal(actor(mid,'wwzard').clipTime,actor(mid,'screen').clipTime);
    const closed=until(player,frame=>frame.behavior.state==='closedIdle',15);
    assert.equal(closed.behavior.variables.laptopClosed,true);
    assert.equal(actor(closed,'screen').clip,'closed-idle');
    player.dispatch('open-laptop');
    const opening=until(player,frame=>frame.behavior.state==='openingLaptop',15);
    assert.equal(actor(opening,'wwzard').clip,'open');
    assert.equal(actor(opening,'screen').clip,'open');
    const resumed=until(player,frame=>frame.behavior.state==='working',15);
    assert.equal(actor(resumed,'wwzard').activity,'work');
    assert.equal(resumed.behavior.variables.laptopClosed,false);
    assert.equal(actor(resumed,'screen').clip,'open');
    assert.equal(actor(resumed,'screen').clipTime,scene.packs.screen.clips.open.duration);
  }finally{player.dispose();}
});

test('a visitor arriving while closing waits for an explicit reopen, then gets a response',()=>{
  const player=createPlayer(createWwzardIllustration());
  try{
    player.dispatch('close-laptop');
    until(player,frame=>frame.behavior.state==='closingLaptop',10);
    player.dispatch('visitor');
    const early=player.step(1/30);
    assert.equal(early.behavior.state,'closingLaptop');
    assert.equal(early.behavior.variables.pending,true);
    const closed=until(player,frame=>frame.behavior.state==='closedIdle',15);
    assert.equal(closed.behavior.variables.pending,true);
    player.dispatch('open-laptop');
    const noticing=until(player,frame=>frame.behavior.state==='noticing',20);
    assert.equal(actor(noticing,'wwzard').activity,'notice');
    assert.equal(noticing.behavior.variables.pending,false);
    assert.equal(noticing.behavior.variables.responses,0);
    const greeting=until(player,frame=>frame.behavior.state==='greeting',10);
    assert.equal(actor(greeting,'wwzard').activity,'greet');
  }finally{player.dispose();}
});

test('a close request interrupts rest immediately and survives save/reopen',()=>{
  const saved=JSON.stringify(createWwzardIllustration()),player=createPlayer(JSON.parse(saved));
  try{
    const rest=until(player,frame=>frame.behavior.state==='resting',15);
    assert.equal(actor(rest,'wwzard').activity,'rest');
    player.dispatch('close-laptop');
    assert.equal(player.frame().behavior.state,'closingLaptop');
    const closing=until(player,frame=>frame.behavior.state==='closingLaptop',10);
    assert.equal(actor(closing,'screen').activity,'closeScreen');
  }finally{player.dispose();}
});

test('a close interrupts a greeting directly without an unrelated rest cycle',()=>{
 const player=createPlayer(createWwzardIllustration());
 try{
  player.dispatch('visitor');
  until(player,frame=>frame.behavior.state==='greeting');
  player.dispatch('close-laptop');
  const states=[];
  const closing=until(player,frame=>{states.push(frame.behavior.state);return frame.behavior.state==='closingLaptop';},3);
  assert.ok(!states.includes('resting'),'a requested action must not insert a tuck/untuck detour');
  assert.equal(actor(closing,'wwzard').activity,'close');
 }finally{player.dispose();}
});
