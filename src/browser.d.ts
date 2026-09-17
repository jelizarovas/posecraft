import {SceneDocument,BehaviorSettings} from './schema.js';
import {SceneController,SceneEvent,Interaction} from './scene.js';
import {WorkerSceneController} from './worker.js';
export interface Player {controller:SceneController|WorkerSceneController;setInput(actor:string,name:string,value:string|number|boolean):void;setBehavior(actor:string,settings:BehaviorSettings):void;interact(actor:string,type:Interaction,strength?:number):void;play():void;pause():void;reset():void;seek(time:number):void;dispose():void}
export function mountScene(element:HTMLElement,document:SceneDocument,options?:{execution?:'worker'|'main';onError?:(error:Error)=>void;host?:HTMLElement;reducedMotion?:boolean|'system';onEvent?:(event:SceneEvent)=>void;motion?:(time:number)=>{x:number;y:number;teleport?:boolean};label?:string;autoplay?:boolean}):Player;
