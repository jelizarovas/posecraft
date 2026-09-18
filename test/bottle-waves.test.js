import test from 'node:test';
import assert from 'node:assert/strict';
import {createBottle} from '../examples/bottle.js';
import {BottleFluid,polygonArea} from '../src/bottle-fluid.js';
import {BottleMotionSignal} from '../src/bottle-browser.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';

const makeDocument=()=>{const d=createBottle();d.fluid.wind=0;return d;};
const frame={time:0,actors:[]};
const fluid=sim=>sim.apply(frame).fluid;
const advance=(sim,seconds,inspect=()=>{})=>{for(let i=0;i<Math.round(seconds*120);i++){sim.tick(1/120);if(i%4===0)inspect(fluid(sim));}};
function inChamber(p,boundary){
 let inside=false,distance=Infinity;
 for(let i=0,j=boundary.length-1;i<boundary.length;j=i++){
  const a=boundary[j],b=boundary[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));
  distance=Math.min(distance,Math.hypot(p.x-a.x-dx*t,p.y-a.y-dy*t));
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }
 return inside||distance<.02;
}
const pathPolygons=path=>(path.match(/M[^M]+/g)||[]).map(section=>{const values=section.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi).map(Number);return Array.from({length:values.length/2},(_,i)=>({x:values[i*2],y:values[i*2+1]}));});
const spread=values=>Math.max(...values)-Math.min(...values);
function assertWater(f,boundary){
 assert.ok(Number.isFinite(f.waveAmplitude)&&f.waveAmplitude>=0);
 assert.ok(Number.isInteger(f.waveParticles)&&f.waveParticles>=0&&f.waveParticles<=16);
 assert.ok(!/NaN|Infinity|undefined/.test(f.waterPath+f.surfacePath+f.splashPath+f.foamPath));
 assert.ok(Math.abs(polygonArea(f.waterPolygon)-f.bulkArea)<f.targetArea*1e-6,'visible bulk geometry matches its reported volume');
 assert.ok(Math.abs(f.bulkArea+f.splashArea-f.targetArea)<f.targetArea*1e-6,'bulk plus airborne water conserves volume');
 assert.ok(Math.abs(f.area-f.targetArea)<f.targetArea*1e-6);
 for(const p of [...f.waterPolygon,...f.surfaceSamples])assert.ok(inChamber(p,boundary),'surface and bulk vertices stay inside the glass');
 const drops=pathPolygons(f.splashPath);assert.equal(drops.length,f.waveParticles,'every simulated droplet has visible geometry');
 assert.ok(Math.abs(drops.reduce((sum,p)=>sum+polygonArea(p),0)-f.splashArea)<.02,'visible droplets account for removed bulk water');
 for(const p of drops.flat())assert.ok(inChamber(p,boundary),'splash vertices stay inside the glass');
 assert.equal(f.paths['front-wave-edge'],f.surfacePath,'the rendered edge follows the actual water boundary');
}

test('still water has no idle wave loop; a shake deforms the actual surface and produces bounded splashes',()=>{
 const d=makeDocument(),sim=new BottleFluid(d);advance(sim,1,f=>{assert.equal(f.waveAmplitude,0);assert.equal(f.waveParticles,0);assert.equal(f.splashPath,'');assertWater(f,d.fluid.boundary);});
 sim.command({type:'nudge',ax:1500,ay:-500});let wave=0,particles=0,foam=false,nonflat=false;
 advance(sim,3,f=>{assertWater(f,d.fluid.boundary);wave=Math.max(wave,f.waveAmplitude);particles=Math.max(particles,f.waveParticles);foam||=f.foamPath.length>0;nonflat||=spread(f.surfaceSamples.map(p=>p.x*f.normal.x+p.y*f.normal.y))>1;});
 assert.ok(wave>1,'shake creates a visibly displaced surface');assert.ok(nonflat,'water surface has crests instead of a tilted straight line');assert.ok(particles>0,'a strong shake launches visible droplets');assert.ok(foam,'crests show foam');
 advance(sim,22);const quiet=fluid(sim);assert.ok(quiet.waveAmplitude<.1,'waves decay without new input');assert.equal(quiet.waveParticles,0);assert.equal(quiet.splashPath,'');assertWater(quiet,d.fluid.boundary);
});

test('real phone gravity changes excite waves even with zero linear acceleration, then settle at held tilt',()=>{
 const d=makeDocument(),sim=new BottleFluid(d),signal=new BottleMotionSignal();let peak=0;
 for(let i=0;i<180;i++){
  const tilt=i<12?0:Math.PI/3,time=i*1000/60;
  signal.update({acceleration:{x:0,y:0},accelerationIncludingGravity:{x:-9.81*Math.sin(tilt),y:9.81*Math.cos(tilt)},rotationRate:{alpha:0}},time);
  const reading=signal.sample(time);assert.equal(reading.ax,0);assert.equal(reading.ay,0);sim.command({type:'motion',...reading});sim.tick(1/60);peak=Math.max(peak,fluid(sim).waveAmplitude);
 }
 assert.ok(peak>.5,'changing gravity alone excites the free surface');advance(sim,25);const final=fluid(sim);assert.ok(final.waveAmplitude<.1,'held phone tilt is not a perpetual wave source');assert.ok(final.normal.x>.8);assertWater(final,d.fluid.boundary);
});

test('wave, foam and splash state agree in full/lite controllers and replay exactly',()=>{
 const d=makeDocument(),a=new SceneController(d),b=new IllustrationController(d,{fluidFactory:BottleFluid}),signal=new BottleMotionSignal();let droplets=0,amplitude=0;
 try{
  for(let i=0;i<180;i++){
   const time=i*1000/60,pulse=i>=20&&i<35?8:0;
   signal.update({acceleration:{x:pulse,y:-pulse/3},accelerationIncludingGravity:{x:pulse-4.9,y:8.5-pulse/3},rotationRate:{alpha:pulse*10}},time);
   const command={type:'motion',...signal.sample(time)};a.fluidInput(command);b.fluidInput(command);
   const full=a.step(1/60).fluid,lite=b.step(1/60).fluid;assert.deepEqual(full,lite);assertWater(full,d.fluid.boundary);droplets=Math.max(droplets,full.waveParticles);amplitude=Math.max(amplitude,full.waveAmplitude);
  }
  assert.ok(amplitude>1);assert.ok(droplets>0,'sensor shakes produce splashes, not only button nudges');
  for(const c of [a,b]){const expected=c.frame().fluid,time=c.time;c.seek(.25);assert.deepEqual(c.seek(time).fluid,expected);}
 }finally{a.dispose();b.dispose();}
});

test('wave geometry remains finite and volume-conserving through inverted and vertical bottle orientations',()=>{
 const d=makeDocument(),sim=new BottleFluid(d);
 for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]){
  sim.command({type:'motion',ax:600*Math.cos(angle),ay:600*Math.sin(angle),turn:80,gravityX:Math.sin(angle),gravityY:Math.cos(angle)});
  advance(sim,.8,f=>assertWater(f,d.fluid.boundary));
 }
 sim.command({type:'motion',ax:0,ay:0,turn:0,gravityX:0,gravityY:1});advance(sim,1,f=>assertWater(f,d.fluid.boundary));
});
