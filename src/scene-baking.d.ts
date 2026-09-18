import type {SceneDocument} from './schema.js';
import type {BehaviorSettings} from './schema.js';
import type {Interaction} from './scene.js';
export type BakeEvent={time:number;type:'input';actor:string;name:string;value:string|number|boolean}|{time:number;type:'behavior';actor:string;value:BehaviorSettings}|{time:number;type:'interaction';actor:string;interaction:Interaction;strength?:number}|{time:number;type:'acceleration';ax:number;ay:number}|{time:number;type:'walk';actor:string;x:number};
export interface BakeOptions {actor:string;start?:number;duration?:number;fps?:15|24|30|60|120;clipId?:string;events?:BakeEvent[];maxPositionError?:number;maxAngleError?:number;signal?:AbortSignal;onProgress?:(progress:{phase:'simulate'|'refine'|'validate';progress:number})=>void}
export interface BakeDiagnostics {actor:string;clipId:string;packId:string;start:number;duration:number;fps:number;samples:number;keys:number;maxPositionError:number;maxAngleError:number;tolerance:{position:number;angle:number};widenedLimits:string[];removedContacts:string[];remainingPhysicalActors:string[];notes:string[]}
export interface BakeResult {document:SceneDocument;commands:Array<{op:'set';path:Array<string|number>;value:unknown}>;diagnostics:BakeDiagnostics}
export const BAKE_LIMITS:Readonly<{duration:number;samples:number;scalarSamples:number;events:number;keys:number;fps:readonly number[]}>;
export function bakeSceneMotion(document:SceneDocument,options:BakeOptions):Promise<BakeResult>;
