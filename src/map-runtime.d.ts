import type {MapDocument,MapPoint,MapIndex,MapRect,MapProp} from './map.js';
export interface MapEvent {type:string;actor?:string;request?:string;object?:string;target?:string|MapPoint;message?:string;[key:string]:unknown}
export interface MapFrame {actors:Array<{id:string;x:number;y:number;speed:number;color?:string;facing:number;travelFacing:number;gaitWeight:number;gait:'walk'|'run';running:boolean;walking:boolean;skidding:boolean;jumping:boolean;jumpProgress:number;rolling:boolean;rollProgress:number;turning:boolean;lift:number;phase:number;traversalAction:'vault'|'climb-up'|'climb-down'|null;traversalProgress:number;supportContact:(MapPoint&{z:number})|null}>;objects:Record<string,{opened:true}>;route:MapPoint[]|null;destination:MapPoint|null;pending:number}
export interface MapMoveOptions {signal?:AbortSignal;gait?:'walk'|'run'}
export interface MapState {format:'posecraft-map-state';version:1;map:string;actors:Array<{id:string;x:number;y:number;facing:number}>;objects:Record<string,{opened:true}>}
export interface MapOptions {execution?:'worker'|'main';onEvent?:(event:MapEvent)=>void;onError?:(error:Error)=>void}
export class MapController {
 constructor(document:MapDocument,options?:MapOptions);
 readonly map:MapDocument;readonly index:MapIndex;readonly ready:Promise<MapController>;
 readonly stats:{execution:'main'|'worker';expanded:number;pending:number};
 readonly isMoving:boolean;actorPosition(id:string):MapFrame['actors'][number];advance(dt:number):void;
 visibleFrame(rect:MapRect,props?:MapProp[],options?:{routeActor?:string|null}):MapFrame&{routeSegments:Array<{from:MapPoint;to:MapPoint;offset:number}>;candidateActors:number;candidateRouteSegments:number};
 subscribe(listener:(event:MapEvent)=>void):()=>void;
 actor(id:string):{moveTo(target:string|MapPoint,options?:MapMoveOptions):Promise<MapEvent>;faceTo(target:MapPoint,options?:{signal?:AbortSignal}):Promise<MapEvent>;cancel():void};
 faceTo(actor:string,target:MapPoint,options?:{signal?:AbortSignal}):Promise<MapEvent>;
 moveTo(actor:string,target:string|MapPoint,options?:MapMoveOptions):Promise<MapEvent>;
 cancel(actor:string):void;step(dt:number):MapFrame;frame():MapFrame;snapshot():MapState;restore(state:unknown):MapFrame;dispose():void;
}
