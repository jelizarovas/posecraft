export interface CatchParticipant {actor:string;root:string;head?:string;feet?:[string,string];chain:{upper:string;lower:string;end:string};bend:1|-1;speed:number;skill:number;reaction:number;crouch:number}
export interface GameNavigation {bounds:{x:number;y:number;width:number;height:number};cellSize:number;clearance:number;maxNodes:number}
export interface PropGame {navigation?:GameNavigation;id:string;type:'catch';object:string;participants:CatchParticipant[];seed:number;variation:number;flightTime:number;pause:number;enabled?:boolean}
export function predictIntercept(ball:{x:number;y:number;vx:number;vy:number},gravity:number,targetY:number,options?:{damping?:number;horizon?:number;step?:number}):{x:number;y:number;time:number}|null;
export class PropGameRuntime {constructor(document:import('./schema.js').SceneDocument,objects:import('./scene-objects.js').SceneObjects,options?:{onEvent?:(event:Record<string,unknown>)=>void});tick(dt:number,frame:any):void;apply(frame:any,options?:{disabledActors?:Set<string>}):any;snapshot():unknown;restore(snapshot:unknown):void;reset():void;}

export function validatePropGames(document:import("./schema.js").SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
