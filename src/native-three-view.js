import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadCharacter3D} from './gltf-character-3d.js';
import {createBenchAction3D} from './bench-action-3d.js';
import {exportNativeBenchHTML} from './native-three-export.js';
import NativeActionWorker from './native-action-worker.js?worker&inline';
import {createNativeActionClient} from './native-action-worker-client.js';

export const NATIVE_CHARACTER_ASSETS = Object.freeze({
  athlete: './assets/native-3d/athlete.glb',
  regular: './assets/native-3d/regular.glb',
});

/** Display the solved world. This module never adjusts joints or infers depth. */
export async function createNativeThreeView(canvas, options = {}) {
  const renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:false, powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 1.5));
  renderer.setClearColor('#e8eceb');
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#e8eceb', 12, 26);
  const camera = new THREE.OrthographicCamera(-3,3,2,-2,.02,60);
  const controls = new OrbitControls(camera,canvas);
  controls.enableDamping = false;
  controls.minDistance = .5;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI * .49;
  controls.enablePan = true;
  const ambient = new THREE.HemisphereLight('#e4f3ff','#667965',2.2);
  const key = new THREE.DirectionalLight('#fff0dc',3.1);
  key.position.set(-3,7,5); key.castShadow = true;
  key.shadow.mapSize.set(1024,1024);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:20});
  key.shadow.normalBias = .018; key.shadow.bias = -.00015;
  const fill = new THREE.DirectionalLight('#d9e7ff',1.2); fill.position.set(4,3,-5);
  scene.add(ambient,key,fill,key.target);
  const environment = new THREE.Group(), bench = new THREE.Group(), bar = new THREE.Group();
  scene.add(environment,bench,bar);
  const materials = {
    floor:new THREE.MeshStandardMaterial({color:'#d8deda',roughness:1}),
    steel:new THREE.MeshStandardMaterial({color:'#2d454c',roughness:.5,metalness:.55}),
    pad:new THREE.MeshStandardMaterial({color:'#385c60',roughness:.78}),
    chrome:new THREE.MeshStandardMaterial({color:'#d7e2e2',roughness:.22,metalness:.8}),
    weight:new THREE.MeshStandardMaterial({color:'#293d48',roughness:.65,metalness:.25}),
    accent:new THREE.MeshStandardMaterial({color:'#dfab64',roughness:.5,metalness:.1}),
  };
  const box=(group,size,pos,material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const cylinder=(group,radius,length,pos,material)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,32),material);mesh.rotation.z=Math.PI/2;mesh.position.set(...pos);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const floor=box(environment,[100,.06,100],[0,-.035,0],materials.floor);floor.castShadow=false;
  const grid=new THREE.GridHelper(12,24,'#bdc9c5','#cad3cf');grid.position.y=-.003;grid.material.transparent=true;grid.material.opacity=.36;environment.add(grid);
  box(bench,[.62,.12,1.9],[0,.42,0],materials.pad);
  box(bench,[.13,.09,1.6],[0,.26,0],materials.steel);
  for(const z of [-.64,.64]){box(bench,[.12,.3,.12],[0,.15,z],materials.steel);box(bench,[.9,.06,.27],[0,.03,z],materials.steel);}
  const rackPosts=[],rackHooks=[];
  for(const x of [-.68,.68]){
    rackPosts.push(box(bench,[.085,1,.085],[x,.5,-.58],materials.steel));
    box(bench,[.3,.06,.5],[x,.03,-.58],materials.steel);
    rackHooks.push(box(bench,[.085,.035,.16],[x,.965,-.51],materials.chrome));
  }
  cylinder(bar,.018,1.85,[0,0,0],materials.chrome);
  for(const side of [-1,1]){
    cylinder(bar,.205,.07,[side*.79,0,0],materials.weight);
    cylinder(bar,.175,.055,[side*.86,0,0],materials.weight);
    cylinder(bar,.044,.03,[side*.91,0,0],materials.accent);
  }
  let character, action, originalAction, project, frame, time=0, assetKey, disposed=false, generation=0, width=0, height=0;
  let workerClient,workerReady=false,workerPending=false,paintEpoch=0,workerError=null;
  try{workerClient=createNativeActionClient(new NativeActionWorker());}catch(error){workerError=error.message;}
  const performanceSamples=[];
  function resize(){const rect=canvas.getBoundingClientRect();const w=Math.max(1,Math.round(rect.width||canvas.clientWidth||800)),h=Math.max(1,Math.round(rect.height||canvas.clientHeight||600));if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);const span=project?.camera?.height||4;camera.top=span/2;camera.bottom=-span/2;camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.updateProjectionMatrix();}}
  function cameraFromProject(){const c=project.camera;camera.position.fromArray(c.position);controls.target.fromArray(c.target);camera.zoom=1;camera.top=c.height/2;camera.bottom=-c.height/2;camera.left=-c.height*(width/height||1)/2;camera.right=-camera.left;camera.updateProjectionMatrix();controls.update();}
  async function setProject(next){
    if(disposed)throw new Error('This view has been disposed.');
    const mine=++generation;paintEpoch++;
    const p=structuredClone(next),url=options.assetUrl||NATIVE_CHARACTER_ASSETS[p.character?.asset||'athlete'];
    const key=`${url}|${p.character?.height||1.75}`;
    let loaded;
    if(key!==assetKey){loaded=await loadCharacter3D(url,{height:p.character?.height||1.75});if(disposed||mine!==generation){loaded.dispose();return;} }
    const nextCharacter=loaded||character;
    let nextAction;
    try{nextAction=createBenchAction3D({rig:nextCharacter.rig,roles:nextCharacter.roles,grips:nextCharacter.grips,bench:p.bench,settings:p.settings});}catch(error){loaded?.dispose();throw error;}
    if(loaded){if(character){scene.remove(character.root);character.dispose();}character=loaded;assetKey=key;scene.add(character.root);character.root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});}
    project=p;action=nextAction;originalAction=nextAction;
    if(workerClient){workerReady=false;try{await workerClient.configure({rig:character.rig,roles:character.roles,grips:character.grips,bench:p.bench,settings:p.settings});if(mine!==generation||disposed)return;workerReady=true;}catch(error){if(error.name!=='AbortError'){workerError=error.message;workerClient.dispose();workerClient=null;}}}
    if(mine!==generation||disposed)return;
    bench.position.fromArray(p.bench.position);bench.quaternion.fromArray(p.bench.rotation);bench.scale.setScalar(p.bench.scale);
    const rackHeight=p.bench.rackHeight??1;
    for(const post of rackPosts){post.scale.y=rackHeight;post.position.y=rackHeight/2;}
    for(const hook of rackHooks)hook.position.y=rackHeight-.018-.035/2;
    grid.position.x=p.bench.position[0];grid.position.z=p.bench.position[2];grid.position.y=p.bench.position[1]-.003;floor.position.y=p.bench.position[1]-.035;
    keyLightAt(p.bench.position);
    resize();cameraFromProject();render(Math.min(time,action.duration));
  }
  function keyLightAt(position){key.target.position.fromArray(position);key.position.set(position[0]-3,position[1]+7,position[2]+5);}
  function sample(at){if(!action)return null;return action.sample(at);}
  function drawFrame(next){
    if(disposed||!action)return null;
    const start=performance.now();frame=next;
    character.apply(frame.pose,frame.placement);
    if(frame.bar){bar.position.fromArray(frame.bar.position);bar.quaternion.fromArray(frame.bar.rotation);bar.scale.setScalar(frame.bar.scale??1);bar.visible=frame.bar.visible!==false;}
    resize();renderer.render(scene,camera);
    performanceSamples.push(performance.now()-start);if(performanceSamples.length>180)performanceSamples.shift();
    return frame;
  }
  function render(at=time){if(disposed||!action)return null;paintEpoch++;time=Math.max(0,Math.min(action.duration,Number(at)||0));return drawFrame(sample(time));}
  function renderAsync(at=time){
    if(disposed||!action)return null;
    if(!workerReady||!workerClient)return render(at);
    if(workerPending)return frame;
    const current=paintEpoch,mine=generation;time=Math.max(0,Math.min(action.duration,Number(at)||0));workerPending=true;
    workerClient.sample(time).then(next=>{if(!disposed&&mine===generation&&current===paintEpoch)drawFrame(next);}).catch(error=>{if(error.name!=='AbortError'&&!disposed){workerError=error.message;workerReady=false;}}).finally(()=>{workerPending=false;});
    return frame;
  }
  function workerCommand(name,...args){paintEpoch++;workerReady=false;if(workerClient){const mine=generation;workerClient[name](...args).then(()=>{if(!disposed&&mine===generation)workerReady=true;}).catch(error=>{if(error.name!=='AbortError'&&!disposed)workerError=error.message;});}}
  controls.addEventListener('change',()=>{if(action&&!disposed)renderer.render(scene,camera);});
  const observer=new ResizeObserver(()=>{if(action)render();});observer.observe(canvas);
  const view={setProject,sample,render,renderAsync,get duration(){return action?.duration||0;},get character(){return character;},get action(){return action;},get frame(){return frame;},get canvas(){return canvas;},
    finishSafely(at=time){const recovery=action?.interrupt?.(at);if(!recovery?.supported)return false;workerCommand('finishSafely',at);action=recovery;time=0;render(0);return true;},
    resetMovement(){workerCommand('reset');action=originalAction;time=0;return render(0);},
    cameraState(){return {position:camera.position.toArray(),target:controls.target.toArray(),height:(camera.top-camera.bottom)/camera.zoom};},
    stats(){const sorted=[...performanceSamples].sort((a,b)=>a-b);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,cpuMedianMs:sorted[Math.floor(sorted.length*.5)]||0,cpuP95Ms:sorted[Math.floor(sorted.length*.95)]||0,motionWorker:workerReady,workerError};},
    exportHTML(p=project){return exportNativeBenchHTML(p);},
    dispose(){if(disposed)return;disposed=true;generation++;workerClient?.dispose();observer.disconnect();controls.dispose();character?.dispose();scene.traverse(node=>{if(node.isMesh&&!character?.root?.getObjectById(node.id))node.geometry.dispose();});for(const material of Object.values(materials))material.dispose();grid.geometry.dispose();grid.material.dispose();renderer.dispose();},
  };
  try{await setProject(options);return view;}catch(error){view.dispose();throw error;}
}
