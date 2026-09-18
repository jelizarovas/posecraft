import type {SceneDocument} from './schema.js';
import type {BehaviorGraph,BehaviorAction,BehaviorPayload,BehaviorSnapshot,BehaviorCondition} from './behaviors.js';
export interface ActorBehavior {id:string;actor:string;graph:BehaviorGraph;sensors?:Array<{variable:string;source:string}>;outputs?:Array<{variable:string;source:string}>;rates?:Array<{variable:string;perSecond:number;when?:BehaviorCondition}>}
export interface ActorBehaviorSnapshot extends BehaviorSnapshot {id:string;actor:string}
export interface ActorBehaviorOptions {read?:(actor:string,source:string)=>boolean|number|undefined;write?:(actor:string,source:string,value:boolean|number)=>void;apply?:(action:BehaviorAction,payload:BehaviorPayload)=>void}
export function actorBehaviorSources(document:SceneDocument,actor:string):Array<{source:string;type:string;writable:boolean;min?:number;max?:number}>;
export function validateActorBehaviors(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
export class ActorBehaviorRuntime {constructor(document:SceneDocument,options?:ActorBehaviorOptions);reset():void;tick(dt:number,options?:{disabledActors?:Set<string>}):void;dispatch(event:string,payload?:BehaviorPayload):boolean;setVariable(actor:string,name:string,value:boolean|number):void;emitterOverrides():Record<string,{enabled:boolean}>;snapshot():ActorBehaviorSnapshot[];capture():unknown;restore(snapshot:unknown):void}
