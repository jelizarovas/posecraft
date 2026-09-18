import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {assertDocument} from '../src/schema.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {PoseBindings} from '../src/pose-bindings.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
import {forwardKinematics} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {inspectSceneFeatures,createSceneExport} from '../src/scene-export.js';
import {removeSceneEntity} from '../src/scene-graph.js';
const joint=(id,parent,x=0,y=0)=>({id,parent,x,y,length:0,rotation:0,min:-180,max:180});
function fixture(){
 const d=createDrawing(),p=d.packs.drawing;p.spatial=true;p.joints.push(joint('prop','root',8,-4));p.parts.push({id:'bottle',joint:'prop',d:'M-4-10H4V10H-4Z',fill:'#55aabb'});
 p.clips.carry={duration:.5,loop:false,tracks:{'root.x':[[0,50],[.5,70]],'prop.x':[[0,0],[.5,20]],'prop.y':[[0,0],[.5,10]]}};p.clips.idle.tracks['root.x']=[[0,0],[2,40]];
 const variants=[0,1].map(location=>({id:'from-'+location,clip:'carry',weight:1,speed:{min:1,max:1},when:{variable:'location',op:'eq',value:location},onSuccess:[{type:'set',variable:'propX',value:140+location*20},{type:'set',variable:'propY',value:210},{type:'set',variable:'location',value:1}]}));
 d.behaviorGraph={seed:17,variables:{propX:100,propY:200,location:0,starts:0,wins:0},initial:'idle',states:{idle:{actions:[]},placed:{actions:[]}},handlers:[{event:'go',actions:[{type:'perform',activity:'carry'}]}],edges:[{id:'placed',from:'*',to:'placed',event:'done',weight:1,when:{variable:'location',op:'eq',value:1}}],activities:{carry:{actor:'character',variants,success:{base:1,modifiers:[]},onStart:[{type:'add',variable:'starts',value:1}],onSuccess:[{type:'add',variable:'wins',value:1},{type:'event',event:'done'}],onFailure:[]}}};
 d.poseBindings=[{actor:'character',joint:'prop',space:'world',x:{variable:'propX'},y:{variable:'propY'},excludeClips:['carry']}];return d;
}
const position=(d,frame)=>spatialKinematics(d.packs.drawing,frame.actors[0].pose).prop;
const close=(a,b)=>assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<1e-6,JSON.stringify({a,b}));
const advance=(controller,seconds)=>{for(let left=seconds;left>1e-9;left-=.1)controller.step(Math.min(.1,left));return controller.frame();};

test('bindings hold absolute actor coordinates under translated and rotated parents without mutating authored poses',()=>{
 const d=fixture(),p=d.packs.drawing;d.actors[0].transform={x:500,y:400,scale:2,rotation:30};assertDocument(d);
 const binding=new PoseBindings(d),pose={'root.x':45,'root.y':60,'root.rotation':35,'root.yaw':28,'root.pitch':-17,'prop.z':75},frame={time:0,actors:[{id:'character',clip:'idle',pose,world:forwardKinematics(p.joints,pose)}]},before=structuredClone(frame),result=binding.apply(frame,d.behaviorGraph.variables);
 close(position(d,result),{x:100,y:200});assert.deepEqual(frame,before);assert.equal(result.actors[0].pose['prop.z'],75,'depth order is retained, not treated as translation');assert.deepEqual(result.actors[0].world,forwardKinematics(p.joints,result.actors[0].pose));
});

test('nested bindings resolve parents before children; singular and out-of-range positions remain finite',()=>{
 const d=fixture(),p=d.packs.drawing;p.joints.push(joint('child','prop',10,5));d.poseBindings.unshift({...structuredClone(d.poseBindings[0]),joint:'child'});const binding=new PoseBindings(assertDocument(d)),pose={'root.rotation':-20},frame={time:0,actors:[{id:'character',clip:'idle',pose,world:forwardKinematics(p.joints,pose)}]},result=binding.apply(frame,d.behaviorGraph.variables),world=spatialKinematics(p,result.actors[0].pose);close(world.prop,{x:100,y:200});close(world.child,{x:100,y:200});
 for(const [q,vars]of [[{'root.yaw':90},d.behaviorGraph.variables],[{}, {...d.behaviorGraph.variables,propX:1e6}]]){const f={...frame,actors:[{...frame.actors[0],pose:q}]};assert.deepEqual(binding.apply(f,vars),f);}
});

