import type {SceneDocument,SceneContact} from './schema.js';
import type {Frame} from './scene.js';
export type GameTarget=SceneContact['target'];
export interface GameLocomotion {mode:'ground-x'|'planar'|'float';speed?:number;clearance?:number;cellSize?:number;clip?:string}
export interface GameActorBinding {actions?:Record<string,string>;reactions?:Record<string,{action?:string;emotion?:string}>;gaze?:{joint:string;maxAngle?:number};speech?:boolean;locomotion?:GameLocomotion}
export interface GameBindings {anchors?:Record<string,GameTarget>;actors?:Record<string,GameActorBinding>}
export interface ResolvedGameActorBindings {actions:Record<string,string>;reactions:Record<string,{action?:string;emotion?:string}>;gaze?:{joint:string;maxAngle?:number};speech:boolean;locomotion?:GameLocomotion}
export interface GameSceneManifest {schemaVersion:1;id:string;actors:Array<{id:string;name:string;actions:string[];reactions:string[];canSpeak:boolean;canLook:boolean;locomotion:'ground-x'|'planar'|'float'|'none';anchors:string[]}>;objects:Array<{id:string;properties:['enabled'];commands:string[]}>;anchors:string[];events:string[]}
export function validateGameBindings(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
export function gameActorBindings(document:SceneDocument,id:string):ResolvedGameActorBindings|null;
export function resolveGameTarget(document:SceneDocument,frame:Frame,targetOrName:GameTarget|string):{x:number;y:number}|null;
export function describeGameScene(document:SceneDocument):GameSceneManifest;
