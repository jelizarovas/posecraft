// Offline posing for the Quaternius Adventurer. Targets are metres in the source
// armature (+X to the character's left, +Z forward), before camera or heading.
const vault = {
  // frame, body pitch, twist, bank toward the planted hand (degrees), knee compression
  body: [[0,10,-9,2,-.04],[2,19,-13,9,-.12],[4,17,-7,24,-.055],[6,14,8,35,0],
    [8,11,17,31,0],[10,15,10,12,-.035],[11,21,1,4,-.13],[13,9,-9,1,-.035]],
  leftBoot: [[0,.13,.035,.27],[2,.12,.025,.02],[3,.04,.23,-.13],[4,-.10,.65,-.24],
    [5,-.21,1.04,-.24],[6,-.26,1.18,-.24],[7,-.32,1.21,-.18],[8,-.32,1.08,-.06],
    [9,-.26,.89,.19],[10,.01,.53,.29],[11,.13,.07,.30],[12,.14,.025,.16],[13,.13,.03,-.02]],
  rightBoot: [[0,-.12,.24,-.23],[2,-.16,.33,-.20],[3,-.34,.55,-.09],[4,-.48,.91,.01],
    [5,-.56,1.14,.09],[6,-.63,1.18,.21],[7,-.60,1.23,.30],[8,-.49,1.13,.40],
    [9,-.46,.90,.28],[10,-.32,.60,.09],[11,-.19,.34,-.18],[13,-.13,.17,-.27]],
  leftHand: [[0,.20,1.14,-.15],[2,.31,1.16,.32],[3,.34,1.08,.35],[4,.36,1.00,.32],
    [5,.37,.94,.24],[6,.37,.92,.12],[7,.37,.92,-.02],[8,.36,.98,-.14],
    [9,.32,1.06,-.20],[11,.23,1.20,.12],[13,.20,1.24,.33]],
  rightHand: [[0,-.21,1.27,.31],[2,-.28,1.17,-.11],[4,-.37,1.26,-.08],[6,-.37,1.54,.27],
    [7,-.33,1.58,.36],[9,-.37,1.43,.32],[11,-.25,1.24,.30],[13,-.22,1.16,-.18]],
  // Knee direction and boot roll turn the shins out sideways as the pelvis banks.
  turn: [[0,0],[2,0],[4,.48],[6,1],[8,1],[10,.36],[11,0],[13,0]],
  plant: [[0,0],[2,.62],[3,1],[8,1],[10,.3],[11,0],[13,0]]
};

const hang = {
  body: [[0,3,0,0,0]],
  leftBoot: [[0,.13,.06,.11]], rightBoot: [[0,-.14,.22,.18]],
  // Both wrists stay level, outside the head. The heels can sway independently.
  leftHand: [[0,.25,1.89,.14]], rightHand: [[0,-.25,1.89,.14]]
};
const climbLedge = {
  body: [[0,3,0,0,0],[2,-9,-2,1,0],[4,6,-5,4,0],[6,28,-8,8,0],
    [8,36,0,3,-.13],[9,28,5,1,-.22],[11,6,0,0,-.025]],
  leftBoot: [[0,.13,.06,.11],[2,.13,.22,.23],[4,.14,.56,.29],[6,.27,1.02,.41],
    [7,.27,1.14,.46],[8,.25,.82,.39],[9,.19,.23,.29],[11,.15,.025,.15]],
  rightBoot: [[0,-.14,.22,.18],[2,-.13,.28,.22],[4,-.15,.20,.18],[6,-.15,.27,.08],
    [7,-.18,.42,.03],[8,-.22,.55,.04],[9,-.21,.43,.07],[10,-.18,.17,.06],[11,-.14,.025,.02]],
  leftHand: [[0,.25,1.89,.14],[1,.24,1.82,.18],[3,.20,1.55,.32],[5,.23,1.31,.38],
    [7,.24,1.06,.34],[8,.24,.97,.25],[9,.25,.95,.22],[10,.25,1.03,.18],[11,.22,1.04,.16]],
  rightHand: [[0,-.25,1.89,.14],[1,-.24,1.82,.18],[3,-.20,1.55,.32],[5,-.17,1.31,.38],
    [7,-.16,1.06,.34],[8,-.16,.97,.25],[9,-.15,.95,.22],[10,-.21,1.04,.16],[11,-.22,1.04,.10]]
};

function sample(keys,frame){
  const end=keys.findIndex(key=>key[0]>frame);
  if(end<0)return keys.at(-1).slice(1);
  const a=keys[end-1],b=keys[end],t=(frame-a[0])/(b[0]-a[0]);
  return a.slice(1).map((v,i)=>v+(b[i+1]-v)*t);
}

