import * as THREE from 'three';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
/** A bounded spherical pendulum. The cable stays taut while dragged or released. */
export function createPendantState(anchor,length=.7){
 const state={anchor:[...anchor],length,offset:[0,0],velocity:[0,0],position:[anchor[0],anchor[1]-length,anchor[2]]};
 const place=()=>{const d=Math.hypot(...state.offset),limit=length*.78;if(d>limit){state.offset=state.offset.map(v=>v*limit/d);const outward=(state.velocity[0]*state.offset[0]+state.velocity[1]*state.offset[1])/(limit*limit);if(outward>0)state.velocity=state.velocity.map((v,i)=>v-outward*state.offset[i]);}state.position=[anchor[0]+state.offset[0],anchor[1]-Math.sqrt(Math.max(.001,length*length-state.offset[0]**2-state.offset[1]**2)),anchor[2]+state.offset[1]];};
 return {state,drag(position,dt=1/60){const prior=[...state.offset];state.offset=[position[0]-anchor[0],position[2]-anchor[2]];place();state.velocity=state.offset.map((v,i)=>clamp((v-prior[i])/Math.max(.016,dt),-2,2));return state.position;},step(dt){let remaining=clamp(dt,0,.05);while(remaining>0){const step=Math.min(remaining,1/120);remaining-=step;for(let i=0;i<2;i++){state.velocity[i]+=(-9.81/length*state.offset[i]-1.8*state.velocity[i])*step;state.offset[i]+=state.velocity[i]*step;}place();}return Math.hypot(...state.offset,...state.velocity)>.002;},reset(){state.offset=[0,0];state.velocity=[0,0];place();}};
}

function woodTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
 const ctx=canvas.getContext('2d');
 let seed=19;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let row=0;row<8;row++){
  const y=row*64,tone=Math.round(random()*15);ctx.fillStyle=`rgb(${166+tone},${116+tone},${69+tone})`;ctx.fillRect(0,y,512,64);
  ctx.fillStyle='#76583b';ctx.fillRect(0,y,512,1.5);
  for(let k=0;k<52;k++){ctx.strokeStyle=`rgba(${random()>.5?'73,41,16':'235,195,133'},${.035+random()*.09})`;ctx.lineWidth=.3+random();const gy=y+random()*64;ctx.beginPath();ctx.moveTo(0,gy);ctx.bezierCurveTo(140,gy+(random()-.5)*5,360,gy+(random()-.5)*5,512,gy);ctx.stroke();}
  const end=(row%3)*170+40;ctx.fillStyle='rgba(72,47,24,.45)';ctx.fillRect(end,y,1,64);
 }
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(30,30);texture.anisotropy=4;return texture;
}

