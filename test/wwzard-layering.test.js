import assert from 'node:assert/strict';
import test from 'node:test';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {evaluateDrawing} from '../src/render-evaluation.js';
import {sampleClip} from '../src/index.js';

test('furniture occludes the lower robe while hands and shoulders keep their own depth through every clip',()=>{
  const scene=JSON.parse(JSON.stringify(createWwzardIllustration()));
  const player=new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
  try{
    for(const [name,clip] of Object.entries(scene.packs.wwzard.clips))for(let t=0;t<=clip.duration+.001;t+=.1){
      player.previewClip('wwzard',name,Math.min(t,clip.duration));
      const paired=!!scene.packs.screen.clips[name];
      const frame=player.previewClip('screen',paired?name:'still',paired?Math.min(t,clip.duration):0);
      const closed=frame.actors.find(a=>a.id==='screen').pose['hinge.bend']===1;
      const pose=sampleClip(clip,Math.min(t,clip.duration));
      const commands=evaluateDrawing(scene,frame).units.flatMap(unit=>unit.commands).filter(c=>c.visible);
      const index=(actor,part,fragment)=>commands.findIndex(c=>c.pick?.actor===actor&&(!part||c.pick.part===part)&&(!fragment||c.pick.fragment===fragment));
      const keys=index('keyboard'),hand=index('wwzard','right-hand'),sleeve=index('wwzard','right-sleeve','right-sleeve--depth-high');
      const body=index('wwzard','robe-soft-shoulder'),face=index('wwzard','neck'),hat=index('wwzard','hat-front-brim');
      assert.ok(keys>=0&&hand>=0&&sleeve>=0&&body>=0&&face>=0&&hat>=0,'all occluding surfaces render');
      const tucked=pose['leftArm.z']<-35;
      const farTucked=pose['rightArm.z']<-15;
      const gripping=pose['leftGrip.opacity']>.01;
      if(!farTucked)assert.ok(keys<hand&&keys<sleeve,`${name} ${t}: the far arm is drawn above the keyboard`);
      if(!closed)assert.ok(hand<face&&sleeve<face&&hand<hat,`${name} ${t}: the face and hat occlude the far forearm`);
      const lower=index('wwzard','robe-body'),fold=index('wwzard','robe-front-fold'),desk=index('desk','desk-top'),lid=index('screen','lid-back'),nearHand=index('wwzard','left-hand');
      assert.ok(lower>=0&&fold>=0&&desk>=0&&lid>=0&&nearHand>=0);
      assert.ok(index('wwzard','right-sleeve','right-sleeve--depth-low')<lower,`${name} ${t}: far shoulder stays behind the robe`);
      const nearUpper=index('wwzard','left-sleeve','left-sleeve--depth-low');
      // The near sleeve starts at depth 2 and crosses the desk's depth 5.
      const raisedWave=pose['waveNear.z']>3;
      if(raisedWave)assert.ok(lower<nearUpper&&body<nearUpper&&desk<nearUpper,`${name} ${t}: waved forearm clears the desk in front of the robe`);
      else assert.ok(lower<nearUpper&&body<nearUpper&&nearUpper<desk,`${name} ${t}: resting near shoulder stays in front of torso shading and behind the desk`);
      assert.ok(lower<desk&&fold<desk&&desk<keys,`${name} ${t}: desk and keyboard must cover the untrimmed lower robe`);
      if(tucked)assert.ok(nearHand<desk,`${name} ${t}: lowered near hand tucks behind the desk`);
      else if(closed&&pose['leftArm.z']>0)assert.ok(lid<nearHand&&index('screen','lid-top-edge')<nearHand,`${name} ${t}: closed cover and rim stay beneath the supported forearm`);
      else if(gripping){
        const fingers=index('wwzard','left-grip-fingers'),rim=index('screen','lid-top-edge');
        assert.ok(nearHand<lid&&lid<fingers&&fingers<rim&&hand<desk,`${name} ${t}: only fingertips wrap over the cover, beneath the corner rim`);
      }
      else assert.ok(keys<nearHand&&nearHand<lid&&hand<lid,`${name} ${t}: hands must sit between keyboard and laptop lid`);
      if(farTucked)assert.ok(hand<desk,`${name} ${t}: lowered far hand stays behind the desk`);
      if(pose['rightArm.z']>0)assert.ok(closed&&lid<hand&&index('screen','lid-top-edge')<hand,`${name} ${t}: raised far palm is supported only by the closed lid`);
    }
  } finally {player.dispose();}
});
