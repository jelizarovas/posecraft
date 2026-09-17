import type {CharacterPack} from './schema.js';
import type {Episode} from './episode.js';
export interface HandFeature {x?:number;y:number;roll:number;gesture:'open'|'fist'|'point'|'pinch'}
export interface PerformanceFeatures {face:boolean;roll:number;expression:string;hands:Partial<Record<'left'|'right',HandFeature>>}
export interface PerformanceSample {pose:Record<string,number>;emotion?:string;gestures:Record<'left'|'right',string>;face:boolean}
export interface PerformanceTake {schemaVersion:1;kind:'performance-take';duration:number;frames:{time:number;pose:Record<string,number>;emotion:string;gestures?:Record<string,string>;face?:boolean}[]}
export function performanceFeatures(result:{face?:{x:number;y:number}[]|null;blendshapes?:Record<string,number>;hands?:{side:string;score:number;points:{x:number;y:number}[]}[]}):PerformanceFeatures;
export class PerformanceRetargeter {constructor(pack:CharacterPack);calibrate(features:PerformanceFeatures):void;sample(features:PerformanceFeatures,time:number):PerformanceSample}
export function assertTake(take:unknown,pack:CharacterPack):PerformanceTake;
export function sampleTake(take:PerformanceTake,time:number):{pose:Record<string,number>;emotion:string};
/** Mutates the selected shot. Validate and commit the result using your document transaction. Returns the applied duration. */
export function applyTake(project:Episode,shot:string,actor:string,take:PerformanceTake,start?:number):number;
