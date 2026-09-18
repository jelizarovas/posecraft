/** Relaxed arm goals in a Y-up, +Z-forward character frame.
 * The hand may swing ahead/behind the shoulder while the elbow's bend plane
 * remains posterior. Heading rotates that frame around Y; shoulder is already
 * expressed in the receiving scene/bench coordinates. Distances are meters.
 */
export function relaxedArmGoal({shoulder,sign,length,heading=0,swing=0}){
  if(!Array.isArray(shoulder)||shoulder.length!==3||!shoulder.every(Number.isFinite))throw new Error('Arm shoulder must be three finite coordinates.');
  if(sign!==1&&sign!==-1)throw new Error('Arm side sign must be -1 or 1.');
  if(!Number.isFinite(length)||length<=0)throw new Error('Arm length must be finite and positive.');
  if(!Number.isFinite(heading)||!Number.isFinite(swing))throw new Error('Arm heading and swing must be finite.');
  const lateral=sign*length*.04,forward=length*.065+Math.max(-length*.25,Math.min(length*.25,swing)),reach=length*.975;
  const drop=Math.sqrt(reach*reach-lateral*lateral-forward*forward),c=Math.cos(heading),s=Math.sin(heading);
  const at=(x,y,z)=>[shoulder[0]+c*x+s*z,shoulder[1]+y,shoulder[2]-s*x+c*z];
  return {hand:at(lateral,-drop,forward),pole:at(sign*length*.08,-length*.4,-length*.8)};
}
