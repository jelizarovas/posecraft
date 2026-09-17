import {sampleClip,forwardKinematics,clamp} from './index.js';
import {poseDefaults,spatialKinematics} from './spatial.js';
const rad=Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},blend=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
export const ensembleEvents=['conversation','doze','meteor','share','share-missed','share-help','burn','fire-off','fire-relight','fire-on','food-throw','face-shoo'];
const turn=(from,to,t)=>from+(((to-from+540)%360)-180)*ease(t);
const screen=(placement,point)=>{const r=placement.rotation*rad;return {x:placement.x+placement.scale*(Math.cos(r)*point.x-Math.sin(r)*point.y),y:placement.y+placement.scale*(Math.sin(r)*point.x+Math.cos(r)*point.y)};};
function solve(shoulder,hand,bend){const dx=hand.x-shoulder.x,dy=hand.y-shoulder.y,d=Math.max(.001,Math.hypot(dx,dy)),reach=Math.min(d,51.8),target={x:shoulder.x+dx/d*reach,y:shoulder.y+dy/d*reach},h=Math.sqrt(Math.max(0,676-reach*reach/4)),elbow={x:(shoulder.x+target.x)/2-dy/d*h*bend,y:(shoulder.y+target.y)/2+dx/d*h*bend},upper=Math.atan2(elbow.y-shoulder.y,elbow.x-shoulder.x)/rad,lower=Math.atan2(target.y-elbow.y,target.x-elbow.x)/rad;return {upper,lower:((lower-upper+540)%360)-180,hand:((540-lower)%360)-180,target};}
// A bounded, seeded example director. Clips supply the mechanics; attention and
// heat determine when they run. No wall-clock timers or per-frame random draws.
export class CampfireEnsemble {
 constructor(document){this.document=document;this.config=document.ensemble;this.reset();}
 reset(){this.emitterStates=new Map();const lit=this.sourceAvailable();this.graphEvents=lit?[]:[{event:'extinguish-fire'}];this.fire={lit,phase:lit?'lit':'cold',at:0,changedAt:lit?-1:0,actor:null,recoveryRequested:false,blocked:false};this.rng=this.config.seed>>>0;this.tickIndex=0;this.time=0;this.nextSocial=3;this.nextMeteor=8;this.meteors=[];this.recent=[];this.share=null;this.nextShare=50;this.members=this.config.members.map((id,i)=>({id,index:i,heat:[.45,.05,.3,.6][i],stage:null,burned:false,mode:i===2?'stars':'fire',until:i===2?6:0,partner:null,look:{yaw:0,pitch:0,roll:0},lookBefore:{yaw:0,pitch:0,roll:0},lookVelocity:{yaw:0,pitch:0,roll:0},retired:false}));}
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 event(type,actors,detail=''){this.recent.push({type,actors,time:this.time,detail});if(this.recent.length>32)this.recent.shift();}
 drainEvents(){const events=this.graphEvents;this.graphEvents=[];return events;}
 trigger(type,payload={}){if(!ensembleEvents.includes(type))throw new Error('Unknown ensemble event.');if(type==='fire-off')this.extinguish();else if(type==='fire-relight')this.fire.recoveryRequested=true;else if(type==='fire-on')this.ignite();else if(type==='food-throw'||type==='face-shoo')this.react(type,payload);else if(type==='meteor')this.meteor();else if(type.startsWith('share'))this.offer(true,type);else if(type==='burn'){const a=this.members.find(a=>!a.retired&&!this.inShare(a));if(a)this.burn(a,'demo');}else if(type==='conversation')this.talk();else{const a=this.members.find(a=>!a.retired&&a.stage===null);if(a){a.mode='dozing';a.until=this.time+8;this.event('doze',[a.id]);}}}
 talk(){const available=this.members.filter(a=>!a.retired&&a.stage===null&&!this.share&&!this.inFire(a));if(available.length<2)return;const a=available[Math.floor(this.random()*available.length)],others=available.filter(b=>b!==a),b=others[Math.floor(this.random()*others.length)],duration=8+this.random()*7;for(const [actor,partner] of [[a,b],[b,a]]){actor.mode='conversation';actor.partner=partner.id;actor.until=this.time+duration;}this.event('conversation',[a.id,b.id]);}
 meteor(){const reverse=this.random()<.35,start={x:reverse?720:70,y:25+this.random()*35},end={x:reverse?110:720,y:135+this.random()*30},watchers=this.members.filter(a=>!a.retired&&a.stage===null&&!this.inFire(a)),noticer=watchers[Math.floor(this.random()*watchers.length)]?.id;this.meteors.push({start,end,at:this.time,duration:3.8,noticer});this.meteors=this.meteors.slice(-2);this.nextMeteor=this.time+22+this.random()*26;this.event('meteor',noticer?[noticer]:[]);}
 inShare(a){return !!this.share&&[this.share.giver,this.share.receiver].includes(a.id);}
 basePose(a,stage){const actor=this.document.actors.find(v=>v.id===a.id),pack=this.document.packs[actor.pack];return {...poseDefaults(pack),...sampleClip({...pack.clips.campfire,loop:false},(stage-a.index*5+24)%24)};}
 burn(a,reason){if(!this.fire.lit)return;a.heat=1.04;a.burned=true;a.stage=12;a.startleAt=this.time;a.mode='fire';this.event('burn',[a.id],reason);this.event('burn-startle',[a.id]);}
 offer(force=false,scenario='natural'){
  if(this.share)return;const a=scenario==='natural'?(this.members.find(v=>!v.retired&&v.stage>=16&&v.stage<17)||this.members[0]):this.members[1],others=this.members.filter(v=>v!==a&&!v.retired&&!this.inFire(v)),b=scenario==='natural'?others[Math.floor(this.random()*others.length)]:this.members[3];if(!b||a.retired||b.retired||this.inFire(a)||this.inFire(b)||!force&&(a.stage===null||a.stage<16||a.stage>17||b.stage===null||b.stage<19))return;
  const giver=this.document.actors.find(v=>v.id===a.id),receiver=this.document.actors.find(v=>v.id===b.id),direction=receiver.transform.x>=giver.transform.x?1:-1,distance=Math.hypot(receiver.transform.x-giver.transform.x,receiver.transform.y-giver.transform.y),needsWalk=distance>110;
  const destination=needsWalk?{x:giver.transform.x+direction*104,y:giver.transform.y}: {...receiver.transform};
  const observer=this.members.find(v=>v!==a&&v!==b&&!v.retired),naturalNotice=this.random()<.65;
  const arm=(actor,side)=>this.document.packs[actor.pack].joints.find(j=>j.id==='hold-upper').x*side>0?'hold':'take';
  this.share={prepareDuration:scenario==='natural'?1.1:3.1,prepareStage:scenario==='natural'?a.stage:13.5,transferAt:scenario==='natural'?0:2,giver:a.id,receiver:b.id,giverHand:arm(giver,direction),receiverHand:arm(receiver,-direction),observer:observer?.id,scenario,phase:'prepare',phaseAt:this.time,at:this.time,owner:a.id,noticed:false,contact:null,noticeDelay:scenario==='share'?1.3:scenario==='share-help'?Infinity:scenario==='share-missed'?Infinity:naturalNotice?1.4+this.random()*1.5:Infinity,helpAt:scenario==='share-help'?2.8:scenario==='natural'&&!naturalNotice&&this.random()<.5?3.1:Infinity,direction,needsWalk,destination,origin:{...receiver.transform},walkDuration:needsWalk?Math.max(1.6,Math.min(5,distance/60)):0};
  a.stage=this.share.prepareStage;a.mode='offering';a.burned=false;this.event('share',[a.id,b.id],'preparing an offer');
 }
 sharePhase(phase){this.share.phase=phase;this.share.phaseAt=this.time;}
 finishShare(){const s=this.share;for(const a of this.members)if([s.giver,s.receiver].includes(a.id)){a.stage=20;a.mode='fire';a.heat=0;a.burned=false;}this.share=null;}
 tickShare(){
  const s=this.share;if(!s)return;const giver=this.members.find(a=>a.id===s.giver),receiver=this.members.find(a=>a.id===s.receiver),age=this.time-s.phaseAt;
  if(giver.retired||receiver.retired){this.event('share-cancelled',[s.giver,s.receiver]);this.finishShare();return;}
  if(s.phase==='prepare'&&age>=s.prepareDuration){this.sharePhase('offer');this.event('offer',[s.giver,s.receiver]);}
  else if(s.phase==='offer'){
   if(!s.helped&&age>=s.helpAt&&s.observer){s.helped=true;s.noticeDelay=age+.55;const observer=this.members.find(a=>a.id===s.observer);observer.helpUntil=this.time+1.1;observer.partner=s.receiver;this.event('help',[s.observer,s.receiver], 'calling attention to the offer');}
   if(age>=s.noticeDelay){s.noticed=true;receiver.mode='noticing';receiver.stage=19;s.noticeAt=this.time;this.sharePhase('notice');this.event('notice',[s.receiver,s.giver]);}
   else if(age>=5.4){s.failed=true;this.sharePhase('disappointed');this.event('share-failed',[s.giver,s.receiver],'offer went unnoticed');}
  }else if(s.phase==='notice'&&age>=.8){this.sharePhase(s.needsWalk?'approach':'handoff');if(s.needsWalk)this.event('approach',[s.receiver,s.giver]);}
  else if(s.phase==='approach'&&age>=s.walkDuration){this.sharePhase('handoff');}
  else if(s.phase==='handoff'){
   const hands=[giver,receiver].map(a=>{const f={pose:this.basePose(a,16.5),placement:{...this.document.actors.find(v=>v.id===a.id).transform}};this.sharePose(a,f,this.time);const w=spatialKinematics(this.document.packs[this.document.actors.find(v=>v.id===a.id).pack],f.pose);return screen(f.placement,w[(a.id===s.giver?s.giverHand:s.receiverHand)+'-hand']);});s.contact=Math.hypot(hands[0].x-hands[1].x,hands[0].y-hands[1].y);
   if(age>=1.15&&s.contact<=3){s.owner=s.receiver;this.event('handoff',[s.giver,s.receiver],`contact ${s.contact.toFixed(3)}px`);this.sharePhase('eat');}
   else if(age>3){s.failed=true;this.sharePhase('disappointed');this.event('share-failed',[s.giver,s.receiver],'could not reach the offered food');}
  }else if(s.phase==='eat'&&age>=3){s.owner=null;this.sharePhase('return');}
  else if(s.phase==='disappointed'&&age>=1.2){this.sharePhase('toss');this.event('toss',[s.giver],'into the fire');}
  else if(s.phase==='toss'){if(age>=.4)s.owner=null;if(age>=1.8)this.sharePhase('return');}
  else if(s.phase==='return'&&age>=s.walkDuration+1.2)this.finishShare();
 }
 sharePose(a,f,time){
  const s=this.share;if(!s||![s.giver,s.receiver].includes(a.id))return null;
  const giver=a.id===s.giver,actor=this.document.actors.find(v=>v.id===a.id),pack=this.document.packs[actor.pack],pose=f.pose,age=time-s.phaseAt,originalYaw=pack.clips.campfire.tracks['root.yaw'][0][1],side=giver?s.direction:-s.direction,stableYaw=side*20,phase=s.phase;
  if(phase==='prepare'&&!giver||!giver&&!s.noticed)return null;
  let facing=giver?ease((time-s.at)/s.prepareDuration):phase==='notice'?ease(age/.8):1;
  if(phase==='return')facing*=1-ease((age-s.walkDuration)/1.2);
  pose['root.yaw']=turn(originalYaw,stableYaw,facing);pose['root.rotation']=0;pose['root.pitch']=0;
  const cos=Math.cos(pose['root.yaw']*rad),safeCos=Math.abs(cos)<.2?Math.sign(cos||1)*.2:cos;
  const local=point=>{const dx=(point.x-f.placement.x)/actor.transform.scale,dy=(point.y-f.placement.y)/actor.transform.scale,r=-f.placement.rotation*rad;return {x:(dx*Math.cos(r)-dy*Math.sin(r))/safeCos,y:dx*Math.sin(r)+dy*Math.cos(r)};};
  const setHand=(name,target)=>{const shoulder=pack.joints.find(j=>j.id===name+'-upper'),solved=solve(shoulder,target,shoulder.x>0?-1:1);for(const id of [name+'-upper',name+'-elbow',name+'-hand']){pose[id+'.yaw']=0;pose[id+'.pitch']=0;}pose[name+'-upper.rotation']=solved.upper;pose[name+'-elbow.rotation']=solved.lower;pose[name+'-hand.rotation']=solved.hand;pose[name+'-upper.z']=45;return solved.target;};
  const path=t=>{const u=ease(t),start=s.origin,end=s.destination,dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy)||1,n={x:-dy/length,y:dx/length},away=((start.x+end.x)/2-400)*n.x+((start.y+end.y)/2-315)*n.y>=0?1:-1,arc=Math.sin(Math.PI*u)*Math.min(70,length*.6)*away;return {x:lerp(start.x,end.x,u)+n.x*arc,y:lerp(start.y,end.y,u)+n.y*arc};};
  let walking=0;
  if(!giver&&s.noticed&&phase!=='notice'){
   let p=s.destination;if(phase==='approach'){const t=clamp(age/s.walkDuration,0,1);p=path(t);walking=Math.sin(Math.PI*t);}
   else if(phase==='return'){const t=clamp(age/Math.max(.01,s.walkDuration),0,1);p=path(1-t);walking=Math.sin(Math.PI*t);}
   f.placement.x=p.x;f.placement.y=p.y-(4+Math.sin(time*10)*1.5)*walking;f.groundY=(actor.groundY??actor.transform.y+58*actor.transform.scale)+p.y-s.origin.y;
   for(const [id,sign] of [['leftFoot',1],['rightFoot',-1]]){pose[id+'.rotation']=Math.sin(time*10)*23*walking*sign;pose[id+'.y']=-Math.max(0,Math.sin(time*10)*sign)*7*walking;pose[id+'.yaw']=side*16*walking;}
  }
  const ga=this.document.actors.find(v=>v.id===s.giver),meet={x:(ga.transform.x+s.destination.x)/2,y:ga.transform.y+12},rest={x:side*35,y:31},offered=local(meet),mouth={x:0,y:-12},sharingHand=giver?s.giverHand:s.receiverHand,throwShoulder=pack.joints.find(j=>j.id===sharingHand+'-upper'),throwTarget=solve(throwShoulder,{x:(400-ga.transform.x>=0?1:-1)*35,y:-10},throwShoulder.x>0?-1:1).target;
  let hand=rest;
  if(giver){const open=phase==='offer'?ease(age/.9):1;hand=blend({x:0,y:12},offered,open);if(phase==='eat')hand=blend(offered,rest,ease(age/1.2));if(phase==='return')hand=s.failed?blend(throwTarget,rest,ease(age/1.2)):rest;if(phase==='disappointed')hand=blend(offered,{x:side*30,y:30},ease(age));if(phase==='toss')hand=blend({x:side*30,y:30},throwTarget,ease(age/.4));}
  else if(phase==='handoff')hand=blend(rest,offered,ease(age/1.2));else if(phase==='eat')hand=blend(offered,mouth,ease(age/1.1));else if(phase==='return')hand=blend(mouth,rest,ease(age));
  if(phase==='prepare'){const t=ease((time-s.at-s.transferAt)/1.1);if(t>0){const before=forwardKinematics(pack.joints,pose),center={x:0,y:12};setHand('hold',blend(before['hold-hand'],center,t));const h=setHand('take',blend(before['take-hand'],center,t));pose['food.x']=h.x;pose['food.y']=h.y;pose['skewer.opacity']=1-t;}return 'preparing gift';}
  hand=setHand(sharingHand,hand);setHand(sharingHand==='hold'?'take':'hold',{x:-side*36,y:28});
  pose['skewer.opacity']=0;pose['snack-flame.opacity']=0;pose['toast.opacity']=.45;pose['food.opacity']=s.owner===a.id?1:0;pose['food.x']=hand.x;pose['food.y']=hand.y;pose['food.z']=46;pose['food.rotation']=0;pose['food.bend']=!giver&&phase==='eat'?ease((age-1.3)/1.5):0;
  if(giver&&phase==='toss'&&age>=.4&&age<1.7){const t=clamp((age-.4)/1.3,0,1),from=screen(ga.transform,{x:throwTarget.x*Math.cos(stableYaw*rad),y:throwTarget.y}),fire={x:400,y:325},point=blend(from,fire,t);point.y-=Math.sin(Math.PI*t)*65;const p=local(point);pose['food.x']=p.x;pose['food.y']=p.y;pose['food.opacity']=1-ease((t-.88)/.12);pose['food.rotation']=t*250;}
  if(giver&&phase==='toss'){const aim=local({x:400,y:325}),angle=Math.atan2(aim.y-hand.y,aim.x-hand.x)/rad,desired=((angle-pose[sharingHand+'-upper.rotation']-pose[sharingHand+'-elbow.rotation']+540)%360)-180;pose[sharingHand+'-hand.rotation']=turn(pose[sharingHand+'-hand.rotation'],desired,(age-.1)/.3);}
  pose['toast.opacity']*=pose['food.opacity'];
  pose['camp-disappointed.opacity']=giver&&phase==='disappointed'?ease(age/.2):0;pose['camp-notice.opacity']=!giver&&phase==='notice'?Math.sin(clamp(age/.8,0,1)*Math.PI):0;
  if(['disappointed','toss'].includes(phase)&&giver){pose['camp-smile.opacity']=0;pose['camp-worried.opacity']=1;pose['camp-brows.opacity']=0;}
  if(!giver&&phase==='eat'){pose['camp-smile.opacity']=0;pose['camp-chew-open.opacity']=age>1?(Math.sin(time*21)+1)/2:0;pose['camp-chew-closed.opacity']=age>1?1-pose['camp-chew-open.opacity']:0;}
  return giver?phase==='disappointed'?'disappointed':phase==='toss'?'tossing missed gift':phase==='prepare'?'preparing gift':phase==='eat'||phase==='return'?'waiting for friend':'offering marshmallow':phase==='notice'?'noticing offer':phase==='approach'?'walking to friend':phase==='handoff'?'reaching for gift':phase==='eat'?'eating shared marshmallow':'returning to seat';
 }


 sourceAvailable(){const flames=(this.document.emitters||[]).filter(e=>e.actor==='fire'&&e.type==='flame');if(flames.length)return flames.some(e=>(this.emitterStates?.get(e.id)??e.enabled)&&e.rate>0&&e.opacity>0);const fireActor=this.document.actors.find(a=>a.id==='fire');return !!this.document.packs[fireActor?.pack]?.parts.some(p=>/^flame-\d+$/.test(p.id));}
 setEmitterEnabled(id,enabled){if(typeof enabled!=='boolean')throw Error('Emitter enabled must be boolean.');const emitter=this.document.emitters?.find(e=>e.id===id);if(!emitter||emitter.actor!=='fire')return;const before=this.sourceAvailable();this.emitterStates.set(id,enabled);const after=this.sourceAvailable();if(before&&!after){this.extinguish();this.graphEvents.push({event:'extinguish-fire'});if(this.graphEvents.length>32)this.graphEvents.shift();}else if(!before&&after)this.ignite();}
 blockRestart(){const f=this.fire;if(!f.blocked)this.event('fire-restart-blocked',f.actor?[f.actor]:[],'no enabled flame with positive rate and opacity');f.blocked=true;f.recoveryRequested=false;return false;}
 inFire(a){return this.fire.actor===a.id&&this.fire.phase!=='lit'&&this.fire.phase!=='cold';}
 extinguish(){const fire=this.fire;if(!fire.lit&&['cold','approach','relight'].includes(fire.phase))return;const from=fire.actor?this.firePosition(this.time):null;fire.lit=false;fire.changedAt=this.time;fire.recoveryRequested=false;if(fire.actor){fire.returnFrom=from;fire.phase='return';}else fire.phase='cold';fire.at=this.time;for(const a of this.members)a.burned=false;this.event('fire-off',[], 'the fire is cold');}
 ignite(){const fire=this.fire;if(!this.sourceAvailable()){if(fire.lit)this.extinguish();return this.blockRestart();}if(fire.lit)return true;fire.blocked=false;fire.lit=true;fire.changedAt=this.time;this.event('fire-lit',fire.actor?[fire.actor]:[]);this.graphEvents.push({event:'fire-lit',...(fire.actor?{actor:fire.actor}:{})});if(this.graphEvents.length>32)this.graphEvents.shift();if(!fire.actor){fire.phase='lit';fire.at=this.time;}}
 react(type,payload){const a=this.members.find(a=>a.id===payload.actor&&!a.retired)||(!payload.actor?this.members.find(a=>!a.retired&&!this.inFire(a)):null);if(!a||this.inFire(a))return;if(this.inShare(a))this.finishShare();const actor=this.document.actors.find(v=>v.id===a.id),x=Number.isFinite(payload.x)?payload.x:actor.transform.x,y=Number.isFinite(payload.y)?payload.y:actor.transform.y-20;a.reaction={type,at:this.time,until:this.time+(type==='food-throw'?3:1.6),x,y};
  if(type==='food-throw'){const floor=(actor.groundY??actor.transform.y+58*actor.transform.scale)-6,from={x,y:Math.min(y,floor)},vx=clamp(Number.isFinite(payload.vx)?payload.vx:(x-actor.transform.x)*1.6,-300,300),vy=clamp(Number.isFinite(payload.vy)?payload.vy:-100,-260,80),duration=clamp((-vy+Math.sqrt(vy*vy+600*Math.max(0,floor-from.y)))/300,.25,2.5);a.thrown={at:this.time,from,vx,vy,duration,toast:clamp(a.heat*.85,0,.92)};a.stage=19;a.burned=false;this.event('food-throw',[a.id]);this.event('angry',[a.id],'food taken away');}else this.event('shoo',[a.id],'too close to the face');
 }
 firePosition(time){const f=this.fire;if(!f.actor)return null;const origin=this.document.actors.find(a=>a.id===f.actor).transform,age=time-f.at,path=(start,end,t)=>{const u=ease(t),arc=Math.sin(Math.PI*u)*18*(start.x>400?1:-1);return {x:lerp(start.x,end.x,u)+arc,y:lerp(start.y,end.y,u)};};if(f.phase==='approach')return path(origin,f.destination,age/3.2);if(f.phase==='return')return path(f.returnFrom||f.destination,origin,age/3);return f.destination;}
 tickFire(){const f=this.fire;if(f.lit&&!this.sourceAvailable())this.extinguish();const age=this.time-f.at,helper=this.members.find(a=>a.id===f.actor);if(helper?.retired){f.actor=null;f.phase=f.lit?'lit':'cold';f.recoveryRequested=!f.lit;f.at=this.time;this.event('fire-recovery-cancelled',[helper.id]);}
  if(!f.actor&&!f.lit&&f.recoveryRequested){if(!this.sourceAvailable()){this.blockRestart();return;}f.blocked=false;const a=[...this.members].reverse().find(a=>!a.retired&&!this.inShare(a)&&a.stage===null&&!a.reaction);if(a){const actor=this.document.actors.find(v=>v.id===a.id),side=actor.transform.x>400?1:-1;f.actor=a.id;f.destination={x:400+side*100,y:330};f.phase='approach';f.at=this.time;f.recoveryRequested=false;a.mode='relighting';this.event('fire-approach',[a.id]);}}
  else if(f.actor&&f.phase==='approach'&&age>=3.2){f.phase='relight';f.at=this.time;this.event('fire-restart',[f.actor]);}
  else if(f.actor&&f.phase==='relight'){if(age>=1.2&&!f.lit&&!f.blocked)this.ignite();if(age>=2.4){f.phase='return';f.returnFrom=f.destination;f.at=this.time;}}
  else if(f.actor&&f.phase==='return'&&age>=3){const a=this.members.find(a=>a.id===f.actor);a.mode='fire';f.actor=null;f.phase=f.lit?'lit':'cold';f.at=this.time;this.event('fire-returned',[a.id]);}
 }
 firePose(a,f,time){const fire=this.fire,cold=fire.lit?1-ease((time-fire.changedAt)/.9):ease((time-fire.changedAt)/1.2),helper=this.inFire(a),pack=this.document.packs[this.document.actors.find(v=>v.id===a.id).pack],pose=f.pose;
  if(!helper&&cold<=0)return null;let amount=cold,mode='shivering by the cold fire';
  const setHand=(name,point,blendAmount=1)=>{const shoulder=pack.joints.find(j=>j.id===name+'-upper'),old=forwardKinematics(pack.joints,pose)[name+'-hand'],solved=solve(shoulder,blend(old,point,blendAmount),shoulder.x>0?-1:1);pose[name+'-upper.rotation']=solved.upper;pose[name+'-elbow.rotation']=solved.lower;pose[name+'-hand.rotation']=solved.hand;pose[name+'-upper.yaw']=pose[name+'-elbow.yaw']=pose[name+'-hand.yaw']=0;};
  if(helper){const actor=this.document.actors.find(v=>v.id===a.id),p=this.firePosition(time),age=time-fire.at,moving=['approach','return'].includes(fire.phase),duration=fire.phase==='approach'?3.2:3,walk=moving?Math.sin(Math.PI*clamp(age/duration,0,1)):0,side=actor.transform.x>400?1:-1,original=pack.clips.campfire.tracks['root.yaw'][0][1],facing=fire.phase==='approach'?ease(age/.9):fire.phase==='return'?1-ease((age-2)/1):1;f.placement.x=p.x;f.placement.y=p.y-Math.sin(time*9)**2*2*walk;f.groundY=(actor.groundY??actor.transform.y+58*actor.transform.scale)+p.y-actor.transform.y;pose['root.yaw']=turn(original,-side*22,facing);pose['root.rotation']=0;pose['root.x']=0;amount=fire.phase==='approach'?ease(age/.7):fire.phase==='return'?1-ease((age-2.2)/.8):1;
   for(const [id,sign]of [['leftFoot',1],['rightFoot',-1]]){pose[id+'.rotation']=Math.sin(time*9)*17*walk*sign;pose[id+'.y']=-Math.max(0,Math.sin(time*9)*sign)*5*walk;}
   const reach=fire.phase==='relight'?ease(age/.6)*(1-ease((age-1.7)/.7)):0;pose['root.y']=reach*4;for(const name of ['hold','take']){const shoulder=pack.joints.find(j=>j.id===name+'-upper'),inside=shoulder.x*side<0,target=inside?{x:-side*50,y:15}:{x:side*30,y:22};setHand(name,blend({x:shoulder.x*1.2,y:30},target,reach),amount);pose[name+'-upper.z']=45;}mode=fire.phase==='approach'?'walking to restart fire':fire.phase==='relight'?'relighting the fire':'returning to the warm seat';
  }else{for(const name of ['hold','take']){const shoulder=pack.joints.find(j=>j.id===name+'-upper');setHand(name,{x:-Math.sign(shoulder.x)*12,y:12},cold);}pose['root.x']=Math.sin(time*25+a.index)*.7*cold;pose['root.rotation']=Math.sin(time*21+a.index)*.7*cold;}
  pose['food.opacity']*=1-amount;pose['toast.opacity']*=1-amount;pose['skewer.opacity']*=1-amount;pose['snack-flame.opacity']=0;pose['camp-cold.opacity']=cold*(.65+.25*Math.sin(time*17+a.index));pose['camp-chatter.opacity']=cold;pose['camp-smile.opacity']*=1-cold;pose['camp-chew-open.opacity']*=1-cold;pose['camp-chew-closed.opacity']*=1-cold;return mode;
 }
 reactionPose(a,f,time){const reaction=a.reaction;if(!reaction)return null;const age=time-reaction.at,pack=this.document.packs[this.document.actors.find(v=>v.id===a.id).pack],pose=f.pose,envelope=ease(age/.18)*(1-ease((age-(reaction.type==='food-throw'?2.4:1.1))/.5));
  pose['camp-smile.opacity']*=1-envelope;pose['camp-brows.opacity']*=1-envelope;pose['camp-angry.opacity']=envelope;pose['camp-chew-open.opacity']*=1-envelope;pose['camp-chew-closed.opacity']*=1-envelope;
  if(reaction.type==='face-shoo'){const shoulder=pack.joints.find(j=>j.id==='take-upper'),side=shoulder.x>0?1:-1,old=forwardKinematics(pack.joints,pose)['take-hand'],hand={x:side*(36+Math.sin(age*15)*8),y:-21+Math.sin(age*12)*4},solved=solve(shoulder,blend(old,hand,envelope),-side);pose['take-upper.rotation']=solved.upper;pose['take-elbow.rotation']=solved.lower;pose['take-hand.rotation']=solved.hand;pose['take-upper.z']=48;}
  if(a.thrown){const throwAge=Math.max(0,time-a.thrown.at),q=clamp(throwAge/a.thrown.duration,0,1),p={x:a.thrown.from.x+a.thrown.vx*throwAge,y:a.thrown.from.y+a.thrown.vy*throwAge+150*throwAge*throwAge},cos=Math.cos(pose['root.yaw']*rad),safe=Math.abs(cos)<.2?Math.sign(cos||1)*.2:cos;pose['food.x']=(p.x-f.placement.x)/(f.placement.scale*safe);pose['food.y']=(p.y-f.placement.y)/f.placement.scale;pose['food.opacity']=1-ease((q-.84)/.16);pose['toast.opacity']=a.thrown.toast*pose['food.opacity'];pose['food.rotation']=throwAge*160;pose['food.bend']=0;pose['food.z']=70;pose['snack-flame.opacity']=0;}
  return reaction.type==='face-shoo'?'shooing an intrusive hand':'angry about the stolen marshmallow';
 }
 advance(time,disabled){this.members.forEach(a=>a.retired=disabled.has(a.id));const goal=Math.floor((time+1e-8)*20);while(this.tickIndex<goal){this.time=++this.tickIndex/20;this.tick();this.stepLooks();}}
 lookTarget(a,time){
  const actor=this.document.actors.find(v=>v.id===a.id),pack=this.document.packs[actor.pack],yaw=pack.clips.campfire.tracks['root.yaw']?.[0][1]||0,cos=Math.cos(yaw*rad);let target={x:400,y:315},amount=a.stage===null?1:0;if(this.inFire(a))return {yaw:actor.transform.x>400?-18:18,pitch:-12,roll:0};if(a.reaction){target={x:a.reaction.x,y:a.reaction.y};amount=1;}else if(!this.fire.lit){const partner=this.document.actors.find(v=>v.id===this.members[(a.index+1+Math.floor(time/4)%2)%this.members.length].id);target={x:partner.transform.x,y:partner.transform.y-25};amount=1;}
  if(this.fire.lit&&!a.reaction&&((a.mode==='conversation'&&a.stage===null)||a.helpUntil>time)){const p=this.document.actors.find(v=>v.id===a.partner);if(p)target={x:p.transform.x,y:p.transform.y-25};}
  if(this.fire.lit&&!a.reaction&&a.mode==='stars'&&a.stage===null)target={x:280+180*Math.sin(time*.12+a.index),y:30};
  if(this.fire.lit&&!a.reaction&&a.mode==='dozing'&&a.stage===null)target={x:actor.transform.x,y:actor.transform.y+40};
  const meteor=this.meteors.find(m=>time-m.at>.45&&time-m.at<4.5);if(meteor&&(a.id===meteor.noticer||time-meteor.at>1.15)){target=blend(meteor.start,meteor.end,clamp((time-meteor.at)/meteor.duration,0,1));amount=a.stage===null?1:.35;}
  if(this.share&&(a.id===this.share.giver||a.id===this.share.receiver&&this.share.noticed)){const partner=this.document.actors.find(v=>v.id===(a.id===this.share.giver?this.share.receiver:this.share.giver));return {yaw:partner.transform.x>actor.transform.x?22:-22,pitch:0,roll:0};}
  return {yaw:amount*clamp((target.x-actor.transform.x)/4,-55,55)*(cos>0?1:-1),pitch:amount*clamp((actor.transform.y-25-target.y)/6,-16,22),roll:a.mode==='dozing'&&a.stage===null?Math.sin(time*1.3)*4+8:Math.sin(time*1.2+a.index)*1.5};
 }
 stepLooks(){
  const dt=.05,omega=8,decay=Math.exp(-omega*dt);
  for(const a of this.members){a.lookBefore={...a.look};if(a.retired)continue;const target=this.lookTarget(a,this.time);for(const key of ['yaw','pitch','roll']){const offset=a.look[key]-target[key],c=a.lookVelocity[key]+omega*offset;a.look[key]=target[key]+(offset+c*dt)*decay;a.lookVelocity[key]=(a.lookVelocity[key]-omega*c*dt)*decay;}}
 }
 tick(){
  this.tickFire();
  if(this.time>=this.nextMeteor)this.meteor();
  if(this.time>=this.nextSocial){const pick=this.random();if(pick<.5)this.talk();else{const a=this.members[Math.floor(this.random()*4)];if(!a.retired&&a.stage===null){a.mode=pick<.72?'dozing':pick<.9?'stars':'fire';a.until=this.time+5+this.random()*5;this.event(a.mode,[a.id]);}}this.nextSocial=this.time+7+this.random()*9;}
  this.meteors=this.meteors.filter(m=>this.time-m.at<5);
  for(const m of this.meteors){const age=this.time-m.at;if(m.noticer&&!m.noticed&&age>=.45){m.noticed=true;this.event('point',[m.noticer]);}if(m.noticer&&!m.followed&&age>=1.15){m.followed=true;this.event('follow-gaze',this.members.filter(a=>a.id!==m.noticer).map(a=>a.id));}}
  this.tickShare();
  for(const a of this.members){if(a.retired){a.reaction=null;a.thrown=null;continue;}if(a.reaction&&this.time>=a.reaction.until){a.reaction=null;a.thrown=null;}if(a.reaction?.type==='food-throw'){if(a.thrown&&this.time-a.thrown.at>a.thrown.duration)a.thrown=null;continue;}if(this.inFire(a))continue;if(this.share&&(a.id===this.share.giver||a.id===this.share.receiver&&this.share.noticed))continue;
   if(a.stage!==null){const before=a.stage;a.stage+=.05;if(before<16.5&&a.stage>=16.5&&this.time>=this.nextShare&&!this.share){this.offer(true);this.nextShare=this.time+90+this.random()*90;}if(a.stage>=24){a.stage=null;a.heat=0;a.burned=false;a.mode='fire';a.distraction='';}continue;}
   if(this.time>=a.until)a.mode='fire';const distracted=a.mode!=='fire'||this.meteors.some(m=>this.time-m.at>.45&&this.time-m.at<4);
   if(!this.fire.lit)continue;if(distracted&&a.heat>.6)a.distraction=a.mode==='fire'?'watching meteor':a.mode;a.heat+=.05*(.048+a.index*.002);
   if(a.heat>=1.03||a.heat>=.72&&!distracted){if(a.heat>=1)this.burn(a,a.distraction||a.mode);else{a.burned=false;a.stage=13.5;this.event('ready',[a.id],a.mode);a.mode='fire';}}
  }
 }
 apply(frame,disabled=new Set()){
  this.advance(frame.time,disabled);const time=frame.time,byId=new Map(frame.actors.map(a=>[a.id,a]));
  for(const a of this.members){const f=byId.get(a.id),actor=this.document.actors.find(v=>v.id===a.id);if(!f||disabled.has(a.id)||f.inputs.action!=='campfire')continue;const pack=this.document.packs[actor.pack],sharing=this.share&&(a.id===this.share.giver||a.id===this.share.receiver&&this.share.noticed),stage=sharing?(this.share.phase==='prepare'?this.share.prepareStage+(this.share.transferAt?Math.min(2.9,(time-this.share.at)*1.45):0):16.5):a.stage??Math.min(11.9,a.heat*12),pose={...poseDefaults(pack),...sampleClip({...pack.clips.campfire,loop:false},(stage-a.index*5+24)%24)},yaw=pose['root.yaw'],cos=Math.cos(yaw*rad),sign=pack.joints.find(j=>j.id==='hold-upper').x>0?1:-1;
   f.pose=pose;f.placement={...actor.transform};pose['snack-flame.opacity']=a.burned&&stage<15?.7+.25*Math.sin(time*14):0;pose['toast.opacity']=clamp(a.heat*.85,0,.92);if(stage>=19)pose['toast.opacity']=0;
   const setHand=(name,target)=>{const shoulder=pack.joints.find(j=>j.id===name+'-upper'),solved=solve(shoulder,target,name==='hold'?-sign:sign);pose[name+'-upper.rotation']=solved.upper;pose[name+'-elbow.rotation']=solved.lower;pose[name+'-hand.rotation']=solved.hand;return solved.target;};
   const local=point=>({x:(point.x-f.placement.x)/(actor.transform.scale*cos),y:(point.y-f.placement.y)/actor.transform.scale});
   let mode=a.stage===null?a.mode:a.burned&&stage<15?'burning':stage<17?'preparing':stage<19?'eating':'replacing';
   const meteor=this.meteors.find(m=>time-m.at>.45&&time-m.at<4.5);if(meteor&&!sharing){const age=time-meteor.at;if(a.id===meteor.noticer||age>1.15){mode=a.id===meteor.noticer&&age<1.9?'pointing at meteor':'watching meteor';if(a.id===meteor.noticer&&age<1.9){
    // Indicate the first sighting once, then lower the arm while the eyes keep tracking.
    const target=blend(meteor.start,meteor.end,.9/meteor.duration),shoulder=pack.joints.find(j=>j.id==='take-upper'),t=local(target),d=Math.hypot(t.x-shoulder.x,t.y-shoulder.y),point={x:shoulder.x+(t.x-shoulder.x)/d*49,y:shoulder.y+(t.y-shoulder.y)/d*49},rest=forwardKinematics(pack.joints,pose)['take-hand'],gesture=ease((age-.45)/.45)*(1-ease((age-1.15)/.75)),wrist=pose['take-hand.rotation'];setHand('take',blend(rest,point,gesture));pose['take-upper.z']=lerp(pose['take-upper.z'],48,gesture);const dir=Math.atan2(t.y-point.y,t.x-point.x)/rad,desired=((dir-pose['take-upper.rotation']-pose['take-elbow.rotation']+540)%360)-180;pose['take-hand.rotation']=wrist+(((desired-wrist+540)%360)-180)*gesture;
   }}}
   const blink=(time+a.index*1.37)%4.7<.16,doze=mode==='dozing',talk=mode==='conversation'&&Math.floor((time+a.index*1.4)*1.4)%3!==0,burn=mode==='burning',chew=mode==='eating';
   for(const id of ['camp-eyes','camp-eye-shine'])pose[id+'.opacity']=blink||doze?0:1;pose['camp-blink.opacity']=blink||doze?1:0;pose['camp-worried.opacity']=burn?1:0;pose['camp-brows.opacity']=burn?0:1;pose['camp-oh.opacity']=burn?1:0;pose['camp-smile.opacity']=burn||talk||chew?0:1;pose['camp-chew-open.opacity']=talk||chew?(Math.sin(time*21)+1)/2:0;pose['camp-chew-closed.opacity']=talk||chew?1-pose['camp-chew-open.opacity']:0;
   if(!a.burned)pose['camp-blow.opacity']=0;
   // Back-facing campers keep hands and food on the face side of the torso.
   if(cos<0)for(const id of ['hold-upper','take-upper','skewer','food'])pose[id+'.z']=id==='take-upper'&&mode==='pointing at meteor'?48:-42;
   if(sharing){mode=this.sharePose(a,f,time)||mode;}
   const startled=a.startleAt!==undefined?clamp((time-a.startleAt)/.85,0,1):1;pose['camp-startle.opacity']=Math.sin(startled*Math.PI);pose['camp-sweat.opacity']=a.burned&&stage<16?.7:0;
   if(startled<1){pose['root.y']=-Math.sin(startled*Math.PI)*7;pose['camp-smile.opacity']=0;pose['camp-oh.opacity']=1;mode='startled by burning food';}
   if(a.helpUntil>time){pose['camp-shout.opacity']=Math.sin(clamp((a.helpUntil-time)/1.1,0,1)*Math.PI);pose['camp-smile.opacity']=0;pose['camp-chew-open.opacity']=.7+.3*Math.sin(time*18);mode='calling to friend';}
   const fraction=clamp((time-this.time)/.05,0,1);for(const [channel,key] of [['yaw','yaw'],['pitch','pitch'],['rotation','roll']])pose['head.'+channel]=lerp(a.lookBefore[key],a.look[key],fraction);
   if(startled<1)pose['head.pitch']-=Math.sin(startled*Math.PI)*10;
   if(!sharing)mode=this.firePose(a,f,time)||mode;mode=this.reactionPose(a,f,time)||mode;
   f.world=forwardKinematics(pack.joints,pose);f.activity=mode;f.heat=a.heat;
  }
  for(const a of this.document.actors.filter(a=>a.unlit)){const f=byId.get(a.id),p=this.document.packs[a.pack];if(f&&!disabled.has(a.id)&&p.clips.loop)f.pose={...poseDefaults(p),...sampleClip(p.clips.loop,time)};}
  const sky=byId.get(this.config.sky);if(sky&&!disabled.has(this.config.sky))for(let i=0;i<2;i++){const m=this.meteors[i],id='meteor-'+i,age=m?time-m.at:0,t=m?clamp(age/m.duration,0,1):0,fade=m?ease(age/.18)*(1-ease((age-2.7)/1.1)):0;sky.pose[id+'.opacity']=fade;if(m){const point=blend(m.start,m.end,t);sky.pose[id+'.x']=point.x;sky.pose[id+'.y']=point.y;sky.pose[id+'.rotation']=Math.atan2(m.end.y-m.start.y,m.end.x-m.start.x)/rad;}for(let n=0;n<16;n++)sky.pose[id+'-tail-'+n+'.opacity']=fade*(1-n/16)**1.7;}for(const a of this.document.actors.filter(a=>a.unlit)){const f=byId.get(a.id);if(f)f.world=forwardKinematics(this.document.packs[a.pack].joints,f.pose);}
  const fireEmitters=this.document.emitters?.filter(e=>e.actor==='fire')||[];frame.emitterOverrides={...frame.emitterOverrides,...Object.fromEntries(fireEmitters.map(e=>[e.id,{enabled:this.fire.lit&&(this.emitterStates.get(e.id)??e.enabled)}]))};
  frame.ensemble={fire:{lit:this.fire.lit,available:this.sourceAvailable(),blocked:this.fire.blocked,phase:this.fire.phase,actor:this.fire.actor,since:this.fire.at,heat:this.fire.lit?1:0},events:this.recent.map(e=>({...e})),sharing:!!this.share,...(this.share?{share:{phase:this.share.phase,giver:this.share.giver,receiver:this.share.receiver,giverHand:this.share.giverHand,receiverHand:this.share.receiverHand,observer:this.share.observer,noticed:this.share.noticed,owner:this.share.owner,contact:this.share.contact}}:{})};return frame;
 }
}
