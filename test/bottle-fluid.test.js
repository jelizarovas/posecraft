import test from 'node:test';
import assert from 'node:assert/strict';
import {createBottle,bottleBoundary} from '../examples/bottle.js';
import {BottleFluid,waterSurface,polygonArea} from '../src/bottle-fluid.js';
import {poseDefaults} from '../src/spatial.js';
import {forwardKinematics} from '../src/index.js';
const base=d=>({time:0,actors:d.actors.map(a=>{const p=d.packs[a.pack],pose=poseDefaults(p);return {id:a.id,pose,world:forwardKinematics(p.joints,pose),inputs:{},state:p.initial,response:'calm',physics:null,spring:{x:0,y:0,vx:0,vy:0}};})});
const setup=(wind=0)=>{const d=createBottle();d.fluid.wind=wind;const sim=new BottleFluid(d),frame=base(d);return {d,sim,frame,view:()=>sim.apply(frame)};};
const advance=(sim,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)sim.tick(1/120);};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const inside=(p,polygon)=>{let result=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)result=!result;}return result;};

test('concave chamber conserves water area at every angle including the neck and upside down',()=>{
 const boundary=bottleBoundary();for(const fill of [.1,.28,.65])for(let deg=-180;deg<=180;deg+=5){const angle=deg*Math.PI/180,r=waterSurface(boundary,{x:Math.sin(angle),y:Math.cos(angle)},fill);assert.ok(Math.abs(r.area-r.targetArea)<r.targetArea*1e-7);assert.equal(r.targetArea,polygonArea(boundary)*fill);assert.ok(r.waterPath.startsWith('M'));assert.ok(!/NaN|Infinity/.test(r.waterPath+r.surfacePath));}
});

test('calm boat floats at rest, sails stay slack and frame/source data are not mutated',()=>{
 const {d,sim,frame,view}=setup(),before=structuredClone(d),source=structuredClone(frame),initial=view().fluid;advance(sim,20);const f=view();assert.ok(distance(f.fluid.bottle,initial.bottle)<.001);assert.ok(distance(f.fluid.ship,initial.ship)<.001);assert.ok(Math.abs(f.fluid.ship.rotation)<.001);assert.equal(f.actors.find(a=>a.id==='ship').pose['main-sail.bend'],0);assert.deepEqual(d,before);assert.deepEqual(frame,source);assert.deepEqual(f.actors.find(a=>a.id==='ship').world,forwardKinematics(d.packs.ship.joints,f.actors.find(a=>a.id==='ship').pose));
});

test('one grip preserves its anchor and swings under gravity; two grips control exact angle',()=>{
 const {sim,view}=setup();sim.command({type:'grab',points:[{id:1,x:300,y:150}]});advance(sim,1);const one=view().fluid;assert.equal(one.grabbed,1);assert.ok(Math.abs(one.bottle.rotation)>2);const a=one.bottle.rotation*Math.PI/180,anchor={x:one.bottle.x-100*Math.cos(a)+70*Math.sin(a),y:one.bottle.y-100*Math.sin(a)-70*Math.cos(a)};assert.ok(distance(anchor,{x:300,y:150})<1e-7);
 sim.reset();sim.command({type:'grab',points:[{id:1,x:300,y:220},{id:2,x:500,y:220}]});sim.command({type:'move',points:[{id:1,x:400,y:120},{id:2,x:400,y:320}]});sim.tick(1/120);const two=view().fluid;assert.equal(two.grabbed,2);assert.ok(Math.abs(two.bottle.rotation-90)<1e-6);assert.ok(distance(two.bottle,{x:400,y:220})<1e-6);assert.ok(Math.abs(two.normal.x)>.99);
 const before=two.bottle;sim.command({type:'release',points:[{id:1,x:400,y:120}]});assert.deepEqual(view().fluid.bottle,before);sim.tick(1/120);assert.ok(distance(view().fluid.bottle,before)<6);sim.command({type:'cancel',points:[]});advance(sim,20);assert.ok(distance(view().fluid.bottle,{x:400,y:220})<.01);assert.ok(Math.abs(view().fluid.bottle.rotation)<.01);
});

