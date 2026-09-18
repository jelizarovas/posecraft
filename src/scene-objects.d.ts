import type {SceneDocument} from './schema.js';
export interface ObjectOwner {actor:string;joint:string;offsetX?:number;offsetY?:number;breakDistance?:number}
export interface SceneObject {id:string;name:string;shape:'circle'|'box';x:number;y:number;radius?:number;width?:number;height?:number;rotation?:number;fill:string;mass:number;restitution?:number;friction?:number;damping?:number;category?:number;mask?:number;depth?:number;enabled?:boolean;owner?:ObjectOwner}
export interface ObjectPhysics {gravity?:number;floorY?:number;actorCollisions?:boolean}
export interface ObjectCommand {type:'attach'|'transfer'|'release'|'impulse'|'place'|'enable';object:string;actor?:string;joint?:string;from?:string;vx?:number;vy?:number;x?:number;y?:number;offsetX?:number;offsetY?:number;maxDistance?:number;enabled?:boolean}
export function validateSceneObjects(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
export function validateObjectCommand(document:SceneDocument,command:ObjectCommand):ObjectCommand;
export class SceneObjects {constructor(document:SceneDocument,options?:{onEvent?:(event:Record<string,unknown>)=>void});tick(dt:number,frame:any):void;apply(frame:any):any;command(command:ObjectCommand,frame:any):boolean;snapshot():unknown;restore(snapshot:unknown):void;reset():this;}

export function objectGrip(document:SceneDocument,frame:import("./scene.js").Frame,owner:ObjectOwner):{x:number;y:number;rotation:number}|null;
export function objectEventPayload(event:Record<string,unknown>):import("./behaviors.js").BehaviorPayload;
