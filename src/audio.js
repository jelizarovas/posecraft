export function soundPattern(event){
 const key=event.type==='response'?event.to:event.type==='interaction'?event.interaction:event.type==='impact'?'impact':event.type==='transition'?'action':event.type;
 const patterns={tap:[540,330,.1,'sine'],pet:[440,880,.22,'sine'],happy:[520,1040,.22,'sine'],startle:[880,260,.18,'triangle'],scared:[740,320,.18,'triangle'],startled:[660,330,.14,'triangle'],bracing:[260,390,.12,'triangle'],protecting:[320,180,.16,'triangle'],curling:[300,160,.16,'triangle'],hurt:[230,95,.26,'triangle'],impact:[110,45,.13,'triangle'],relieved:[400,650,.24,'sine'],recovering:[290,490,.18,'sine'],drop:[520,170,.18,'sine'],toss:[260,700,.17,'sine'],catch:[320,640,.12,'sine'],action:[410,550,.09,'sine']};
 return patterns[key]||null;
}
export class SoundEffects {
 constructor({volume=.25,createContext}={}){this.volume=Math.max(0,Math.min(1,volume));this.createContext=createContext;this.enabled=false;this.context=null;this.voices=new Set();this.last=-Infinity;this.disposed=false;}
 async unlock(){
  if(this.disposed)return false;
  try{if(!this.context){const Context=globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context&&!this.createContext)return false;this.context=this.createContext?this.createContext():new Context();this.master=this.context.createGain();this.master.gain.value=this.volume;this.master.connect(this.context.destination);}
   await this.context.resume();if(this.disposed)return false;this.enabled=true;this.master.gain.value=this.volume;return this.context.state==='running';
  }catch{return false;}
 }
 setVolume(value){if(!Number.isFinite(value))throw new Error('Volume must be finite.');this.volume=Math.max(0,Math.min(1,value));if(this.master)this.master.gain.setTargetAtTime(this.enabled?this.volume:0,this.context.currentTime,.01);}
 mute(){this.enabled=false;if(this.master)this.master.gain.value=0;for(const v of this.voices){try{v.stop();}catch{}}this.voices.clear();}
 handle(event){
  const pattern=soundPattern(event);if(!pattern||!this.enabled||!this.context||this.context.state!=='running'||this.disposed)return false;
  const now=this.context.currentTime;if(now-this.last<.09||this.voices.size>=6)return false;this.last=now;
  const [from,to,duration,type]=pattern,osc=this.context.createOscillator(),gain=this.context.createGain();osc.type=type;osc.frequency.setValueAtTime(from,now);osc.frequency.exponentialRampToValueAtTime(to,now+duration);
  const strength=Math.max(.1,Math.min(1,event.strength??.65));gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(.28*strength,now+.008);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(gain);gain.connect(this.master);this.voices.add(osc);osc.onended=()=>{osc.disconnect();gain.disconnect();this.voices.delete(osc);};osc.start(now);osc.stop(now+duration+.02);return true;
 }
 dispose(){this.mute();this.disposed=true;this.master?.disconnect();if(this.context&&this.context.state!=='closed')this.context.close().catch(()=>{});}
}
