const rad=Math.PI/180,clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const point=(p,name)=>{if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>10000||Math.abs(p.y)>10000)throw new Error(name+' must be a finite point within ±10000.');return p;};
const range=(n,min,max,name)=>{if(!Number.isFinite(n)||n<min||n>max)throw new Error(name+' must be within '+min+'..'+max+'.');return n;};
const rotate=(p,a)=>({x:p.x*Math.cos(a)-p.y*Math.sin(a),y:p.x*Math.sin(a)+p.y*Math.cos(a)});
const dot=(a,b)=>a.x*b.x+a.y*b.y;
/** A seekable support pose target for authored animation, not a rigid-body solve.
 * Local centerOffset is a supplied mass-center estimate, never inferred from art.
 * Keep exact grip/foot constraints as the final pose-solving pass. */
export function sampleSuspendedSupport({anchor,supports,restCenter,centerOffset={x:0,y:0},resistance=.65,load=1,elapsed,amplitude=0,settle=.65,maxLean=35,maxShift=64,rotation,gravity={x:0,y:1}}={}){
 point(restCenter,'restCenter');point(centerOffset,'centerOffset');point(gravity,'gravity');
 range(resistance,0,1,'resistance');range(load,0,1,'load');range(amplitude,0,20,'amplitude');range(settle,.05,10,'settle');range(maxLean,0,60,'maxLean');range(maxShift,0,500,'maxShift');
 if(elapsed!==undefined)range(elapsed,0,3600,'elapsed');if(rotation!==undefined)range(rotation,-180,180,'rotation');
 if(supports!==undefined){
  if(anchor!==undefined||!Array.isArray(supports)||!supports.length||supports.length>8)throw new Error('Use either one anchor or 1..8 weighted supports.');
  let total=0,x=0,y=0;for(const support of supports){point(support,'support');const weight=range(support.weight??1,0,1000,'support weight');total+=weight;x+=support.x*weight;y+=support.y*weight;}
  if(total===0)throw new Error('At least one support must carry weight.');anchor={x:x/total,y:y/total};
 }
 point(anchor,'anchor');const length=Math.hypot(gravity.x,gravity.y);if(length<1e-8)throw new Error('Gravity must have a direction.');
 const normal={x:gravity.x/length,y:gravity.y/length},tangent={x:normal.y,y:-normal.x},restMass={x:restCenter.x+centerOffset.x,y:restCenter.y+centerOffset.y},arm={x:restMass.x-anchor.x,y:restMass.y-anchor.y};
 const passive=rotation??Math.atan2(arm.x*normal.y-arm.y*normal.x,dot(arm,normal))/rad,targetRotation=clamp(passive,-maxLean,maxLean)*load;
 // Strong active muscles retain a small part of the authored lateral posture.
 // Low resistance yields farther toward the support's gravity line, not away.
 const compliance=load*(1-.2*resistance),omega=6*(.4+.6*resistance)/settle,response=elapsed===undefined?1:1-(1+omega*elapsed)*Math.exp(-omega*elapsed),angle=targetRotation*response;
 const targetAt=angle=>{const offset=rotate(centerOffset,angle*rad),needed=dot({x:anchor.x-restCenter.x-offset.x,y:anchor.y-restCenter.y-offset.y},tangent);return {offset,shift:clamp(needed*compliance,-maxShift,maxShift)};};
 const target=targetAt(targetRotation),current=targetAt(angle),sway=elapsed===undefined?0:amplitude*load*Math.exp(-3*elapsed/settle)*Math.sin(8*elapsed/settle),shift=clamp(current.shift*response+sway,-maxShift,maxShift),center={x:restCenter.x+tangent.x*shift,y:restCenter.y+tangent.y*shift},centerOfMass={x:center.x+current.offset.x,y:center.y+current.offset.y};
 return {center,rotation:angle,centerOfMass,anchor:{...anchor},alignment:compliance*response,lateralError:dot({x:centerOfMass.x-anchor.x,y:centerOfMass.y-anchor.y},tangent),target:{center:{x:restCenter.x+tangent.x*target.shift,y:restCenter.y+tangent.y*target.shift},rotation:targetRotation},limited:Math.abs(dot({x:anchor.x-restCenter.x-current.offset.x,y:anchor.y-restCenter.y-current.offset.y},tangent)*compliance)>maxShift};
}
