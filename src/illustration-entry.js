import {mountIllustration} from './illustration.js';

/** Load only the optional feature modules used by this scene. */
export async function illustrationProviders(document){
  const providers={};
  if(document.actorBehaviors?.length)providers.actorBehaviorFactory=(await import('./actor-behaviors.js')).ActorBehaviorRuntime;
  if(document.motionLayers?.length)providers.motionLayerSolver=(await import('./motion-layers.js')).applyMotionLayers;
  if(document.objects?.length)providers.objectFactory=(await import('./scene-objects.js')).SceneObjects;
  if(document.objectGames?.length)providers.gameFactory=(await import('./prop-games.js')).PropGameRuntime;
  if(document.fluid){providers.fluidFactory=(await import('./bottle-fluid.js')).BottleFluid;providers.mountBottleControls=(await import('./bottle-browser.js')).mountBottleControls;}
  if(document.ensemble)providers.ensembleFactory=(await import('./ensemble.js')).CampfireEnsemble;
  if(document.contacts?.length)providers.contactSolver=(await import('./contacts.js')).applyContacts;
  if(document.behaviorGraph&&document.presentation!=='sequence')providers.behaviorFactory=(await import('./behaviors.js')).BehaviorRuntime;
  if(document.interactions?.length){const pointer=await import('./pointer-interactions.js');providers.pointerFactory=pointer.ScenePointerInteraction;providers.mountPointers=(await import('./pointer-browser.js')).mountScenePointers;}
  return providers;
}
export async function mountExport(element,document,options={}){return mountIllustration(element,document,{...await illustrationProviders(document),...options});}
