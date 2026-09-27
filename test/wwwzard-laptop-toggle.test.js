import test from 'node:test';
import assert from 'node:assert/strict';
import {createIllustrationController,assertDocument} from '@posecraft/runtime';
import {applyMotionLayers} from '@posecraft/runtime/features';
import {createWwwzardHomeScene} from '../examples/wwwzard-home.js';

const make=()=>createIllustrationController(assertDocument(JSON.parse(JSON.stringify(createWwwzardHomeScene()))),{motionLayerSolver:applyMotionLayers});
const step=(c,time)=>{for(let i=0;i<time*60;i++)c.step(1/60);};
const until=(c,state)=>{for(let i=0;i<1200&&c.frame().behavior.state!==state;i++)c.step(1/60);assert.equal(c.frame().behavior.state,state);};
const click=c=>c.pointer({binding:'home-laptop-click',phase:'click',x:310,y:240});
const hinge=c=>c.frame().actors.find(a=>a.id==='screen').pose['hinge.bend'];

test('closed-lid click interrupts puzzled and angry reactions and opens from the displayed pose',()=>{
 for(const anger of [0,56]){
  const c=make();c.setVariable('anger',anger);click(c);until(c,anger?'annoyed':'puzzled');
  assert.equal(hinge(c),1);const before=c.frame().actors.map(a=>a.pose),level=c.frame().behavior.variables.anger;
  click(c);assert.equal(c.frame().behavior.state,'openingLaptop');
  assert.deepEqual(c.frame().actors.map(a=>a.pose),before);
  assert.equal(c.frame().behavior.variables.anger,level,'opening does not add anger');
  step(c,1.3);assert(hinge(c)<.99);until(c,'working');assert.equal(hinge(c),0);c.dispose();
 }
});
test('repeat clicks reverse partially moving lids without cooldown or stale completion',()=>{
 const c=make();click(c);step(c,.2);const before=hinge(c);assert(before>0&&before<1);
 click(c);assert.equal(c.frame().behavior.state,'openingLaptop');assert.equal(hinge(c),before);
 click(c);assert.equal(c.frame().behavior.state,'visitorClosing');
 click(c);assert.equal(c.frame().behavior.state,'openingLaptop');
 until(c,'working');step(c,1);assert.equal(hinge(c),0);c.dispose();
});
test('manual closed idle is clickable and an uninterrupted close still auto-reopens',()=>{
 const c=make();c.dispatch('close-laptop');until(c,'closedIdle');click(c);until(c,'working');
 click(c);until(c,'puzzled');until(c,'working');assert.equal(hinge(c),0);c.dispose();
});
