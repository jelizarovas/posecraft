import test from 'node:test';
import assert from 'node:assert/strict';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {spatialParts} from '../src/spatial.js';

const actor=(p,id)=>p.frame().actors.find(a=>a.id===id);
const step=(p,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)p.step(1/60);};
function until(p,state){for(let i=0;i<1200&&p.frame().behavior.state!==state;i++)p.step(1/60);assert.equal(p.frame().behavior.state,state);}
function sameDrawing(scene,before,after){
 assert.deepEqual(after.pose,before.pose,'input begins at the currently displayed pose');
 const a=spatialParts(scene.packs[before.id],before),b=spatialParts(scene.packs[after.id],after);
 for(const [id,part]of a.parts)assert.equal(b.parts.get(id).d,part.d,`${id} keeps its displayed contour on interruption`);
}
test('Open interrupts every mood and closed-idle phase synchronously, including tucked arms',()=>{
 for(const mood of ['normal','angry','disappointed'])for(const idleTime of [.1,2.8,6.5,8.8]){
  const scene=JSON.parse(JSON.stringify(createWwzardIllustration())),p=new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
  try{
   p.dispatch('mood-'+mood);p.dispatch('close-laptop');until(p,'closedIdle');step(p,idleTime);
   const before=actor(p,'wwzard'),at=p.time;
   p.dispatch('open-laptop');
   assert.equal(p.time,at);assert.equal(p.frame().behavior.state,'openingLaptop');
   sameDrawing(scene,before,actor(p,'wwzard'));
   step(p,1/60);assert.notDeepEqual(actor(p,'wwzard').pose,before.pose,'movement begins on the first animation frame');
   assert.equal(actor(p,'wwzard').clipTime,actor(p,'screen').clipTime);
   const begun=p.frame().behavior.enteredAt;p.dispatch('open-laptop');assert.equal(p.frame().behavior.enteredAt,begun);
   until(p,'working');assert.equal(p.frame().behavior.variables.laptopClosed,false);
  }finally{p.dispose();}
 }
});
test('reversing the lid repeatedly preserves its angle and displayed arm contours',()=>{
 for(const mood of ['normal','angry','disappointed']){
  const scene=createWwzardIllustration(),p=new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
  try{
   p.dispatch('mood-'+mood);p.dispatch('close-laptop');
   for(let i=0;i<900&&actor(p,'screen').pose['hinge.bend']<.45;i++)p.step(1/60);
   for(const command of ['open','close','open','close','open']){
    const before=['wwzard','screen'].map(id=>actor(p,id));p.dispatch(command+'-laptop');
    assert.equal(p.frame().behavior.state,command==='open'?'openingLaptop':'closingLaptop');
    before.forEach(a=>sameDrawing(scene,a,actor(p,a.id)));
    assert.ok(Math.abs(actor(p,'wwzard').clipTime-actor(p,'screen').clipTime)<1e-7);
    step(p,.1);
   }
   until(p,'working');assert.equal(p.frame().behavior.variables.laptopClosed,false);
  }finally{p.dispose();}
 }
});
