import initial from '../examples/characters/porch-zombie.puppet.json';
import {validateSpritePuppet} from '../src/sprite-puppet.js';
import {spritePlayer} from './sprite-player.js';
import {jointLimitGuide} from './joint-limit-guide.js';
import {sampleClip} from '../src/index.js';
import runtime from 'virtual:posecraft-sprite-embed';

const $=id=>document.getElementById(id);
const canvas=document.querySelector('canvas');
let doc=structuredClone(initial),player,generation=0;
let overrides={},facePart,sliders=[];
let rotationPreview=null;
$('skeleton').onchange=()=>player?.skeleton($('skeleton').value);
function previewFace(){
  player?.preview(rotationPreview?{...overrides,...rotationPreview}:overrides,$('closeup').checked?facePart?.id:null);
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
const sphereFields=['x','y','z','radius'].map(k=>$('contact-'+k));
function showSphere(){
  const part=doc.parts.find(p=>p.id===$('contact-part').value);
  if(!part)return;
  const index=Number($('contact-sphere').value);
  part.space.collision.spheres[index].forEach((v,i)=>{sphereFields[i].value=v;});
  player?.collisions($('contact-show').checked?part.id:null,index);
}
function chooseCollider(index=0){
  const part=doc.parts.find(p=>p.id===$('contact-part').value);
  if(!part)return;
  options($('contact-sphere'),part.space.collision.spheres.map((_,i)=>[i,String(i+1)]));
  $('contact-sphere').selectedIndex=Math.min(index,part.space.collision.spheres.length-1);
  showSphere();
}
$('contact-part').onchange=()=>chooseCollider();
$('contact-show').onchange=$('contact-sphere').onchange=showSphere;
$('contact-apply').onclick=async()=>{
  try{
    const sphere=sphereFields.map(f=>f.valueAsNumber);
    if(!sphere.every(Number.isFinite)||sphere[3]<=0)throw Error('Enter three coordinates and a positive radius.');
    const next=structuredClone(doc);
    next.parts.find(p=>p.id===$('contact-part').value).space.collision.spheres[Number($('contact-sphere').value)]=sphere;
    await load(next,Number($('time').value));$('status').textContent='Collision shape saved.';
  }catch(error){report(error);}
};
function showKey(seek){
  const track=$('track').value,keys=doc.clip.tracks[track]??[],i=Number($('key').value);
  const [time,value]=keys[i]??[Number($('time').value),0];
  $('at').value=time;
  const choices=doc.channels[track];
  const input=document.createElement(choices?'select':'input');
  if(choices)options(input,choices.map((label,j)=>[j,label]));
  else {input.type='number';input.step='any';}
  const [id,axis]=track.split('.'),part=doc.parts.find(p=>p.id===id);
  const limits=part?.space?.limits?.[axis];
  rotationPreview=null;
  const slider=$('joint-angle');
  $('joint-preview').hidden=!limits;
  if(limits){
    [slider.min,slider.max]=limits;slider.disabled=limits[0]===limits[1];
    slider.oninput=()=>{input.value=slider.value;input.dispatchEvent(new Event('input'));};
    input.oninput=()=>{
      if(!Number.isFinite(input.valueAsNumber))return;
      player.seek(Number($('time').value));
      rotationPreview={[track]:input.valueAsNumber};previewFace();
    };
  }
  player?.guide(limits?jointLimitGuide(id,track,slider,$('joint-reading')):null);
  previewFace();
  $('stops').hidden=!part?.space||!['rotation','yaw','pitch','twist'].includes(axis);
  $('stop-min').value=limits?.[0]??'';$('stop-max').value=limits?.[1]??'';
  if(limits){input.min=limits[0];input.max=limits[1];}
  const units={rotation:'Rotation in degrees',yaw:'Yaw in degrees',pitch:'Pitch in degrees',twist:'Forearm twist in degrees',depth:'Draw order',z:'Depth offset',plant:'Plant weight'};
  input.value=value;input.setAttribute('aria-label',choices?'Drawing':units[axis]??'Joint offset');
  $('value').replaceChildren(input);
  $('remove').disabled=keys.length<2;
  $('set').disabled=!keys.length;
  if(seek&&keys.length)player?.seek(time);
}
function keys(index=0){
  const track=$('track').value;
  const timeline=doc.clip.tracks[track]??[];
  options($('key'),timeline.length?timeline.map(([t,v],i)=>[i,t.toFixed(2)+' s · '+(doc.channels[track]?.[v]??v+(/\.(rotation|yaw|pitch|twist)$/.test(track)?'°':''))]):[[0,'No keys']]);
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
  const tracks=new Set(Object.keys(doc.clip.tracks));
  for(const part of doc.parts)if(part.space){
    for(const axis of ['rotation','yaw','pitch','z'])tracks.add(part.id+'.'+axis);
    if(part.space.twist)tracks.add(part.id+'.twist');
  }
  options($('track'),[...tracks].map(t=>[t,t.replace('.',' · ')]));
  if(tracks.has(previous))$('track').value=previous;
  $('rig-view').hidden=!doc.parts.some(p=>p.space);
  player.skeleton($('rig-view').hidden?'':$('skeleton').value);
  const shapes=doc.parts.filter(p=>p.space?.collision),previousPart=$('contact-part').value,previousSphere=Number($('contact-sphere').value);
  $('contact-editor').hidden=!shapes.length;
  options($('contact-part'),shapes.map(p=>[p.id,p.id]));
  if(shapes.some(p=>p.id===previousPart))$('contact-part').value=previousPart;
  chooseCollider(previousSphere);
  keys();faceControls();
  if(position!==undefined)player.seek(position);
}
function report(error){$('status').textContent=error.message;}
async function edit(mode){
  const next=structuredClone(doc),name=$('track').value,track=next.clip.tracks[name]??=[];
  const selected=Number($('key').value);
  if(mode!=='add')track.splice(selected,1);
  const time=mode==='add'?Number($('time').value):Number($('at').value);
  let message='Keyframes updated.';
  if(mode!=='remove'){
    const value=$('value').firstChild.value;
    if(value===''||$('at').value==='')throw Error('Enter a time and value.');
    const ease=doc.channels[name]&&!doc.interpolated?.includes(name)?'step':doc.clip.tracks[name]?.[selected]?.[2]||'smooth';
    const input=$('value').firstChild;
    const angle=input.min!==''&&input.min!==undefined?Math.max(Number(input.min),Math.min(Number(input.max),Number(value))):Number(value);
    if(angle!==Number(value))message='Key saved at the joint limit of '+angle+'°.';
    track.push([time,angle,ease]);
    track.sort((a,b)=>a[0]-b[0]);
  }
  await load(next,time);
  keys(Math.max(0,track.findIndex(key=>key[0]===time)));$('status').textContent=message;
}
$('set-stops').onclick=async()=>{
  try{
    const name=$('track').value,[id,axis]=name.split('.');
    const min=$('stop-min').valueAsNumber,max=$('stop-max').valueAsNumber;
    if(!Number.isFinite(min)||!Number.isFinite(max)||min>max)throw Error('Enter two angles with the minimum first.');
    const next=structuredClone(doc),space=next.parts.find(p=>p.id===id).space;
    (space.limits??={})[axis]=[min,max];
    for(const key of next.clip.tracks[name]??[])key[1]=Math.max(min,Math.min(max,key[1]));
    await load(next,Number($('time').value));$('status').textContent='Joint limits saved.';
  }catch(error){report(error);}
};
function download(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function followRotation(){if(rotationPreview){rotationPreview=null;previewFace();}}
$('play').onclick=()=>{followRotation();player?.toggle();};
$('time').oninput=()=>{const time=Number($('time').value);followRotation();player?.seek(time);};
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
