import type {AnimationClip,Group,Object3D} from 'three';
import type {Rig3D,CompiledRig3D,Pose3D,Placement3D,World3D} from './rig-3d.js';
import type {GripFrame3D} from './grip-3d.js';
export type CharacterRole3D = 'pelvis'|'torso'|'chest'|'neck'|'head'|'leftClavicle'|'rightClavicle'|'leftShoulder'|'leftElbow'|'leftWrist'|'rightShoulder'|'rightElbow'|'rightWrist'|'leftHip'|'leftKnee'|'leftAnkle'|'leftToe'|'rightHip'|'rightKnee'|'rightAnkle'|'rightToe';
export interface CharacterOptions3D {height?:number;roles?:Partial<Record<CharacterRole3D,string>>}
export interface ImportedCharacter3D {
  root:Group;rig:Rig3D;compiledRig:CompiledRig3D;roles:Partial<Record<CharacterRole3D,string>>&{root:string;pelvis:string};grips:Partial<Record<'left'|'right',GripFrame3D>>;rest:World3D;animations:AnimationClip[];
  metadata:{height:number;sourceHeight:number;normalizationScale:number;facingYaw:number;bones:number;skinnedMeshes:number;triangles:number;morphTargets:number;animations:number};
  apply(pose?:Pose3D,placement?:Placement3D):World3D;
  dispose():void;
}
export function createCharacter3D(gltf:{scene:Object3D;animations?:AnimationClip[]},options?:CharacterOptions3D):ImportedCharacter3D;
export function loadCharacter3D(url:string,options?:CharacterOptions3D):Promise<ImportedCharacter3D>;
