import {Quaternion,Vector3} from 'three';

/** Convert an authored local palm contact frame into a wrist IK target.
 * Grip offsets are in character meters; scale is the actor placement scale.
 */
export function wristTargetForGrip3D(grip,target,scale=1){
  if(!Number.isFinite(scale)||scale<=0)throw new Error('Grip scale must be finite and positive.');
  const rotation=new Quaternion().fromArray(target.rotation??[0,0,0,1]).multiply(new Quaternion().fromArray(grip.rotation).invert()).normalize();
  const position=new Vector3().fromArray(target.position).sub(new Vector3().fromArray(grip.position).multiplyScalar(scale).applyQuaternion(rotation));
  return {position:position.toArray(),rotation:rotation.toArray()};
}

/** Apply declared finger rotations to a copied native pose. No bone-name guesses. */
export function applyGripPose3D(rig,pose,grip,amount){
  if(!Number.isFinite(amount))throw new Error('Grip amount must be finite.');
  const t=Math.max(0,Math.min(1,amount)),result=structuredClone(pose),joints=new Map(rig.joints.map(j=>[j.id,j]));
  for(const finger of grip.fingers){const bind=joints.get(finger.joint);if(!bind)throw new Error(`Grip references missing finger ${finger.joint}.`);const rotation=new Quaternion().fromArray(bind.rotation).multiply(new Quaternion().setFromAxisAngle(new Vector3().fromArray(finger.axis).normalize(),finger.angle*t)).normalize();result[finger.joint]={...result[finger.joint],rotation:rotation.toArray()};}
  return result;
}

/** Blend to an authored open support pose without changing wrist or bone lengths. */
export function applySupportPose3D(rig,pose,grip,amount){
  if(!Number.isFinite(amount))throw new Error('Support amount must be finite.');
  const t=Math.max(0,Math.min(1,amount)),result=structuredClone(pose),joints=new Map(rig.joints.map(j=>[j.id,j]));
  for(const finger of grip.supportFingers??[]){
    const bind=joints.get(finger.joint);if(!bind)throw new Error(`Support references missing finger ${finger.joint}.`);
    const rotation=new Quaternion().fromArray(pose[finger.joint]?.rotation??bind.rotation).slerp(new Quaternion().fromArray(finger.rotation),t).normalize();
    result[finger.joint]={...result[finger.joint],rotation:rotation.toArray()};
  }
  return result;
}
