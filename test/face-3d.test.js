import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {Texture,Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createCharacter3D} from '../src/gltf-character-3d.js';
import {workoutFace3D} from '../src/face-3d.js';

test('both bundled faces blink and emote through their own skinned artwork without replacing surfaces',async()=>{
 for(const name of ['athlete','regular']){
  const loader=new GLTFLoader();loader.register(()=>({name:'test-textures',loadTexture:async()=>new Texture()}));
  const b=await fs.readFile(new URL('../public/assets/native-3d/'+name+'.glb',import.meta.url));
  const character=createCharacter3D(await loader.parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),''),{height:1.75});
  try{
   const eyes=character.root.getObjectByName('Eyes'),brows=character.root.getObjectByName('Eyebrows'),vertex=new Vector3();
   const span=()=>{let min=Infinity,max=-Infinity;for(let i=0;i<eyes.geometry.attributes.position.count;i++){eyes.getVertexPosition(i,vertex);min=Math.min(min,vertex.y);max=Math.max(max,vertex.y);}return max-min;};
   character.applyFace();const open=span(),boneCount=character.metadata.bones;
   character.applyFace({blink:1,tired:1});assert.ok(span()<open*.15,name+' eyes close without inversion');
   character.applyFace({strain:.9});assert.ok(brows.morphTargetInfluences[brows.morphTargetDictionary.strain]>.8);
   character.applyFace();assert.ok(Math.abs(span()-open)<1e-6);assert.equal(character.metadata.bones,boneCount);
  }finally{character.dispose();}
 }
});

test('effort and fatigue drive separate facial controls and seeking is deterministic',()=>{
 const effort=workoutFace3D({phase:'pull-up',exertion:{intensity:.9}},7,{fatigue:70}),idle=workoutFace3D({phase:'rest'},7,{fatigue:70});
 assert.ok(effort.strain>idle.strain);assert.ok(idle.tired>effort.tired);
 assert.deepEqual(effort,workoutFace3D({phase:'pull-up',exertion:{intensity:.9}},7,{fatigue:70}));
});
