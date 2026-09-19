import type {MapDocument,MapPoint,MapIndex,MapRect,MapProp} from './map.js';
export interface MapEvent {type:string;actor?:string;request?:string;object?:string;target?:string|MapPoint;message?:string;[key:string]:unknown}
export interface MapFrame {actors:Array<{id:string;x:number;y:number;speed:number;color?:string;facing:number;walking:boolean;phase:number}>;objects:Record<string,{opened:true}>;route:MapPoint[]|null;pending:number}
export interface MapState {format:'posecraft-map-state';version:1;map:string;actors:Array<{id:string;x:number;y:number;facing:number}>;objects:Record<string,{opened:true}>}
export interface MapOptions {execution?:'worker'|'main';onEvent?:(event:MapEvent)=>void;onError?:(error:Error)=>void}
export class MapController {
 constructor(document:MapDocument,options?:MapOptions);
 readonly map:MapDocument;readonly index:MapIndex;readonly ready:Promise<MapController>;
 readonly stats:{execution:'main'|'worker';expanded:number;pending:number};
 readonly isMoving:boolean;actorPosition(id:string):MapFrame['actors'][number];advance(dt:number):void;
 visibleFrame(rect:MapRect,props?:MapProp[]):MapFrame&{routeSegments:Array<{from:MapPoint;to:MapPoint}>;candidateActors:number;candidateRouteSegments:number};
 subscribe(listener:(event:MapEvent)=>void):()=>void;
 actor(id:string):{moveTo(target:string|MapPoint,options?:{signal?:AbortSignal}):Promise<MapEvent>;cancel():void};
 moveTo(actor:string,target:string|MapPoint,options?:{signal?:AbortSignal}):Promise<MapEvent>;
 cancel(actor:string):void;step(dt:number):MapFrame;frame():MapFrame;snapshot():MapState;restore(state:unknown):MapFrame;dispose():void;
}
