import test from 'node:test';
import assert from 'node:assert/strict';
import {ActionVariations,validateActivities} from '../src/action-variations.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {IllustrationController} from '../src/illustration.js';
import {captureIllustrationState,restoreIllustrationState} from '../src/illustration-checkpoint.js';
import {createDrawing} from '../src/vector-authoring.js';
import {morphPath,blendMorphPaths} from '../src/spatial.js';

const recipe=(actor,clip,transition)=>({actor,variants:[{id:clip,clip,weight:1,speed:{min:1,max:1}}],...(transition?{transition}:{}),success:{base:1,modifiers:[]},onStart:[{type:'start',clip}],onSuccess:[{type:'finish',clip}],onFailure:[]});
const fixture=()=>{
 const document=createDrawing(),actor=document.actors[0],pack=document.packs[actor.pack],root=pack.joints[0].id;
 pack.spatial=true;pack.parts.push({id:'shape',joint:root,d:'M0 0L10 20Z',fill:'#abc',spatial:{morph:{channel:root+'.bend',target:'M0 0L20 10Z'}}});
 const clip=(from,to,bendFrom,bendTo,zFrom,zTo)=>({duration:2,loop:false,tracks:{[root+'.x']:[[0,from,'linear'],[2,to]],[root+'.bend']:[[0,bendFrom,'linear'],[2,bendTo]],[root+'.z']:[[0,zFrom,'linear'],[2,zTo]]}});
 pack.clips.a=clip(0,100,0,1,0,100);pack.clips.b=clip(200,300,1,0,-100,-100);pack.clips.c=clip(-100,-200,0,1,200,200);
 document.behaviorGraph={variables:{},activities:{a:recipe(actor.id,'a'),b:recipe(actor.id,'b',{duration:1,interrupt:true}),c:recipe(actor.id,'c',{duration:1,interrupt:true})}};
 const effects=[],actions=new ActionVariations(document,{random:()=>.5,variables:()=>({}),effects:list=>effects.push(...list)});
 return {document,actor:actor.id,pack,root,part:pack.parts[0],effects,actions};
};

test('interruption captures the displayed pose, advances its target, and drops canceled completion effects',()=>{
 const {actor,root,actions,effects}=fixture();const x=root+'.x',z=root+'.z';
 assert.equal(actions.start('a',0),true);actions.advance(1);assert.equal(actions.pose(actor).pose[x],50);
 assert.equal(actions.start('b',1),true);assert.equal(actions.pose(actor).pose[x],50,'zero time retains the displayed source');
 assert.equal(actions.pose(actor).clipTime,0);assert.equal(actions.start('b',1),false,'same active action is a no-op');
 actions.advance(1.5);assert.equal(actions.pose(actor).clipTime,.5,'incoming clip advances during blend');assert.equal(actions.pose(actor).pose[x],137.5);assert.equal(actions.pose(actor).pose[z],-100,'depth changes discretely at halfway');
 assert.equal(actions.start('c',1.5),true);assert.equal(actions.pose(actor).pose[x],137.5,'a second interruption has no pose jump');
 actions.advance(2);assert.equal(actions.pose(actor).pose[x],6.25);
 actions.advance(4);assert.deepEqual(effects.filter(effect=>effect.type==='finish').map(effect=>effect.clip),['c']);
 assert.equal(actions.actions.get(actor).transition,null,'finished blend releases captured contours');
 assert.equal(actions.pose(actor).shapeBlend,undefined,'held poses avoid further contour blending');
});

test('reinterruption snapshots the already blended contour',()=>{
 const {actor,root,part,actions}=fixture();actions.start('a',0);actions.advance(1);actions.start('b',1);actions.advance(1.5);
 const before=actions.pose(actor),expected=blendMorphPaths(before.shapeBlend.fromPaths[part.id],morphPath(part,before.shapeBlend.to[root+'.bend'],before.shapeBlend.to),before.shapeBlend.weight);
 actions.start('c',1.5);const after=actions.pose(actor);
 assert.equal(after.shapeBlend.fromPaths[part.id],expected);assert.equal(after.shapeBlend.weight,0);
 assert.equal(blendMorphPaths(after.shapeBlend.fromPaths[part.id],morphPath(part,after.shapeBlend.to[root+'.bend'],after.shapeBlend.to),0),expected);
});

test('existing busy rejection remains and completed poses can blend into a new action',()=>{
 const {actor,root,actions}=fixture(),x=root+'.x';actions.start('a',0);actions.advance(1);assert.equal(actions.start('a',1),false);assert.equal(actions.start('c',1),true);
 actions.advance(3.5);assert.equal(actions.pose(actor).pose[x],-200);assert.equal(actions.start('b',3.5),true);assert.equal(actions.pose(actor).pose[x],-200);
 const plain=fixture();plain.document.behaviorGraph.activities.b.transition.interrupt=false;plain.actions.start('a',0);plain.actions.advance(.5);assert.equal(plain.actions.start('b',.5),false,'a transition without interrupt keeps busy rejection');
});

test('rotations take the shortest arc and depth waits until halfway',()=>{
 const {actor,root,pack,actions}=fixture(),rotation=root+'.rotation',z=root+'.z';pack.clips.a.tracks[rotation]=[[0,170],[2,170]];pack.clips.b.tracks[rotation]=[[0,-170],[2,-170]];
 actions.start('a',0);actions.advance(.2);actions.start('b',.2);actions.advance(.45);
 assert.ok(actions.pose(actor).pose[rotation]>170,'quarter transition rotates through 180');assert.equal(actions.pose(actor).pose[z],10);
 actions.advance(.71);assert.equal(actions.pose(actor).pose[z],-100,'depth switches after the halfway threshold');
});

