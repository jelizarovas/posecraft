import type {PickResult} from './render-evaluation.js';
export function registerRenderInput(surface:Element,adapter:{point(x:number,y:number):{x:number;y:number}|null;hit(x:number,y:number):PickResult|null}):()=>void;
export function rendererPoint(element:Element,event:PointerEvent|MouseEvent):{x:number;y:number}|null;
export function rendererHit(element:Element,event:PointerEvent|MouseEvent):PickResult|null;
