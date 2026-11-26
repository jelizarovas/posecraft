import initial from '../examples/characters/porch-zombie.puppet.json';
import {validateSpritePuppet} from '../src/sprite-puppet.js';
import {spritePlayer} from './sprite-player.js';
import {sampleClip} from '../src/index.js';
import runtime from 'virtual:posecraft-sprite-embed';

const $=id=>document.getElementById(id);
const canvas=document.querySelector('canvas');
let doc=structuredClone(initial),player,generation=0;
let overrides={},facePart,sliders=[];
function previewFace(){
  player?.preview(overrides,$('closeup').checked?facePart?.id:null);
  $('key-face').disabled=$('release-face').disabled=!Object.keys(overrides).length;
}
function faceControls(){
  facePart=doc.parts.find(p=>p.layers?.length);overrides={};sliders=[];
  $('face').hidden=!facePart;$('facial-sliders').replaceChildren();
  const layers=facePart?.layers??[];
  const controls=layers.length?[{channel:layers[0].viewChannel,label:'Head turn'},...layers]:[];
  for(const {channel,label} of controls){
    const row=document.createElement('label'),input=document.createElement('input'),value=document.createElement('output');
    input.type='range';input.min=0;input.max=doc.channels[channel].length-1;input.step=1;
    row.append(label,input,value);$('facial-sliders').append(row);
    input.setAttribute('aria-label',label);sliders.push({channel,input,value});
    input.oninput=()=>{overrides[channel]=Number(input.value);previewFace();};
  }
  previewFace();
}
function showFace(time){
  if(!sliders.length)return;
  const pose=sampleClip(doc.clip,time);
  for(const {channel,input,value} of sliders){
    const amount=overrides[channel]??Math.round(pose[channel]??0);
    if(input.value!==String(amount))input.value=amount;
    const text=doc.channels[channel][amount];if(value.textContent!==text)value.textContent=text;
  }
}
$('closeup').onchange=previewFace;
$('release-face').onclick=()=>{overrides={};previewFace();};
$('key-face').onclick=async()=>{
  try{
    const at=Number($('time').value),next=structuredClone(doc);
    for(const [channel,value] of Object.entries(overrides)){
      const track=(next.clip.tracks[channel]??[]).filter(([time])=>Math.abs(time-at)>.00001);
      track.push([at,value,next.interpolated?.includes(channel)?'smooth':'step']);
      next.clip.tracks[channel]=track.sort((a,b)=>a[0]-b[0]);
    }
    await load(next,at);$('status').textContent='Face keys saved at '+at.toFixed(2)+' s.';
  }catch(e){report(e);}
};
function options(select,items){
  select.replaceChildren(...items.map(([value,label])=>new Option(label,value)));
}
function showKey(seek){
  const track=$('track').value,keys=doc.clip.tracks[track],i=Number($('key').value);
  const [time,value]=keys[i];
  $('at').value=time;
  const choices=doc.channels[track];
  const input=document.createElement(choices?'select':'input');
  if(choices)options(input,choices.map((label,j)=>[j,label]));
  else {input.type='number';input.step='any';}
  input.value=value;input.setAttribute('aria-label',choices?'Drawing':track.endsWith('.rotation')?'Rotation in degrees':track.endsWith('.depth')?'Draw order':'Joint offset');
  $('value').replaceChildren(input);
  $('remove').disabled=keys.length<2;
  if(seek)player?.seek(time);
}
function keys(index=0){
  const track=$('track').value;
  options($('key'),doc.clip.tracks[track].map(([t,v],i)=>[i,t.toFixed(2)+' s · '+(doc.channels[track]?.[v]??v+(track.endsWith('.rotation')?'°':''))]));
  $('key').selectedIndex=index;showKey(false);
}
async function load(next,position){
  validateSpritePuppet(next);
  const request=++generation;
  const view=await spritePlayer(canvas,next,(time,playing)=>{
    $('time').value=time;$('clock').textContent=time.toFixed(2)+' s';$('play').textContent=playing?'Pause':'Play';
    showFace(time);
  });
  if(request!==generation){view.dispose();return;}
  player?.dispose();player=view;doc=next;
  $('name').textContent=doc.name;$('time').max=$('at').max=doc.clip.duration;
  const previous=$('track').value;
  options($('track'),Object.keys(doc.clip.tracks).map(t=>[t,t.replace('.rotation',' · rotation')]));
  if(Object.hasOwn(doc.clip.tracks,previous))$('track').value=previous;
  keys();faceControls();
  if(position!==undefined)player.seek(position);
}
function report(error){$('status').textContent=error.message;}
async function edit(mode){
  const next=structuredClone(doc),name=$('track').value,track=next.clip.tracks[name];
  const selected=Number($('key').value);
  if(mode!=='add')track.splice(selected,1);
  const time=mode==='add'?Number($('time').value):Number($('at').value);
  if(mode!=='remove'){
    const value=$('value').firstChild.value;
    if(value===''||$('at').value==='')throw Error('Enter a time and value.');
    const ease=doc.channels[name]&&!doc.interpolated?.includes(name)?'step':doc.clip.tracks[name][selected][2]||'smooth';
    track.push([time,Number(value),ease]);
    track.sort((a,b)=>a[0]-b[0]);
  }
  await load(next,time);
  keys(Math.max(0,track.findIndex(key=>key[0]===time)));$('status').textContent='Keyframes updated.';
}
function download(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('play').onclick=()=>player?.toggle();
$('time').oninput=()=>player?.seek(Number($('time').value));
$('track').onchange=()=>{keys();showKey(true);};
$('key').onchange=()=>showKey(true);
for(const [id,mode] of [['set','set'],['add','add'],['remove','remove']])$(id).onclick=()=>edit(mode).catch(report);
$('save').onclick=()=>download(new Blob([JSON.stringify(doc)],{type:'application/json'}),'performance.puppet.json');
$('open').onchange=async()=>{
  try{const file=$('open').files[0];if(file){await load(JSON.parse(await file.text()),0);$('status').textContent='Opened '+file.name;}}
  catch(e){report(e);}finally{$('open').value='';}
};
$('website').onclick=async()=>{
  try{
    const data=JSON.stringify(doc).replaceAll('<','\\u003c');
    const html='<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Posecraft puppet</title><style>html,body,canvas{margin:0;width:100%;height:100%;display:block}</style><canvas aria-label="Animated puppet"></canvas><script type="application/json" id="puppet">'+data+'</script><script>'+runtime.replace(/<\/script/gi,'<\\/script')+'</script>';
    download(new Blob([html],{type:'text/html'}),'puppet.html');
  }catch(e){report(e);}
};
load(doc).catch(report);
