// Contact's casement is a separate actor: opening it never steals the plant's
// gust clip, and a later leaf reaction cannot accidentally close the window.
import {windowPlacement} from './wwwzard-window.js';
const round = n => +n.toFixed(3) || 0;
const path = points => 'M' + points.map(p => p.map(round).join(' ')).join('L') + 'Z';
const warp = (d, fn) => d.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g,
  pair => fn(...pair.split(/\s+/).map(Number)).map(round).join(' '));
const root = {id:'root',parent:null,x:0,y:0,rotation:0,min:-180,max:180,length:0};
const phases = [.2,.4,.6,.8];

// Author projected casement drawings around the right jamb. The free edge
// passes through an edge-on silhouette, then swings right, leaving a clear
// aperture around (365,160). No perspective or geometry work runs at playback.
const swing = (x, y, fraction) => {
  const u = (406-x)/76, angle = fraction * Math.PI * .56;
  return [406 + u*(-76*Math.cos(angle)+64*Math.sin(angle)),
    y + u*(42-42*Math.cos(angle)-35*Math.sin(angle))];
};
const rect = (u,v,w,h) => path([[u,v],[u+w,v],[u+w,v+h],[u,v+h]]
  .map(([x,y]) => [330+76*x,85+42*x+107*y]));
const shape = (id,d,fill,extra={}) => ({id,joint:'root',d,fill,...extra,
  spatial:{morph:{channel:'windowHinge.bend',target:warp(d,(x,y)=>swing(x,y,1)),
    frames:phases.map(value=>({value,target:warp(d,(x,y)=>swing(x,y,value))}))}}});
const clip = (duration, keys, loop=false) => ({duration,loop,tracks:{'windowHinge.bend':keys,'windowGlass.opacity':[[0,.18]]}});

export function addContactWindow(scene) {
  if(scene.packs.window) return scene;
  const room = scene.packs.room;
  const mullionIds = new Set(['window-mullion','window-mullion-shadow']);
  const mullions = room.parts.filter(part=>mullionIds.has(part.id));
  room.parts = room.parts.filter(part=>!mullionIds.has(part.id));
  const glass = shape('window-sash-glass',rect(.035,.035,.93,.93),'#d4edff',{opacityChannel:'windowGlass.opacity'});
  const parts = [glass,
    shape('window-sash-top',rect(0,0,1,.045),'#f5f5ff'),
    shape('window-sash-bottom',rect(0,.955,1,.045),'#c6cee9'),
    shape('window-sash-free-edge',rect(0,0,.055,1),'#ecedff'),
    shape('window-sash-hinge-edge',rect(.95,0,.05,1),'#c6ceeb'),
    ...mullions.map(({spatial,joint,...part})=>shape(part.id,part.d,part.fill,
      part.gradient?{gradient:part.gradient}:{})),
    shape('window-sash-latch',rect(.025,.47,.075,.12),'#b1abd9'),
    shape('window-sash-latch-light',rect(.025,.47,.037,.1),'#fbf8ff'),
  ];
  const clips = {
    'window-still':clip(1,[[0,0]],true),
    'window-open':clip(1.5,[[0,0],[.16,.03],[.52,.62],[.95,1],[1.2,.96],[1.5,1]]),
    'window-hold':clip(1,[[0,1]],true),
    'window-close':clip(1,[[0,1],[.2,.94],[.77,.08],[1,0]]),
  };
  scene.packs.window = {name:'Opening casement',spatial:true,joints:[root,
    {...root,id:'windowHinge',parent:'root'},{...root,id:'windowGlass',parent:'root'}],parts,inputs:{},clips,
    states:Object.fromEntries(Object.keys(clips).map(id=>[id,{clip:id,transitions:[]}])),
    initial:'window-still'};
  const roomActor = scene.actors.find(actor=>actor.id==='room');
  scene.actors.splice(scene.actors.indexOf(roomActor)+1,0,{id:'window',name:'Window casement',
    pack:'window',layer:'background',unlit:true,transform:{...windowPlacement}});
  // These clips use the existing foliage morph. A host graph can start this
  // room activity alongside window-open while the two actors keep ownership.
  room.clips['window-gust']={duration:1.5,loop:false,tracks:{
    'windLeft.bend':[[0,0],[.2,0],[.5,1],[.8,.4],[1.05,.6],[1.5,0]],
    'windRight.bend':[[0,0]],
  }};
  room.states['window-gust']={clip:'window-gust',transitions:[]};
  return scene;
}
