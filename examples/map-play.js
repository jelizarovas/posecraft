import {upgradeWoodlandArt} from './woodland-map.js';
import {createTownMap,townNpcRoutes} from './town-map.js';
import {startTownLife} from './map-town-life.js';
import {startVillageLife} from './map-village-life.js';
import {mountMap} from '../src/map-browser.js';
import {assertMap} from '../src/map.js';
import {upgradeStockBranches} from './map-editor-catalog.js';
import {readPlaySettings,mountPlaySettings,rendererResumeKey} from './map-play-settings.js';
import {mountMapAudio} from '../src/map-audio.js';

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
const requestedRenderer=new URLSearchParams(location.search).get('renderer');
if(['canvas2d','webgl2'].includes(requestedRenderer))settings.renderer=requestedRenderer;
const view = mountMap(document.querySelector('#game'), map, {
  ...settings,
  // The full-window game takes W A S D, Space and E wherever focus is.
  keyboard:'document',
  onError(error) { if (error.name !== 'AbortError') console.error(error); },
});
const audio=mountMapAudio(view,map,{volume:settings.volume,muted:!settings.sound});
const settingsMenu=mountPlaySettings(view,settings,{onAudio(next){audio.setVolume(next.volume);audio.setMuted(!next.sound);}});
const loading=showLoading(view);
view.zoomTo(2.5);
view.focusActor(map.actors[0].id);
// A local review link opens directly at the waterfall valley, with no extra UI.
if(new URLSearchParams(location.search).get('view')==='cliffs'&&map.terraces?.length){
 const ledge=map.terraces.find(t=>t.id==='middle-falls')??map.terraces[0];
 view.zoomTo(window.innerWidth<600?.85:1.5);view.panTo(ledge.x+ledge.width/2,ledge.y+ledge.height*.6);
}
try{
 const resume=JSON.parse(sessionStorage.getItem(rendererResumeKey)||'null');sessionStorage.removeItem(rendererResumeKey);
 if(resume?.renderer===settings.renderer&&resume.path===location.pathname&&resume.draft===new URLSearchParams(location.search).has('draft'))await view.restore(resume.snapshot);
}catch(error){console.warn('Could not restore the renderer-switch position.',error);}
const routes=townNpcRoutes(map);
const townLife=map.actors.some(actor=>actor.npc)?startVillageLife(view,{seed:map.seed,onError:error=>console.warn('Village routine:',error.message)}):map.id.startsWith('town-')&&Object.keys(routes).every(id=>map.actors.some(a=>a.id===id))
  ?startTownLife(view,{routes,onError:error=>console.warn('Town resident:',error.message)}):null;

/**
 * Cover the map until its artwork has decoded and the first view is drawn
 * complete, so the village never assembles itself piece by piece on screen.
 */
function showLoading(view,{timeoutMs=20000}={}){
  const screen=document.querySelector('#loading');if(!screen)return{dispose(){}};
  const bar=screen.querySelector('.bar'),status=screen.querySelector('.status'),started=performance.now();let shown=0,finished=false;
  const finish=()=>{if(finished)return;finished=true;clearInterval(timer);bar.style.transform='scaleX(1)';screen.setAttribute('aria-valuenow','100');screen.classList.add('done');screen.setAttribute('aria-hidden','true');};
  const timer=setInterval(()=>{
    // A replaced or disposed view has nothing left to wait for.
    let stats;try{stats=view.stats();}catch{finish();return;}
    const art=stats.art||{requested:0,loaded:0,failed:0},settled=art.loaded+art.failed;
    // Maps without artwork (or a disposed view) only wait for a drawn frame.
    const artDone=settled===art.requested,drawn=(stats.drawnFrames||0)>0&&!stats.terrainCache?.pending&&!stats.sceneryCache?.pending;
    // Artwork is most of the wait; the last part is the first complete frame.
    const target=art.requested?.85*settled/art.requested+(artDone&&drawn?.15:0):0;
    shown=Math.max(shown,Math.min(1,target));bar.style.transform=`scaleX(${Math.max(.04,shown)})`;screen.setAttribute('aria-valuenow',String(Math.round(shown*100)));
    status.textContent=artDone?'Drawing the map':`Loading artwork ${settled} of ${art.requested||'…'}`;
    if(artDone&&drawn||performance.now()-started>timeoutMs)finish();
  },100);
  return{dispose(){clearInterval(timer);finish();}};
}

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
window.mapPlay = {map, view,townLife,audio};
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearInterval(fpsTimer);loading.dispose();
  settingsMenu.dispose();
  audio.dispose();
  document.removeEventListener('visibilitychange',resetFPS);
  townLife?.dispose();view.dispose();
  delete window.mapPlay;
});
