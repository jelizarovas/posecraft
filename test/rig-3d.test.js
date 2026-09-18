import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion, Vector3, Matrix4} from 'three';
import {compileRig3D, evaluateRig3D, solveTwoBone3D} from '../src/rig-3d.js';

const unit = [0,0,0,1];
const v = point => new Vector3().fromArray(point);
const q = (axis, angle) => new Quaternion().setFromAxisAngle(v(axis), angle).toArray();
const near = (actual, expected, epsilon = 1e-8) => assert.ok(Math.abs(actual-expected) < epsilon, `${actual} != ${expected}`);
const pointNear = (actual, expected) => near(v(actual).distanceTo(v(expected)), 0);
const orientationNear = (a, b) => near(Math.abs(new Quaternion().fromArray(a).dot(new Quaternion().fromArray(b))), 1);
function fixture({lengths=[1,1], bend={min:0,max:Math.PI}}={}) {
  return {joints:[
    {id:'base',parent:null,position:[0,0,0],rotation:[...unit]},
    {id:'elbow',parent:'base',position:[lengths[0],0,0],rotation:[...unit]},
    {id:'hand',parent:'elbow',position:[lengths[1],0,0],rotation:[...unit]},
    {id:'finger',parent:'hand',position:[.1,0,0],rotation:[...unit]},
  ],chains:{reach:{root:'base',middle:'elbow',tip:'hand',pole:[0,1,0],bend}}};
}
function boneCheck(result, expected) {
  const {world}=result;
  near(v(world.elbow.position).distanceTo(v(world.base.position)), expected[0]);
  near(v(world.hand.position).distanceTo(v(world.elbow.position)), expected[1]);
  assert.equal(result.diagnostics.maxStretch,1);
  result.diagnostics.boneLengths.forEach((length,i)=>near(length,expected[i]));
}
function bendOf(world) {
  const upper=v(world.elbow.position).sub(v(world.base.position)).normalize();
  const lower=v(world.hand.position).sub(v(world.elbow.position)).normalize();
  return Math.acos(Math.max(-1,Math.min(1,upper.dot(lower))));
}

test('rig compile caches an immutable copy and resolves unsorted hierarchy in real 3D',()=>{
  const data=fixture(),original=structuredClone(data);
  data.joints.reverse();
  const compiled=compileRig3D(data);
  assert.ok(Object.isFrozen(compiled.joints[0].position));
  data.joints.at(-1).position[2]=100;
  const pose={base:{position:[2,3,4],rotation:q([0,1,0],Math.PI/2)}};
  const world=evaluateRig3D(compiled,pose);
  pointNear(world.hand.position,[2,3,2]);
  pointNear(new Vector3().setFromMatrixPosition(new Matrix4().fromArray(world.hand.matrix)).toArray(),world.hand.position);
  assert.deepEqual(pose,{base:{position:[2,3,4],rotation:q([0,1,0],Math.PI/2)}});
  assert.deepEqual(original.chains,data.chains);
});

test('reachable targets solve on all three axes without translating the root or stretching',()=>{
  const compiled=compileRig3D(fixture());
  for(const position of [[1,1,0],[1,0,1],[0,1,1],[-1,.3,-.8],[0,0,0],[2,0,0]]){
    const result=solveTwoBone3D(compiled,{},'reach',{position});
    assert.equal(result.diagnostics.status,'solved');
    near(result.diagnostics.error,0);
    pointNear(result.world.hand.position,position);
    pointNear(result.world.base.position,[0,0,0]);
    boneCheck(result,[1,1]);
    for(const joint of Object.values(result.world)) assert.ok([...joint.position,...joint.rotation,...joint.matrix].every(Number.isFinite));
  }
  const planar=solveTwoBone3D(compiled,{},'reach',{position:[1,1,0]});
  const forward=solveTwoBone3D(compiled,{},'reach',{position:[1,0,1]});
  assert.notDeepEqual(planar.pose.base.rotation,forward.pose.base.rotation);
});

