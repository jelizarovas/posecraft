import type {SceneDocument} from './schema.js';
export type GameCommand=({type:'action';clip:string}|{type:'look';target:{x:number;y:number};joint:string;maxAngle:number;duration:number}|{type:'move';x:number;y?:number}|{type:'cancel'})&{actor:string;request:string;channel?:'motion'|'gaze'};
export interface GameCommandEvent {type:'actor.command.completed'|'actor.command.failed';actor:string;request:string;command:'action'|'look'|'move';error?:string;cancelled?:boolean;time:number}
export function validateGameCommand(document:SceneDocument,command:GameCommand):GameCommand;
