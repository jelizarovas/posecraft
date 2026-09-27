import test from 'node:test';
import assert from 'node:assert/strict';
import {IllustrationController} from '../src/illustration.js';
import {HostTransitionLayer,hostTransitionWeight} from '../src/host-transition.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {createDrawing} from '../src/vector-authoring.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {spatialParts,morphPath,blendMorphPaths} from '../src/spatial.js';

function fixture(){
 const scene=createDrawing(),pack=scene.packs.drawing;
 pack.spatial=true;
 pack.clips.idle={duration:1,loop:false,tracks:{'root.rotation':[[0,5],[1,15]],'root.x':[[0,3],[1,8]],'root.y':[[0,17],[1,17]]}};
 pack.clips.left={duration:1,loop:false,tracks:{'root.rotation':[[0,-30],[1,-30]],'root.x':[[0,-40],[1,-40]],'root.bend':[[0,1],[1,1]]}};
 pack.clips.right={duration:1,loop:false,tracks:{'root.rotation':[[0,30],[1,30]],'root.x':[[0,40],[1,40]],'root.bend':[[0,1],[1,1]]}};
 pack.parts=[{id:'shape',joint:'root',fill:'#aa4477',d:'M0 0L10 0L10 10Z',spatial:{morph:{channel:'root.bend',frames:[{value:.5,target:'M0 0L40 0L40 40Z'}],target:'M0 0L20 0L20 20Z'}}}];
 scene.hostTransition={actors:[{actor:'character',depart:{left:'left',right:'right'},arrive:{left:'left',right:'right'}}]};
 scene.behaviorGraph={seed:1,variables:{finished:0},initial:'active',states:{active:{actions:[{type:'perform',activity:'idle'}]}},edges:[],activities:{idle:{actor:'character',variants:[{id:'idle',clip:'idle',weight:1,speed:{min:1,max:1}}],success:{base:1,modifiers:[]},onStart:[],onSuccess:[{type:'add',variable:'finished',value:1}],onFailure:[]}}};
 return assertDocument(scene);
}
const make=(scene=fixture(),options={})=>new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,...options});
const sample=(progress,direction=1)=>({phase:'depart',direction,progress});

test('saved transition validation rejects invalid actor, directions and clip references',()=>{
 assert(validateDocument(fixture()).valid);
 for(const change of [d=>d.hostTransition.actors.push(d.hostTransition.actors[0]),d=>d.hostTransition.actors[0].actor='absent',d=>d.hostTransition.actors[0].depart.left='absent',d=>delete d.hostTransition.actors[0].arrive.right,d=>d.hostTransition.actors[0].extra=1]){const d=fixture();change(d);assert.equal(validateDocument(d).valid,false);}
 const c=make();for(const value of [{phase:'depart',direction:0,progress:.5},{phase:'stop',direction:1,progress:.5},sample(NaN),sample(-.1),sample(1.1)])assert.throws(()=>c.setHostTransition(value));c.dispose();
});

test('sparse absolute overlay preserves behavior, unkeyed channels and exact endpoints',()=>{
 const c=make(),baseline=make();
 assert.equal(hostTransitionWeight(0),0);assert.equal(hostTransitionWeight(1),0);assert.equal(hostTransitionWeight(.75),1);assert(hostTransitionWeight(.9)<1);
 for(const progress of [0,.1,.5,.75,.9,1]){
  const base=baseline.frame();c.setHostTransition(sample(progress));const frame=c.frame(),pose=frame.actors[0].pose;
  assert.equal(pose['root.y'],17);assert.equal(frame.behavior.state,base.behavior.state);
  if(progress===0||progress===1)assert.deepEqual(frame,base);
  if(progress===.5)assert.equal(pose['root.x'],40);
  c.step(.1);baseline.step(.1);
 }
 c.setHostTransition(sample(.5,-1));assert.equal(c.frame().actors[0].pose['root.x'],-40);
 for(let i=0;i<12;i++){c.step(.1);baseline.step(.1);}
 assert.equal(c.frame().behavior.variables.finished,1);
 c.clearHostTransition();assert.deepEqual(c.frame(),baseline.frame());
 c.setHostTransition(sample(.5));c.reset();assert.equal(c.hostTransitions.sample,null);c.dispose();baseline.dispose();
});

