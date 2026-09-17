import './demos.css';
import {demoCatalog,createDemo,findDemo} from '../examples/showcase.js';
import {EpisodeController,episodeDuration} from '../src/episode.js';
import {SceneController} from '../src/scene.js';
import {WorkerSceneController} from '../src/worker.js';
import {mountSVG,renderSVG} from '../src/svg.js';
import {PhoneMotion} from '../src/device-motion.js';
import {SoundEffects} from '../src/audio.js';
const $=id=>document.getElementById(id),icon=name=>`<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
const media=matchMedia('(prefers-reduced-motion: reduce)'),sound=new SoundEffects();
let selected,documentData,controller,worker,renderer,frame,renderedScene,token=0,ready=false,inFlight=false,pending=null,time=0,last=null,playing=!media.matches,offset={x:0,y:0},drag=null,debug=false,shakeStart=null,wander=false,nextWalk=0;
const phone=new PhoneMotion({onStatus:message=>{if(selected?.id==='shake-and-settle'){$('demo-status').textContent=message;phoneButton();}}});
function phoneButton(){const b=$('phone-motion');if(b){b.innerHTML=icon('gesture')+(phone.enabled?'Motion off':'Enable phone');b.setAttribute('aria-pressed',String(phone.enabled));}}
function stopMotion(){phone.disable();shakeStart=null;phoneButton();if($('demo-stage'))$('demo-stage').style.transform='';}
document.body.className='demo-app';
$('app').innerHTML=`<header class="topbar"><a class="brand" href="./"><span class="brand-mark">p</span>posecraft <span class="demo-label">Demos</span></a><div class="toolbar-group end"><a href="./" class="demo-nav">Character Studio</a><a href="./director.html" class="demo-nav">Director</a><a href="https://github.com/jelizarovas/posecraft" class="icon-button" aria-label="Source repository">${icon('code')}</a></div></header><main class="demo-workspace"><aside class="demo-library"><div class="section-label">Explore Posecraft <span>${demoCatalog.length} demos</span></div><div id="demo-list"></div></aside><section class="demo-detail"><div class="demo-heading"><div><div id="demo-category" class="demo-eyebrow"></div><h1 id="demo-title"></h1></div><a id="edit-demo" class="demo-edit">${icon('edit')}Open in editor</a></div><p id="demo-description"></p><div class="demo-theater"><div id="demo-stage"><div id="demo-art"></div></div><div id="demo-caption"></div></div><div class="demo-transport"><button id="demo-play" aria-label="Pause demo">${icon('pause')}</button><button id="demo-reset" aria-label="Restart demo">${icon('restart_alt')}</button><input id="demo-scrub" type="range" min="0" step=".04" aria-label="Demo timeline"><span id="demo-time"></span><button id="demo-sound" aria-label="Enable interaction sounds" title="Enable interaction sounds">${icon('play_arrow')+'Sound off'}</button></div><div id="demo-controls"></div><div class="demo-notes"><p id="demo-instruction"></p><div id="demo-features"></div></div><footer class="demo-footer"><span id="demo-status" role="status">Loading…</span><button id="download-demo">${icon('download')}Download project</button><button id="copy-demo">${icon('link')}Copy demo link</button></footer></section></main>`;
for(const d of demoCatalog){
 const doc=createDemo(d.id),episode=doc.kind==='episode',engine=episode?new EpisodeController(doc):new SceneController(doc),f=engine.frame(0),scene=episode?doc.scenes[f.scene]:doc;
 const button=document.createElement('button');button.className='demo-card';button.dataset.demo=d.id;button.style.setProperty('--demo-color',d.color);button.innerHTML=`<span class="demo-thumb">${renderSVG(scene,f)}</span><span class="demo-card-copy"><strong>${d.title}</strong><small>${d.category}</small></span>`;button.onclick=()=>select(d.id);$('demo-list').append(button);engine.dispose?.();
}
function cleanup(){stopMotion();wander=false;nextWalk=0;token++;worker?.terminate();worker=null;controller?.dispose();controller=null;renderer?.dispose();renderer=null;renderedScene=null;ready=false;inFlight=false;pending=null;offset={x:0,y:0};drag=null;$('demo-stage').style.transform='';}
function select(id){
 cleanup();selected=findDemo(id)||demoCatalog[0];documentData=createDemo(selected.id);frame=null;time=0;last=null;debug=selected.id==='drop-lab';playing=!media.matches;const mine=token;
 history.replaceState(null,'','#'+selected.id);document.title=selected.title+' · Posecraft demos';
 document.querySelectorAll('[data-demo]').forEach(b=>{b.classList.toggle('active',b.dataset.demo===selected.id);b.setAttribute('aria-pressed',String(b.dataset.demo===selected.id));});
 $('demo-title').textContent=selected.title;$('demo-category').textContent=selected.category;$('demo-description').textContent=selected.description;$('demo-instruction').textContent=selected.instruction;$('demo-features').replaceChildren(...selected.features.map(v=>{const span=document.createElement('span');span.textContent=v;return span;}));
 const episode=documentData.kind==='episode';$('edit-demo').href=(episode?'./director.html':'./')+'?demo='+selected.id;$('edit-demo').innerHTML=icon('edit')+(episode?'Edit in Director':'Edit in Studio');$('demo-scrub').hidden=!episode;$('demo-sound').hidden=episode;$('demo-sound').classList.toggle('active',sound.enabled);$('demo-sound').innerHTML=icon('play_arrow')+(sound.enabled?'Sound on':'Sound off');$('demo-stage').classList.toggle('draggable',selected.id==='zero-gravity');$('demo-status').textContent='Preparing demo…';
 if(episode){
  $('demo-scrub').max=episodeDuration(documentData);$('demo-controls').innerHTML='<div id="demo-shots" class="demo-shots"></div>';let start=0;
  for(const s of documentData.shots){const t=start,b=document.createElement('button');b.textContent=s.name;b.dataset.shot=s.id;b.onclick=()=>{time=t;playing=false;requestFrame();transport();};$('demo-shots').append(b);start+=s.duration;}
  worker=new Worker(new URL('../src/episode-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data:m})=>{if(mine!==token)return;if(m.type==='ready'){ready=true;requestFrame();}else if(m.type==='frame'){inFlight=false;show(m.frame);if(pending!==null)send();}else if(m.type==='error')fail(m.message);};worker.onerror=e=>{if(mine===token)fail(e.message);};worker.postMessage({type:'init',project:documentData});
 }else{
  drawControls();controller=new WorkerSceneController(documentData,{onError:e=>fail(e.message)});controller.onFrame=f=>{if(mine===token)show(f);};controller.subscribe(e=>{if(mine===token)sound.handle(e);});show(controller.frame());if(!playing)controller.pause();controller.ready.then(()=>{if(mine===token)$('demo-status').textContent='Live · '+documentData.actors.length+' characters';}).catch(()=>{});
 }
 transport();
}
function fail(message){playing=false;$('demo-status').textContent='Could not play this demo: '+message;transport();}
function show(f){
 frame=f;const episode=documentData.kind==='episode',scene=episode?documentData.scenes[f.scene]:documentData;
 if(!renderer||renderedScene!==scene.id){renderer?.dispose();renderer=mountSVG($('demo-art'),scene,f,{physicsDebug:debug,colliders:debug});renderedScene=scene.id;}else renderer.update(f);
 $('demo-caption').textContent=episode?documentData.shots[f.shotIndex].name: selected.id==='light-and-shade'?'Warm studio / moving silhouettes, soft contact and a mirrored floor': selected.id==='turn-and-pose'?'Ona · Dummy / projected faces, depth order and authored shapes':selected.id==='shake-and-settle'?f.actors.map(a=>documentData.actors.find(v=>v.id===a.id).name+': '+(a.recovery?.phase||a.response).replaceAll('-',' ')).join(' · '):selected.id==='drop-lab'?'Loose · Protect head · Brace':selected.id==='zero-gravity'?'Drag to move the container':'One cast, four different performances';
 if(episode){document.querySelectorAll('[data-shot]').forEach(b=>b.classList.toggle('active',b.dataset.shot===f.shot));$('demo-status').textContent=scene.name+' · '+scene.actors.length+' characters';}transport();
}
function send(){if(!ready||inFlight||pending===null)return;inFlight=true;worker.postMessage({type:'frame',time:pending});pending=null;}
function requestFrame(){pending=Math.min(time,episodeDuration(documentData));send();}
function transport(){const episode=documentData?.kind==='episode';$('demo-play').innerHTML=icon(playing?'pause':'play_arrow');$('demo-play').setAttribute('aria-label',playing?'Pause demo':'Play demo');if(episode){$('demo-scrub').value=time;$('demo-time').textContent=time.toFixed(1)+' / '+episodeDuration(documentData).toFixed(0)+' s';}else $('demo-time').textContent=playing?'Live preview':'Paused';}
const targets=()=>documentData.actors.filter(a=>$('demo-target')?.value==='all'||a.id===$('demo-target')?.value);
function resume(){playing=true;last=null;controller?.play();transport();}
function drawControls(){
 $('demo-controls').innerHTML=`<label>Cast<select id="demo-target"><option value="all">Everyone</option></select></label><div id="demo-actions" class="demo-actions"></div>`;
 for(const a of documentData.actors){const option=document.createElement('option');option.value=a.id;option.textContent=a.name;$('demo-target').append(option);}
 const action=(id,label,fn)=>{const b=document.createElement('button');b.id=id;b.textContent=label;b.onclick=()=>{resume();fn();};$('demo-actions').append(b);};
 if(selected.id==='light-and-shade'){
  const relight=patch=>{Object.assign(documentData.lighting,patch);document.querySelectorAll('[data-light-control]').forEach(input=>input.value=documentData.lighting[input.dataset.lightControl]);renderer?.dispose();renderer=null;show(frame||controller.frame());};
  action('light-warm','Warm',()=>{relight({enabled:true,color:'#fff1d6',ambient:.6,intensity:.8,gloss:.35});});
  action('light-cool','Moonlight',()=>{relight({enabled:true,color:'#a8caff',ambient:.35,intensity:1.1,gloss:.5});});
  action('light-flat','Flat',()=>relight({enabled:false}));
  action('light-jump','Jump',()=>{for(const a of targets()){controller.clearPreview(a.id);controller.setInput(a.id,'action','tuck-jump');}});
  action('light-turn','Turn',()=>{for(const a of targets()){controller.clearPreview(a.id);controller.setInput(a.id,'action','turnaround');}});
  const controls=document.createElement('div');controls.className='lighting-controls';controls.innerHTML=[['angle','Direction',-180,180,1],['softness','Softness',0,16,1],['gloss','Highlights',0,1,.05],['reflection','Reflection',0,.8,.05]].map(([id,label,min,max,step])=>`<label>${label}<input data-light-control="${id}" aria-label="${label}" type="range" min="${min}" max="${max}" step="${step}" value="${documentData.lighting[id]}"></label>`).join('');$('demo-controls').append(controls);
  controls.querySelectorAll('input').forEach(input=>input.oninput=()=>relight({enabled:true,[input.dataset.lightControl]:+input.value}));
 }else if(selected.id==='turn-and-pose'){
  const play=clip=>{for(const a of targets()){controller.clearPreview(a.id);controller.setInput(a.id,'action',clip);}for(const input of document.querySelectorAll('[data-spatial-control]')){input.value=0;input.nextElementSibling.value='0';}};
  action('study-turn','Turnaround',()=>play('turnaround'));action('study-glance','Look around',()=>play('glance'));action('study-reach','Reach & hide',()=>play('reach-depth'));action('study-jump','Tuck jump',()=>play('tuck-jump'));
  const controls=document.createElement('div');controls.className='spatial-controls';controls.innerHTML=[['body','Body turn',-180,180],['head','Head turn',-90,90],['depth','Arm depth',-40,40],['shape','Shape / tuck',0,100]].map(([id,label,min,max])=>`<label>${label}<input data-spatial-control="${id}" aria-label="${label}" type="range" min="${min}" max="${max}" value="0"><output>0</output></label>`).join('');$('demo-controls').append(controls);
  const preview=()=>{playing=false;controller.pause();for(const a of targets()){const get=id=>+document.querySelector(`[data-spatial-control="${id}"]`).value,arm=a.pack==='ona'?'rightArm':'rightUpper',values={'root.yaw':get('body'),'head.yaw':get('head'),[arm+'.z']:get('depth')};if(a.pack==='ona')values['rightArm.bend']=get('shape')/100;else{values['rightThigh.yaw']=-get('shape');values['rightCalf.yaw']=get('shape')*1.3;}controller.previewClip(a.id,'idle',0,values);}transport();};
  controls.querySelectorAll('input').forEach(input=>input.oninput=()=>{input.nextElementSibling.value=input.value;preview();});$('demo-target').onchange=preview;
 }else if(selected.id==='shake-and-settle'){
  action('shake-scene','Shake scene',()=>{shakeStart=performance.now();for(const a of targets())controller.interact(a.id,'toss',.7);});
  const b=document.createElement('button');b.id='phone-motion';b.onclick=()=>{if(phone.enabled){stopMotion();controller.setAcceleration(0,0);$('demo-status').textContent='Phone motion off.';}else{resume();phone.enable().then(phoneButton);}};$('demo-actions').append(b);phoneButton();
  action('wander-cast','Walk around',()=>{wander=!wander;nextWalk=0;$('wander-cast').classList.toggle('active',wander);$('wander-cast').setAttribute('aria-pressed',String(wander));});
 }else if(selected.id==='drop-lab'){
  action('drop-cast','Drop',()=>{for(const a of targets()){controller.setBehavior(a.id,{mode:a.id==='loose'?'ragdoll':'protective',strategy:a.id==='brace'?'brace':'protect',resistance:.75,gravity:1,autoRecover:true});controller.interact(a.id,'drop');}});
  action('toss-cast','Toss',()=>{for(const a of targets()){controller.setBehavior(a.id,{mode:a.id==='loose'?'ragdoll':'protective',strategy:a.id==='brace'?'brace':'protect',resistance:.75,gravity:1,autoRecover:true});controller.interact(a.id,'toss');}});
  action('catch-cast','Catch',()=>{for(const a of targets())controller.interact(a.id,'catch');});
  action('collision-boxes','Collision boxes',()=>{debug=!debug;renderer?.dispose();renderer=null;show(controller.frame());});
 }else if(selected.id==='zero-gravity'){
  action('nudge-cast','Nudge cast',()=>{for(const a of targets())controller.interact(a.id,'toss',.5);});
  action('curl-cast','Curl up',()=>{for(const a of targets()){controller.setBehavior(a.id,{mode:'protective',strategy:'curl',gravity:0,resistance:.75});controller.interact(a.id,'startle');}});
  action('float-cast','Float freely',()=>{for(const a of targets())controller.setBehavior(a.id,{mode:'floating',gravity:0,resistance:.05});});
 }else{
  const label=document.createElement('label');label.textContent='Expression';const input=document.createElement('select');input.id='ensemble-emotion';for(const name of documentData.packs.ona.inputs.emotion.options){const o=document.createElement('option');o.value=name;o.textContent=name;input.append(o);}input.onchange=()=>{for(const a of targets())controller.setInput(a.id,'emotion',input.value);};label.append(input);$('demo-controls').insertBefore(label,$('demo-actions'));
  const act=map=>{for(const a of targets())controller.setInput(a.id,'action',map[a.pack]);};action('greet-cast','Greet',()=>act({ona:'wave',wwwzard:'wave',dummy:'wave',rusty:'wag'}));action('dance-cast','Celebrate',()=>act({ona:'dance',wwwzard:'celebrate',dummy:'dance',rusty:'bounce'}));action('rest-cast','Settle',()=>act({ona:'idle',wwwzard:'idle',dummy:'idle',rusty:'sleep'}));action('pet-cast','Pet',()=>{for(const a of targets())controller.interact(a.id,'pet');});
 }
}
$('demo-play').onclick=()=>{playing=!playing;last=null;if(!playing)stopMotion();if(controller)playing?controller.play():controller.pause();transport();};$('demo-reset').onclick=()=>select(selected.id);$('demo-scrub').oninput=e=>{time=+e.target.value;playing=false;requestFrame();transport();};
$('demo-sound').onclick=async()=>{if(sound.enabled)sound.mute();else await sound.unlock();$('demo-sound').classList.toggle('active',sound.enabled);$('demo-sound').innerHTML=icon('play_arrow')+(sound.enabled?'Sound on':'Sound off');$('demo-sound').setAttribute('aria-label',sound.enabled?'Mute interaction sounds':'Enable interaction sounds');};
$('download-demo').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(documentData,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=selected.id+'.'+documentData.kind+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('copy-demo').onclick=async()=>{try{await navigator.clipboard.writeText(location.href);$('demo-status').textContent='Demo link copied.';}catch{$('demo-status').textContent='Copy this page address to share the demo.';}};
$('demo-stage').onpointerdown=e=>{if(selected.id==='shake-and-settle'&&e.button===0){resume();const rect=$('demo-stage').getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*documentData.bounds.width;walkCast(x);return;}if(selected.id!=='zero-gravity'||e.button!==0)return;resume();drag={x:e.clientX-offset.x,y:e.clientY-offset.y};$('demo-stage').setPointerCapture(e.pointerId);};
$('demo-stage').onpointermove=e=>{if(!drag)return;offset={x:Math.max(-55,Math.min(55,e.clientX-drag.x)),y:Math.max(-35,Math.min(35,e.clientY-drag.y))};$('demo-stage').style.transform=`translate(${offset.x}px,${offset.y}px)`;};$('demo-stage').onpointerup=$('demo-stage').onpointercancel=()=>drag=null;
window.addEventListener('hashchange',()=>{if(location.hash.slice(1)!==selected.id)select(location.hash.slice(1));});document.addEventListener('visibilitychange',()=>{last=null;controller?.rebaseline();if(document.hidden){stopMotion();sound.mute();$('demo-sound').classList.remove('active');$('demo-sound').innerHTML=icon('play_arrow')+'Sound off';$('demo-sound').setAttribute('aria-label','Enable interaction sounds');}});window.addEventListener('pagehide',()=>{cleanup();sound.dispose();});
media.addEventListener('change',e=>{if(e.matches){stopMotion();playing=false;controller?.pause();transport();}last=null;});
select(location.hash.slice(1));
function tick(now){const dt=last===null?0:Math.min(.1,(now-last)/1000);last=now;if(playing&&!document.hidden){if(documentData.kind==='episode'){time=(time+dt)%episodeDuration(documentData);requestFrame();}else{if(selected.id==='shake-and-settle'){
 const signal=phone.signal.sample(now),age=shakeStart===null?2:(now-shakeStart)/1000,pulse=age<.85?Math.sin(age*42)*1100*(1-age/.85):0;
 if(age>=.85)shakeStart=null;const ax=signal.ax+pulse,ay=signal.ay-pulse*.45;
 controller?.setAcceleration(ax,ay);$('demo-stage').style.transform=`translate(${Math.max(-12,Math.min(12,ax/100))}px,${Math.max(-8,Math.min(8,ay/120))}px) rotate(${signal.turn*.35}deg)`;
 if(wander&&now>nextWalk){walkCast(110+Math.random()*(documentData.bounds.width-220));nextWalk=now+4500;}
 }else controller?.sampleHost({...offset,time:now/1000});controller?.step(dt);}}requestAnimationFrame(tick);}requestAnimationFrame(tick);

function walkCast(x){let sent=0;for(const a of targets()){const f=frame?.actors.find(v=>v.id===a.id);if(f?.recovery&&['home','blocked','walking'].includes(f.recovery.phase)){controller.walkTo(a.id,Math.max(0,Math.min(documentData.bounds.width,x+(sent++-(targets().length-1)/2)*70)));}}if(!sent)$('demo-status').textContent='Let the cast stand up before walking.';}