test('unreachable targets clamp to actual chain reach, including unequal fully folded lengths',()=>{
  const compiled=compileRig3D(fixture({lengths:[1.2,.7]}));
  for(const position of [[0,0,9],[0,0,0],[.1,0,0]]){
    const result=solveTwoBone3D(compiled,{},'reach',{position});
    assert.equal(result.diagnostics.status,'unreachable');
    assert.ok(result.diagnostics.error>.3);
    boneCheck(result,[1.2,.7]);
    pointNear(result.world.base.position,[0,0,0]);
  }
});

test('explicit middle bend limits produce limited status and preserve segment lengths',()=>{
  const compiled=compileRig3D(fixture({bend:{min:Math.PI/6,max:Math.PI/2}}));
  for(const [position,expectedBend] of [[[2,0,0],Math.PI/6],[[.1,0,0],Math.PI/2]]){
    const result=solveTwoBone3D(compiled,{},'reach',{position});
    assert.equal(result.diagnostics.status,'limited');
    near(bendOf(result.world),expectedBend);
    assert.ok(result.diagnostics.error>0);
    boneCheck(result,[1,1]);
  }
});

test('world target, orientation and model pole are covariant under translated rotated scaled placement',()=>{
  const compiled=compileRig3D(fixture()),localTarget=[.8,.7,.6],desired=q([1,0,0],.7);
  const original=solveTwoBone3D(compiled,{},'reach',{position:localTarget,rotation:desired});
  const placement={position:[5,-3,2],rotation:q([0,1,0],1.1),scale:2.5},pq=new Quaternion().fromArray(placement.rotation);
  const toWorld=p=>v(p).multiplyScalar(placement.scale).applyQuaternion(pq).add(v(placement.position)).toArray();
  const targetQ=pq.clone().multiply(new Quaternion().fromArray(desired)).toArray();
  const result=solveTwoBone3D(compiled,{},'reach',{position:toWorld(localTarget),rotation:targetQ},{placement});
  assert.equal(result.diagnostics.status,'solved');
  for(const id of ['base','elbow','hand']) pointNear(result.world[id].position,toWorld(original.world[id].position));
  orientationNear(result.world.hand.rotation,targetQ);
  boneCheck(result,[2.5,2.5]);
});

test('nested root and nonaxis local bones preserve authored poses and accept explicit world poles',()=>{
  const data=fixture();
  data.joints.unshift({id:'ancestor',parent:null,position:[2,3,1],rotation:q([0,0,1],.7)});
  data.joints[1].parent='ancestor'; data.joints[1].position=[.2,.4,.1]; data.joints[1].rotation=q([0,1,0],.3);
  data.joints[2].position=[0,1,0]; data.joints[3].position=[0,0,1];
  const compiled=compileRig3D(data),pose={elbow:{rotation:q([1,0,0],.2)},hand:{rotation:q([0,1,0],.9)}};
  const saved=structuredClone(pose),before=evaluateRig3D(compiled,pose),target=v(before.base.position).add(new Vector3(.5,.4,.7)).toArray();
  const up=solveTwoBone3D(compiled,pose,'reach',{position:target},{poleWorld:[2,7,2]});
  const down=solveTwoBone3D(compiled,pose,'reach',{position:target},{poleWorld:[2,-4,2]});
  pointNear(up.world.hand.position,target); pointNear(down.world.hand.position,target);
  assert.ok(v(up.world.elbow.position).distanceTo(v(down.world.elbow.position))>1);
  boneCheck(up,[1,1]); boneCheck(down,[1,1]);
  pointNear(up.world.base.position,before.base.position);
  assert.deepEqual(up.pose.hand.rotation,saved.hand.rotation);
  assert.deepEqual(pose,saved);
});

test('collinear poles and dense target motion stay finite, deterministic and independent of camera',()=>{
  const data=fixture(); data.chains.reach.pole=[3,0,0];
  const compiled=compileRig3D(data);
  for(let i=0;i<=120;i++){
    const t=i/120*Math.PI*2,target={position:[Math.cos(t)*1.5,Math.sin(t)*.3,Math.sin(t)*.8]};
    const a=solveTwoBone3D(compiled,{},'reach',target),b=solveTwoBone3D(compiled,{},'reach',target);
    assert.deepEqual(a,b);
    near(a.diagnostics.error,0); boneCheck(a,[1,1]);
  }
  // No camera argument or projection enters compile, FK, or IK.
  assert.equal(solveTwoBone3D(compiled,{},'reach',{position:[1,0,0]}).diagnostics.status,'solved');
});

