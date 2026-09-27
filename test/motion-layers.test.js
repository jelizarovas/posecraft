import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatch} from '../examples/catch.js';
import {SceneController} from '../src/scene.js';
import {applyMotionLayers} from '../src/motion-layers.js';
import {validateDocument} from '../src/schema.js';
import {createDrawing} from '../src/vector-authoring.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ActorBehaviorRuntime} from '../src/actor-behaviors.js';
import {spatialParts} from '../src/spatial.js';
test('additive motion is deterministic, bounded and opt-out for authoring previews',()=>{
 const d=createCatch(),c=new SceneController(d),base=c.frame();d.motionLayers=[{id:'breath',actor:'pip',joint:'root',channel:'y',type:'sine',amplitude:2,frequency:1,phase:0,seed:17}];d.requiredFeatures.push('motion-layers');assert.equal(validateDocument(d).valid,true);base.time=base.effectsTime=.25;const f=applyMotionLayers(d,base);assert.equal(f.actors[0].pose['root.y'],base.actors[0].pose['root.y']+2);assert.deepEqual(applyMotionLayers(d,base),f);assert.equal(applyMotionLayers(d,base,{disabledActors:new Set(['pip'])}).actors[0],base.actors[0]);d.motionLayers[0].frequency=100;assert.equal(validateDocument(d).valid,false);c.dispose();
});

function inputScene(){
 const d=createDrawing();d.requiredFeatures=['motion-layers','behavior-graphs'];
 d.behaviorGraph={seed:1,variables:{hand:0},initial:'idle',states:{idle:{actions:[]}},edges:[]};
 d.motionLayers=[{id:'hand-input',actor:'character',joint:'root',channel:'x',type:'input',amplitude:12,frequency:1,phase:0,seed:17,variable:'hand',range:[-1,1],clips:['idle']}];
 return d;
}

