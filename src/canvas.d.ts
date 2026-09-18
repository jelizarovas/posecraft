import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
import type {SVGOptions} from './svg.js';
import type {EvaluatedDrawing,Matrix,PickResult,RenderCapability} from './render-evaluation.js';
export interface CanvasOptions extends SVGOptions {width?:number;height?:number;pixelRatio?:number;background?:string}
export interface MountedCanvas {canvas:HTMLCanvasElement;readonly drawing:EvaluatedDrawing;update(frame:Frame):void;resize(width:number,height:number):void;pick(x:number,y:number):PickResult|null;dispose():void}
export class CanvasCapabilityError extends Error {constructor(reasons:RenderCapability[]);reasons:RenderCapability[]}
export function drawingViewport(drawing:EvaluatedDrawing,width:number,height:number):Matrix;
export function renderCanvas(context:CanvasRenderingContext2D,drawing:EvaluatedDrawing,options?:{clear?:boolean;background?:string;viewport?:Matrix}):{drawn:number;pathCacheSize:number;depth?:{pixels:number;trianglePixels:number;vectorPixels:number}};
export function pickDrawing(context:CanvasRenderingContext2D,drawing:EvaluatedDrawing,x:number,y:number):PickResult|null;
export function mountCanvas(element:Element,document:SceneDocument,frame:Frame,options?:CanvasOptions):MountedCanvas;
