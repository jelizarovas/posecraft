import {SceneDocument,FluidCommand} from './schema.js';
import {MotionReading} from './device-motion.js';
export class BottleMotionSignal {reset():void;update(event:MotionReading,time:number,screenAngle?:number,sensitivity?:number):boolean;sample(time:number):{ax:number;ay:number;turn:number;gravityX:number;gravityY:number}}
export interface BottleControls {enableMotion():Promise<boolean>;disableMotion():void;readonly motionEnabled:boolean;dispose():void}
export function mountBottleControls(element:HTMLElement,document:SceneDocument,controller:{fluidInput(command:FluidCommand):unknown},options?:{isEnabled?:()=>boolean;onInteract?:()=>void;onUpdate?:()=>void;onStatus?:(message:string)=>void}):BottleControls;
