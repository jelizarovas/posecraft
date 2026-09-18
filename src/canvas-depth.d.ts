import type {EvaluatedDrawing,PickResult,RenderCapability,DrawingPath,Matrix} from './render-evaluation.js';
export function inspectDepthCanvasCapabilities(drawing:EvaluatedDrawing):{supported:boolean;unsupported:RenderCapability[]};
export function renderDepthCanvas(context:CanvasRenderingContext2D,drawing:EvaluatedDrawing,options?:{maxPixels?:number;maxTrianglePixels?:number}):{depth:Float32Array;picks:Int32Array;triangles:number;candidatePixels:number;pick(x:number,y:number):PickResult|null};

export function inspectActorDepthCapabilities(drawing:EvaluatedDrawing):{supported:boolean;unsupported:RenderCapability[]};
export function releaseActorDepth(context:CanvasRenderingContext2D,keep?:Set<string>):void;

export interface ActorDepthBudget {pixels:number;trianglePixels:number;vectorPixels:number}
export function renderActorDepth(context:CanvasRenderingContext2D,drawing:EvaluatedDrawing,unit:EvaluatedDrawing['units'][number],options:{viewport:Matrix;paintCommand(context:CanvasRenderingContext2D,command:DrawingPath,viewport:Matrix):unknown;budget?:ActorDepthBudget;supersample?:number;maxActorPixels?:number;maxFramePixels?:number;maxTrianglePixels?:number;maxVectorPixels?:number}):{tail:DrawingPath[];drawn:number;pixels?:number;triangles?:number;pick(x:number,y:number):PickResult|null}|null;
