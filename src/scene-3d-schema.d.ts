/** Native world units are meters, rotations are xyzw unit quaternions, Y is up. */
export type Vector3D=[number,number,number];
export type Quaternion3D=[number,number,number,number];
export interface Transform3D {position:Vector3D;rotation:Quaternion3D;scale:number}
export interface Joint3D {id:string;parent:string|null;position:Vector3D;rotation:Quaternion3D}
export interface Chain3D {root:string;middle:string;tip:string;/** Point in rig/model space. */pole:Vector3D;bend:{min:number;max:number}}
export interface Rig3D {joints:Joint3D[];chains:Record<string,Chain3D>}
export interface Actor3D {id:string;rig:string;transform:Transform3D;/** Absolute local overrides, not additive offsets. */pose:Record<string,{position?:Vector3D;rotation?:Quaternion3D}>}
export interface Object3D {id:string;transform:Transform3D;geometry:{type:'box';size:Vector3D};anchors:Record<string,{position:Vector3D;rotation:Quaternion3D}>}
export interface Contact3D {id:string;actor:string;chain:string;target:{object:string;anchor:string};enabled:boolean}
export interface Camera3D {position:Vector3D;target:Vector3D;projection:'orthographic';height:number}
export interface Scene3D {kind:'scene3d';schemaVersion:1;units:'meters';up:'Y';id:string;name:string;revision:number;rigs:Record<string,Rig3D>;actors:Actor3D[];objects:Object3D[];contacts:Contact3D[];camera:Camera3D}
export interface Scene3DError {path:string;message:string}
export const SCENE_3D_LIMITS:Readonly<{rigs:32;joints:128;chains:32;actors:64;objects:128;anchors:32;contacts:256;nodes:100000;depth:24;errors:100}>;
export function validateScene3D(document:unknown):{valid:boolean;errors:Scene3DError[]};
export function assertScene3D<T extends Scene3D>(document:T):T;
export function assertScene3D(document:unknown):Scene3D;
