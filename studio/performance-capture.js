import {performanceFeatures,PerformanceRetargeter,assertTake,sampleTake} from '../src/performance.js';

// Owns the stream, worker and one bitmap in flight. No camera access until Start is clicked.
export class PerformanceCapture{
 constructor({preview,apply,notify}){
  this.preview=preview;this.apply=apply;this.notify=notify;this.token=0;this.take=null;this.recording=false;
  this.element=document.createElement('div');this.element.className='performance-capture';
  this.element.innerHTML=`<label class="field">Actor<select id="capture-actor"></select></label><video id="webcam" muted playsinline aria-label="Mirrored camera preview"></video><div class="director-buttons"><button id="camera-start">Enable camera</button><button id="camera-stop" disabled>Camera off</button></div><div class="director-buttons"><button id="capture-calibrate" disabled>Calibrate neutral</button><button id="capture-record" disabled>Record</button></div><p id="capture-status" class="capture-status" role="status">Camera off. Frames stay on this device.</p><label class="field">Review take<input id="take-scrub" type="range" min="0" max="1" step=".01" value="0" disabled></label><div class="director-buttons"><button id="take-play" disabled>Play take</button><button id="take-apply" disabled>Apply at playhead</button></div><div class="director-buttons"><button id="take-save" disabled>Save take</button><button id="take-open">Open take</button></div><input id="take-file" type="file" accept="application/json,.json" hidden><p class="note">Calibrate facing forward with relaxed arms. Act for up to 30 seconds. No microphone or video recording.</p><p id="capture-support" class="note"></p>`;
  this.$=id=>this.element.querySelector('#'+id);this.video=this.$('webcam');
  this.$('camera-start').onclick=()=>this.start();this.$('camera-stop').onclick=()=>this.stop();
  this.$('capture-calibrate').onclick=()=>{try{this.retarget.calibrate(this.features);this.$('capture-record').disabled=false;this.status('Calibrated. Rehearse or press Record.');}catch(e){this.status(e.message);}};
  this.$('capture-record').onclick=()=>{if(this.recording)this.finish();else{this.stopReview();this.take=null;this.frames=[];this.started=null;this.recording=true;this.$('capture-record').textContent='Stop recording';this.$('capture-calibrate').disabled=true;this.$('capture-actor').disabled=true;this.updateTake();this.status('Recording · 0.00 s');}};
  this.$('take-scrub').oninput=e=>{const t=+e.target.value;this.stop();this.review(t);};
  this.$('take-play').onclick=()=>{if(this.reviewing)return this.stopReview();this.stop();this.reviewing=true;this.$('take-play').textContent='Pause take';const start=performance.now();const tick=now=>{if(!this.reviewing)return;const t=Math.min(this.take.duration,(now-start)/1000);this.review(t);if(t===this.take.duration)this.stopReview();else this.reviewRAF=requestAnimationFrame(tick);};this.reviewRAF=requestAnimationFrame(tick);};
  this.$('take-apply').onclick=()=>{if(!this.take)return;this.stop();this.preview(null);this.apply(this.take);};
  this.$('take-save').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(this.take,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='performance.take.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
  this.$('take-open').onclick=()=>this.$('take-file').click();this.$('take-file').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw new Error('Take exceeds 2 MB.');const take=assertTake(JSON.parse(await file.text()),this.target.pack);this.stop();this.take=take;this.updateTake();this.review(0);this.status(`Loaded ${take.duration.toFixed(2)} s take.`);}catch(e){this.status(e.message);}this.$('take-file').value='';};
  this.$('capture-actor').onchange=e=>this.changeActor(e.target.value);
  window.addEventListener('pagehide',()=>this.stop());document.addEventListener('visibilitychange',()=>{if(document.hidden)this.stop();});
 }
 mount(container,target,changeActor){
  const signature=JSON.stringify(target.pack),context=target.shot+':'+target.actor;
  if(this.context!==context||this.signature!==signature){this.stop();if(this.signature!==signature)this.take=null;this.features=null;this.retarget=new PerformanceRetargeter(target.pack);this.$('capture-record').disabled=true;this.context=context;this.signature=signature;}
  this.target=target;this.changeActor=changeActor;const select=this.$('capture-actor');select.replaceChildren(...target.actors.map(a=>{const o=document.createElement('option');o.value=a.id;o.textContent=a.name;return o;}));select.value=target.actor;
  this.$('capture-support').textContent=target.pack.joints.some(j=>/Arm|Upper/.test(j.id))?'Head tilt, arm lifts, wrist turns and stepped expressions. Open, fist, point and pinch labels; no finger animation.':'This rig supports head tilt and expressions. It has no human arm or finger joints.';
  container.replaceChildren(this.element);this.updateTake();
 }
 status(text){this.$('capture-status').textContent=text;this.$('capture-status').classList.toggle('is-recording',this.recording);}
 updateTake(){for(const id of ['take-scrub','take-play','take-apply','take-save'])this.$(id).disabled=!this.take||this.recording;this.$('take-scrub').max=this.take?.duration||1;this.$('take-open').disabled=this.recording;}
 async start(){
  this.stop();this.retarget=new PerformanceRetargeter(this.target.pack);const token=++this.token;this.loading=true;this.$('camera-start').disabled=true;this.$('camera-stop').disabled=false;this.status('Requesting camera access…');
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw new Error('Camera requires HTTPS or localhost and a supported browser.');
   const stream=await navigator.mediaDevices.getUserMedia({video:{width:{ideal:640},height:{ideal:480},facingMode:'user'},audio:false});
   if(token!==this.token){stream.getTracks().forEach(t=>t.stop());return;}
   this.stream=stream;for(const track of stream.getTracks())track.onended=()=>{if(token===this.token){this.stop();this.status('Camera disconnected. Your completed take is still available.');}};
   this.video.srcObject=stream;await this.video.play();if(token!==this.token)return;
   this.status('Loading local face and hand models…');
   const worker=this.worker=new Worker(new URL('./vision-worker.js',import.meta.url),{type:'module'});
   this.timeout=setTimeout(()=>this.fail('Tracking took too long to load. Try again.'),60000);
   worker.onerror=e=>{if(token===this.token)this.fail(e.message||'Tracking worker failed.');};
   worker.onmessage=({data:m})=>{
    if(token!==this.token)return;
    if(m.type==='error'){this.fail(m.message);return;}
    if(m.type==='ready'){clearTimeout(this.timeout);this.loading=false;this.ready=true;this.status('Look at the camera, then calibrate neutral.');this.pump(token);return;}
    if(m.type==='result'){
     clearTimeout(this.frameTimeout);this.busy=false;this.features=performanceFeatures(m);this.$('capture-calibrate').disabled=!this.features.face||this.recording;
     if(this.retarget.neutral){const sample=this.retarget.sample(this.features,m.time/1000);this.latest=sample;this.preview(sample);
      if(this.recording){this.started??=m.time;const time=Math.min(30,(m.time-this.started)/1000);if(!this.frames.length||time>this.frames.at(-1).time)this.frames.push({time,...sample});this.status(`Recording · ${time.toFixed(2)} s · ${this.features.face?'face tracked':'face lost'}`);if(time>=30)this.finish();}
      else this.status(`${this.features.face?'Face tracked':'Face lost'} · L: ${sample.gestures.left} · R: ${sample.gestures.right} · ${m.computeMs.toFixed(0)} ms`);
     }else this.status(`${this.features.face?'Face found. Calibrate neutral.':'Keep your face in view.'} · ${m.hands.length} hands`);
    }
   };
   worker.postMessage({type:'init',base:new URL('vision',document.baseURI).href.replace(/\/$/,'')});
  }catch(e){if(token===this.token)this.fail(e.name==='NotAllowedError'?'Camera permission was denied. Enable it in browser settings and try again.':e.message);}
 }
 pump(token){
  let last=0,lastVideo=-1;
  const tick=async now=>{
   if(token!==this.token)return;this.raf=requestAnimationFrame(tick);
   if(this.busy||!this.ready||now-last<1000/15||this.video.readyState<2||this.video.currentTime===lastVideo)return;
   this.busy=true;last=now;lastVideo=this.video.currentTime;
   try{const scale=Math.min(1,640/this.video.videoWidth,480/this.video.videoHeight),bitmap=await createImageBitmap(this.video,{resizeWidth:Math.max(1,Math.round(this.video.videoWidth*scale)),resizeHeight:Math.max(1,Math.round(this.video.videoHeight*scale))});if(token!==this.token){bitmap.close();return;}
    this.frameTimeout=setTimeout(()=>this.fail('Tracking stopped responding. Camera closed; try again.'),10000);this.worker.postMessage({type:'frame',bitmap,time:now},[bitmap]);
   }catch(e){if(token===this.token)this.fail(e.message);}
  };this.raf=requestAnimationFrame(tick);
 }
 finish(){
  if(!this.recording)return;this.recording=false;this.$('capture-record').textContent='Record';this.$('capture-actor').disabled=false;this.$('capture-calibrate').disabled=!this.features?.face;
  if(this.frames.length>=2&&this.frames.at(-1).time>0){this.take={schemaVersion:1,kind:'performance-take',duration:this.frames.at(-1).time,frames:this.frames};this.status(`Take ready · ${this.take.duration.toFixed(2)} s. Review or apply at the playhead.`);}else this.status('Take was too short. Record at least two tracked frames.');this.updateTake();
 }
 stop(){
  this.finish();this.stopReview();++this.token;cancelAnimationFrame(this.raf);clearTimeout(this.timeout);clearTimeout(this.frameTimeout);this.worker?.terminate();this.worker=null;this.ready=false;this.busy=false;this.loading=false;
  this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;this.video.pause();this.video.srcObject=null;this.$('camera-start').disabled=false;this.$('camera-stop').disabled=true;this.$('capture-calibrate').disabled=true;this.$('capture-record').disabled=true;this.features=null;this.preview(null);this.status(this.take?`Camera off · ${this.take.duration.toFixed(2)} s take ready.`:'Camera off. Frames stay on this device.');
 }
 fail(message){this.stop();this.status(message);this.notify(message);}
 review(t){if(!this.take)return;this.$('take-scrub').value=t;this.preview(sampleTake(this.take,t));this.status(`Review · ${t.toFixed(2)} / ${this.take.duration.toFixed(2)} s`);}
 stopReview(){this.reviewing=false;cancelAnimationFrame(this.reviewRAF);this.$('take-play').textContent='Play take';}
}