test('conditions select the remembered location and variant completion precedes shared completion exactly once',()=>{
 const d=fixture(),r=new BehaviorRuntime(d);r.dispatch('go');r.tick(0);assert.equal(r.actionPose('character').variant,'from-0');r.setVariable('location',9);r.tick(.5);assert.equal(r.variables.propX,140);assert.equal(r.variables.location,1);assert.equal(r.state,'placed','completion event sees placement effects');assert.equal(r.variables.wins,1);r.tick(10);assert.equal(r.variables.wins,1);
 r.dispatch('go');r.tick(0);assert.equal(r.actionPose('character').variant,'from-1');r.tick(.5);assert.equal(r.variables.propX,160);assert.equal(r.variables.wins,2);
 const previous=r.actionPose('character');r.setVariable('location',9);assert.equal(r.activities.start('carry',r.time),false);assert.deepEqual(r.actionPose('character'),previous);assert.equal(r.variables.starts,2);
});

test('failure variants filter independently and never run successful placement effects',()=>{
 const d=fixture(),recipe=d.behaviorGraph.activities.carry;recipe.success.base=0;recipe.failureVariants=[{...recipe.variants[1],id:'failed'}];recipe.onFailure=[{type:'add',variable:'wins',value:-1}];const r=new BehaviorRuntime(d);
 assert.equal(r.activities.start('carry',0),false,'no eligible failure animation');assert.equal(r.variables.starts,0);r.setVariable('location',1);r.dispatch('go');r.tick(0);assert.equal(r.actionPose('character').variant,'failed');r.tick(.5);assert.equal(r.variables.propX,100);assert.equal(r.variables.wins,-1);
});

test('full and lightweight controllers share persistent placement, preview exclusions and replay',()=>{
 const d=fixture(),full=new SceneController(d),lite=new IllustrationController(d,{behaviorFactory:BehaviorRuntime});
 try{for(const c of [full,lite]){close(position(d,advance(c,.2)),{x:100,y:200});c.dispatch('go');c.step(.1);assert.notEqual(position(d,c.frame()).x,100,'excluded carry clip owns the prop');advance(c,.4);c.graph?.cancelActivity('character');c.behaviors?.cancelActivity('character');close(position(d,c.frame()),{x:140,y:210});
  c.previewClip('character','idle',1);assert.notEqual(position(d,c.frame()).x,140);c.clearPreview('character');close(position(d,c.frame()),{x:140,y:210});}
  assert.deepEqual(full.frame().actors[0].pose,lite.frame().actors[0].pose);
  // Recreate the same recorded path without non-recorded cancellation.
  full.reset();lite.reset();for(const c of [full,lite]){c.dispatch('go');advance(c,.5);c.setVariable('location',1);c.dispatch('go');advance(c,.5);const before=c.frame();assert.deepEqual(c.seek(1),before);}
 }finally{full.dispose();lite.dispose();}
 const sequence={...d,presentation:'sequence'},c=new SceneController(sequence);try{assert.notEqual(position(sequence,c.frame()).x,100);}finally{c.dispose();}
});

test('bindings serialize, appear in export features and disappear with their actor',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(fixture())));assert.ok(inspectSceneFeatures(d).features.includes('pose-bindings'));assert.ok(!inspectSceneFeatures({...d,presentation:'sequence'}).features.includes('pose-bindings'));
 const exported=createSceneExport(d,{runtimeBase:'https://example.com/runtime/'});assert.ok(JSON.stringify(exported).includes('poseBindings'));
 d.actors.push({...structuredClone(d.actors[0]),id:'other'});const next=removeSceneEntity(d,'actor','character');assert.deepEqual(next.poseBindings,[]);assertDocument(next);
});

test('validation rejects unsafe or ambiguous bindings and invalid conditional effects',()=>{
 const mutations=[d=>d.poseBindings[0].joint='root',d=>d.poseBindings[0].space='screen',d=>d.poseBindings[0].x.variable='missing',d=>d.poseBindings[0].x.extra=1,d=>d.poseBindings.push(d.poseBindings[0]),d=>d.poseBindings[0].excludeClips=['missing'],d=>d.poseBindings=Array(33).fill(d.poseBindings[0]),d=>delete d.behaviorGraph,d=>d.behaviorGraph.activities.carry.variants[0].when.op='gt',d=>d.behaviorGraph.activities.carry.variants[0].when.value=true,d=>d.behaviorGraph.activities.carry.variants[0].onSuccess=[{type:'perform',activity:'carry'}]];
 for(const mutate of mutations){const d=fixture();mutate(d);assert.throws(()=>assertDocument(d),mutate.toString());}
});
