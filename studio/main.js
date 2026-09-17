import './style.css';
import starter from '../examples/ona.posecraft.json';
import { DocumentStore } from '../src/commands.js';
import { SceneController } from '../src/scene.js';
import { mountSVG, renderSVG } from '../src/svg.js';

const $ = id => document.getElementById(id);
const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key = 'posecraft.studio.v1';
let recoveryError = '';
let initial = starter;
try { const saved = localStorage.getItem(key); if (saved) initial = new DocumentStore(JSON.parse(saved)).document; } catch { recoveryError = 'Saved draft could not be opened. The original remains in browser storage until your next edit.'; }
let store = new DocumentStore(initial), selected = initial.actors[0]?.id, joint = 'rightArm', clip = 'idle', controller, renderer, playing = false, tab = 'timeline', bones = false, greeting = false;
const media = matchMedia('(prefers-reduced-motion: reduce)');
let previewTime = 0, offset = { x: 0, y: 0 }, scenario = null, last = null, toastTimer;
document.querySelector('#app').innerHTML = `
<header class="topbar"><a class="brand" href="./"><span class="brand-mark">p</span>posecraft<small>Animation studio</small></a><div class="top-actions"><a href="./react-demo.html" target="_blank">Try in React ↗</a><button id="import">Open</button><button id="save">Save project</button><button id="export" class="primary">Export scene ↗</button><input id="file" class="hidden" type="file" accept=".json,application/json"></div></header>
<div class="titlebar"><div><h1 id="project-title"></h1><span class="caption">An open home for characters in motion</span></div><div class="playback"><button id="undo" class="flat" aria-label="Undo">↶</button><button id="redo" class="flat" aria-label="Redo">↷</button><span class="caption" id="saved">Local draft</span></div></div>
<main class="workspace"><aside class="sidebar left"><div class="section-label">Scene <button id="add" aria-label="Add Ona">+</button></div><div id="hierarchy"></div><div class="library"><div class="section-label">Character library</div><button class="asset-card" id="asset"><span class="actor-icon">● ●</span><span><strong>Ona</strong><small>Original vector · 6 joints</small></span></button><p class="note">Reusable parts from Ukis.<br>Shoulder animation, editable poses, and a little personality.</p></div></aside>
<section class="viewport" aria-label="Scene viewport"><div class="viewport-bar"><span class="pill" id="canvas-size">640 × 400</span><button id="bones" class="pill">Show joints</button></div><div id="stage" class="stage drag-mode" tabindex="0" aria-label="Draggable scene. Use arrow keys to move the container."><div id="art" class="art"></div></div><div class="viewport-hint">Drag the card. Ona reacts when it starts and stops.</div></section>
<aside class="sidebar right" id="inspector"></aside></main>
<section class="timeline"><div class="timeline-toolbar"><div class="tabs"><button id="timeline-tab" class="active">Timeline</button><button id="states-tab">States</button></div><div class="playback"><select id="clip" aria-label="Animation clip"></select><button id="play" aria-label="Play animation">▶</button><span id="time" class="time-label">0.00 / 1.20 s</span><button id="add-key">+ Keyframe</button></div><div class="playback"><button id="greet">Wave</button><button id="shake">Move & stop</button><button id="reset">Reset</button></div></div><div id="timeline-content"></div></section>
<footer class="footer"><span id="status"><i class="status-dot"></i>Saved on this device</span><span>Posecraft 0.1 · MIT · <a href="https://github.com/jelizarovas/posecraft" target="_blank" rel="noreferrer">Source & agent skill ↗</a></span></footer><div id="toast" class="toast hidden" role="status"></div>`;

