import {rendererPoint,rendererHit} from './render-input.js';
import {PhoneMotion} from './device-motion.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),finite=v=>typeof v==='number'&&Number.isFinite(v);
/** Screen-space gravity and acceleration remain separate: steady tilt is not a shake. */
export class BottleMotionSignal{
 constructor(){this.reset();}
 reset(){this.last=null;this.gravity=null;this.value={ax:0,ay:0,turn:0,gravityX:0,gravityY:1};}
 update(event,time,screenAngle=0,sensitivity=1){
  const raw=event.acceleration,all=event.accelerationIncludingGravity,rotation=event.rotationRate,hasRaw=finite(raw?.x)&&finite(raw?.y),hasAll=finite(all?.x)&&finite(all?.y),hasTurn=finite(rotation?.alpha);
  if(!hasRaw&&!hasAll&&!hasTurn)return false;
  const dt=this.last===null?.016:clamp((time-this.last)/1000,.001,.2),blend=1-Math.exp(-dt/.2);
  if(hasAll){const gx=all.x-(hasRaw?raw.x:0),gy=all.y-(hasRaw?raw.y:0);if(!this.gravity)this.gravity={x:gx,y:gy};else{this.gravity.x+=(gx-this.gravity.x)*blend;this.gravity.y+=(gy-this.gravity.y)*blend;}}
  const x=hasRaw?raw.x:hasAll?all.x-this.gravity.x:0,y=hasRaw?raw.y:hasAll?all.y-this.gravity.y:0,a=screenAngle*Math.PI/180,c=Math.cos(a),s=Math.sin(a),screen=(x,y)=>({x:x*c-y*s,y:x*s+y*c});
  const motion=screen(x,-y),g=screen(-(this.gravity?.x||0),this.gravity?.y||0),length=Math.hypot(g.x,g.y);
  this.value={ax:clamp(motion.x*85*sensitivity,-1800,1800),ay:clamp(motion.y*85*sensitivity,-1800,1800),turn:clamp(-(hasTurn?rotation.alpha:0)*sensitivity,-180,180)||0,gravityX:length>2?(g.x/length||0):0,gravityY:length>2?g.y/length:1};this.last=time;return true;
 }
 sample(time){const decay=this.last===null?0:Math.exp(-Math.max(0,time-this.last-100)/150);return {...this.value,ax:this.value.ax*decay,ay:this.value.ay*decay,turn:this.value.turn*decay};}
}
/** One grab point hangs freely; a second point supplies an orientation constraint. */
export function mountBottleControls(element,document,controller,{isEnabled=()=>true,onInteract=()=>{},onUpdate=()=>{},onStatus=()=>{}}={}){
 if(!document.fluid)return {dispose(){},enableMotion:async()=>false,disableMotion(){},get motionEnabled(){return false;}};
 const points=new Map(),originalTouch=element.style.touchAction,originalTab=element.getAttribute('tabindex');let disposed=false,raf=0,lastSensor=0,lastReading=null;const config=document.fluid;
 element.style.touchAction='none';element.tabIndex=0;
 const point=e=>{const p=rendererPoint(element,e);return p?{id:e.pointerId,x:clamp(p.x,-10000,10000),y:clamp(p.y,-10000,10000)}:null;};
 const send=type=>{controller.fluidInput({type,points:[...points.values()]});onUpdate();};
 function down(e){if(!isEnabled()||e.button!==0||points.size>=2||points.has(e.pointerId))return;const actor=rendererHit(element,e)?.actor||e.target.closest?.('[data-actor]')?.dataset.actor;if(!points.size&&actor!==config.vessel&&actor!==config.contents)return;const p=point(e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();points.set(e.pointerId,p);if(e.shiftKey&&e.pointerType==='mouse')points.set(2147483647,{id:2147483647,x:p.x+80,y:p.y});element.focus({preventScroll:true});try{element.setPointerCapture(e.pointerId);}catch{}onInteract();send('grab');}
 function move(e){if(!points.has(e.pointerId))return;const p=point(e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();points.set(e.pointerId,p);if(points.has(2147483647))points.set(2147483647,{id:2147483647,x:p.x+80,y:p.y});send('move');}
 function end(e){if(!points.has(e.pointerId))return;e.preventDefault();e.stopImmediatePropagation();if(e.type==='pointercancel'){cancel();return;}points.delete(e.pointerId);points.delete(2147483647);send(e.type==='pointercancel'?'cancel':'release');if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);}
 function cancel(){if(points.size){const ids=[...points.keys()];points.clear();send('cancel');for(const id of ids)if(element.hasPointerCapture(id))element.releasePointerCapture(id);}}
 const phone=new PhoneMotion({signal:new BottleMotionSignal(),onStatus:message=>{message=message.replaceAll('Use Shake scene','Drag the bottle').replace('Shake, then hold still to recover.','Tilt or swing your phone.');onStatus(message);element.dispatchEvent(new CustomEvent('posecraft-motion',{detail:{enabled:phone.enabled,message}}));}});
 function sensorTick(now){raf=0;if(disposed||!phone.enabled)return;if(isEnabled()&&!globalThis.document.hidden&&now-lastSensor>=30){lastSensor=now;const reading=Object.fromEntries(Object.entries(phone.signal.sample(now)).map(([key,value])=>[key,Math.round(value*1000)/1000])),signature=JSON.stringify(reading);if(signature!==lastReading){lastReading=signature;controller.fluidInput({type:'motion',...reading});onUpdate();}}raf=requestAnimationFrame(sensorTick);}
 function disableMotion(){phone.disable();cancelAnimationFrame(raf);raf=0;lastReading=null;lastSensor=0;if(!disposed)controller.fluidInput({type:'motion',ax:0,ay:0,turn:0,gravityX:0,gravityY:1});}
 const visibility=()=>{if(globalThis.document.hidden){cancel();disableMotion();}};
 function key(e){if(!isEnabled())return;if(e.key==='Escape'){cancel();return;}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();e.stopImmediatePropagation();onInteract();controller.fluidInput({type:'nudge',ax:e.key==='ArrowLeft'?-700:e.key==='ArrowRight'?700:0,ay:e.key==='ArrowUp'?-700:e.key==='ArrowDown'?700:0});onUpdate();}
 const listeners=[['keydown',key],['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['lostpointercapture',e=>{if(points.has(e.pointerId)){points.delete(e.pointerId);send('release');}}]];
 for(const [type,fn] of listeners)element.addEventListener(type,fn,true);globalThis.addEventListener('blur',cancel);globalThis.document.addEventListener('visibilitychange',visibility);
 return {async enableMotion(){onInteract();const enabled=await phone.enable();if(disposed){phone.disable();return false;}if(enabled&&!raf)raf=requestAnimationFrame(sensorTick);return enabled;},disableMotion,get motionEnabled(){return phone.enabled;},dispose(){if(disposed)return;cancel();disableMotion();disposed=true;element.style.touchAction=originalTouch;if(originalTab===null)element.removeAttribute('tabindex');else element.setAttribute('tabindex',originalTab);for(const [type,fn]of listeners)element.removeEventListener(type,fn,true);globalThis.removeEventListener('blur',cancel);globalThis.document.removeEventListener('visibilitychange',visibility);}};
}
