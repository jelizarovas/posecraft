import type {SceneDocument} from './schema.js';
import type {BehaviorAction,BehaviorPayload} from './behaviors.js';
export interface ActionVariant {id:string;clip:string;start?:number;end?:number;weight:number;speed:{min:number;max:number};offsets?:Record<string,{min:number;max:number}>}
export type ActivityEffect=Exclude<BehaviorAction,{type:'perform'}>;
export interface ActivityRecipe {actor:string;variants:ActionVariant[];failureVariants?:ActionVariant[];success:{base:number;modifiers:{variable:string;weight:number}[]};onStart:ActivityEffect[];onSuccess:ActivityEffect[];onFailure:ActivityEffect[]}
export interface ActionSummary {activity:string;variant:string;speed:number;success:boolean;progress:number;active:boolean}
export interface ActionPose {pose:Record<string,number>;clip:string;clipTime:number;activity:string;variant:string;speed:number;success:boolean;progress:number}
export const ACTIVITY_LIMITS:Readonly<{activities:number;variants:number;offsets:number;modifiers:number}>;
export function validateActivities(document:SceneDocument,check:(valid:boolean,path:string,message:string)=>void,validateEffects:(actions:unknown,path:string,allowPerform:boolean)=>void):void;
export class ActionVariations {
 constructor(document:SceneDocument,options:{random:()=>number;variables:()=>Record<string,number|boolean>;effects:(actions:ActivityEffect[],payload:BehaviorPayload)=>void});
 start(activity:string,time:number,payload?:BehaviorPayload):boolean;advance(time:number):void;cancel(actor:string):boolean;pose(actor:string):ActionPose|null;snapshot():Record<string,ActionSummary>;
}
