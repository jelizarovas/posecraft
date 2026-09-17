import './style.css';
import { library, starter, upgradeLibraryDocument } from '../examples/library.js';
import { DocumentStore } from '../src/commands.js';
import { SceneController } from '../src/scene.js';
import { mountSVG, renderSVG } from '../src/svg.js';
import { SoundEffects } from '../src/audio.js';
import { behaviorConfig } from '../src/physics.js';
import { sampleClip, clamp, wrapAngle } from '../src/index.js';

const $ = id => document.getElementById(id);
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
const button = (id,name,label,extra='') => `<button id="${id}" title="${label}" aria-label="${label}" ${extra}>${icon(name)}</button>`;
const key = 'posecraft.studio.v2';
const sound=new SoundEffects();
document.body.classList.add('studio-app');
const media = matchMedia('(prefers-reduced-motion: reduce)');
let store;
try {const raw=localStorage.getItem(key),old=JSON.parse(raw)||starter,upgrade=upgradeLibraryDocument(old);store=new DocumentStore(upgrade.document);if(upgrade.changed){localStorage.setItem(key+'.before-responses',raw);localStorage.setItem(key,JSON.stringify(store.document));}}catch{store=new DocumentStore(starter);}
let selected=store.document.actors[0]?.id, joint='head', clip='idle', controller, renderer, playing=!media.matches;
let inspector='pose', tab='timeline', previewTime=0, overrides={}, bones=true, limits=true, dragMode=false, motionMode='system';
let selectedProp=null, propPanel='shape', colliders=true;
const prop=()=>store.document.props?.find(p=>p.id===selectedProp);
let last=null, scenario=null, drag=null, offset={x:0,y:0}, toastTimer, transitionIndex=0;
const actor=()=>store.document.actors.find(a=>a.id===selected);
const pack=()=>store.document.packs[actor()?.pack];
const rigJoint=()=>pack()?.joints.find(j=>j.id===joint);
const selectedRuntime=()=>controller.actors.find(a=>a.actor.id===selected);
const inputValue=name=>actor()?.inputs?.[name] ?? pack()?.inputs[name]?.default;
const reduced=()=>motionMode==='reduced'||(motionMode==='system'&&media.matches);
const set=(path,value)=>({op:'set',path,value});
const labels={root:'Body',head:'Head',eyes:'Eyes',mouth:'Mouth',leftArm:'Left arm',rightArm:'Right arm',leftFoot:'Left foot',rightFoot:'Right foot',leftEye:'Left eye',rightEye:'Right eye',leftUpper:'Left upper arm',rightUpper:'Right upper arm',leftLower:'Left forearm',rightLower:'Right forearm',leftHand:'Left hand',rightHand:'Right hand',leftThigh:'Left thigh',rightThigh:'Right thigh',leftCalf:'Left calf',rightCalf:'Right calf',tail:'Tail',backPaw:'Back paw',frontPaw:'Front paw',torso:'Torso'};
const title=v=>labels[v] || v.charAt(0).toUpperCase()+v.slice(1);
document.querySelector('#app').innerHTML=`
<header class="topbar"><a class="brand" href="./"><span class="brand-mark">p</span>posecraft</a><div class="toolbar-group mobile-panels">${button('scene-panel','skeleton','Scene panel')}${button('inspector-panel','tune','Inspector panel')}</div><div class="toolbar-group">${button('undo','undo','Undo')}${button('redo','redo','Redo')}<span class="divider"></span>${button('import','folder_open','Open project')}${button('save','save','Save project')}${button('export','download','Export scene')}<input id="file" hidden type="file" accept=".json,application/json"></div><div class="toolbar-group end"><span id="saved" class="caption">Local draft</span><a class="icon-button" href="./react-demo.html" title="React playground" aria-label="React playground">${icon('open_in_new')}</a><a class="icon-button" href="https://github.com/jelizarovas/posecraft" title="Source and agent API" aria-label="Source and agent API">${icon('code')}</a><details class="more"><summary class="icon-button" aria-label="More options">${icon('more_horiz')}</summary><div><button id="new">New scene</button><button id="legacy">Open previous studio draft</button><button id="svg-export">Export current SVG</button><a href="./wwwzard.html">Original wwwzard demo</a></div></details></div></header>
<main class="workspace"><aside class="sidebar left"><div class="section-label">Characters <span class="caption">Add to scene</span></div><div id="library" class="library"></div><label class="scene-label">Scene <select id="actors" aria-label="Selected character"></select></label><div class="prop-tools"><select id="props" aria-label="Selected prop"><option value="">Props</option></select>${button('add-prop','add','Add prop')}${button('show-colliders','tune','Show collision boxes','class="active"')}</div><div class="hierarchy-head"><span>Body parts</span><span id="joint-count"></span></div><div id="hierarchy"></div><div class="actor-actions">${button('duplicate','content_copy','Duplicate character')}${button('delete','delete','Remove character')}<span id="pack-note" class="caption"></span></div></aside>
<section class="viewport" aria-label="Scene viewport"><div class="viewport-bar"><div class="tool-palette">${button('select-tool','edit','Select and pose body parts','class="active"')}${button('drag-tool','pan_tool','Drag container')}${button('bones','skeleton','Show joints','class="active"')}${button('limits','tune','Show joint limits','class="active"')}</div><div class="tool-palette">${button('shake','gesture','Move and stop')}${button('reset','restart_alt','Reset preview')}<select id="motion-policy" aria-label="Motion preview"><option value="system">System motion</option><option value="full">Motion on</option><option value="reduced">Still preview</option></select></div></div><div id="stage" class="stage" tabindex="0" aria-label="Scene card. Drag empty card space to test motion; select a body part to pose it."><div id="art" class="art"></div></div><div class="viewport-bottom"><div class="demo-controls"><label>Action <select id="demo-action" aria-label="Demo action"></select></label><label>Emotion <select id="emotion" aria-label="Emotion"></select></label></div><span id="hint">Drag empty card space to test motion. Drag a body part to pose it.</span></div></section>
<aside class="sidebar right"><nav class="inspector-tabs"><button data-panel="pose" class="active">${icon('edit')}Pose</button><button data-panel="look">${icon('palette')}Look</button><button data-panel="motion">${icon('animation')}Motion</button><button data-panel="feel">${icon('gesture')}Feel</button></nav><div id="inspector"></div></aside></main>
<section class="timeline"><div class="timeline-toolbar"><div class="tabs"><button id="timeline-tab" class="active">Timeline</button><button id="states-tab">States</button></div><div class="playback">${button('start','skip_previous','Jump to start')}${button('play','play_arrow','Play animation')}<select id="clip" aria-label="Animation clip"></select><span id="time" class="time-label"></span></div><div class="key-tools">${button('add-key','add','Add keyframe','class="primary"')}${button('remove-key','delete','Remove keyframe')}<select id="easing" aria-label="Keyframe easing"><option value="smooth">Smooth</option><option value="linear">Linear</option><option value="step">Step</option></select></div></div><div id="timeline-content"></div></section>
<footer class="footer"><span id="status"></span><span id="motion-status"></span><span class="desktop-only">Posecraft · MIT</span></footer><div id="toast" class="toast hidden" role="status"></div>`;
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),5000);}
function persist(){try{localStorage.setItem(key,JSON.stringify(store.document));$('saved').textContent='Saved locally';}catch{toast('Storage full. Save project to keep your changes.');}}
function transact(commands,message){try{store.transact(commands);persist();rebuild();if(message)toast(message);}catch(e){toast(e.message);}}
function baseValue(){const j=rigJoint();return overrides[joint+'.rotation']??sampleClip({...pack().clips[clip],loop:false},previewTime)[joint+'.rotation']??j.rotation;}
function frame(){if(actor()&&tab==='timeline')controller.previewClip(selected,clip,previewTime,overrides);return controller.frame();}
function mount(){renderer=mountSVG($('art'),store.document,frame(),{bones:!selectedProp&&bones,limits,selectedActor:selectedProp?undefined:selected,selectedJoint:joint,physicsDebug:inspector==='feel',colliders,selectedProp});}
function refresh(){renderer.update(frame());updateTime();if($('rotation')){$('rotation').value=baseValue();$('rotation-number').value=Math.round(baseValue()*10)/10;}}
function rebuild(){
 controller?.dispose();if(!prop())selectedProp=null;if(!actor())selected=store.document.actors[0]?.id;
 if(pack()&&!pack().joints.some(j=>j.id===joint))joint=pack().joints[0].id;
 if(pack()&&!pack().clips[clip])clip=Object.keys(pack().clips)[0];
 if(pack())previewTime=Math.min(previewTime,pack().clips[clip].duration);
 controller=new SceneController(store.document,{reducedMotion:reduced()});controller.subscribe(e=>{sound.handle(e);if(e.type==='error')toast(e.message);});
 $('stage').style.aspectRatio=`${store.document.bounds.width}/${store.document.bounds.height}`;
 $('undo').disabled=!store.past.length;$('redo').disabled=!store.future.length;
 $('delete').disabled=$('duplicate').disabled=!actor();
 drawProps();drawLibrary();drawHierarchy();drawInspector();drawTimeline();drawDemo();mount();updateTime();last=null;
}
function drawLibrary(){
 $('library').innerHTML=Object.entries(library).map(([id,d])=>{const c=new SceneController(d);const preview=renderSVG(d,c.frame());return `<button data-add="${id}" class="asset-card" title="Add ${d.name}" aria-label="Add ${d.name}"><span class="asset-thumb">${preview}</span><span>${d.name}</span></button>`;}).join('');
 $('library').querySelectorAll('[data-add]').forEach(b=>b.onclick=()=>addActor(b.dataset.add));
}
function drawHierarchy(){
 drawProps();
 $('actors').innerHTML=store.document.actors.map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('');
 $('hierarchy').innerHTML=(pack()?.joints||[]).map(j=>`<button class="joint-row ${joint===j.id?'active':''}" data-select-joint="${j.id}">${icon(j.parent?'link':'skeleton')}<span>${title(j.id)}</span><small>${j.min}°…${j.max}°</small></button>`).join('');
 $('hierarchy').style.setProperty('--joint-count',pack()?.joints.length||1);
 $('hierarchy').querySelectorAll('[data-select-joint]').forEach(b=>b.onclick=()=>selectJoint(selected,b.dataset.selectJoint));
 $('joint-count').textContent=pack()?`${pack().joints.length} joints`:'';$('pack-note').textContent=actor()?`${store.document.actors.length} in scene`:'';
}
function selectJoint(actorId,jointId){selectedProp=null;if(selected!==actorId){controller.clearPreview(selected);overrides={};}selected=actorId;joint=jointId;if(!pack().clips[clip])clip=Object.keys(pack().clips)[0];previewTime=Math.min(previewTime,pack().clips[clip].duration);inspector='pose';drawHierarchy();drawInspector();drawTimeline();drawDemo();mount();}
function field(label,id,value,attrs=''){return `<label class="field">${label}<input id="${id}" value="${esc(value)}" ${attrs}></label>`;}
function drawInspector(){
 $('inspector').classList.toggle('feel-panel',inspector==='feel'||!!selectedProp);
 if(prop()){drawPropInspector();return;}
 document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===inspector));
 const a=actor(),p=pack(),j=rigJoint();if(!a){$('inspector').innerHTML='<p class="note">Add a character from the library.</p>';return;}
 const index=store.document.actors.indexOf(a);
 if(inspector==='pose'){
 $('inspector').innerHTML=`<div class="inspector-heading"><span>${title(joint)}</span><small>${esc(a.name)}</small></div><div class="selected-part">${icon('skeleton')} ${j.parent?`Attached to ${title(j.parent)}`:'Root of character'}</div><label class="field">Rotation<div class="rotation-controls"><input id="rotation" type="range" min="${j.min}" max="${j.max}" step="1" value="${baseValue()}"><input id="rotation-number" aria-label="Joint rotation degrees" type="number" min="${j.min}" max="${j.max}" value="${Math.round(baseValue()*10)/10}" step="1"></div></label><div class="section-label">Joint limits</div><div class="two-col">${field('Minimum','limit-min',j.min,'type="number" min="-180" max="180"')}${field('Maximum','limit-max',j.max,'type="number" min="-180" max="180"')}</div><p class="note">Drag this body part on the canvas. The arc shows its allowed rotation. New limits also clamp its existing keys.</p><div class="section-label">Pivot / rest position</div><div class="two-col">${field('X','pivot-x',j.x,'type="number" step="1"')}${field('Y','pivot-y',j.y,'type="number" step="1"')}</div><div class="section-label">Character placement</div><div class="two-col">${field('X','pos-x',a.transform.x,'type="number"')}${field('Y','pos-y',a.transform.y,'type="number"')}${field('Scale','scale',a.transform.scale,'type="number" min=".05" max="10" step=".1"')}${field('Turn','turn',a.transform.rotation,'type="number" min="-180" max="180"')}</div>`;
 for(const id of ['rotation','rotation-number'])$(id).oninput=e=>pose(Number(e.target.value));
 $('limit-min').onchange=$('limit-max').onchange=changeLimits;
 for(const axis of ['x','y'])$('pivot-'+axis).onchange=e=>transact([set(['packs',a.pack,'joints',p.joints.indexOf(j),axis],Number(e.target.value))]);
 for(const [id,prop]of[['pos-x','x'],['pos-y','y'],['scale','scale'],['turn','rotation']])$(id).onchange=e=>transact([set(['actors',index,'transform',prop],Number(e.target.value))]);
 }else if(inspector==='look'){
 const channels=Object.keys(p.appearanceDefaults||Object.fromEntries(p.parts.filter(p=>p.channel).map(p=>[p.channel,p.fill])));
 $('inspector').innerHTML=`<div class="inspector-heading">${esc(a.name)}<small>Appearance</small></div>${field('Name','actor-name',a.name,'maxlength="100"')}${p.inputs.hair?`<label class="field">Hair style<select id="hair" aria-label="Hair style">${p.inputs.hair.options.map(v=>`<option value="${esc(v)}" ${inputValue('hair')===v?'selected':''}>${esc(title(v))}</option>`).join('')}</select></label>`:''}<div class="colors">${channels.map(name=>`<label class="color-row"><span>${esc(title(name))}</span><input type="color" data-color="${esc(name)}" aria-label="${esc(name)} color" value="${a.appearance?.[name]||p.appearanceDefaults?.[name]||'#333333'}"></label>`).join('')}</div><button id="reset-look" class="text-button">${icon('restart_alt')}Reset appearance</button><p class="note">Changes apply to this character only.</p>`;
 $('actor-name').onchange=e=>transact([set(['actors',index,'name'],e.target.value)]);
 if($('hair'))$('hair').onchange=e=>changeInput('hair',e.target.value);
 $('inspector').querySelectorAll('[data-color]').forEach(el=>el.onchange=()=>transact([set(['actors',index,'appearance'],{...a.appearance,[el.dataset.color]:el.value})]));
 $('reset-look').onclick=()=>transact([set(['actors',index,'appearance'],{}),set(['actors',index,'inputs'],{...a.inputs,...(p.inputs.hair?{hair:'none'}:{})})]);
 }else if(inspector==='motion'){
 const r=p.reaction;
 $('inspector').innerHTML=`<div class="inspector-heading">Motion response<small>${esc(a.name)}</small></div>${r?`<label class="field">Strength <output>${r.strength.toFixed(2)}</output><input id="strength" type="range" min="0" max="2" step=".05" value="${r.strength}"></label><label class="field">Stiffness <output>${r.stiffness}</output><input id="stiffness" type="range" min="10" max="200" step="1" value="${r.stiffness}"></label><label class="field">Damping <output>${r.damping}</output><input id="damping" type="range" min="2" max="40" step="1" value="${r.damping}"></label><p class="note">Acceleration adds visible lean and lag. Stopping reverses the response, then it settles. This is a spring response; feet are not physically planted.</p>`:'<p class="note">This character has no motion response configured.</p>'}<div class="section-label">Scene dimensions</div><div class="two-col">${field('Width','scene-width',store.document.bounds.width,'type="number" min="100" max="4096"')}${field('Height','scene-height',store.document.bounds.height,'type="number" min="100" max="4096"')}</div><button id="test-motion" class="text-button">${icon('gesture')}Move and stop</button><p id="motion-readout" class="note"></p>`;
 for(const prop of ['strength','stiffness','damping'])if($(prop))$(prop).onchange=e=>transact([set(['packs',a.pack,'reaction',prop],Number(e.target.value))]);
 for(const prop of ['width','height'])$('scene-'+prop).onchange=e=>transact([set(['bounds',prop],Number(e.target.value))]);
 $('test-motion').onclick=shake;
 }else drawFeel();
}

