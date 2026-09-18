import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BENCH_SIZE_3D,benchBodyGeometry3D} from '../src/bench-geometry-3d.js';

test('default narrow bench has coherent seat and floor contact dimensions',()=>{
  const parts=benchBodyGeometry3D(),pad=parts.find(p=>p.id==='pad'),feet=parts.filter(p=>p.id.endsWith('-foot'));
  assert.deepEqual(DEFAULT_BENCH_SIZE_3D,[.32,.48,1.9]);assert.ok(Object.isFrozen(DEFAULT_BENCH_SIZE_3D));
  assert.equal(pad.position[1]+pad.size[1]/2,DEFAULT_BENCH_SIZE_3D[1]);
  for(const foot of feet){assert.equal(foot.size[0],.46);assert.equal(foot.position[1]-foot.size[1]/2,0);assert.ok(.30-foot.size[0]/2>.06,'foot center .30m lies outside bench base');}
  const rail=parts.find(p=>p.id==='rail');assert.ok(Math.abs(rail.position[1]+rail.size[1]/2-(pad.position[1]-pad.size[1]/2))<1e-12);for(const leg of parts.filter(p=>p.id.endsWith('-leg')))assert.equal(leg.position[1]+leg.size[1]/2,rail.position[1]-rail.size[1]/2);
});

test('custom body dimensions retain seat/floor alignment and do not mutate caller data',()=>{
  const size=[.4,.6,2.2],copy=[...size],parts=benchBodyGeometry3D(size),pad=parts[0];
  assert.deepEqual(size,copy);assert.equal(pad.size[0],.4);assert.equal(pad.size[2],2.2);assert.ok(Math.abs(pad.position[1]+pad.size[1]/2-.6)<1e-12);
  assert.ok(parts.every(p=>p.size.every(v=>v>0&&Number.isFinite(v))));
  parts[0].size[0]=99;assert.equal(benchBodyGeometry3D()[0].size[0],.32);
  assert.throws(()=>benchBodyGeometry3D([.3,0,2]),/Bench size/);
});
