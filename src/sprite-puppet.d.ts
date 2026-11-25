export interface SpriteBinding {x:number;y:number;rotation:number;size:number;parent?:string|null}
export interface SpritePart extends SpriteBinding {
  id:string;parent:string|null;pivot:number;depth:number;image:string;
  variants:{image:string;when:Record<string,number>}[];
}
export interface SpritePuppet {
  format:string;version:number;name:string;bounds:number[];
  atlas:{tile:number;columns:number;images:string[];src:string};
  channels:Record<string,string[]>;
  parts:SpritePart[];
  clip:{duration:number;loop:boolean;tracks:Record<string,(number|string)[][]>};
}
export interface SpriteFrame extends SpriteBinding {id:string;tile:number;depth:number}
export interface SpriteRig {doc:SpritePuppet;pieces:SpritePart[]}
export function validateSpritePuppet(document:unknown):SpritePuppet;
export function compileSpritePuppet(document:SpritePuppet,bindings?:Record<string,SpriteBinding>):SpriteRig;
export function sampleSpritePuppet(rig:SpriteRig,seconds:number):SpriteFrame[];
export function drawSpritePuppet(ctx:CanvasRenderingContext2D,atlas:CanvasImageSource,rig:SpriteRig,seconds:number):void;
