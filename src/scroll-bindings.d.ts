import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
export interface ScrollBinding {source:'progress'|'velocity';target:{type:'input';actor:string;name:string}|{type:'variable';name:string};from:[number,number];to:[number,number]}
export interface ScrollConfig {mode:'live'|'authored';axis?:'x'|'y';maxVelocity?:number;smoothing?:number;reducedMotion?:'still'|'progress';bindings?:ScrollBinding[];clips?:Array<{actor:string;clip:string;start?:number;end?:number}>}
export type ScrollOptions=ScrollConfig&{source?:Window|HTMLElement};
export interface ScrollSample {offset:number;max:number;time:number;progress:number;velocity:number}
export interface ScrollController {reducedMotion:boolean;setInput(actor:string,name:string,value:number):void;setVariable(name:string,value:number):void;previewClip(actor:string,clip:string,time:number):unknown;clearPreview(actor:string):void;frame():Frame;pause():void}
export interface ScrollConnection {refresh():void;sample():ScrollSample|null;dispose():void}
export function validateScrollConfig(document:SceneDocument,config:unknown,check:(valid:unknown,path:string,message:string)=>void,path?:string):void;
export function assertScrollConfig(document:SceneDocument,config:ScrollConfig):ScrollConfig;
export class ScrollSignal {constructor(options?:{maxVelocity?:number;smoothing?:number});velocity:number;reset():void;sample(sample:{offset:number;max:number;time:number}):ScrollSample}
export function applyScrollSample(controller:ScrollController,document:SceneDocument,config:ScrollConfig,sample:ScrollSample,options?:{reducedMotion?:boolean;lastValues?:Map<string,number>}):ScrollSample;
export function mountScrollBindings(element:HTMLElement,document:SceneDocument,controller:ScrollController,options:ScrollOptions,callbacks?:{onUpdate?:(frame:Frame,sample:ScrollSample)=>void;onError?:(error:Error)=>void;getReducedMotion?:()=>boolean}):ScrollConnection;
