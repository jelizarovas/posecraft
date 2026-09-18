import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleSuspendedSupport} from '../src/support-balance.js';
const base={anchor:{x:137,y:150},restCenter:{x:180,y:300},centerOffset:{x:0,y:-30},load:1,elapsed:2,maxLean:12};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} ≠ ${b}`);
test('one-hand support shifts body mass toward the held hand and derives the correct mirrored lean',()=>{
 const left=sampleSuspendedSupport(base),right=sampleSuspendedSupport({...base,anchor:{x:223,y:150}});
 assert.ok(left.rotation>11.9);assert.ok(right.rotation< -11.9);assert.ok(left.center.x<140&&right.center.x>220);assert.ok(Math.abs(left.lateralError)<8,'mass center approaches the gravity line');assert.ok(Math.abs(left.lateralError)<43*.2);near(left.rotation,-right.rotation);near(left.center.x+right.center.x,360);near(left.lateralError,-right.lateralError);near(left.center.y,300);
});
test('muscle resistance retains bounded authored posture while weaker muscles yield toward gravity',()=>{
 const weak=sampleSuspendedSupport({...base,resistance:0,elapsed:8}),strong=sampleSuspendedSupport({...base,resistance:1,elapsed:8});assert.ok(Math.abs(weak.lateralError)<.001);assert.ok(Math.abs(strong.lateralError)>5);assert.ok(Math.abs(strong.lateralError)<11);assert.ok(Math.abs(strong.center.x-180)<Math.abs(weak.center.x-180));
 for(const resistance of [0,.25,.65,1])for(const load of [0,.25,.6,1])for(const elapsed of [0,.01,.1,.5,2,20,3600]){const p=sampleSuspendedSupport({...base,resistance,load,elapsed,amplitude:8});assert.ok(Object.values(p.center).every(Number.isFinite));assert.ok(Math.abs(p.center.x-180)<=64);assert.ok(Math.abs(p.rotation)<=12);assert.equal(p.center.y,300);}
});
test('zero load and initial time preserve the authored pose exactly; seeking has no history',()=>{
 for(const option of [{load:0},{elapsed:0}]){const p=sampleSuspendedSupport({...base,...option,amplitude:12});assert.deepEqual(p.center,base.restCenter);assert.equal(p.rotation,0);assert.equal(p.alignment,0);}
 const expected=sampleSuspendedSupport({...base,elapsed:.8});sampleSuspendedSupport({...base,elapsed:100});sampleSuspendedSupport({...base,elapsed:.2});assert.deepEqual(sampleSuspendedSupport({...base,elapsed:.8}),expected);const settled=sampleSuspendedSupport({...base,elapsed:undefined});near(settled.center.x,settled.target.center.x);near(settled.rotation,settled.target.rotation);
});
test('weighted supports and rotated gravity share the same centerline calculation',()=>{
 const two=sampleSuspendedSupport({...base,anchor:undefined,supports:[{x:137,y:150,weight:1},{x:223,y:150,weight:1}]});near(two.rotation,0);near(two.lateralError,0);assert.deepEqual(two.center,base.restCenter);
 const left=sampleSuspendedSupport(base),turn=p=>({x:-p.y,y:p.x}),side=sampleSuspendedSupport({...base,anchor:turn(base.anchor),restCenter:turn(base.restCenter),centerOffset:turn(base.centerOffset),gravity:{x:-1,y:0}});near(side.center.x,-left.center.y);near(side.center.y,left.center.x);near(side.rotation,left.rotation);
});
test('excessive reach stays bounded and malformed support parameters fail safely',()=>{
 const far=sampleSuspendedSupport({...base,anchor:{x:-1000,y:150},maxShift:32,elapsed:undefined});assert.equal(far.limited,true);near(far.center.x,148);assert.ok(Math.abs(far.rotation)<=12);
 for(const changes of [{load:-1},{load:Infinity},{resistance:2},{elapsed:-1},{elapsed:NaN},{maxLean:70},{maxShift:Infinity},{settle:0},{amplitude:21},{gravity:{x:0,y:0}},{centerOffset:{x:NaN,y:0}},{anchor:undefined,supports:[]},{anchor:undefined,supports:[{x:0,y:0,weight:0}]},{supports:[{x:0,y:0}]}])assert.throws(()=>sampleSuspendedSupport({...base,...changes}),JSON.stringify(changes));
 const options=structuredClone(base);sampleSuspendedSupport(options);assert.deepEqual(options,base);
});
