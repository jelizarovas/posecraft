import * as THREE from 'three';
import {spatialKinematics,poseDefaults} from './spatial.js';
import {createGpuSkin,threeJointMatrix,THREE_BAR_SLOPE} from './three-skin.js';


/** Lift the authored screen-plane rig into coherent shoulder/hip depth. Contact
 * x/y anchors remain exact; two-bone depth is reconstructed for this pilot only.
 * Reach is capped to115% by limiting the anatomical depth shift when necessary.
 */
export function evaluateThreeAtlasPose(pack,pose){
 const world=spatialKinematics(pack,pose),diagnostics={maxStretch:1,depthLimited:0},v=p=>new THREE.Vector3(p.x,p.y,p.z),column=(m,c)=>new THREE.Vector3(m[c],m[c+3],m[c+6]);
 const orient=(joint,end,length)=>{const x=v(end).sub(v(joint)).divideScalar(length),unit=x.clone().normalize(),old=column(joint.m,1),y=old.addScaledVector(unit,-old.dot(unit));if(y.lengthSq()<1e-10)y.set(0,0,1).addScaledVector(unit,-unit.z);y.normalize();const z=new THREE.Vector3().crossVectors(unit,y).normalize();joint.m=[x.x,y.x,z.x,x.y,y.y,z.y,x.z,y.z,z.z];};
 for(const side of ['left','right'])for(const leg of [false,true]){const sign=side==='left'?-1:1,upper=world[side+(leg?'Thigh':'Upper')],lower=world[side+(leg?'Calf':'Lower')],end=world[side+(leg?'Foot':'Hand')],body=world[leg?'pelvis':'torso'],length=leg?36:40;if(!upper||!lower||!end||!body)continue;
  const wanted=body.z+body.m[6]*sign*(leg?16:34)+body.m[7]*(leg?12:-20);
  if(!leg&&world.barbell&&(pose['barbell.opacity']??1)>0){const bar=world.barbell,dx=end.x-bar.x,dy=end.y-bar.y,localX=bar.m[0]*dx+bar.m[3]*dy,localY=bar.m[1]*dx+bar.m[4]*dy;if(Math.abs(localX)<45&&Math.abs(localY)<2.5)end.z=bar.z+localX*THREE_BAR_SLOPE;}
  const screen=Math.hypot(end.x-upper.x,end.y-upper.y),maxReach=length*2*1.15,available=Math.sqrt(Math.max(0,maxReach*maxReach-screen*screen)),z=Math.max(end.z-available,Math.min(end.z+available,wanted));if(Math.abs(z-wanted)>1e-6)diagnostics.depthLimited++;upper.z=z;
  const start=v(upper),finish=v(end),delta=finish.clone().sub(start),distance=delta.length(),stretch=Math.max(1,distance/(length*2)),segment=length*stretch;diagnostics.maxStretch=Math.max(diagnostics.maxStretch,stretch);const axis=distance>1e-9?delta.multiplyScalar(1/distance):new THREE.Vector3(0,1,0),middle=start.clone().addScaledVector(axis,distance/2),guide=v(lower).sub(middle);guide.addScaledVector(axis,-guide.dot(axis));if(guide.lengthSq()<1e-10){guide.copy(column(upper.m,1));guide.addScaledVector(axis,-guide.dot(axis));}if(guide.lengthSq()<1e-10)guide.set(0,0,1);guide.normalize();const elbow=middle.addScaledVector(guide,Math.sqrt(Math.max(0,segment*segment-distance*distance/4)));lower.x=elbow.x;lower.y=elbow.y;lower.z=elbow.z;orient(upper,lower,length);orient(lower,end,length);
 }
 return {world,diagnostics};
}

/** Optional Atlas pilot. Coordinates remain in Posecraft actor units (Y down).
 * A containing scene can flip Y once for a conventional Three.js camera.
 * Painter layerDepth is deliberately not physical depth in this renderer.
 */
