import type {createBenchAction3D,BenchActionFrame} from './bench-action-3d.js';
export type NativeActionConfiguration=Parameters<typeof createBenchAction3D>[0];
export interface NativeActionClient {
 configure(config:NativeActionConfiguration):Promise<void>;
 /** After finishSafely succeeds, time is elapsed recovery time until reset. */
 sample(time:number):Promise<BenchActionFrame>;
 finishSafely(time:number):Promise<{supported:true;duration:number}|{supported:false;reason:string}>;
 reset():Promise<void>;
 /** Rejects pending requests and terminates the dedicated worker. */
 dispose():void;
}
/** Queued samples replaced by newer samples reject with AbortError. */
export function createNativeActionClient(worker:Worker):NativeActionClient;
