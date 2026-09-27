import {rendererPoint,rendererHit} from './render-input.js';
import {spatialKinematics} from './spatial.js';
/** Bind declared gestures to an SVG scene. A single active pointer is captured. */
export function mountScenePointers(element,document,controller,{isEnabled=()=>true,onInteract=()=>{},onUpdate=()=>{}}={}){
 if(!document.interactions?.length)return {dispose(){}};
 let active=null,last=null,lastHover=-Infinity,suppressClick=0;const bindings=document.interactions||[],clock=()=>performance.now();
 const point=e=>rendererPoint(element,e);
 function candidates(e,gesture,p,dx=0){
  const picked=rendererHit(element,e),entity=e.target.closest?.('[data-actor],[data-emitter-actor],[data-scene-actor]'),id=picked?.actor||entity?.dataset.actor||entity?.dataset.emitterActor||entity?.dataset.sceneActor;
  const eligible=bindings.filter(b=>b.gesture===gesture&&(b.actor===id||gesture==='hover-fast'&&b.radius)&&(!b.direction||(b.direction==='left'?dx<0:dx>0)));
  if(!eligible.length)return [];
  const part=picked?.part||e.target.closest?.('[data-part]')?.dataset.part||e.target.closest?.('[data-source-part]')?.dataset.sourcePart||e.target.closest?.('[data-scene-part]')?.dataset.scenePart;
  const frames=controller.frame().actors,cache=new Map();
  return eligible.map(b=>{
   let data=cache.get(b.actor);
   if(!data){
    const actor=document.actors.find(a=>a.id===b.actor),pack=document.packs[actor.pack],frame=frames.find(a=>a.id===b.actor);if(!frame)return {b,distance:Infinity,match:false};
    const ancestors=new Set();let joint=b.actor===id?(picked?.joint||pack.parts.find(v=>v.id===part)?.joint||e.target.closest?.('[data-joint]')?.dataset.joint||e.target.closest?.('[data-scene-joint]')?.dataset.sceneJoint):null;
    while(joint){ancestors.add(joint);joint=pack.joints.find(v=>v.id===joint)?.parent;}
    data={w:pack.spatial?spatialKinematics(pack,frame.pose):frame.world,t:frame.placement||actor.transform,ancestors};cache.set(b.actor,data);
   }
   const {w,t,ancestors}=data,q=w[b.joint],r=t.rotation*Math.PI/180,x=q?t.x+t.scale*(q.x*Math.cos(r)-q.y*Math.sin(r)):Infinity,y=q?t.y+t.scale*(q.x*Math.sin(r)+q.y*Math.cos(r)):Infinity,distance=Math.hypot(p.x-x,p.y-y);
   const direct=b.actor===id&&(b.part?b.part===part:b.joint?ancestors.has(b.joint):true),near=gesture==='hover-fast'&&b.radius&&distance<=b.radius*Math.abs(t.scale);
   return {b,distance,match:direct||near||b.actor===id&&gesture==='drag'&&b.response==='resist'&&distance<24*Math.abs(t.scale)};
  }).filter(v=>v.match).sort((a,b)=>a.distance-b.distance);
 }
 function send(b,phase,p){if(!['move','end','cancel'].includes(phase))onInteract();controller.pointer({binding:b.id,phase,...p});onUpdate();}
 function down(e){if(!isEnabled()||e.button!==0||!bindings.length)return;const p=point(e);if(!p)return;const b=candidates(e,'drag',p)[0]?.b;if(!b){if(candidates(e,'click',p).length)e.stopImmediatePropagation();return;}e.preventDefault();e.stopImmediatePropagation();active={b,pointer:e.pointerId,start:p,last:p};element.setPointerCapture(e.pointerId);send(b,'start',p);}
 function move(e){if(!isEnabled())return;const p=point(e);if(!p)return;const now=clock();if(active&&e.pointerId===active.pointer){e.preventDefault();e.stopImmediatePropagation();active.last=p;send(active.b,'move',p);}else{if(last&&now-last.time>=8&&now-lastHover>800){const speed=Math.hypot(p.x-last.x,p.y-last.y)/((now-last.time)/1000),b=candidates(e,'hover-fast',p,p.x-last.x).find(v=>speed>(v.b.threshold||450))?.b;if(b){lastHover=now;send(b,'hover',p);}}if(!last||now-last.time>=8)last={...p,time:now};}}
 function end(e){if(!active||e.pointerId!==active.pointer)return;e.preventDefault();e.stopImmediatePropagation();const a=active;active=null;suppressClick=clock()+350;send(a.b,e.type==='pointercancel'?'cancel':'end',point(e)||a.last);if(element.hasPointerCapture(e.pointerId))element.releasePointerCapture(e.pointerId);}
 function click(e){if(clock()<suppressClick||!isEnabled()||e.button!==0)return;const p=point(e);if(!p)return;const b=candidates(e,'click',p)[0]?.b;if(b){e.preventDefault();e.stopImmediatePropagation();send(b,'click',p);}}
 function cancel(){if(active){const a=active;active=null;controller.pointer({binding:a.b.id,phase:'cancel',...a.last});}}
 const listeners=[['pointerdown',down],['pointermove',move],['pointerup',end],['pointercancel',end],['click',click]];for(const [type,fn]of listeners)element.addEventListener(type,fn,true);globalThis.addEventListener('blur',cancel);
 return {dispose(){cancel();for(const [type,fn]of listeners)element.removeEventListener(type,fn,true);globalThis.removeEventListener('blur',cancel);}};
}
