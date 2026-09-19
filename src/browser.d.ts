import type {ObjectCommand} from './scene-objects.js';
import type {ScrollOptions} from './scroll-bindings.js';
import {SceneDocument,BehaviorSettings,PointerCommand,FluidCommand} from './schema.js';
import {SceneController,SceneEvent,Interaction} from './scene.js';
import {WorkerSceneController} from './worker.js';
import type {createGameScene,GameEvent,SpeechRequest} from './game.js';
export type GameBindings=Pick<ReturnType<typeof createGameScene>,'actor'|'object'|'prop'|'describe'|'sequence'|'snapshot'|'restore'>;
export interface Player extends GameBindings {objectCommand(command:ObjectCommand):void;refreshScroll():void;enableMotion():Promise<boolean>;disableMotion():void;fluidInput(command:FluidCommand):void;dispatch(event:string,payload?:{actor?:string;x?:number;y?:number}):void;setVariable(name:string,value:boolean|number):void;pointer(command:PointerCommand):void;controller:SceneController|WorkerSceneController;setInput(actor:string,name:string,value:string|number|boolean):void;walkTo(actor:string,x:number):void;setBehavior(actor:string,settings:BehaviorSettings):void;interact(actor:string,type:Interaction,strength?:number):void;play():void;pause():void;reset():void;seek(time:number):void;dispose():void}
export function mountScene(element:HTMLElement,document:SceneDocument,options?:{execution?:'worker'|'main';scroll?:ScrollOptions|false;onError?:(error:Error)=>void;onSpeechRequest?:(request:SpeechRequest)=>void|Promise<void>;host?:HTMLElement;reducedMotion?:boolean|'system';onEvent?:(event:SceneEvent|GameEvent)=>void;motion?:(time:number)=>{x:number;y:number;teleport?:boolean};label?:string;autoplay?:boolean}):Player;
