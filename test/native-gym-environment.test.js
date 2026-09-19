import test from 'node:test';
import assert from 'node:assert/strict';
import {createPendantState} from '../src/native-gym-environment.js';

test('a dragged pendant retains cable length and settles after release',()=>{
 const pendant=createPendantState([2,3.4,-1],.65);
 pendant.drag([9,1,-8]);
 const distance=()=>Math.hypot(...pendant.state.position.map((v,i)=>v-pendant.state.anchor[i]));
 assert.ok(Math.abs(distance()-.65)<1e-9);
 assert.ok(Math.hypot(...pendant.state.offset)<=.65*.78+1e-9);
 const first=[...pendant.state.position];
 for(let i=0;i<120;i++){pendant.step(1/60);assert.ok(Math.abs(distance()-.65)<1e-9);assert.ok(pendant.state.position.every(Number.isFinite));}
 assert.notDeepEqual(pendant.state.position,first);
 for(let i=0;i<900;i++)pendant.step(1/60);
 assert.ok(Math.hypot(...pendant.state.offset,...pendant.state.velocity)<.00001);
 pendant.reset();assert.deepEqual(pendant.state.position,[2,2.75,-1]);
});
