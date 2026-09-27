import assert from 'node:assert/strict';
import test from 'node:test';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {assertDocument} from '../src/schema.js';
import {sampleClip,forwardKinematics} from '../src/index.js';

test('normal closed idle keeps wrists planted while only the fingers tap',()=>{
  const {packs:{wwzard:pack}}=createWwzardIllustration();
  const anchor=forwardKinematics(pack.joints,sampleClip(pack.clips.close,pack.clips.close.duration));
  let taps=0;
  for(const name of ['closed-idle','closed-pause']){
    const clip=pack.clips[name];
    for(let i=0;i<=Math.ceil(clip.duration*60);i++){
      const pose=sampleClip(clip,Math.min(i/60,clip.duration)),world=forwardKinematics(pack.joints,pose);
      for(const hand of ['leftHand','rightHand']){
        assert.deepEqual(world[hand],anchor[hand],`${name}/${hand} must stay supported throughout the lean and pause`);
        const bend=pose[hand+'.bend']||0;
        assert.ok(bend>=0&&bend<=.4,'finger taps stay subtle');
        if(bend>0)taps++;
      }
    }
  }
  assert.ok(taps>0,'the supported hands still have authored finger movement');
  // A release must travel directly to rest, without visiting the elbow-rest
  // pose or dropping below the desk and immediately rising again.
  const closing=pack.clips.close,channel='leftGrip.bend';
  const end=sampleClip(closing,closing.duration)[channel];
  let previous=sampleClip(closing,3.8)[channel];
  for(let t=3.8;t<=closing.duration;t+=1/60){
    const value=sampleClip(closing,t)[channel];
    assert.ok(value>=previous-1e-6&&value<=end+1e-6,'close release moves directly into the supported anchor');
    previous=value;
  }
});

const player=()=>new IllustrationController(assertDocument(JSON.parse(JSON.stringify(createWwzardIllustration()))),{
  behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction,
});
const actor=(frame,id)=>frame.actors.find(item=>item.id===id);
test('rest slides hands toward the body before lowering without an arm swing',()=>{
 const scene=createWwzardIllustration(),pack=scene.packs.wwzard;
 for(const suffix of ['','--angry','--disappointed']){
  const clip=pack.clips['rest'+suffix];
  assert.ok(clip.duration<=2.2);
  const start=forwardKinematics(pack.joints,sampleClip(clip,0));
  const pulled=forwardKinematics(pack.joints,sampleClip(clip,.3));
  const lowered=forwardKinematics(pack.joints,sampleClip(clip,.7));
  for(const side of ['left','right']){
   assert.ok(pulled[side+'Hand'].x<start[side+'Hand'].x-35,'hand slides back toward the torso');
   assert.ok(Math.abs(lowered[side+'Hand'].x-pulled[side+'Hand'].x)<8,'lowering stays close to the torso');
   assert.ok(lowered[side+'Hand'].y>pulled[side+'Hand'].y+60,'hand lowers after clearing the back edge');
   for(let t=0;t<=clip.duration;t+=1/60)assert.equal(sampleClip(clip,t)[side+'Arm.rotation'],0,'tucking deforms the sleeve instead of swinging its shoulder');
  }
 }
});
function until(controller,predicate,seconds=45){
  for(let i=0;i<seconds*30;i++){
    const frame=controller.step(1/30);
    if(predicate(frame))return frame;
  }
  assert.fail(`Expected behavior was not reached; current state: ${controller.frame().behavior.state}`);
}
const matched=(frame,clip)=>{
  assert.equal(actor(frame,'wwzard').clip,clip);
  assert.equal(actor(frame,'screen').clip,clip);
  assert.equal(actor(frame,'wwzard').clipTime,actor(frame,'screen').clipTime);
};

test('every mood uses one exact closed anchor across close, idle, pause, and open clips',()=>{
  const scene=assertDocument(createWwzardIllustration());
  for(const mood of ['','--disappointed','--angry'])for(const packName of ['wwzard','screen']){
    const clips=scene.packs[packName].clips;
    const names=['close','closed-idle','closed-pause','open'].map(name=>name+mood);
    const points=[
      [names[0],clips[names[0]].duration],
      [names[1],0],[names[1],clips[names[1]].duration],
      [names[2],0],[names[2],clips[names[2]].duration],
      [names[3],0],
    ];
    const poses=points.map(([name,time])=>sampleClip(clips[name],time));
    const channels=new Set(poses.flatMap(pose=>Object.keys(pose)));
    for(const channel of channels){
      const at=pose=>pose[channel]??(channel.endsWith('.opacity')?1:0);
      for(let i=1;i<poses.length;i++)assert.ok(Math.abs(at(poses[i])-at(poses[0]))<.0001,
        `${packName}/${mood||'normal'} ${channel} differs at ${points[i][0]} ${points[i][1]}`);
    }
  }
});

