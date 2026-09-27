import {createWwwzardHomeScene as createWwzardIllustration} from './wwwzard-home.js';
import {mountIllustration} from '@posecraft/runtime';
import {applyMotionLayers} from '@posecraft/runtime/features';

const scene=createWwzardIllustration();
const stage=document.querySelector('#illustration');
const notice=document.querySelector('#notice');
const play=document.querySelector('#play');
let player,studying=false,studyFrame=0;
const moods={disappointed:0,normal:1,angry:2};
let selectedMood='normal';
const moodClip=base=>selectedMood==='normal'?base:`${base}--${selectedMood}`;
const pairedLaptopClips=new Set(['close','open','closed-idle','closed-pause']);
const showMoodSelection=()=>document.querySelectorAll('[data-mood]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.mood===selectedMood)));
const report=error=>{const el=document.querySelector('#error');el.hidden=false;el.textContent=`The illustration could not play: ${error.message}`;};
try {
  player=mountIllustration(stage,scene,{label:'Wwwzard at work',motionLayerSolver:applyMotionLayers,onError:report});
  window.posecraft=player;
  window.wwzardScene=scene;
  const setPaused=paused=>{play.textContent=paused?'Play':'Pause';play.setAttribute('aria-pressed',String(paused));};
  const stopStudy=()=>{cancelAnimationFrame(studyFrame);studyFrame=0;};
  const live=()=>{stopStudy();studying=false;player.clearPreview('wwzard');player.clearPreview('screen');player.play();setPaused(false);};
  document.querySelector('#hello').addEventListener('click',()=>{if(studying)live();player.dispatch('visitor');notice.textContent=player.controller.reducedMotion?'Reduced motion is on. Use the pose slider to explore his gestures.':'He’ll respond when he reaches a pause.';});
  document.querySelector('#close-laptop').addEventListener('click',()=>{if(studying)live();player.dispatch('close-laptop');notice.textContent='Closing the laptop.';});
  document.querySelector('#open-laptop').addEventListener('click',()=>{if(studying)live();player.dispatch('open-laptop');notice.textContent='Opening the laptop.';});
  document.querySelector('#quiet').addEventListener('click',()=>{if(studying)live();player.dispatch('quiet');notice.textContent='A little room to think.';});
  document.querySelectorAll('[data-mood]').forEach(button=>button.addEventListener('click',()=>{
    selectedMood=button.dataset.mood;
    player.dispatch(`mood-${selectedMood}`);
    // The saved graph records the selected default; the running activity keeps its own variant.
    scene.behaviorGraph.variables.mood=moods[selectedMood];
    showMoodSelection();
    if(studying)preview();
    notice.textContent=`${button.textContent} selected. He’ll show it in his next movement.`;
  }));
  play.addEventListener('click',()=>{if(player.controller.playing){player.pause();setPaused(true);}else{live();}});
  const clip=document.querySelector('#clip'),scrub=document.querySelector('#scrub');
  const showPose=time=>{const paired=pairedLaptopClips.has(clip.value);player.previewClip('wwzard',moodClip(clip.value),time);player.previewClip('screen',paired?moodClip(clip.value):'still',paired?time:0);};
  const preview=()=>{stopStudy();studying=true;setPaused(true);const duration=scene.packs.wwzard.clips[moodClip(clip.value)].duration;showPose(Number(scrub.value)*duration);};
  clip.addEventListener('change',()=>{scrub.value='0';preview();});scrub.addEventListener('input',preview);
  document.querySelector('#study-play').addEventListener('click',()=>{
    scrub.value='0';preview();let elapsed=0,last=null;
    const duration=scene.packs.wwzard.clips[moodClip(clip.value)].duration;
    const tick=now=>{if(document.hidden){stopStudy();return;}if(last!==null)elapsed=Math.min(duration,elapsed+Math.min((now-last)/1000,.05)*Number(document.querySelector('#study-speed').value));last=now;scrub.value=String(elapsed/duration);showPose(elapsed);if(elapsed<duration)studyFrame=requestAnimationFrame(tick);else studyFrame=0;};
    studyFrame=requestAnimationFrame(tick);
  });
  document.querySelector('#live').addEventListener('click',()=>{live();notice.textContent='Back to his own rhythm.';});
  document.querySelector('#save').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(scene,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='wwzard-desk.posecraft.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
  addEventListener('pagehide',()=>{stopStudy();player.dispose();},{once:true});
} catch(error) { report(error); }
