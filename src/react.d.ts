import type {ScrollOptions} from './scroll-bindings.js';
import type {CSSProperties,ForwardRefExoticComponent,RefAttributes,RefObject} from 'react';
import type {SceneDocument,BehaviorSettings} from './schema.js';
import type {SceneController,SceneEvent,Interaction} from './scene.js';
import type {WorkerSceneController} from './worker.js';
import type {GameBindings} from './browser.js';
import type {GameEvent,SpeechRequest} from './game.js';
export interface PosecraftHandle extends GameBindings {play():void;pause():void;reset():void;seek(time:number):void;refreshScroll():void;interact(actor:string,type:Interaction,strength?:number):void;readonly controller:SceneController|WorkerSceneController|undefined}
export interface PosecraftProps {scene:SceneDocument;scroll?:ScrollOptions|false;execution?:'worker'|'main';inputs?:Record<string,Record<string,string|number|boolean>>;behavior?:Record<string,BehaviorSettings>;onEvent?:(event:SceneEvent|GameEvent)=>void;onError?:(error:Error)=>void;onSpeechRequest?:(request:SpeechRequest)=>void|Promise<void>;motion?:(time:number)=>{x:number;y:number;teleport?:boolean};hostRef?:RefObject<HTMLElement|null>;reducedMotion?:boolean|'system';label?:string;className?:string;style?:CSSProperties}
export const Posecraft:ForwardRefExoticComponent<PosecraftProps & RefAttributes<PosecraftHandle>>;
export const PosecraftScene:typeof Posecraft;
