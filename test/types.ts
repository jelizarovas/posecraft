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
