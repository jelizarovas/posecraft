import {clamp} from './index.js';
const number=v=>typeof v==='number'&&Number.isFinite(v);
export class MotionSignal{
 constructor(){this.reset();}
 reset(){this.gravity=null;this.last=0;this.value={ax:0,ay:0,turn:0};}
 update(event,time,screenAngle=0,sensitivity=1){
  const raw=event.acceleration,all=event.accelerationIncludingGravity,rotation=event.rotationRate;
  let x=0,y=0,valid=false;
  if(number(raw?.x)&&number(raw?.y)){x=raw.x;y=raw.y;valid=true;}
  else if(number(all?.x)&&number(all?.y)){
   this.gravity??={x:all.x,y:all.y};const dt=this.last?clamp((time-this.last)/1000,.001,.2):.016,a=1-Math.exp(-dt/.65);this.gravity.x+=(all.x-this.gravity.x)*a;this.gravity.y+=(all.y-this.gravity.y)*a;x=all.x-this.gravity.x;y=all.y-this.gravity.y;valid=true;
  }
  if(!valid&&![rotation?.alpha,rotation?.beta,rotation?.gamma].some(number))return false;
  const rx=number(rotation?.gamma)?rotation.gamma:0,ry=number(rotation?.beta)?rotation.beta:0,rz=number(rotation?.alpha)?rotation.alpha:0;
  const angle=screenAngle*Math.PI/180,dx=x*95+rx*2,dy=-y*95+ry*2;
  this.value={ax:clamp((dx*Math.cos(angle)-dy*Math.sin(angle))*sensitivity,-1800,1800),ay:clamp((dx*Math.sin(angle)+dy*Math.cos(angle))*sensitivity,-1800,1800),turn:clamp(rz*.035,-7,7)};this.last=time;return true;
 }
 sample(time){const decay=Math.exp(-Math.max(0,time-this.last-100)/120);return Object.fromEntries(Object.entries(this.value).map(([k,v])=>[k,v*decay]));}
}
export class PhoneMotion{
 constructor({onStatus=()=>{},environment=globalThis}={}){this.env=environment;this.onStatus=onStatus;this.signal=new MotionSignal();this.generation=0;this.enabled=false;this.sensitivity=1;}
 async enable(){
  this.disable();const token=++this.generation,api=this.env.DeviceMotionEvent;
  if(!api){this.onStatus('Motion sensors are unavailable here. Use Shake scene.');return false;}
  try{
   // iOS requires this call synchronously inside the button's user gesture.
   if(typeof api.requestPermission==='function'&&await api.requestPermission()!=='granted'){if(token===this.generation)this.onStatus('Motion permission denied. Use Shake scene.');return false;}
   if(token!==this.generation)return false;
   this.enabled=true;this.received=false;
   this.listener=e=>{if(this.signal.update(e,this.env.performance.now(),this.env.screen?.orientation?.angle??this.env.orientation??0,this.sensitivity)&&!this.received){this.received=true;clearTimeout(this.timer);this.onStatus('Phone motion on. Shake, then hold still to recover.');}};
   this.env.addEventListener('devicemotion',this.listener);this.onStatus('Waiting for phone motion…');this.timer=setTimeout(()=>{if(token===this.generation&&!this.received){this.disable();this.onStatus('No motion readings received. Use Shake scene or try a supported phone browser.');}},5000);return true;
  }catch{if(token===this.generation)this.onStatus('Could not enable phone motion. Use Shake scene.');return false;}
 }
 disable(){++this.generation;clearTimeout(this.timer);if(this.listener)this.env.removeEventListener('devicemotion',this.listener);this.listener=null;this.enabled=false;this.signal.reset();}
}
