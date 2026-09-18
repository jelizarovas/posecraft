import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {AnimationClip,Float32BufferAttribute,Group,Quaternion,Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter3D,loadCharacter3D} from '../src/gltf-character-3d.js';
import {solveTwoBone3D} from '../src/rig-3d.js';
import {applyGripPose3D,wristTargetForGrip3D} from '../src/grip-3d.js';

// Node has no image decoder. This replaces only texture decoding; the official
// GLTFLoader still parses the real embedded geometry, skin and inverse binds.
async function asset(name='athlete') {
  const bytes=readFileSync(new URL(`../public/assets/native-3d/${name}.glb`,import.meta.url));
  const loader=new GLTFLoader();loader.register(()=>({name:'node-texture-fixture',loadTexture:async()=>new Texture()}));
  return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
}
const vector=point=>new Vector3().fromArray(point);
function verifyBones(character,world) {
  let maxError=0;
  character.root.traverse(node=>{if(!node.isBone)return;const target=world[node.name];assert.ok(target);const actual=node.getWorldPosition(new Vector3());maxError=Math.max(maxError,actual.distanceTo(vector(target.position)));const actualQ=node.getWorldQuaternion(new Quaternion());assert.ok(1-Math.abs(actualQ.dot(new Quaternion().fromArray(target.rotation)))<1e-7);});
  assert.ok(maxError<1e-6,`bone position error ${maxError}`);
}

test('both local authored assets retain different body proportions and exact native bone positions',async()=>{
  const characters=[];
  for(const name of ['athlete','regular']){
    const gltf=await asset(name),original=[];
    gltf.scene.traverse(node=>{if(node.isSkinnedMesh)original.push({node,position:node.geometry.attributes.position,weights:node.geometry.attributes.skinWeight,indices:node.geometry.attributes.skinIndex,inverse:node.skeleton.boneInverses.map(m=>m.toArray()),points:[0,50,100].map(i=>node.getVertexPosition(i,new Vector3()).applyMatrix4(node.matrixWorld))});});
    const character=createCharacter3D(gltf,{height:1.8});characters.push(character);
    assert.equal(character.metadata.bones,65);assert.equal(character.metadata.skinnedMeshes,3);
    assert.ok(character.metadata.triangles>14000);
    verifyBones(character,character.rest);
    const prior=[];character.root.traverse(node=>{if(node.isSkinnedMesh)prior.push([node,[0,50,100].map(i=>node.getVertexPosition(i,new Vector3()).applyMatrix4(node.matrixWorld))]);});
    const world=character.apply();verifyBones(character,world);
    for(const [mesh,points]of prior)for(let i=0;i<3;i++)assert.ok(mesh.getVertexPosition([0,50,100][i],new Vector3()).applyMatrix4(mesh.matrixWorld).distanceTo(points[i])<1e-6,'rest skin changed during normalization');
    for(const {node,position,weights,indices,inverse}of original){assert.equal(node.geometry.attributes.position,position);assert.equal(node.geometry.attributes.skinWeight,weights);assert.equal(node.geometry.attributes.skinIndex,indices);assert.deepEqual(node.skeleton.boneInverses.map(m=>m.toArray()),inverse);}
    const side=character.rest[character.roles.leftShoulder].position[0];assert.ok(side>0);
    assert.ok(character.rest[character.roles.leftToe].position[2]>character.rest[character.roles.leftAnkle].position[2]);
  }
  const [a,b]=characters;
  assert.ok(a.rest[a.roles.leftShoulder].position[0]-b.rest[b.roles.leftShoulder].position[0]>.05,'body proportions must come from different authored meshes');
  assert.ok(a.grips.left.position[1]-b.grips.left.position[1]>.02,'palm anchors must retain the different authored hand proportions');
  characters.forEach(c=>c.dispose());
});

test('3D IK poses and placement map to actual imported bones without modifying bind buffers',async()=>{
  const character=createCharacter3D(await asset(),{height:1.76}),buffers=[];
  character.root.traverse(node=>{if(node.isSkinnedMesh)buffers.push([node.geometry.attributes.position,new Float32Array(node.geometry.attributes.position.array)]);});
  const placement={position:[2,.5,-1],rotation:new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.9).toArray(),scale:1.25};
  const baseline=character.apply({},placement),shoulder=vector(baseline[character.roles.leftShoulder].position),target=shoulder.add(new Vector3(.15,-.25,.25)).toArray();
  const result=solveTwoBone3D(character.compiledRig,{},'leftArm',{position:target,rotation:[0,0,0,1]},{placement,poleWorld:[2,1,-.2]});
  assert.equal(result.diagnostics.status,'solved');assert.ok(result.diagnostics.error<1e-7);
  verifyBones(character,character.apply(result.pose,placement));
  const wrist=character.root.getObjectByName(character.roles.leftWrist).getWorldPosition(new Vector3());assert.ok(wrist.distanceTo(vector(target))<1e-6);
  const rootPose={[character.roles.root]:{position:[.2,.1,.3],rotation:new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.3).toArray()}};
  verifyBones(character,character.apply(rootPose));
  for(const [attribute,copy]of buffers)assert.deepEqual(attribute.array,copy);
  character.dispose();
});

