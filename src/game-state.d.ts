import type {SceneDocument} from './schema.js';
import type {SceneController,Frame} from './scene.js';
import type {ObjectOwner} from './scene-objects.js';
import type {BehaviorPayload} from './behaviors.js';
export interface GameBehaviorState {state:string;variables:Record<string,boolean|number>;age:number;rng:number;payload:BehaviorPayload;deadlines:Record<string,number>;emitters:Record<string,{enabled:boolean}>}
/** Version 1 is a semantic resume, not a physics or command-promise checkpoint. */
export interface GameSceneSnapshot {
 format:'posecraft-game-state';version:1;scene:string;time:number;
 actors:Array<{id:string;sleeping:boolean;inputs:Record<string,string|number|boolean>;state:string;clipTime:number;root:string;position:{x:number;y:number}|null}>;
 behavior:GameBehaviorState|null;actorBehaviors:Array<{id:string;state:GameBehaviorState}>;
 objects:Array<{id:string;x:number;y:number;rotation:number;enabled:boolean;owner:ObjectOwner|null}>;
}
export function gameSceneSignature(document:SceneDocument):string;
export function captureGameState(controller:SceneController):GameSceneSnapshot;
export function validateGameState(document:SceneDocument,input:unknown):GameSceneSnapshot;
export function restoreGameState(controller:SceneController,input:unknown):Frame;
