import type {SceneDocument,SceneEmitter} from './schema.js';
export const MAX_EMITTER_PARTICLES:number;
export const MAX_SCENE_PARTICLES:number;
export interface EmitterParticle {slot:number;birth:number;x:number;y:number;scaleX:number;scaleY:number;rotation:number;opacity:number;color:string;kind:'flame'|'smoke'|'ember'}
export function emitterCapacity(emitter:SceneEmitter):number;
export function sampleEmitter(emitter:SceneEmitter,time:number,capacity?:number):EmitterParticle[];
export function sampleEmitters(document:SceneDocument,time:number,frame?:{emitterOverrides?:Record<string,{enabled:boolean}>}):{emitter:SceneEmitter;particles:EmitterParticle[]}[];
export function emitterPulse(emitter:SceneEmitter,time:number):number;
