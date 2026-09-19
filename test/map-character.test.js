import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleMapActor} from '../src/map-character.js';

test('map feet advance along world travel, including vertical and diagonal screen directions',()=>{
  for(let facing=0;facing<Math.PI*2;facing+=Math.PI/4){
    const a=sampleMapActor({facing,phase:Math.PI*.2,walking:true}),b=sampleMapActor({facing,phase:Math.PI*.3,walking:true});
    const dx=b.limbs[0].foot.x-a.limbs[0].foot.x,dy=b.limbs[0].foot.y-a.limbs[0].foot.y;
    assert.ok(Math.abs(dx*a.stride.y-dy*a.stride.x)<1e-8,'Foot stride follows projected world travel');
    assert.ok(dx*a.stride.x+dy*a.stride.y<0,'Planted foot opposes forward travel');
  }
});

test('stance foot offsets cancel root translation at the runtime distance-based phase rate',()=>{
  const facing=.7,phase=.5,distance=.04,a=sampleMapActor({facing,phase,walking:true}),b=sampleMapActor({facing,phase:phase+distance*Math.PI*2,walking:true});
  assert.equal(a.limbs[0].gait.stance,true);assert.equal(b.limbs[0].gait.stance,true);
  const root={x:(Math.cos(facing)-Math.sin(facing))*32*distance,y:(Math.cos(facing)+Math.sin(facing))*16*distance};
  assert.ok(Math.abs(b.limbs[0].foot.x+root.x-a.limbs[0].foot.x)<1e-8);
  assert.ok(Math.abs(b.limbs[0].foot.y+root.y-a.limbs[0].foot.y)<1e-8);
});

test('body rotates continuously while travel direction remains independent',()=>{
  const sample=sampleMapActor({facing:Math.PI/4,travelFacing:-Math.PI/4,phase:1,walking:true});
  assert.ok(Math.abs(sample.forward.x)<1e-8);assert.ok(Math.abs(sample.stride.y)<1e-8);assert.ok(sample.stride.x>.99);
  for(const facing of [0,Math.PI/4,Math.PI/2,Math.PI,-Math.PI]){
    const a=sampleMapActor({facing:facing-1e-5,phase:1,walking:true}),b=sampleMapActor({facing:facing+1e-5,phase:1,walking:true});
    for(let i=0;i<2;i++)for(const joint of ['hip','knee','foot','shoulder','elbow','hand'])assert.ok(Math.hypot(a.limbs[i][joint].x-b.limbs[i][joint].x,a.limbs[i][joint].y-b.limbs[i][joint].y)<.001);
  }
});

test('idle and reduced motion keep both feet planted regardless of saved gait phase',()=>{
  for(const reduced of [false,true])for(const phase of [0,1,Math.PI,100]){
    const sample=sampleMapActor({facing:1,phase,walking:reduced},reduced);
    assert.equal(sample.bob,0);for(const limb of sample.limbs){assert.equal(limb.gait.forward,0);assert.equal(limb.gait.lift,0);}
  }
});

test('turning in place uses neutral feet even while a movement command is active',()=>{
  for(const phase of [0,1,Math.PI]){
    const sample=sampleMapActor({facing:1,travelFacing:-2,phase,walking:true,gaitWeight:0});
    assert.equal(sample.moving,false);assert.equal(sample.bob,0);
    for(const limb of sample.limbs){assert.equal(limb.gait.forward,0);assert.equal(limb.gait.lift,0);}
  }
});