test('invalid hierarchies, limits, quaternions and pose data fail explicitly',()=>{
  const invalid=fn=>{const rig=fixture();fn(rig);assert.throws(()=>compileRig3D(rig));};
  invalid(r=>r.joints[1].id='base');
  invalid(r=>r.joints[0].parent='hand');
  invalid(r=>r.joints[1].parent='missing');
  invalid(r=>r.joints[1].rotation=[0,0,0,2]);
  invalid(r=>r.joints[1].position=[0,0,0]);
  invalid(r=>r.chains.reach.bend.max=Math.PI+.01);
  invalid(r=>r.chains.reach.bend.min=-.01);
  invalid(r=>r.chains.reach.middle='finger');
  const compiled=compileRig3D(fixture());
  assert.throws(()=>evaluateRig3D(compiled,{missing:{}}),/Unknown pose joint/);
  assert.throws(()=>evaluateRig3D(compiled,{base:{rotation:[NaN,0,0,1]}}),/finite/);
  assert.throws(()=>evaluateRig3D(compiled,{}, {scale:0}),/positive/);
  assert.throws(()=>solveTwoBone3D(compiled,{},'missing',{position:[0,0,0]}),/Unknown chain/);
  assert.throws(()=>solveTwoBone3D(compiled,{},'reach',{position:[0,0,0]},{world:'guess'}),/world must be full or chain/);
});

test('chain-only world exactly matches full IK for rotated binds, scaling, limits and unreachable targets',()=>{
  for(const bend of [{min:0,max:Math.PI},{min:.35,max:1.8}]){
    const data=fixture({lengths:[.8,.55],bend});
    data.joints.unshift({id:'ancestor',parent:null,position:[.2,.1,-.4],rotation:q([0,1,0],.8)});
    data.joints[1].parent='ancestor';data.joints[1].rotation=q([0,0,1],.4);
    data.joints[2].position=[0,.8,0];data.joints[2].rotation=q([1,0,0],.15);data.joints[3].position=[0,0,.55];
    for(let i=0;i<50;i++)data.joints.push({id:'unrelated-'+i,parent:'ancestor',position:[i*.01,.2,.3],rotation:[...unit]});
    const compiled=compileRig3D(data),placement={position:[3,2,-1],rotation:q([1,0,0],.55),scale:1.7};
    const pose={base:{rotation:q([0,0,1],.6)},finger:{rotation:q([0,1,0],.2)},'unrelated-10':{position:[.4,.5,.6]}};
    const source=structuredClone(pose),initial=evaluateRig3D(compiled,pose,placement),origin=initial.base.position;
    for(const offset of [[.3,.4,.2],[0,0,0],[5,-3,4],[.1,.05,.01],[2,0,0]])for(const explicitPole of [false,true]){
      const target={position:origin.map((n,i)=>n+offset[i]),rotation:q([0,0,1],.75)};
      const options={placement,...(explicitPole?{poleWorld:[2,4,-2]}:{})};
      const full=solveTwoBone3D(compiled,pose,'reach',target,options);
      const sparse=solveTwoBone3D(compiled,pose,'reach',target,{...options,world:'chain'});
      assert.deepEqual(sparse.pose,full.pose);
      assert.deepEqual(sparse.diagnostics,full.diagnostics);
      assert.deepEqual(Object.keys(sparse.world),['ancestor','base','elbow','hand']);
      for(const [id,joint]of Object.entries(sparse.world))assert.deepEqual(joint,full.world[id]);
      assert.deepEqual(evaluateRig3D(compiled,sparse.pose,placement),evaluateRig3D(compiled,full.pose,placement));
      // Returned data is call-local; mutating it must never corrupt bind caches.
      sparse.world.hand.position[0]=999;sparse.pose.base.rotation[0]=999;
      const again=solveTwoBone3D(compiled,pose,'reach',target,{...options,world:'chain'});
      assert.deepEqual(again.world.hand,full.world.hand);assert.deepEqual(again.pose,full.pose);
    }
    assert.deepEqual(pose,source);
  }
});
