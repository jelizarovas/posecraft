import * as THREE from 'three';

export const THREE_BAR_SLOPE=-.9;
export function threeJointMatrix(joint,target=new THREE.Matrix4()){
 const m=joint.m;return target.set(m[0],m[1],m[2],joint.x,m[3],m[4],m[5],joint.y,m[6],m[7],m[8],joint.z,0,0,0,1);
}
/** Static vertex buffers with independent per-influence bind coordinates.
 * This preserves clipped/weighted Posecraft surfaces that cannot always be
 * represented by one common rest position and a standard inverse-bind matrix.
 */
export function createGpuSkin(source,bindWorld,jointIds,material){
 if(jointIds.length>32)throw Error('GPU skin pilot supports at most 32 joints within the WebGL2 minimum uniform budget.');
 const correctives=source.correctives||[];if(correctives.length>4)throw Error('GPU skin pilot supports at most 4 corrective drivers per mesh.');
 const index=new Map(jointIds.map((id,i)=>[id,i])),count=source.vertices.length,positions=[],indices=[],weights=[],locals=Array.from({length:4},()=>[]),normalLocals=Array.from({length:4},()=>[]),matrixArray=jointIds.map(()=>new THREE.Matrix4()),normalArray=jointIds.map(()=>new THREE.Matrix3()),amounts=correctives.map(()=>0),v=new THREE.Vector3();
 for(const vertex of source.vertices){if(vertex.weights.length>4)throw Error('GPU skin requires at most 4 influences.');const total=vertex.weights.reduce((s,w)=>s+w.weight,0);if(!(total>0))throw Error('GPU skin requires positive weights.');let x=0,y=0,z=0;for(let i=0;i<4;i++){const w=vertex.weights[i],joint=w&&bindWorld[w.joint];if(w&&!joint)throw Error('Missing GPU skin joint.');indices.push(w?index.get(w.joint):0);weights.push(w?w.weight/total:0);locals[i].push(w?.x||0,w?.y||0,w?.z||0);if(w){v.set(w.x,w.y,w.z||0).applyMatrix4(threeJointMatrix(joint));x+=v.x*w.weight/total;y+=v.y*w.weight/total;z+=v.z*w.weight/total;}}positions.push(x,y,z);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(source.triangles.flat());geometry.computeVertexNormals();
 for(let n=0;n<count;n++){v.fromBufferAttribute(geometry.attributes.normal,n);for(let i=0;i<4;i++){const w=source.vertices[n].weights[i],m=w&&bindWorld[w.joint].m;normalLocals[i].push(m?m[0]*v.x+m[3]*v.y+m[6]*v.z:0,m?m[1]*v.x+m[4]*v.y+m[7]*v.z:0,m?m[2]*v.x+m[5]*v.y+m[8]*v.z:0);}}
 geometry.setAttribute('pcJoints',new THREE.Float32BufferAttribute(indices,4));geometry.setAttribute('pcWeights',new THREE.Float32BufferAttribute(weights,4));for(let i=0;i<4;i++){geometry.setAttribute('pcLocal'+i,new THREE.Float32BufferAttribute(locals[i],3));geometry.setAttribute('pcNormal'+i,new THREE.Float32BufferAttribute(normalLocals[i],3));}
 for(const [i,c]of correctives.entries()){const offsets=new Float32Array(count*3);for(const p of c.offsets)offsets.set([p.x||0,p.y||0,p.z||0],p.vertex*3);geometry.setAttribute('pcCorrection'+i,new THREE.BufferAttribute(offsets,3));}
 const declarations=`uniform mat4 pcBones[${jointIds.length}];uniform mat3 pcNormals[${jointIds.length}];\nattribute vec4 pcJoints;attribute vec4 pcWeights;\n`+Array.from({length:4},(_,i)=>`attribute vec3 pcLocal${i};attribute vec3 pcNormal${i};`).join('\n')+correctives.map((c,i)=>`attribute vec3 pcCorrection${i};uniform float pcAmount${i};`).join('\n');
 const xyz=['x','y','z','w'];const transform='vec3 transformed = vec3(0.0);\n'+xyz.map((a,i)=>`transformed += (pcBones[int(pcJoints.${a})] * vec4(pcLocal${i},1.0)).xyz * pcWeights.${a};`).join('\n')+correctives.map((c,i)=>`transformed += mat3(pcBones[${index.get(c.joint)}]) * pcCorrection${i} * pcAmount${i};`).join('\n');
 const normal='vec3 objectNormal = vec3(0.0);\n'+xyz.map((a,i)=>`objectNormal += pcNormals[int(pcJoints.${a})] * pcNormal${i} * pcWeights.${a};`).join('\n')+'objectNormal = normalize(objectNormal);';
 const patch=m=>{m.onBeforeCompile=shader=>{shader.uniforms.pcBones={value:matrixArray};shader.uniforms.pcNormals={value:normalArray};for(let i=0;i<correctives.length;i++)shader.uniforms['pcAmount'+i]={get value(){return amounts[i];}};shader.vertexShader=declarations+'\n'+shader.vertexShader.replace('#include <begin_vertex>',transform).replace('#include <beginnormal_vertex>',normal);};m.customProgramCacheKey=()=>`posecraft-gpu-local-normal-${jointIds.length}-${correctives.map(c=>index.get(c.joint)).join('-')}`;return m;};
 patch(material);const mesh=new THREE.Mesh(geometry,material);mesh.frustumCulled=false;mesh.castShadow=true;mesh.receiveShadow=true;mesh.customDepthMaterial=patch(new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide}));mesh.customDistanceMaterial=patch(new THREE.MeshDistanceMaterial({side:THREE.DoubleSide}));mesh.userData.gpuSkin=true;
 let disposed=false;
 return {mesh,geometry,matrices:matrixArray,update(world,pose){if(disposed)return;for(let i=0;i<jointIds.length;i++){threeJointMatrix(world[jointIds[i]],matrixArray[i]);normalArray[i].getNormalMatrix(matrixArray[i]);}for(let i=0;i<correctives.length;i++){const c=correctives[i],t=Math.max(0,Math.min(1,((pose[c.joint+'.'+c.channel]||0)-c.min)/(c.max-c.min)));amounts[i]=t*t*(3-2*t);}},dispose(){if(disposed)return;disposed=true;geometry.dispose();material.dispose();mesh.customDepthMaterial.dispose();mesh.customDistanceMaterial.dispose();}};
}
