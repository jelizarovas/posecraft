import type {SceneDocument,PointerCommand} from './schema.js';
import type {Frame} from './scene.js';
import type {BehaviorPayload} from './behaviors.js';
export function validateInteractions(document:SceneDocument,check:(valid:boolean,path:string,message:string)=>void):void;
export class ScenePointerInteraction {
 constructor(document:SceneDocument,options?:{dispatch?:(event:string,payload:BehaviorPayload)=>void});
 input(command:PointerCommand):void;step(dt:number):void;apply(frame:Frame):Frame;reset():void;
}
