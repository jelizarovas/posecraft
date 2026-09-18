import {createAnimationPreview} from '../src/animation-preview.js';
import {renderSVG} from '../src/svg.js';
import './animation-preview-tools.css';

/** Editor-only guides. Cached while paused; never inserted into the runtime renderer. */
export function createAnimationPreviewTools({stage,host,getContext,pause}) {
 const overlay=document.createElement('div');overlay.className='animation-preview-overlay';overlay.setAttribute('aria-hidden','true');stage.append(overlay);
 const panel=document.createElement('details');panel.className='animation-preview-controls';panel.id='animation-guides';
 panel.innerHTML='<summary><span class="material-symbols-outlined" aria-hidden="true">animation</span>Pose guides</summary><div><label><input id="guide-onion" type="checkbox">Nearby poses</label><label><input id="guide-path" type="checkbox">Selected joint path</label><label>Pose spacing, seconds<input id="guide-step" type="number" min="0.01" max="2" step="0.01" value="0.15"></label><small>Earlier: coral. Later: blue. Guides show saved clip poses with your current pose edits; other actors and live objects stay at this snapshot.</small><output id="guide-status" role="status"></output></div>';
 host.append(panel);
 let cachedDocument,lastKey='',onion=false,path=false,step=.15,generation=0;
 const status=panel.querySelector('output');
 const invalidate=()=>{lastKey='';generation++;};
 const yieldTurn=()=>new Promise(resolve=>setTimeout(resolve,0));
 for(const input of panel.querySelectorAll('input'))input.addEventListener('change',()=>{
  onion=panel.querySelector('#guide-onion').checked;path=panel.querySelector('#guide-path').checked;
  const value=Number(panel.querySelector('#guide-step').value);if(!Number.isFinite(value)||value<.01||value>2){status.textContent='Pose spacing must be 0.01–2 seconds.';return;}
  step=value;if(onion||path)pause();invalidate();update();
 });
 function ghost(doc,frame,actor,side,time){
  // The solver has already evaluated the full snapshot. Draw only this actor;
  // validating and drawing every camper/effect again would stall a paused scrub.
  const source=doc.actors.find(a=>a.id===actor),pack=doc.packs[source.pack],drawPack={...pack,clips:Object.fromEntries(Object.entries(pack.clips).map(([id,c])=>[id,{duration:c.duration,loop:c.loop,tracks:{}}]))},drawing={schemaVersion:1,kind:'scene',id:'pose-guide',name:'Pose guide',revision:0,bounds:doc.bounds,requiredFeatures:doc.requiredFeatures||[],packs:{[source.pack]:drawPack},actors:[{...source,unlit:true}],props:[],...(doc.groups?{groups:doc.groups}:{})};
  const parsed=new DOMParser().parseFromString(renderSVG(drawing,frame,{camera:null}),'image/svg+xml'),svg=parsed.documentElement;
  const pieces=[...svg.querySelectorAll('[data-actor],[data-scene-actor]')].filter(n=>(n.getAttribute('data-actor')||n.getAttribute('data-scene-actor'))===actor);
  svg.replaceChildren(...pieces);svg.removeAttribute('role');svg.removeAttribute('aria-label');svg.setAttribute('data-guide-side',side);svg.setAttribute('data-guide-time',String(time));
  const color=side==='before'?'#db795e':'#448eb8';
  for(const p of svg.querySelectorAll('[data-fragment-path]')){if(p.getAttribute('fill')!=='none')p.setAttribute('fill',color);if(p.getAttribute('stroke')!=='none')p.setAttribute('stroke',color);}
  return document.importNode(svg,true);
 }
 function update(){
  const c=getContext();panel.hidden=!c?.available;
  if(!c?.available||c.playing||!onion&&!path){overlay.replaceChildren();invalidate();if(c?.playing)status.textContent='Pause to inspect pose guides.';return;}
  const key=JSON.stringify([c.actor,c.clip,c.joint,c.time,c.overrides,onion,path,step]);if(c.document===cachedDocument&&key===lastKey)return;
  cachedDocument=c.document;lastKey=key;overlay.replaceChildren();status.textContent='Updating pose guides…';
  void build(c,++generation);
 }
 async function build(c,token){
  try{
   await yieldTurn();if(token!==generation)return;
   const preview=createAnimationPreview(c.document,c.frame(),{actor:c.actor,clip:c.clip,overrides:c.overrides,boundary:'clamp'});
   if(onion)for(const item of preview.onion(c.time,{step,count:1})){await yieldTurn();if(token!==generation)return;overlay.append(ghost(c.document,item.frame,c.actor,item.side,item.time));}
   if(path){const points=[];for(let first=0;first<30;first+=5){await yieldTurn();if(token!==generation)return;const segment=preview.path(c.joint,{start:first/30*preview.duration,end:(first+5)/30*preview.duration,samples:6});points.push(...(first?segment.slice(1):segment));}
    const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${c.document.bounds.width} ${c.document.bounds.height}`);svg.setAttribute('data-guide-path',c.joint);
    const line=document.createElementNS(svg.namespaceURI,'polyline');line.setAttribute('points',points.map(p=>`${p.x},${p.y}`).join(' '));line.setAttribute('fill','none');line.setAttribute('stroke','#8152b2');line.setAttribute('stroke-width','1.5');line.setAttribute('stroke-dasharray','4 3');svg.append(line);
    for(const [i,p] of points.entries()){const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.setAttribute('r',i===0||i===points.length-1?'3':'1.5');dot.setAttribute('fill',i===0?'#db795e':i===points.length-1?'#448eb8':'#8152b2');svg.append(dot);}overlay.append(svg);
   }
   status.textContent='Authored clip preview. Live events are not replayed.';
  }catch(error){if(token===generation)status.textContent=error.message;}
 }
 return {update,invalidate,dispose(){invalidate();overlay.remove();panel.remove();}};
}