// Capture one neutral pose, including each detached boot's bind offset from its
// shin. Solve in armature space so every direction renders the same deformation.
export function traversalPoser(T,model){
  const armature=model.getObjectByName('CharacterArmature'),bones={},rest={};
  const vec=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
  const q=()=>new T.Quaternion();
  const position=b=>armature.worldToLocal(b.getWorldPosition(vec()));
  const rotation=b=>armature.getWorldQuaternion(q()).invert().multiply(b.getWorldQuaternion(q()));
  function orient(b,target){
    b.quaternion.copy(rotation(b.parent).invert().multiply(target));
  }
  armature.traverse(b=>{
    if(!b.isBone)return;
    bones[b.name]=b;
    rest[b.name]={p:position(b),q:rotation(b),local:b.quaternion.clone(),offset:b.position.clone()};
  });
  function basis(axis,pole){
    const y=axis.clone().normalize(),z=vec().crossVectors(pole,y).normalize(),x=vec().crossVectors(y,z);
    return q().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));
  }
  function limb(top,mid,tip,target,pole){
    const a=rest[top].p,b=rest[mid].p,c=rest[tip].p;
    const l1=a.distanceTo(b),l2=b.distanceTo(c),start=position(bones[top]);
    const axis=target.clone().sub(start).normalize();
    const reach=T.MathUtils.clamp(target.distanceTo(start),Math.abs(l1-l2)+.001,l1+l2-.001);
    const along=(l1*l1-l2*l2+reach*reach)/(2*reach);
    const bend=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
    const joint=start.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along)));
    const end=start.clone().addScaledVector(axis,reach);
    const restPlane=vec().crossVectors(b.clone().sub(a),c.clone().sub(b));
    const plane=vec().crossVectors(joint.clone().sub(start),end.clone().sub(joint));
    for(const [name,from,to] of [[top,b.clone().sub(a),joint.clone().sub(start)],[mid,c.clone().sub(b),end.clone().sub(joint)]]){
      const delta=basis(to,plane).multiply(basis(from,restPlane).invert());
      orient(bones[name],delta.multiply(rest[name].q));
    }
    return end;
  }
  const tilt=(pitch,yaw,bank)=>q().setFromEuler(new T.Euler(...[pitch,yaw,bank].map(T.MathUtils.degToRad),'YXZ'));
  return function pose(name,frame){
    const isVault=name==='vault',isHang=name==='hang',tracks=isVault?vault:isHang?hang:climbLedge;
    const sway=isHang?Math.sin(frame*Math.PI/3):0;
    const [pitch,yaw,bank,compression]=sample(tracks.body,frame);
    const [turn]=isVault?sample(vault.turn,frame):[0];
    const [plant]=isVault?sample(vault.plant,frame):[1];
    for(const [name,b] of Object.entries(bones)){b.quaternion.copy(rest[name].local);b.position.copy(rest[name].offset);}
    const body=bones.Body;
    body.position.y+=compression;
    orient(body,tilt(pitch,yaw,-bank-sway*1.8).multiply(rest.Body.q));
    orient(bones.Head,tilt(pitch*.32-(!isVault?8:0),yaw*.35,-bank*.38).multiply(rest.Head.q));
    for(const [side,sign,label] of [['L',1,'left'],['R',-1,'right']]){
      const boot=vec(...sample(tracks[label+'Boot'],frame));
      boot.x+=sway*.035;boot.z+=sway*.023*sign;
      if(isHang)boot.y+=(1-Math.cos(frame*Math.PI/3))*.019*sign;
      const knee=vec(sign*.18-turn*.36,turn*.65,1);
      const ankle=limb('UpperLeg'+side,'LowerLeg'+side,'Foot'+side,boot,knee);
      const foot=bones['Foot'+side];
      foot.position.copy(foot.parent.worldToLocal(armature.localToWorld(ankle)));
      let toePitch=Math.min(22,boot.y*65);
      if(isVault)toePitch-=18*turn;
      if(name==='climbLedge'&&side==='L')toePitch-=32*T.MathUtils.smoothstep(boot.y,.23,1);
      orient(foot,tilt(toePitch,-turn*30,-turn*50).multiply(rest[foot.name].q));

      const hand=vec(...sample(tracks[label+'Hand'],frame));
      const overhead=isVault?0:T.MathUtils.clamp((hand.y-1.4)/.43,0,1);
      const shoulder=bones['Shoulder'+side];
      orient(shoulder,tilt(0,0,sign*overhead*44).multiply(rotation(shoulder)));
      const elbow=vec(sign*(isVault?.8:1),-.48,-1);
      limb('UpperArm'+side,'LowerArm'+side,'Wrist'+side,hand,elbow);
      const wrist=bones['Wrist'+side],tip=rest['Middle4'+side].p;
      const fingers=tip.clone().sub(rest[wrist.name].p);
      const width=rest['Pinky2'+side].p.clone().sub(rest['Index2'+side].p);
      const grip=isVault?(side==='L'?plant:0):Math.min(1,Math.max(0,(hand.y-1.3)/.44));
      const reach=isVault?0:Math.min(1,(11-frame)/1.5);
      const forearm=position(wrist).sub(position(bones['LowerArm'+side])).normalize();
      const forward=isVault?forearm.lerp(vec(sign*.05,-.08,1),grip):
        vec(sign*.04,-.90+.60*reach+1.35*grip,.25+.75*reach-.76*grip);
      const across=vec(sign*(.18+.82*(isVault?grip:reach)),0,-1+(isVault?grip:reach));
      orient(wrist,basis(forward,across).multiply(basis(fingers,width).invert()).multiply(rest[wrist.name].q));
      // Fold the fingertips over the ledge. The wrist and palm stay in contact.
      const curl=isVault?30*(1-grip)+12*grip:12+48*grip;
      const hinge=across.clone().multiplyScalar(sign).normalize();
      for(const finger of ['Index','Middle','Ring','Pinky']){
        for(const joint of [2,3]){
          const bone=bones[finger+joint+side];
          orient(bone,q().setFromAxisAngle(hinge,T.MathUtils.degToRad(curl)).multiply(rotation(bone)));
        }
      }
    }
  };
}
