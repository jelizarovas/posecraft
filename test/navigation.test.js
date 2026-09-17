import test from 'node:test';
import assert from 'node:assert/strict';
import {PathJob} from '../src/navigation.js';
const scene={bounds:{width:400,height:300},props:[{id:'wall',x:200,y:150,rotation:0,collider:{enabled:true,x:0,y:0,width:30,height:160}}]};
test('incremental routing goes around inflated obstacles and respects its node budget',()=>{
 const job=new PathJob(scene,{start:{x:40,y:150},end:{x:360,y:150},cellSize:10,clearance:5});
 while(!job.done){const before=job.expanded;job.step(8);assert.ok(job.expanded-before<=8);}
 assert.ok(job.result.path.length>32);for(const p of job.result.path)assert.equal(job.solid(job.index(p)),false);
 assert.ok(job.result.path.some(p=>p.y<=55||p.y>=245));
});
test('blocked destinations return no path, disabled boxes allow straight routes, invalid requests fail',()=>{
 const blocked=new PathJob(scene,{start:{x:40,y:150},end:{x:200,y:150}});blocked.step();assert.equal(blocked.result.path,null);
 const empty=structuredClone(scene);empty.props[0].collider.enabled=false;const open=new PathJob(empty,{start:{x:40,y:150},end:{x:360,y:150},cellSize:10});while(!open.done)open.step();assert.equal(open.result.path.length,33);
 assert.throws(()=>new PathJob(scene,{start:{x:-1,y:0},end:{x:300,y:200}}));assert.throws(()=>new PathJob({bounds:{width:4096,height:4096}},{start:{x:10,y:10},end:{x:300,y:200},cellSize:8}),/16384/);
});
