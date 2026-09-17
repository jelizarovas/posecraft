import {sampleClip,forwardKinematics,clamp} from './index.js';
import {poseDefaults} from './spatial.js';
const rad=Math.PI/180,lerp=(a,b,t)=>a+(b-a)*t,ease=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},blend=(a,b,t)=>({x:lerp(a.x,b.x,t),y:lerp(a.y,b.y,t)});
export const ensembleEvents=['conversation','doze','meteor','share'];
function solve(shoulder,hand,bend){const dx=hand.x-shoulder.x,dy=hand.y-shoulder.y,d=Math.max(.001,Math.hypot(dx,dy)),reach=Math.min(d,51.8),target={x:shoulder.x+dx/d*reach,y:shoulder.y+dy/d*reach},h=Math.sqrt(Math.max(0,676-reach*reach/4)),elbow={x:(shoulder.x+target.x)/2-dy/d*h*bend,y:(shoulder.y+target.y)/2+dx/d*h*bend},upper=Math.atan2(elbow.y-shoulder.y,elbow.x-shoulder.x)/rad,lower=Math.atan2(target.y-elbow.y,target.x-elbow.x)/rad;return {upper,lower:((lower-upper+540)%360)-180,hand:((540-lower)%360)-180,target};}
// A bounded, seeded example director. Clips supply the mechanics; attention and
// heat determine when they run. No wall-clock timers or per-frame random draws.
export class CampfireEnsemble {
 constructor(document){this.document=document;this.config=document.ensemble;this.reset();}
 reset(){this.rng=this.config.seed>>>0;this.tickIndex=0;this.time=0;this.nextSocial=3;this.nextMeteor=8;this.meteors=[];this.recent=[];this.share=null;this.pendingShare=null;this.nextShare=50;this.members=this.config.members.map((id,i)=>({id,index:i,heat:[.45,.05,.3,.6][i],stage:null,burned:false,mode:i===2?'stars':'fire',until:i===2?6:0,partner:null,look:{yaw:0,pitch:0,roll:0},lookBefore:{yaw:0,pitch:0,roll:0},lookVelocity:{yaw:0,pitch:0,roll:0},retired:false}));}
 random(){this.rng=(Math.imul(this.rng,1664525)+1013904223)>>>0;return this.rng/4294967296;}
 event(type,actors,detail=''){this.recent.push({type,actors,time:this.time,detail});if(this.recent.length>32)this.recent.shift();}
 trigger(type){if(!ensembleEvents.includes(type))throw new Error('Unknown ensemble event.');if(type==='meteor')this.meteor();else if(type==='share')this.offer(true);else if(type==='conversation')this.talk();else{const a=this.members.find(a=>!a.retired&&a.stage===null);if(a){a.mode='dozing';a.until=this.time+8;this.event('doze',[a.id]);}}}
 talk(){const available=this.members.filter(a=>!a.retired&&a.stage===null&&!this.share);if(available.length<2)return;const a=available[Math.floor(this.random()*available.length)],others=available.filter(b=>b!==a),b=others[Math.floor(this.random()*others.length)],duration=8+this.random()*7;for(const [actor,partner] of [[a,b],[b,a]]){actor.mode='conversation';actor.partner=partner.id;actor.until=this.time+duration;}this.event('conversation',[a.id,b.id]);}
 meteor(){const reverse=this.random()<.35,start={x:reverse?720:70,y:25+this.random()*35},end={x:reverse?110:720,y:135+this.random()*30},watchers=this.members.filter(a=>!a.retired&&a.stage===null),noticer=watchers[Math.floor(this.random()*watchers.length)]?.id;this.meteors.push({start,end,at:this.time,duration:3.8,noticer});this.meteors=this.meteors.slice(-2);this.nextMeteor=this.time+22+this.random()*26;this.event('meteor',noticer?[noticer]:[]);}
 offer(force=false){if(this.share||this.pendingShare)return;const [a,b]=this.members;if(a.retired||b.retired||!force&&(a.stage===null||a.stage<16||a.stage>17||b.stage===null||b.stage<19))return;this.pendingShare={giver:a.id,receiver:b.id,at:this.time};a.stage=13.5;b.stage=19;a.mode=b.mode='sharing';this.event('offer',[a.id,b.id]);}
 advance(time,disabled){this.members.forEach(a=>a.retired=disabled.has(a.id));const goal=Math.floor((time+1e-8)*20);while(this.tickIndex<goal){this.time=++this.tickIndex/20;this.tick();this.stepLooks();}}
 lookTarget(a,time){
  const actor=this.document.actors.find(v=>v.id===a.id),pack=this.document.packs[actor.pack],yaw=pack.clips.campfire.tracks['root.yaw']?.[0][1]||0,cos=Math.cos(yaw*rad);let target={x:400,y:315},amount=a.stage===null?1:0;
  if(a.mode==='conversation'&&a.stage===null){const p=this.document.actors.find(v=>v.id===a.partner);if(p)target={x:p.transform.x,y:p.transform.y-25};}
  if(a.mode==='stars'&&a.stage===null)target={x:280+180*Math.sin(time*.12+a.index),y:30};
  if(a.mode==='dozing'&&a.stage===null)target={x:actor.transform.x,y:actor.transform.y+40};
  const meteor=this.meteors.find(m=>time-m.at>.45&&time-m.at<4.5);if(meteor&&(a.id===meteor.noticer||time-meteor.at>1.15)){target=blend(meteor.start,meteor.end,clamp((time-meteor.at)/meteor.duration,0,1));amount=a.stage===null?1:.35;}
  if(this.share&&[this.share.giver,this.share.receiver].includes(a.id)){const partner=this.document.actors.find(v=>v.id===(a.id===this.share.giver?this.share.receiver:this.share.giver));return {yaw:partner.transform.x>actor.transform.x?22:-22,pitch:0,roll:0};}
  return {yaw:amount*clamp((target.x-actor.transform.x)/4,-55,55)*(cos>0?1:-1),pitch:amount*clamp((actor.transform.y-25-target.y)/6,-16,22),roll:a.mode==='dozing'&&a.stage===null?Math.sin(time*1.3)*4+8:Math.sin(time*1.2+a.index)*1.5};
 }
 stepLooks(){
  const dt=.05,omega=8,decay=Math.exp(-omega*dt);
  for(const a of this.members){a.lookBefore={...a.look};if(a.retired)continue;const target=this.lookTarget(a,this.time);for(const key of ['yaw','pitch','roll']){const offset=a.look[key]-target[key],c=a.lookVelocity[key]+omega*offset;a.look[key]=target[key]+(offset+c*dt)*decay;a.lookVelocity[key]=(a.lookVelocity[key]-omega*c*dt)*decay;}}
 }
 tick(){
  if(this.time>=this.nextMeteor)this.meteor();
  if(this.time>=this.nextSocial){const pick=this.random();if(pick<.5)this.talk();else{const a=this.members[Math.floor(this.random()*4)];if(!a.retired&&a.stage===null){a.mode=pick<.72?'dozing':pick<.9?'stars':'fire';a.until=this.time+5+this.random()*5;this.event(a.mode,[a.id]);}}this.nextSocial=this.time+7+this.random()*9;}
  this.meteors=this.meteors.filter(m=>this.time-m.at<5);
  for(const m of this.meteors){const age=this.time-m.at;if(m.noticer&&!m.noticed&&age>=.45){m.noticed=true;this.event('point',[m.noticer]);}if(m.noticer&&!m.followed&&age>=1.15){m.followed=true;this.event('follow-gaze',this.members.filter(a=>a.id!==m.noticer).map(a=>a.id));}}
  if(this.pendingShare&&this.time-this.pendingShare.at>=3.1){this.share={...this.pendingShare,at:this.time};this.pendingShare=null;this.event('share',[this.share.giver,this.share.receiver]);}
  if(this.share&&this.time-this.share.at>8){for(const a of this.members)if([this.share.giver,this.share.receiver].includes(a.id)){a.stage=a.id===this.share.giver?20:19;a.mode='fire';a.heat=0;}this.share=null;}
  for(const a of this.members){if(a.retired)continue;if(this.share&&[this.share.giver,this.share.receiver].includes(a.id))continue;if(this.pendingShare&&a.id===this.pendingShare.receiver)continue;
   if(a.stage!==null){const before=a.stage;a.stage+=.05;if(a.index===0&&before<16.5&&a.stage>=16.5&&this.time>=this.nextShare&&!this.pendingShare){this.offer(true);this.nextShare=this.time+90+this.random()*90;}if(a.stage>=24){a.stage=null;a.heat=0;a.burned=false;a.mode='fire';a.distraction='';}continue;}
   if(this.time>=a.until)a.mode='fire';const distracted=a.mode!=='fire'||this.meteors.some(m=>this.time-m.at>.45&&this.time-m.at<4);
   if(distracted&&a.heat>.6)a.distraction=a.mode==='fire'?'watching meteor':a.mode;a.heat+=.05*(.048+a.index*.002);
   if(a.heat>=1.03||a.heat>=.72&&!distracted){a.burned=a.heat>=1;a.stage=a.burned?12:13.5;this.event(a.burned?'burn':'ready',[a.id],a.burned?a.distraction||a.mode:a.mode);a.mode='fire';}
  }
 }
 apply(frame,disabled=new Set()){
  this.advance(frame.time,disabled);const time=frame.time,byId=new Map(frame.actors.map(a=>[a.id,a]));
  for(const a of this.members){const f=byId.get(a.id),actor=this.document.actors.find(v=>v.id===a.id);if(!f||disabled.has(a.id)||f.inputs.action!=='campfire')continue;const pack=this.document.packs[actor.pack],sharing=this.share&&[this.share.giver,this.share.receiver].includes(a.id),stage=sharing?16.5:a.stage??Math.min(11.9,a.heat*12),pose={...poseDefaults(pack),...sampleClip({...pack.clips.campfire,loop:false},(stage-a.index*5+24)%24)},yaw=pose['root.yaw'],cos=Math.cos(yaw*rad),sign=pack.joints.find(j=>j.id==='hold-upper').x>0?1:-1;
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
   if(sharing){const share=this.share,age=time-share.at,giver=a.id===share.giver,other=this.document.actors.find(v=>v.id===(giver?share.receiver:share.giver)),direction=other.transform.x>actor.transform.x?1:-1,lean=ease(age/1.5)*(1-ease((age-7)/1));f.placement.x+=direction*10*lean;const ga=this.document.actors.find(v=>v.id===share.giver),ra=this.document.actors.find(v=>v.id===share.receiver),meeting={x:(ga.transform.x+ra.transform.x)/2,y:(ga.transform.y+ra.transform.y)/2+12},center={x:0,y:10},mouth={x:0,y:-12},meet=local(meeting),rest={x:sign*34,y:34};let hand;
    if(giver){hand=age<1?blend(rest,center,ease(age)):age<4?blend(center,meet,ease((age-1)/3)):blend(meet,rest,ease((age-4)/2));setHand('take',age<1?blend({x:pose['food.x'],y:pose['food.y']},center,ease(age)):blend(center,{x:-sign*39,y:30},ease((age-1)/1.5)));}else hand=age<4?blend(rest,meet,ease((age-2)/2)):age<6?blend(meet,mouth,ease((age-4)/2)):mouth;
    hand=setHand('hold',hand);pose['food.opacity']=giver?(age<4?1:0):(age>=4?1:0);if(giver&&age<1){const w=forwardKinematics(pack.joints,pose)['take-hand'];pose['food.x']=w.x;pose['food.y']=w.y;}else{pose['food.x']=hand.x;pose['food.y']=hand.y;}pose['food.bend']=!giver&&age>6?ease((age-6)/1.5):0;pose['food.z']=44;pose['hold-upper.z']=45;pose['snack-flame.opacity']=0;pose['toast.opacity']=.5;pose['camp-smile.opacity']=!giver&&age>6?0:1;pose['camp-chew-open.opacity']=!giver&&age>6?(Math.sin(time*21)+1)/2:0;pose['camp-chew-closed.opacity']=!giver&&age>6?1-pose['camp-chew-open.opacity']:0;mode=giver?'offering marshmallow':age<4?'reaching for gift':'eating shared marshmallow';
   }
   const fraction=clamp((time-this.time)/.05,0,1);for(const [channel,key] of [['yaw','yaw'],['pitch','pitch'],['rotation','roll']])pose['head.'+channel]=lerp(a.lookBefore[key],a.look[key],fraction);
   f.world=forwardKinematics(pack.joints,pose);f.activity=mode;f.heat=a.heat;
  }
  for(const a of this.document.actors.filter(a=>a.unlit)){const f=byId.get(a.id),p=this.document.packs[a.pack];if(f&&!disabled.has(a.id)&&p.clips.loop)f.pose={...poseDefaults(p),...sampleClip(p.clips.loop,time)};}
  const sky=byId.get(this.config.sky);if(sky&&!disabled.has(this.config.sky))for(let i=0;i<2;i++){const m=this.meteors[i],id='meteor-'+i,age=m?time-m.at:0,t=m?clamp(age/m.duration,0,1):0,fade=m?ease(age/.18)*(1-ease((age-2.7)/1.1)):0;sky.pose[id+'.opacity']=fade;if(m){const point=blend(m.start,m.end,t);sky.pose[id+'.x']=point.x;sky.pose[id+'.y']=point.y;sky.pose[id+'.rotation']=Math.atan2(m.end.y-m.start.y,m.end.x-m.start.x)/rad;}for(let n=0;n<16;n++)sky.pose[id+'-tail-'+n+'.opacity']=fade*(1-n/16)**1.7;}for(const a of this.document.actors.filter(a=>a.unlit)){const f=byId.get(a.id);if(f)f.world=forwardKinematics(this.document.packs[a.pack].joints,f.pose);}
  frame.ensemble={events:this.recent.map(e=>({...e})),sharing:!!this.share};return frame;
 }
}
