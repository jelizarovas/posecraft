import type {EvaluatedDrawing,PickResult,RenderCapability} from './render-evaluation.js';
export function inspectDepthCanvasCapabilities(drawing:EvaluatedDrawing):{supported:boolean;unsupported:RenderCapability[]};
export function renderDepthCanvas(context:CanvasRenderingContext2D,drawing:EvaluatedDrawing,options?:{maxPixels?:number;maxTrianglePixels?:number}):{depth:Float32Array;picks:Int32Array;triangles:number;candidatePixels:number;pick(x:number,y:number):PickResult|null};
