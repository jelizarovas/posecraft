import type {SceneDocument,Clip,SceneContact,PointerBinding} from './schema.js';
import type {Command} from './commands.js';
export interface SceneDiagnostic {severity:'error'|'warning';code:string;path:string;message:string;details?:Record<string,unknown>}
export interface SceneDiagnostics {valid:boolean;diagnostics:SceneDiagnostic[];truncated:boolean}
export type SemanticOperation={type:'create-clip';pack:string;id:string;duration:number;loop?:boolean;tracks:Clip['tracks']}|{type:'create-contact';value:SceneContact}|{type:'create-interaction';value:PointerBinding};
export interface SceneEditProposal {format:'posecraft-edit-proposal';version:1;scene:string;expectedRevision:number;commands:Command[];summary:Array<{type:string;id:string;pack?:string;description:string}>;diagnostics:SceneDiagnostics}
export function diagnoseScene(document:unknown,options?:{maxDiagnostics?:number}):SceneDiagnostics;
export function inspectScene(document:SceneDocument):{id:string;name:string;revision:number;bounds:SceneDocument['bounds'];requiredFeatures:string[];actors:SceneDocument['actors'];packs:Record<string,unknown>;contacts:SceneContact[];interactions:PointerBinding[];diagnostics:SceneDiagnostics};
export function proposeSceneEdit(document:SceneDocument,request:{expectedRevision:number;operations:SemanticOperation[]}):SceneEditProposal;
export function applySceneProposal(document:SceneDocument,proposal:SceneEditProposal):SceneDocument;