test('preview actors and paused players accept overlays, reduced motion ignores them',()=>{
 const c=make();c.previewClip('character','idle',.3);c.pause();const base=c.frame();
 c.setHostTransition(sample(.5));assert.equal(c.frame().actors[0].pose['root.x'],40);assert.equal(c.time,0);
 c.reducedMotion=true;assert.deepEqual(c.frame(),{...base,effectsTime:0});c.reducedMotion=false;c.clearHostTransition();assert.deepEqual(c.frame(),base);
 c.setHostTransition(sample(.5));c.dispose();assert.equal(c.hostTransitions.sample,null);
});

test('overlay blends the displayed contour instead of traversing intermediate morph poses',()=>{
 const d=fixture(),c=make(d),layer=new HostTransitionLayer(d),frame=c.frame(),part=d.packs.drawing.parts[0];
 frame.actors[0].shapeBlend={fromPaths:{shape:'M0 0L12 0L12 12Z'},to:{...frame.actors[0].pose,'root.bend':.5},weight:.35};
 const base=spatialParts(d.packs.drawing,frame.actors[0]).parts.get('shape').d;
 layer.set(sample(.09));const result=layer.apply(frame),actual=spatialParts(d.packs.drawing,result.actors[0]).parts.get('shape').d;
 assert.equal(actual,blendMorphPaths(base,morphPath(part,1,{'root.bend':1}),.5));c.dispose();
});

test('recorded host samples and clear replay identically through retained checkpoints',()=>{
 const a=make(fixture(),{checkpoints:{interval:.1}}),b=make(fixture(),{checkpoints:false});
 for(const c of [a,b]){for(let i=0;i<3;i++)c.step(.1);c.setHostTransition(sample(.4,-1));for(let i=0;i<6;i++)c.step(.1);c.clearHostTransition();c.step(.1);}
 for(const t of [2,.6,1.5,.7])assert.deepEqual(a.seek(t),b.seek(t));
 assert(a.checkpointStats().hits>0);assert.equal(a.hostTransitions.sample.direction,-1);
 a.clearHostTransition();b.clearHostTransition();assert.deepEqual(a.seek(.9),b.seek(.9));a.dispose();b.dispose();
});

test('layer-only morph channels override an interrupted action without dropping its base contour',()=>{
 const d=fixture(),pack=d.packs.drawing,part=pack.parts[0];
 pack.joints.push({id:'travel',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
 part.spatial.morph.layers=[{channel:'travel.bend',target:'M0 0L60 0L60 60Z'}];
 pack.clips.right.tracks={'travel.bend':[[0,1],[1,1]]};
 const c=make(d),layer=new HostTransitionLayer(d),frame=c.frame();
 frame.actors[0].shapeBlend={fromPaths:{shape:'M0 0L12 0L12 12Z'},to:{...frame.actors[0].pose,'root.bend':.5},weight:.35};
 const base=spatialParts(pack,frame.actors[0]).parts.get('shape').d;
 layer.set(sample(.09));const result=layer.apply(frame),actual=spatialParts(pack,result.actors[0]).parts.get('shape').d;
 const destination={...frame.actors[0].pose,'travel.bend':1};
 assert.equal(actual,blendMorphPaths(base,morphPath(part,destination['root.bend'],destination),.5));c.dispose();
});

test('paused host samples at one time coalesce replay history without changing the final pose',()=>{
 const c=make();c.pause();for(let i=0;i<500;i++)c.setHostTransition(sample((i%100)/100));
 assert.equal(c.log.length,1);const expected=c.frame();assert.deepEqual(c.seek(0),expected);c.dispose();
});
