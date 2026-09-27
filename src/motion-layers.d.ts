import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
export interface MotionLayer {id:string;actor:string;joint:string;channel:'rotation'|'x'|'y'|'yaw'|'pitch'|'bend'|'opacity';type:'sine'|'noise'|'input';amplitude:number;frequency:number;phase:number;seed:number;variable?:string;input?:string;weightInput?:string;range?:[number,number];enabled?:boolean;clips?:string[]}
export function applyMotionLayers(document:SceneDocument,frame:Frame,options?:{disabledActors?:Set<string>}):Frame;
export function validateMotionLayers(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
