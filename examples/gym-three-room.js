import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {spatialKinematics} from '../src/spatial.js';
import {THREE_BAR_SLOPE} from '../src/three-skin.js';
import {projectGymPoint,gymBenchTargets,gymFloorPoint,gymRoomPerspective} from './gym-room.js';

/** Opaque pilot environment in authored x-right/y-down coordinates. The host
 * supplies lights, camera and its single Y-axis flip. No SVG or Atlas copy. */
export function createThreeGymRoom(document){
 const object=new THREE.Group();object.name='Posecraft gym room';
 const geometries=new Set(),materials=new Map(),dynamic=new Map();let disposed=false;
 const vec=p=>new THREE.Vector3(p.x,p.y,p.z??0),groundZ=y=>y-383-35;
 const mat=color=>{if(!materials.has(color))materials.set(color,new THREE.MeshToonMaterial({color,side:THREE.DoubleSide}));return materials.get(color);};
 const mesh=(name,geometry,color,parent=object)=>{geometries.add(geometry);const m=new THREE.Mesh(geometry,mat(color));m.name=name;m.castShadow=false;m.receiveShadow=false;parent.add(m);return m;};
 function solid(name,vertices,color,parent=object){
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flatMap(p=>[p.x,p.y,p.z]),3));
  geometry.setIndex([0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7]);const flat=geometry.toNonIndexed();geometry.dispose();flat.computeVertexNormals();return mesh(name,flat,color,parent);
 }
 function slab(name,points,thickness,color,parent=object){return solid(name,[...points,...points.map(p=>({...p,z:p.z-thickness}))],color,parent);}
 function rail(name,a,b,radius,color,parent=object){
  const from=vec(a),to=vec(b),delta=to.clone().sub(from),length=delta.length();if(length<1e-6)return null;
  const m=mesh(name,new THREE.CylinderGeometry(radius,radius,length,12,1),color,parent);m.position.copy(from.add(to).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.multiplyScalar(1/length));return m;
 }
 const at=(u,v,h=0)=>{const p=projectGymPoint(u,v,h);return {...p,z:groundZ(projectGymPoint(u,v,0).y)};};
 const rect=(u1,u2,v1,v2,h)=>[at(u1,v1,h),at(u2,v1,h),at(u2,v2,h),at(u1,v2,h)];
 function block(name,u1,u2,v1,v2,top,bottom,color){return solid(name,[...rect(u1,u2,v1,v2,top),...rect(u1,u2,v1,v2,bottom)],color);}

 // All floor vertices lie on one inclined plane. Wall bases meet that plane.
 slab('Room floor',[{x:0,y:150,z:groundZ(150)},{x:800,y:150,z:groundZ(150)},{x:800,y:450,z:groundZ(450)},{x:0,y:450,z:groundZ(450)}],8,'#c5c5b6');
 function floorJoint(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),nx=-dy/length*.48,ny=dx/length*.48,points=[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}];
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>[p.x,p.y,groundZ(p.y)+.8]),3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();mesh('Floor joint',geometry,'#b6bcaf');
 }
 for(let u=-1300;u<=480;u+=140)floorJoint(at(u,-420),at(u,1300));
 for(let v=-420;v<=1300;v+=150)floorJoint(at(-1300,v),at(480,v));
 const corner={x:445,y:228},leftY=228+(0-445)*(100-228)/(-900-445),rightY=228+(800-445)*(100-228)/(1100-445);
 const wall=(name,x1,y1,x2,y2,color)=>slab(name,[{x:x1,y:0,z:groundZ(y1)},{x:x2,y:0,z:groundZ(y2)},{x:x2,y:y2,z:groundZ(y2)},{x:x1,y:y1,z:groundZ(y1)}],8,color);
 wall('Left wall',0,leftY,445,228,'#e2e7dc');wall('Right wall',445,228,800,rightY,'#d3ded7');
 rail('Left skirting',{x:0,y:leftY,z:groundZ(leftY)+1},{...corner,z:groundZ(228)+1},2,'#91a49b');rail('Right skirting',{...corner,z:groundZ(228)+1},{x:800,y:rightY,z:groundZ(rightY)+1},2,'#91a49b');
 const wallZ=(x,right=false)=>groundZ(right?228+(x-445)*(rightY-228)/355:leftY+x*(228-leftY)/445);
 function wallPanel(name,right,x1,x2,top,bottom,color,depth){
  const vp=right?gymRoomPerspective.right:gymRoomPerspective.left,y=(value,x)=>vp.y+(value-vp.y)*(x-vp.x)/(x1-vp.x),points=[{x:x1,y:top},{x:x2,y:y(top,x2)},{x:x2,y:y(bottom,x2)},{x:x1,y:bottom}].map(p=>({...p,z:wallZ(p.x,right)+depth}));
  slab(name,points,3,color);return points;
 }
 wallPanel('Window frame',false,280,394,58,164,'#779a9d',7);const window=wallPanel('Window sky',false,286,388,66,156,'#b7d9df',9);
 const middle=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2+1});rail('Window mullion',middle(window[0],window[1]),middle(window[3],window[2]),2,'#edf1e5');rail('Window crossbar',middle(window[0],window[3]),middle(window[1],window[2]),2,'#edf1e5');
 wallPanel('Mirror frame',true,666,781,58,181,'#476570',7);wallPanel('Opaque mirror panel',true,675,772,67,170,'#b7cacc',9);
 wallPanel('Mirror glint',true,689,696,81,148,'#dbe7e5',9.5);wallPanel('Mirror glint',true,738,742,86,153,'#dbe7e5',9.5);

 // Pull-up station is real tubing. The grip rail below follows the live rig.
 const frameZ=-5;
 for(const x of [86,274]){rail('Pull-up upright',{x,y:390,z:frameZ},{x,y:135,z:frameZ},6,'#3c5265');rail('Pull-up foot',{x:x-17,y:393,z:frameZ+8},{x:x+17,y:393,z:frameZ-8},6,'#3c5265');rail('Pull-up shoulder',{x,y:135,z:frameZ},{x:x===86?106:254,y:122,z:frameZ},6,'#3c5265');}
 rail('Pull-up top beam',{x:106,y:122,z:frameZ},{x:254,y:122,z:frameZ},6,'#3c5265');
 slab('Pull-up mat',[{x:73,y:392,z:groundZ(392)+1},{x:271,y:392,z:groundZ(392)+1},{x:286,y:409,z:groundZ(409)+1},{x:76,y:409,z:groundZ(409)+1}],3,'#77877b');
 const benchMat=rect(-110,205,-60,60,0).map(p=>({...p,z:p.z+1}));slab('Bench mat',benchMat,2,'#9ca995');
 for(const u of [-62,128])for(const v of [-18,18])rail('Bench leg',at(u,v,4),at(u,v,52),3.5,'#55727a');
 rail('Bench brace',at(-62,0,20),at(128,0,20),3.5,'#47636d');block('Bench cushion',-85,155,-24,24,58,47,'#4e7880');
 for(const v of [-92,92]){rail('Barbell rack upright',at(-10,v,0),at(-10,v,134),3.5,'#627f87');rail('Barbell rack hook',at(-10,v,134),at(7,v,134),3.5,'#627f87');rail('Barbell rack foot',at(-38,v,0),at(19,v,0),3.5,'#627f87');}
 const station=gymFloorPoint(400,383),height=93*(1+station.u*gymRoomPerspective.uScale+station.v*gymRoomPerspective.vScale);
 for(const u of [-25,25])for(const v of [-17,17])rail('Water table leg',at(station.u+u,station.v+v,0),at(station.u+u,station.v+v,height-7),3,'#7b6950');
 block('Water table',station.u-32,station.u+32,station.v-24,station.v+24,height,height-9,'#b6a17c');
 for(const [name,x,y,width]of [['Window bottle shelf',320,225,62],['Mirror bottle shelf',755,275,66]]){
  const z=groundZ(y===225?323:368)-15;slab(name,[{x:x-width/2,y,z},{x:x+width/2,y,z},{x:x+width/2+8,y:y-5,z:z-12},{x:x-width/2+8,y:y-5,z:z-12}],6,'#b6a17c');
  for(const side of [-1,1])rail(name+' bracket',{x:x+side*19,y:y+20,z:z-6},{x:x+side*8,y:y+3,z:z-6},1.5,'#7b6950');
 }

 // Static pieces share materials and never move independently. Bake their local
 // transforms once, then keep one draw call per material instead of per tube.
 const batches=new Map();for(const child of [...object.children]){
  if(!child.isMesh)continue;child.updateMatrix();const geometry=child.geometry.index?child.geometry.toNonIndexed():child.geometry.clone();geometry.applyMatrix4(child.matrix);geometry.deleteAttribute('uv');
  if(!batches.has(child.material))batches.set(child.material,[]);batches.get(child.material).push(geometry);object.remove(child);geometries.delete(child.geometry);child.geometry.dispose();
 }
 for(const [material,parts]of batches){const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();if(!geometry)throw Error('Gym room geometry could not be batched.');geometries.add(geometry);const merged=new THREE.Mesh(geometry,material);merged.name='Static room / '+material.color.getHexString();object.add(merged);}
 const makeDynamic=id=>{const group=new THREE.Group();group.name=id;group.matrixAutoUpdate=false;object.add(group);dynamic.set(id,group);return group;};
 const pullbar=makeDynamic('pullbar');rail('Pull-up grip',{x:-75,y:0,z:0},{x:75,y:0,z:0},4.5,'#233445',pullbar);
 for(const x of [-43,43])rail('Grip sleeve',{x:x-9,y:0,z:0},{x:x+9,y:0,z:0},5,'#344b59',pullbar);
 const barbell=makeDynamic('barbell'),bar=gymBenchTargets().bar,c=Math.cos(-bar.rotation*Math.PI/180),s=Math.sin(-bar.rotation*Math.PI/180),localX=p=>(p.x-bar.x)*c-(p.y-bar.y)*s,left=localX(bar.ends.left),right=localX(bar.ends.right);
 // The original two-point projection has its near plate to the left. Keep
 // every authored screen-space grip fixed while restoring the missing depth.
 const barPoint=x=>({x,y:0,z:x*THREE_BAR_SLOPE});barbell.userData.depthSlope=THREE_BAR_SLOPE;
 rail('Barbell shaft',barPoint(left),barPoint(right),2.5,'#cad8d9',barbell);
 for(const [side,x]of [['left',left+11],['right',right-10]]){rail(side+' weight plate',barPoint(x-3),barPoint(x+3),22,'#365463',barbell);rail(side+' collar',barPoint(x-5),barPoint(x+5),6,'#bdced2',barbell);}
 const bottle=makeDynamic('water-bottle');rail('Bottle body',{x:0,y:-11,z:0},{x:0,y:16,z:0},8,'#73a4b3',bottle);rail('Bottle base',{x:0,y:15,z:0},{x:0,y:19,z:0},7.5,'#477584',bottle);rail('Bottle neck',{x:0,y:-20,z:0},{x:0,y:-10,z:0},4.5,'#73a4b3',bottle);rail('Bottle cap',{x:0,y:-23,z:0},{x:0,y:-19,z:0},5.5,'#334b5b',bottle);rail('Bottle label',{x:0,y:-2,z:0},{x:0,y:8,z:0},8.15,'#e5ebe0',bottle);
 const placement=new THREE.Matrix4(),jointMatrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3();
 function update(frame){
  if(disposed)return;const actor=document.actors.find(a=>a.id==='atlas'),f=frame?.actors?.find(a=>a.id===actor?.id),pack=document.packs[actor?.pack];
  if(!actor||!f||!pack){for(const g of dynamic.values())g.visible=false;return;}
  const world=spatialKinematics(pack,f.pose),t=f.placement||actor.transform;position.set(t.x,t.y,0);rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),t.rotation*Math.PI/180);scale.setScalar(t.scale);placement.compose(position,rotation,scale);
  for(const [id,g]of dynamic){const w=world[id];g.visible=!!w&&actor.hidden!==true&&(f.pose[id+'.opacity']??1)>.001;if(!w)continue;const m=w.m;jointMatrix.set(m[0],m[1],m[2],w.x,m[3],m[4],m[5],w.y,m[6],m[7],m[8],w.z,0,0,0,1);g.matrix.multiplyMatrices(placement,jointMatrix);g.matrixWorldNeedsUpdate=true;}
 }
 // Safe before the first evaluated frame arrives; authored neutral equipment.
 pullbar.matrix.makeTranslation(180,150,0);barbell.matrix.makeRotationZ(bar.rotation*Math.PI/180);barbell.matrix.setPosition(bar.x,bar.y,0);bottle.matrix.makeTranslation(400,270,0);
 return {object,update,dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();for(const m of materials.values())m.dispose();geometries.clear();materials.clear();object.clear();}};
}
