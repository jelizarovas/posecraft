import './atlas-three.css';
import {createGym,gymGripReviews,gymSceneReviews} from '../examples/gym.js';
import {gymPreparationReviews} from '../examples/gym-preparation.js';
import {gymIdleReviews} from '../examples/gym-idle-actions.js';
import {gymAsymmetryReviews} from '../examples/gym-asymmetry.js';
import {WorkerSceneController} from '../src/worker.js';
import {mountSVG} from '../src/svg.js';
const $=id=>document.getElementById(id),reduced=matchMedia('(prefers-reduced-motion: reduce)');
$('app').innerHTML=`<main class="atlas-lab"><header class="lab-header"><div><a href="./demos.html#gym-routine">← Posecraft demos</a><h1>Atlas, in three dimensions</h1><p>The same workout and poses, rendered two ways.</p></div><span class="lab-badge">3D pilot</span></header><div class="views" id="views"><section class="view-card"><header><strong>3D character</strong><span>GPU skinning · cel shading</span></header><div class="stage" id="three-view"></div></section><section class="view-card" id="reference-card"><header><strong>Current character</strong><span>SVG · 2.5D</span></header><div class="stage" id="reference-view"></div></section></div><div class="lab-controls"><button id="play">Pause</button><button id="reset">Restart</button><label>Playback <select id="mode"><option value="live">Live workout</option><option value="recorded">Recorded poses</option></select></label><label id="pose-label" hidden>Action <select id="pose"><option value="routine">Full workout</option></select></label><label><input type="checkbox" id="compare" checked> Show comparison</label><label>View <select id="focus"><option value="scene">Whole scene</option><option value="atlas">Character close-up</option></select></label><label>Detail <select id="quality"><option value="1">Battery saver</option><option value="1.5" selected>Balanced</option><option value="2">Sharp</option></select></label></div><div class="timeline" id="timeline-row" hidden><input id="timeline" aria-label="Animation time" type="range" min="0" max="60" step=".01" value="0"><output id="time">0.00 s</output></div><div id="activity"></div><div class="lab-controls" id="live-controls"><button id="tired">Tired</button><button id="thirsty">Thirsty</button><button id="fresh">Fresh</button></div><div id="metrics" class="metrics"><div class="metric"><span>3D render submission</span><strong id="three-ms">—</strong></div><div class="metric"><span>SVG update</span><strong id="reference-ms">—</strong></div><div class="metric"><span>Simulation · worker</span><strong id="simulation-ms">—</strong></div><div class="metric"><span>3D draw calls / triangles</span><strong id="draw-count">—</strong></div></div><p class="note">Times measure CPU work for each update, not GPU execution or battery use. Hide the comparison to run only the 3D view. Detail changes rendering resolution. This pilot reuses existing poses and contacts; its 3D model and room are being evaluated before integration into Studio.</p><footer class="lab-footer"><span id="status" role="status">Loading 3D renderer…</span><a href="./?demo=gym-routine">Edit the shared workout in Studio</a></footer></main>`;
for(const control of document.querySelectorAll('button,input,select'))control.disabled=true;
const reviews=[...gymSceneReviews,...gymGripReviews,...gymPreparationReviews,...gymIdleReviews,...gymAsymmetryReviews];
for(const review of reviews){if([...$('pose').options].some(o=>o.value===review.clip))continue;const option=document.createElement('option');option.value=review.clip;option.textContent=review.label;$('pose').append(option);}
let data,controller,three,reference,frame,playing=!reduced.matches,mode='live',clip='full-set',time=0,frameId=0,epoch=0,last=null,raf,disposed=false,ready=false,displayTime=0;
const errors=[],timing={threeMs:0,referenceMs:0,simulationMs:0},samples=[];
const fail=error=>{errors.push(error.message||String(error));$('status').textContent=errors.at(-1);$('status').className='error';playing=false;transport();};
const transport=()=>{$('play').textContent=playing?'Pause':'Play';$('play').setAttribute('aria-pressed',String(playing));};
function display(next){
 if(disposed||!three)return;frame=next;frameId++;displayTime=mode==='recorded'?(next.actors.find(a=>a.id==='atlas')?.clipTime??0):next.time;const start=performance.now();three.update(next);const middle=performance.now(),referenceWasMounted=!!reference;
 if($('compare').checked){if(!reference)reference=mountSVG($('reference-view'),data,next);else reference.update(next);const p=next.actors.find(a=>a.id==='atlas').pose,zoom=$('focus').value==='atlas'?1.65:1,w=800/zoom,h=450/zoom;const svg=$('reference-view').querySelector('svg');svg.setAttribute('viewBox',zoom===1?'0 0 800 450':`${Math.max(0,Math.min(800-w,p['root.x']-w/2))} ${Math.max(0,Math.min(450-h,p['root.y']-30-h/2))} ${w} ${h}`);}const end=performance.now();
 Object.assign(timing,{threeMs:middle-start,referenceMs:$('compare').checked?end-middle:0,simulationMs:controller.stats.computeMs});
 for(const id of ['three-view','reference-view']){const target=$(id);target.dataset.time=String(displayTime);target.dataset.clip=mode==='recorded'?clip:next.actors.find(a=>a.id==='atlas')?.clip||'';target.dataset.frame=String(frameId);}
 if(referenceWasMounted||!$('compare').checked)samples.push({...timing});if(samples.length>90)samples.shift();const average=key=>samples.length?samples.reduce((sum,s)=>sum+s[key],0)/samples.length:timing[key];
 $('three-ms').textContent=average('threeMs').toFixed(2)+' ms';$('reference-ms').textContent=$('compare').checked?average('referenceMs').toFixed(2)+' ms':'Off';$('simulation-ms').textContent=average('simulationMs').toFixed(2)+' ms';const stats=three.stats();$('draw-count').textContent=stats.calls+' / '+stats.triangles.toLocaleString();
 const v=next.behavior?.variables;$('activity').textContent=v?`${(next.behavior.actions?.atlas?.activity||next.behavior.state).replaceAll('-',' ')} · fatigue ${Math.round(v.fatigue||0)} · thirst ${Math.round(v.dehydration||0)}`:$('pose').selectedOptions[0].textContent;
 $('timeline').value=String(time);$('time').value=time.toFixed(2)+' s';
}
function reset(){
 const mine=++epoch;ready=false;controller?.dispose();reference?.dispose();reference=null;time=0;last=null;samples.length=0;data=createGym();
 if(mode==='recorded'){data.presentation='sequence';data.actors.find(a=>a.id==='atlas').inputs.action='full-set';}
 controller=new WorkerSceneController(data,{onError:fail});controller.onFrame=f=>{if(mine===epoch){ready=true;display(f);}};
 controller.ready.then(()=>{if(mine!==epoch)return;if(mode==='recorded'){controller.pause();controller.previewClip('atlas',clip,time);}else if(!playing)controller.pause();if(mode==='live'){ready=true;display(controller.frame());}$('status').textContent='Ready · both views share one simulation';}).catch(e=>{if(mine===epoch)fail(e);});
 $('timeline').max=clip==='full-set'?60:data.packs.atlas.clips[clip].duration;transport();
}
function tick(now){if(disposed)return;const dt=last===null?0:Math.min(.04,(now-last)/1000);last=now;if(playing&&!document.hidden&&controller?.started){if(mode==='live')controller.step(dt);else{time=(time+dt)%Number($('timeline').max);controller.previewClip('atlas',clip,time);}}raf=requestAnimationFrame(tick);}
$('play').onclick=()=>{playing=!playing;last=null;if(mode==='live'){if(playing)controller.play();else controller.pause();}transport();};
$('reset').onclick=reset;
$('mode').onchange=()=>{mode=$('mode').value;$('pose-label').hidden=mode==='live';$('timeline-row').hidden=mode==='live';$('live-controls').hidden=mode!=='live';reset();};
$('pose').onchange=()=>{clip=$('pose').value==='routine'?'full-set':$('pose').value;reset();};
$('timeline').oninput=()=>{playing=false;transport();time=+$('timeline').value;controller.previewClip('atlas',clip,time);};
$('compare').onchange=()=>{$('reference-card').hidden=!$('compare').checked;$('views').classList.toggle('solo',!$('compare').checked);samples.length=0;if(!$('compare').checked){reference?.dispose();reference=null;$('reference-view').replaceChildren();}if(frame)display(frame);};
$('focus').onchange=()=>{three.setFocus($('focus').value==='atlas');if(frame)display(frame);};
$('quality').onchange=()=>three.setPixelRatio(+$('quality').value);
$('tired').onclick=()=>controller.setVariable('fatigue',88);$('thirsty').onclick=()=>controller.setVariable('dehydration',92);$('fresh').onclick=()=>{controller.setVariable('fatigue',0);controller.setVariable('dehydration',0);};
document.addEventListener('visibilitychange',()=>{last=null;});
window.atlas3d={snapshot:()=>({time:displayTime,ready,clip,playing,mode,frameId,three:three?.stats(),timing:{...timing},behavior:frame?.behavior,errors:[...errors]})};
try{const {mountThreeGym}=await import('../src/three-gym.js');data=createGym();const initial=new WorkerSceneController(data,{onError:fail});await initial.ready;frame=initial.frame();initial.dispose();three=mountThreeGym($('three-view'),data,frame,{onError:fail});for(const control of document.querySelectorAll('button,input,select'))control.disabled=false;reset();raf=requestAnimationFrame(tick);}catch(error){fail(error);}
window.addEventListener('pagehide',()=>{disposed=true;cancelAnimationFrame(raf);controller?.dispose();reference?.dispose();three?.dispose();});
