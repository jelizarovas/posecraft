import { SceneController } from 'posecraft/scene';
import { assertDocument } from 'posecraft/schema';
import { Posecraft, PosecraftHandle } from 'posecraft/react';
import { DocumentStore } from 'posecraft/commands';
import { AnimationController } from 'posecraft';
import { createElement, createRef } from 'react';
declare const incoming:unknown;
const scene=assertDocument(incoming);
const store=new DocumentStore(scene);
store.transact([{op:'set',path:['name'],value:'Example'}],scene.revision);
const player=new SceneController(scene);
player.setInput('ona','greeting',true);
const ref=createRef<PosecraftHandle>();
createElement(Posecraft,{scene,ref,inputs:{ona:{greeting:true}}});
new AnimationController({joints:[]});
// @ts-expect-error Input values cannot be objects.
player.setInput('ona','greeting',{});
import { SoundEffects } from 'posecraft/audio';
player.setBehavior('ona',{mode:'protective',resistance:.7,strategy:'protect',autoFace:true});
player.interact('ona','drop');
new SoundEffects({volume:.2}).handle({type:'response',to:'hurt'});
createElement(Posecraft,{scene,behavior:{ona:{mode:'floating'}}});
// @ts-expect-error Unknown physical mode.
player.setBehavior('ona',{mode:'superpowered'});

import {WorkerSceneController} from "posecraft/worker";
const background=new WorkerSceneController(scene);
background.findPath({start:{x:20,y:20},end:{x:300,y:200}},{signal:new AbortController().signal});
createElement(Posecraft,{scene,execution:"worker"});

import {EpisodeController,assertEpisode} from "posecraft/episode";
const episode=new EpisodeController(assertEpisode(incoming));
episode.frame(0).camera.zoom;
import {assertTake,applyTake,sampleTake,PerformanceRetargeter} from 'posecraft/performance';
const take=assertTake(incoming,scene.packs[scene.actors[0].pack]);
sampleTake(take,.5).pose;
applyTake(episode.project,'hello','ona',take,0);
new PerformanceRetargeter(scene.packs[scene.actors[0].pack]);

background.walkTo("ona",200);
background.setBehavior("ona",{autoRecover:true});
player.walkTo("ona",200);
import {PhoneMotion,MotionSignal} from "posecraft/device-motion";
const phone=new PhoneMotion({onStatus:message=>console.log(message)});
phone.signal.sample(performance.now()).ax;
new MotionSignal().update({acceleration:{x:1,y:0}},0);

scene.packs[scene.actors[0].pack].spatial=true;
scene.packs[scene.actors[0].pack].parts[0].spatial={thickness:.7,axis:"x",facing:"front",surface:{x:-10,width:30,depth:20}};

scene.lighting={enabled:true,shading:"cel",angle:-135,elevation:45,color:"#fff1d6",floorShadow:.24,reflection:.2,gloss:.35};

scene.lighting={enabled:true,type:"point",receiver:"floor",pointX:400,pointY:300,pointHeight:120,range:500,motion:"flicker",flicker:.3,celThickness:.4,celIntensity:.7};
scene.actors[0].layer="foreground";scene.actors[0].unlit=true;
scene.packs[scene.actors[0].pack].parts[0].opacityChannel="root.opacity";

const campfireSettings: import("../src/schema.js").SceneDocument["ensemble"]={type:"campfire",seed:20260917,members:["a","b","c","d"],sky:"night"};
void campfireSettings;

import {editTimelineKeys} from 'posecraft/timeline-editing';
import {createDrawing,shapePath,movePivot} from 'posecraft/vector-authoring';
import {createProjectBundle,readProjectBundle} from 'posecraft/project-bundle';
const drawing=createDrawing();
const drawingPack=drawing.packs[drawing.actors[0].pack];
shapePath('ellipse',0,0,40,60);
movePivot(drawingPack,drawingPack.joints[0].id,10,20);
declare const editableClip:import('../src/schema.js').Clip;
editTimelineKeys(editableClip,[{track:'head.rotation',time:0}],{type:'move',offset:.5});
// @ts-expect-error Easing choices match the runtime.
editTimelineKeys(editableClip,[],{type:'easing',easing:'bounce'});
const bundle=createProjectBundle(episode.project,async()=>new Blob());
bundle.then(value=>readProjectBundle(value)).then(value=>value.assets.get('reference'));

import {createEmitter,removeGroup,nodeVisible} from 'posecraft/scene-graph';
import {sampleEmitter,emitterPulse} from 'posecraft/emitters';
scene.groups=[{id:'effects',name:'Effects',parent:null}];
scene.emitters=[{...createEmitter('smoke','smoke'),group:'effects'}];
sampleEmitter(scene.emitters[0],2)[0].opacity;
emitterPulse(scene.emitters[0],2);
nodeVisible(scene,scene.emitters[0]);
removeGroup(scene,'effects');
scene.lighting={emitter:'smoke',enabled:true};
// @ts-expect-error Emitter type is a supported effect, not arbitrary executable code.
createEmitter('script','unsafe');

