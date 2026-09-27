import {applyContacts} from '../../../src/contacts.js';
import {applyMotionLayers} from '../../../src/motion-layers.js';
import {ActorBehaviorRuntime} from '../../../src/actor-behaviors.js';

/** Opt-in providers for authored contacts, procedural motion and actor-local behaviors. */
export const illustrationFeatures=/* @__PURE__ */ Object.freeze({
  contactSolver:applyContacts,motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime,
});
export {applyMotionLayers,ActorBehaviorRuntime};
