import type {SceneDocument,SceneProp} from './schema.js';
import type {Frame} from './scene.js';
export function evaluatedProps(document:SceneDocument,frame:Frame):SceneProp[];
export function validateAttachments(document:SceneDocument,check:(valid:unknown,path:string,message:string)=>void):void;
