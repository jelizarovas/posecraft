import type {Clip,SceneDocument} from './schema.js';
import type {Command} from './commands.js';
export interface TimelineKeyReference {track:string; time:number}
export type TimelineKeyOperation = {type:'move'|'copy';offset:number}|{type:'scale';factor:number;pivot:number}|{type:'delete'}|{type:'easing';easing:'linear'|'smooth'|'step'};
/** Returns a copy; rejects stale selections, collisions, invalid parameters and out-of-clip times atomically. Retimed keys use millisecond precision. */
export function editTimelineKeys(clip:Clip, selection:TimelineKeyReference[], operation:TimelineKeyOperation):{clip:Clip;selection:TimelineKeyReference[]};
/** Returns one validated revision and reusable atomic commands. Scales keys,
 * events, explicitly clip-filtered contacts and matching authored scroll windows.
 * Rejects millisecond collisions and unsupported live timing dependencies. */
export function retimeSceneClip(document:SceneDocument,options:{packId:string;clipId:string;duration:number}):{document:SceneDocument;commands:Command[];expectedRevision:number;scale:number;contacts:string[];notes:string[]};