test('close holds the lid closed through authored idle and pause until an explicit open',()=>{
  const controller=player();
  try{
    controller.dispatch('close-laptop');
    let frame=controller.step(1/30);
    assert.equal(frame.behavior.state,'closingLaptop','close interrupts the current work phrase');
    assert.equal(frame.behavior.variables.laptopRequestedClosed,true);
    frame=until(controller,frame=>frame.behavior.state==='closingLaptop');
    matched(frame,'close');
    frame=until(controller,frame=>frame.behavior.state==='closedIdle');
    assert.equal(frame.behavior.variables.laptopClosed,true);
    matched(frame,'closed-idle');
    frame=until(controller,frame=>frame.behavior.state==='closedPause');
    matched(frame,'closed-idle');
    assert.equal(frame.behavior.actions.wwzard.active,false);
    assert.equal(frame.behavior.actions.screen.active,false);
    frame=until(controller,frame=>frame.behavior.state==='closedIdle');
    assert.equal(frame.behavior.variables.laptopClosed,true);
    controller.dispatch('open-laptop');
    frame=until(controller,frame=>frame.behavior.state==='openingLaptop');
    matched(frame,'open');
    frame=until(controller,frame=>frame.behavior.state==='working');
    assert.equal(frame.behavior.variables.laptopClosed,false);
    assert.equal(frame.behavior.variables.laptopRequestedClosed,false);
  }finally{controller.dispose();}
});

test('open starts on the next tick during a static closed pause',()=>{
  const scene=assertDocument(createWwzardIllustration());
  const controller=player();
  try{
    controller.dispatch('close-laptop');
    const paused=until(controller,frame=>frame.behavior.state==='closedPause');
    const at=paused.behavior.time;
    assert.equal(paused.behavior.actions.wwzard.active,false);
    assert.equal(paused.behavior.actions.screen.active,false);
    assert.equal(actor(paused,'wwzard').clipTime,scene.packs.wwzard.clips['closed-idle'].duration);
    assert.equal(actor(paused,'screen').clipTime,scene.packs.screen.clips['closed-idle'].duration);
    controller.dispatch('open-laptop');
    const opening=controller.step(1/30);
    assert.equal(opening.behavior.state,'openingLaptop');
    assert.ok(opening.behavior.time-at<.05,'the static hold does not delay the open command');
    matched(opening,'open');
  }finally{controller.dispose();}
});

test('the last command wins during a moving lid and repeat requests are idempotent',()=>{
  const controller=player();
  try{
    controller.dispatch('laptop'); // Existing callers request a close.
    let frame=until(controller,frame=>frame.behavior.state==='closingLaptop');
    matched(frame,'close');
    controller.dispatch('open-laptop');
    controller.dispatch('close-laptop');
    frame=controller.step(1/30);
    assert.equal(frame.behavior.variables.laptopRequestedClosed,true);
    frame=until(controller,frame=>frame.behavior.state==='closedIdle');
    assert.equal(frame.behavior.variables.laptopClosed,true);
    const enteredAt=frame.behavior.enteredAt;
    controller.dispatch('close-laptop');
    frame=controller.step(1/30);
    assert.equal(frame.behavior.state,'closedIdle');
    assert.equal(frame.behavior.enteredAt,enteredAt,'repeat close does not restart the idle action');
    assert.equal(frame.behavior.variables.laptopRequestedClosed,true);
    controller.dispatch('open-laptop');
    frame=until(controller,frame=>frame.behavior.state==='openingLaptop');
    controller.dispatch('close-laptop');
    frame=controller.step(1/30);
    assert.equal(frame.behavior.variables.laptopRequestedClosed,true);
    frame=until(controller,frame=>frame.behavior.state==='closingLaptop');
    matched(frame,'close');
    assert.equal(frame.behavior.variables.laptopClosed,true,'a canceled opening does not fire its completion effects');
  }finally{controller.dispose();}
});

test('visitors and mood changes wait at closed action boundaries without opening the lid',()=>{
  const controller=player();
  try{
    controller.dispatch('mood-disappointed');
    controller.dispatch('close-laptop');
    let frame=until(controller,frame=>frame.behavior.state==='closedIdle');
    matched(frame,'closed-idle--disappointed');
    controller.dispatch('visitor');
    controller.dispatch('mood-angry');
    frame=controller.step(1/30);
    assert.equal(frame.behavior.variables.pending,true);
    assert.equal(frame.behavior.variables.mood,2);
    matched(frame,'closed-idle--disappointed');
    frame=until(controller,frame=>frame.behavior.state==='closedPause');
    matched(frame,'closed-idle--disappointed');
    assert.equal(frame.behavior.actions.wwzard.active,false);
    frame=until(controller,frame=>frame.behavior.state==='closedIdle');
    matched(frame,'closed-idle--angry');
    for(let i=0;i<300;i++){
      frame=controller.step(1/30);
      assert.ok(['closedIdle','closedPause','closedDecision'].includes(frame.behavior.state),'visitor does not auto-open');
      assert.equal(frame.behavior.variables.laptopClosed,true);
      assert.equal(frame.behavior.variables.pending,true);
    }
    controller.dispatch('open-laptop');
    frame=until(controller,frame=>frame.behavior.state==='openingLaptop');
    matched(frame,'open--angry');
    frame=until(controller,frame=>frame.behavior.state==='noticing');
    assert.equal(frame.behavior.variables.laptopClosed,false);
    assert.equal(frame.behavior.variables.pending,false);
  }finally{controller.dispose();}
});