export function createThreeAtlas(pack){
 for(const id of ['root','torso','head','leftUpper','rightUpper','leftHand','rightHand','leftFoot','rightFoot'])if(!pack.joints.some(j=>j.id===id))throw Error('Atlas3D requires the Atlas articulated rig.');
 if(!pack.parts.some(p=>p.id==='trunk'&&p.spatial?.mesh))throw Error('Atlas3D requires the connected skin mesh.');
 const object=new THREE.Group();object.name='Atlas3D';const ids=pack.joints.map(j=>j.id),bind=spatialKinematics(pack,{'leftUpper.rotation':180,'rightUpper.rotation':0,'leftThigh.rotation':90,'rightThigh.rotation':90}),skins=[],rigid=[],anchors=[],materials=[],geometries=[];
 const ramp=new THREE.DataTexture(new Uint8Array([65,145,230]),3,1,THREE.RedFormat);ramp.minFilter=ramp.magFilter=THREE.NearestFilter;ramp.generateMipmaps=false;ramp.needsUpdate=true;
 const material=(color,overlay=false)=>{const m=new THREE.MeshToonMaterial({color,gradientMap:ramp,side:THREE.DoubleSide,...(overlay?{polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}:{})});materials.push(m);return m;};
 for(const part of pack.parts){if(!part.spatial?.mesh)continue;const m=material(part.fill,part.id!=='trunk'),skin=createGpuSkin(part.spatial.mesh,bind,ids,m);skin.mesh.name=part.id;skin.mesh.userData.part=part.id;skins.push(skin);object.add(skin.mesh);}
 const skin=material('#c98159'),hair=material('#40332e'),beard=material('#534037'),eyeWhite=material('#fff4dd'),iris=material('#353535'),shoe=material('#e9e5da'),sole=material('#404c59'),mouthMaterial=material('#733b32');
 const sphere=new THREE.SphereGeometry(1,20,14);geometries.push(sphere);
 const anchor=(joint,name=joint+'-anchor')=>{const group=new THREE.Group();group.name=name;group.matrixAutoUpdate=false;object.add(group);anchors.push({joint,group});return group;};
 const ellipsoid=(parent,name,at,size,mat,geometry=sphere)=>{const mesh=new THREE.Mesh(geometry,mat);mesh.name=name;mesh.position.set(...at);mesh.scale.set(...size);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);rigid.push(mesh);return mesh;};
 const head=anchor('head');ellipsoid(head,'cranium',[0,-3,0],[23,29,20],skin);ellipsoid(head,'jaw',[0,13,3],[20,16,18],skin);
 for(const sign of [-1,1])ellipsoid(head,'ear-'+sign,[sign*23,0,0],[4,8,4.5],skin);
 const capPositions=[],capIndices=[],segments=24,rings=8;
 for(let r=0;r<=rings;r++)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,front=(Math.cos(a)+1)/2,edge=1.93-.86*front+.045*Math.sin(a*5),theta=.025+(edge-.025)*r/rings,ruffle=1+.035*Math.sin(a*7)*Math.sin(theta);capPositions.push(Math.sin(a)*24.6*Math.sin(theta)*ruffle,1-35*Math.cos(theta),Math.cos(a)*22.1*Math.sin(theta)*ruffle);}
 for(let r=0;r<rings;r++)for(let i=0;i<segments;i++){const a=r*(segments+1)+i,b=a+segments+1;capIndices.push(a,b,a+1,a+1,b,b+1);}const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));cap.setIndex(capIndices);cap.computeVertexNormals();geometries.push(cap);ellipsoid(head,'hair-cap',[0,0,0],[1,1,1],hair,cap);
 // The lower beard wraps the jaw; its far side occludes naturally in a turn.
 const beardGeometry=new THREE.SphereGeometry(1,20,10,0,Math.PI,Math.PI/2,Math.PI/2);geometries.push(beardGeometry);ellipsoid(head,'beard',[0,5,3],[21,-24,21],beard,beardGeometry);
 for(const sign of [-1,1])ellipsoid(head,'moustache-'+sign,[sign*5,7,22],[6,2.8,2],beard);
 ellipsoid(head,'nose',[0,-3,20],[4.5,6,8],skin);
 const eyes=[];for(const sign of [-1,1]){const eye=new THREE.Group();eye.name='eye-'+sign;eye.position.set(sign*9,-9,18.3);head.add(eye);ellipsoid(eye,'eye-white',[0,0,0],[3.5,3.8,1.2],eyeWhite);ellipsoid(eye,'pupil',[0,0,1],[1.65,2.2,.65],iris);eyes.push(eye);ellipsoid(head,'brow-ridge-'+sign,[sign*9,-15.5,17.8],[5.8,2,2],skin);const brow=ellipsoid(head,'brow-'+sign,[sign*9,-16.5,18.7],[5.8,1.4,1.3],hair);brow.rotation.z=sign*.1;}
 const mouth=ellipsoid(head,'mouth',[0,12,24.5],[5,1.3,1.3],mouthMaterial);
 for(const side of ['left','right']){const foot=anchor(side+'Foot');ellipsoid(foot,side+'-sole',[0,6,6],[12.8,2.4,20.5],sole);ellipsoid(foot,side+'-shoe',[0,1.5,6],[12.4,6.4,20],shoe);ellipsoid(foot,side+'-shoe-tongue',[0,-3.5,8],[6.5,2.8,9],eyeWhite);for(let i=0;i<3;i++)ellipsoid(foot,side+'-lace-'+i,[0,-5,4+i*4],[6,.65,.8],sole);
  const hand=anchor(side+'Hand');ellipsoid(hand,side+'-palm',[2,0,0],[7,6.5,5],skin);ellipsoid(hand,side+'-thumb',[-1,4,2.5],[3,4.5,3],skin);
 }
 let disposed=false;const stats={gpuSkinnedMeshes:skins.length,vertices:skins.reduce((n,s)=>n+s.geometry.attributes.position.count,0),triangles:skins.reduce((n,s)=>n+s.geometry.index.count/3,0),joints:ids.length,rigidMeshes:rigid.length,rigidTriangles:rigid.reduce((n,m)=>n+m.geometry.index.count/3,0),correctives:pack.parts.reduce((n,p)=>n+(p.spatial?.mesh?.correctives?.length||0),0),disposed:false};
 function update(pose){if(disposed)return;const {world,diagnostics}=evaluateThreeAtlasPose(pack,pose);Object.assign(stats,diagnostics);for(const s of skins)s.update(world,pose);for(const {joint,group}of anchors)threeJointMatrix(world[joint],group.matrix);const blink=Math.max(pose['face-blink.opacity']||0,1-(pose['face-neutral.opacity']??1));for(const eye of eyes)eye.scale.y=1-.9*Math.max(0,Math.min(1,blink));const effort=pose['face-effort.opacity']||0;mouth.scale.y=1.3+effort*3;mouth.position.y=12+effort;object.updateMatrixWorld(true);}
 update(poseDefaults(pack));
 return {object,update,stats,dispose(){if(disposed)return;disposed=true;stats.disposed=true;for(const s of skins)s.dispose();for(const geometry of new Set(geometries))geometry.dispose();const skinMaterials=new Set(skins.map(s=>s.mesh.material));for(const m of new Set(materials))if(!skinMaterials.has(m))m.dispose();ramp.dispose();object.removeFromParent();object.clear();}};
}
