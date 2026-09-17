import {assertDocument} from './schema.js';

/** Inspect executable scene features, rather than unused rig capabilities. */
export function inspectSceneFeatures(document) {
  const scene=assertDocument(document),packs=scene.actors.map(actor=>scene.packs[actor.pack]);
  const physical=scene.actors.filter(actor=>(actor.behavior?.mode||'animated')!=='animated');
  const features=['clips','svg'];
  if(packs.some(pack=>pack.spatial))features.push('spatial');
  if(packs.some(pack=>pack.reaction))features.push('spring-reactions');
  if(scene.lighting?.enabled)features.push('lighting');
  if(scene.emitters?.length)features.push('emitters');
  if(scene.contacts?.length)features.push('contacts');
  if(scene.ensemble)features.push('ensemble');
  if(scene.fluid)features.push('bottle-fluid');
  if(scene.behaviorGraph&&scene.presentation!=='sequence')features.push('behaviors');
  if(scene.presentation!=='sequence'&&Object.keys(scene.behaviorGraph?.activities||{}).length)features.push('action-variations');
  if(scene.interactions?.length)features.push('pointer-interactions');
  if(physical.length)features.push('physics');
  return {runtime:physical.length?'physics':'illustration',features,reasons:physical.map(actor=>`${actor.name||actor.id} uses ${actor.behavior.mode} motion.`)};
}
const escapeHTML=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeJSON=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
function runtimeBaseURL(value,local){
  if(local){if(value!==undefined)throw new Error('A local export uses its bundled runtime directory.');return './runtime/';}
  let url;try{url=new URL(value);}catch{throw new Error('Runtime URL must be an absolute HTTP(S) directory URL.');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Runtime URL must be an HTTP(S) directory without credentials, query or fragment.');
  if(!url.pathname.endsWith('/'))url.pathname+='/';
  return url.href;
}
/** Build a reviewable HTML illustration. The website build supplies the runtime files. */
export function createSceneExport(document,{runtimeBase,local=false,label=document.name,autoplay=true}={}) {
  const scene=structuredClone(assertDocument(document)),inspection=inspectSceneFeatures(scene),base=runtimeBaseURL(runtimeBase,local);
  const runtimeURL=base+inspection.runtime+'.js';
  const manifest={format:'posecraft-website',version:1,scene:scene.id,runtime:inspection.runtime,features:inspection.features,runtimeURL,runtimeManifestURL:base+'manifest.json',documentEmbedded:true,dependencies:[runtimeURL],notes:local?['Serve this directory over HTTP(S).']:['The runtime URL and its imported chunks must remain available.']};
  const html=`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHTML(label)}</title>
<style>html,body{margin:0;min-height:100%;background:transparent}#posecraft{width:100%;aspect-ratio:${scene.bounds.width}/${scene.bounds.height};overflow:hidden}#posecraft svg{display:block;width:100%;height:100%}#error{font:14px system-ui;padding:1rem;color:#8b2535}</style></head>
<body><main id="posecraft" aria-label="${escapeHTML(label)}"></main><p id="error" role="alert" hidden></p>${scene.fluid?'<button id="phone-motion" type="button">Enable phone motion</button><span id="motion-status" role="status"></span>':''}
<script id="posecraft-scene" type="application/json">${safeJSON(scene)}</script>
<script type="module">
const reportError=error=>{const notice=document.getElementById('error');notice.hidden=false;notice.textContent='This illustration could not start: '+error.message;};
try {
 const {mountExport}=await import(${safeJSON(runtimeURL)});
 const scene=JSON.parse(document.getElementById('posecraft-scene').textContent);
 const player=await mountExport(document.getElementById('posecraft'),scene,{autoplay:${!!autoplay},label:${safeJSON(String(label))},onError:reportError});
 window.posecraft=player;
 ${scene.fluid?`const motionButton=document.getElementById('phone-motion'),motionStatus=document.getElementById('motion-status');
 const showMotion=(enabled,message)=>{motionButton.dataset.enabled=String(enabled);motionButton.textContent=enabled?'Disable phone motion':'Enable phone motion';if(message!==undefined)motionStatus.textContent=message;};
 document.getElementById('posecraft').addEventListener('posecraft-motion',event=>showMotion(!!event.detail.enabled,event.detail.message));
 motionButton.addEventListener('click',async()=>{try{if(motionButton.dataset.enabled==='true'){player.disableMotion();showMotion(false);}else{showMotion(await player.enableMotion());}}catch(error){showMotion(false,error.message);}});`:''}
 window.addEventListener('pagehide',()=>player.dispose(),{once:true});
} catch(error) { reportError(error); }
</script></body></html>`;
  return {html,manifest};
}
