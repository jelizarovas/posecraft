/** Add compact elbow/wrist controls after Ona's standard spatial rig is built.
 * Existing shoulder IDs, rest transforms, action keys and physical bodies remain
 * authoritative. Campfire has its own arm chains and should not call this helper.
 */
export function addOnaArmJoints(pack){
 if(!pack?.spatial||!Array.isArray(pack.joints)||!Array.isArray(pack.parts))throw new Error('Build Ona’s spatial rig before adding arm joints.');
 const specs=['left','right'].map(side=>{
  const shoulder=side+'Arm',elbow=side+'Forearm',wrist=side+'Wrist',part=pack.parts.find(p=>p.id===side+'-arm-volume'),upper=pack.joints.find(j=>j.id===shoulder),sign=side==='left'?-1:1;
  if(!upper||!part||part.joint!==shoulder)throw new Error('Expected Ona’s standard left and right arm artwork.');
  if(pack.joints.filter(j=>j.id===elbow).length>1||pack.joints.filter(j=>j.id===wrist).length>1)throw new Error(`Arm joint name already exists: ${elbow} or ${wrist}.`);
  const existingElbow=pack.joints.find(j=>j.id===elbow),existingWrist=pack.joints.find(j=>j.id===wrist),converted=part.spatial?.softLimb?.elbow===elbow&&part.spatial?.softLimb?.hand===wrist&&existingElbow?.parent===shoulder&&existingWrist?.parent===elbow;
  if(!converted&&(existingElbow||existingWrist))throw new Error(`Arm joint name already exists: ${elbow} or ${wrist}.`);
  return {side,shoulder,elbow,wrist,part,upper,sign,converted};
 });
 for(const {side,shoulder,elbow,wrist,part,sign,converted} of specs){
  if(!converted){
  pack.joints.push({id:elbow,parent:shoulder,x:sign*4,y:13,rotation:0,min:side==='left'?-20:-105,max:side==='left'?105:20,length:0},{id:wrist,parent:elbow,x:sign*2,y:12,rotation:90,min:-180,max:180,length:0});
  // Continuous rounded skin, including the palm, uses the existing part ID and
  // appearance channel. No separate fingers or narrow hand stalk are introduced.
  const {morph,thickness,axis,...spatial}=part.spatial||{};
  part.spatial={...spatial,softLimb:{elbow,hand:wrist,radius:6.5}};
  delete part.transform;
  part.d='M0 0';
  }
  for(const clip of Object.values(pack.clips||{})){
   const legacy=clip.tracks[shoulder+'.bend'];
   if(legacy&&!clip.tracks[elbow+'.rotation'])clip.tracks[elbow+'.rotation']=legacy.map(([time,value,easing])=>easing===undefined?[time,-sign*70*value||0]:[time,-sign*70*value||0,easing]);
  }
 }
 return pack;
}
