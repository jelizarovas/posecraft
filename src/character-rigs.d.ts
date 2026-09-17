import type {CharacterPack} from './schema.js';
/** Apply the built-in Ona or Dummy depth artwork to a fresh pack. Existing depth rigs are preserved. */
export function addSpatialRig(pack:CharacterPack,id:'ona'|'dummy',options?:{studies?:boolean}):CharacterPack;
export {addOnaArmJoints} from './ona-arms.js';