test('matching reference channel phase aligns paired actors and reverses mid action',()=>{
 const {document,pack,root}=fixture(),hero=document.actors[0].id,screen='screen';document.actors.push({...structuredClone(document.actors[0]),id:screen});
 pack.clips.close={duration:2,loop:false,tracks:{[root+'.bend']:[[0,0,'linear'],[2,1]]}};
 pack.clips.open={duration:2,loop:false,tracks:{[root+'.bend']:[[0,1,'linear'],[2,0]]}};
 const match={actor:screen,channel:root+'.bend'};document.behaviorGraph.activities={screenClose:recipe(screen,'close'),heroOpen:recipe(hero,'open',{duration:.2,interrupt:true,match}),screenOpen:recipe(screen,'open',{duration:.2,interrupt:true,match})};
 const actions=new ActionVariations(document,{random:()=>.5,variables:()=>({}),effects:()=>{}});actions.start('screenClose',0);actions.advance(1);assert.equal(actions.pose(screen).pose[root+'.bend'],.5);
 actions.start('heroOpen',1);actions.start('screenOpen',1);assert.ok(Math.abs(actions.pose(hero).clipTime-1)<1e-6);assert.ok(Math.abs(actions.pose(screen).clipTime-1)<1e-6);
 actions.advance(1.1);assert.ok(actions.pose(hero).clipTime>1&&actions.pose(screen).clipTime>1,'both incoming clips advance on the first tick');
});

test('a match at the incoming endpoint leaves a positive finite clip window',()=>{
 const {document,pack,root}=fixture(),screen='screen';document.actors.push({...structuredClone(document.actors[0]),id:screen});
 pack.clips.close={duration:2,loop:false,tracks:{[root+'.bend']:[[0,1,'linear'],[2,0]]}};
 pack.clips.open={duration:2,loop:false,tracks:{[root+'.bend']:[[0,1,'linear'],[2,0]]}};
 document.behaviorGraph.activities={close:recipe(screen,'close'),open:recipe(screen,'open',{duration:.3,interrupt:true,match:{actor:screen,channel:root+'.bend'}})};
 const actions=new ActionVariations(document,{random:()=>.5,variables:()=>({}),effects:()=>{}});actions.start('close',0);actions.advance(2);assert.equal(actions.pose(screen).pose[root+'.bend'],0);
 actions.start('open',2);const action=actions.actions.get(screen);assert.ok(action.end>action.start);assert.ok(action.end-action.start<=1e-6+1e-9);
 actions.advance(2.01);assert.ok(Number.isFinite(actions.pose(screen).progress));assert.equal(actions.pose(screen).progress,1);
});

test('transition schema enforces duration, interruption, and matching references',()=>{
 const valid=fixture().document,errors=document=>{const list=[];validateActivities(document,(ok,path)=>{if(!ok)list.push(path);},()=>{});return list;};
 assert.deepEqual(errors(valid),[]);
 for(const change of [t=>t.duration=-1,t=>t.duration=2.1,t=>t.duration=NaN,t=>t.interrupt='yes',t=>t.extra=true,t=>t.match={actor:'missing',channel:'root.bend'},t=>t.match={actor:valid.actors[0].id},t=>t.match={actor:valid.actors[0].id,channel:'root.rotation'}]){const doc=structuredClone(valid),transition=doc.behaviorGraph.activities.b.transition;change(transition);assert.ok(errors(doc).length,change.toString());}
});

test('interruption replay is deterministic',()=>{
 const run=()=>{const {actor,actions}=fixture(),frames=[];actions.start('a',0);for(const time of [.3,.9]){actions.advance(time);frames.push(actions.pose(actor));}actions.start('b',.9);for(const time of [1,1.2,1.4]){actions.advance(time);frames.push(actions.pose(actor));}actions.start('c',1.4);for(const time of [1.4,1.6,2.1,3.4]){actions.advance(time);frames.push(actions.pose(actor));}return {frames,snapshot:actions.snapshot()};};
 assert.deepEqual(run(),run());
});

test('a checkpoint restores an active blend and its captured morph contour',()=>{
 const {document,actor}=fixture();for(const recipe of Object.values(document.behaviorGraph.activities)){recipe.onStart=[];recipe.onSuccess=[];recipe.onFailure=[];}
 Object.assign(document.behaviorGraph,{seed:9,initial:'idle',states:{idle:{actions:[]}},edges:[],handlers:[{event:'go-a',actions:[{type:'perform',activity:'a'}]},{event:'go-b',actions:[{type:'perform',activity:'b'}]}]});
 document.requiredFeatures=[...new Set([...(document.requiredFeatures||[]),'spatial-rig'])];
 const original=new IllustrationController(document,{behaviorFactory:BehaviorRuntime}),restored=new IllustrationController(document,{behaviorFactory:BehaviorRuntime});
 try{
  original.dispatch('go-a');for(let i=0;i<60;i++)original.tick();original.dispatch('go-b');for(let i=0;i<24;i++)original.tick();
  const beforeSeek=original.frame().actors.find(item=>item.id===actor).shapeBlend;original.seek(original.time);
  assert.deepEqual(original.frame().actors.find(item=>item.id===actor).shapeBlend,beforeSeek,'recorded-input replay restores the blend');
  const state=captureIllustrationState(original);restoreIllustrationState(restored,state);
  assert.deepEqual(restored.frame().actors.find(item=>item.id===actor).shapeBlend,original.frame().actors.find(item=>item.id===actor).shapeBlend);
  for(let i=0;i<90;i++){original.tick();restored.tick();assert.deepEqual(restored.frame().actors.find(item=>item.id===actor).pose,original.frame().actors.find(item=>item.id===actor).pose);}
 }finally{original.dispose();restored.dispose();}
});
