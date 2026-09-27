export {ActorBehaviorRuntime} from '../../../src/actor-behaviors.js';
import {IllustrationController as CoreController, mountIllustration as mountCore} from '../../../src/illustration.js';
import {BehaviorRuntime} from '../../../src/behaviors.js';
import {ScenePointerInteraction} from '../../../src/pointer-interactions.js';
import {mountScenePointers} from '../../../src/pointer-browser.js';

export {assertDocument,validateDocument} from '../../../src/schema.js';
export {renderSVG} from '../../../src/svg.js';
export {mountRenderer} from '../../../src/render-mount.js';

export const runtimeCapabilities=Object.freeze({
  packageVersion:'0.1.0-alpha.2',schemaVersion:1,
  renderers:Object.freeze(['svg','canvas']),
  features:Object.freeze(['clips','behaviors','action-interruption','path-deformation','animated-depth','pointer-interactions','scroll-bindings','host-transition','material-lighting']),
});

const providers={behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction,mountPointers:mountScenePointers};

/** Whether a valid scene uses only this package's built-in providers. */
export function supportsIllustration(scene,features={}){
  return !!scene&&scene.kind==='scene'&&scene.schemaVersion===1&&Array.isArray(scene.actors)
    &&scene.actors.every(actor=>(actor.behavior?.mode||'animated')==='animated')
    &&!scene.game&&(!scene.ensemble||!!features.ensembleFactory)&&(!scene.fluid||!!features.fluidFactory)
    &&(!scene.objects?.length||!!features.objectFactory)&&(!scene.objectGames?.length||!!features.gameFactory)
    &&(!scene.contacts?.length||!!features.contactSolver)&&(!scene.motionLayers?.length||!!features.motionLayerSolver)
    &&(!scene.actorBehaviors?.length||scene.presentation==='sequence'||!!features.actorBehaviorFactory);
}

function illustrationDocument(scene){
  if(scene?.game)throw new Error('@posecraft/runtime does not support game bindings. Export an illustration scene.');
  return scene;
}

/** The shared illustration controller with the standard 2D providers installed. */
export class IllustrationController extends CoreController {
  constructor(scene,options={}){super(illustrationDocument(scene),{...providers,...options});}
}

export function createIllustrationController(scene,options={}){
  return new IllustrationController(scene,options);
}

/** Mount an exported scene. Dispose the returned player when its host is removed. */
export function mountIllustration(element,scene,options={}){
  return mountCore(element,illustrationDocument(scene),{...providers,...options});
}
