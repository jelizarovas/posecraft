import type {SceneDocument} from './schema.js';
import type {Frame} from './scene.js';
export const ANIMATION_PREVIEW_LIMITS:Readonly<{ghostsPerSide:3;pathPoints:61}>;
export type PreviewBoundary='clamp'|'wrap';
export interface AnimationPreviewOptions {actor:string;clip:string;overrides?:Record<string,number>;boundary?:PreviewBoundary}
export interface OnionFrame {time:number;side:'before'|'after';frame:Frame}
export interface MotionPathPoint {time:number;x:number;y:number}
export interface AnimationPreview {actor:string;clip:string;duration:number;boundary:PreviewBoundary;sample(time:number):Frame;onion(time:number,options?:{step?:number;count?:number}):OnionFrame[];path(joint:string,options?:{start?:number;end?:number;samples?:number}):MotionPathPoint[]}
/** Captures copied document/frame data. Samples only the selected authored clip
 * and its contacts, using current expression inputs and frozen target actors.
 * Owned objects and attached props follow sampled grips without ownership changes.
 * No graph/physics/ensemble/spring simulation or events. Path points are joint
 * origins in scene coordinates, before camera projection, not silhouette picks.
 * Hidden actors return no onion ghosts or path. Boundary defaults to clamp even
 * for looping clips; wrap is explicit and maps the final endpoint to time zero.
 */
export function createAnimationPreview(document:SceneDocument,baseFrame:Frame,options:AnimationPreviewOptions):AnimationPreview;
