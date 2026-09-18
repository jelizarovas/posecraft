import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';

function waterScene(seed,location=0){
 const doc=createGym(),g=doc.behaviorGraph;
 g.seed=seed;g.variables.bottleLocation=location;
 const v=g.activities['drink-bar'].variants.find(v=>v.when.value===location),p=sampleClip(doc.packs.atlas.clips[v.clip],0);
 g.variables.bottleX=p['root.x']+p['water-bottle.x'];g.variables.bottleY=p['root.y']+p['water-bottle.y'];
 g.initial='water';g.states={water:{actions:[{type:'perform',activity:'drink-bar'}]},rest:{actions:[{type:'perform',activity:'idle-bar'}]}};
 g.edges=[{id:'water-done',from:'water',to:'rest',event:'drank-bar',weight:1}];
 doc.contacts=[];
 return doc;
}

test('water breaks choose different destinations from every remembered location and replay their choice',()=>{
 for(let location=0;location<3;location++){
  const destinations=new Set(),doc=waterScene(0,location);
  for(let seed=1;seed<=24;seed++){
   doc.behaviorGraph.seed=seed*7919;
   const b=new BehaviorRuntime(doc),a=b.activities.actions.get('atlas');
   assert.equal(a.variant.when.value,location,'fetch the actual last location');
   const expected=a.variant.onSuccess.find(e=>e.variable==='bottleLocation').value;
   const replay=new BehaviorRuntime(doc);assert.deepEqual(replay.snapshot(),b.snapshot());
   b.tick(100);assert.equal(b.variables.bottleLocation,expected);destinations.add(expected);
   assert.equal(b.variables.drinks,1,'one drink reward per completed action');
  }
  assert.ok(destinations.size>=2,'placement is selected, not a fixed location cycle');
 }
});

test('full and illustration playback leave one bottle in its new position during the next action',()=>{
 const doc=waterScene(941,1),controllers=[new SceneController(doc),new IllustrationController(doc,{behaviorFactory:BehaviorRuntime})];
 try{
  for(const c of controllers){
   let frame;
   for(let i=0;i<650;i++){frame=c.step(.1);if(frame.behavior.state==='rest')break;}
   assert.equal(frame.behavior.state,'rest');
   for(let i=0;i<10;i++)frame=c.step(.1);
   const vars=frame.behavior.variables,actor=frame.actors.find(a=>a.id==='atlas'),world=spatialKinematics(doc.packs.atlas,actor.pose);
   assert.ok(Math.hypot(world['water-bottle'].x-vars.bottleX,world['water-bottle'].y-vars.bottleY)<.05,'the bottle stays at the selected surface');
   assert.equal(doc.packs.atlas.parts.filter(p=>p.id==='water-bottle-body').length,1);
   const replay=c.seek(frame.time);assert.deepEqual(replay.behavior,frame.behavior);assert.deepEqual(replay.actors.find(a=>a.id==='atlas').pose,actor.pose);
  }
 }finally{controllers.forEach(c=>c.dispose());}
});
