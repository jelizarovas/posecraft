import type {Pose3D,World3D,Vector3D,Quaternion3D,JointWorld3D} from './rig-3d.js';
import type {Scene3D,Transform3D,Camera3D} from './scene-3d-schema.js';
export {assertScene3D,validateScene3D} from './scene-3d-schema.js';

export interface NativeContactDiagnostic {
 id:string;actor:string;status:'solved'|'unreachable'|'limited'|'conflict'|'disabled';
 error:number;orientationError:number;maxStretch:number;boneLengths:number[];
 target:{position:Vector3D;rotation:Quaternion3D};actual:JointWorld3D;
}
export interface NativeSceneFrame {
 actors:Array<{id:string;pose:Pose3D;world:World3D}>;
 objects:Array<{id:string;matrix:number[];geometry:{type:'box';size:Vector3D};anchors:Record<string,{position:Vector3D;rotation:Quaternion3D}>}>;
 contacts:NativeContactDiagnostic[];camera:Camera3D;
}
export interface NativeSceneOverrides {
 actorPoses?:Record<string,Pose3D>;
 objectTransforms?:Record<string,Transform3D>;
 camera?:Camera3D;
}
/** Experimental native 3D evaluator; separate from version-one 2D scene playback. */
export function compileScene3D(document:Scene3D):{
 serialize():Scene3D;
 evaluate(overrides?:NativeSceneOverrides):NativeSceneFrame;
};
export function evaluateScene3D(document:Scene3D):NativeSceneFrame;
