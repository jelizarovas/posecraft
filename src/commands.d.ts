import {SceneDocument} from './schema.js';
export type Command = ({op:'set';path:(string|number)[];value:unknown}|{op:'delete';path:(string|number)[]});
export class DocumentStore {constructor(document:SceneDocument);document:SceneDocument;past:SceneDocument[];future:SceneDocument[];transact(commands:Command[],expectedRevision?:number):SceneDocument;undo():SceneDocument;redo():SceneDocument}
