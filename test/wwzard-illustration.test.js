import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {assertDocument} from '../src/schema.js';
import {inspectSceneFeatures,createSceneExport} from '../src/scene-export.js';
import {compileScene} from '../tools/compile-scene.mjs';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {sampleClip,wrapAngle} from '../src/index.js';
import {evaluateDrawing} from '../src/render-evaluation.js';

// Independent sky and viewer-facing wave drawings add up to 4 KiB of source.
// Shipped playback retains the existing 100 KiB compressed budget.
const limits={sceneJSON:132*1024,transferGzip:100*1024,parts:250};
const controller=scene=>new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
function until(player,predicate,seconds=20){
  for(let i=0;i<seconds*30;i++){
    const frame=player.step(1/30);
    if(predicate(frame))return frame;
  }
  assert.fail(`Wwzard did not reach the expected behavior within ${seconds}s; current state ${player.frame().behavior.state}`);
}

test('typing diamonds fade away before reactions and stay absent during rest',()=>{
  const scene=JSON.parse(JSON.stringify(createWwzardIllustration())),player=controller(scene);
  const visible=frame=>evaluateDrawing(scene,frame).units.flatMap(unit=>unit.commands).filter(command=>command.pick?.part?.startsWith('magic-')&&command.opacity>.01);
  try{
    const births=new Map();
    for(let i=0;i<288;i++)for(const command of visible(player.previewClip('wwzard','work',i/60)))if(!births.has(command.pick.part))births.set(command.pick.part,i/60);
    assert.equal(births.size,4);assert.equal(new Set(births.values()).size,4,'diamonds must appear at different times');
    assert.equal(visible(player.previewClip('wwzard','work',4.3)).length,0,'typing effects finish before the action changes');
    for(const [name,clip] of Object.entries(scene.packs.wwzard.clips))if(name.split('--')[0]!=='work')for(let t=0;t<clip.duration;t+=.1)assert.equal(visible(player.previewClip('wwzard',name,t)).length,0,`${name} cannot spawn typing diamonds`);
    player.clearPreview('wwzard');player.dispatch('visitor');
    let visibleWork=false,reacted=false;
    for(let i=0;i<420;i++){
      const frame=player.step(1/30),actor=frame.actors.find(actor=>actor.id==='wwzard'),count=visible(frame).length;
      if(actor.activity==='work'&&count)visibleWork=true;
      if(actor.activity==='greet')reacted=true;
      if(actor.activity&&actor.activity!=='work')assert.equal(count,0,'saved live behavior must gate the effects too');
    }
    assert.ok(visibleWork&&reacted,'exercise both actual typing and a visitor reaction');
  }finally{player.dispose();}
});

test('Wwzard is reproducible, editable scene data with a bounded vector asset',()=>{
  const first=createWwzardIllustration(),second=createWwzardIllustration();
  assert.deepEqual(first,second,'the same authoring call must produce the same scene and seed');
  assert.equal(first.presentation,'live');
  assertDocument(first);
  const saved=JSON.stringify(first),reopened=JSON.parse(saved);
  assertDocument(reopened);
  assert.deepEqual(reopened,first,'save/reopen preserves artwork, motion and behavior data');
  assert.ok(Buffer.byteLength(saved)<=limits.sceneJSON,`scene JSON uses ${Buffer.byteLength(saved)} bytes`);
  const parts=Object.values(first.packs).reduce((count,pack)=>count+pack.parts.length,0);
  assert.ok(parts>0&&parts<=limits.parts,`${parts} vector parts exceed the ${limits.parts} part budget`);
  const gradients=Object.values(first.packs).flatMap(pack=>pack.parts).filter(part=>part.gradient);
  assert.ok(gradients.length>0,'the replacement artwork must retain editable authored gradients');
  assert.ok(Object.values(first.packs).some(pack=>Object.keys(pack.clips).length>1),'the performance needs authored actions beyond one loop');
  assert.ok(first.behaviorGraph&&Number.isInteger(first.behaviorGraph.seed),'behavior seed belongs in the saved scene');
  assert.ok(first.interactions?.length,'the host needs an authored interaction');
  assert.equal(inspectSceneFeatures(reopened).runtime,'illustration');
  assert.ok(!reopened.game,'semantic input must not force the physics player');
});

