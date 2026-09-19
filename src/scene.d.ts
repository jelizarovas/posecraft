import type {GameCommand} from './game-performance.js';
import type {ActorBehaviorSnapshot} from './actor-behaviors.js';
import type {CheckpointOptions,CheckpointStats} from './replay-checkpoints.js';
import type {ObjectCommand,SceneObject,ObjectOwner} from './scene-objects.js';
import type {BottleFluidFrame,FluidCommand} from './bottle-fluid.js';
import type {PointerCommand} from './schema.js';
import type {BehaviorPayload,BehaviorSnapshot} from './behaviors.js';
import type {ContactDiagnostic} from './contacts.js';
import { SceneDocument,CharacterPack,BehaviorSettings,Camera } from './schema.js';
export type Interaction='tap'|'pet'|'startle'|'drop'|'toss'|'hurt'|'catch';
export interface PhysicsDiagnostics {state:string;mode:string;resistance:number;predictedImpact:boolean;predictedSurface:string|null;timeToImpact:number|null;contacts:{x:number;y:number;part:string;surface:string;normal:{x:number;y:number}}[];center:{x:number;y:number};velocity:{x:number;y:number};impact:{speed:number;part:string;surface:string;strength:number}|null}
export interface Frame {actorBehaviors?:ActorBehaviorSnapshot[];objects?:Array<Omit<SceneObject,'owner'> & {owner:ObjectOwner|null;vx:number;vy:number;visible:boolean}>;objectGames?:Array<{id:string;phase:string;catches:number;misses:number;throws:number;navigation?:Array<{actor:string;status:'planning'|'following'|'blocked'|'direct';expanded:number;path:Array<{x:number;y:number}>}>}>;fluid?:BottleFluidFrame;pointer?:{actor:string;joint:string;response:string;released:boolean};behavior?:BehaviorSnapshot;emitterOverrides?:Record<string,{enabled:boolean}>;contacts?:ContactDiagnostic[];effectsTime?:number;localTime?:number;ensemble?:{fire?:{lit:boolean;phase:'lit'|'cold'|'approach'|'relight'|'return';actor:string|null;since:number;heat:number;available?:boolean;blocked?:boolean};events:{type:string;actors:string[];time:number;detail:string}[];sharing:boolean;share?:{phase:string;giver:string;receiver:string;giverHand:'hold'|'take';receiverHand:'hold'|'take';observer?:string;noticed:boolean;owner:string|null;contact?:number|null}|null};time:number;camera?:Camera;actors:{objectContactError?:number;clip?:string;clipTime?:number;groundY?:number;activity?:string;heat?:number;id:string;placement?:{x:number;y:number;scale:number;rotation:number};response:string;recovery?:{phase:string;blocked:boolean;target:{x:number;y:number}}|null;physics:PhysicsDiagnostics|null;inputs:Record<string,string|number|boolean>;pose:Record<string,number>;world:Record<string,{x:number;y:number;rotation:number;endX:number;endY:number}>;state:string;spring:{x:number;y:number;vx:number;vy:number}}[]}
export interface SceneEvent {type:string;actor?:string;time:number;[key:string]:unknown}
export const STEP:number;
export function compilePack(pack:CharacterPack):unknown;
export class SceneController {
 constructor(document:SceneDocument, options?:{reducedMotion?:boolean;checkpoints?:CheckpointOptions|false});
 invalidateCheckpoints():void;checkpointStats():CheckpointStats;
 document:SceneDocument;time:number;playing:boolean;animationPlaying:boolean;reducedMotion:boolean;log:unknown[];size?:{width:number;height:number};
 setInput(actor:string,name:string,value:string|number|boolean):void;
 setBehavior(actor:string,settings:BehaviorSettings):void;interact(actor:string,type:Interaction,strength?:number):void;
 gameCommand(command:GameCommand):boolean;
 objectCommand(command:ObjectCommand):boolean|void;
 fluidInput(command:FluidCommand):Frame;
 pointer(command:PointerCommand):void;
 setActorVariable(actor:string,name:string,value:boolean|number):void;dispatchActor(actor:string,event:string,payload?:BehaviorPayload):boolean;
 dispatch(event:string,payload?:BehaviorPayload):boolean;setVariable(name:string,value:boolean|number):void;
 triggerEnsemble(type:'conversation'|'doze'|'meteor'|'share'|'share-missed'|'share-help'|'burn'|'fire-off'|'fire-relight'|'fire-on'|'food-throw'|'face-shoo'|'food-ready',payload?:BehaviorPayload):void;
 walkTo(actor:string,x:number):void;
 setAcceleration(ax:number,ay:number):void;
 sampleHost(sample:{x:number;y:number;time:number;teleport?:boolean}):void;
 step(dt:number):Frame;frame():Frame;seek(time:number):Frame;reset():Frame;play():void;pause():void;rebaseline():void;dispose():void;
 previewClip(actor:string,clip:string,time:number,overrides?:Record<string,number>):Frame;clearPreview(actor:string):void;
 subscribe(listener:(event:SceneEvent)=>void):()=>void;
}
