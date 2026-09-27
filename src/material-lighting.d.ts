import type {SceneDocument,Part,Actor} from './schema.js';
import type {Frame} from './scene.js';
export interface MaterialSignal {actor:string;channel:string;invert?:boolean}
export interface MaterialLight {type:'directional'|'point';actor?:string;x?:number;y?:number;range?:number;angle?:number;color:string;intensity:number;gains?:MaterialSignal[];flicker?:number;actors?:string[];emission?:{actor:string;parts:string[]};highlights?:{actor:string;parts:string[]}}
export interface MaterialLighting {weight:MaterialSignal;ambient:number;tint:string;actors?:string[];lights:MaterialLight[]}
export function validateMaterialLighting(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
export function sampleMaterialLighting(document:SceneDocument,frame:Frame):unknown;
export function materialAppearance(state:unknown,part:Part,actor:Actor,evaluated:Frame['actors'][number],paint:unknown,spatial:unknown):unknown;