test('Wwzard character and acting clips can play in a second scene',()=>{
  const scene=createWwzardIllustration(),second={schemaVersion:1,kind:'scene',id:'wwzard-second-scene',name:'Wwzard character test',revision:0,bounds:{width:513,height:529},requiredFeatures:['rigs','paths','instances','timelines','input-states','spatial-rig','part-gradients'],packs:{wwzard:structuredClone(scene.packs.wwzard),screen:structuredClone(scene.packs.screen)},actors:['wwzard','screen'].map(id=>structuredClone(scene.actors.find(actor=>actor.id===id)))};
  second.presentation='live';
  second.behaviorGraph=structuredClone(scene.behaviorGraph);
  second.interactions=structuredClone(scene.interactions);
  assert.notEqual(second.id,scene.id);
  assertDocument(second);
  assert.deepEqual(second.packs.wwzard,scene.packs.wwzard,'the new scene uses the same editable character and clips');
  assert.deepEqual(second.behaviorGraph,scene.behaviorGraph,'the same saved decisions and actions play in the new scene');
  const player=controller(second);
  try{
    assert.equal(player.previewClip('wwzard', 'greet',1).actors[0].clip,'greet');
    player.clearPreview('wwzard');player.dispatch('visitor');
    assert.equal(until(player,frame=>frame.behavior.state==='greeting',10).actors[0].activity,'greet');
  }finally{player.dispose();}
});

test('Wwzard website export stays within its transfer budget and omits physics and 3D',async()=>{
  const scene=createWwzardIllustration(),exported=createSceneExport(scene,{local:true});
  assert.equal(exported.manifest.runtime,'illustration');
  assert.equal(exported.manifest.runtimeURL,'./runtime/illustration.js');
  assert.ok(exported.html.includes('posecraft-scene'));
  await fs.mkdir('test-results',{recursive:true});
  const root=await fs.mkdtemp(path.resolve('test-results/wwzard-export-'));
  const manifest=await compileScene(scene,root);
  assert.equal(manifest.runtime,'illustration');
  const modules=manifest.files.flatMap(file=>file.modules);
  assert.ok(!modules.some(id=>/planck|(?:^|\/)physics\.js|(?:^|\/)scene-3d\.js|(?:^|\/)native-3d/i.test(id)),`unexpected simulation module: ${modules.filter(id=>/planck|physics|3d/i.test(id)).join(', ')}`);
  const html=await fs.readFile(path.join(root,'index.html'));
  const gzipRuntime=(await Promise.all(manifest.files.map(async file=>gzipSync(await fs.readFile(path.join(root,'runtime',file.file))).length))).reduce((sum,size)=>sum+size,0);
  const transferGzip=gzipRuntime+gzipSync(html).length;
  assert.ok(transferGzip<=limits.transferGzip,`website transfer ${transferGzip} gzip bytes exceeds ${limits.transferGzip}`);
  const report={sceneBytes:Buffer.byteLength(JSON.stringify(scene)),parts:Object.values(scene.packs).reduce((n,p)=>n+p.parts.length,0),runtimeGzipBytes:gzipRuntime,htmlGzipBytes:gzipSync(html).length,transferGzipBytes:transferGzip,runtimeFiles:manifest.files.length,features:manifest.features};
  await fs.writeFile('test-results/wwzard-export-budget.json',JSON.stringify(report,null,2)+'\n');
});

