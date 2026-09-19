import test from 'node:test';
import assert from 'node:assert/strict';
import {createHangingDynamics3D} from '../src/hanging-dynamics-3d.js';
const free={length:1,offset:[0,0],stiffness:[0,0],damping:[0,0],limits:[Math.PI,Math.PI]};
const make=(options={})=>createHangingDynamics3D({duration:10,driver:()=>free,...options});
const energy=(f,g=9.81,length=1)=>f.angle.reduce((sum,a,i)=>sum+.5*length*length*f.velocity[i]**2+g*length*(1-Math.cos(a)),0);

test('zero gravity and no muscle or damping preserve momentum without a prescribed oscillation',()=>{
 const model=make({gravity:0,initial:{angle:[.1,-.2],velocity:[.17,-.08]}});
 for(const t of [0,.2,.983,2,7.1]){const f=model.sample(t);assert.ok(Math.abs(f.angle[0]-(.1+.17*t))<1e-10);assert.ok(Math.abs(f.angle[1]-(-.2-.08*t))<1e-10);assert.deepEqual(f.velocity,[.17,-.08]);assert.deepEqual(f.gravityTorque,[0,0]);assert.deepEqual(f.muscleTorque,[0,0]);assert.ok(f.legAngle.every(v=>Math.abs(v)<1e-12));}
});

test('gravity direction, COM offset and suspension length change the acceleration',()=>{
 const tilted=gravity=>make({gravity,initial:{angle:[.2,0]}}).sample(1/120);
 assert.ok(tilted(9.81).velocity[0]<0);assert.ok(tilted(-9.81).velocity[0]>0);assert.equal(tilted(0).velocity[0],0);
 const offset=(x,length)=>make({driver:()=>({...free,length,offset:[x,0]})}).sample(1/120);
 assert.ok(offset(.2,1).velocity[0]>0);assert.ok(offset(-.2,1).velocity[0]<0);
 assert.ok(Math.abs(offset(.2,1).velocity[0]/offset(.2,2).velocity[0]-4)<1e-10,'larger lever/inertia changes acceleration rather than replaying the same swing');
});

test('unforced gravity exchanges potential and kinetic energy while damping dissipates it',()=>{
 const initial={angle:[.25,-.1]},undamped=make({initial}),damped=make({initial,driver:()=>({...free,damping:[1.2,1.2]})});
 const original=energy(undamped.sample(0));let maximumError=0;
 for(let t=0;t<=8;t+=.05)maximumError=Math.max(maximumError,Math.abs(energy(undamped.sample(t))/original-1));
 assert.ok(maximumError<.03,'semi-implicit integration should bound energy error');
 assert.ok(energy(damped.sample(8))<original*.001,'damping must remove almost all free-swing energy');
 assert.ok(energy(undamped.sample(8))>original*.97,'undamped momentum cannot fade through an animation envelope');
});

test('grip changes retain angle and momentum, and passive legs lag the accelerating torso',()=>{
 const model=make({driver:t=>({...free,offset:t<.6?[.2,0]:[0,0],stiffness:t<.6?[0,0]:[2,2],damping:[.3,.3]})});
 const first=model.sample(1/120);assert.ok(first.velocity[0]>0);assert.ok(first.legVelocity[0]<0,'legs initially trail torso acceleration');
 const before=model.sample(.6-1e-6),after=model.sample(.6+1e-6);
 assert.ok(Math.abs(before.angle[0]-after.angle[0])<1e-5);assert.ok(Math.abs(before.velocity[0]-after.velocity[0])<1e-5);
 assert.ok(Math.abs(after.velocity[0])>.01,'a grip change must not erase accumulated motion');
 assert.ok(Math.abs(model.sample(.8).legVelocity[0])>.01,'passive legs keep moving during the catch');
});

test('fixed stepping is cadence independent, seekable and insulated from modified returned frames',()=>{
 const driver=t=>({...free,offset:[t<1?.18:0,.025],damping:[.7,.8],stiffness:[.2,.3]}),a=make({driver}),b=make({driver}),c=make({driver});
 for(let t=0;t<6;t+=1/30)a.sample(t);for(let t=0;t<6;t+=1/60)b.sample(t);for(let t=0;t<6;t+=1/120)c.sample(t);
 assert.deepEqual(a.sample(6.013),b.sample(6.013));assert.deepEqual(a.sample(6.013),c.sample(6.013));
 const original=a.sample(.371),fresh=make({driver}).sample(.371);assert.deepEqual(original,fresh);original.angle[0]=100;original.velocity[0]=100;assert.deepEqual(a.sample(.371),fresh);
 assert.deepEqual(a.sample(-1),a.sample(0));assert.deepEqual(a.sample(20),a.sample(10));
});

test('muscle torque and anatomical angular stops stay bounded under strong disturbances',()=>{
 const model=make({initial:{angle:[.1,-.05],velocity:[5,-4]},driver:()=>({...free,limits:[.3,.12],stiffness:[1000,1000],maxMuscleTorque:.4})});
 for(let t=.01;t<=5;t+=.01){const f=model.sample(t);assert.ok(Object.values(f).flat().every(Number.isFinite));assert.ok(Math.abs(f.angle[0])<=.3+1e-12);assert.ok(Math.abs(f.angle[1])<=.12+1e-12);assert.ok(f.legAngle.every(v=>Math.abs(v)<=.4+1e-12));assert.ok(f.muscleTorque.every(v=>Math.abs(v)<=.4+1e-12));}
});

test('invalid solver and driver inputs fail before corrupting cached motion',()=>{
 for(const bad of [{duration:0},{gravity:NaN},{step:1},{initial:{angle:[NaN,0]}},{initial:{velocity:[1]}}])assert.throws(()=>make(bad),/Invalid hanging/);
 for(const bad of [{length:NaN},{length:0},{offset:[0,Infinity]},{stiffness:[-1,0]},{damping:[0,-1]},{activation:2},{limits:[0,.2]},{legLength:0},{armLength:0},{maxMuscleTorque:-1}]){const model=make({driver:()=>({...free,...bad})});assert.throws(()=>model.sample(.1),/Invalid hanging/);assert.ok(model.sample(0).angle.every(Number.isFinite));}
});


test('free arms and legs have length-dependent natural periods instead of the same animated lag',()=>{
 const model=make({initial:{armAngle:[.12,0],legAngle:[.12,0]},driver:()=>({...free,armLength:.4,legLength:.9})});let armCross=null,legCross=null;
 for(let t=0;t<=1;t+=1/240){const f=model.sample(t);if(armCross===null&&f.armAngle[0]<0)armCross=t;if(legCross===null&&f.legAngle[0]<0)legCross=t;}
 assert.ok(armCross>0&&legCross>0);assert.ok(armCross<legCross*.8,'shorter free arm must reverse sooner than the longer leg');
 assert.ok(Math.abs(model.sample(5).armAngle[0])<.015);assert.ok(Math.abs(model.sample(5).legAngle[0])<.015);
});

test('long slow authored sets fit within the bounded solver cache',()=>{
 const model=make({duration:450});assert.ok(model.sample(450).angle.every(Number.isFinite));
 assert.throws(()=>make({duration:600,step:1/1000}),/configuration/);
});
