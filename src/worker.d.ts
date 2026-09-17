import type {SceneDocument,BehaviorSettings} from './schema.js';
import type {Frame,SceneEvent,Interaction} from './scene.js';
export interface PathRequest {start:{x:number;y:number};end:{x:number;y:number};cellSize?:number;clearance?:number}
export interface PathResult {path:{x:number;y:number}[]|null;expanded:number;cellSize:number}
export interface WorkerStats {execution:string;computeMs:number;roundTripMs:number;droppedSeconds:number;pendingBatches:number}
export class WorkerSceneController {
 constructor(document:SceneDocument,options?:{reducedMotion?:boolean;onError?:(error:Error)=>void});
 readonly ready:Promise<WorkerSceneController>;readonly stats:WorkerStats;readonly time:number;document:SceneDocument;playing:boolean;animationPlaying:boolean;reducedMotion:boolean;motion:{ax:number;ay:number};size?:{width:number;height:number};
 onFrame?:(frame:Frame)=>void;
 frame():Frame;step(dt:number):Frame;reset():Frame;seek(time:number):Frame;
 triggerEnsemble(type:'conversation'|'doze'|'meteor'|'share'|'share-missed'|'share-help'|'burn'):void;
 walkTo(actor:string,x:number):void;
 setInput(actor:string,name:string,value:string|number|boolean):void;setBehavior(actor:string,settings:BehaviorSettings):void;interact(actor:string,type:Interaction,strength?:number):void;
 previewClip(actor:string,clip:string,time:number,overrides?:Record<string,number>):Frame;clearPreview(actor:string):void;
 setAcceleration(ax:number,ay:number):void;sampleHost(sample:{x:number;y:number;time:number;teleport?:boolean}):void;
 findPath(request:PathRequest,options?:{signal?:AbortSignal}):Promise<PathResult>;
 subscribe(fn:(event:SceneEvent)=>void):()=>void;rebaseline():void;play():void;pause():void;dispose():void;
}
