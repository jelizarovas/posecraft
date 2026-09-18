import type {SceneDocument} from './schema.js';
import type {PathRequest,PathResult} from './worker.js';
export interface NavigationShape {shape:'box'|'circle';x:number;y:number;rotation?:number;width?:number;height?:number;radius?:number}
export interface NavigationOptions {clearance?:number;area?:{x:number;y:number;width:number;height:number}}
export function navigationObstacles(document:SceneDocument):NavigationShape[];
export function segmentClear(shapes:NavigationShape[],start:{x:number;y:number},end:{x:number;y:number},options?:NavigationOptions):boolean;
export function navigationSegmentClear(document:SceneDocument,start:{x:number;y:number},end:{x:number;y:number},options?:NavigationOptions):boolean;
export class PathJob {
 constructor(document:SceneDocument,request:PathRequest);
 readonly expanded:number;readonly done:boolean;readonly result:PathResult|null;
 step(maxNodes?:number):boolean;
 snapshot():unknown;
 static restore(document:SceneDocument,snapshot:unknown):PathJob;
}
export function approachPoint(document:SceneDocument,request:PathRequest,maxRings?:number):{x:number;y:number}|null;
