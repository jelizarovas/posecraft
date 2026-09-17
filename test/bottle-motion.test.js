import test from 'node:test';
import assert from 'node:assert/strict';
import {BottleMotionSignal} from '../src/bottle-browser.js';
import {PhoneMotion} from '../src/device-motion.js';
test('bottle phone signal separates steady gravity from linear and angular impulses',()=>{
 const signal=new BottleMotionSignal();assert.equal(signal.update({acceleration:{x:null,y:null}},0),false);
 signal.update({acceleration:{x:0,y:0},accelerationIncludingGravity:{x:0,y:9.81},rotationRate:{alpha:0}},0);assert.deepEqual(signal.sample(0),{ax:0,ay:0,turn:0,gravityX:0,gravityY:1});
 signal.update({acceleration:{x:4,y:-2},accelerationIncludingGravity:{x:4,y:7.81},rotationRate:{alpha:70}},16);let f=signal.sample(16);assert.equal(f.ax,340);assert.equal(f.ay,170);assert.equal(f.turn,-70);assert.equal(f.gravityX,0);assert.equal(f.gravityY,1);
 f=signal.sample(2000);assert.ok(Math.abs(f.ax)<.01&&Math.abs(f.turn)<.01);assert.equal(f.gravityY,1);
 for(let t=32;t<2000;t+=16)signal.update({acceleration:{x:0,y:0},accelerationIncludingGravity:{x:-9.81,y:0}},t);
 f=signal.sample(2000);assert.ok(f.gravityX>.999&&Math.abs(f.gravityY)<.001);assert.equal(f.ax,0);
 signal.reset();signal.update({acceleration:{x:1,y:0},accelerationIncludingGravity:{x:1,y:9.81}},0,90);f=signal.sample(0);assert.ok(Math.abs(f.ax)<.0001&&Math.abs(f.ay-85)<.0001);assert.ok(f.gravityX<-.999);
});
test('bottle phone fallback filters accelerometer gravity and tolerates gyro-only readings',()=>{
 const signal=new BottleMotionSignal();signal.update({accelerationIncludingGravity:{x:0,y:9.81}},0);assert.equal(signal.sample(0).ax,0);signal.update({accelerationIncludingGravity:{x:4,y:9.81}},16);assert.ok(signal.sample(16).ax>300);signal.reset();signal.update({rotationRate:{alpha:90}},100);assert.equal(signal.sample(100).turn,-90);assert.equal(signal.sample(100).gravityY,1);signal.reset();assert.equal(signal.sample(200).turn,0);
});
test('phone permission is explicit and disable removes the bottle sensor listener',async()=>{
 const listeners=new Map();let requests=0,permission='denied';const env={DeviceMotionEvent:{requestPermission:async()=>{requests++;return permission;}},performance:{now:()=>100},screen:{orientation:{angle:0}},addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:key=>listeners.delete(key)},phone=new PhoneMotion({environment:env,signal:new BottleMotionSignal()});
 assert.equal(requests,0);assert.equal(await phone.enable(),false);assert.equal(listeners.size,0);permission='granted';assert.equal(await phone.enable(),true);listeners.get('devicemotion')({acceleration:{x:5,y:0},accelerationIncludingGravity:{x:5,y:9.81},rotationRate:{alpha:40}});assert.equal(phone.signal.sample(100).ax,425);phone.disable();assert.equal(listeners.size,0);assert.equal(phone.signal.sample(100).ax,0);
});
