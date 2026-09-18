import * as THREE from 'three';
import {createThreeAtlas} from './three-atlas.js';
import {createThreeGymRoom} from '../examples/gym-three-room.js';

/** Optional Gym pilot. Import explicitly; the SVG/Canvas runtimes do not load Three.js. */
export function mountThreeGym(element, document, frame, {pixelRatio=1.5,onError=()=>{}}={}) {
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});
 renderer.setClearColor('#e5e9df');renderer.setPixelRatio(Math.min(devicePixelRatio||1,pixelRatio));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 const scene=new THREE.Scene(),world=new THREE.Group();world.scale.y=-1;scene.add(world);
 const camera=new THREE.OrthographicCamera(0,800,0,-450,.1,3000);camera.position.set(0,0,1000);
 scene.add(new THREE.HemisphereLight('#fff2dc','#647a83',2));
 const light=new THREE.DirectionalLight('#fff4e5',2.2);light.position.set(-250,350,550);scene.add(light);
 const atlas=createThreeAtlas(document.packs.atlas),room=createThreeGymRoom(document);world.add(room.object,atlas.object);
 const actor=document.actors.find(a=>a.id==='atlas'),transform=actor.transform;
 atlas.object.position.set(transform.x,transform.y,0);atlas.object.rotation.z=transform.rotation*Math.PI/180;atlas.object.scale.setScalar(transform.scale);
 renderer.domElement.setAttribute('aria-label','Atlas rendered as a three-dimensional character');renderer.domElement.setAttribute('role','img');
 element.replaceChildren(renderer.domElement);let disposed=false,last=frame,focus=false;
 const lost=e=>{e.preventDefault();onError(new Error('The 3D graphics context was lost. Reload this page to restore it.'));};renderer.domElement.addEventListener('webglcontextlost',lost);
 const resize=()=>{if(disposed)return;const width=Math.max(1,element.clientWidth);renderer.setSize(width,width*450/800,false);if(last)update(last);};
 const observer=new ResizeObserver(resize);observer.observe(element);
 function update(next){if(disposed)return;last=next;const evaluated=next.actors.find(a=>a.id==='atlas');if(evaluated){atlas.update(evaluated.pose);atlas.object.position.set(transform.x+(evaluated.spring?.x||0),transform.y+(evaluated.spring?.y||0),0);if(focus){const x=Math.max(400/1.65,Math.min(800-400/1.65,evaluated.pose['root.x']||0)),y=Math.max(225/1.65,Math.min(450-225/1.65,(evaluated.pose['root.y']||0)-30));camera.position.set(x-400,225-y,1000);}}room.update(next);renderer.render(scene,camera);}
 resize();
 return {update,setFocus(value){focus=value;camera.zoom=focus?1.65:1;if(!focus)camera.position.set(0,0,1000);camera.updateProjectionMatrix();if(last)update(last);},setPixelRatio(value){renderer.setPixelRatio(Math.min(devicePixelRatio||1,value));resize();},stats(){return {...atlas.stats,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},dispose(){if(disposed)return;disposed=true;observer.disconnect();renderer.domElement.removeEventListener('webglcontextlost',lost);atlas.dispose();room.dispose();renderer.dispose();renderer.forceContextLoss();element.replaceChildren();}};
}