test('opacity input layers preserve action motion and clamp independent fades',()=>{
 const d=inputScene(),pack=d.packs.drawing;
 pack.inputs.night={type:'number',default:0,min:0,max:1};
 d.motionLayers=[{id:'night-opacity',actor:'character',joint:'root',channel:'opacity',type:'input',amplitude:1,frequency:1,phase:0,seed:0,input:'night',range:[-1,1]}];
 assert.equal(validateDocument(d).valid,true);
 const c=new IllustrationController(d,{behaviorFactory:BehaviorRuntime,motionLayerSolver:applyMotionLayers});
 for(const value of [0,.25,.7,1]){
  c.setInput('character','night',value);
  assert.equal(c.frame().actors[0].pose['root.opacity'],value);
  assert.equal(c.frame().actors[0].pose['root.x'],0);
 }
 const frame=c.frame();frame.actors[0].pose['root.opacity']=.8;
 assert.equal(applyMotionLayers(d,frame).actors[0].pose['root.opacity'],1);
 d.motionLayers[0].amplitude=1.1;assert.equal(validateDocument(d).valid,false);
 c.dispose();
});
test('input maps clamped endpoints and midpoint to signed displacement, independent of time',()=>{
 const d=inputScene(),c=new IllustrationController(d,{behaviorFactory:BehaviorRuntime,motionLayerSolver:applyMotionLayers});
 assert.equal(validateDocument(d).valid,true);
 for(const [value,expected]of [[-5,-12],[-1,-12],[-.5,-6],[0,0],[.5,6],[1,12],[5,12]]){
  c.setVariable('hand',value);
  for(const time of [0,.17,4,127]){const f=c.frame();f.time=time;const base={...f,actors:f.actors.map(a=>({...a,pose:{...a.pose,'root.x':0}}))};assert.equal(applyMotionLayers(d,base).actors[0].pose['root.x'],expected);}
 }
 c.setVariable('hand',1);const held=c.frame().actors[0].pose['root.x'];c.step(.25);assert.equal(c.frame().actors[0].pose['root.x'],held);
 const frame=c.frame();frame.actors[0].clip='excluded';assert.equal(applyMotionLayers(d,frame).actors[0],frame.actors[0]);
 assert.equal(applyMotionLayers(d,c.frame(),{disabledActors:new Set(['character'])}).actors[0].pose['root.x'],held);
 delete d.motionLayers[0].variable;assert.equal(validateDocument(d).valid,false);c.dispose();
});
test('input bend preserves interrupted contours and applies secondary morph layers without erasing other paths',()=>{
 const d=inputScene(),pack=d.packs.drawing;pack.spatial=true;
 pack.joints.push({id:'hand',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
 pack.parts=[{id:'shape',joint:'root',fill:'#8844bb',d:'M0 0L10 0L10 10Z',spatial:{morph:{channel:'root.bend',target:'M0 0L20 0L20 20Z',layers:[{channel:'hand.bend',target:'M0 0L40 0L40 40Z'}]}}},{id:'other',joint:'root',fill:'#8844bb',d:'M0 0L10 0L10 10Z',spatial:{morph:{channel:'root.bend',target:'M0 0L20 0L20 20Z'}}}];
 d.motionLayers[0]={...d.motionLayers[0],joint:'hand',channel:'bend',amplitude:1};
 const c=new SceneController(d),frame=c.frame(),actor=frame.actors[0];frame.behavior={variables:{hand:1}};
 actor.shapeBlend={fromPaths:{shape:'M0 0L12 0L12 12Z',other:'M0 0L14 0L14 14Z'},to:{'root.bend':1},weight:.5};
 assert.equal(validateDocument(d).valid,true);
 const result=applyMotionLayers(d,frame),paths=spatialParts(pack,result.actors[0]).parts;
 assert.equal(paths.get('shape').d,'M0 0L46 0L46 46Z');assert.equal(paths.get('other').d,'M0 0L17 0L17 17Z');
 frame.behavior.variables.hand=-1;assert.equal(applyMotionLayers(d,frame).actors[0].pose['hand.bend'],0);
 frame.behavior.variables.hand=2;assert.equal(applyMotionLayers(d,frame).actors[0].pose['hand.bend'],1);c.dispose();
});

test('actor input and scene variable layers run together without replacing the current action',()=>{
 const d=inputScene(),pack=d.packs.drawing;pack.inputs.attention={type:'number',default:0,min:-1,max:1};
 d.behaviorGraph.activities={typing:{actor:'character',variants:[{id:'typing',clip:'idle',weight:1,speed:{min:1,max:1}}],success:{base:1,modifiers:[]},onStart:[],onSuccess:[],onFailure:[]}};
 d.behaviorGraph.states.idle.actions=[{type:'perform',activity:'typing'}];
 d.requiredFeatures.push('actor-behaviors');
 d.motionLayers.push({...d.motionLayers[0],id:'head-input',channel:'rotation',variable:undefined,input:'attention',amplitude:20});delete d.motionLayers[1].variable;
 d.actorBehaviors=[{id:'attention',actor:'character',outputs:[{variable:'look',source:'input.attention'}],graph:{seed:17,variables:{look:0},variableBounds:{look:{min:-1,max:1}},initial:'rest',states:{rest:{actions:[]},looking:{actions:[{type:'set',variable:'look',value:1}]},returned:{actions:[{type:'set',variable:'look',value:0}]}},edges:[{id:'focus',from:'rest',to:'looking',event:'focus',weight:1},{id:'return',from:'looking',to:'returned',after:{min:.2,max:.2},weight:1}]}}];
 assert.equal(validateDocument(d).valid,true);
 for(const Controller of [IllustrationController,SceneController]){
 const c=new Controller(d,{behaviorFactory:BehaviorRuntime,actorBehaviorFactory:ActorBehaviorRuntime,motionLayerSolver:applyMotionLayers});
 c.setVariable('hand',.5);c.dispatchActor('character','focus');c.step(.05);
 let frame=c.frame(),pose=frame.actors[0].pose;assert.equal(pose['root.x'],6);assert.equal(pose['root.rotation'],20);assert.equal(frame.actors[0].clip,'idle');assert.equal(frame.behavior.state,'idle');
 for(let i=0;i<4;i++)c.step(.05);frame=c.frame();assert.equal(frame.actors[0].pose['root.rotation'],0);assert.equal(frame.actors[0].pose['root.x'],6);
 const base=new SceneController(d),raw=base.frame();raw.actors[0].clip='excluded';assert.equal(applyMotionLayers(d,raw).actors[0],raw.actors[0]);
 for(const corrupt of [l=>l.variable='hand',l=>l.input='missing',l=>l.input='enabled',l=>delete l.range]){const invalid=structuredClone(d);invalid.packs.drawing.inputs.enabled={type:'boolean',default:true};corrupt(invalid.motionLayers[1]);assert.equal(validateDocument(invalid).valid,false);}
 base.dispose();c.dispose();
 }
});


test('saved weight input fades signed direction independently of the action',()=>{
 const d=inputScene(),pack=d.packs.drawing;pack.inputs.lookWeight={type:'number',default:0,min:0,max:1};
 d.motionLayers[0].weightInput='lookWeight';assert.equal(validateDocument(d).valid,true);
 const c=new SceneController(d),f=c.frame();f.behavior={variables:{hand:-1}};f.actors[0].inputs={lookWeight:.25};
 assert.equal(applyMotionLayers(d,f).actors[0].pose['root.x'],-3);
 f.actors[0].inputs.lookWeight=0;assert.equal(applyMotionLayers(d,f).actors[0].pose['root.x'],0);
 f.actors[0].inputs.lookWeight=2;assert.equal(applyMotionLayers(d,f).actors[0].pose['root.x'],-12);
 assert.equal(JSON.parse(JSON.stringify(d)).motionLayers[0].weightInput,'lookWeight');
 d.motionLayers[0].weightInput='missing';assert.equal(validateDocument(d).valid,false);c.dispose();
});
