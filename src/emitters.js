import {nodeVisible} from './scene-graph.js';

export const MAX_EMITTER_PARTICLES=128;
export const MAX_SCENE_PARTICLES=512;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
// Integer hashes address births directly, so seeking never simulates the past.
function random(seed,index,salt=0){let x=(seed^Math.imul(index+1,0x9e3779b1)^Math.imul(salt+1,0x85ebca6b))>>>0;x^=x>>>16;x=Math.imul(x,0x7feb352d);x^=x>>>15;x=Math.imul(x,0x846ca68b);return ((x^(x>>>16))>>>0)/4294967296;}
function tint(color,mix){const value=parseInt(color.slice(1),16),channels=[value>>16,(value>>8)&255,value&255];return '#'+channels.map(c=>Math.round(c+(255-c)*mix).toString(16).padStart(2,'0')).join('');}
export function emitterCapacity(emitter){return Math.min(emitter.type==='flame'?3:MAX_EMITTER_PARTICLES,Math.max(0,Math.floor(emitter.maxParticles)));}
export function emitterPulse(emitter,time){if(!Number.isFinite(time))throw Error('Emitter time must be finite.');if(!emitter.enabled||emitter.hidden||emitter.rate<=0)return 0;const phase=random(emitter.seed,0,19)*Math.PI*2,t=Math.max(0,time)*emitter.rate;return 1+clamp(emitter.randomness,0,1)*(.24*Math.sin(t*6.283185+phase)+.16*Math.sin(t*3.37+phase*2));}
export function sampleEmitter(emitter,time,capacity=emitterCapacity(emitter)){
 if(!Number.isFinite(time))throw Error('Emitter time must be finite.');
 const e=emitter,t=Math.max(0,time),count=Math.min(emitterCapacity(e),Math.max(0,Math.floor(capacity))),particles=Array.from({length:count},(_,slot)=>({slot,birth:0,x:e.x,y:e.y,scaleX:0,scaleY:0,rotation:0,opacity:0,color:e.color,kind:e.type==='embers'?'ember':e.type}));
 if(!e.enabled||e.hidden||e.rate<=0||e.lifetime<=0||e.opacity<=0||!count)return particles;
 const variation=clamp(e.randomness,0,1);
 if(e.type==='flame'){
  const pulse=emitterPulse(e,t);
  for(const p of particles){const i=p.slot,phase=random(e.seed,i,1)*Math.PI*2,osc=Math.sin(t*e.rate*2*Math.PI+phase)*.6+Math.sin(t*e.rate*3.37+phase*2)*.4;const size=e.size*(1-i*.21);p.x=e.x+Math.sin(t*e.rate*1.7+phase)*e.spread*.12*variation;p.y=e.y-i*e.size*.012;p.scaleX=size*(1+osc*.13*variation);p.scaleY=size*(.65+.35*pulse)*(1+osc*.1*variation);p.rotation=osc*8*variation;p.opacity=e.opacity*(.88+i*.04);p.color=tint(e.color,i*.27);}
  return particles;
 }
 const current=Math.floor(t*e.rate),life=e.lifetime;
 for(const p of particles){let index=current-((current-p.slot)%count+count)%count;if(index<0)continue;const birthAt=n=>(n+random(e.seed,n,0)*variation*.85)/e.rate;let birth=birthAt(index);if(birth>t){index-=count;if(index<0)continue;birth=birthAt(index);}const age=t-birth;if(age<0||age>=life)continue;
  const progress=age/life,drift=(random(e.seed,index,1)*2-1)*variation,spread=(random(e.seed,index,2)*2-1)*e.spread*variation,velocity=e.speed*(1+(random(e.seed,index,3)*2-1)*variation*.35),sway=Math.sin(age*(1.1+random(e.seed,index,4))+random(e.seed,index,5)*6.28)*e.spread*.25*variation;
  p.birth=birth;p.x=e.x+spread+drift*velocity*age*.24+sway*Math.min(1,age);p.y=e.y-velocity*age;p.rotation=(random(e.seed,index,6)*2-1)*variation*30;
  const size=e.size*(1+(random(e.seed,index,7)*2-1)*variation*.28);p.scaleX=size*(e.type==='smoke'?.5+progress*1.1:1-progress*.65);p.scaleY=p.scaleX*(e.type==='smoke'?.8:1.45);p.opacity=e.opacity*Math.min(1,age/(e.type==='smoke'?.35:.08))*Math.pow(1-progress,e.type==='smoke'?1.3:.65);if(e.type==='embers')p.color=tint(e.color,random(e.seed,index,8)*.2);
 }
 return particles;
}
export function sampleEmitters(document,time){let remaining=MAX_SCENE_PARTICLES;return (document.emitters||[]).map(emitter=>{const capacity=Math.min(remaining,emitterCapacity(emitter));remaining-=capacity;const actor=emitter.actor&&document.actors.find(a=>a.id===emitter.actor),visible=nodeVisible(document,emitter)&&(!emitter.actor||actor&&nodeVisible(document,actor));return {emitter,particles:sampleEmitter(visible?emitter:{...emitter,enabled:false},time,capacity)};});}
