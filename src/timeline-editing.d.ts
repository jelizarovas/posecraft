import type {Clip} from './schema.js';
export interface TimelineKeyReference {track:string; time:number}
export type TimelineKeyOperation = {type:'move'|'copy';offset:number}|{type:'scale';factor:number;pivot:number}|{type:'delete'}|{type:'easing';easing:'linear'|'smooth'|'step'};
/** Returns a copy; rejects stale selections, collisions, invalid parameters and out-of-clip times atomically. Retimed keys use millisecond precision. */
export function editTimelineKeys(clip:Clip, selection:TimelineKeyReference[], operation:TimelineKeyOperation):{clip:Clip;selection:TimelineKeyReference[]};
