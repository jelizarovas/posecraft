import type {SceneController,SceneEvent} from './scene.js';
import type {WorkerSceneController} from './worker.js';
import type {BehaviorPayload} from './behaviors.js';
import type {describeGameScene} from './game-bindings.js';
import type {GameSceneSnapshot} from './game-state.js';
export type {GameSceneSnapshot} from './game-state.js';
export interface GameEvent {type:string;actor?:string;request?:string;[key:string]:unknown}
export interface SpeechRequest {actor:string;text:string;emotion?:string;signal:AbortSignal}
export interface GameOptions {onSpeechRequest?:(request:SpeechRequest)=>void|Promise<void>;onEvent?:(event:GameEvent)=>void;onError?:(error:Error)=>void;onCommand?:()=>void}
export interface CommandOptions {signal?:AbortSignal;priority?:number}
export type GameTarget=string|{type:'point';x:number;y:number}|{type:'prop';prop:string;offsetX?:number;offsetY?:number}|{type:'object';object:string;offsetX?:number;offsetY?:number}|{type:'joint';actor:string;joint:string;offsetX?:number;offsetY?:number};
export type ActorSequenceStep={do:string}|{react:string}|{moveTo:GameTarget}|{lookAt:GameTarget}|{say:string};
export type GameSequenceStep=ActorSequenceStep&{actor:string};
export interface GameSequence {finished:Promise<void>;cancel():void}
export interface GameActor {capabilities():ReturnType<typeof describeGameScene>['actors'][number];do(action:string,options?:CommandOptions):Promise<GameEvent>;react(reaction:string,options?:CommandOptions):Promise<GameEvent>;moveTo(target:GameTarget,options?:CommandOptions):Promise<GameEvent>;lookAt(target:GameTarget,options?:CommandOptions&{duration?:number}):Promise<GameEvent>;say(text:string,options?:CommandOptions&{emotion?:string}):Promise<GameEvent>;send(event:string,payload?:BehaviorPayload):boolean;cancel():void;sleep():Promise<void>;wake():Promise<void>;sequence(steps:ActorSequenceStep[],options?:CommandOptions):GameSequence}
export interface GameObject {set(property:'enabled',value:boolean):Promise<GameEvent>;place(target:GameTarget):Promise<GameEvent>;attach(actor:string,joint:string,options?:{maxDistance?:number;offsetX?:number;offsetY?:number}):Promise<GameEvent>;release(options?:{actor?:string;vx?:number;vy?:number}):Promise<GameEvent>}
export interface GameScene {actor(id:string):GameActor;object(id:string):GameObject;prop(id:string):GameObject;describe():ReturnType<typeof describeGameScene>;sequence(steps:GameSequenceStep[],options?:CommandOptions):GameSequence;cancelAll(reason?:string):void;snapshot():Promise<GameSceneSnapshot>;restore(state:unknown):Promise<void>;dispose():void}
export function createGameScene(controller:SceneController|WorkerSceneController,options?:GameOptions):GameScene;
