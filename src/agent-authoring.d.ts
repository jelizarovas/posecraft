import type {SceneDocument,Clip,CharacterPack,SceneContact,PointerBinding} from './schema.js';
import type {Command} from './commands.js';
export interface SceneDiagnostic {severity:'error'|'warning';code:string;path:string;message:string;details?:Record<string,unknown>}
export interface SceneDiagnostics {valid:boolean;diagnostics:SceneDiagnostic[];truncated:boolean}
export type SemanticOperation={type:'create-clip';pack:string;id:string;duration:number;loop?:boolean;tracks:Clip['tracks'];events?:Clip['events']}|{type:'retime-clip';pack:string;id:string;duration:number}|{type:'create-contact';value:SceneContact}|{type:'create-interaction';value:PointerBinding};
export interface SceneEditProposal {format:'posecraft-edit-proposal';version:1;scene:string;expectedRevision:number;commands:Command[];summary:Array<{type:string;id:string;pack?:string;description:string;notes?:string[]}>;diagnostics:SceneDiagnostics}
export interface InspectedPack {name:string;joints:CharacterPack['joints'];parts:string[];inputs:CharacterPack['inputs'];clips:Record<string,{duration:number;loop:boolean;events:NonNullable<Clip['events']>;tracks:string[];keys:number}>;states:CharacterPack['states']}
export function diagnoseScene(document:unknown,options?:{maxDiagnostics?:number}):SceneDiagnostics;
export function inspectScene(document:SceneDocument):{id:string;name:string;revision:number;bounds:SceneDocument['bounds'];requiredFeatures:string[];actors:SceneDocument['actors'];objects:NonNullable<SceneDocument['objects']>;props:NonNullable<SceneDocument['props']>;packs:Record<string,InspectedPack>;contacts:SceneContact[];interactions:PointerBinding[];diagnostics:SceneDiagnostics};
export function proposeSceneEdit(document:SceneDocument,request:{expectedRevision:number;operations:SemanticOperation[]}):SceneEditProposal;
export function applySceneProposal(document:SceneDocument,proposal:SceneEditProposal):SceneDocument;
