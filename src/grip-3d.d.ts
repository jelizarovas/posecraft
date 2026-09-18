import type {Rig3D,Pose3D,Vector3D,Quaternion3D} from './rig-3d.js';
export interface GripFrame3D {joint:string;position:Vector3D;rotation:Quaternion3D;/** Supported hand clearance in normalized character meters, excluding any desired surface margin. */supportHeight?:number;supportFingers?:Array<{joint:string;rotation:Quaternion3D}>;fingers:Array<{joint:string;axis:Vector3D;angle:number}>}
export function wristTargetForGrip3D(grip:GripFrame3D,target:{position:Vector3D;rotation?:Quaternion3D},scale?:number):{position:Vector3D;rotation:Quaternion3D};
export function applyGripPose3D(rig:Rig3D,pose:Pose3D,grip:GripFrame3D,amount:number):Pose3D;
export function applySupportPose3D(rig:Rig3D,pose:Pose3D,grip:GripFrame3D,amount:number):Pose3D;
