export const settingsKey='posecraft-map-play-settings-v1';
const defaults={movementMode:'auto',followOnMove:true,maxPixelRatio:2,shadows:true,showRoute:true,reducedMotion:'system',showFPS:true,fullscreen:false};

export function readPlaySettings(storage){
  let saved;try{saved=JSON.parse((storage??globalThis.localStorage).getItem(settingsKey));}catch{}
  const result={...defaults};
  if(!saved||typeof saved!=='object')return result;
  for(const key of ['followOnMove','shadows','showRoute','showFPS','fullscreen'])if(typeof saved[key]==='boolean')result[key]=saved[key];
  if(['auto','walk','run'].includes(saved.movementMode))result.movementMode=saved.movementMode;
  if([1,1.5,2].includes(saved.maxPixelRatio))result.maxPixelRatio=saved.maxPixelRatio;
  if(typeof saved.reducedMotion==='boolean'||saved.reducedMotion==='system')result.reducedMotion=saved.reducedMotion;
  return result;
}

/** The dialog lives inside the fullscreen root, so its exit control stays available. */
export function mountPlaySettings(view,initial){
  const settings={...initial},button=document.querySelector('#settings-toggle'),dialog=document.querySelector('#play-settings'),fps=document.querySelector('#fps'),message=dialog.querySelector('[data-settings-message]');
  const controls=[...dialog.querySelectorAll('[data-setting]')],fullscreen=dialog.querySelector('[data-fullscreen]');
  const supported=!!document.documentElement.requestFullscreen;
  let disposed=false;
  const save=()=>{try{localStorage.setItem(settingsKey,JSON.stringify(settings));}catch{message.textContent='Settings work for this visit. Browser storage is unavailable.';}};
  const syncFullscreen=()=>{
    fullscreen.textContent=document.fullscreenElement?'Exit fullscreen':'Enter fullscreen';
    fullscreen.disabled=!supported;
    if(!supported)message.textContent='Fullscreen is unavailable in this browser. The game still fills the page.';
  };
  const refresh=()=>{
    for(const control of controls){const value=settings[control.dataset.setting];if(control.type==='checkbox')control.checked=!!value;else control.value=String(value);}
    fps.hidden=!settings.showFPS;syncFullscreen();
  };
  const open=()=>{if(dialog.open)return;message.textContent='';refresh();dialog.showModal();button.setAttribute('aria-expanded','true');};
  const close=()=>dialog.close();
  const closed=()=>{button.setAttribute('aria-expanded','false');button.focus({preventScroll:true});};
  const clickaway=event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();};
  const change=event=>{
    const input=event.target,key=input.dataset.setting;if(!key)return;
    settings[key]=input.type==='checkbox'?input.checked:key==='maxPixelRatio'?Number(input.value):key==='reducedMotion'&&input.value!=='system'?input.value==='true':input.value;
    const {showFPS,fullscreen:unused,...preferences}=settings;
    view.setPreferences(preferences);fps.hidden=!showFPS;save();
  };
  const toggleFullscreen=async()=>{
    try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}
    catch{message.textContent='The browser could not change fullscreen. Try the button again.';}
  };
  const fullscreenChanged=()=>{settings.fullscreen=!!document.fullscreenElement;save();syncFullscreen();};
  // Browsers require a gesture after reload. Restore the preference on the first
  // deliberate game tap, never while the player is opening or changing settings.
  const resumeFullscreen=()=>{if(settings.fullscreen&&supported&&!document.fullscreenElement&&!disposed)document.documentElement.requestFullscreen().catch(()=>{});};
  const game=document.querySelector('#game');game.addEventListener('pointerdown',resumeFullscreen,{once:true});
  button.addEventListener('click',open);dialog.querySelector('[data-close]').addEventListener('click',close);
  dialog.addEventListener('click',clickaway);dialog.addEventListener('close',closed);dialog.addEventListener('change',change);
  fullscreen.addEventListener('click',toggleFullscreen);document.addEventListener('fullscreenchange',fullscreenChanged);refresh();
  return{dispose(){disposed=true;game.removeEventListener('pointerdown',resumeFullscreen);button.removeEventListener('click',open);dialog.querySelector('[data-close]').removeEventListener('click',close);dialog.removeEventListener('click',clickaway);dialog.removeEventListener('close',closed);dialog.removeEventListener('change',change);fullscreen.removeEventListener('click',toggleFullscreen);document.removeEventListener('fullscreenchange',fullscreenChanged);if(dialog.open)dialog.close();}};
}
