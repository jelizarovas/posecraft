import {createWwzardIllustration} from './wwzard-illustration.js';
import {addWwwzardLiving} from './wwwzard-living.js';
import {addWwwzardHostTransition} from './wwwzard-host-transition.js';
import {addWwwzardWindowTheme} from './wwwzard-window.js';
import {addWwwzardNightLighting} from './wwwzard-night.js';

// Keep the reusable desk rig separate from this website's authored behavior.
export function createWwwzardHomeScene(){
  return addWwwzardNightLighting(addWwwzardWindowTheme(addWwwzardHostTransition(addWwwzardLiving(createWwzardIllustration()))));
}
