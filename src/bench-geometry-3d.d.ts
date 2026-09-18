export const DEFAULT_BENCH_SIZE_3D:readonly [number,number,number];
export interface BenchBodyBox3D {id:string;material:'pad'|'steel';size:[number,number,number];position:[number,number,number]}
export function benchBodyGeometry3D(size?:readonly [number,number,number]):BenchBodyBox3D[];
