const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;

/** A seated support cycle. Translation only occurs while the pelvis is lifted;
 * hands and feet stay fixed during the lift/shift/lower interval. */
export function createBenchScoot3D({from,to,armReach,legReach,seatY,sole,stance,wideStance,entryFootZ,exitFootZ,direction,tempo}){
 const count=Math.max(1,Math.ceil(Math.abs(to-from)/Math.min(.20,armReach*.42))),step=(to-from)/count;
 const prepare=1.4/tempo,cycleDuration=1.65/tempo,finish=1.5/tempo,duration=prepare+count*cycleDuration+finish;
 const footOffset=Math.min(.23,legReach*.27),liftHeight=Math.min(.022,armReach*.045),lean=42*Math.PI/180;
 const handZ=i=>from+step*(i+.5)+.27;
 function sample(time){
  const t=Math.max(0,Math.min(duration,time));
  let handLift=0,cycle=0,stage='prepare',u=0,hipZ=from,seatLift=0,pitch=0,handBlend=0,handPositionZ=handZ(0),feet=[0,1].map(()=>({z:entryFootZ,y:sole,x:wideStance,active:true}));
  if(t<prepare){
   u=t/prepare;pitch=lean*smooth(u/.7);handBlend=smooth(u/.75);
   for(let i=0;i<2;i++){const stepU=clamp((u-i*.35)/.65),f=smooth(stepU);feet[i]={x:mix(wideStance,wideStance,f),z:mix(entryFootZ,from+footOffset,f),y:sole+Math.sin(Math.PI*stepU)*.045,active:stepU===0||stepU===1};}
  }else if(t<prepare+count*cycleDuration){
   const elapsed=(t-prepare)/cycleDuration;cycle=Math.min(count-1,Math.floor(elapsed));u=elapsed-cycle;
   const start=from+step*cycle,end=start+step,shift=smooth((u-.40)/.28);
   hipZ=mix(start,end,shift);seatLift=liftHeight*smooth((u-.25)/.15)*(1-smooth((u-.68)/.14));pitch=lean;handBlend=1;
   stage=u<.25?'plant':u<.40?'lift':u<.68?'shift':u<.82?'settle':'recover';
   const reset=clamp((u-.82)/.18);
   handPositionZ=mix(handZ(cycle),handZ(Math.min(count-1,cycle+1)),smooth(reset));
   handLift=cycle<count-1?.025*Math.sin(Math.PI*reset)**2:0;
   for(let i=0;i<2;i++){const stepU=cycle===0?1:clamp((u-i*.125)/.125),f=smooth(stepU),previous=from+step*Math.max(0,cycle-1)+footOffset;feet[i]={x:wideStance,z:mix(previous,start+footOffset,f),y:sole+Math.sin(Math.PI*stepU)*.045,active:stepU===0||stepU===1};}
  }else{
   cycle=count-1;stage='finish';u=(t-prepare-count*cycleDuration)/finish;hipZ=to;pitch=lean*smooth((1-u)/.7);handBlend=smooth((1-u)/.75);handPositionZ=handZ(cycle);
   for(let i=0;i<2;i++){const stepU=clamp((u-i*.3)/.7),f=smooth(stepU);feet[i]={x:mix(wideStance,wideStance,f),z:mix(from+step*(count-1)+footOffset,exitFootZ,f),y:sole+Math.sin(Math.PI*stepU)*.035,active:stepU===0||stepU===1};}
  }
  return {active:true,direction,cycle,stage,progress:u,hipZ,hipY:seatY+seatLift,seatLift,pitch,handBlend,handLift,handZ:handPositionZ,handActive:['lift','shift','settle'].includes(stage),feet};
 }
 return {duration,count,sample};
}
