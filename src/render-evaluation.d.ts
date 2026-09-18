import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
import type {SVGOptions} from './svg.js';
export type Matrix=[number,number,number,number,number,number];
export type Material={type:'solid';color:string}|{type:'radial';cx:number;cy:number;rx:number;ry:number;stops:Array<[number,string,number?]>};
export interface RenderCapability {code:string;message:string}
export interface CapabilityReport {supported:boolean;unsupported:RenderCapability[];limitations:RenderCapability[]}
export interface PickResult {actor?:string;part?:string;joint?:string;fragment?:string;prop?:string;object?:string;emitter?:string;command?:string}
export interface DrawingPath {id:string;kind:'path';d:string;matrix:Matrix;fill:Material;stroke:Material;strokeWidth:number;strokeDash?:number[];opacity:number;visible:boolean;clips:Array<{d:string;matrix:Matrix}>;pick:PickResult|null;depth:number;mesh?:boolean}
export interface DrawingMesh {actor:string;part:string;joint:string;matrix:Matrix;vertices:Array<{x:number;y:number;z:number;depth:number}>;triangles:number[][];edges:Array<{id:string;indices:number[];visible:boolean;kind:string}>;order:number;stroke:string;strokeWidth:number;fill:Material;opacity:number;visible:boolean;masked:boolean;outlined:boolean}
export interface EvaluatedDrawing {version:1;depthMode:'actor'|'painter';time:number;width:number;height:number;units:Array<{id:string;depth:number|null;layer:string;commands:DrawingPath[]}>;meshes:DrawingMesh[];stats:{actors:number;paths:number;vertices:number;triangles:number};capabilities:CapabilityReport}
export function evaluateDrawing(document:SceneDocument,frame:Frame,options?:SVGOptions):EvaluatedDrawing;
export function inspectCanvasCapabilities(document:SceneDocument,options?:SVGOptions):CapabilityReport;
