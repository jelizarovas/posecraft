import {Joint,Clip,Input} from './schema.js';
export function clamp(value:number,min:number,max:number):number;
export function lerp(a:number,b:number,t:number):number;
export function wrapAngle(angle:number):number;
export function mixAngle(a:number,b:number,t:number):number;
export function interpolate(track:readonly (readonly [number,number,string?])[],time:number,interpolation?:string,angular?:boolean):number;
export function sampleClip(clip:Clip,elapsed:number,interpolation?:string):Record<string,number>;
export function constrainPose(joints:Joint[],pose:Record<string,number>):Record<string,number>;
export function forwardKinematics(joints:Joint[],pose:Record<string,number>):Record<string,{x:number;y:number;rotation:number;endX:number;endY:number}>;
export interface Chain {id:string;upper:string;lower:string;bend:1|-1;target?:(context:{pose:Record<string,number>;inputs:Record<string,string|number|boolean>;time:number})=>{x:number;y:number;weight?:number}}
export function solveTwoBoneIK(joints:Joint[],source:Record<string,number>,chain:Chain,target:{x:number;y:number},weight?:number):Record<string,number>;
export interface RuntimeFrame {pose:Record<string,number>;world:ReturnType<typeof forwardKinematics>;targets:Record<string,{x:number;y:number;weight:number;error:number}>;time:number;layers:{name:string;state:string;time:number;weight:number;mixing:boolean}[]}
export interface Take {version:1;duration:number;tracks:Record<string,[number,number][]>}
export interface RuntimeDefinition {joints:Joint[];defaults?:Record<string,number>;inputs?:Record<string,Input>;clips?:Record<string,Clip>;chains?:Chain[];layers?:any[];events?:string[];eventInputs?:Record<string,Record<string,string|number|boolean>>}
export class AnimationController {
 constructor(definition:RuntimeDefinition);definition:RuntimeDefinition;joints:Joint[];inputs:Record<string,string|number|boolean>;layers:any[];frame:RuntimeFrame;time:number;take:Take & {time:number;playing:boolean;enabled:boolean;weight:number};
 step(dt:number):RuntimeFrame;evaluate():RuntimeFrame;setInput(name:string,value:string|number|boolean):void;send(event:string):void;
 subscribe(listener:(event:{type:string;time:number;[key:string]:unknown})=>void):()=>void;
 setInterpolation(mode:'linear'|'smooth'|'step'):void;setLayerWeight(name:string,weight:number):void;setJointLimit(id:string,min:number,max:number):void;setTransitionDuration(value:number):void;
 setKeyframe(id:string,time:number,rotation:number):void;removeKeyframe(id:string,time:number):void;seek(time:number):RuntimeFrame;previewJoint(id:string,rotation:number):RuntimeFrame;exportTake():Take;importTake(data:Take):RuntimeFrame;
}