/** Shared by Studio, gallery and standalone exports. No workout decisions live here. */
export function createNativeGymEnvironment({scene,canvas,camera,controls,redraw}){
 const group=new THREE.Group();group.name='gym-environment';scene.add(group);
 const texture=woodTexture(),materials={wood:new THREE.MeshStandardMaterial({map:texture,roughness:.7}),frame:new THREE.MeshStandardMaterial({color:'#35454a',metalness:.65,roughness:.42}),shade:new THREE.MeshStandardMaterial({color:'#33514c',metalness:.45,roughness:.38,side:THREE.DoubleSide}),bulb:new THREE.MeshStandardMaterial({color:'#fff0ba',emissive:'#ffe4a1',emissiveIntensity:2.4}),cable:new THREE.MeshStandardMaterial({color:'#252b2c',roughness:.9})};
 const geometries=new Set(),meshes=[];
 const mesh=(geometry,material,parent=group)=>{geometries.add(geometry);const item=new THREE.Mesh(geometry,material);parent.add(item);meshes.push(item);return item;};
 const floor=mesh(new THREE.PlaneGeometry(60,60),materials.wood);floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;
 const beam=mesh(new THREE.BoxGeometry(1,.14,.24),materials.frame);beam.castShadow=true;
 const supports=[0,1].map(()=>{const item=mesh(new THREE.BoxGeometry(.1,1,.1),materials.frame);item.castShadow=true;return item;});
 const lamps=[0,1].map(index=>{
  const root=new THREE.Group();root.name=`pendant-${index}`;group.add(root);
  const shade=mesh(new THREE.ConeGeometry(.23,.17,24,1,true),materials.shade,root);shade.position.y=.07;shade.castShadow=true;
  const rim=mesh(new THREE.TorusGeometry(.23,.012,6,24),materials.frame,root);rim.rotation.x=Math.PI/2;rim.position.y=-.015;
  const bulb=mesh(new THREE.SphereGeometry(.05,12,8),materials.bulb,root);bulb.position.y=-.015;
  const cord=mesh(new THREE.CylinderGeometry(.008,.008,1,6),materials.cable);
  const light=new THREE.SpotLight('#ffe1a5',9,7,Math.PI*.32,.65,1.5);light.position.set(0,-.025,0);light.target.position.set(0,-2,0);root.add(light,light.target);
  // A slightly generous hit area makes the small shade usable on a phone.
  const hit=mesh(new THREE.SphereGeometry(.27,8,6),new THREE.MeshBasicMaterial({visible:false}),root);hit.name=`lamp-handle-${index}`;
  return {root,cord,light,hit,pendulum:null};
 });
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(),point=new THREE.Vector3(),direction=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
 let enabled=false,disposed=false,drag=null,raf=0,last=0,originalCursor=canvas.style.cursor;
 const sync=lamp=>{const state=lamp.pendulum.state;lamp.root.position.fromArray(state.position);direction.fromArray(state.position).sub(new THREE.Vector3(...state.anchor)).normalize();lamp.root.quaternion.setFromUnitVectors(new THREE.Vector3(0,-1,0),direction);lamp.cord.position.fromArray(state.anchor).add(lamp.root.position).multiplyScalar(.5);lamp.cord.quaternion.setFromUnitVectors(up,direction);lamp.cord.scale.y=state.length;};
 function animate(now){raf=0;if(disposed||!enabled)return;if(document.hidden){last=0;return;}const dt=last?Math.min(.05,(now-last)/1000):1/60;last=now;let moving=false;for(const lamp of lamps){if(drag?.lamp!==lamp)moving=lamp.pendulum.step(dt)||moving;sync(lamp);}redraw();if(moving||drag)raf=requestAnimationFrame(animate);else last=0;}
 const wake=()=>{if(!raf&&!disposed&&enabled)raf=requestAnimationFrame(animate);};
 function ray(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);}
 function down(event){if(!enabled||disposed||drag||event.button!==0)return;ray(event);group.updateMatrixWorld(true);const hit=raycaster.intersectObjects(lamps.map(l=>l.hit),false)[0];if(!hit)return;const lamp=lamps.find(l=>l.hit===hit.object);event.preventDefault();event.stopImmediatePropagation();camera.getWorldDirection(direction);plane.setFromNormalAndCoplanarPoint(direction,lamp.root.position);raycaster.ray.intersectPlane(plane,point);drag={lamp,id:event.pointerId,offset:lamp.root.position.clone().sub(point),last:performance.now(),controls:controls.enabled};controls.enabled=false;canvas.style.cursor='grabbing';canvas.setPointerCapture(event.pointerId);wake();}
 function move(event){if(!enabled||disposed)return;if(!drag){if(event.pointerType!=='touch'){ray(event);canvas.style.cursor=raycaster.intersectObjects(lamps.map(l=>l.hit),false).length?'grab':originalCursor;}return;}if(event.pointerId!==drag.id)return;event.preventDefault();event.stopImmediatePropagation();ray(event);if(raycaster.ray.intersectPlane(plane,point)){const now=performance.now();point.add(drag.offset);drag.lamp.pendulum.drag(point.toArray(),(now-drag.last)/1000);drag.last=now;sync(drag.lamp);redraw();}wake();}
 function release(event){if(!drag||event&&event.pointerId!==drag.id)return;if(event){event.preventDefault();event.stopImmediatePropagation();}const saved=drag;drag=null;controls.enabled=saved.controls;canvas.style.cursor=originalCursor;if(canvas.hasPointerCapture(saved.id))canvas.releasePointerCapture(saved.id);wake();}
 const visibility=()=>{if(!document.hidden)wake();};
 canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',release,true);canvas.addEventListener('pointercancel',release,true);canvas.addEventListener('lostpointercapture',release,true);document.addEventListener('visibilitychange',visibility);
 return {
  configure(project){release();enabled=project.kind==='workout3d';group.visible=enabled;if(!enabled){cancelAnimationFrame(raf);raf=0;return;}
   const ground=project.bench.position[1],positions=[project.pullup.position,project.bench.position],top=Math.max(ground+3.35,project.pullup.position[1]+1.1),a=new THREE.Vector3(positions[0][0],top,positions[0][2]),b=new THREE.Vector3(positions[1][0],top,positions[1][2]);
   floor.position.set(project.bench.position[0],ground-.004,project.bench.position[2]);beam.position.copy(a).add(b).multiplyScalar(.5);beam.scale.x=a.distanceTo(b)+.7;beam.quaternion.setFromUnitVectors(new THREE.Vector3(1,0,0),b.clone().sub(a).normalize());
   supports.forEach((post,i)=>{post.position.copy(i?b:a);post.position.y=top+.22;post.scale.y=.44;});
   lamps.forEach((lamp,i)=>{lamp.pendulum=createPendantState([positions[i][0],top,positions[i][2]],.65);sync(lamp);});
  },
  state(){return {enabled,dragging:drag?lamps.indexOf(drag.lamp):null,lamps:enabled?lamps.map(l=>({...structuredClone(l.pendulum.state),lightPosition:l.light.getWorldPosition(new THREE.Vector3()).toArray(),screen:l.root.position.clone().project(camera).toArray()})):[]};},
  moveLamp(index,position){if(!enabled||!lamps[index]||!Array.isArray(position)||position.length!==3||!position.every(Number.isFinite))return false;lamps[index].pendulum.drag(position);sync(lamps[index]);wake();return true;},
  dispose(){if(disposed)return;disposed=true;release();cancelAnimationFrame(raf);canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',release,true);canvas.removeEventListener('pointercancel',release,true);canvas.removeEventListener('lostpointercapture',release,true);document.removeEventListener('visibilitychange',visibility);canvas.style.cursor=originalCursor;scene.remove(group);for(const geometry of geometries)geometry.dispose();for(const material of Object.values(materials))material.dispose();for(const lamp of lamps)lamp.hit.material.dispose();texture.dispose();}
 };
}
