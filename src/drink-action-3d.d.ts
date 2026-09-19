import type {Rig3D,Placement3D,Vector3D,Quaternion3D} from './rig-3d.js';
import type {GripFrame3D} from './grip-3d.js';
import type {BenchActionRoles,BenchActionFrame} from './bench-action-3d.js';
import type {WorkoutFrame3D} from './workout-3d.js';
export interface DrinkAction3D {duration:number;beats:Array<{id:string;label:string;start:number;end:number}>;standingPlacement:Placement3D;sample(time:number):Omit<WorkoutFrame3D,'workout'|'bar'|'activityTime'>}
export function createDrinkAction3D(options:{rig:Rig3D;roles:BenchActionRoles;grips?:Partial<Record<'left'|'right',GripFrame3D>>;bottle:{position:Vector3D;rotation:Quaternion3D};settings?:{duration?:number;soleHeight?:number}}):DrinkAction3D;
export function createRestAction3D(options:{rig:Rig3D;roles:BenchActionRoles;frame:BenchActionFrame|WorkoutFrame3D;duration?:number}):{duration:number;beats:Array<{id:string;label:string;start:number;end:number}>;sample(time:number):BenchActionFrame|WorkoutFrame3D};