player.triggerEnsemble('share-help');
background.triggerEnsemble('burn');

import {addSpatialRig,addOnaArmJoints} from 'posecraft/character-rigs';
addOnaArmJoints(addSpatialRig(scene.packs.ona,'ona',{studies:false}));

import {applyContacts,solveContact} from 'posecraft/contacts';
void applyContacts;void solveContact;

import {BehaviorRuntime} from "posecraft/behaviors";
import {ScenePointerInteraction} from "posecraft/pointer-interactions";
import {mountScenePointers} from "posecraft/pointer-browser";
import {inspectSceneFeatures,createSceneExport} from "posecraft/scene-export";
import {IllustrationController} from "posecraft/illustration";
void BehaviorRuntime;void ScenePointerInteraction;void mountScenePointers;void IllustrationController;
inspectSceneFeatures(scene);createSceneExport(scene,{runtimeBase:"https://example.com/runtime/"});
player.dispatch("scene-event",{actor:"ona",x:10,y:20});player.setVariable("enabled",true);
player.pointer({binding:"head-tug",phase:"start",x:10,y:20});

import {BottleFluid,waterSurface} from "posecraft/bottle-fluid";
import {BottleMotionSignal,mountBottleControls} from "posecraft/bottle-browser";
void BottleFluid;void waterSurface;void BottleMotionSignal;void mountBottleControls;
player.fluidInput({type:"wind",value:.8});
declare const website:import("posecraft/browser").Player;website.enableMotion();website.disableMotion();
background.fluidInput({type:"motion",ax:10,ay:0,turn:15,gravityX:0,gravityY:1});

import type {ActivityRecipe,ActionSummary} from "posecraft/action-variations";
const recipe:ActivityRecipe={actor:"ona",variants:[{id:"wave",clip:"wave",weight:1,speed:{min:.8,max:1.2}}],success:{base:.9,modifiers:[{variable:"fatigue",weight:-.005}]},onStart:[{type:"add",variable:"fatigue",value:2}],onSuccess:[],onFailure:[]};
const summary:ActionSummary={activity:"wave",variant:"wave",speed:1,success:true,progress:.5,active:true};
void recipe;void summary;

import {sampleSuspendedSupport} from "posecraft/support-balance";
const supported=sampleSuspendedSupport({anchor:{x:0,y:0},restCenter:{x:10,y:100},resistance:.7,load:1});
const supportRoll:number=supported.rotation;void supportRoll;

const weightedSurface: import('posecraft/schema').SkinnedMesh={
 vertices:[{weights:[{joint:'root',x:0,y:0,weight:1}]},{weights:[{joint:'root',x:10,y:0,weight:1}]},{weights:[{joint:'root',x:0,y:10,z:2,weight:1}]}],
 triangles:[[0,1,2]],correctives:[{joint:'root',channel:'rotation',min:0,max:90,offsets:[{vertex:1,z:3}]}]
};
scene.packs[scene.actors[0].pack].parts[0].spatial={mesh:weightedSurface};
// @ts-expect-error Correctives only use numeric pose channels.
weightedSurface.correctives!.push({joint:'root',channel:'expression',min:0,max:1,offsets:[]});


import {objectGrip} from 'posecraft/scene-objects';
import type {SceneObject} from 'posecraft/scene-objects';
import {predictIntercept} from 'posecraft/prop-games';
import type {ActorBehavior} from 'posecraft/actor-behaviors';
import {applyMotionLayers} from 'posecraft/motion-layers';
import {inspectScene} from 'posecraft/agent-authoring';
import {evaluateDrawing} from 'posecraft/render-evaluation';
import {mountRenderer} from 'posecraft/render-mount';
const ball:SceneObject={id:'ball',name:'Ball',shape:'circle',x:100,y:100,radius:10,fill:'#ee8833',mass:1};
scene.objects=[ball];scene.renderer='canvas';
player.objectCommand({type:'release',object:'ball',vx:10,vy:-100});
player.setActorVariable('ona','patience',.5);player.dispatchActor('ona','hello');
objectGrip(scene,player.frame(),{actor:'ona',joint:'rightWrist'});
predictIntercept({x:0,y:0,vx:10,vy:-50},100,0);
const directedFrame=applyMotionLayers(scene,player.frame());
evaluateDrawing(scene,directedFrame);inspectScene(scene);
mountRenderer(document.createElement('div'),scene,directedFrame).dispose();
const ownGraph:ActorBehavior={id:'ona-decisions',actor:'ona',graph:{seed:1,initial:'idle',variables:{},states:{idle:{actions:[]}},edges:[]}};
scene.actorBehaviors=[ownGraph];
// @ts-expect-error Only declared shared-object commands are supported.
player.objectCommand({type:'teleport',object:'ball'});

