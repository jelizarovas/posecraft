import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
export interface FluidPoint {x:number;y:number}
export interface BottleFluidConfig {type:'bottle';vessel:string;contents:string;pivot:FluidPoint;boundary:FluidPoint[];fill:number;damping:number;wind:number;ship:{joint:string;scale:number;mass:number}}
export type FluidCommand={type:'grab'|'move'|'release'|'cancel';points:{id:number;x:number;y:number}[]}|{type:'motion';ax:number;ay:number;turn:number;gravityX?:number;gravityY?:number}|{type:'wind';value:number}|{type:'nudge';ax:number;ay:number};
export interface BottleFluidFrame {actor:string;vessel:string;contents:string;waterPath:string;surfacePath:string;waterPolygon:FluidPoint[];area:number;targetArea:number;normal:FluidPoint;level:number;paths:Record<string,string>;hidden:string[];bottle:{x:number;y:number;rotation:number;vx:number;vy:number;angularVelocity:number};ship:{joint:string;x:number;y:number;rotation:number;scale:number};slosh:number;wind:number;contacts:number;grabbed:number}
export function polygonArea(points:FluidPoint[]):number;
export function clipWaterPolygon(boundary:FluidPoint[],normal:FluidPoint,level:number):FluidPoint[];
export function waterSurface(boundary:FluidPoint[],normal:FluidPoint,fill:number):{normal:FluidPoint;level:number;polygon:FluidPoint[];area:number;targetArea:number;waterPath:string;surfacePath:string};
export class BottleFluid {constructor(document:SceneDocument);reset():this;command(command:FluidCommand):void;tick(dt:number):void;apply(frame:Frame,options?:{disabledActors?:Set<string>}):Frame;time:number;wind:number}