test('visitor input waits for an authored boundary, remembers a visitor and recovers from repeated input',()=>{
  const player=controller(createWwzardIllustration());
  try{
    assert.equal(player.frame().behavior.state,'working');
    player.dispatch('visitor');
    const early=player.step(1/30);
    assert.equal(early.behavior.state,'working','a visitor cannot cut off the work action');
    const greeting=until(player,frame=>frame.behavior.state==='greeting',10);
    assert.equal(greeting.behavior.variables.familiar,false);
    assert.equal(greeting.actors.find(actor=>actor.id==='wwzard').activity,'greet');
    for(let i=0;i<8;i++)player.dispatch('visitor');
    let frame=player.step(1/30);
    assert.equal(frame.behavior.state,'greeting','input during the response stays pending');
    assert.equal(frame.behavior.variables.attention,4,'repeated attention is bounded');
    assert.equal(frame.behavior.variables.pending,true);
    const overwhelmed=until(player,next=>next.behavior.state==='overwhelmed',15);
    assert.equal(overwhelmed.behavior.variables.familiar,true,'the first completed response changes later choices');
    assert.equal(overwhelmed.actors.find(actor=>actor.id==='wwzard').activity,'frustrated');
    player.dispatch('quiet');
    frame=player.step(1/30);
    assert.equal(frame.behavior.state,'overwhelmed','quiet waits for the response to complete');
    assert.equal(frame.behavior.variables.pending,false);
    assert.equal(frame.behavior.variables.attention,0);
    const settled=until(player,next=>next.behavior.state==='settled',12);
    assert.equal(settled.behavior.variables.pending,false);
    assert.ok(settled.behavior.pendingEvents<=16);
    assert.ok(settled.behavior.droppedEvents===0);
    player.dispatch('visitor');
    const curious=until(player,next=>next.behavior.state==='curious',12);
    assert.equal(curious.behavior.variables.familiar,true);
    assert.equal(curious.actors.find(actor=>actor.id==='wwzard').activity,'curious');
  }finally{player.dispose();}
});

test('every Wwzard clip moves continuously through holds and its endpoint at 60 Hz',()=>{
  const clips=createWwzardIllustration().packs.wwzard.clips;
  for(const [name,clip] of Object.entries(clips)){
    let previous=sampleClip(clip,0);
    for(let i=1;i<=Math.ceil(clip.duration*60);i++){
      const time=Math.min(i/60,clip.duration),pose=sampleClip(clip,time);
      for(const [channel,value] of Object.entries(pose)){
        if(channel.endsWith('.z')&&clip.tracks[channel].some(key=>key[2]==='step'))continue; // Draw order intentionally switches while hands clear the desk.
        const delta=channel.endsWith('.rotation')?Math.abs(wrapAngle(value-previous[channel])):Math.abs(value-previous[channel]);
        // The Angry lid closes in 270 ms. Its attached wrist traverses the
        // lid arc at up to 10.89 px/frame in X and 8.02 px/frame in Y at 60 Hz.
        // Allow only those two wrist channels during the authored slam.
        const slamWrist=['laptop--angry','close--angry'].includes(name)&&time>1.55&&time<=1.82+1/60&&
          (channel==='leftHand.x'||channel==='leftHand.y');
        const limit=slamWrist?(channel==='leftHand.x'?11.2:8.3):channel.endsWith('.rotation')?8:4;
        assert.ok(delta<limit,`${name} ${channel} jumps ${delta.toFixed(2)} at ${time.toFixed(3)}s`);
      }
      previous=pose;
    }
  }
});

test('saved Wwzard behavior replays the same seeded motion and interaction outcome',()=>{
  const source=createWwzardIllustration(),reopened=JSON.parse(JSON.stringify(source));
  const first=controller(source),second=controller(reopened);
  try{
    for(let i=0;i<360;i++){
      if(i===3||i===210){first.dispatch('visitor');second.dispatch('visitor');}
      if(i===310){first.dispatch('quiet');second.dispatch('quiet');}
      const a=first.step(1/30),b=second.step(1/30);
      if(i%30===0){assert.deepEqual(a.behavior,b.behavior);assert.deepEqual(a.actors.find(actor=>actor.id==='wwzard').pose,b.actors.find(actor=>actor.id==='wwzard').pose);}
    }
    const atTwelve=first.frame();
    const replayed=first.seek(first.time);
    assert.deepEqual(replayed.behavior,atTwelve.behavior,'seek reconstructs memory and pending events');
    assert.deepEqual(replayed.actors.find(actor=>actor.id==='wwzard').pose,atTwelve.actors.find(actor=>actor.id==='wwzard').pose);
  }finally{first.dispose();second.dispose();}
});
