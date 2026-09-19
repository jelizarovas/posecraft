import {createWoodlandMap as generateMap,withWoodlandArt} from './woodland-map.js';
import {mountMap} from '../src/map-browser.js';

// Gallery artwork does not construct a map, controller or hidden renderer.
export const mapThumbnail = '<img src="./assets/map/thumbnail.webp" alt="Painted woodland map" width="120" height="76" loading="lazy" style="width:100%;height:100%;object-fit:cover">';

/** Gallery host policy: map data and semantic runtime state are saved together. */
export function mountMapDemo(documentData, {playing=true,onPlayingChange=()=>{},onError=()=>{}}={}) {
  const $=id=>document.getElementById(id),art=$('demo-art'),theater=art.closest('.demo-theater');
  const saveKey='posecraft.littlelands.map.v1';
  let map=documentData,view,recenter,disposed=false,refreshTimer;
  const events=[];
  art.classList.add('map-stage');theater.classList.add('map-theater');
  $('demo-controls').innerHTML='<div class="demo-actions map-actions"><button id="map-home"><span class="material-symbols-outlined" aria-hidden="true">restart_alt</span>Center hero</button><button id="map-chest">Find chest</button><button id="map-inn">Visit inn</button><button id="map-seed"><span class="material-symbols-outlined" aria-hidden="true">add</span>New map</button><button id="map-save">Save</button><button id="map-restore">Restore</button><label>Zoom <input id="map-zoom" type="range" min="0.45" max="2" step="0.05" value="1" aria-label="Map zoom"></label></div>';
  $('demo-sound').hidden=true;$('demo-scrub').hidden=true;
  function updateStats(){if(disposed||!view||document.hidden)return;const s=view.stats();if(!Number.isFinite(s.visibleTiles))return;const caption=`${map.width} by ${map.height} world - seed ${map.seed} - only the viewport is drawn`;if($('demo-caption').textContent!==caption)$('demo-caption').textContent=caption;$('map-zoom').value=s.camera.zoom;}
  function status(message){if(!disposed)$('demo-status').textContent=message;}
  function event(e){events.push(e);if(events.length>100)events.shift();if(e.type==='map.object.interacted')status(e.object==='village-chest'||e.prop==='village-chest'?'Chest opened.':e.object==='village-house'?'Arrived at the inn.':'Reached '+(e.kind||'object')+'.');else if(e.type==='map.actor.arrived')status(e.target==='village-chest'?'Chest opened.':e.target==='village-house'?'Arrived at the inn.':'Destination reached.');}
  function install(next){view?.dispose();art.replaceChildren();map=withWoodlandArt(next);view=mountMap(art,map,{autoplay:playing,followOnMove:true,onCameraChange:state=>{if(recenter)recenter.hidden=state.following;},onEvent:event,onError:error=>{status(error.message);onError(error);}});recenter=document.createElement('button');recenter.id='map-recenter';recenter.className='map-recenter';recenter.type='button';recenter.setAttribute('aria-label','Recenter and follow character');recenter.innerHTML='<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2" fill="currentColor"/><path d="M12 1v4m0 14v4M1 12h4m14 0h4"/></svg>Recenter';recenter.onclick=()=>{view.followActor('hero');status('Following hero. Drag to look around.');};art.append(recenter);view.followActor('hero');status('Tap to walk, double-tap to run. Drag to look around.');updateStats();}
  function run(target){playing=true;view.play();onPlayingChange(true);status('Finding a route...');Promise.resolve(view.moveTo('hero',target)).catch(error=>{if(error.name!=='AbortError')status(error.message);});}
  $('map-home').onclick=()=>{view.followActor('hero');status('Following hero. Drag to look around.');updateStats();};
  $('map-chest').onclick=()=>run('village-chest');$('map-inn').onclick=()=>run('village-house');
  $('map-zoom').oninput=e=>{view.zoomTo(Number(e.target.value));updateStats();};
  $('map-seed').onclick=()=>install(generateMap({width:128,height:128,seed:map.seed+1}));
  $('map-save').onclick=()=>{try{localStorage.setItem(saveKey,JSON.stringify({version:1,map,state:view.snapshot()}));status('Map saved on this device.');}catch(error){status('Could not save: '+error.message);}};
  $('map-restore').onclick=async()=>{try{const saved=JSON.parse(localStorage.getItem(saveKey));if(!saved||saved.version!==1)throw new Error('Save a map first.');install(saved.map);await view.restore(saved.state);status('Map restored.');updateStats();}catch(error){status('Could not restore: '+error.message);}};
  install(map);refreshTimer=setInterval(updateStats,250);
  const api={get view(){return view;},get map(){return map;},events,play(){playing=true;view.play();},pause(){playing=false;view.pause();},reset(){install(generateMap({width:map.width,height:map.height,seed:map.seed}));},download(){const url=URL.createObjectURL(new Blob([JSON.stringify(map,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='littlelands.posecraft-map.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);},dispose(){if(disposed)return;disposed=true;clearInterval(refreshTimer);view.dispose();art.classList.remove('map-stage');theater.classList.remove('map-theater');if(window.mapDemo===api)delete window.mapDemo;}};
  window.mapDemo=api;return api;
}
