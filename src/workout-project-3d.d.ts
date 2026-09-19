import type {BenchProject3D} from './bench-project-3d.js';
import type {Vector3D,Quaternion3D} from './rig-3d.js';
export interface WorkoutProject3D extends Omit<BenchProject3D,'kind'> {kind:'workout3d';pullup:{position:Vector3D;rotation:Quaternion3D;width:number};bottle:{position:Vector3D;rotation:Quaternion3D};workout:{seed:number;reps:{min:number;max:number};sequence:Array<'pullup'|'bench'|'rest'|'drink'>;restThreshold:number;drinkThreshold:number;restDuration:number;drinkDuration:number;fatigue:number;dehydration:number;failureBase:number}}
export function createWorkoutProject3D():WorkoutProject3D;
export function validateWorkoutProject3D(value:unknown):{valid:boolean;errors:Array<{path:string;message:string}>};
export function assertWorkoutProject3D(value:unknown):WorkoutProject3D;
export class WorkoutProject3DStore {constructor(project?:WorkoutProject3D);readonly document:WorkoutProject3D;readonly revision:number;readonly canUndo:boolean;readonly canRedo:boolean;replace(project:WorkoutProject3D,expectedRevision?:number):WorkoutProject3D;undo():WorkoutProject3D;redo():WorkoutProject3D}
