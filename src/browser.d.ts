import {SceneDocument} from './schema.js';
import {SceneController,SceneEvent} from './scene.js';
export interface Player {controller:SceneController;setInput(actor:string,name:string,value:string|number|boolean):void;play():void;pause():void;reset():void;seek(time:number):void;dispose():void}
export function mountScene(element:HTMLElement,document:SceneDocument,options?:{host?:HTMLElement;reducedMotion?:boolean|'system';onEvent?:(event:SceneEvent)=>void;motion?:(time:number)=>{x:number;y:number;teleport?:boolean};label?:string;autoplay?:boolean}):Player;
