import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {assertDocument} from '../src/schema.js';
import {poseDefaults,spatialParts,morphPath} from '../src/spatial.js';
import {forwardKinematics,sampleClip} from '../src/index.js';
import {renderSVG} from '../src/svg.js';
import {compileScene} from '../tools/compile-scene.mjs';

const numbers=pathData=>(pathData.match(/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g)||[]).map(Number);
const morphParts=scene=>scene.packs.wwzard.parts.filter(part=>part.spatial?.morph);
const controller=scene=>new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
const pathFromSVG=(svg,id)=>{
  const safe=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return svg.match(new RegExp(`<path data-source-part="${safe}"[^>]* d="([^"]+)"`))?.[1];
};

test('Wwzard deforms actual rendered paths while rigid transforms stay neutral',()=>{
  const scene=createWwzardIllustration(),pack=scene.packs.wwzard,parts=morphParts(scene),player=controller(scene);
  try{
    assert.ok(parts.length>=2,'at least two silhouette parts need saved shape targets');
    const base=player.frame(),source=base.actors.find(actor=>actor.id==='wwzard');
    const sample=value=>{
      const pose=poseDefaults(pack);
      for(const part of parts)pose[part.spatial.morph.channel]=value;
      const actor={...source,pose,world:forwardKinematics(pack.joints,pose)};
      const frame={...base,actors:base.actors.map(item=>item.id==='wwzard'?actor:item)};
      return {spatial:spatialParts(pack,actor),svg:renderSVG(scene,frame)};
    };
    const rest=sample(0),deformed=sample(1);
    for(const part of parts){
      const before=rest.spatial.parts.get(part.id),after=deformed.spatial.parts.get(part.id);
      assert.deepEqual(before.matrix,after.matrix,`${part.id} should not move its rigid matrix when only bend changes`);
      assert.notEqual(before.d,after.d,`${part.id} must change path geometry`);
      assert.equal(pathFromSVG(rest.svg,part.id),before.d,`${part.id} rest path reaches SVG output`);
      assert.equal(pathFromSVG(deformed.svg,part.id),after.d,`${part.id} bent path reaches SVG output`);
    }
    assert.deepEqual(player.document,scene,'render sampling does not mutate editable artwork');
  }finally{player.dispose();}
});

test('authored bend tracks change paths continuously through full clips',()=>{
  const scene=createWwzardIllustration(),pack=scene.packs.wwzard,clips=Object.entries(pack.clips);
  for(const part of morphParts(scene)){
    const channel=part.spatial.morph.channel,source=numbers(part.d),target=numbers(part.spatial.morph.target);
    assert.equal(source.length,target.length,`${part.id} target must preserve path topology`);
    assert.ok(source.some((value,i)=>Math.abs(value-target[i])>1),`${part.id} needs a visible geometric target`);
    const relevant=clips.filter(([,clip])=>clip.tracks[channel]?.some((key,i,all)=>i&&Math.abs(key[1]-all[0][1])>.1));
    assert.ok(relevant.length,`${part.id} morph channel ${channel} needs authored motion`);
    const largest=Math.max(...source.map((value,i)=>Math.abs(value-target[i])));
    for(const [name,clip] of relevant){
      let previous=numbers(morphPath(part,sampleClip(clip,0)[channel]));
      for(let i=1;i<=Math.ceil(clip.duration*60);i++){
        const time=Math.min(i/60,clip.duration),current=numbers(morphPath(part,sampleClip(clip,time)[channel]));
        assert.equal(current.length,previous.length,`${name}/${part.id} changes topology at ${time}s`);
        for(let coordinate=0;coordinate<current.length;coordinate++){
          assert.ok(Number.isFinite(current[coordinate]),`${name}/${part.id} has a nonfinite point`);
          assert.ok(Math.abs(current[coordinate]-previous[coordinate])<=largest*.35+.1,`${name}/${part.id} jumps at ${time.toFixed(3)}s`);
        }
        previous=current;
      }
    }
  }
});

test('morph targets and bend clips survive JSON reopening and compiled website export',async()=>{
  const scene=createWwzardIllustration(),reopened=assertDocument(JSON.parse(JSON.stringify(scene))),parts=morphParts(scene);
  assert.ok(parts.length>=2);
  for(const part of parts){
    assert.deepEqual(reopened.packs.wwzard.parts.find(saved=>saved.id===part.id).spatial.morph,part.spatial.morph);
    const channel=part.spatial.morph.channel;
    for(const [name,clip] of Object.entries(scene.packs.wwzard.clips))assert.deepEqual(reopened.packs.wwzard.clips[name].tracks[channel],clip.tracks[channel]);
  }
  await fs.mkdir('test-results',{recursive:true});
  const output=await fs.mkdtemp(path.resolve('test-results/wwzard-deformation-'));
  const manifest=await compileScene(reopened,output),html=await fs.readFile(path.join(output,'index.html'),'utf8');
  assert.equal(manifest.runtime,'illustration');
  const embedded=html.match(/<script id="posecraft-scene" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embedded,'compiled website embeds reopenable scene JSON');
  const shipped=JSON.parse(embedded);
  for(const part of parts)assert.deepEqual(shipped.packs.wwzard.parts.find(saved=>saved.id===part.id).spatial.morph,part.spatial.morph);
  assert.deepEqual(shipped.packs.wwzard.clips,scene.packs.wwzard.clips);
});

test('far and near shoulders straddle the robe while forearms cross furniture at authored depths',()=>{
  const scene=createWwzardIllustration(),player=controller(scene);
  try{
    const parts=scene.packs.wwzard.parts;
    const far=parts.find(part=>part.id==='right-sleeve').spatial.depthSplit;
    const near=parts.find(part=>part.id==='left-sleeve').spatial.depthSplit;
    assert.deepEqual([far.axis,far.at,far.low.value,far.high.value],['x',17,-10,20]);
    assert.deepEqual([near.axis,near.at,near.low.value,near.high.value],['x',10,2,40]);
    assert.equal(parts.find(part=>part.id==='left-sleeve-shadow').spatial.surfaceOf,'left-sleeve');
    assert.equal(scene.actors.find(actor=>actor.id==='desk').depth.value,5);
    assert.equal(scene.actors.find(actor=>actor.id==='keyboard').depth.value,10);
    assert.equal(scene.actors.find(actor=>actor.id==='wwzard').depth.value,30);
    assert.equal(scene.actors.find(actor=>actor.id==='screen').depth.value,50);
    const svg=renderSVG(scene,player.frame());
    const positions=['data-fragment-use="right-sleeve--depth-low"','data-scene-unit="actor:desk"','data-scene-unit="actor:keyboard"','data-fragment-use="right-sleeve--depth-high"','data-scene-unit="actor:wwzard"','data-fragment-use="left-sleeve--depth-high"','data-scene-unit="actor:screen"'].map(marker=>svg.indexOf(marker));
    assert.ok(positions.every(index=>index>=0),`missing rendered depth unit: ${positions}`);
    assert.ok(positions.every((index,i)=>i===0||positions[i-1]<index),`rendered depth order is wrong: ${positions}`);
  }finally{player.dispose();}
});
