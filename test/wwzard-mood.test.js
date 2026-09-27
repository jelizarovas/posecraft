import assert from 'node:assert/strict';
import test from 'node:test';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {IllustrationController} from '../src/illustration.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {assertDocument} from '../src/schema.js';

const actions={working:'work',noticing:'notice',greeting:'greet',curious:'curious',overwhelmed:'frustrated',resting:'rest',closingLaptop:'close',openingLaptop:'open',closedIdle:'closed-idle'};
const variant=(clip,mood)=>mood===1?clip:`${clip}--${mood===0?'disappointed':'angry'}`;
const actor=(frame,id)=>frame.actors.find(item=>item.id===id);
function until(player,predicate,seconds=20){
  for(let i=0;i<seconds*30;i++){const frame=player.step(1/30);if(predicate(frame))return frame;}
  assert.fail(`Expected behavior was not reached; current state: ${player.frame().behavior.state}`);
}

test('each saved Wwzard activity chooses the selected mood without multiplying graph activities',()=>{
  const base=createWwzardIllustration();
  assert.equal(base.behaviorGraph.variables.mood,1);
  assert.equal(Object.keys(base.behaviorGraph.activities).length,14);
  for(const mood of [0,1,2])for(const [state,clip] of Object.entries(actions)){
    const scene=structuredClone(base);
    scene.behaviorGraph.initial=state;
    scene.behaviorGraph.variables.mood=mood;
    assertDocument(scene);
    const runtime=new BehaviorRuntime(scene);
    const selected=runtime.snapshot().actions;
    assert.equal(selected.wwzard.variant,variant(clip,mood),`${state} mood ${mood}`);
    if(['closingLaptop','openingLaptop','closedIdle'].includes(state)){
      assert.equal(selected.screen.variant,variant(clip,mood));
      assert.equal(scene.packs.wwzard.clips[variant(clip,mood)].duration,scene.packs.screen.clips[variant(clip,mood)].duration);
    }
  }
});

test('mood changes wait for a closed action boundary and keep the screen paired',()=>{
  const scene=structuredClone(createWwzardIllustration());
  const player=new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
  try{
    player.dispatch('mood-disappointed');
    player.dispatch('close-laptop');
    const closing=until(player,frame=>frame.behavior.state==='closingLaptop');
    assert.equal(actor(closing,'wwzard').clip,'close--disappointed');
    assert.equal(actor(closing,'screen').clip,'close--disappointed');
    player.dispatch('mood-angry');
    const stillClosing=player.step(1/30);
    assert.equal(stillClosing.behavior.variables.mood,2);
    assert.equal(actor(stillClosing,'wwzard').clip,'close--disappointed');
    assert.equal(actor(stillClosing,'screen').clip,'close--disappointed');
    assert.equal(actor(stillClosing,'wwzard').clipTime,actor(stillClosing,'screen').clipTime);
    const closed=until(player,frame=>frame.behavior.state==='closedIdle');
    assert.equal(actor(closed,'wwzard').clip,'closed-idle--angry');
    assert.equal(actor(closed,'screen').clip,'closed-idle--angry');
    player.dispatch('open-laptop');
    const opening=until(player,frame=>frame.behavior.state==='openingLaptop');
    assert.equal(actor(opening,'wwzard').clip,'open--angry');
    assert.equal(actor(opening,'screen').clip,'open--angry');
    const next=until(player,frame=>frame.behavior.state==='working');
    assert.equal(actor(next,'wwzard').clip,'work--angry');
    assert.equal(actor(next,'screen').clip,'open--angry');
    assert.equal(actor(next,'screen').clipTime,scene.packs.screen.clips['open--angry'].duration);
  }finally{player.dispose();}
});
