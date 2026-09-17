import type {BottleFluid,FluidCommand} from './bottle-fluid.js';
import type {mountBottleControls} from './bottle-browser.js';
import type {SceneDocument,BehaviorSettings,PointerCommand} from './schema.js';
import type {Frame,SceneEvent,Interaction} from './scene.js';
export interface IllustrationProviders {
 fluidFactory?:typeof BottleFluid;
 mountBottleControls?:typeof mountBottleControls;
 ensembleFactory?:new(document:SceneDocument)=>{advance(time:number,excluded:Set<string>):void;trigger(event:string,payload?:unknown):void;apply(frame:Frame,excluded:Set<string>):Frame;setEmitterEnabled?(id:string,enabled:boolean):void;drainEvents?():Array<{event:string;actor?:string}>};
 contactSolver?:(document:SceneDocument,frame:Frame)=>Frame;
 behaviorFactory?:new(document:SceneDocument,options:{apply:(action:any,payload:any)=>void})=>any;
 pointerFactory?:new(document:SceneDocument,options:{dispatch:(event:string,payload?:any)=>void})=>any;
 mountPointers?:(element:HTMLElement,document:SceneDocument,controller:IllustrationController,options:any)=>(()=>void)|{dispose():void};
}
export class IllustrationController {
 constructor(document:SceneDocument,options?:IllustrationProviders&{reducedMotion?:boolean});
 document:SceneDocument;time:number;playing:boolean;animationPlaying:boolean;reducedMotion:boolean;
 setInput(actor:string,name:string,value:string|number|boolean):void;
 setBehavior(actor:string,settings:BehaviorSettings):void;
 interact(actor:string,type:Interaction,strength?:number):void;
 dispatch(event:string,payload?:{actor?:string;x?:number;y?:number}):boolean;
 setVariable(name:string,value:number|boolean):void;
 fluidInput(command:FluidCommand):Frame;
 pointer(command:{binding:string;phase:'start'|'move'|'end'|'cancel'|'click'|'hover';x:number;y:number}):Frame;
 triggerEnsemble(event:string,payload?:{actor?:string;x?:number;y?:number}):void;
 previewClip(actor:string,clip:string,time:number,overrides?:Record<string,number>):Frame;
 clearPreview(actor:string):void;
 setAcceleration(ax:number,ay:number):void;
 sampleHost(sample:{x:number;y:number;time:number;teleport?:boolean}):void;
 step(dt:number):Frame;frame():Frame;seek(time:number):Frame;reset():Frame;play():void;pause():void;rebaseline():void;dispose():void;
 subscribe(listener:(event:SceneEvent)=>void):()=>void;
}
export interface IllustrationPlayer {fluidInput(command:FluidCommand):void;enableMotion():Promise<boolean>;disableMotion():void;setVariable(name:string,value:boolean|number):void;pointer(command:PointerCommand):void;controller:IllustrationController;setInput(actor:string,name:string,value:string|number|boolean):void;dispatch(event:string,payload?:{actor?:string;x?:number;y?:number}):void;interact(actor:string,type:Interaction,strength?:number):void;play():void;pause():void;reset():void;seek(time:number):void;dispose():void}
export function mountIllustration(element:HTMLElement,document:SceneDocument,options?:IllustrationProviders&{host?:HTMLElement;reducedMotion?:boolean|'system';onEvent?:(event:SceneEvent)=>void;onError?:(error:Error)=>void;label?:string;autoplay?:boolean}):IllustrationPlayer;
