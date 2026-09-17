import {editTimelineKeys} from '../src/timeline-editing.js';
import './timeline-tools.css';
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keyId=ref=>JSON.stringify([ref.track,ref.time]);
const symbol=name=>`<span class="material-symbols-outlined" aria-hidden="true">${name}</span>`;

export function createTimelineTools({getContext, commit, seek, undo, redo}) {
 const dialog=document.createElement('dialog');dialog.className='timeline-editor';dialog.setAttribute('aria-label','Edit animation keys');document.body.append(dialog);
 let selection=[], scope='', add=false, filter='', message='', fields={offset:.1,factor:1.25,pivot:0,easing:'smooth'};
 const $=id=>dialog.querySelector('#'+id);
 const close=()=>dialog.close();
 function current(){const c=getContext();if(!c)return null;const next=`${c.packId}/${c.clipId}`;if(next!==scope){scope=next;selection=[];filter='';message='';}selection=selection.filter(r=>c.clip.tracks[r.track]?.some(k=>k[0]===r.time));return c;}
 function render(){
  const c=current();if(!c){close();return;}const selected=new Set(selection.map(keyId));
  const entries=Object.entries(c.clip.tracks).filter(([name])=>name.toLowerCase().includes(filter.toLowerCase()));
  dialog.innerHTML=`<header><div><strong>Edit keys</strong><small>${esc(c.name)} · ${esc(c.clipId)} · ${c.clip.duration}s</small></div><button id="keys-undo" aria-label="Undo key edit" ${c.canUndo?'':'disabled'}>${symbol('undo')}</button><button id="keys-redo" aria-label="Redo key edit" ${c.canRedo?'':'disabled'}>${symbol('redo')}</button><button id="keys-close" aria-label="Close key editor">×</button></header>
  <div class="keys-select"><input id="keys-filter" aria-label="Filter animation tracks" placeholder="Find a track" value="${esc(filter)}"><label><input id="keys-add" type="checkbox" ${add?'checked':''}>Select several</label><button id="keys-all">All shown</button><button id="keys-clear">Clear</button><output id="keys-count">${selection.length} selected</output></div>
  <div class="keys-tracks"><div class="keys-ruler"><span>Track</span><span>0 s</span><span>${c.clip.duration}s</span></div>${entries.length?entries.map(([track,keys])=>`<div class="keys-track"><button class="keys-track-name" data-track-select="${esc(track)}" title="Select every key in ${esc(track)}">${esc(track.replaceAll('.',' · '))}</button><div class="keys-track-lane">${keys.map(([time,value,easing='smooth'])=>`<button class="keys-dot ${selected.has(keyId({track,time}))?'chosen':''}" data-track="${esc(track)}" data-key="${time}" style="left:${time/c.clip.duration*100}%" aria-pressed="${selected.has(keyId({track,time}))}" aria-label="${esc(track)}, ${time} seconds, ${value}, ${easing}" title="${time}s · ${value} · ${easing}"><i aria-hidden="true"></i></button>`).join('')}</div></div>`).join(''):'<p>No matching keyed tracks. Add keys in the main timeline first.</p>'}</div>
  <div class="keys-actions"><label>Offset, seconds<input id="keys-offset" type="number" step=".01" value="${fields.offset}"></label><button id="keys-move">${symbol('gesture')}Move</button><button id="keys-copy">${symbol('content_copy')}Copy</button><label>Time scale<input id="keys-factor" type="number" min=".001" step=".1" value="${fields.factor}"></label><label>Anchor, seconds<input id="keys-pivot" type="number" step=".01" value="${fields.pivot}"></label><button id="keys-scale">Scale</button><label>Easing<select id="keys-ease">${['smooth','linear','step'].map(v=>`<option ${fields.easing===v?'selected':''}>${v}</option>`).join('')}</select></label><button id="keys-easing">Apply easing</button><button id="keys-delete" aria-label="Delete selected keys">${symbol('delete')}Delete</button></div>
  <footer><span id="keys-message" role="status">${esc(message||'Click a key. Shift/Ctrl-click or Select several adds keys. Track names select whole tracks.')}</span><small>Times round to 0.001s. Overlaps and times outside the clip cancel the entire edit. Easing controls motion after each key.</small></footer>`;
  $('keys-close').onclick=close;
  $('keys-undo').onclick=()=>{undo();selection=[];message='Undone.';render();};$('keys-redo').onclick=()=>{redo();selection=[];message='Redone.';render();};
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
