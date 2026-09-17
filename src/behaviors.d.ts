import type {SceneDocument} from './schema.js';
export type BehaviorPayload={actor?:string;x?:number;y?:number};
export type BehaviorAction={type:'set';variable:string;value:boolean|number}|{type:'input';actor:string;input:string;value:boolean|number|string}|{type:'emitter';emitter:string;enabled:boolean}|{type:'ensemble'|'event';event:string;actor?:string};
export interface BehaviorCondition {variable:string;op:'eq'|'neq'|'gt'|'gte'|'lt'|'lte';value:boolean|number}
export interface BehaviorEdge {id:string;from:string;to:string;event?:string;after?:{min:number;max:number};when?:BehaviorCondition;weight:number}
export interface BehaviorGraph {seed:number;variables:Record<string,boolean|number>;initial:string;states:Record<string,{actions:BehaviorAction[]}>;edges:BehaviorEdge[];handlers?:{event:string;actions:BehaviorAction[]}[]}
export interface BehaviorSnapshot {state:string;variables:Record<string,boolean|number>;enteredAt:number;time:number;transitions:number;droppedEvents:number;pendingEvents:number}
export const BEHAVIOR_LIMITS:Readonly<{states:number;edges:number;variables:number;actions:number;queue:number;events:number;transitions:number}>;
export const behaviorEnsembleEvents:string[];
export function validBehaviorInput(document:SceneDocument,actor:string,input:string,value:unknown):boolean;
export function validateBehaviorEvent(document:SceneDocument,event:string,payload?:BehaviorPayload):BehaviorPayload;
export function validateBehaviorVariable(graph:BehaviorGraph|undefined,name:string,value:unknown):void;
export function validateBehaviorGraph(document:SceneDocument,check:(valid:boolean,path:string,message:string)=>void):void;
export class BehaviorRuntime {
 constructor(document:SceneDocument,options?:{apply?:(action:BehaviorAction,payload:BehaviorPayload)=>void});
 state:string;time:number;variables:Record<string,boolean|number>;emitterOverrides:Record<string,{enabled:boolean}>;
 dispatch(event:string,payload?:BehaviorPayload):boolean;setVariable(name:string,value:boolean|number):void;
 tick(dt:number):BehaviorSnapshot;reset():BehaviorSnapshot;snapshot():BehaviorSnapshot;
}
