const clamp=t=>Math.max(0,Math.min(1,t));
const ease=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
const mix=(a,b,t)=>a+(b-a)*t;

/** A seated-to-standing transfer over fixed feet, reversible for sitting.
 * Lean while the seat still carries weight, then extend legs and unfold.
 * Coordinates and angles are bench-local meters and radians. */
export function sampleSeatTransfer3D(progress,{seatY,standY,sitZ,footZ}){
 const u=clamp(progress),rise=ease((u-.34)/.5),lean=ease((u-.08)/.26);
 const pitch=36*Math.PI/180*lean*(1-ease((u-.44)/.46));
 const shift=Math.min(.09,(footZ-sitZ)*.35)*lean;
 return {stage:u<.08?'prepare':u<.34?'lean':u<.84?'push':'settle',rise,pitch,
  hipY:mix(seatY,standY,rise),hipZ:mix(sitZ+shift,footZ,ease((u-.34)/.52)),
  armRelease:ease((u-.38)/.44),brace:ease((u-.1)/.20)*(1-ease((u-.52)/.25))};
}
