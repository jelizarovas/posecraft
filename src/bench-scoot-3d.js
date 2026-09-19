const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;

/** A leg-driven seated support cycle. Translation only occurs while the
 * pelvis is lifted and both planted feet remain fixed. Hands can rest on thighs. */
export function createBenchScoot3D({from,to,armReach,legReach,seatY,sole,stance,wideStance,entryFootZ,exitFootZ,direction,tempo}){
 const count=Math.max(1,Math.ceil(Math.abs(to-from)/Math.min(.26,armReach*.55))),step=(to-from)/count;
 const prepare=.85/tempo,cycleDuration=1.3/tempo,finish=.9/tempo,duration=prepare+count*cycleDuration+finish;
 const footOffset=Math.min(.23,legReach*.27),liftHeight=Math.min(.022,armReach*.045),lean=20*Math.PI/180;
 function sample(time){
  const t=Math.max(0,Math.min(duration,time));
  let cycle=0,stage='prepare',u=0,hipZ=from,seatLift=0,pitch=0,handBlend=0,feet=[0,1].map(()=>({z:entryFootZ,y:sole,x:wideStance,active:true}));
  if(t<prepare){
   u=t/prepare;pitch=lean*smooth(u/.7);handBlend=smooth(u/.75);
   for(let i=0;i<2;i++){const stepU=clamp((u-i*.35)/.65),f=smooth(stepU);feet[i]={x:mix(wideStance,wideStance,f),z:mix(entryFootZ,from+footOffset,f),y:sole+Math.sin(Math.PI*stepU)*.045,active:stepU===0||stepU===1};}
  }else if(t<prepare+count*cycleDuration){
   const elapsed=(t-prepare)/cycleDuration;cycle=Math.min(count-1,Math.floor(elapsed));u=elapsed-cycle;
   const start=from+step*cycle,end=start+step,shift=smooth((u-.40)/.28);
   hipZ=mix(start,end,shift);seatLift=liftHeight*smooth((u-.25)/.15)*(1-smooth((u-.68)/.14));pitch=lean;handBlend=1;
   stage=u<.25?'plant':u<.40?'lift':u<.68?'shift':u<.82?'settle':'recover';
   for(let i=0;i<2;i++){const stepU=cycle===0?1:clamp((u-i*.125)/.125),f=smooth(stepU),previous=from+step*Math.max(0,cycle-1)+footOffset;feet[i]={x:wideStance,z:mix(previous,start+footOffset,f),y:sole+Math.sin(Math.PI*stepU)*.045,active:stepU===0||stepU===1};}
  }else{
   cycle=count-1;stage='finish';u=(t-prepare-count*cycleDuration)/finish;hipZ=to;pitch=lean*smooth((1-u)/.7);handBlend=smooth((1-u)/.75);
   for(let i=0;i<2;i++){const stepU=clamp((u-i*.3)/.7),f=smooth(stepU);feet[i]={x:mix(wideStance,wideStance,f),z:mix(from+step*(count-1)+footOffset,exitFootZ,f),y:sole+Math.sin(Math.PI*stepU)*.035,active:stepU===0||stepU===1};}
  }
  return {active:true,propulsion:'legs',direction,cycle,stage,progress:u,hipZ,hipY:seatY+seatLift,seatLift,pitch,handBlend,handActive:false,feet};
 }
 return {duration,count,sample};
}
