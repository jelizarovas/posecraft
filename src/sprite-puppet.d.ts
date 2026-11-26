export interface SpriteBinding {x:number;y:number;rotation:number;size:number;parent?:string|null}
export interface SpritePart extends SpriteBinding {
  id:string;parent:string|null;pivot:number;depth:number;image:string;
  variants:{image:string;when:Record<string,number>}[];
  layers?:{channel:string;label:string;viewChannel:string;emptyValue?:number;width:number;height:number;
    views:{x:number;y:number;left:number;top:number}[]}[];
}
export interface SpritePuppet {
  format:string;version:number;name:string;bounds:number[];
  atlas:{tile:number;columns:number;height?:number;images:string[];src:string};
  interpolated?:string[];
  channels:Record<string,string[]>;
  parts:SpritePart[];
  clip:{duration:number;loop:boolean;tracks:Record<string,(number|string)[][]>};
}
export interface SpriteRegion {channel:string;x:number;y:number;left:number;top:number;width:number;height:number;empty?:boolean}
export interface SpriteFrame extends SpriteBinding {id:string;tile:number;depth:number;layers?:SpriteRegion[]}
export interface SpriteRig {doc:SpritePuppet;pieces:SpritePart[]}
export function drawSpriteFrame(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,document:SpritePuppet,pose:SpriteFrame[]):void;
export function validateSpritePuppet(document:unknown):SpritePuppet;
export function compileSpritePuppet(document:SpritePuppet,bindings?:Record<string,SpriteBinding>):SpriteRig;
export function spriteDrawingTimes(document:SpritePuppet):number[];
export function sampleSpritePuppet(rig:SpriteRig,seconds:number,overrides?:Record<string,number>):SpriteFrame[];
export function drawSpritePuppet(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,rig:SpriteRig,seconds:number,overrides?:Record<string,number>,focus?:string):void;
