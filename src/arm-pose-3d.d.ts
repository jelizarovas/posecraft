import type {Vector3D} from './rig-3d.js';
/** Generic measured arm goals; heading is radians, swing is forward meters. */
export function relaxedArmGoal(options:{shoulder:Vector3D;sign:1|-1;length:number;heading?:number;swing?:number}):{hand:Vector3D;pole:Vector3D};
