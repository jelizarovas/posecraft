import {generateMap} from '../src/map.js';
import {mountMap} from '../src/map-browser.js';

// Gallery artwork does not construct a map, controller or hidden renderer.
export const mapThumbnail = '<svg viewBox="0 0 120 76" width="100%" height="100%" aria-hidden="true"><rect width="120" height="76" fill="#adbc8a"/><path d="M0 32 60 4 120 32 60 62Z" fill="#83a56b"/><path d="m0 57 75-37 15 7-75 37Z" fill="#d5c69a"/><path d="m69 16 16-8 18 9v24l-18 9-16-9Z" fill="#cba576"/><path d="m63 19 20-18 27 19-24 12Z" fill="#744e4d"/><path d="m20 39 11-28 12 28-12 7Z" fill="#3f7354"/><circle cx="53" cy="44" r="5" fill="#eed2a6"/><path d="m47 49 12 0 2 12-16 0Z" fill="#7655a5"/></svg>';

/** Gallery host policy: map data and semantic runtime state are saved together. */
export function mountMapDemo(documentData, {playing=true,onPlayingChange=()=>{},onError=()=>{}}={}) {
  const $=id=>document.getElementById(id),art=$('demo-art'),theater=art.closest('.demo-theater');
  const saveKey='posecraft.littlelands.map.v1';
  let map=documentData,view,disposed=false,refreshTimer;
  const events=[];
  art.classList.add('map-stage');theater.classList.add('map-theater');
  $('demo-controls').innerHTML='<div class="demo-actions map-actions"><button id="map-home"><span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>Center hero</button><button id="map-chest">Find chest</button><button id="map-inn">Visit inn</button><button id="map-seed"><span class="material-symbols-outlined" aria-hidden="true">add</span>New map</button><button id="map-save">Save</button><button id="map-restore">Restore</button><label>Zoom <input id="map-zoom" type="range" min="0.45" max="2" step="0.05" value="1" aria-label="Map zoom"></label></div>';
  $('demo-sound').hidden=true;$('demo-scrub').hidden=true;
  function updateStats(){if(disposed||!view||document.hidden)return;const s=view.stats();if(!Number.isFinite(s.visibleTiles))return;const caption=`${map.width} by ${map.height} world - seed ${map.seed} - only the viewport is drawn`;if($('demo-caption').textContent!==caption)$('demo-caption').textContent=caption;$('map-zoom').value=s.camera.zoom;}
  function status(message){if(!disposed)$('demo-status').textContent=message;}
  function event(e){events.push(e);if(events.length>100)events.shift();if(e.type==='map.object.interacted')status(e.object==='village-chest'||e.prop==='village-chest'?'Chest opened.':e.object==='village-house'?'Arrived at the inn.':'Reached '+(e.kind||'object')+'.');else if(e.type==='map.actor.arrived')status(e.target==='village-chest'?'Chest opened.':e.target==='village-house'?'Arrived at the inn.':'Destination reached.');}
  function install(next){view?.dispose();art.replaceChildren();map=next;view=mountMap(art,map,{autoplay:playing,onEvent:event,onError:error=>{status(error.message);onError(error);}});status('Click the map to explore. Drag to pan.');updateStats();}
  function run(target){playing=true;view.play();onPlayingChange(true);status('Finding a routeâ€¦');Promise.resolve(view.moveTo('hero',target)).catch(error=>{if(error.name!=='AbortError')status(error.message);});}
  $('map-home').onclick=()=>{view.focusActor('hero');status('Camera centered on hero.');updateStats();};
  $('map-chest').onclick=()=>run('village-chest');$('map-inn').onclick=()=>run('village-house');
  $('map-zoom').oninput=e=>{view.zoomTo(Number(e.target.value));updateStats();};
  $('map-seed').onclick=()=>install(generateMap({width:128,height:128,seed:map.seed+1}));
  $('map-save').onclick=()=>{try{localStorage.setItem(saveKey,JSON.stringify({version:1,map,state:view.snapshot()}));status('Map saved on this device.');}catch(error){status('Could not save: '+error.message);}};
  $('map-restore').onclick=async()=>{try{const saved=JSON.parse(localStorage.getItem(saveKey));if(!saved||saved.version!==1)throw new Error('Save a map first.');install(saved.map);await view.restore(saved.state);status('Map restored.');updateStats();}catch(error){status('Could not restore: '+error.message);}};
  install(map);refreshTimer=setInterval(updateStats,250);
  const api={get view(){return view;},get map(){return map;},events,play(){playing=true;view.play();},pause(){playing=false;view.pause();},reset(){install(generateMap({width:map.width,height:map.height,seed:map.seed}));},download(){const url=URL.createObjectURL(new Blob([JSON.stringify(map,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='littlelands.posecraft-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},dispose(){if(disposed)return;disposed=true;clearInterval(refreshTimer);view.dispose();art.classList.remove('map-stage');theater.classList.remove('map-theater');if(window.mapDemo===api)delete window.mapDemo;}};
  window.mapDemo=api;return api;
}
