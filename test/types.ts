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
