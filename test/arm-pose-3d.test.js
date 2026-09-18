import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Quaternion,Texture,Vector3} from 'three';
import {relaxedArmGoal} from '../src/arm-pose-3d.js';
import {createCharacter3D} from '../src/gltf-character-3d.js';
import {evaluateRig3D,solveTwoBone3D} from '../src/rig-3d.js';

const v=point=>new Vector3().fromArray(point);
async function character(asset){const data=readFileSync(new URL(`../public/assets/native-3d/${asset}.glb`,import.meta.url)),loader=new GLTFLoader();loader.register(()=>({name:'node-textures',loadTexture:async()=>new Texture()}));return createCharacter3D(await loader.parseAsync(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength),''),{height:1.75});}

test('relaxed goals keep a constant reachable arm radius through forward/back swing and heading',()=>{
  for(const sign of [-1,1])for(const length of [.35,.6])for(const heading of [0,Math.PI/2,Math.PI,-Math.PI/3])for(const swing of [-.15,0,.15]){
    const shoulder=[.2,1.4,-.3],goal=relaxedArmGoal({shoulder,sign,length,heading,swing}),inverse=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),-heading);
    assert.ok(Math.abs(v(goal.hand).distanceTo(v(shoulder))-length*.975)<1e-10);
    const localHand=v(goal.hand).sub(v(shoulder)).applyQuaternion(inverse),localPole=v(goal.pole).sub(v(shoulder)).applyQuaternion(inverse);
    assert.ok(localHand.y<0);assert.ok(localPole.z<0);assert.ok(localHand.x*sign>0);
    assert.ok(goal.hand.every(Number.isFinite)&&goal.pole.every(Number.isFinite));
  }
});

test('both authored skeletons bend elbows behind wrists and retain inward relaxed palms',async()=>{
  for(const asset of ['athlete','regular']){
    const model=await character(asset);
    for(const side of ['left','right'])for(const heading of [0,Math.PI/2,Math.PI])for(const swing of [-.05,0,.05]){
      const chain=model.rig.chains[side+'Arm'],sign=side==='left'?1:-1,placement={position:[.3,0,.2],rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),heading).toArray(),scale:1};
      const before=evaluateRig3D(model.compiledRig,{},placement),shoulder=before[chain.root].position;
      const lengths=[v(before[chain.root].position).distanceTo(v(before[chain.middle].position)),v(before[chain.middle].position).distanceTo(v(before[chain.tip].position))];
      const goal=relaxedArmGoal({shoulder,sign,length:lengths[0]+lengths[1],heading,swing});
      const result=solveTwoBone3D(model.compiledRig,{},side+'Arm',{position:goal.hand},{placement,poleWorld:goal.pole,world:'chain'});
      assert.equal(result.diagnostics.status,'solved');assert.ok(result.diagnostics.error<1e-8);assert.equal(result.diagnostics.maxStretch,1);
      const inverse=new Quaternion().fromArray(placement.rotation).invert(),elbow=v(result.world[chain.middle].position).sub(v(shoulder)).applyQuaternion(inverse),hand=v(result.world[chain.tip].position).sub(v(shoulder)).applyQuaternion(inverse);
      assert.ok(elbow.z<hand.z-.005,`${asset} ${side}: elbow must sit behind wrist`);
      assert.ok(elbow.y>hand.y&&elbow.y<0,'elbow remains between shoulder and wrist vertically');
      // The known source palm normal is ±localX. A relaxed hand should face the
      // body, without imposing a camera-facing wrist quaternion on the solve.
      const palm=new Vector3(sign,0,0).applyQuaternion(new Quaternion().fromArray(result.world[chain.tip].rotation)).applyQuaternion(inverse);
      assert.ok(palm.x*sign<-.7,`${asset} ${side}: palm rolled away from the body (${palm.x})`);
      for(const [i,pair]of [[chain.root,chain.middle],[chain.middle,chain.tip]].entries())assert.ok(Math.abs(v(result.world[pair[0]].position).distanceTo(v(result.world[pair[1]].position))-lengths[i])<1e-9);
    }
    model.dispose();
  }
});

test('relaxed arm inputs reject nonfinite and invalid measurements',()=>{
  const args={shoulder:[0,1,0],sign:1,length:.5};
  assert.throws(()=>relaxedArmGoal({...args,length:0}),/positive/);
  assert.throws(()=>relaxedArmGoal({...args,heading:NaN}),/finite/);
  assert.throws(()=>relaxedArmGoal({...args,sign:0}),/sign/);
});