function changeBehavior(patch){
 if(!actor())return;const index=store.document.actors.indexOf(actor()),next=behaviorConfig({...actor().behavior,...patch});
 try{controller.setBehavior(selected,next);store.transact([set(['actors',index,'behavior'],next)]);persist();drawInspector();$('undo').disabled=!store.past.length;refresh();}catch(e){toast(e.message);}
}
function runInteraction(name){
 if(!actor())return;
 if(['drop','toss'].includes(name)&&behaviorConfig(actor().behavior).mode==='animated')changeBehavior({mode:name==='toss'?'floating':'protective'});
 if(reduced()&&['drop','toss'].includes(name)){toast('Choose Motion on to test falls and floating.');return;}
 controller.interact(selected,name);refresh();
}
function drawFeel(){
 const a=actor(),b=behaviorConfig(a.behavior),hasPhysics=!!pack().physics;
 $('inspector').innerHTML=`<div class="inspector-heading">Reactions<small id="face-live"></small></div><label class="field">Body mode<select id="body-mode" aria-label="Body mode"><option value="animated">Animated</option><option value="floating" ${!hasPhysics?'disabled':''}>Floating ragdoll</option><option value="ragdoll" ${!hasPhysics?'disabled':''}>Falling ragdoll</option><option value="protective" ${!hasPhysics?'disabled':''}>Protective</option></select></label><label class="field">Resistance / muscle strength<input id="resistance" aria-label="Muscle strength" type="range" min="0" max="1" step=".05" value="${b.resistance}"></label><label class="field">Protective response<select id="strategy" aria-label="Protective response"><option value="auto">Automatic</option><option value="protect">Cover head</option><option value="curl">Curl / hold self</option><option value="brace">Break fall</option></select></label><div class="two-col">${field('Gravity','gravity',b.gravity,'type="number" min="0" max="2" step=".1"')}${field('Bounce','bounce',b.bounce,'type="number" min="0" max="1" step=".05"')}</div><label class="face-auto"><input id="auto-face" type="checkbox" ${b.autoFace?'checked':''}> Automatic facial responses</label><div class="sound-controls"><button id="sound-toggle" aria-label="${sound.enabled?'Mute sound':'Enable sound'}">${icon('play_arrow')}${sound.enabled?'Sound on':'Sound off'}</button><input id="sound-volume" aria-label="Sound volume" type="range" min="0" max="1" step=".05" value="${sound.volume}"></div><div class="section-label">Try an interaction</div><div class="interaction-grid">${[['pet','Pet'],['tap','Poke'],['startle','Startle'],['drop','Drop'],['toss','Toss'],['hurt','Hurt'],['catch','Catch']].map(([id,label])=>`<button data-interact="${id}">${label}</button>`).join('')}</div><div id="response-status" class="response-status" role="status">Calm</div><p class="note">Floating has no gravity. Protective uses limited muscle torque. Collision shapes approximate the artwork; self-holding is an authored pose.</p>`;
 $('body-mode').value=b.mode;$('strategy').value=b.strategy;$('gravity').disabled=b.mode==='floating';
 for(const prop of ['mode','strategy','resistance','gravity','bounce'])$(prop==='mode'?'body-mode':prop).onchange=e=>changeBehavior({[prop]:['mode','strategy'].includes(prop)?e.target.value:+e.target.value});
 $('auto-face').onchange=e=>changeBehavior({autoFace:e.target.checked});
 $('sound-toggle').onclick=async()=>{if(sound.enabled)sound.mute();else if(await sound.unlock())sound.handle({type:'interaction',interaction:'pet'});else toast('Sound could not start in this browser.');drawFeel();};
 $('sound-volume').oninput=e=>sound.setVolume(+e.target.value);
 $('inspector').querySelectorAll('[data-interact]').forEach(b=>b.onclick=()=>runInteraction(b.dataset.interact));
}

