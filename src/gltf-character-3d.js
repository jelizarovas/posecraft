import {Box3, Group, Matrix4, Quaternion, Vector3} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {compileRig3D, evaluateRig3D} from './rig-3d.js';

const normalizedName = name => name.toLowerCase().replace(/^mixamorig\d*[:_]?/, '').replace(/[^a-z0-9]/g, '');
const names = {
  pelvis: ['pelvis','hips','hip'], torso: ['spine01','spine','spine1'],
  chest: ['spine03','spine2','chest','spine02'], neck: ['neck01','neck'], head: ['head'],
};
for (const [side,suffix] of [['left','l'],['right','r']]) {
  names[side+'Clavicle'] = ['clavicle'+suffix,side+'shoulder'];
  names[side+'Shoulder'] = ['upperarm'+suffix,side+'arm',side+'upperarm','arm'+suffix];
  names[side+'Elbow'] = ['lowerarm'+suffix,side+'forearm',side+'lowerarm','forearm'+suffix];
  names[side+'Wrist'] = ['hand'+suffix,side+'hand',side+'wrist'];
  names[side+'Hip'] = ['thigh'+suffix,side+'upleg',side+'thigh',side+'upperleg'];
  names[side+'Knee'] = ['calf'+suffix,side+'leg',side+'lowerleg','shin'+suffix];
  names[side+'Ankle'] = ['foot'+suffix,side+'foot',side+'ankle'];
  names[side+'Toe'] = ['ball'+suffix,side+'toebase',side+'toe','toe'+suffix];
}
const required = ['pelvis','torso','chest','head',...['left','right'].flatMap(side=>['Shoulder','Elbow','Wrist','Hip','Knee','Ankle'].map(part=>side+part))];
const close = (a,b,tolerance=2e-5) => Math.abs(a-b) <= tolerance*Math.max(1,Math.abs(a),Math.abs(b));
const worldPosition = node => node.getWorldPosition(new Vector3());
const worldRotation = node => node.getWorldQuaternion(new Quaternion()).normalize();