function toast(message) { $('toast').textContent = message; $('toast').classList.remove('hidden'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.add('hidden'), 4500); }
function actor() { return store.document.actors.find(a => a.id === selected); }
function pack() { return store.document.packs[actor()?.pack]; }
function persist() { try { localStorage.setItem(key, JSON.stringify(store.document)); $('saved').textContent = 'Saved just now'; } catch { toast('Browser storage is full. Use Save project to keep your work.'); } }
function edit(commands, notice) {
  try { store.transact(commands); persist(); rebuild(); if (notice) toast(notice); } catch (error) { toast(error.message); }
}
const set = (path, value) => ({ op: 'set', path, value });
function rebuild() {
  controller?.dispose();
  if (!actor()) selected = store.document.actors[0]?.id;
  if (pack() && !pack().joints.some(j => j.id === joint)) joint = pack().joints[0].id;
  if (pack() && !pack().clips[clip]) clip = Object.keys(pack().clips)[0];
  controller = new SceneController(store.document, { reducedMotion: media.matches });
  for (const a of store.document.actors) if (store.document.packs[a.pack].inputs.greeting) controller.setInput(a.id, 'greeting', greeting);
  renderer = mountSVG($('art'), store.document, controller.frame(), { bones });
  $('project-title').textContent = store.document.name;
  $('canvas-size').textContent = `${store.document.bounds.width} × ${store.document.bounds.height}`;
  $('stage').style.aspectRatio = `${store.document.bounds.width}/${store.document.bounds.height}`;
  $('undo').disabled = !store.past.length; $('redo').disabled = !store.future.length;
  drawHierarchy(); drawInspector(); drawTimeline(); drawPose();
}
function drawHierarchy() {
  $('hierarchy').innerHTML = store.document.actors.map(a => `<button class="actor-row ${a.id === selected ? 'active' : ''}" data-select="${a.id}"><span class="actor-icon">● ●</span>${esc(a.name)}</button>${a.id === selected ? store.document.packs[a.pack].joints.map(j => `<button class="joint-row ${j.id === joint ? 'active' : ''}" data-joint="${j.id}">⌁ &nbsp;${esc(j.id)}</button>`).join('') : ''}`).join('');
  $('hierarchy').querySelectorAll('[data-select]').forEach(el => el.onclick = () => { selected = el.dataset.select; rebuild(); });
  $('hierarchy').querySelectorAll('[data-joint]').forEach(el => el.onclick = () => { joint = el.dataset.joint; drawHierarchy(); drawInspector(); drawTimeline(); });
}
function drawInspector() {
  const a = actor(), p = pack();
  if (!a) { $('inspector').innerHTML = '<p class="note">Add a character to begin.</p>'; return; }
  const j = p.joints.find(j => j.id === joint), i = store.document.actors.indexOf(a);
  $('inspector').innerHTML = `<div><div class="section-label">Properties <span>Character</span></div><h2 class="inspector-heading">${esc(a.name)}</h2><span class="caption">${esc(a.pack)} / ${esc(joint)}</span><label class="field">Name<input id="actor-name" value="${esc(a.name)}" maxlength="100"></label><div class="two-col"><label class="field">X<input id="pos-x" type="number" value="${a.transform.x}" min="-10000" max="10000"></label><label class="field">Y<input id="pos-y" type="number" value="${a.transform.y}" min="-10000" max="10000"></label><label class="field">Scale<input id="scale" type="number" value="${a.transform.scale}" step=".1" min=".05" max="10"></label><label class="field">Turn<input id="turn" type="number" value="${a.transform.rotation}" min="-180" max="180"></label></div><div class="mini-actions" style="margin-top:12px"><button id="duplicate">Duplicate</button><button id="delete">Remove</button></div></div><hr class="rule"><div><div class="section-label">Pose</div><label class="field"><span class="range-header"><span>${esc(joint)}</span><output id="rotation-value">${j.rotation}°</output></span><input id="rotation" type="range" min="${j.min}" max="${j.max}" value="${j.rotation}" step="1"></label><span class="caption">Pose it, then add a keyframe.</span><hr class="rule"><div class="section-label">Appearance</div>${['clothing','skin','shoes'].map((name,i)=>`<label class="color-row">${name[0].toUpperCase()+name.slice(1)}<input type="color" data-color="${name}" aria-label="${name} color" value="${a.appearance?.[name] || ['#e6bd57','#fffdfa','#454644'][i]}"></label>`).join('')}${p.reaction ? `<hr class="rule"><div class="section-label">Motion response</div><label class="field">Strength<input id="strength" type="range" min="0" max="2" step=".05" value="${p.reaction.strength}"></label><span class="caption">Spring response. No foot contact simulation.</span>` : ''}</div>`;
  $('actor-name').onchange = e => edit([set(['actors', i, 'name'], e.target.value)]);
  for (const [id, prop] of [['pos-x','x'],['pos-y','y'],['scale','scale'],['turn','rotation']]) $(id).onchange = e => edit([set(['actors', i, 'transform', prop], Number(e.target.value))]);
  $('rotation').oninput = e => { playing = false; $('play').textContent = '▶'; const value = Number(e.target.value); $('rotation-value').textContent = value + '°'; const runtime = controller.actors.find(x => x.actor.id === selected).runtime; runtime.previewJoint(joint, value); renderer.update(controller.frame()); };
  $('inspector').querySelectorAll('[data-color]').forEach(el => el.onchange = () => edit([set(['actors', i, 'appearance'], { ...a.appearance, [el.dataset.color]: el.value })]));
  if ($('strength')) $('strength').onchange = e => edit([set(['packs', a.pack, 'reaction', 'strength'], Number(e.target.value))]);
  $('duplicate').onclick = () => addActor(a);
  $('delete').onclick = () => edit([set(['actors'], store.document.actors.filter(x => x.id !== a.id))]);
}
function drawTimeline() {
  const p = pack(), c = p?.clips[clip];
  $('clip').innerHTML = Object.keys(p?.clips || {}).map(id => `<option ${id === clip ? 'selected' : ''}>${esc(id)}</option>`).join('');
  $('add-key').disabled = !p;
  if (!c) { $('timeline-content').innerHTML = ''; return; }
  previewTime = Math.min(previewTime, c.duration);
  if (tab === 'states') {
    $('timeline-content').innerHTML = `<div class="state-body">${Object.entries(p.states).map(([id,s]) => `<div class="state-node ${id === controller.actors.find(a=>a.actor.id===selected)?.runtime.layers[0].state ? 'current' : ''}">${esc(id)}<br><span class="caption">${esc(s.clip)}</span></div>`).join('<span class="caption">⇄</span>')}<label>Blend <input id="blend" aria-label="Transition blend seconds" type="number" min="0" max="2" step=".05" value="${Object.values(p.states)[0]?.transitions?.[0]?.duration || 0}"> s</label><label><input id="input-greeting" type="checkbox" ${greeting ? 'checked' : ''}> greeting</label><span class="caption">greeting = true → wave · false → idle</span></div>`;
    $('blend').onchange = e => { const states = structuredClone(p.states); for (const s of Object.values(states)) for (const t of s.transitions || []) t.duration = Number(e.target.value); edit([set(['packs', actor().pack, 'states'], states)]); };
    $('input-greeting').onchange = toggleGreeting;
  } else {
    const track = c.tracks[`${joint}.rotation`] || [];
    $('timeline-content').innerHTML = `<div class="timeline-body"><div class="track-label">${esc(joint)}<br><span class="caption">Rotation · degrees</span></div><div class="track-area"><div class="ruler">${[0,.25,.5,.75,1].map(t=>`<span>${(t*c.duration).toFixed(1)} s</span>`).join('')}</div><div class="key-lane">${track.map(([t,v])=>`<span class="key" style="left:${t/c.duration*100}%" title="${t}s · ${v}°"></span>`).join('')}</div><input id="scrub" class="scrubber" type="range" aria-label="Timeline position" min="0" max="${c.duration}" step=".01" value="${previewTime}"><div class="mini-actions"><button id="remove-key">Remove key at playhead</button><select id="easing" aria-label="Keyframe easing"><option value="smooth">Smooth easing</option><option value="linear">Linear easing</option><option value="step">Step easing</option></select></div></div></div>`;
    $('scrub').oninput = e => { playing = false; $('play').textContent = '▶'; previewTime = Number(e.target.value); drawPose(); };
    $('remove-key').onclick = () => { const tracks = structuredClone(c.tracks), name = `${joint}.rotation`; const keys = (tracks[name] || []).filter(([t]) => Math.abs(t-previewTime) > .011); if(keys.length) tracks[name]=keys; else delete tracks[name]; edit([set(['packs', actor().pack, 'clips', clip, 'tracks'], tracks)]); };
  }
  updateTime();
}
function drawPose() {
  const c = pack()?.clips[clip];
  if (!c) { renderer.update(controller.frame()); return; }
  for (const a of controller.actors) {
    a.runtime.preview = null;
    if (a.actor.id === selected) { const layer = a.runtime.layers[0]; layer.state = Object.keys(a.pack.states).find(id => a.pack.states[id].clip === clip) || a.pack.initial; for (const state of Object.values(a.pack.states)) for (const t of state.transitions || []) if (t.to === layer.state) a.runtime.setInput(t.when.input, t.when.equals); layer.time = previewTime; layer.transition = null; a.runtime.frame = a.runtime.evaluate(); }
  }
  renderer.update(controller.frame()); updateTime();
  const angle = controller.frame().actors.find(a => a.id === selected)?.pose[`${joint}.rotation`];
  if ($('rotation') && angle !== undefined) { $('rotation').value = angle; $('rotation-value').textContent = `${Math.round(angle)}°`; }
}
function updateTime() { $('time').textContent = `${previewTime.toFixed(2)} / ${(pack()?.clips[clip]?.duration || 0).toFixed(2)} s`; if ($('scrub')) $('scrub').value = previewTime; }
function addActor(source) {
  if (!store.document.packs.ona) return toast('This scene has no Ona pack. Open the starter to add Ona.');
    const a = source ? structuredClone(source) : structuredClone(starter.actors[0]);
  a.id = `actor-${Date.now().toString(36)}`; a.name = source ? `${source.name} copy`.slice(0,100) : 'Ona'; a.transform.x += source ? 65 : -100; a.transform.scale = Math.min(a.transform.scale, 2);
  selected = a.id; edit([set(['actors'], [...store.document.actors, a])], 'Added an independent character instance.');
}
function download(name, content, type = 'application/json') { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
$('add').onclick = $('asset').onclick = () => addActor();
$('undo').onclick = () => { store.undo(); persist(); rebuild(); };
$('redo').onclick = () => { store.redo(); persist(); rebuild(); };
$('save').onclick = () => download(`${store.document.id}.posecraft.json`, JSON.stringify(store.document, null, 2));
$('export').onclick = () => { download(`${store.document.id}.posecraft.json`, JSON.stringify(store.document, null, 2)); toast('Portable scene exported. Use posecraft/react or posecraft/browser to embed it.'); };
$('import').onclick = () => $('file').click();
$('file').onchange = async e => { const file = e.target.files[0]; if (!file) return; try { if (file.size > 5000000) throw new Error('Scene exceeds 5 MB.'); const next = new DocumentStore(JSON.parse(await file.text())); store = next; selected = next.document.actors[0]?.id; previewTime = 0; playing = false; persist(); rebuild(); toast('Project opened.'); } catch(error) { toast(`Could not open scene. ${error.message}`); } e.target.value = ''; };
$('clip').onchange = e => { clip = e.target.value; previewTime = 0; playing = false; drawTimeline(); drawPose(); };
$('add-key').onclick = () => { const tracks = structuredClone(pack().clips[clip].tracks), name = `${joint}.rotation`; const value = Number($('rotation').value); tracks[name] = [...(tracks[name] || []).filter(([t]) => Math.abs(t-previewTime) > .001), [Number(previewTime.toFixed(3)), value, $('easing')?.value || 'smooth']].sort((a,b)=>a[0]-b[0]); edit([set(['packs', actor().pack, 'clips', clip, 'tracks'], tracks)], 'Keyframe added.'); };
$('play').onclick = () => { playing = !playing; $('play').textContent = playing ? 'Ⅱ' : '▶'; $('play').setAttribute('aria-label', playing ? 'Pause animation' : 'Play animation'); last = null; };
function toggleGreeting() { greeting = !greeting; $('greet').textContent = greeting ? 'Rest' : 'Wave'; for (const a of controller.actors) if (a.pack.inputs.greeting) controller.setInput(a.actor.id, 'greeting', greeting); clip = greeting ? 'wave' : 'idle'; playing = true; $('play').textContent = 'Ⅱ'; if (tab === 'states') drawTimeline(); }
$('greet').onclick = toggleGreeting;
$('shake').onclick = () => { scenario = { start: performance.now(), origin: { ...offset } }; };
$('reset').onclick = () => { offset = {x:0,y:0}; scenario = null; $('stage').style.transform = ''; previewTime = 0; greeting = false; playing = false; $('play').textContent = '▶'; $('greet').textContent = 'Wave'; rebuild(); };
$('bones').onclick = () => { bones = !bones; $('bones').textContent = bones ? 'Hide joints' : 'Show joints'; renderer = mountSVG($('art'), store.document, controller.frame(), { bones }); };
for (const t of ['timeline','states']) $(t+'-tab').onclick = () => { tab=t; $('timeline-tab').classList.toggle('active',t==='timeline'); $('states-tab').classList.toggle('active',t==='states'); drawTimeline(); };
let drag;
$('stage').onpointerdown = e => { if (e.button !== 0) return; drag = { x:e.clientX, y:e.clientY, start:{...offset} }; $('stage').setPointerCapture(e.pointerId); scenario = null; };
$('stage').onpointermove = e => { if(drag) { offset = {x:Math.max(-150,Math.min(150,drag.start.x+e.clientX-drag.x)),y:Math.max(-90,Math.min(90,drag.start.y+e.clientY-drag.y))}; $('stage').style.transform = `translate(${offset.x}px,${offset.y}px)`; } };
$('stage').onpointerup = $('stage').onpointercancel = () => { drag = null; };
$('stage').onkeydown = e => { if (!e.key.startsWith('Arrow')) return; e.preventDefault(); offset.x += e.key === 'ArrowLeft' ? -12 : e.key === 'ArrowRight' ? 12 : 0; offset.y += e.key === 'ArrowUp' ? -12 : e.key === 'ArrowDown' ? 12 : 0; $('stage').style.transform = `translate(${offset.x}px,${offset.y}px)`; };
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !['INPUT','TEXTAREA'].includes(e.target.tagName)) { e.preventDefault(); (e.shiftKey ? $('redo') : $('undo')).click(); } });
document.addEventListener('visibilitychange', () => { last=null; controller.rebaseline(); });
media.addEventListener('change', () => rebuild());
rebuild();
if (recoveryError) toast(recoveryError);
function tick(now) {
  const dt = last === null || document.hidden ? 0 : Math.min((now-last)/1000,.05); last=now;
  if (!document.hidden) {
    if(scenario) { const t=(now-scenario.start)/1000; offset={ x:scenario.origin.x+Math.sin(Math.min(t/1.1,1)*Math.PI*2)*85, y:scenario.origin.y+Math.sin(Math.min(t/1.1,1)*Math.PI)*-25 }; $('stage').style.transform=`translate(${offset.x}px,${offset.y}px)`; if(t>1.1) scenario=null; }
    controller.sampleHost({ ...offset,time:now/1000 });
    if (playing) { renderer.update(controller.step(dt)); const layer = controller.actors.find(a=>a.actor.id===selected)?.runtime.layers[0]; if(layer) { const c=pack().clips[pack().states[layer.state].clip]; previewTime=layer.time%c.duration; } updateTime(); }
    else { for(const a of controller.actors) { const time=a.runtime.layers[0].time; a.savedTime=time; } controller.step(dt); for(const a of controller.actors) { a.runtime.layers[0].time=a.savedTime; a.runtime.frame=a.runtime.evaluate(); } renderer.update(controller.frame()); }
    $('status').textContent = media.matches ? 'Reduced motion · still presentation' : `${store.document.actors.length} character${store.document.actors.length===1?'':'s'} · ${controller.actors.find(a=>a.actor.id===selected)?.runtime.layers[0].state || 'empty scene'} · Local draft`;
  }
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
