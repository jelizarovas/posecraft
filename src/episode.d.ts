import type {SceneDocument,Keyframe,Camera} from './schema.js';
import type {Frame} from './scene.js';
export const episodeCapabilities:{schemaVersion:number;kind:string;features:readonly string[];unavailable:readonly string[]};
export interface ProceduralMotion {kind:'sway'|'noise';joint:string;channel:'rotation'|'x'|'y';amplitude:number;frequency:number;seed:number}
export interface ShotActor {clip:string;offset:number;speed:number;emotion?:string;placement?:Partial<Record<'x'|'y'|'scale'|'rotation',Keyframe[]>>;pose?:Record<string,Keyframe[]>;motion?:ProceduralMotion}
export interface Shot {id:string;name:string;scene:string;duration:number;camera:Record<'x'|'y'|'zoom'|'rotation',Keyframe[]>;actors?:Record<string,ShotActor>;reference?:{id:string;name:string;time:number}}
export interface Episode {schemaVersion:1;kind:'episode';id:string;name:string;revision:number;fps:12|24|25|30|60;size:{width:number;height:number};scenes:Record<string,SceneDocument>;shots:Shot[]}
export interface EpisodeFrame extends Frame {shot:string;scene:string;localTime:number;shotIndex:number;camera:Camera}
export function assertEpisode(project:unknown):Episode;
export function episodeDuration(project:Episode):number;
export function shotAt(project:Episode,time:number):{shot:Shot;index:number;start:number;time:number};
export function motionValue(motion:ProceduralMotion,time:number):number;
export class EpisodeController {constructor(project:Episode);project:Episode;frame(time:number):EpisodeFrame;bakeMotion(shot:string,actor:string):Keyframe[]}
