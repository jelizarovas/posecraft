import type {Rig3D,Pose3D,Placement3D} from './rig-3d.js';
import type {BenchActionFrame,BenchActionRoles} from './bench-action-3d.js';
import type {GripFrame3D} from './grip-3d.js';
export type LocomotionFrame3D=Omit<BenchActionFrame,'bar'|'scoot'|'clearance'|'transfer'>;
export function createLocomotionAction3D(options:{rig:Rig3D;roles:BenchActionRoles;grips?:Partial<Record<'left'|'right',GripFrame3D>>;from:Placement3D;to:Placement3D;settings?:{waypoints?:Array<{x:number;z:number}>;speed?:number;tempo?:number;fromPose?:Pose3D;toPose?:Pose3D}}):{duration:number;beats:Array<{id:string;label:string;start:number;end:number}>;sample(time:number):LocomotionFrame3D};
