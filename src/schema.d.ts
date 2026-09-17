export interface Joint { id:string; parent:string|null; x:number; y:number; length:number; rotation:number; min:number; max:number }
export type Keyframe = [number, number, ('linear'|'smooth'|'step')?];
export interface Clip { duration:number; loop:boolean; tracks:Record<string,Keyframe[]> }
export type Input = {type:'boolean'; default:boolean}|{type:'number';default:number;min:number;max:number}|{type:'string';default:string;options:string[]};
export interface Part { id:string; joint:string; d:string; fill:string; channel?:string; transform?:string; stroke?:string; strokeWidth?:number; variantInput?:string; variants?:Record<string,{d?:string;transform?:string;visible?:boolean}>;showWhen?:{input:string;equals:string|number|boolean} }
export interface CharacterPack { name:string; joints:Joint[]; parts:Part[]; clips:Record<string,Clip>; inputs:Record<string,Input>; initial:string; states:Record<string,{clip:string;transitions?:{to:string;duration:number;when:{input:string;equals:string|number|boolean}}[]}>; reaction?:{joint:string;strength:number;stiffness:number;damping:number}; expressions?:Record<string,Record<string,number>>; appearanceDefaults?:Record<string,string>; description?:string; provenance?:Record<string,string> }
export interface Actor {id:string;name:string;pack:string;transform:{x:number;y:number;scale:number;rotation:number};appearance?:Record<string,string>;inputs?:Record<string,string|number|boolean>}
export interface SceneDocument { schemaVersion:1;kind:'scene';id:string;name:string;revision:number;bounds:{width:number;height:number};requiredFeatures?:string[];packs:Record<string,CharacterPack>;actors:Actor[] }
export const capabilities: {schemaVersion:1;renderer:string;features:readonly string[];unavailable:readonly string[]};
export function validateDocument(doc:unknown):{valid:boolean;errors:{path:string;message:string}[]};
export function assertDocument(doc:unknown):SceneDocument;
