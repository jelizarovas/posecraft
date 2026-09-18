import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
export interface PoseBinding {actor:string;joint:string;space:'world';x:{variable:string};y:{variable:string};excludeClips?:string[]}
export function validatePoseBindings(document:SceneDocument,check:(valid:boolean,path:string,message:string)=>void):void;
export class PoseBindings {constructor(document:SceneDocument);apply(frame:Frame,variables:Record<string,number|boolean>,options?:{disabledActors?:Set<string>}):Frame}