test('import retains supplied animation clips and morph targets and disposes shared resources once',async()=>{
  const gltf=await asset();let mesh;gltf.scene.traverse(node=>{if(!mesh&&node.isSkinnedMesh)mesh=node;});
  const shape=new Float32BufferAttribute(new Float32Array(mesh.geometry.attributes.position.array),3);
  mesh.geometry.morphAttributes.position=[shape];mesh.updateMorphTargets();mesh.morphTargetInfluences[0]=.4;
  const clip=new AnimationClip('authored',1,[]);gltf.animations.push(clip);
  const character=createCharacter3D(gltf),geometry=mesh.geometry;let disposals=0;geometry.addEventListener('dispose',()=>disposals++);
  assert.equal(character.animations.at(-1),clip);assert.equal(mesh.geometry.morphAttributes.position[0],shape);assert.equal(mesh.morphTargetInfluences[0],.4);
  character.apply();assert.equal(mesh.morphTargetInfluences[0],.4);
  character.dispose();character.dispose();assert.equal(disposals,1);assert.equal(character.root.children.length,0);
  assert.throws(()=>character.apply(),/disposed/);
});

test('unsupported assets fail clearly instead of guessing bone roles or shearing the rig',async()=>{
  assert.throws(()=>createCharacter3D({scene:new Group()}),/No skinned mesh/);
  let gltf=await asset();gltf.scene.getObjectByName('upperarm_l').name='unknown_limb';
  assert.throws(()=>createCharacter3D(gltf),/leftShoulder/);
  const explicit=createCharacter3D(gltf,{roles:{leftShoulder:'unknown_limb'}});assert.equal(explicit.roles.leftShoulder,'unknown_limb');explicit.dispose();
  gltf=await asset();gltf.scene.getObjectByName('upperarm_l').scale.set(1,2,1);
  assert.throws(()=>createCharacter3D(gltf),/nonuniform/);
  await assert.rejects(loadCharacter3D(''),/URL/);
});

test('packaged assets are self-contained and provenance records original license and processing',()=>{
  const provenance=JSON.parse(readFileSync(new URL('../public/assets/native-3d/provenance.json',import.meta.url),'utf8'));
  assert.equal(provenance.license,'CC0-1.0');assert.equal(provenance.files.length,2);
  for(const file of provenance.files){const bytes=readFileSync(new URL('../public/assets/native-3d/'+file.file,import.meta.url));assert.ok(bytes.length<2_000_000);const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());assert.ok(json.images.every(image=>image.bufferView!==undefined&&!image.uri));assert.ok(json.buffers.every(buffer=>!buffer.uri));assert.ok(json.skins.length>0);}
});

test('declared palm frames meet the bar target and finger closure uses retained finger joints',async()=>{
  const character=createCharacter3D(await asset(),{height:1.8});
  const barRotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.6),target={position:[.3,1.1,-.2],rotation:barRotation.toArray()};
  for(const side of ['left','right']){
    const grip=character.grips[side],wrist=wristTargetForGrip3D(grip,target,1.2);
    const palm=vector(grip.position).multiplyScalar(1.2).applyQuaternion(new Quaternion().fromArray(wrist.rotation)).add(vector(wrist.position));
    assert.ok(palm.distanceTo(vector(target.position))<1e-9);
    const rotation=new Quaternion().fromArray(wrist.rotation).multiply(new Quaternion().fromArray(grip.rotation));
    assert.ok(1-Math.abs(rotation.dot(barRotation))<1e-9);
    const pose={},closed=applyGripPose3D(character.rig,pose,grip,1);assert.deepEqual(pose,{});assert.equal(grip.fingers.length,14);
    assert.ok(grip.fingers.every(f=>closed[f.joint].rotation.every(Number.isFinite)));
    assert.notDeepEqual(closed[grip.fingers[0].joint].rotation,character.rig.joints.find(j=>j.id===grip.fingers[0].joint).rotation);
    verifyBones(character,character.apply(closed));
  }
  character.dispose();
});
