import { SceneDocument,CharacterPack } from './schema.js';
export interface Frame {time:number;actors:{id:string;inputs:Record<string,string|number|boolean>;pose:Record<string,number>;world:Record<string,{x:number;y:number;rotation:number;endX:number;endY:number}>;state:string;spring:{x:number;y:number;vx:number;vy:number}}[]}
export interface SceneEvent {type:string;actor:string;time:number;[key:string]:unknown}
export const STEP:number;
export function compilePack(pack:CharacterPack):unknown;
export class SceneController {
 constructor(document:SceneDocument, options?:{reducedMotion?:boolean});
 document:SceneDocument;time:number;playing:boolean;animationPlaying:boolean;reducedMotion:boolean;log:unknown[];size?:{width:number;height:number};
 setInput(actor:string,name:string,value:string|number|boolean):void;
 setAcceleration(ax:number,ay:number):void;
 sampleHost(sample:{x:number;y:number;time:number;teleport?:boolean}):void;
 step(dt:number):Frame;frame():Frame;seek(time:number):Frame;reset():Frame;play():void;pause():void;rebaseline():void;dispose():void;
 previewClip(actor:string,clip:string,time:number,overrides?:Record<string,number>):Frame;clearPreview(actor:string):void;
 subscribe(listener:(event:SceneEvent)=>void):()=>void;
}
