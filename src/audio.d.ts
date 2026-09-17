import type {SceneEvent} from './scene.js';
export function soundPattern(event:Partial<SceneEvent>&{type:string}):[number,number,number,string]|null;
export class SoundEffects {
 constructor(options?:{volume?:number;createContext?:()=>AudioContext});
 readonly enabled:boolean;readonly volume:number;readonly context:AudioContext|null;
 unlock():Promise<boolean>;setVolume(value:number):void;mute():void;handle(event:Partial<SceneEvent>&{type:string}):boolean;dispose():void;
}
