import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics,spatialParts} from '../src/spatial.js';
import {evaluateSkinnedMesh} from '../src/skinned-mesh.js';

const scene=createGym(),pack=scene.packs.atlas,body=pack.parts.find(p=>p.id==='trunk').spatial.mesh;
const bindPose={'leftUpper.rotation':180,'rightUpper.rotation':0,'leftThigh.rotation':90,'rightThigh.rotation':90};
const bind=evaluateSkinnedMesh(body,spatialKinematics(pack,bindPose),bindPose).vertices;
const neck=bind.flatMap((p,i)=>p.y< -75&&body.vertices[i].weights.every(w=>w.joint==='torso')?[i]:[]);

test('Atlas collar is narrow and upper chest stays below the jaw rather than forming a high barrel',()=>{
 assert.ok(neck.length>=8);
 assert.ok(Math.max(...neck.map(i=>bind[i].x))-Math.min(...neck.map(i=>bind[i].x))<=18,'slender neck connects head to shoulders');
 const chest=bind.filter((p,i)=>p.y>=-75&&p.y<=-40&&body.vertices[i].weights.some(w=>w.joint==='torso'&&w.weight>=.45));
 assert.ok(chest.length>20);assert.ok(Math.max(...chest.map(p=>p.z))-Math.min(...chest.map(p=>p.z))<=31,'chest thickness preserves the approved profile');
});

test('directional head and beard remain in front of the neck through both profiles and intermediate turns',()=>{
 for(const time of [0,1,1.5,2,2.5,3,3.5,4,6,8,8.5,9,9.5,10,10.5,11.5]){
  const pose=sampleClip(pack.clips.turnaround,time),view=spatialParts(pack,{pose,inputs:{}}),mesh=view.parts.get('trunk').mesh,front=Math.max(...neck.map(i=>mesh.vertices[i].depth));
  assert.ok(view.parts.get('head-shape').depth>front+1,`neck should stay behind the head at ${time}s`);
  const beard=view.parts.get('beard');if(beard.visible)assert.ok(beard.depth>front+1,`neck should not cut through beard at ${time}s`);
 }
});
