export type Vector3D = [number, number, number];
/** Quaternion components are x, y, z, w. */
export type Quaternion3D = [number, number, number, number];
export interface Joint3D {id: string; parent: string | null; position: Vector3D; rotation: Quaternion3D}
export interface Chain3D {
  root: string; middle: string; tip: string;
  /** Pole point in model space, transformed by actor placement. */
  pole: Vector3D;
  /** Middle bend in radians; zero is straight. */
  bend: {min: number; max: number};
}
export interface Rig3D {joints: Joint3D[]; chains: Record<string, Chain3D>}
export type Pose3D = Record<string, {position?: Vector3D; rotation?: Quaternion3D}>;
export interface Placement3D {position?: Vector3D; rotation?: Quaternion3D; scale?: number}
export interface JointWorld3D {position: Vector3D; rotation: Quaternion3D; matrix: number[]}
export type World3D = Record<string, JointWorld3D>;
export interface CompiledRig3D {
  readonly joints: ReadonlyArray<{readonly id: string; readonly parent: string | null; readonly position: readonly number[]; readonly rotation: readonly number[]}>;
  readonly chains: Readonly<Record<string, {readonly root: string; readonly middle: string; readonly tip: string; readonly pole: readonly number[]; readonly bend: Readonly<{min: number; max: number}>}>>;
}
export function compileRig3D(rig: Rig3D): CompiledRig3D;
export function evaluateRig3D(compiled: CompiledRig3D, pose?: Pose3D, placement?: Placement3D): World3D;
export function solveTwoBone3D(compiled: CompiledRig3D, pose: Pose3D | undefined, chainRole: string, targetWorld: {position: Vector3D; rotation?: Quaternion3D}, options?: {placement?: Placement3D; poleWorld?: Vector3D; /** Chain mode omits unrelated joints and descendants from world, retaining all ancestors. */ world?:'full'|'chain'}): {
  pose: Pose3D; world: World3D;
  diagnostics: {status: 'solved' | 'unreachable' | 'limited'; error: number; /** World-space lengths, including placement scale. */ boneLengths: [number, number]; maxStretch: 1};
};
