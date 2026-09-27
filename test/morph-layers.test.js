import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {morphPath,poseDefaults,spatialParts} from '../src/spatial.js';
import {compileScene} from '../tools/compile-scene.mjs';

const fixture=()=>{
 const scene=createWwzardIllustration(),pack=scene.packs.wwzard,part=pack.parts.find(part=>part.spatial?.morph);
 const left=pack.joints[1].id+'.bend',right=pack.joints[2].id+'.bend';
 part.d='M0 0L10 20Z';part.spatial.morph={channel:'root.bend',target:'M0 0L20 10Z',layers:[
  {channel:left,target:'M0 0L14 24Z',frames:[{value:.5,target:'M0 0L12 22Z'}]},
  {channel:right,target:'M0 0L8 26Z'}
 ]};
 return {scene,pack,part,left,right};
};

test('two bend layers add independent displacements to the primary shape',()=>{
 const {pack,part,left,right}=fixture(),pose=poseDefaults(pack);
 assert.equal(morphPath(part,.5,pose),'M0 0L15 15Z');
 pose[left]=.5;
 assert.equal(morphPath(part,.5,pose),'M0 0L17 17Z');
 pose[right]=1;
 assert.equal(morphPath(part,.5,pose),'M0 0L15 23Z');
 pose[left]=2;pose[right]=-1;
 assert.equal(morphPath(part,.5,pose),'M0 0L19 19Z','each layer clamps independently');
 assert.equal(morphPath(part,0,pose),'M0 0L14 24Z','a layer deforms the base contour without primary bend');
 assert.equal(part.d,'M0 0L10 20Z');
 const frame={pose,world:{root:{rotation:0}}};
 assert.equal(spatialParts(pack,frame).parts.get(part.id).d,'M0 0L14 24Z');
});

test('layer edits invalidate cached geometry and no-layer morph remains exact',()=>{
 const {part,left,right}=fixture(),pose={[left]:.5,[right]:0};
 assert.equal(morphPath(part,1,pose),'M0 0L22 12Z');
 part.spatial.morph.layers[0].frames[0].target='M0 0L13 23Z';
 assert.equal(morphPath(part,1,pose),'M0 0L23 13Z');
 part.spatial.morph.layers=[];
 assert.equal(morphPath(part,1,pose),part.spatial.morph.target);
 assert.equal(morphPath(part,0,pose),part.d);
});

test('layers survive JSON reopening and reject invalid shape contracts',()=>{
 const {scene,part}=fixture(),saved=assertDocument(JSON.parse(JSON.stringify(scene)));
 assert.deepEqual(saved.packs.wwzard.parts.find(item=>item.id===part.id).spatial.morph,part.spatial.morph);
 const bad=change=>{const copy=structuredClone(scene);change(copy.packs.wwzard.parts.find(item=>item.id===part.id).spatial.morph);assert.equal(validateDocument(copy).valid,false);};
 bad(m=>m.layers[0].channel='root.rotation');
 bad(m=>m.layers[0].target='M0 0L10 20Q1 2 3 4Z');
 bad(m=>m.layers[0].extra=true);
 bad(m=>m.layers[0].frames=[{value:1,target:part.d}]);
 bad(m=>m.layers=Array.from({length:9},()=>({channel:'root.bend',target:part.d})));
});

test('up to eight independent morph layers are accepted and nine are rejected',()=>{
 const {scene,pack,part}=fixture();
 part.spatial.morph.layers=Array.from({length:9},(_,i)=>{
  const id='inputAxis'+i;pack.joints.push({id,parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
  return {channel:id+'.bend',target:'M0 0L14 24Z'};
 });
 assert.equal(validateDocument(scene).valid,false);
 part.spatial.morph.layers.pop();assert.equal(validateDocument(scene).valid,true);
});

test('compiled website retains additive morph layers',async()=>{
 const {scene,part}=fixture(),output=await fs.mkdtemp(path.resolve('test-results/morph-layers-'));
 await compileScene(scene,output);
 const html=await fs.readFile(path.join(output,'index.html'),'utf8');
 const embedded=html.match(/<script id="posecraft-scene" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(embedded);
 const shipped=JSON.parse(embedded).packs.wwzard.parts.find(item=>item.id===part.id);
 assert.deepEqual(shipped.spatial.morph.layers,part.spatial.morph.layers);
});