test('shakes create inertial slosh and boat motion, including pure angular sensor input',()=>{
 const {sim,view}=setup();const start=view().fluid.ship;sim.command({type:'nudge',ax:1100,ay:-350});advance(sim,.6);assert.ok(view().fluid.slosh>.01);assert.ok(view().fluid.paths['water-glints'].startsWith('M'));assert.ok(distance(view().fluid.ship,start)>1);sim.reset();sim.command({type:'motion',ax:0,ay:0,turn:120,gravityX:0,gravityY:1});advance(sim,1);assert.ok(Math.abs(view().fluid.bottle.rotation)>1);assert.ok(view().fluid.slosh>0);
 sim.reset();sim.command({type:'motion',ax:0,ay:0,turn:0,gravityX:1,gravityY:0});advance(sim,8);assert.ok(view().fluid.normal.x>.99);
});

test('wind pushes and rolls the ship in either direction and inflates both directions of sail',()=>{
 const left=setup(-2),right=setup(2);advance(left.sim,1);advance(right.sim,1);const l=left.view(),r=right.view();assert.ok(r.fluid.ship.x-l.fluid.ship.x>10);assert.ok(r.fluid.ship.rotation>l.fluid.ship.rotation);for(const f of [l,r])assert.ok(f.actors.find(a=>a.id==='ship').pose['main-sail.bend']>.5);
});

test('fixed stepping is cadence-independent, resets exactly and previews can exclude the simulation',()=>{
 const a=setup(.6),b=setup(.6),command={type:'nudge',ax:500,ay:-120};a.sim.command(command);b.sim.command(command);for(let i=0;i<120;i++)a.sim.tick(1/60);for(let i=0;i<60;i++)b.sim.tick(1/30);assert.deepEqual(a.view(),b.view());a.sim.reset();assert.deepEqual(a.view(),setup(.6).view());assert.equal(a.sim.apply(a.frame,{disabledActors:new Set(['ship'])}),a.frame);assert.throws(()=>a.sim.tick(Infinity));
});

test('sustained extreme input remains finite, contained and area-conserving',()=>{
 const {sim,view,d}=setup(2);let contacts=0;for(let i=0;i<1800;i++){if(i%20===0)sim.command({type:'motion',ax:Math.sin(i)*6000,ay:Math.cos(i*.7)*6000,turn:Math.sin(i*.1)*720,gravityX:Math.sin(i*.02),gravityY:Math.cos(i*.02)});sim.tick(1/120);if(i%10===0){const f=view().fluid;contacts+=f.contacts;assert.ok([f.bottle.x,f.bottle.y,f.bottle.rotation,f.ship.x,f.ship.y,f.ship.rotation,f.slosh].every(Number.isFinite));assert.ok(inside(f.ship,d.fluid.boundary));assert.ok(Math.abs(f.area-f.targetArea)<f.targetArea*1e-7);assert.ok(Math.abs(f.bottle.vx)<=700&&Math.abs(f.bottle.vy)<=700);assert.ok(distance(f.bottle,{x:400,y:220})<300);}}assert.ok(contacts>0);
});


test('hull and mast contact samples stay inside the bottle at high fill and maximum ship size',()=>{
 const samples=[[-117,-16],[121,-16],[78,33],[-74,33],[-7,-147],[72,-120],[150,-47]];
 for(const fill of [.1,.65]){const d=createBottle();d.fluid.fill=fill;d.fluid.ship.scale=1;const sim=new BottleFluid(d),frame=base(d);for(let i=0;i<600;i++){if(i%30===0)sim.command({type:'motion',ax:1000*Math.sin(i),ay:600*Math.cos(i),turn:150,gravityX:Math.sin(i*.01),gravityY:Math.cos(i*.01)});sim.tick(1/120);if(i%10===0){const ship=sim.apply(frame).fluid.ship,a=ship.rotation*Math.PI/180;for(const [x,y]of samples)assert.ok(inside({x:ship.x+x*Math.cos(a)-y*Math.sin(a),y:ship.y+x*Math.sin(a)+y*Math.cos(a)},d.fluid.boundary),'Ship contact sample remains contained');}}}
});


test('invalid chamber and command data fail before entering the simulation',()=>{
 const d=createBottle();d.fluid.boundary=[{x:0,y:0},{x:10,y:10},{x:0,y:10},{x:10,y:0}];assert.throws(()=>new BottleFluid(d),/boundary/);const {sim}=setup();for(const command of [{type:'wind',value:Infinity},{type:'move',points:[]},{type:'grab',points:[{id:1,x:0,y:0},{id:1,x:2,y:2}]},{type:'motion',ax:0,ay:0,turn:NaN}])assert.throws(()=>sim.command(command));
});
