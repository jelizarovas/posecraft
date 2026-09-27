import {pathBounds,parseTransform,placementMatrix,multiplyMatrix,transformPoint} from './render-geometry.js';
const clamp=v=>Math.max(0,Math.min(1,v)),record=v=>v&&typeof v==='object'&&!Array.isArray(v),fields=(v,keys)=>record(v)&&Object.keys(v).every(k=>keys.includes(k)),color=v=>typeof v==='string'&&/^#[\da-f]{6}$/i.test(v),finite=(v,min,max)=>Number.isFinite(v)&&v>=min&&v<=max;
export function validateMaterialLighting(doc,check){
 const config=doc.materialLighting;if(config===undefined)return;
 const signal=(value,path)=>{const actor=doc.actors.find(a=>a.id===value?.actor),pack=doc.packs[actor?.pack],at=typeof value?.channel==='string'?value.channel.lastIndexOf('.'):-1,joint=value?.channel?.slice?.(0,at),channel=value?.channel?.slice?.(at+1);check(fields(value,['actor','channel','invert'])&&pack?.joints.some(j=>j.id===joint)&&['rotation','x','y','opacity','yaw','pitch','bend'].includes(channel)&&(value.invert===undefined||typeof value.invert==='boolean'),path,'Expected an existing normalized pose channel and optional inversion.');};
 check(fields(config,['weight','ambient','tint','actors','lights']),'materialLighting','Unknown material lighting field.');if(!record(config))return;
 signal(config.weight,'materialLighting.weight');check(finite(config.ambient,0,1),'materialLighting.ambient','Expected ambient strength 0..1.');check(color(config.tint),'materialLighting.tint','Expected six-digit tint.');
 if(config.actors!==undefined)check(Array.isArray(config.actors)&&config.actors.length<=32&&new Set(config.actors).size===config.actors.length&&config.actors.every(id=>doc.actors.some(a=>a.id===id)),'materialLighting.actors','Expected distinct scene actors.');
 check(Array.isArray(config.lights)&&config.lights.length<=2,'materialLighting.lights','Expected up to two material lights.');
 for(const [i,l]of(Array.isArray(config.lights)?config.lights:[]).entries()){
  const p='materialLighting.lights.'+i;check(fields(l,['type','actor','x','y','range','angle','color','intensity','gains','flicker','actors','emission','highlights'])&&['directional','point'].includes(l?.type),p,'Expected a directional or point material light.');if(!record(l))continue;
  check(color(l.color),p+'.color','Expected six-digit light color.');check(finite(l.intensity,0,2),p+'.intensity','Expected intensity 0..2.');if(l.flicker!==undefined)check(finite(l.flicker,0,1),p+'.flicker','Expected flicker 0..1.');
  if(l.type==='directional')check(finite(l.angle,-180,180),p+'.angle','Expected direction -180..180.');
  else{check(finite(l.x,-10000,10000)&&finite(l.y,-10000,10000)&&finite(l.range,1,4000),p,'Point lights need finite coordinates and reach 1..4000.');if(l.actor!==undefined)check(doc.actors.some(a=>a.id===l.actor),p+'.actor','Missing light actor.');}
  if(l.actors!==undefined)check(Array.isArray(l.actors)&&l.actors.length<=32&&new Set(l.actors).size===l.actors.length&&l.actors.every(id=>doc.actors.some(a=>a.id===id)),p+'.actors','Expected distinct light receiver actors.');
  for(const field of ['emission','highlights'])if(l[field]!==undefined){const e=l[field],a=doc.actors.find(a=>a.id===e?.actor),pack=doc.packs[a?.pack];check(fields(e,['actor','parts'])&&!!pack&&Array.isArray(e.parts)&&e.parts.length>0&&e.parts.length<=128&&new Set(e.parts).size===e.parts.length&&e.parts.every(id=>pack.parts.some(part=>part.id===id)),p+'.'+field,'Expected an artwork actor and 1..128 distinct part IDs.');}
  if(l.gains!==undefined){check(Array.isArray(l.gains)&&l.gains.length<=2,p+'.gains','Expected up to two multiplied gain channels.');for(const [j,g]of(Array.isArray(l.gains)?l.gains:[]).entries())signal(g,p+'.gains.'+j);}
 }
}
const rgb=hex=>{if(!/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(hex))return null;const s=hex.length===4?hex.slice(1).split('').map(v=>v+v).join(''):hex.slice(1);return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16));};
const sampled=new WeakMap(),materials=new WeakMap();
/** Two bounded light samples. No DOM, layout reads, physics or wall clock. */
export function sampleMaterialLighting(doc,frame){
 const c=doc.materialLighting;if(!c)return null;const source=s=>{const value=clamp(frame.actors.find(a=>a.id===s.actor)?.pose[s.channel]??0);return s.invert?1-value:value;},weight=source(c.weight);if(!weight)return null;
 const time=Math.floor((frame.effectsTime??frame.localTime??frame.time??0)*30)/30,lights=c.lights.map(l=>{
  const intensity=l.intensity*(l.gains||[]).reduce((v,g)=>v*source(g),1)*(1-(l.flicker||0)*(.5+.3*Math.sin(time*13)+.2*Math.sin(time*23+1)));
  const position=l.actor?(frame.actors.find(a=>a.id===l.actor)?.placement||doc.actors.find(a=>a.id===l.actor).transform):null,p=position?transformPoint(placementMatrix(position),l.x,l.y):{x:l.x,y:l.y};
  return {...l,...p,intensity,rgb:rgb(l.color),dx:Math.cos(l.angle*Math.PI/180),dy:Math.sin(l.angle*Math.PI/180)};
 });
 const key=JSON.stringify([c,weight,lights.map(l=>[l.x,l.y,l.intensity])]),previous=sampled.get(doc);if(previous?.key===key)return previous.value;
 const value={weight,ambient:c.ambient,tint:rgb(c.tint),actors:c.actors?new Set(c.actors):null,lights};sampled.set(doc,{key,value});return value;
}
/** Relight authored stops in place; their topology, offsets and direction stay authored. */
export function materialAppearance(state,part,actor,evaluated,paint,spatial){
 if(!state||state.actors&&!state.actors.has(actor.id))return paint;
 // Shade the displayed contour, including captured interruption blends.
 const displayed=spatial?.parts.get(part.id)?.d??paint.d;
 let cache=materials.get(part);if(!cache||cache.d!==displayed||cache.gradient!==paint.gradient||cache.transform!==paint.transform||cache.fill!==paint.fill){cache={d:displayed,gradient:paint.gradient,transform:paint.transform,fill:paint.fill,bounds:pathBounds(displayed),matrix:parseTransform(paint.transform),colors:paint.gradient?paint.gradient.stops.map(([,c])=>rgb(c)):[rgb(paint.fill)]};materials.set(part,cache);}
 const joint=spatial?.parts.get(part.id)?.matrix||placementMatrix({...evaluated.world[part.joint],scale:1}),matrix=multiplyMatrix(placementMatrix(evaluated.placement||actor.transform),multiplyMatrix(joint,cache.matrix)),b=cache.bounds,center=transformPoint(matrix,(b.minX+b.maxX)/2,(b.minY+b.maxY)/2),g=paint.gradient;
 const shade=(base,index,offset)=>{if(!base)return index===undefined?paint.fill:g.stops[index][1];const u=g?g.x1+(g.x2-g.x1)*offset:.5,v=g?g.y1+(g.y2-g.y1)*offset:.5,p=transformPoint(matrix,b.minX+b.width*u,b.minY+b.height*v),nx=p.x-center.x,ny=p.y-center.y,length=Math.hypot(nx,ny)||1;
  const result=base.map((value,i)=>value*state.ambient*.92+state.tint[i]*(1-state.ambient)*.08);
  for(const l of state.lights){if(l.actors&&!l.actors.includes(actor.id))continue;let power;if(l.type==='directional')power=l.intensity*(.08+.92*Math.max(0,(nx*l.dx+ny*l.dy)/length)**2);else{const distance=Math.hypot(l.x-p.x,l.y-p.y);power=l.intensity/(1+(distance/l.range)**2)**2;}for(let i=0;i<3;i++)result[i]+=base[i]*(l.rgb[i]/255)*power*1.6;
   if(l.highlights?.actor===actor.id&&l.highlights.parts.includes(part.id))for(let i=0;i<3;i++)result[i]+=l.rgb[i]*power*1.1;
   if(l.emission?.actor===actor.id&&l.emission.parts.includes(part.id))for(let i=0;i<3;i++)result[i]+=l.rgb[i]*l.intensity*.8;}
  return '#'+result.map((value,i)=>Math.round(Math.max(0,Math.min(255,base[i]+(value-base[i])*state.weight))).toString(16).padStart(2,'0')).join('');
 };
 return g?{...paint,gradient:{...g,stops:g.stops.map(([offset],i)=>[offset,shade(cache.colors[i],i,offset)])}}:{...paint,fill:shade(cache.colors[0])};
}
