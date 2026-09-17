import type {CSSProperties,ForwardRefExoticComponent,RefAttributes,RefObject} from 'react';
import type {SceneDocument,BehaviorSettings} from './schema.js';
import type {SceneController,SceneEvent,Interaction} from './scene.js';
export interface PosecraftHandle {play():void;pause():void;reset():void;seek(time:number):void;interact(actor:string,type:Interaction,strength?:number):void;readonly controller:SceneController|undefined}
export interface PosecraftProps {scene:SceneDocument;inputs?:Record<string,Record<string,string|number|boolean>>;behavior?:Record<string,BehaviorSettings>;onEvent?:(event:SceneEvent)=>void;onError?:(error:Error)=>void;motion?:(time:number)=>{x:number;y:number;teleport?:boolean};hostRef?:RefObject<HTMLElement|null>;reducedMotion?:boolean|'system';label?:string;className?:string;style?:CSSProperties}
export const Posecraft:ForwardRefExoticComponent<PosecraftProps & RefAttributes<PosecraftHandle>>;
