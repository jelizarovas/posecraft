import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
/** Direction is the sign of actual screen travel. Clips contain sparse absolute
 * channel values, not additive offsets. Progress .18..78 has full weight. */
export interface HostTransitionConfig {actors:Array<{actor:string;depart:{left:string;right:string};arrive:{left:string;right:string}}>}
export interface HostTransitionSample {phase:'depart'|'arrive';direction:-1|1;progress:number}
export function validateHostTransition(document:SceneDocument,check:(valid:boolean,path:string,message:string)=>void):void;
export function assertHostTransitionSample(value:unknown):HostTransitionSample;
export function hostTransitionWeight(progress:number):number;
export class HostTransitionLayer {constructor(document:SceneDocument);sample:HostTransitionSample|null;set(value:HostTransitionSample):void;clear():void;apply(frame:Frame,options?:{reducedMotion?:boolean}):Frame}
