import type {SceneDocument,CharacterPack,SceneContact} from './schema.js';
import type {Frame} from './scene.js';
export interface ContactDiagnostic {id:string;actor:string;active:boolean;reason:string|null;target:{x:number;y:number}|null;actual:{x:number;y:number};error:number|null;limited:boolean;weight:number}
export function solveContact(pack:CharacterPack,pose:Record<string,number>,chain:SceneContact['chain'],target:{x:number;y:number},options?:{bend?:1|-1;weight?:number;keepOrientation?:boolean}):{pose:Record<string,number>;actual:{x:number;y:number};error:number;limited:boolean};
export function applyContacts(document:SceneDocument,frame:Frame,options?:{time?:number;actorTimes?:Record<string,number>;actorClips?:Record<string,string>}):Frame;