import {PathJob,navigationSegmentClear} from "posecraft/navigation";
import {bakeSceneMotion} from "posecraft/scene-baking";
const routeJob=new PathJob(scene,{start:{x:50,y:100},end:{x:200,y:100},area:{x:0,y:0,width:400,height:300}});
routeJob.step(16);navigationSegmentClear(scene,{x:50,y:100},{x:200,y:100},{clearance:10});
scene.canvasDepth="actor";
const bake:ReturnType<typeof bakeSceneMotion>=bakeSceneMotion(scene,{actor:scene.actors[0].id,duration:2,fps:30});void bake;

import {evaluatedProps} from "posecraft/scene-attachments";
const attachedArtwork= evaluatedProps(scene,player.frame());void attachedArtwork;
const propBinding:import("posecraft/schema").PropAttachment={type:"object",object:"ball",inheritRotation:false,offsetX:10};
const movingContact:import("posecraft/schema").SceneContact={id:"grip",name:"Grip",enabled:true,actor:"ona",chain:{upper:"rightArm",lower:"rightForearm",end:"rightWrist"},target:{type:"prop",prop:"handle"},bend:1,weight:1,start:0,end:4,fadeIn:.5,fadeOut:.5};void propBinding;void movingContact;

import {createAnimationPreview} from "posecraft/animation-preview";
import {retimeSceneClip} from "posecraft/timeline-editing";
const guides=createAnimationPreview(scene,player.frame(),{actor:scene.actors[0].id,clip:"idle"});
guides.onion(.5,{step:.1,count:2});guides.path("head",{samples:31});
const retimed=retimeSceneClip(scene,{packId:scene.actors[0].pack,clipId:"idle",duration:4});
new DocumentStore(scene).transact(retimed.commands,retimed.expectedRevision);
const marker:import("posecraft/schema").ClipMarker={time:1,name:"hand:ready"};void marker;


import {compileScene3D,validateScene3D} from "posecraft/scene-3d";
import {compileRig3D,evaluateRig3D,solveTwoBone3D} from "posecraft/rig-3d";
import type {Scene3D} from "posecraft/scene-3d-schema";
const nativeScene={} as Scene3D;
const nativeCompiled=compileScene3D(nativeScene);
const nativeFrame=nativeCompiled.evaluate({camera:nativeScene.camera});
const nativeReload:Scene3D=nativeCompiled.serialize();
const nativeDiagnostic:string=nativeFrame.contacts[0].status;
const nativeRig=compileRig3D(nativeScene.rigs["humanoid"]);
const nativeWorld=evaluateRig3D(nativeRig,{}, {position:[0,0,0],rotation:[0,0,0,1],scale:1});
const nativeSolve=solveTwoBone3D(nativeRig,{},"reach",{position:[1,0,1],rotation:[0,0,0,1]});
void validateScene3D(nativeReload);void nativeDiagnostic;void nativeWorld;void nativeSolve;

import {loadCharacter3D} from "posecraft/gltf-character-3d";
import {createBenchAction3D} from "posecraft/bench-action-3d";
import {createBenchProject3D,BenchProject3DStore} from "posecraft/bench-project-3d";
import {wristTargetForGrip3D} from "posecraft/grip-3d";
const benchProject=createBenchProject3D();const benchStore=new BenchProject3DStore(benchProject);
async function importedNativeCharacter(){const asset=await loadCharacter3D("./athlete.glb",{height:1.75});const action=createBenchAction3D({rig:asset.rig,roles:asset.roles,grips:asset.grips,bench:benchProject.bench,settings:benchProject.settings});asset.apply(action.sample(1).pose,action.sample(1).placement);const finish=action.interrupt(15);if(finish.supported)finish.sample(0);if(asset.grips.left)wristTargetForGrip3D(asset.grips.left,{position:[0,1,0]});asset.dispose();}void importedNativeCharacter;void benchStore;

import {createNativeActionClient} from "posecraft/native-action-worker-client";
const nativeActionClient=createNativeActionClient(new Worker("worker.js",{type:"module"}));nativeActionClient.dispose();

import {createGameScene, type GameSequenceStep, type SpeechRequest} from "posecraft/game";
import {describeGameScene} from "posecraft/game-bindings";
function semanticGameTypes(controller:import("posecraft/scene").SceneController, document:import("posecraft/schema").SceneDocument){
 const game=createGameScene(controller,{onSpeechRequest:async(request:SpeechRequest)=>{void request.signal;}});
 const recipe:GameSequenceStep[]=[{actor:"ona",do:"wave"},{actor:"ona",lookAt:"shop.sign"}];
 const sequence=game.sequence(recipe);sequence.cancel();void sequence.finished;
 void game.actor("ona").moveTo({type:"point",x:200,y:100});
 game.object("lamp").set("enabled",true);void describeGameScene(document);game.dispose();
}
void semanticGameTypes;
