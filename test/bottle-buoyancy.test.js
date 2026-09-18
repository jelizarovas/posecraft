import test from 'node:test';
import assert from 'node:assert/strict';
import {createBottle} from '../examples/bottle.js';
import {BottleFluid} from '../src/bottle-fluid.js';
import {LiquidWaves} from '../src/liquid-waves.js';

function simulation(){const document=createBottle();document.fluid.wind=0;return new BottleFluid(document);}
const advance=(sim,count)=>{for(let i=0;i<count;i++)sim.tick(1/120);};

test('off-center crests roll the corresponding hull side despite a flat center sample',()=>{
 for(const side of [-1,1]){
  const sim=simulation(),u=sim.ship.x+side*52,index=Math.round((u-sim.surface.low)/(sim.surface.high-sim.surface.low)*32);
  sim.waves.heights[index]=8;sim.surface=sim.makeSurface();
  assert.equal(sim.surface.heightAt(sim.ship.x),0);
  assert.equal(sim.surface.slopeAt(sim.ship.x),0);
  sim.tick(1/120);
  assert.ok(side*sim.ship.omega>.004,'Distributed immersion produces torque without a center-slope cue');
 }
});

test('ship-only vertical and angular motion transfers energy to still water and settles',()=>{
 for(const initial of [{vy:35},{omega:.45}]){
  const sim=simulation(),rest={...sim.ship};Object.assign(sim.ship,initial);
  assert.equal(sim.waves.energy,0);advance(sim,120);
  assert.ok(sim.waves.energy>.01,'Hull displacement excites water without bottle or wind input');
  assert.equal(sim.bottle.vx,0);assert.equal(sim.bottle.vy,0);assert.equal(sim.bottle.omega,0);
  advance(sim,3600);
  assert.ok(sim.waves.energy<1e-5,'Exchange remains damped');
  assert.ok(Math.abs(sim.ship.y-rest.y)<.001);assert.ok(Math.abs(sim.ship.angle)<.001);
  assert.ok(Math.abs(sim.surface.area-sim.surface.targetArea)<sim.surface.targetArea*1e-7);
 }
});

test('localized hull reaction is bounded, finite, zero-mean and uses a fixed wave pool',()=>{
 const waves=new LiquidWaves();waves.react(.37,1.4);
 assert.ok(waves.velocities[12]>.3);
 assert.ok(Math.abs(waves.velocities.reduce((sum,value)=>sum+value,0))<1e-12);
 for(let i=0;i<1200;i++){waves.react((i%33)/32,(i%2?1:-1)*1e9);waves.tick(1/120,{force:0,turn:0,damping:.1});}
 assert.equal(waves.heights.length,33);assert.equal(waves.velocities.length,33);
 assert.ok([...waves.heights,...waves.velocities].every(Number.isFinite));
 assert.ok(Math.max(...waves.velocities.map(Math.abs))<=85);
 assert.ok(waves.energy<=36);assert.ok(Math.abs(waves.heights.reduce((sum,value)=>sum+value,0))<1e-10);
});

test('hull coupling stays bounded at minimum mass and damping under repeated impacts',()=>{
 const sim=simulation();sim.config.ship.mass=.1;sim.config.damping=.1;
 for(let i=0;i<1200;i++){
  if(i%60===0)sim.command({type:'nudge',ax:2500*Math.sin(i),ay:1700*Math.cos(i)});
  sim.tick(1/120);
  assert.ok(Object.values(sim.ship).every(Number.isFinite));
  assert.ok(Math.abs(sim.ship.vx)<=250&&Math.abs(sim.ship.vy)<=250&&Math.abs(sim.ship.omega)<=5);
  assert.ok(sim.waves.drops.length<=16);
  assert.ok(Math.abs(sim.surface.area-sim.surface.targetArea)<sim.surface.targetArea*1e-7);
 }
});
