import {assertDocument} from '../src/schema.js';
import {evaluatedProps} from '../src/scene-attachments.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const set=(path,value)=>({op:'set',path,value});
export function createAttachmentTools({getDocument,getFrame=()=>undefined,commit}){
 function render(target,id){
  const doc=getDocument(),prop=doc.props.find(p=>p.id===id),a=prop.attachment,key=a?.type==='joint'?a.actor:a?.type==='object'?'@object/'+a.object:'',actor=doc.actors.find(v=>v.id===a?.actor),joints=actor?doc.packs[actor.pack].joints:[];
  const options=(items,value)=>items.map(([id,name])=>`<option value="${esc(id)}" ${id===value?'selected':''}>${esc(name)}</option>`).join('');
  target.innerHTML=`<h3>Attach artwork</h3><label class="field">Follow<select id="attachment-target">${options([['','Scene placement'],...doc.actors.map(v=>[v.id,'Character · '+v.name]),...(doc.objects||[]).map(v=>['@object/'+v.id,'Shared object · '+v.name])],key)}</select></label>${a?.type==='joint'?`<label class="field">Joint<select id="attachment-joint">${options(joints.map(j=>[j.id,j.id]),a.joint)}</select></label>`:''}${a?`<div class="two-col">${[['offsetX','Offset X',-1000,1000],['offsetY','Offset Y',-1000,1000],['rotation','Rotation offset',-180,180]].map(([key,label,min,max])=>`<label class="field">${label}<input id="attachment-${key}" type="number" required min="${min}" max="${max}" step=".5" value="${a[key]??0}"></label>`).join('')}</div><label class="face-auto"><input id="attachment-inherit" type="checkbox" ${a.inheritRotation!==false?'checked':''}>Follow target rotation</label><p class="note">${a.type==='joint'?'Offsets follow the joint and character scale.':'Offsets are scene units, rotated with the shared object.'} Artwork size stays in scene units. Attachment turns collision off; the shared object supplies its own physics.</p>`:'<p class="note">Attach this artwork to a character joint or shared object. Applying an attachment also turns its collision box off.</p>'}<p id="attachment-status" class="note" role="status"></p>`;
  const $=id=>target.querySelector('#'+id),save=attachment=>{
   const current=getDocument(),props=structuredClone(current.props),next=props.find(p=>p.id===id);if(attachment){next.attachment=attachment;next.collider={...next.collider,enabled:false};}else{const frame=getFrame(),placed=frame&&evaluatedProps(current,frame).find(p=>p.id===id);if(placed&&!placed.hidden)Object.assign(next,{x:placed.x,y:placed.y,rotation:((placed.rotation+180)%360+360)%360-180});delete next.attachment;}
   const requiredFeatures=[...new Set([...(current.requiredFeatures||[]),...(attachment?['prop-attachments']:[])])];
   try{assertDocument({...current,props,requiredFeatures});commit([set(['props'],props),set(['requiredFeatures'],requiredFeatures)]);}catch(e){$('attachment-status').textContent=e.message;return;}if(target.isConnected)render(target,id);
  };
  $('attachment-target').onchange=e=>{const value=e.target.value,offsets={offsetX:a?.offsetX??0,offsetY:a?.offsetY??0,rotation:a?.rotation??0,inheritRotation:a?.inheritRotation!==false};if(!value)return save();if(value.startsWith('@object/'))return save({type:'object',object:value.slice(8),...offsets});const p=doc.packs[doc.actors.find(v=>v.id===value).pack];save({type:'joint',actor:value,joint:p.joints.some(j=>j.id===a?.joint)?a.joint:p.joints[0].id,...offsets});};
  if(!a)return;
  if(a.type==='joint')$('attachment-joint').onchange=e=>save({...a,joint:e.target.value});
  for(const key of ['offsetX','offsetY','rotation'])$('attachment-'+key).onchange=e=>{if(e.target.value.trim()===''||!Number.isFinite(Number(e.target.value))||!e.target.reportValidity())return;$('attachment-status').textContent='';save({...a,[key]:Number(e.target.value)});};
  $('attachment-inherit').onchange=e=>save({...a,inheritRotation:e.target.checked});
 }
 return {render};
}
