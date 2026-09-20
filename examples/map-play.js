import {upgradeWoodlandArt} from './woodland-map.js';
import {createTownMap,townNpcRoutes} from './town-map.js';
import {startTownLife} from './map-town-life.js';
import {startVillageLife} from './map-village-life.js';
import {mountMap} from '../src/map-browser.js';
import {assertMap} from '../src/map.js';
import {upgradeStockBranches} from './map-editor-catalog.js';
import {readPlaySettings,mountPlaySettings} from './map-play-settings.js';

const draftKey='posecraft-map-editor-draft-v1';
/** Add new visual-only wheat behavior to the bundled town artwork in old drafts. */
function upgradeStockWheatOcclusion(map){
 if(map?.art?.images?.wheat?.src!=='./assets/map/town/wheat.webp')return map;
 let changed=false;
 const props=map.props.map(prop=>{
  if(prop.art!=='wheat'||prop.occlusion!==undefined)return prop;
  changed=true;return {...prop,occlusion:{mode:'low-foliage',lowerBodyFraction:.5}};
 });
 return changed?{...map,props}:map;
}
function editorDraft(){
  if(!new URLSearchParams(location.search).has('draft'))return null;
  try{const value=upgradeStockWheatOcclusion(upgradeStockBranches(upgradeWoodlandArt(JSON.parse(localStorage.getItem(draftKey)||''))));assertMap(value);if(!value.actors.length)throw Error('The draft has no player actor.');return value;}
  catch(error){console.warn('Map editor draft is unavailable. Opening the generated map instead.',error);return null;}
}
const map = editorDraft() || createTownMap();
const settings=readPlaySettings();
const view = mountMap(document.querySelector('#game'), map, {
  ...settings,
  renderer: new URLSearchParams(location.search).get('renderer')==='webgl2'?'webgl2':'canvas2d',
  onError(error) { if (error.name !== 'AbortError') console.error(error); },
});
const settingsMenu=mountPlaySettings(view,settings);
view.zoomTo(2.5);
view.focusActor(map.actors[0].id);
// A local review link opens directly at the waterfall valley, with no extra UI.
if(new URLSearchParams(location.search).get('view')==='cliffs'&&map.terraces?.length){
 const ledge=map.terraces.find(t=>t.id==='middle-falls')??map.terraces[0];
 view.zoomTo(window.innerWidth<600?.85:1.5);view.panTo(ledge.x+ledge.width/2,ledge.y+ledge.height*.6);
}
const routes=townNpcRoutes(map);
const townLife=map.actors.some(actor=>actor.npc)?startVillageLife(view,{seed:map.seed,onError:error=>console.warn('Village routine:',error.message)}):map.id.startsWith('town-')&&Object.keys(routes).every(id=>map.actors.some(a=>a.id===id))
  ?startTownLife(view,{routes,onError:error=>console.warn('Town resident:',error.message)}):null;

// Count real map draws, without keeping an otherwise idle render loop awake.
const fps=document.querySelector('#fps');
let fpsTime=performance.now(),fpsFrames=view.stats().drawnFrames||0;
function resetFPS(){fpsTime=performance.now();fpsFrames=view.stats().drawnFrames||0;}
const fpsTimer=setInterval(()=>{
  if(document.hidden)return;
  const now=performance.now(),frames=view.stats().drawnFrames||0,draws=frames-fpsFrames;
  fps.textContent=draws?`${Math.round(draws*1000/(now-fpsTime))} FPS`:'0 FPS · idle';
  fpsTime=now;fpsFrames=frames;
},500);
document.addEventListener('visibilitychange',resetFPS);

// Console access for local scene inspection without adding controls to the game.
window.mapPlay = {map, view,townLife};
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearInterval(fpsTimer);
  settingsMenu.dispose();
  document.removeEventListener('visibilitychange',resetFPS);
  townLife?.dispose();view.dispose();
  delete window.mapPlay;
});
