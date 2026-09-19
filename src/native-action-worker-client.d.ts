import type {createBenchAction3D,BenchActionFrame} from './bench-action-3d.js';
import type {createWorkout3D,WorkoutFrame3D,WorkoutAction3D} from './workout-3d.js';
export type NativeActionConfiguration=Parameters<typeof createBenchAction3D>[0]|Parameters<typeof createWorkout3D>[0];
export interface NativeActionClient {
 configure(config:NativeActionConfiguration):Promise<void>;
 /** Bench recovery samples use elapsed recovery time. Workouts keep global time. */
 sample(time:number):Promise<BenchActionFrame|WorkoutFrame3D>;
 finishSafely(time:number):Promise<{supported:true;duration?:number}|{supported:false;reason:string}>;
 reset():Promise<void>;
 setVariable(name:'fatigue'|'dehydration',value:number,time:number):Promise<void>;
 request(action:WorkoutAction3D,options:{request?:string;target?:'bench'|'pullup'|'bottle'},time:number):Promise<string>;
 cancel(request:string,time:number):Promise<void>;
 /** Rejects pending requests and terminates the dedicated worker. */
 dispose():void;
}
/** Queued samples replaced by newer samples reject with AbortError. */
export function createNativeActionClient(worker:Worker):NativeActionClient;
