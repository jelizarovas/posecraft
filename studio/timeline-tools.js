import {editTimelineKeys} from '../src/timeline-editing.js';
import './timeline-tools.css';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyId=ref=>JSON.stringify([ref.track,ref.time]);
const symbol=name=>`<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;

export function createTimelineTools({getContext, commit, seek, undo, redo, retime}) {
 const dialog=document.createElement('dialog');dialog.className='timeline-editor';dialog.setAttribute('aria-label','Edit animation keys');document.body.append(dialog);
 let selection=[], scope='', add=false, filter='', message='', view='keys',marker=-1,busy=false,fields={offset:.1,factor:1.25,pivot:0,easing:'smooth'};
 const $=id=>dialog.querySelector('#'+id);
 const close=()=>dialog.close();
 function current(){const c=getContext();if(!c)return null;const next=`${c.packId}/${c.clipId}`;if(next!==scope){scope=next;selection=[];filter='';message='';marker=-1;}selection=selection.filter(r=>c.clip.tracks[r.track]?.some(k=>k[0]===r.time));return c;}
 function render(){
  const c=current();if(!c){close();return;}const selected=new Set(selection.map(keyId)),events=c.clip.events||[];if(marker>=events.length)marker=-1;
  const tabs=`<div class="keys-view-tabs" role="group" aria-label="Timeline view"><button id="keys-view" aria-pressed="${view==='keys'}">Keys</button><button id="markers-view" aria-pressed="${view==='markers'}">Markers · ${events.length}</button></div>`;
  const entries=Object.entries(c.clip.tracks).filter(([name])=>name.toLowerCase().includes(filter.toLowerCase()));
  dialog.innerHTML=`<header><div><strong>Animation timeline</strong><small>${esc(c.name)} · ${esc(c.clipId)} · ${c.clip.duration}s</small></div><button id="keys-undo" aria-label="Undo key edit" ${c.canUndo?'':'disabled'}>${symbol('undo')}</button><button id="keys-redo" aria-label="Redo key edit" ${c.canRedo?'':'disabled'}>${symbol('redo')}</button><button id="keys-close" aria-label="Close key editor">×</button></header>
  <div class="keys-select">${tabs}${view==='keys'?`<input id="keys-filter" aria-label="Filter animation tracks" placeholder="Find a track" value="${esc(filter)}"><label><input id="keys-add" type="checkbox" ${add?'checked':''}>Select several</label><button id="keys-all">All shown</button><button id="keys-clear">Clear</button><output id="keys-count">${selection.length} selected</output>`:'<span class="note">Named events emitted during playback.</span>'}</div>
  <div class="keys-tracks">${view==='markers'?`<div class="marker-lane" aria-label="Clip markers"><span>0s</span><span>${c.clip.duration}s</span>${events.map((e,i)=>`<button data-marker="${i}" class="marker-dot ${i===marker?'chosen':''}" style="left:${e.time/c.clip.duration*100}%" aria-label="${esc(e.name)} at ${e.time} seconds" title="${esc(e.name)} · ${e.time}s">◆</button>`).join('')}</div><div class="marker-list">${events.length?events.map((e,i)=>`<button data-marker="${i}" aria-pressed="${i===marker}"><span>${esc(e.name)}</span><time>${e.time}s</time></button>`).join(''):'<p class="note">No markers yet. Add a name and time below.</p>'}</div>`:`<div class="keys-ruler"><span>Track</span><span>0 s</span><span>${c.clip.duration}s</span></div>${entries.length?entries.map(([track,keys])=>`<div class="keys-track"><button class="keys-track-name" data-track-select="${esc(track)}" title="Select every key in ${esc(track)}">${esc(track.replaceAll('.',' · '))}</button><div class="keys-track-lane">${keys.map(([time,value,easing='smooth'])=>`<button class="keys-dot ${selected.has(keyId({track,time}))?'chosen':''}" data-track="${esc(track)}" data-key="${time}" style="left:${time/c.clip.duration*100}%" aria-pressed="${selected.has(keyId({track,time}))}" aria-label="${esc(track)}, ${time} seconds, ${value}, ${easing}" title="${time}s · ${value} · ${easing}"><i aria-hidden="true"></i></button>`).join('')}</div></div>`).join(''):'<p>No matching keyed tracks. Add keys in the main timeline first.</p>'}`}</div>
  <div class="keys-actions">${view==='markers'?`<label class="marker-name-field">Event name<input id="marker-name" type="text" maxlength="80" value="${esc(events[marker]?.name||'')}" placeholder="footstep"></label><label>Time, seconds<input id="marker-time" type="number" min="0" max="${c.clip.duration}" step=".001" required value="${events[marker]?.time??0}"></label><button id="marker-save">${symbol(marker<0?'add':'save')}${marker<0?'Add marker':'Save marker'}</button><button id="marker-new">New</button><button id="marker-seek" ${marker<0?'disabled':''}>${symbol('play_arrow')}Seek</button><button id="marker-delete" ${marker<0?'disabled':''}>${symbol('delete')}Remove</button>`:`<label>Offset, seconds<input id="keys-offset" type="number" step=".01" value="${fields.offset}"></label><button id="keys-move">${symbol('gesture')}Move</button><button id="keys-copy">${symbol('content_copy')}Copy</button><label>Time scale<input id="keys-factor" type="number" min=".001" step=".1" value="${fields.factor}"></label><label>Anchor, seconds<input id="keys-pivot" type="number" step=".01" value="${fields.pivot}"></label><button id="keys-scale">Scale</button><label>Easing<select id="keys-ease">${['smooth','linear','step'].map(v=>`<option ${fields.easing===v?'selected':''}>${v}</option>`).join('')}</select></label><button id="keys-easing">Apply easing</button><button id="keys-delete" aria-label="Delete selected keys">${symbol('delete')}Delete</button>`}</div>
  <footer><span id="keys-message" role="status">${esc(message||(view==='keys'?'Click a key. Shift/Ctrl-click or Select several adds keys. Track names select whole tracks.':'Select a marker to edit or seek. Different names may share a time; the same name and time cannot be duplicated.'))}</span>${retime?`<details class="clip-retime"><summary>Whole clip timing</summary><div><label>Duration, seconds<input id="clip-duration" type="number" required min=".1" max="180" step=".001" value="${c.clip.duration}"></label><button id="clip-retime" ${busy?'disabled':''}>${busy?'Retiming…':'Retime clip'}</button></div><small>Scales this authored clip and its supported timing references, not the whole live behavior graph. ${esc(c.retimeSummary||'')}</small></details>`:''}<small>${view==='keys'?'Times round to 0.001s. Overlaps and times outside the clip cancel the entire edit. Easing controls motion after each key.':'Markers are named playback events. Times round to 0.001s. Marker edits leave keyframes unchanged.'}</small></footer>`;
  $('keys-close').onclick=close;
  $('keys-undo').onclick=()=>{undo();selection=[];message='Undone.';render();};$('keys-redo').onclick=()=>{redo();selection=[];message='Redone.';render();};
  $('keys-view').onclick=()=>{view='keys';message='';render();};$('markers-view').onclick=()=>{view='markers';message='';render();};
  if(retime)$('clip-retime').onclick=async()=>{
   const input=$('clip-duration'),duration=Number(input.value);if(!input.value.trim()||!Number.isFinite(duration)||!input.reportValidity())return;
   if(duration===current().clip.duration){message='The clip already has that duration.';render();return;}
   busy=true;const expectedScope=scope;$('clip-retime').disabled=true;$('clip-retime').textContent='Retiming…';
   try{const result=await retime(duration);selection=[];marker=-1;message=current()&&scope===expectedScope&&Math.abs(current().clip.duration-duration)<.0005?`Clip retimed to ${duration}s.${result?.notes?.length?' '+result.notes.join(' '):''}`:'The clip was not changed.';}catch(error){message=error.message;}finally{busy=false;if(dialog.open)render();}
  };
  if(view==='markers'){
   const choose=index=>{marker=index;message='';render();},writeMarkers=next=>{
    if(next.length>128)throw Error('Keep at most 128 markers per clip.');
    const pairs=new Set();for(const e of next){if(typeof e.name!=='string'||!e.name.trim()||e.name!==e.name.trim()||e.name.length>80||/[\u0000-\u001f\u007f]/.test(e.name))throw Error('Use a trimmed marker name of 1–80 characters without control characters.');if(!Number.isFinite(e.time)||e.time<0||e.time>current().clip.duration)throw Error('Marker time must be inside the clip.');const key=JSON.stringify([e.name,e.time]);if(pairs.has(key))throw Error('That marker name already exists at this time.');pairs.add(key);}
    next.sort((a,b)=>a.time-b.time);const clip=structuredClone(current().clip);if(next.length)clip.events=next;else delete clip.events;commit(clip);
   };
   dialog.querySelectorAll('[data-marker]').forEach(button=>button.onclick=()=>choose(Number(button.dataset.marker)));
   $('marker-new').onclick=()=>choose(-1);
   $('marker-seek').onclick=()=>{if(marker>=0){seek(events[marker].time);message=`Preview at ${events[marker].time}s.`;render();}};
   $('marker-save').onclick=()=>{try{const input=$('marker-time');if(!input.value.trim()||!input.reportValidity())throw Error('Enter a marker time inside the clip.');const event={name:$('marker-name').value.trim(),time:Math.round(Number(input.value)*1000)/1000},next=structuredClone(current().clip.events||[]);if(marker<0)next.push(event);else next[marker]=event;writeMarkers(next);marker=next.findIndex(e=>e.name===event.name&&e.time===event.time);message='Marker saved.';}catch(error){message=error.message;}render();};
   $('marker-delete').onclick=()=>{try{if(marker<0)return;writeMarkers((current().clip.events||[]).filter((_,i)=>i!==marker));marker=-1;message='Marker removed.';}catch(error){message=error.message;}render();};
   return;
  }
  $('keys-add').onchange=e=>add=e.target.checked;
  $('keys-filter').oninput=e=>{filter=e.target.value;const position=e.target.selectionStart;render();$('keys-filter').focus();$('keys-filter').setSelectionRange(position,position);};
  $('keys-all').onclick=()=>{selection=entries.flatMap(([track,keys])=>keys.map(([time])=>({track,time})));message='';render();};
  $('keys-clear').onclick=()=>{selection=[];message='';render();};
  dialog.querySelectorAll('[data-key]').forEach(button=>button.onclick=e=>{
   const ref={track:button.dataset.track,time:+button.dataset.key},has=selected.has(keyId(ref));
   selection=e.shiftKey||e.ctrlKey||e.metaKey||add?(has?selection.filter(r=>keyId(r)!==keyId(ref)):[...selection,ref]):[ref];
   if(selection.length===1)fields.pivot=selection[0].time;message='';seek(ref.time,ref.track);render();
  });
  dialog.querySelectorAll('[data-track-select]').forEach(button=>button.onclick=e=>{
   const track=button.dataset.trackSelect,refs=c.clip.tracks[track].map(([time])=>({track,time}));
   selection=e.shiftKey||e.ctrlKey||e.metaKey||add?[...selection.filter(r=>r.track!==track),...refs]:refs;
   fields.pivot=Math.min(...selection.map(r=>r.time));message='';render();
  });
  for(const id of ['offset','factor','pivot'])$('keys-'+id).oninput=e=>fields[id]=e.target.value===''?NaN:Number(e.target.value);
  $('keys-ease').onchange=e=>fields.easing=e.target.value;
  for(const type of ['move','copy','scale','delete','easing'])$('keys-'+type).onclick=()=>{
   try{
    const operation=type==='move'||type==='copy'?{type,offset:fields.offset}:type==='scale'?{type,factor:fields.factor,pivot:fields.pivot}:type==='easing'?{type,easing:fields.easing}:{type};
    const result=editTimelineKeys(current().clip,selection,operation);commit(result.clip);selection=result.selection;message=`${type==='delete'?'Deleted':type==='easing'?'Updated easing for':type==='copy'?'Copied':type==='scale'?'Scaled':'Moved'} selected keys.`;
   }catch(error){message=error.message;}render();
  };
 }
 dialog.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)){e.preventDefault();e.stopPropagation();(e.shiftKey?$('keys-redo'):$('keys-undo')).click();}});
 return {open(){render();dialog.showModal();$('keys-close').focus();},close};
}
