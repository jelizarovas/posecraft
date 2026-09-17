import {mountIllustration} from './illustration.js';

/** Load only the optional feature modules used by this scene. */
export async function illustrationProviders(document){
  const providers={};
  if(document.ensemble)providers.ensembleFactory=(await import('./ensemble.js')).CampfireEnsemble;
  if(document.contacts?.length)providers.contactSolver=(await import('./contacts.js')).applyContacts;
  if(document.behaviorGraph&&document.presentation!=='sequence')providers.behaviorFactory=(await import('./behaviors.js')).BehaviorRuntime;
  if(document.interactions?.length){const pointer=await import('./pointer-interactions.js');providers.pointerFactory=pointer.ScenePointerInteraction;providers.mountPointers=(await import('./pointer-browser.js')).mountScenePointers;}
  return providers;
}
export async function mountExport(element,document,options={}){return mountIllustration(element,document,{...await illustrationProviders(document),...options});}
