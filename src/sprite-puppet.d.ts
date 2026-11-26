export interface SpriteBinding {x:number;y:number;rotation:number;size:number;parent?:string|null}
export interface SpriteSkin {
  viewChannel:string;joints:string[];intervals:number;
  views:{pivots:[number,number][];weights:string}[];
}
export interface SpritePart extends SpriteBinding {
  space?:{z?:number;aim?:{channel?:string;range?:[number,number]};view?:{channel:string;range:[number,number];joint?:string};
    collision?:{spheres:[number,number,number,number][];avoid?:{target:string;pivot:string;side:'behind'|'front'}};
    bearings?:{range:[number,number];images:Record<string,string[]>};plant?:[number,number,number];
    twist?:{to:string;neutral:number};limits?:Partial<Record<'rotation'|'yaw'|'pitch'|'twist',[number,number]>>};
  id:string;parent:string|null;pivot:number;depth:number;image:string;
  variants:{image:string;when:Record<string,number>}[];
  registration?:{channel:string;offsets:[number,number][]};
  skin?:SpriteSkin;
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
export interface SpriteFrame extends SpriteBinding {id:string;tile:number;depth:number;z?:number;bearing?:number;stretch?:number;layers?:SpriteRegion[];collision?:{x:number;y:number;z:number;r:number}[];contactBlocked?:boolean;
  deformation?:{skin:SpriteSkin;view:number;angles:number[]}}
export interface SpriteRig {doc:SpritePuppet;pieces:SpritePart[]}
export interface BakedSpriteSkin {image:CanvasImageSource;frames:Record<string,number[]>}
export function drawSpriteFrame(ctx:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D,atlas:CanvasImageSource,document:SpritePuppet,pose:SpriteFrame[],baked?:BakedSpriteSkin):void;
export function validateSpritePuppet(document:unknown):SpritePuppet;
export function compileSpritePuppet(document:SpritePuppet,bindings?:Record<string,SpriteBinding>):SpriteRig;
export function spriteDrawingTimes(document:SpritePuppet):number[];
export function sampleSpritePuppet(rig:SpriteRig,seconds:number,overrides?:Record<string,number>,inspectCollisions?:boolean):SpriteFrame[];
export function drawSpritePuppet(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,rig:SpriteRig,seconds:number,overrides?:Record<string,number>,focus?:string):void;

export interface SpriteDrawList {offsets:Uint32Array;commands:Float32Array}
export function compileSpriteDrawList(doc:SpritePuppet,frames:SpriteFrame[][],rootId:string,baked?:Record<string,number[]>):SpriteDrawList|null;
export function drawSpriteListFrame(ctx:CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D,list:SpriteDrawList,index:number,atlas:CanvasImageSource,cloth:CanvasImageSource,side:number,span:number):void;
