import {createBehaviorTools} from './behavior-tools.js';
import {mountScenePointers} from '../src/pointer-browser.js';
import {createContactTools} from './contact-tools.js';
import {lightingConfig} from '../src/lighting.js';
import './style.css';
import {createSceneTools} from './scene-tools.js';
import {removeSceneEntity} from '../src/scene-graph.js';
import {convertCampfireEffects} from '../examples/campfire.js';
import {createTimelineTools} from './timeline-tools.js';
import {findDemo,createDemo} from '../examples/showcase.js';
import { library, starter, upgradeLibraryDocument } from '../examples/library.js';
import { DocumentStore } from '../src/commands.js';
import { SceneController } from '../src/scene.js';
import { WorkerSceneController } from '../src/worker.js';
import { mountSVG, renderSVG } from '../src/svg.js';
import { SoundEffects } from '../src/audio.js';
import { behaviorConfig } from '../src/physics.js';
import {addSpatialRig,addOnaArmJoints} from '../src/character-rigs.js';
import {spatialKinematics,spatialChannels} from '../src/spatial.js';
import { sampleClip, clamp, wrapAngle } from '../src/index.js';

const $ = id => document.getElementById(id);
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = name => `<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;
const button = (id,name,label,extra='') => `<button id="${id}" title="${label}" aria-label="${label}" ${extra}>${icon(name)}</button>`;
const requestedDemo=findDemo(new URLSearchParams(location.search).get('demo'));
const demo=requestedDemo?.kind==='scene'?requestedDemo:null;
const initialScene=demo?createDemo(demo.id):starter;
const fromDraw=new URLSearchParams(location.search).get('from')==='draw';
const key = 'posecraft.studio.v2'+(fromDraw?'.draw':demo?'.demo.'+demo.id:'');
const sound=new SoundEffects();
document.body.classList.add('studio-app');
const media = matchMedia('(prefers-reduced-motion: reduce)');
let store;
try {const raw=localStorage.getItem(key),old=JSON.parse(raw)||initialScene,upgrade=upgradeLibraryDocument(old);store=new DocumentStore(upgrade.document);if(upgrade.changed){localStorage.setItem(key+'.before-responses',raw);localStorage.setItem(key,JSON.stringify(store.document));}}catch{store=new DocumentStore(initialScene);}
if(fromDraw){try{const raw=localStorage.getItem('posecraft.studio-transfer.v1');if(raw){const incoming=new DocumentStore(JSON.parse(raw));localStorage.setItem(key,JSON.stringify(incoming.document));store=incoming;localStorage.removeItem('posecraft.studio-transfer.v1');}}catch(error){console.warn('Draw transfer was not opened:',error.message);}}
let pointers;
let selected=(store.document.actors.find(a=>!a.layer||a.layer==='characters')||store.document.actors[0])?.id, joint='head', clip='idle', controller, renderer, playing=!media.matches;
let poseChannel='rotation',lightPanel='surface';
let inspector='pose', tab='timeline', previewTime=0, overrides={}, bones=true, limits=true, dragMode=false, motionMode='system';
let selectedProp=null, propPanel='shape', colliders=true;
let sceneSelection=store.document.emitters?.length?{kind:'emitter',id:(store.document.emitters.find(e=>e.type==='flame')||store.document.emitters[0]).id}:store.document.groups?.length?{kind:'group',id:store.document.groups[0].id}:null, sidebarView=store.document.emitters?.length||store.document.groups?.length||demo?.id==='campfire-night'?'scene':'character', effectsTime=0;
let effectFrameSource,effectFrame,effectFrameTime;
const prop=()=>store.document.props?.find(p=>p.id===selectedProp);
let last=null, scenario=null, drag=null, offset={x:0,y:0}, toastTimer, transitionIndex=0;
const actor=()=>store.document.actors.find(a=>a.id===selected);
const pack=()=>store.document.packs[actor()?.pack];
const rigJoint=()=>pack()?.joints.find(j=>j.id===joint);
const selectedRuntime=()=>controller.actors.find(a=>a.actor.id===selected);
const inputValue=name=>actor()?.inputs?.[name] ?? pack()?.inputs[name]?.default;
clip=inputValue('action')||pack()?.states[pack()?.initial]?.clip||clip;
const reduced=()=>motionMode==='reduced'||(motionMode==='system'&&media.matches);
const editChannels={...spatialChannels,x:{min:-4096,max:4096},y:{min:-4096,max:4096}};
const set=(path,value)=>({op:'set',path,value});
const labels={'hold-upper':'Holding upper arm','hold-elbow':'Holding forearm','hold-hand':'Holding wrist','take-upper':'Free upper arm','take-elbow':'Free forearm','take-hand':'Free wrist',root:'Body',head:'Head',eyes:'Eyes',mouth:'Mouth',leftArm:'Left upper arm',rightArm:'Right upper arm',leftForearm:'Left forearm',rightForearm:'Right forearm',leftWrist:'Left wrist',rightWrist:'Right wrist',leftFoot:'Left foot',rightFoot:'Right foot',leftEye:'Left eye',rightEye:'Right eye',leftUpper:'Left upper arm',rightUpper:'Right upper arm',leftLower:'Left forearm',rightLower:'Right forearm',leftHand:'Left hand',rightHand:'Right hand',leftThigh:'Left thigh',rightThigh:'Right thigh',leftCalf:'Left calf',rightCalf:'Right calf',tail:'Tail',backPaw:'Back paw',frontPaw:'Front paw',torso:'Torso'};
const title=v=>labels[v] || v.charAt(0).toUpperCase()+v.slice(1);
document.querySelector('#app').innerHTML=`
<header class="topbar"><a class="brand" href="./"><span class="brand-mark">p</span>posecraft</a><div class="toolbar-group mobile-panels">${button('scene-panel','skeleton','Scene panel')}${button('inspector-panel','tune','Inspector panel')}</div><div class="toolbar-group">${button('undo','undo','Undo')}${button('redo','redo','Redo')}<span class="divider"></span>${button('import','folder_open','Open project')}${button('save','save','Save project')}${button('export','download','Export scene')}<input id="file" hidden type="file" accept=".json,application/json"></div><div class="toolbar-group end"><span id="saved" class="caption">Local draft</span><a class="icon-button gallery-entry" href="./demos.html" title="Demo gallery" aria-label="Demo gallery">${icon('animation')}<span>Demos</span></a><a class="icon-button" href="./react-demo.html" title="React playground" aria-label="React playground">${icon('open_in_new')}</a><a class="icon-button" href="https://github.com/jelizarovas/posecraft" title="Source and agent API" aria-label="Source and agent API">${icon('code')}</a><details class="more"><summary class="icon-button" aria-label="More options">${icon('more_horiz')}</summary><div><a href="./demos.html">Demo gallery</a><a href="./director.html">Director: scenes and camera</a><a href="./draw.html">Draw / Rig</a><button id="convert-campfire" class="${demo?.id==='campfire-night'?'':'hidden'}">Convert campfire effects</button><button id="upgrade-rig">Upgrade selected character rig</button><button id="reload-demo" class="${demo?'':'hidden'}">Reload current demo</button><button id="new">New scene</button><button id="legacy">Open previous studio draft</button><button id="website-export">Export website illustration</button><button id="svg-export">Export current SVG</button><a href="./wwwzard.html">Original wwwzard demo</a></div></details></div></header>
<main class="workspace"><aside class="sidebar left"><nav class="scene-workspaces"><button id="scene-workspace">Scene</button><button id="character-workspace">Character</button></nav><div id="scene-tree"></div><div class="section-label">Characters <span class="caption">Add to scene</span></div><div id="library" class="library"></div><label class="scene-label">Scene <select id="actors" aria-label="Selected character"></select></label><div class="prop-tools"><select id="props" aria-label="Selected prop"><option value="">Props</option></select>${button('add-prop','add','Add prop')}${button('show-colliders','tune','Show collision boxes','class="active"')}</div><div class="hierarchy-head"><span>Body parts</span><span id="joint-count"></span></div><div id="hierarchy"></div><div class="actor-actions">${button('duplicate','content_copy','Duplicate character')}${button('delete','delete','Remove character')}<span id="pack-note" class="caption"></span></div></aside>
<section class="viewport" aria-label="Scene viewport"><div class="viewport-bar"><div class="tool-palette">${button('select-tool','edit','Select and pose body parts','class="active"')}${button('drag-tool','pan_tool','Drag container')}${button('bones','skeleton','Show joints','class="active"')}${button('limits','tune','Show joint limits','class="active"')}</div><div class="tool-palette">${button('shake','gesture','Move and stop')}${button('reset','restart_alt','Reset preview')}<select id="motion-policy" aria-label="Motion preview"><option value="system">System motion</option><option value="full">Motion on</option><option value="reduced">Still preview</option></select></div></div><div id="stage" class="stage" tabindex="0" aria-label="Scene card. Drag empty card space to test motion; select a body part to pose it."><div id="art" class="art"></div></div><div class="viewport-bottom"><div class="demo-controls"><label>Action <select id="demo-action" aria-label="Demo action"></select></label><label>Emotion <select id="emotion" aria-label="Emotion"></select></label></div><span id="hint">Drag empty card space to test motion. Drag a body part to pose it.</span></div></section>
<aside class="sidebar right"><nav class="inspector-tabs"><button data-panel="pose" class="active">${icon('edit')}Pose</button><button data-panel="look">${icon('palette')}Look</button><button data-panel="motion">${icon('animation')}Motion</button><button data-panel="feel">${icon('gesture')}Feel</button><button data-panel="light">${icon('palette')}Light</button></nav><div id="inspector"></div></aside></main>
<section class="timeline"><div class="timeline-toolbar"><div class="tabs"><button id="timeline-tab" class="active">Timeline</button><button id="states-tab">States</button></div><div class="playback">${button('start','skip_previous','Jump to start')}${button('play','play_arrow','Play animation')}<select id="clip" aria-label="Animation clip"></select><span id="time" class="time-label"></span></div><div class="key-tools">${button('edit-keys','animation','Edit keys across tracks')}${button('add-key','add','Add keyframe','class="primary"')}${button('remove-key','delete','Remove keyframe')}<select id="easing" aria-label="Keyframe easing"><option value="smooth">Smooth</option><option value="linear">Linear</option><option value="step">Step</option></select></div></div><div id="timeline-content"></div></section>
<footer class="footer"><span id="status"></span><span id="motion-status"></span><span class="desktop-only">Posecraft · MIT</span></footer><div id="toast" class="toast hidden" role="status"></div>`;
function toast(message){$('toast').textContent=message;$('toast').classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.add('hidden'),5000);}
function persist(){try{localStorage.setItem(key,JSON.stringify(store.document));$('saved').textContent='Saved locally';}catch{toast('Storage full. Save project to keep your changes.');}}
function transact(commands,message){try{store.transact(commands);persist();rebuild();if(message)toast(message);}catch(e){toast(e.message);}}
function channel(){return pack()?.spatial||['x','y'].includes(poseChannel)?poseChannel:'rotation';}
function channelRange(){return editChannels[channel()]||rigJoint();}
function baseValue(){return overrides[joint+'.'+channel()]??sampleClip({...pack().clips[clip],loop:false},previewTime)[joint+'.'+channel()]??(channel()==='rotation'?rigJoint().rotation:channel()==='opacity'?1:0);}
function frame(){if(actor()&&tab==='timeline'&&!sceneSelection)controller.previewClip(selected,clip,previewTime,overrides);const value=controller.frame();if(value!==effectFrameSource||effectsTime!==effectFrameTime){effectFrameSource=value;effectFrameTime=effectsTime;effectFrame={...value,effectsTime};}return effectFrame;}
function mount(){pointers?.dispose();renderer=mountSVG($('art'),store.document,frame(),{bones:!sceneSelection&&!selectedProp&&bones,limits,selectedActor:selectedProp||sceneSelection?undefined:selected,selectedJoint:joint,physicsDebug:inspector==='feel',colliders,selectedProp});pointers=mountScenePointers($('art'),store.document,controller,{isEnabled:()=>!!sceneSelection,onInteract:()=>{playing=true;controller.play();}});}
function refresh(){renderer.update(frame());contactTools.update(frame(),$('art').querySelector('svg'),sceneTools.contactsActive());updateTime();if($('rotation')){$('rotation').value=baseValue();$('rotation-number').value=Math.round(baseValue()*(['bend','opacity'].includes(channel())?100:10))/(['bend','opacity'].includes(channel())?100:10);}}
function rebuild(){
 pointers?.dispose();controller?.dispose();if(sceneSelection&&sceneSelection.kind!=='behavior'&&!store.document[{group:'groups',actor:'actors',prop:'props',emitter:'emitters'}[sceneSelection.kind]]?.some(e=>e.id===sceneSelection.id))sceneSelection=null;if(!prop())selectedProp=null;if(!actor())selected=store.document.actors[0]?.id;
 if(pack()&&!pack().joints.some(j=>j.id===joint))joint=pack().joints[0].id;
 if(pack()&&!pack().clips[clip])clip=Object.keys(pack().clips)[0];
 if(pack())previewTime=Math.min(previewTime,pack().clips[clip].duration);
 controller=new (typeof Worker==='undefined'?SceneController:WorkerSceneController)(store.document,{reducedMotion:reduced()});controller.subscribe(e=>{sound.handle(e);if(e.type==='error')toast(e.message);});
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
 drawProps();drawSceneSidebar();
 $('actors').innerHTML=store.document.actors.map(a=>`<option value="${a.id}" ${a.id===selected?'selected':''}>${esc(a.name)}</option>`).join('');
 $('hierarchy').innerHTML=(pack()?.joints||[]).map(j=>`<button class="joint-row ${joint===j.id?'active':''}" data-select-joint="${j.id}">${icon(j.parent?'link':'skeleton')}<span>${title(j.id)}</span><small>${j.min}°…${j.max}°</small></button>`).join('');
 $('hierarchy').style.setProperty('--joint-count',pack()?.joints.length||1);
 $('hierarchy').querySelectorAll('[data-select-joint]').forEach(b=>b.onclick=()=>selectJoint(selected,b.dataset.selectJoint));
 $('joint-count').textContent=pack()?`${pack().joints.length} joints`:'';$('pack-note').textContent=actor()?`${store.document.actors.length} in scene`:'';
}
function selectJoint(actorId,jointId){controller.play();sceneSelection=null;sidebarView='character';selectedProp=null;if(selected!==actorId){controller.clearPreview(selected);overrides={};}selected=actorId;joint=jointId;if(!pack().clips[clip])clip=Object.keys(pack().clips)[0];previewTime=Math.min(previewTime,pack().clips[clip].duration);inspector='pose';drawHierarchy();drawInspector();drawTimeline();drawDemo();mount();}
function field(label,id,value,attrs=''){return `<label class="field">${label}<input id="${id}" value="${esc(value)}" ${attrs}></label>`;}
function drawInspector(){
 $('inspector').classList.toggle('scene-inspector',!!sceneSelection);document.querySelector('.inspector-tabs').classList.toggle('hidden',!!sceneSelection);if(sceneSelection){$('inspector').classList.remove('spatial-panel','feel-panel');sceneTools.inspector($('inspector'));return;}
 $('inspector').classList.toggle('spatial-panel',!!pack()?.spatial&&inspector==='pose');
 $('inspector').classList.toggle('feel-panel',inspector==='feel'||inspector==='light'||!!selectedProp);
 if(prop()){drawPropInspector();return;}
 document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b.dataset.panel===inspector));
 if(inspector==='light'){drawLighting();return;}
 const a=actor(),p=pack(),j=rigJoint();if(!a){$('inspector').innerHTML='<p class="note">Add a character from the library.</p>';return;}
 const index=store.document.actors.indexOf(a);
 if(inspector==='pose'){
 const range=channelRange();
 $('inspector').innerHTML=`<div class="inspector-heading"><span>${title(joint)}</span><small>${esc(a.name)}</small></div><div class="selected-part">${icon('skeleton')} ${j.parent?`Attached to ${title(j.parent)}`:'Root of character'}</div>${`<label class="field">Pose channel<select id="pose-channel" aria-label="Pose channel">${[['rotation','Rotation in screen'],['x','Position X'],['y','Position Y'],...p.spatial?[['yaw','Yaw / turn toward camera'],['pitch','Pitch / tilt'],['z','Depth / front and back'],['bend','Shape / bend'],['opacity','Opacity']]:[]].map(([id,label])=>`<option value="${id}" ${channel()===id?'selected':''}>${label}</option>`).join('')}</select></label>`}<label class="field">${channel()==='rotation'?'Rotation':title(channel())}<div class="rotation-controls"><input id="rotation" type="range" min="${range.min}" max="${range.max}" step="${['bend','opacity'].includes(channel())?.01:1}" value="${baseValue()}"><input id="rotation-number" aria-label="Joint rotation degrees" type="number" min="${range.min}" max="${range.max}" value="${baseValue()}" step="${['bend','opacity'].includes(channel())?.01:1}"></div></label><div class="section-label">Joint limits</div><div class="two-col">${field('Minimum','limit-min',j.min,'type="number" min="-180" max="180"')}${field('Maximum','limit-max',j.max,'type="number" min="-180" max="180"')}</div><p class="note">${p.spatial?'Use the channel slider, then + to key it. Yaw and Pitch rotate in depth. Depth changes overlap. Shape blends authored artwork.':'Drag this body part on the canvas. The arc shows its allowed rotation. New limits also clamp its existing keys.'}</p><div class="section-label">Pivot / rest position</div><div class="two-col">${field('X','pivot-x',j.x,'type="number" step="1"')}${field('Y','pivot-y',j.y,'type="number" step="1"')}</div><div class="section-label">Character placement</div><div class="two-col">${field('X','pos-x',a.transform.x,'type="number"')}${field('Y','pos-y',a.transform.y,'type="number"')}${field('Scale','scale',a.transform.scale,'type="number" min=".05" max="10" step=".1"')}${field('Turn','turn',a.transform.rotation,'type="number" min="-180" max="180"')}</div>`;
 if($('pose-channel'))$('pose-channel').onchange=e=>{poseChannel=e.target.value;drawInspector();drawTimeline();refresh();};
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

function drawLighting(){
 const l=lightingConfig(store.document),select=(key,label,options)=>`<label class="field">${label}<select data-light-select="${key}" id="lighting-${key}">${options.map(([value,name])=>`<option value="${value}" ${l[key]===value?'selected':''}>${name}</option>`).join('')}</select></label>`,sliders=items=>`<div class="light-grid">${items.map(([key,label,min,max,step])=>`<label class="field">${label} <output>${l[key]}</output><input data-light-field="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${l[key]}"></label>`).join('')}</div>`;
 const surface=select('shading','Character shading',[['gradient','Soft gradient'],['cel','Sharp / cel']])+`<div class="two-col">${field('Key color','lighting-color',l.color,'type="color"')}${field('Shadow color','lighting-shadowColor',l.shadowColor,'type="color"')}</div>`+sliders([['celThickness','Cel coverage',0,1,.05],['celIntensity','Cel intensity',0,1,.05],['intensity','Light strength',0,2,.05],['ambient','Ambient',0,1,.05],['gloss','Highlights',0,1,.05]]);
 const source=select('type','Light source',[['directional','Directional'],['point','Point light']])+select('motion','Motion',[['none','Still'],['orbit','Moving orbit'],['flicker','Fire flicker']])+(l.type==='point'?`<div class="two-col">${field('Position X','lighting-pointX',l.pointX,'type="number" min="-4096" max="8192"')}${field('Position Y','lighting-pointY',l.pointY,'type="number" min="-4096" max="8192"')}</div>`+sliders([['pointHeight','Height',20,1000,10],['range','Reach',50,2000,25],['motionRadius','Orbit size',0,500,10],['motionSpeed','Speed',.05,5,.05],['flicker','Flicker',0,1,.05]]):sliders([['angle','Direction',-180,180,1],['elevation','Height',10,85,1]]));
 const shadows=select('receiver','Shadow receivers',[['corner','Connected floor and wall'],['floor','Floor only / outdoors']])+sliders([['shadowLength','Shadow length',0,3,.05],['softness','Softness',0,16,1],['floorShadow','Floor shadow',0,1,.05],['wallShadow','Wall shadow',0,1,.05],['reflection','Reflection',0,.8,.05]])+`<div class="two-col">${field('Floor line','lighting-floorY',l.floorY,'type="number" min="0" max="4096"')}${field(l.receiver==='floor'?'Ground edge':'Wall corner','lighting-wallY',l.wallY,'type="number" min="0" max="4096"')}</div>`;
 $('inspector').innerHTML=`<div class="inspector-heading">Scene lighting</div><label class="face-auto"><input id="lighting-enabled" type="checkbox" ${l.enabled?'checked':''}>Enable lighting</label><nav class="prop-tabs">${['surface','source','shadows'].map(id=>`<button data-light-tab="${id}" class="${lightPanel===id?'active':''}">${title(id)}</button>`).join('')}</nav>${lightPanel==='source'?source:lightPanel==='shadows'?shadows:surface}<p class="note">${lightPanel==='source'?'Point lights shade each character from their position. Motion uses scene time and pauses with playback.':lightPanel==='shadows'?'Floor shadows bend up the wall only when they reach the corner. Use Floor only outdoors.':'Cel coverage changes the shadow area. Cel intensity changes its contrast. Floor shadow softness is separate.'}</p>`;
 const change=(key,value)=>{if(lightingConfig(store.document)[key]===value)return;try{store.transact([set(['lighting'],{...lightingConfig(store.document),[key]:value})]);persist();mount();$('undo').disabled=!store.past.length;$('redo').disabled=!store.future.length;}catch(e){toast(e.message);drawLighting();}};
 $('lighting-enabled').onchange=e=>change('enabled',e.target.checked);
 $('inspector').querySelectorAll('[data-light-tab]').forEach(b=>b.onclick=()=>{lightPanel=b.dataset.lightTab;drawLighting();});
 $('inspector').querySelectorAll('[data-light-select]').forEach(input=>input.onchange=()=>{change(input.dataset.lightSelect,input.value);drawLighting();});
 if(l.emitter){for(const id of ['lighting-pointX','lighting-pointY','lighting-motion'])if($(id))$(id).disabled=true;if(lightPanel==='source')$('inspector').insertAdjacentHTML('beforeend','<p class="note">Position and flicker follow the linked effect. Edit its placement and frequency in Scene.</p>');}
 for(const key of ['color','shadowColor','floorY','wallY','pointX','pointY'])if($('lighting-'+key))$('lighting-'+key).onchange=e=>{change(key,['color','shadowColor'].includes(key)?e.target.value:+e.target.value);drawLighting();};
 $('inspector').querySelectorAll('[data-light-field]').forEach(input=>{input.oninput=()=>input.previousElementSibling.value=input.value;input.onchange=()=>{change(input.dataset.lightField,+input.value);drawLighting();};});
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
 $('inspector').innerHTML=`<div class="inspector-heading">Reactions<small id="face-live"></small></div><label class="field">Body mode<select id="body-mode" aria-label="Body mode"><option value="animated">Animated</option><option value="floating" ${!hasPhysics?'disabled':''}>Floating ragdoll</option><option value="ragdoll" ${!hasPhysics?'disabled':''}>Falling ragdoll</option><option value="protective" ${!hasPhysics?'disabled':''}>Protective</option></select></label><label class="field">Resistance / muscle strength<input id="resistance" aria-label="Muscle strength" type="range" min="0" max="1" step=".05" value="${b.resistance}"></label><label class="field">Protective response<select id="strategy" aria-label="Protective response"><option value="auto">Automatic</option><option value="protect">Cover head</option><option value="curl">Curl / hold self</option><option value="brace">Break fall</option></select></label><div class="two-col">${field('Gravity','gravity',b.gravity,'type="number" min="0" max="2" step=".1"')}${field('Bounce','bounce',b.bounce,'type="number" min="0" max="1" step=".05"')}</div><label class="face-auto"><input id="auto-face" type="checkbox" ${b.autoFace?'checked':''}> Automatic facial responses</label><label class="face-auto"><input id="auto-recover" type="checkbox" ${b.autoRecover?'checked':''}> Stand up &amp; return</label><div class="sound-controls"><button id="sound-toggle" aria-label="${sound.enabled?'Mute sound':'Enable sound'}">${icon('play_arrow')}${sound.enabled?'Sound on':'Sound off'}</button><input id="sound-volume" aria-label="Sound volume" type="range" min="0" max="1" step=".05" value="${sound.volume}"></div><div class="section-label">Try an interaction</div><div class="interaction-grid">${[['pet','Pet'],['tap','Poke'],['startle','Startle'],['drop','Drop'],['toss','Toss'],['hurt','Hurt'],['catch','Catch']].map(([id,label])=>`<button data-interact="${id}">${label}</button>`).join('')}</div><div id="response-status" class="response-status" role="status">Calm</div><p class="note">Stand up & return uses assisted animation on clear, supported ground. Floating stays weightless. Collision shapes approximate the artwork.</p>`;
 $('body-mode').value=b.mode;$('strategy').value=b.strategy;$('gravity').disabled=b.mode==='floating';
 for(const prop of ['mode','strategy','resistance','gravity','bounce'])$(prop==='mode'?'body-mode':prop).onchange=e=>changeBehavior({[prop]:['mode','strategy'].includes(prop)?e.target.value:+e.target.value});
 $('auto-recover').onchange=e=>changeBehavior({autoRecover:e.target.checked});
 $('auto-face').onchange=e=>changeBehavior({autoFace:e.target.checked});
 $('sound-toggle').onclick=async()=>{if(sound.enabled)sound.mute();else if(await sound.unlock())sound.handle({type:'interaction',interaction:'pet'});else toast('Sound could not start in this browser.');drawFeel();};
 $('sound-volume').oninput=e=>sound.setVolume(+e.target.value);
 $('inspector').querySelectorAll('[data-interact]').forEach(b=>b.onclick=()=>runInteraction(b.dataset.interact));
}

function pose(value){if(behaviorConfig(actor().behavior).mode!=='animated'){toast('Choose Animated in Feel to edit keyframes.');return;}if(!Number.isFinite(value))return;playing=false;tab='timeline';overrides[joint+'.'+channel()]=clamp(value,channelRange().min,channelRange().max);refresh();}
function changeLimits(){const p=pack(),j=rigJoint(),min=Number($('limit-min').value),max=Number($('limit-max').value);if(!Number.isFinite(min)||!Number.isFinite(max)||min>max||min<-180||max>180){toast('Limits must be ordered between -180° and 180°.');drawInspector();return;}
 const joints=structuredClone(p.joints),clips=structuredClone(p.clips);Object.assign(joints[p.joints.indexOf(j)],{min,max,rotation:clamp(j.rotation,min,max)});
 let count=0;for(const c of Object.values(clips))for(const pair of c.tracks[joint+'.rotation']||[]){const v=clamp(pair[1],min,max);if(v!==pair[1])count++;pair[1]=v;}
 const commands=[set(['packs',actor().pack,'joints'],joints),set(['packs',actor().pack,'clips'],clips)];if(p.physics){const responses=structuredClone(p.physics.responses);for(const pose of Object.values(responses))if(pose[joint+'.rotation']!==undefined)pose[joint+'.rotation']=clamp(pose[joint+'.rotation'],min,max);commands.push(set(['packs',actor().pack,'physics','responses'],responses));}overrides={};transact(commands,count?`Updated limits and clamped ${count} keys. Undo restores both.`:'Joint limits updated.');
}
function drawDemo(){const p=pack();$('demo-action').innerHTML=Object.keys(p?.clips||{}).map(id=>`<option value="${id}" ${id===clip?'selected':''}>${title(id)}</option>`).join('');$('emotion').innerHTML=(p?.inputs.emotion?.options||['neutral']).map(id=>`<option value="${esc(id)}" ${id===inputValue('emotion')?'selected':''}>${esc(title(id))}</option>`).join('');$('emotion').disabled=!p?.inputs.emotion;}
function changeInput(name,value){if(!actor())return;const index=store.document.actors.indexOf(actor());transact([set(['actors',index,'inputs'],{...actor().inputs,[name]:value})]);}
function chooseAction(id){clip=id;previewTime=0;overrides={};playing=!reduced();transitionIndex=0;if(pack().inputs.action)changeInput('action',id);else{drawTimeline();drawDemo();mount();}}
function drawTimeline(){
 document.querySelector('.timeline').classList.toggle('scene-timeline',!!sceneSelection);if(sceneSelection){sceneTools.bottom($('timeline-content'));return;}
 const p=pack(),c=p?.clips[clip];$('clip').innerHTML=Object.keys(p?.clips||{}).map(id=>`<option value="${id}" ${id===clip?'selected':''}>${title(id)}</option>`).join('');
 $('edit-keys').disabled=$('add-key').disabled=$('remove-key').disabled=!c;
 $('timeline-tab').classList.toggle('active',tab==='timeline');$('states-tab').classList.toggle('active',tab==='states');
 if(!c){$('timeline-content').innerHTML='<p class="note">Add a character to begin.</p>';return;}
 if(tab==='states'){
 const stateId=Object.keys(p.states).find(id=>p.states[id].clip===clip)||p.initial,transitions=p.states[stateId].transitions||[];transitionIndex=Math.min(transitionIndex,Math.max(0,transitions.length-1));const t=transitions[transitionIndex];
 $('timeline-content').innerHTML=`<div class="state-editor"><div class="state-node">${esc(stateId)}</div>${icon('link')}${t?`<select id="transition" aria-label="Transition">${transitions.map((t,i)=>`<option value="${i}" ${i===transitionIndex?'selected':''}>${esc(t.to)}</option>`).join('')}</select><span class="caption" id="condition">${esc(t.when.input)} = ${esc(t.when.equals)}</span><label>Blend <input id="blend" aria-label="Transition blend seconds" type="number" min="0" max="2" step=".05" value="${t.duration}"> s</label>`:'<span class="note">No outgoing transitions.</span>'}<span id="active-state" class="caption"></span></div>`;
 if(t){$('transition').onchange=e=>{transitionIndex=+e.target.value;drawTimeline();};$('blend').onchange=e=>transact([set(['packs',actor().pack,'states',stateId,'transitions',transitionIndex,'duration'],Number(e.target.value))]);}
 }else{
 const track=c.tracks[joint+'.'+channel()]||[];
 $('timeline-content').innerHTML=`<div class="timeline-body"><div class="track-label">${title(joint)}<small>${title(channel())} · ${channel()==='z'?'scene units':channel()==='bend'?'0 to 1':'degrees'}</small></div><div class="track-area"><div class="ruler">${[0,.25,.5,.75,1].map(t=>`<span>${(t*c.duration).toFixed(2)} s</span>`).join('')}</div><div class="key-lane">${track.map(([t,v])=>`<button class="key ${Math.abs(t-previewTime)<.011?'selected':''}" data-time="${t}" style="left:${t/c.duration*100}%" title="${t}s · ${v} ${channel()==='bend'?'':channel()==='z'?'layer units':'degrees'}" aria-label="Key at ${t} seconds, ${v} ${channel()}"></button>`).join('')}<i id="playhead" style="left:${previewTime/c.duration*100}%"></i></div><input id="scrub" class="scrubber" type="range" aria-label="Timeline position" min="0" max="${c.duration}" step=".01" value="${previewTime}"></div><label class="key-time">Time<input id="key-time" type="number" min="0" max="${c.duration}" step=".01" value="${previewTime.toFixed(2)}" aria-label="Playhead time seconds"></label></div>`;
 $('scrub').oninput=e=>seek(+e.target.value);$('key-time').onchange=e=>seek(+e.target.value);
 $('timeline-content').querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>seek(+b.dataset.time));
 }
 updateTime();
}
function seek(time){if(!Number.isFinite(time))return;previewTime=clamp(time,0,pack().clips[clip].duration);playing=false;overrides={};refresh();drawTimeline();}
function updateTime(){const duration=pack()?.clips[clip]?.duration||0;$('play').innerHTML=icon(playing?'pause':'play_arrow');$('play').setAttribute('aria-label',playing?'Pause animation':'Play animation');$('play').title=playing?'Pause animation':'Play animation';$('time').textContent=`${previewTime.toFixed(2)} / ${duration.toFixed(2)} s`;if($('scrub'))$('scrub').value=previewTime;if($('playhead'))$('playhead').style.left=`${duration?previewTime/duration*100:0}%`;if($('key-time')&&document.activeElement!==$('key-time'))$('key-time').value=previewTime.toFixed(2);}
function addKey(){
 const p=pack(),c=p?.clips[clip];if(!c)return;
 const tracks=structuredClone(c.tracks),values={...overrides,[joint+'.'+channel()]:baseValue()};
 for(const [name,value] of Object.entries(values)){
  const spec=editChannels[name.split('.')[1]]||p.joints.find(j=>name===j.id+'.rotation');
  tracks[name]=[...(tracks[name]||[]).filter(([t])=>Math.abs(t-previewTime)>.001),[Number(previewTime.toFixed(3)),clamp(value,spec.min,spec.max),$('easing').value]].sort((a,b)=>a[0]-b[0]);
 }
 overrides={};transact([set(['packs',actor().pack,'clips',clip,'tracks'],tracks)],Object.keys(values).length>1?'Keyframes saved for all posed joints.':'Keyframe saved.');
}
function removeKey(){if(!pack())return;const tracks=structuredClone(pack().clips[clip].tracks),name=joint+'.'+channel();const keys=(tracks[name]||[]).filter(([t])=>Math.abs(t-previewTime)>.011);if(keys.length)tracks[name]=keys;else delete tracks[name];overrides={};transact([set(['packs',actor().pack,'clips',clip,'tracks'],tracks)]);}
function addActor(id,duplicate=false){sceneSelection=null;sidebarView='character';selectedProp=null;const source=library[id];if(!source&&!duplicate)return;const a=duplicate?structuredClone(actor()):structuredClone(source.actors[0]);const packId=duplicate?a.pack:id;const commands=[];if(!store.document.packs[packId])commands.push(set(['packs',packId],structuredClone(source.packs[id])));a.id=`${packId}-${Date.now().toString(36)}`;if(duplicate)a.name=(a.name+' copy').slice(0,100);a.transform.x=clamp(a.transform.x+(store.document.actors.length%2?90:-90),80,store.document.bounds.width-80);selected=a.id;joint=packId==='rusty'?'head':'head';clip='idle';previewTime=0;overrides={};commands.push(set(['actors'],[...store.document.actors,a]));transact(commands);}
function download(name,content,type='application/json'){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function reset(){effectsTime=0;offset={x:0,y:0};scenario=null;drag=null;$('stage').style.transform='';previewTime=0;overrides={};playing=false;rebuild();}
function shake(){if(reduced()){toast('Still preview is active. Choose Motion on to preview reactions.');return;}scenario={start:performance.now(),origin:{...offset}};}
function load(doc){sceneSelection=doc.emitters?.length?{kind:'emitter',id:(doc.emitters.find(e=>e.type==='flame')||doc.emitters[0]).id}:null;sidebarView=doc.emitters?.length||doc.ensemble?.type==='campfire'?'scene':'character';effectsTime=0;selectedProp=null;const next=new DocumentStore(doc);store=next;selected=(next.document.actors.find(a=>!a.layer||a.layer==='characters')||next.document.actors[0])?.id;joint='head';clip=inputValue('action')||pack()?.states[pack()?.initial]?.clip||'idle';previewTime=0;overrides={};offset={x:0,y:0};$('stage').style.transform='';persist();rebuild();}
const contactTools=createContactTools({getDocument:()=>store.document,getFrame:()=>frame(),commit:commands=>{const t=controller.frame().time;playing=false;transact(commands);controller.pause();controller.seek(t);refresh();}});
const behaviorTools=createBehaviorTools({getDocument:()=>store.document,commit:transact,getController:()=>controller,play:()=>{playing=true;controller.play();},notify:toast});
const sceneTools=createSceneTools({behaviors:behaviorTools,contacts:contactTools,getDocument:()=>store.document,getSelection:()=>sceneSelection,select:selectSceneItem,commit:transact,editEntity:s=>{sceneSelection=null;sidebarView='character';if(s.kind==='actor'){selected=s.id;selectJoint(s.id,pack().joints[0].id);}else selectProp(s.id);drawSceneSidebar();drawTimeline();},play:()=>{playing=true;controller.play();},pause:()=>{playing=false;controller.pause();},isPlaying:()=>playing&&!reduced(),getTime:()=>effectsTime,setTime:t=>{effectsTime=t;refresh();},getSceneTime:()=>controller?.frame().time||0,setSceneTime:t=>{effectsTime=t;controller.seek(t);refresh();}});
function drawSceneSidebar(){document.querySelector('.sidebar.left').classList.toggle('scene-mode',sidebarView==='scene');$('scene-workspace').classList.toggle('active',sidebarView==='scene');$('character-workspace').classList.toggle('active',sidebarView==='character');sceneTools.tree($('scene-tree'));}
function selectSceneItem(s){controller?.clearPreview(selected);sceneSelection=s;selectedProp=null;sidebarView='scene';overrides={};if(s.kind==='actor'){selected=s.id;if(pack()&&!pack().clips[clip])clip=Object.keys(pack().clips)[0];if(pack()&&!pack().joints.some(j=>j.id===joint))joint=pack().joints[0].id;}drawHierarchy();drawInspector();drawTimeline();mount();}
$('scene-workspace').onclick=()=>{const item=sceneSelection||(store.document.groups?.length?{kind:'group',id:store.document.groups[0].id}:actor()?{kind:'actor',id:actor().id}:null);if(item)selectSceneItem(item);else{sidebarView='scene';drawSceneSidebar();}};$('character-workspace').onclick=()=>{controller.play();sceneSelection=null;sidebarView='character';drawHierarchy();drawInspector();drawTimeline();mount();};
const timelineTools=createTimelineTools({
 getContext:()=>actor()?({packId:actor().pack,clipId:clip,clip:pack().clips[clip],name:actor().name,canUndo:!!store.past.length,canRedo:!!store.future.length}):null,
 commit:next=>{store.transact([set(['packs',actor().pack,'clips',clip],next)]);overrides={};playing=false;persist();rebuild();},
 seek:(time,track)=>{const split=track.lastIndexOf('.');joint=track.slice(0,split);poseChannel=editChannels[track.slice(split+1)]?track.slice(split+1):'rotation';drawHierarchy();drawInspector();seek(time);mount();},
 undo:()=>{$('undo').click();},redo:()=>{$('redo').click();}
});
$('edit-keys').onclick=()=>{playing=false;tab='timeline';drawTimeline();timelineTools.open();};
$('actors').onchange=e=>{sceneSelection=null;selectedProp=null;selected=e.target.value;clip=inputValue('action')||'idle';overrides={};previewTime=0;rebuild();};
$('clip').onchange=$('demo-action').onchange=e=>chooseAction(e.target.value);$('emotion').onchange=e=>{changeBehavior({autoFace:false});changeInput('emotion',e.target.value);};
$('play').onclick=()=>{playing=!playing;overrides={};last=null;updateTime();};$('start').onclick=()=>seek(0);$('add-key').onclick=addKey;$('remove-key').onclick=removeKey;
$('undo').onclick=()=>{store.undo();overrides={};persist();rebuild();};$('redo').onclick=()=>{store.redo();overrides={};persist();rebuild();};
$('duplicate').onclick=()=>addActor(actor().pack,true);$('delete').onclick=()=>{const next=removeSceneEntity(store.document,'actor',selected);transact(['actors','emitters','lighting','ensemble','contacts','behaviorGraph','interactions'].filter(k=>next[k]!==undefined||store.document[k]!==undefined).map(k=>next[k]===undefined?{op:'delete',path:[k]}:set([k],next[k])));};
$('save').onclick=$('export').onclick=()=>download(store.document.id+'.posecraft.json',JSON.stringify(store.document,null,2));
$('svg-export').onclick=()=>download(store.document.id+'.svg',renderSVG(store.document,frame()),'image/svg+xml');
$('import').onclick=()=>$('file').click();$('file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5000000)throw new Error('Scene exceeds 5 MB.');load(JSON.parse(await f.text()));toast('Project opened.');}catch(error){toast('Could not open scene. '+error.message);}e.target.value='';};
$('upgrade-rig').onclick=()=>{const p=pack(),type=['ona','dummy'].find(id=>library[id].packs[id].provenance?.source===p?.provenance?.source);if(!type||p.spatial){toast('This character already has a depth rig, or uses custom artwork.');return;}const next=addSpatialRig(structuredClone(p),type,{studies:false});if(type==='ona')addOnaArmJoints(next);transact([set(['packs',actor().pack],next),set(['requiredFeatures'],[...new Set([...(store.document.requiredFeatures||[]),'spatial-rig','hair-shell'])])],'Depth artwork added. Your existing clips remain editable; Undo restores the earlier rig.');};
$('reload-demo').onclick=()=>{if(!demo)return;download(store.document.id+'-before-demo-reload.json',JSON.stringify(store.document,null,2));load(createDemo(demo.id));toast('Current demo loaded. Previous draft downloaded as a backup.');};
$('website-export').onclick=()=>behaviorTools.exportWebsite();
$('convert-campfire').onclick=()=>{try{const next=convertCampfireEffects(store.document);transact(['packs','actors','groups','emitters','lighting','requiredFeatures'].map(k=>set([k],next[k])),'Campfire effects converted. Undo restores the previous draft.');sidebarView='scene';if(store.document.emitters?.length)selectSceneItem({kind:'emitter',id:(store.document.emitters.find(e=>e.type==='flame')||store.document.emitters[0]).id});else drawSceneSidebar();}catch(e){toast(e.message);}};
$('new').onclick=()=>{download(store.document.id+'-backup.json',JSON.stringify(store.document,null,2));load(starter);toast('Previous project downloaded as a backup.');};
$('legacy').onclick=()=>{try{const old=localStorage.getItem('posecraft.studio.v1');if(!old)return toast('No previous studio draft on this device.');download('current-scene-backup.json',JSON.stringify(store.document,null,2));load(JSON.parse(old));}catch(e){toast(e.message);}};
$('reset').onclick=reset;$('shake').onclick=shake;
$('bones').onclick=()=>{bones=!bones;$('bones').classList.toggle('active',bones);mount();};$('limits').onclick=()=>{limits=!limits;bones=true;$('limits').classList.toggle('active',limits);$('bones').classList.add('active');mount();};
$('select-tool').onclick=()=>{dragMode=false;$('select-tool').classList.add('active');$('drag-tool').classList.remove('active');};$('drag-tool').onclick=()=>{dragMode=true;$('select-tool').classList.remove('active');$('drag-tool').classList.add('active');};
$('motion-policy').onchange=e=>{motionMode=e.target.value;controller.reducedMotion=reduced();controller.rebaseline();if(reduced())playing=false;refresh();};
for(const b of document.querySelectorAll('[data-panel]'))b.onclick=()=>{sceneSelection=null;selectedProp=null;drawProps();inspector=b.dataset.panel;drawInspector();mount();};
for(const t of ['timeline','states'])$(t+'-tab').onclick=()=>{tab=t;overrides={};if(t==='states')controller.clearPreview(selected);drawTimeline();};
$('scene-panel').onclick=()=>{document.querySelector('.workspace').classList.toggle('show-scene');document.querySelector('.workspace').classList.remove('show-inspector');};$('inspector-panel').onclick=()=>{document.querySelector('.workspace').classList.toggle('show-inspector');document.querySelector('.workspace').classList.remove('show-scene');};
function drawProps(){
 $('props').innerHTML='<option value="">Props</option>'+(store.document.props||[]).map(p=>`<option value="${p.id}" ${p.id===selectedProp?'selected':''}>${esc(p.name)}</option>`).join('');
}
function selectProp(id){sceneSelection=null;selectedProp=id||null;drawProps();drawInspector();drawTimeline();mount();}
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
$('add-prop').onclick=()=>{sceneSelection=null;const {width:w,height:h}=store.document.bounds,id='prop-'+Date.now().toString(36),width=Math.min(220,w*.65),height=20;selectedProp=id;propPanel='shape';transact([set(['props'],[...(store.document.props||[]),{id,name:'Platform',x:w/2,y:h-15,width,height,rotation:0,fill:'#b9c8c2',collider:{enabled:true,width,height,x:0,y:0,friction:.75,bounce:.1}}])]);};
$('show-colliders').onclick=()=>{colliders=!colliders;$('show-colliders').classList.toggle('active',colliders);mount();};
function localPoint(actorId,x,y){const g=$('art').querySelector(`[data-actor="${actorId}"]`);return new DOMPoint(x,y).matrixTransform(g.getScreenCTM().inverse());}
$('stage').onpointerdown=e=>{
 if(e.button!==0)return;scenario=null;const effectHit=e.target.closest('[data-emitter]');if(!dragMode&&effectHit){selectSceneItem({kind:'emitter',id:effectHit.dataset.emitter});return;}
 const propHit=e.target.closest('[data-prop]');if(!dragMode&&propHit){selectProp(propHit.dataset.prop);const p=scenePoint(e.clientX,e.clientY);drag={type:'prop',start:p,origin:{x:prop().x,y:prop().y},next:null};$('stage').setPointerCapture(e.pointerId);return;}
 const hit=e.target.closest('[data-joint],[data-bone]'),a=e.target.closest('[data-actor]');
 if(!dragMode&&hit&&a&&behaviorConfig(store.document.actors.find(v=>v.id===a.dataset.actor)?.behavior).mode!=='animated'){selectedProp=null;selected=a.dataset.actor;inspector='feel';drawHierarchy();drawInspector();mount();runInteraction('tap');drag=null;return;}
 if(!dragMode&&hit&&a){const id=hit.dataset.joint||hit.dataset.bone;selectJoint(a.dataset.actor,id);playing=false;if(channel()!=='rotation'){toast('Use the channel slider to adjust this value.');return;}const evaluated=frame().actors.find(a=>a.id===selected),w=pack().spatial?spatialKinematics(pack(),evaluated.pose)[id]:evaluated.world[id],p=localPoint(selected,e.clientX,e.clientY);drag={type:'pose',x:e.clientX,y:e.clientY,pivot:w,angle:Math.atan2(p.y-w.y,p.x-w.x),rotation:baseValue()};}
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
 if(!document.hidden&&controller.stats?.execution!=='failed'){
 if(scenario){const t=(now-scenario.start)/1000;offset={x:scenario.origin.x+Math.sin(Math.min(t/.9,1)*Math.PI*2)*95,y:scenario.origin.y-Math.sin(Math.min(t/.9,1)*Math.PI)*25};$('stage').style.transform=`translate(${offset.x}px,${offset.y}px)`;if(t>.9)scenario=null;}
 if(playing&&!reduced())effectsTime+=dt;controller.animationPlaying=sceneSelection?playing:tab==='timeline'||playing;controller.sampleHost({...offset,time:now/1000});controller.step(drag?.type==='prop'?0:dt);
 if(playing&&!reduced()&&pack()&&!sceneSelection){if(tab==='timeline')previewTime=(previewTime+dt)%pack().clips[clip].duration;else{const r=selectedRuntime();previewTime=r.runtime.layers[0].time%pack().clips[pack().states[r.runtime.layers[0].state].clip].duration;}}
 renderer.update(frame());updateTime();if(playing&&$('rotation')&&document.activeElement!==$('rotation-number')){$('rotation').value=baseValue();$('rotation-number').value=Math.round(baseValue()*(['bend','opacity'].includes(channel())?100:10))/(['bend','opacity'].includes(channel())?100:10);}
 const s=selectedRuntime()?.spring;
 behaviorTools.update(controller.frame());
 $('status').textContent=sceneSelection?`Scene · ${store.document.groups?.length||0} folders · ${store.document.emitters?.length||0} effects`:`${store.document.actors.length} character${store.document.actors.length===1?'':'s'} · ${controller.stats?'Worker '+controller.stats.computeMs.toFixed(1)+' ms':'Main thread'} · ${title(joint)} · ${title(selectedRuntime()?.response.state||'calm')}${Object.keys(overrides).length?' · Unsaved pose, add a key':''}`;
 if($('scene-time')&&document.activeElement!==$('scene-time'))$('scene-time').value=Math.min(+$('scene-time').max,controller.frame().time);
 if($('effect-time')&&document.activeElement!==$('effect-time'))$('effect-time').value=Math.min(60,effectsTime);
 $('motion-status').textContent=reduced()?'Still preview · motion disabled':`Lean ${Math.abs(s?.x||0).toFixed(1)}° · ${drag?.type==='card'?'Dragging':'Motion on'}`;
 $('hint').textContent=sceneSelection?'Scene items use folders, layers and effect settings.':reduced()?'Still preview is active. Choose Motion on to test reactions.':dragMode?'Drag anywhere on the card. Watch the character lean and settle.':selectedProp?'Drag this prop to place it. Orange outline = collision box.':'Drag empty card space to test motion. Drag a body part to pose it.';
 if($('active-state'))$('active-state').textContent='Action: '+(selectedRuntime()?.runtime.layers[0].state||'')+' · Response: '+(selectedRuntime()?.response.state||'calm');
 if($('response-status')){const a=selectedRuntime(),d=a?.physics?.diagnostics;$('response-status').textContent=`${title(a?.response.state||'calm')} · ${d?.contacts?.length||0} contacts${d?.predictedImpact?' · impact predicted':''}`;}
 if($('face-live'))$('face-live').textContent='Face: '+title(frame().actors.find(a=>a.id===selected)?.inputs.emotion||'neutral');
 if($('motion-readout'))$('motion-readout').textContent=`Horizontal acceleration ${Math.round(controller.motion.ax)} px/s² · lean ${(s?.x||0).toFixed(1)}°`;
 }
 requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
