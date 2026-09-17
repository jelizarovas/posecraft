import type {SceneDocument,SceneEmitter} from './schema.js';
export function nodeVisible(document:SceneDocument,node:{group?:string;hidden?:boolean}):boolean;
export function createEmitter(type:SceneEmitter['type'],id:string):SceneEmitter;
export function removeGroup(document:SceneDocument,id:string):SceneDocument;
export function removeSceneEntity(document:SceneDocument,kind:'actor'|'prop'|'emitter',id:string):SceneDocument;