function disposeScene(scene) {
  const geometries = new Set(), materials = new Set(), textures = new Set(), skeletons = new Set();
  scene.traverse(node=>{
    if (node.geometry) geometries.add(node.geometry);
    if (node.material) for (const material of Array.isArray(node.material)?node.material:[node.material]) materials.add(material);
    if (node.skeleton) skeletons.add(node.skeleton);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) { texture.dispose(); texture.source?.data?.close?.(); }
}

/** Adapt a parsed glTF without rebuilding its geometry, weights or morph targets.
 * The adapter owns the supplied scene after success. It supports humanoid rigs
 * with positive uniform node scales; shear/reflections/nonuniform scales fail.
 */
export function createCharacter3D(gltf, options = {}) {
  if (!gltf?.scene?.isObject3D) throw new Error('Character import requires a parsed glTF scene.');
  const scene = gltf.scene, bones = [], skins = [], seen = new Set();
  scene.updateMatrixWorld(true);
  scene.traverse(node=>{
    if (node.isSkinnedMesh) {
      skins.push(node);
      if (!node.geometry.getAttribute('skinIndex') || !node.geometry.getAttribute('skinWeight')) throw new Error(`Skinned mesh ${node.name} has no skin weights.`);
      for (const bone of node.skeleton.bones) if (!seen.has(bone)) { seen.add(bone); bones.push(bone); }
    }
  });
  if (!skins.length) throw new Error('No skinned mesh found. Import a rigged GLB with joint weights, not a static model.');
  if (bones.length > 255) throw new Error('Character import supports at most 255 bones.');
  // A native pose has rigid joint transforms. Uniform source scale is absorbed
  // into metric bind offsets; retaining a nonuniform scale would introduce shear.
  const relevant = new Set();
  for (const bone of bones) for (let node=bone;node;node=node.parent) { relevant.add(node); if(node===scene) break; }
  for (const node of relevant) {
    const {x,y,z}=node.scale;
    if (![x,y,z].every(Number.isFinite) || x<=0 || !close(x,y) || !close(x,z)) throw new Error(`Unsupported nonuniform or reflected scale on ${node.name||'unnamed node'}. Apply transforms in the authoring tool before export.`);
  }
  const byName = new Map(), ids = new Map();
  for (const bone of bones) {
    if (!bone.name || byName.has(bone.name)) throw new Error('Skeleton bone names must be unique and nonempty.');
    byName.set(bone.name,bone); ids.set(bone,bone.name);
  }
  const known = new Map();
  for (const bone of bones) {const key=normalizedName(bone.name);if(!known.has(key))known.set(key,bone);else known.set(key,null);}
  const roles = {};
  for (const [role,aliases] of Object.entries(names)) {
    const override=options.roles?.[role];
    if (override && !byName.has(override)) throw new Error(`Role ${role} references missing bone ${override}.`);
    const bone=override?byName.get(override):aliases.map(alias=>known.get(alias)).find(Boolean);
    if (bone) roles[role]=bone.name;
  }
  const missing=required.filter(role=>!roles[role]);
  if (missing.length) throw new Error(`Cannot map humanoid roles: ${missing.join(', ')}. Use Mixamo/Unreal/Quaternius bone names or provide options.roles.`);
  for (const role of Object.keys(options.roles||{})) if (!Object.hasOwn(names,role)) throw new Error(`Unknown humanoid role ${role}.`);
  const parentBone=bone=>{for(let node=bone.parent;node&&node!==scene;node=node.parent)if(seen.has(node))return node;return null;};
  const ordered=[];
  const add=bone=>{if(ordered.includes(bone))return;const parent=parentBone(bone);if(parent)add(parent);ordered.push(bone);};bones.forEach(add);
  const bounds=new Box3().setFromObject(scene,true),sourceHeight=bounds.max.y-bounds.min.y;
  if (!Number.isFinite(sourceHeight)||sourceHeight<.001) throw new Error('Character has no measurable Y-up height. Export the model Y-up in meters.');
  const height=options.height??sourceHeight;
  if (!Number.isFinite(height)||height<.1||height>10) throw new Error('Character height must be between 0.1 and 10 meters.');
  const normalizationScale=height/sourceHeight;
  // Toe direction disambiguates known humanoid exports facing -Z. We do not
  // infer an arbitrary missing forward axis from the camera or screen position.
  const forward=new Vector3();
  for(const side of ['left','right'])if(roles[side+'Toe'])forward.add(worldPosition(byName.get(roles[side+'Toe'])).sub(worldPosition(byName.get(roles[side+'Ankle']))));
  forward.y=0;
  const yaw=forward.lengthSq()>1e-8?-Math.atan2(forward.x,forward.z):0;
  const facing=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),yaw);
  const center=worldPosition(byName.get(roles.leftAnkle)).add(worldPosition(byName.get(roles.rightAnkle))).multiplyScalar(.5);center.y=bounds.min.y;
  const root=new Group();root.name='Character3D';
  const motion=new Group();motion.name='CharacterPose';
  const normalization=new Group();normalization.name='CharacterUnits';normalization.scale.setScalar(normalizationScale);normalization.quaternion.copy(facing);normalization.position.copy(center).multiplyScalar(-normalizationScale).applyQuaternion(facing);
  root.add(motion);motion.add(normalization);normalization.add(scene);root.updateMatrixWorld(true);
  let rootId='model-root';while(byName.has(rootId))rootId+='-root';roles.root=rootId;
  const joints=[{id:rootId,parent:null,position:[0,0,0],rotation:[0,0,0,1]}];
  for(const bone of ordered){
    const parent=parentBone(bone),parentPosition=parent?worldPosition(parent):new Vector3(),parentRotation=parent?worldRotation(parent):new Quaternion(),position=worldPosition(bone).sub(parentPosition).applyQuaternion(parentRotation.clone().invert()),rotation=parentRotation.clone().invert().multiply(worldRotation(bone)).normalize();
    joints.push({id:bone.name,parent:parent?.name??rootId,position:position.toArray(),rotation:rotation.toArray()});
  }
  const rig={joints,chains:{}};
  const bindWorld=evaluateRig3D(compileRig3D(rig));
  for(const side of ['left','right'])for(const [limb,parts]of [['Arm',['Shoulder','Elbow','Wrist']],['Leg',['Hip','Knee','Ankle']]]){
    const [a,b,c]=parts.map(part=>roles[side+part]);
    if(joints.find(j=>j.id===b).parent!==a||joints.find(j=>j.id===c).parent!==b)throw new Error(`The ${side}${limb} chain contains intermediary bones. Export direct upper/lower/end joints or supply a compatible rig.`);
    const p=bindWorld[a].position;
    // Poles are editable model-space points. Arms bend toward the front/outside,
    // knees forward. They are initial defaults, not anatomical limit claims.
    rig.chains[side+limb]={root:a,middle:b,tip:c,pole:[p[0]+(limb==='Arm'?(side==='left'?.35:-.35):0),p[1]-(limb==='Arm'?.35:0),p[2]+1],bend:{min:0,max:Math.PI*.96}};
  }
  const compiled=compileRig3D(rig),rest=evaluateRig3D(compiled),animations=gltf.animations??[];
  // Declared contact calibration for the bundled Quaternius hands. Other rigs
  // remain usable for IK but need their own authored palm/finger metadata.
  const grips={};
  for(const [side,suffix,sign]of [['left','l',1],['right','r',-1]])if(roles[side+'Wrist']==='hand_'+suffix&&byName.has('middle_01_'+suffix)){
    const fingerIds=['index','middle','ring','pinky'].flatMap(name=>[1,2,3].map(n=>({joint:`${name}_0${n}_${suffix}`,axis:[1,0,0],angle:[1.4,1.65,1.15][n-1]}))).concat([2,3].map(n=>({joint:`thumb_0${n}_${suffix}`,axis:[1,0,0],angle:.9})));
    const wristRotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0,sign,0),new Vector3(0,0,-1),new Vector3(-sign,0,0)));
    const knuckle=joints.find(j=>j.id===`middle_01_${suffix}`).position;
    grips[side]={joint:roles[side+'Wrist'],position:[sign*(Math.abs(knuckle[0])+.021*normalizationScale),knuckle[1]-.015*normalizationScale,knuckle[2]*.4],rotation:wristRotation.invert().toArray(),fingers:fingerIds.filter(f=>byName.has(f.joint))};
    const supportFingers=[],fingerFrames=new Map([[roles[side+'Wrist'],new Quaternion()]]);
    for(const name of ['thumb','index','middle','ring','pinky'])for(let segment=1;segment<=3;segment++){
      const joint=joints.find(j=>j.id===`${name}_0${segment}_${suffix}`),child=joint&&joints.find(j=>j.parent===joint.id);
      if(!joint||!child)continue;
      const parent=fingerFrames.get(joint.parent);if(!parent)continue;
      const current=parent.clone().multiply(new Quaternion().fromArray(joint.rotation)),direction=new Vector3().fromArray(child.position).applyQuaternion(current).normalize(),flat=direction.clone();flat.x=0;
      if(flat.lengthSq()<1e-8)flat.set(0,1,0);else flat.normalize();
      const corrected=new Quaternion().setFromUnitVectors(direction,flat).multiply(current).normalize();
      supportFingers.push({joint:joint.id,rotation:parent.clone().invert().multiply(corrected).normalize().toArray()});fingerFrames.set(joint.id,corrected);
    }
    grips[side].supportFingers=supportFingers;
    // Measure the open palm separately from the calibrated closed bar grip.
    // The declared hand frame supplies its normal; skin supplies its thickness.
    const wrist=rest[roles[side+'Wrist']],inverseWrist=new Quaternion().fromArray(wrist.rotation).invert(),origin=new Vector3().fromArray(wrist.position),vertex=new Vector3();
    let supportHeight=0;
    for(const mesh of skins){
      const boneIndex=mesh.skeleton.bones.findIndex(bone=>bone.name===roles[side+'Wrist']),indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
      if(boneIndex<0)continue;
      for(let i=0;i<indices.count;i++){
        let influence=0;for(let component=0;component<4;component++)if(indices.getComponent(i,component)===boneIndex)influence+=weights.getComponent(i,component);
        if(influence<.6)continue;
        mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(inverseWrist);
        if(vertex.y>knuckle[1]*.25&&vertex.y<knuckle[1]*.8&&Math.abs(vertex.z)<knuckle[1]*.3)supportHeight=Math.max(supportHeight,sign*vertex.x);
      }
    }
    if(supportHeight>0)grips[side].supportHeight=supportHeight;
  }
  let disposed=false;
  const metadata={height,sourceHeight,normalizationScale,facingYaw:yaw,bones:bones.length,skinnedMeshes:skins.length,triangles:skins.reduce((sum,mesh)=>sum+(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3,0),morphTargets:skins.reduce((sum,mesh)=>sum+(mesh.morphTargetInfluences?.length??0),0),animations:animations.length};
  function apply(pose={},placement={}){
    if(disposed)throw new Error('Character has been disposed.');
    const world=evaluateRig3D(compiled,pose,placement);
    root.position.fromArray(placement.position??[0,0,0]);root.quaternion.fromArray(placement.rotation??[0,0,0,1]).normalize();root.scale.setScalar(placement.scale??1);
    motion.position.fromArray(pose[rootId]?.position??[0,0,0]);motion.quaternion.fromArray(pose[rootId]?.rotation??[0,0,0,1]).normalize();root.updateMatrixWorld(true);
    for(const bone of ordered){
      const desired=world[bone.name],parent=bone.parent;
      bone.position.fromArray(desired.position).applyMatrix4(new Matrix4().copy(parent.matrixWorld).invert());
      bone.quaternion.copy(parent.getWorldQuaternion(new Quaternion()).invert()).multiply(new Quaternion().fromArray(desired.rotation)).normalize();
      bone.updateMatrix();bone.updateWorldMatrix(false,false);
    }
    root.updateMatrixWorld(true);for(const mesh of skins)mesh.skeleton.update();
    return world;
  }
  // Include finger and thumb skin in the final support clearance. This is
  // evaluated once at import, using the same deformation as the renderer.
  const supportPose={};for(const grip of Object.values(grips))for(const finger of grip.supportFingers??[])supportPose[finger.joint]={rotation:finger.rotation};
  if(Object.keys(supportPose).length){
    apply(supportPose);
    for(const [side,sign]of [['left',1],['right',-1]]){
      const grip=grips[side];if(!grip)continue;
      const handJoints=new Set([grip.joint]);for(const joint of joints)if(handJoints.has(joint.parent))handJoints.add(joint.id);
      const origin=new Vector3().fromArray(rest[grip.joint].position),inverse=new Quaternion().fromArray(rest[grip.joint].rotation).invert(),vertex=new Vector3();
      for(const mesh of skins){
        const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;
        for(let i=0;i<indices.count;i++){
          let influence=0;for(let c=0;c<4;c++)if(handJoints.has(mesh.skeleton.bones[indices.getComponent(i,c)]?.name))influence+=weights.getComponent(i,c);
          if(influence<.6)continue;
          mesh.getVertexPosition(i,vertex).applyMatrix4(mesh.matrixWorld).sub(origin).applyQuaternion(inverse);
          grip.supportHeight=Math.max(grip.supportHeight??0,sign*vertex.x);
        }
      }
    }
    apply();
  }
  return {root,rig,compiledRig:compiled,roles,grips,rest,animations,metadata,apply,dispose(){if(disposed)return;disposed=true;disposeScene(scene);root.removeFromParent();root.clear();}};
}

/** Load a local/network GLB or glTF URL. Blob URLs support user-selected GLB files.
 * The bundled models are self-contained; ordinary .gltf imports may load sidecars.
 */
export async function loadCharacter3D(url, options = {}) {
  if(typeof url!=='string'||!url.length)throw new Error('Character URL must be a nonempty string or a GLB blob URL.');
  let gltf;
  try {gltf=await new GLTFLoader().loadAsync(url);return createCharacter3D(gltf,options);}
  catch(error){if(gltf?.scene)disposeScene(gltf.scene);throw new Error(`Character import failed: ${error.message}`,{cause:error});}
}
