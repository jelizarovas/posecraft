export type {MaterialLighting,MaterialLight,MaterialSignal} from './types/material-lighting.js';
export {ActorBehaviorRuntime} from './types/actor-behaviors.js';
export type {HostTransitionConfig,HostTransitionSample} from './types/host-transition.js';
import type {SceneDocument} from './types/schema.js';
import type {IllustrationProviders,IllustrationPlayer,IllustrationController as CoreController} from './types/illustration.js';
import type {SceneEvent} from './types/scene.js';
import type {CheckpointOptions} from './types/replay-checkpoints.js';
import type {ScrollOptions} from './types/scroll-bindings.js';

export type {SceneDocument,CharacterPack,Actor,Part,Joint,Clip,Keyframe,SceneContact,SpatialPart,MorphShape,SceneDepth,SceneLighting,PointerBinding,PointerCommand} from './types/schema.js';
export type {BehaviorGraph,BehaviorPayload,BehaviorSnapshot,BehaviorAction,BehaviorEdge,BehaviorCondition} from './types/behaviors.js';
export type {ActivityRecipe,ActionVariant,ActionPose,ActionSummary} from './types/action-variations.js';
export type {IllustrationPlayer,IllustrationProviders} from './types/illustration.js';
export type {Frame,SceneEvent} from './types/scene.js';
export type {ScrollOptions,ScrollConfig} from './types/scroll-bindings.js';
export type {MotionLayer} from './types/motion-layers.js';
export type {CheckpointOptions,CheckpointStats} from './types/replay-checkpoints.js';
export {assertDocument,validateDocument} from './types/schema.js';
export {renderSVG} from './types/svg.js';
export {mountRenderer} from './types/render-mount.js';

export interface MountIllustrationOptions extends IllustrationProviders {
  host?:HTMLElement;
  /** Disable automatic host-position sampling when supplying explicit page transitions. Defaults to true. */
  hostMotion?:boolean;
  scroll?:ScrollOptions|false;
  checkpoints?:CheckpointOptions|false;
  reducedMotion?:boolean|'system';
  onEvent?:(event:SceneEvent)=>void;
  onError?:(error:Error)=>void;
  label?:string;
  autoplay?:boolean;
}
export const runtimeCapabilities:Readonly<{
  packageVersion:'0.1.0-alpha.2';schemaVersion:1;
  renderers:readonly ('svg'|'canvas')[];features:readonly string[];
}>;
export class IllustrationController extends CoreController {
  constructor(scene:SceneDocument,options?:IllustrationProviders&{reducedMotion?:boolean;checkpoints?:CheckpointOptions|false});
}
export function supportsIllustration(scene:SceneDocument,features?:IllustrationProviders):boolean;
export function createIllustrationController(scene:SceneDocument,options?:IllustrationProviders&{reducedMotion?:boolean;checkpoints?:CheckpointOptions|false}):IllustrationController;
export function mountIllustration(element:HTMLElement,scene:SceneDocument,options?:MountIllustrationOptions):IllustrationPlayer;
