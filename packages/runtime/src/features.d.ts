import type {IllustrationProviders} from './index.js';
export const illustrationFeatures:Readonly<Required<Pick<IllustrationProviders,'contactSolver'|'motionLayerSolver'|'actorBehaviorFactory'>>>;
export {applyMotionLayers} from './types/motion-layers.js';
export {ActorBehaviorRuntime} from './types/actor-behaviors.js';