function pose(value){if(behaviorConfig(actor().behavior).mode!=='animated'){toast('Choose Animated in Feel to edit keyframes.');return;}if(!Number.isFinite(value))return;playing=false;tab='timeline';overrides[joint+'.rotation']=clamp(value,rigJoint().min,rigJoint().max);refresh();}
function changeLimits(){const p=pack(),j=rigJoint(),min=Number($('limit-min').value),max=Number($('limit-max').value);if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||min<-180||max>180){toast('Limits must be ordered between -180° and 180°.');drawInspector();return;}
 const joints=structuredClone(p.joints),clips=structuredClone(p.clips);Object.assign(joints[p.joints.indexOf(j)],{min,max,rotation:clamp(j.rotation,min,max)});
 let count=0;for(const c of Object.values(clips))for(const pair of c.tracks[joint+'.rotation']||[]){const v=clamp(pair[1],min,max);if(v!==pair[1])count++;pair[1]=v;}
 const commands=[set(['packs',actor().pack,'joints'],joints),set(['packs',actor().pack,'clips'],clips)];if(p.physics){const responses=structuredClone(p.physics.responses);for(const pose of Object.values(responses))if(pose[joint+'.rotation']!==undefined)pose[joint+'.rotation']=clamp(pose[joint+'.rotation'],min,max);commands.push(set(['packs',actor().pack,'physics','responses'],responses));}overrides={};transact(commands,count?`Updated limits and clamped ${count} keys. Undo restores both.`:'Joint limits updated.');
}
function drawDemo(){const p=pack();$('demo-action').innerHTML=Object.keys(p?.clips||{}).map(id=>`<option value="${id}" ${id===clip?'selected':''}>${title(id)}</option>`).join('');$('emotion').innerHTML=(p?.inputs.emotion?.options||['neutral']).map(id=>`<option value="${esc(id)}" ${id===inputValue('emotion')?'selected':''}>${esc(title(id))}</option>`).join('');$('emotion').disabled=!p?.inputs.emotion;}
function changeInput(name,value){if(!actor())return;const index=store.document.actors.indexOf(actor());transact([set(['actors',index,'inputs'],{...actor().inputs,[name]:value})]);}
function chooseAction(id){clip=id;previewTime=0;overrides={};playing=!reduced();transitionIndex=0;if(pack().inputs.action)changeInput('action',id);else{drawTimeline();drawDemo();mount();}}
function drawTimeline(){
 const p=pack(),c=p?.clips[clip];$('clip').innerHTML=Object.keys(p?.clips||{}).map(id=>`<option value="${id}" ${id===clip?'selected':''}>${title(id)}</option>`).join('');
 $('add-key').disabled=$('remove-key').disabled=!c;
 $('timeline-tab').classList.toggle('active',tab==='timeline');$('states-tab').classList.toggle('active',tab==='states');
 if(!c){$('timeline-content').innerHTML='<p class="note">Add a character to begin.</p>';return;}
 if(tab==='states'){
 const stateId=Object.keys(p.states).find(id=>p.states[id].clip===clip)||p.initial,transitions=p.states[stateId].transitions||[];transitionIndex=Math.min(transitionIndex,Math.max(0,transitions.length-1));const t=transitions[transitionIndex];
 $('timeline-content').innerHTML=`<div class="state-editor"><div class="state-node">${esc(stateId)}</div>${icon('link')}${t?`<select id="transition" aria-label="Transition">${transitions.map((t,i)=>`<option value="${i}" ${i===transitionIndex?'selected':''}>${esc(t.to)}</option>`).join('')}</select><span class="caption" id="condition">${esc(t.when.input)} = ${esc(t.when.equals)}</span><label>Blend <input id="blend" aria-label="Transition blend seconds" type="number" min="0" max="2" step=".05" value="${t.duration}"> s</label>`:'<span class="note">No outgoing transitions.</span>'}<span id="active-state" class="caption"></span></div>`;
 if(t){$('transition').onchange=e=>{transitionIndex=+e.target.value;drawTimeline();};$('blend').onchange=e=>transact([set(['packs',actor().pack,'states',stateId,'transitions',transitionIndex,'duration'],Number(e.target.value))]);}
 }else{
 const track=c.tracks[joint+'.rotation']||[];
 $('timeline-content').innerHTML=`<div class="timeline-body"><div class="track-label">${title(joint)}<small>Rotation · degrees</small></div><div class="track-area"><div class="ruler">${[0,.25,.5,.75,1].map(t=>`<span>${(t*c.duration).toFixed(2)} s</span>`).join('')}</div><div class="key-lane">${track.map(([t,v])=>`<button class="key ${Math.abs(t-previewTime)<.011?'selected':''}" data-time="${t}" style="left:${t/c.duration*100}%" title="${t}s · ${v}°" aria-label="Key at ${t} seconds, ${v} degrees"></button>`).join('')}<i id="playhead" style="left:${previewTime/c.duration*100}%"></i></div><input id="scrub" class="scrubber" type="range" aria-label="Timeline position" min="0" max="${c.duration}" step=".01" value="${previewTime}"></div><label class="key-time">Time<input id="key-time" type="number" min="0" max="${c.duration}" step=".01" value="${previewTime.toFixed(2)}" aria-label="Playhead time seconds"></label></div>`;
 $('scrub').oninput=e=>seek(+e.target.value);$('key-time').onchange=e=>seek(+e.target.value);
 $('timeline-content').querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>seek(+b.dataset.time));
 }
 updateTime();
}
function seek(time){if(!Number.isFinite(time))return;previewTime=clamp(time,0,pack().clips[clip].duration);playing=false;overrides={};refresh();drawTimeline();}
function updateTime(){const duration=pack()?.clips[clip]?.duration||0;$('play').innerHTML=icon(playing?'pause':'play_arrow');$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');$('play').title=playing?'Pause animation':'Play animation';$('time').textContent=`${previewTime.toFixed(2)} / ${duration.toFixed(2)} s`;if($('scrub'))$('scrub').value=previewTime;if($('playhead'))$('playhead').style.left=`${duration?previewTime/duration*100:0}%`;if($('key-time')&&document.activeElement!==$('key-time'))$('key-time').value=previewTime.toFixed(2);}
function addKey(){
 const p=pack(),c=p?.clips[clip];if(!c)return;
 const tracks=structuredClone(c.tracks),values={...overrides,[joint+'.rotation']:baseValue()};
 for(const [name,value] of Object.entries(values)){
  const spec=p.joints.find(j=>name===j.id+'.rotation');
  tracks[name]=[...(tracks[name]||[]).filter(([t])=>Math.abs(t-previewTime)>.001),[Number(previewTime.toFixed(3)),clamp(value,spec.min,spec.max),$('easing').value]].sort((a,b)=>a[0]-b[0]);
 }
 overrides={};transact([set(['packs',actor().pack,'clips',clip,'tracks'],tracks)],Object.keys(values).length>1?'Keyframes saved for all posed joints.':'Keyframe saved.');
}
function removeKey(){if(!pack())return;const tracks=structuredClone(pack().clips[clip].tracks),name=joint+'.rotation';const keys=(tracks[name]||[]).filter(([t])=>Math.abs(t-previewTime)>.011);if(keys.length)tracks[name]=keys;else delete tracks[name];overrides={};transact([set(['packs',actor().pack,'clips',clip,'tracks'],tracks)]);}
function addActor(id,duplicate=false){selectedProp=null;const source=library[id];if(!source&&!duplicate)return;const a=duplicate?structuredClone(actor()):structuredClone(source.actors[0]);const packId=duplicate?a.pack:id;const commands=[];if(!store.document.packs[packId])commands.push(set(['packs',packId],structuredClone(source.packs[id])));a.id=`${packId}-${Date.now().toString(36)}`;if(duplicate)a.name=(a.name+' copy').slice(0,100);a.transform.x=clamp(a.transform.x+(store.document.actors.length%2?90:-90),80,store.document.bounds.width-80);selected=a.id;joint=packId==='rusty'?'head':'head';clip='idle';previewTime=0;overrides={};commands.push(set(['actors'],[...store.document.actors,a]));transact(commands);}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function reset(){offset={x:0,y:0};scenario=null;drag=null;$('stage').style.transform='';previewTime=0;overrides={};playing=false;rebuild();}
function shake(){if(reduced()){toast('Still preview is active. Choose Motion on to preview reactions.');return;}scenario={start:performance.now(),origin:{...offset}};}
function load(doc){selectedProp=null;const next=new DocumentStore(doc);store=next;selected=next.document.actors[0]?.id;joint='head';clip='idle';previewTime=0;overrides={};offset={x:0,y:0};$('stage').style.transform='';persist();rebuild();}
$('actors').onchange=e=>{selectedProp=null;selected=e.target.value;clip=inputValue('action')||'idle';overrides={};previewTime=0;rebuild();};
$('clip').onchange=$('demo-action').onchange=e=>chooseAction(e.target.value);$('emotion').onchange=e=>{changeBehavior({autoFace:false});changeInput('emotion',e.target.value);};
$('play').onclick=()=>{playing=!playing;overrides={};last=null;updateTime();};$('start').onclick=()=>seek(0);$('add-key').onclick=addKey;$('remove-key').onclick=removeKey;
$('undo').onclick=()=>{store.undo();overrides={};persist();rebuild();};$('redo').onclick=()=>{store.redo();overrides={};persist();rebuild();};
$('duplicate').onclick=()=>addActor(actor().pack,true);$('delete').onclick=()=>transact([set(['actors'],store.document.actors.filter(a=>a.id!==selected))]);
$('save').onclick=$('export').onclick=()=>download(store.document.id+'.posecraft.json',JSON.stringify(store.document,null,2));
$('svg-export').onclick=()=>download(store.document.id+'.svg',renderSVG(store.document,frame()),'image/svg+xml');
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5000000)throw new Error('Scene exceeds 5 MB.');load(JSON.parse(await f.text()));toast('Project opened.');}catch(error){toast('Could not open scene. '+error.message);}e.target.value='';};
$('new').onclick=()=>{download(store.document.id+'-backup.json',JSON.stringify(store.document,null,2));load(starter);toast('Previous project downloaded as a backup.');};
$('legacy').onclick=()=>{try{const old=localStorage.getItem('posecraft.studio.v1');if(!old)return toast('No previous studio draft on this device.');download('current-scene-backup.json',JSON.stringify(store.document,null,2));load(JSON.parse(old));}catch(e){toast(e.message);}};
$('reset').onclick=reset;$('shake').onclick=shake;
$('bones').onclick=()=>{bones=!bones;$('bones').classList.toggle('active',bones);mount();};$('limits').onclick=()=>{limits=!limits;bones=true;$('limits').classList.toggle('active',limits);$('bones').classList.add('active');mount();};
$('select-tool').onclick=()=>{dragMode=false;$('select-tool').classList.add('active');$('drag-tool').classList.remove('active');};$('drag-tool').onclick=()=>{dragMode=true;$('select-tool').classList.remove('active');$('drag-tool').classList.add('active');};
$('motion-policy').onchange=e=>{motionMode=e.target.value;controller.reducedMotion=reduced();controller.rebaseline();if(reduced())playing=false;refresh();};
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>{selectedProp=null;drawProps();inspector=b.dataset.panel;drawInspector();mount();};
for(const t of ['timeline','states'])$(t+'-tab').onclick=()=>{tab=t;overrides={};if(t==='states')controller.clearPreview(selected);drawTimeline();};
$('scene-panel').onclick=()=>{document.querySelector('.workspace').classList.toggle('show-scene');document.querySelector('.workspace').classList.remove('show-inspector');};$('inspector-panel').onclick=()=>{document.querySelector('.workspace').classList.toggle('show-inspector');document.querySelector('.workspace').classList.remove('show-scene');};
function drawProps(){
 $('props').innerHTML='<option value="">Props</option>'+(store.document.props||[]).map(p=>`<option value="${p.id}" ${p.id===selectedProp?'selected':''}>${esc(p.name)}</option>`).join('');
}
function selectProp(id){selectedProp=id||null;drawProps();drawInspector();mount();}
function editProp(patch){if(!prop())return;const index=store.document.props.indexOf(prop());transact([set(['props',index],{...prop(),...patch})]);}
function drawPropInspector(){
 const p=prop(),c=p.collider;
 document.querySelectorAll('[data-panel]').forEach(b=>b.classList.remove('active'));
 $('inspector').innerHTML=`<div class="inspector-heading">${esc(p.name)}<small>Static prop</small></div><div class="prop-tabs"><button id="prop-shape" class="${propPanel==='shape'?'active':''}">Shape</button><button id="prop-box" class="${propPanel==='box'?'active':''}">Collision box</button></div>${propPanel==='shape'?`${field('Name','prop-name',p.name,'maxlength="100"')}<div class="two-col">${['x','y','width','height','rotation'].map(k=>field(title(k),'prop-'+k,p[k],`type="number" step="1" ${k==='rotation'?'min="-180" max="180"':k==='width'||k==='height'?'min="4" max="4096"':''}`)).join('')}${field('Color','prop-fill',p.fill,'type="color"')}</div><p class="note">Drag the prop on the canvas, or use arrow keys. Placement changes restart the physical preview.</p>`:`<label class="face-auto"><input id="prop-enabled" type="checkbox" ${c.enabled?'checked':''}> Collision enabled</label><div class="two-col">${['width','height','x','y'].map(k=>field(k==='x'?'Offset X':k==='y'?'Offset Y':title(k),'box-'+k,c[k],`type="number" step="1" ${k==='width'||k==='height'?'min="4" max="4096"':''}`)).join('')}${field('Friction','box-friction',c.friction,'type="number" min="0" max="2" step=".05"')}${field('Bounce','box-bounce',c.bounce,'type="number" min="0" max="1" step=".05"')}</div><button id="fit-box" class="text-button">Fit box to shape</button><p class="note">Orange shows the physical surface. Gray means collision is off. The box rotates with the prop. Physical body modes collide with it.</p>`}<button id="remove-prop" class="text-button">${icon('delete')}Remove prop</button>`;
 $('prop-shape').onclick=()=>{propPanel='shape';drawPropInspector();};$('prop-box').onclick=()=>{propPanel='box';drawPropInspector();};
 if(propPanel==='shape')for(const k of ['name','x','y','width','height','rotation','fill'])$('prop-'+k).onchange=e=>editProp({[k]:['name','fill'].includes(k)?e.target.value:Number(e.target.value)});
 else{for(const k of ['width','height','x','y','friction','bounce'])$('box-'+k).onchange=e=>editProp({collider:{...c,[k]:Number(e.target.value)}});$('prop-enabled').onchange=e=>editProp({collider:{...c,enabled:e.target.checked}});$('fit-box').onclick=()=>editProp({collider:{...c,x:0,y:0,width:p.width,height:p.height}});}
 $('remove-prop').onclick=()=>transact([set(['props'],store.document.props.filter(v=>v.id!==p.id))]);
}
function scenePoint(x,y){return new DOMPoint(x,y).matrixTransform($('art').querySelector('svg').getScreenCTM().inverse());}
$('props').onchange=e=>selectProp(e.target.value);
$('add-prop').onclick=()=>{const {width:w,height:h}=store.document.bounds,id='prop-'+Date.now().toString(36),width=Math.min(220,w*.65),height=20;selectedProp=id;propPanel='shape';transact([set(['props'],[...(store.document.props||[]),{id,name:'Platform',x:w/2,y:h-15,width,height,rotation:0,fill:'#b9c8c2',collider:{enabled:true,width,height,x:0,y:0,friction:.75,bounce:.1}}])]);};
$('show-colliders').onclick=()=>{colliders=!colliders;$('show-colliders').classList.toggle('active',colliders);mount();};
function localPoint(actorId,x,y){const g=$('art').querySelector(`[data-actor="${actorId}"]`);return new DOMPoint(x,y).matrixTransform(g.getScreenCTM().inverse());}
$('stage').onpointerdown=e=>{
 if(e.button!==0)return;scenario=null;
 const propHit=e.target.closest('[data-prop]');if(!dragMode&&propHit){selectProp(propHit.dataset.prop);const p=scenePoint(e.clientX,e.clientY);drag={type:'prop',start:p,origin:{x:prop().x,y:prop().y},next:null};$('stage').setPointerCapture(e.pointerId);return;}
 const hit=e.target.closest('[data-joint],[data-bone]'),a=e.target.closest('[data-actor]');
 if(!dragMode&&hit&&a&&behaviorConfig(store.document.actors.find(v=>v.id===a.dataset.actor)?.behavior).mode!=='animated'){selectedProp=null;selected=a.dataset.actor;inspector='feel';drawHierarchy();drawInspector();mount();runInteraction('tap');drag=null;return;}
 if(!dragMode&&hit&&a){const id=hit.dataset.joint||hit.dataset.bone;selectJoint(a.dataset.actor,id);playing=false;const w=frame().actors.find(a=>a.id===selected).world[id],p=localPoint(selected,e.clientX,e.clientY);drag={type:'pose',x:e.clientX,y:e.clientY,pivot:w,angle:Math.atan2(p.y-w.y,p.x-w.x),rotation:baseValue()};}
 else drag={type:'card',x:e.clientX,y:e.clientY,origin:{...offset}};
 $('stage').setPointerCapture(e.pointerId);
};
$('stage').onpointermove=e=>{if(!drag)return;if(drag.type==='prop'){const p=scenePoint(e.clientX,e.clientY);drag.next={x:clamp(drag.origin.x+p.x-drag.start.x,0,store.document.bounds.width),y:clamp(drag.origin.y+p.y-drag.start.y,0,store.document.bounds.height)};const node=$('art').querySelector(`[data-prop="${selectedProp}"]`);node?.setAttribute('transform',`translate(${drag.next.x} ${drag.next.y}) rotate(${prop().rotation})`);return;}if(drag.type==='card'){offset={x:clamp(drag.origin.x+e.clientX-drag.x,-170,170),y:clamp(drag.origin.y+e.clientY-drag.y,-100,100)};$('stage').style.transform=`translate(${offset.x}px,${offset.y}px)`;}else if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>3){const p=localPoint(selected,e.clientX,e.clientY),angle=Math.atan2(p.y-drag.pivot.y,p.x-drag.pivot.x);pose(drag.rotation+wrapAngle((angle-drag.angle)*180/Math.PI));}};
$('stage').onpointerup=()=>{const d=drag;drag=null;if(d?.type==='prop'&&d.next)editProp(d.next);};$('stage').onpointercancel=()=>{drag=null;mount();};
$('stage').onkeydown=e=>{if(!e.key.startsWith('Arrow'))return;e.preventDefault();if(prop()&&!dragMode&&!e.shiftKey){editProp({x:clamp(prop().x+(e.key==='ArrowLeft'?-4:e.key==='ArrowRight'?4:0),0,store.document.bounds.width),y:clamp(prop().y+(e.key==='ArrowUp'?-4:e.key==='ArrowDown'?4:0),0,store.document.bounds.height)});return;}if(e.shiftKey||dragMode){offset.x=clamp(offset.x+(e.key==='ArrowLeft'?-16:e.key==='ArrowRight'?16:0),-170,170);offset.y=clamp(offset.y+(e.key==='ArrowUp'?-16:e.key==='ArrowDown'?16:0),-100,100);$('stage').style.transform=`translate(${offset.x}px,${offset.y}px)`;}else if(actor())pose(baseValue()+(e.key==='ArrowLeft'||e.key==='ArrowDown'?-2:2));};
window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'&&!['INPUT','TEXTAREA'].includes(e.target.tagName)){e.preventDefault();(e.shiftKey?$('redo'):$('undo')).click();}});
window.addEventListener('blur',()=>{drag=null;last=null;controller.rebaseline();});
window.addEventListener('pagehide',()=>sound.dispose());
document.addEventListener('visibilitychange',()=>{last=null;controller.rebaseline();});media.addEventListener('change',()=>{controller.reducedMotion=reduced();controller.rebaseline();});
rebuild();
function tick(now){const dt=last===null||document.hidden?0:Math.min((now-last)/1000,.05);last=now;
 if(!document.hidden){
 if(scenario){const t=(now-scenario.start)/1000;offset={x:scenario.origin.x+Math.sin(Math.min(t/.9,1)*Math.PI*2)*95,y:scenario.origin.y-Math.sin(Math.min(t/.9,1)*Math.PI)*25};$('stage').style.transform=`translate(${offset.x}px,${offset.y}px)`;if(t>.9)scenario=null;}
 controller.animationPlaying=tab==='timeline'||playing;controller.sampleHost({...offset,time:now/1000});controller.step(drag?.type==='prop'?0:dt);
 if(playing&&!reduced()&&pack()){if(tab==='timeline')previewTime=(previewTime+dt)%pack().clips[clip].duration;else{const r=selectedRuntime();previewTime=r.runtime.layers[0].time%pack().clips[pack().states[r.runtime.layers[0].state].clip].duration;}}
 renderer.update(frame());updateTime();if(playing&&$('rotation')&&document.activeElement!==$('rotation-number')){$('rotation').value=baseValue();$('rotation-number').value=Math.round(baseValue()*10)/10;}
 const s=selectedRuntime()?.spring;
 $('status').textContent=`${store.document.actors.length} character${store.document.actors.length===1?'':'s'} · ${title(joint)} · ${title(selectedRuntime()?.response.state||'calm')}${Object.keys(overrides).length?' · Unsaved pose, add a key':''}`;
 $('motion-status').textContent=reduced()?'Still preview · motion disabled':`Lean ${Math.abs(s?.x||0).toFixed(1)}° · ${drag?.type==='card'?'Dragging':'Motion on'}`;
 $('hint').textContent=reduced()?'Still preview is active. Choose Motion on to test reactions.':dragMode?'Drag anywhere on the card. Watch the character lean and settle.':selectedProp?'Drag this prop to place it. Orange outline = collision box.':'Drag empty card space to test motion. Drag a body part to pose it.';
 if($('active-state'))$('active-state').textContent='Action: '+(selectedRuntime()?.runtime.layers[0].state||'')+' · Response: '+(selectedRuntime()?.response.state||'calm');
 if($('response-status')){const a=selectedRuntime(),d=a?.physics?.diagnostics;$('response-status').textContent=`${title(a?.response.state||'calm')} · ${d?.contacts?.length||0} contacts${d?.predictedImpact?' · impact predicted':''}`;}
 if($('face-live'))$('face-live').textContent='Face: '+title(frame().actors.find(a=>a.id===selected)?.inputs.emotion||'neutral');
 if($('motion-readout'))$('motion-readout').textContent=`Horizontal acceleration ${Math.round(controller.motion.ax)} px/s² · lean ${(s?.x||0).toFixed(1)}°`;
 }
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
