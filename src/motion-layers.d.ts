import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
export interface MotionLayer {id:string;actor:string;joint:string;channel:'rotation'|'x'|'y'|'yaw'|'pitch'|'bend';type:'sine'|'noise';amplitude:number;frequency:number;phase:number;seed:number;variable?:string;range?:[number,number];enabled?:boolean;clips?:string[]}
export function applyMotionLayers(document:SceneDocument,frame:Frame,options?:{disabledActors?:Set<string>}):Frame;
export function validateMotionLayers(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
