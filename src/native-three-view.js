import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {loadCharacter3D} from './gltf-character-3d.js';
import {createBenchAction3D} from './bench-action-3d.js';
import {createWorkout3D} from './workout-3d.js';
import {createNativeGymEnvironment} from './native-gym-environment.js';
import {benchBodyGeometry3D} from './bench-geometry-3d.js';
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
  const environment = new THREE.Group(), bench = new THREE.Group(), bar = new THREE.Group(), pullup = new THREE.Group(), bottle = new THREE.Group(), bottleStand = new THREE.Group();
  scene.add(environment,bench,bar,pullup,bottle,bottleStand);
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
  const benchBody=new Map(benchBodyGeometry3D().map(part=>{
    const mesh=box(bench,[1,1,1],part.position,materials[part.material]);mesh.name=`bench-${part.id}`;mesh.scale.fromArray(part.size);return [part.id,mesh];
  }));
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
  const pullupPosts=[-1,1].map(()=>box(pullup,[.075,1,.075],[0,0,0],materials.steel));
  const pullupFeet=[-1,1].map(()=>box(pullup,[.4,.06,.8],[0,0,0],materials.steel));
  const pullupBar=cylinder(pullup,.018,1,[0,0,0],materials.chrome);
  const bottleBody=cylinder(bottle,.043,.20,[0,-.015,0],materials.pad);bottleBody.rotation.z=0;
  const bottleCap=cylinder(bottle,.029,.04,[0,.105,0],materials.accent);bottleCap.rotation.z=0;
  const shelf=box(bottleStand,[.45,.035,.4],[0,0,0],materials.pad);
  const shelfLeg=box(bottleStand,[.07,1,.07],[0,0,0],materials.steel);
  let character, action, originalAction, project, frame, time=0, assetKey, disposed=false, generation=0, width=0, height=0;
  const gymEnvironment=createNativeGymEnvironment({scene,canvas,camera,controls,redraw:()=>{if(!disposed&&action)renderer.render(scene,camera);}});
  let workerClient,workerReady=false,workerPending=false,paintEpoch=0,workerError=null;
  try{workerClient=createNativeActionClient(new NativeActionWorker());}catch(error){workerError=error.message;}
  const performanceSamples=[],subscribers=new Set(),mirrorJournal=[];let lastEventSequence=0,eventEpoch=0,mirrorCursor=0,mirrorTime=0,pendingMirrorCommands=0;
  // The worker owns live decisions. This journal only catches the authoring
  // mirror up when a caller explicitly requests a synchronous pose.
  function mirrorAdvance(at){
    if(!Number.isFinite(at)||at<0)throw new TypeError('Native action sample time must be nonnegative and finite.');
    const start=at<mirrorTime?0:mirrorTime;
    if(Math.ceil((at-start)/60)>4096)throw new RangeError('Synchronous workout replay exceeds its time budget; reset or use worker playback.');
    if(at<mirrorTime){action.sample(0);mirrorTime=0;}
    while(at-mirrorTime>60){mirrorTime+=60;action.sample(mirrorTime);}
    const result=action.sample(at);mirrorTime=at;return result;
  }
  function remember(name,args,at,result){
    const values=structuredClone(args);
    if(name==='request')values[1]={...values[1],request:result};
    mirrorJournal.push({name,args:values,time:at});
  }
  const isWorkout=()=>project?.kind==='workout3d';
  function report(error){try{options.onError?.(error);}catch{}}
  function lifecycle(type,error){eventEpoch++;for(const fn of [...subscribers]){try{fn({type,...(error?{error:error.message||String(error)}:{})});}catch(cause){report(cause);}}}
  function publish(next){
    const epoch=eventEpoch,mine=generation;
    try{options.onFrame?.(next);}catch(error){report(error);}
    for(const event of next.workout?.events||[]){
      if(disposed||epoch!==eventEpoch||mine!==generation)return;
      if(!Number.isSafeInteger(event.sequence)||event.sequence<=lastEventSequence)continue;
      lastEventSequence=event.sequence;
      for(const fn of [...subscribers]){try{fn(structuredClone(event));}catch(error){report(error);}}
    }
  }
  function resize(){const rect=canvas.getBoundingClientRect();const w=Math.max(1,Math.round(rect.width||canvas.clientWidth||800)),h=Math.max(1,Math.round(rect.height||canvas.clientHeight||600));if(w!==width||h!==height){width=w;height=h;renderer.setSize(w,h,false);const span=project?.camera?.height||4;camera.top=span/2;camera.bottom=-span/2;camera.left=-span*w/h/2;camera.right=span*w/h/2;camera.updateProjectionMatrix();}}
  function cameraFromProject(){const c=project.camera;camera.position.fromArray(c.position);controls.target.fromArray(c.target);camera.zoom=1;camera.top=c.height/2;camera.bottom=-c.height/2;camera.left=-c.height*(width/height||1)/2;camera.right=-camera.left;camera.updateProjectionMatrix();controls.update();}
  async function setProject(next){
    if(disposed)throw new Error('This view has been disposed.');
    const mine=++generation;paintEpoch++;
    const {assetUrl:_asset,onFrame:_frame,onError:_error,...document}=next;
    const p=structuredClone(document),url=options.assetUrl||NATIVE_CHARACTER_ASSETS[p.character?.asset||'athlete'];
    const assetIdentity=`${url}|${p.character?.height||1.75}`;
    let loaded;
    if(assetIdentity!==assetKey){loaded=await loadCharacter3D(url,{height:p.character?.height||1.75});if(disposed||mine!==generation){loaded.dispose();return;} }
    const nextCharacter=loaded||character;
    let nextAction;
    try{const config={rig:nextCharacter.rig,roles:nextCharacter.roles,grips:nextCharacter.grips};nextAction=p.kind==='workout3d'?createWorkout3D({...config,project:p}):createBenchAction3D({...config,bench:p.bench,settings:p.settings});}catch(error){loaded?.dispose();throw error;}
    if(loaded){if(character){scene.remove(character.root);character.dispose();}character=loaded;assetKey=assetIdentity;scene.add(character.root);character.root.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;node.frustumCulled=false;}});}
    if(project)lifecycle('workout.changed');
    project=p;action=nextAction;originalAction=nextAction;lastEventSequence=0;mirrorJournal.length=0;mirrorCursor=0;mirrorTime=0;pendingMirrorCommands=0;if(isWorkout())time=0;
    if(workerClient){workerReady=false;try{await workerClient.configure({rig:character.rig,roles:character.roles,grips:character.grips,...(isWorkout()?{project:p}:{bench:p.bench,settings:p.settings})});if(mine!==generation||disposed)return;workerReady=true;}catch(error){if(error.name!=='AbortError'){workerError=error.message;workerClient.dispose();workerClient=null;}}}
    if(mine!==generation||disposed)return;
    bench.position.fromArray(p.bench.position);bench.quaternion.fromArray(p.bench.rotation);bench.scale.setScalar(p.bench.scale);
    for(const part of benchBodyGeometry3D(nextAction.bench?.size)){const mesh=benchBody.get(part.id);mesh.position.fromArray(part.position);mesh.scale.fromArray(part.size);}
    const rackHeight=p.bench.rackHeight??1;
    for(const post of rackPosts){post.scale.y=rackHeight;post.position.y=rackHeight/2;}
    for(const hook of rackHooks)hook.position.y=rackHeight-.018-.035/2;
    grid.position.x=p.bench.position[0];grid.position.z=p.bench.position[2];grid.position.y=p.bench.position[1]-.003;floor.position.y=p.bench.position[1]-.035;
    pullup.visible=bottle.visible=bottleStand.visible=isWorkout();
    gymEnvironment.configure(p);floor.visible=grid.visible=!isWorkout();
    renderer.toneMappingExposure=isWorkout()?1:1.15;ambient.intensity=isWorkout()?1.65:2.2;key.intensity=isWorkout()?1.8:3.1;fill.intensity=isWorkout()?.65:1.2;
    if(isWorkout()){
      pullup.position.fromArray(p.pullup.position);pullup.quaternion.fromArray(p.pullup.rotation);
      const standHeight=p.pullup.position[1]-p.bench.position[1];
      pullupBar.scale.y=p.pullup.width;
      pullupPosts.forEach((post,i)=>{const x=(i?1:-1)*p.pullup.width/2;post.position.set(x,-standHeight/2,0);post.scale.y=standHeight;pullupFeet[i].position.set(x,-standHeight+.03,0);});
      bottleStand.position.fromArray(p.bottle.position);bottleStand.quaternion.fromArray(p.bottle.rotation);
      shelf.position.y=-.12-.035/2;const shelfHeight=Math.max(.02,p.bottle.position[1]-.12-.035-p.bench.position[1]);shelfLeg.scale.y=shelfHeight;shelfLeg.position.y=-.12-.035-shelfHeight/2;
    }
    keyLightAt(p.bench.position);
    resize();cameraFromProject();render(Math.min(time,action.duration));
  }
  function keyLightAt(position){key.target.position.fromArray(position);key.position.set(position[0]-3,position[1]+7,position[2]+5);}
  function sample(at){
    if(!action)return null;if(!isWorkout())return action.sample(at);
    if(pendingMirrorCommands)throw new Error('Await the pending workout command before requesting a synchronous pose.');
    while(mirrorCursor<mirrorJournal.length&&mirrorJournal[mirrorCursor].time<=at){
      const entry=mirrorJournal[mirrorCursor];mirrorAdvance(entry.time);action[entry.name](...entry.args);mirrorCursor++;
    }
    return mirrorAdvance(at);
  }
  function drawFrame(next){
    if(disposed||!action)return null;
    const start=performance.now();frame=next;
    character.apply(frame.pose,frame.placement);
    character.applyFace?.(frame.face);
    if(frame.bar){bar.position.fromArray(frame.bar.position);bar.quaternion.fromArray(frame.bar.rotation);bar.scale.setScalar(frame.bar.scale??1);bar.visible=frame.bar.visible!==false;}
    if(isWorkout()&&frame.bottle){bottle.position.fromArray(frame.bottle.position);bottle.quaternion.fromArray(frame.bottle.rotation);bottle.visible=frame.bottle.visible!==false;}
    resize();renderer.render(scene,camera);
    performanceSamples.push(performance.now()-start);if(performanceSamples.length>180)performanceSamples.shift();
    publish(frame);return frame;
  }
  function render(at=time){if(disposed||!action)return null;paintEpoch++;time=Math.max(0,Math.min(action.duration,Number(at)||0));return drawFrame(sample(time));}
  function renderAsync(at=time){
    if(disposed||!action)return null;
    if(!workerClient)return render(at);
    if(!workerReady)return frame;
    if(workerPending)return frame;
    const current=paintEpoch,mine=generation;time=Math.max(0,Math.min(action.duration,Number(at)||0));workerPending=true;
    workerClient.sample(time).then(next=>{if(!disposed&&mine===generation&&current===paintEpoch)drawFrame(next);}).catch(error=>{if(error.name!=='AbortError'&&!disposed){workerError=error.message;workerReady=false;lifecycle('workout.changed',error);report(error);workerClient?.dispose();workerClient=null;}}).finally(()=>{workerPending=false;});
    return frame;
  }
  async function workerCommand(name,...args){
    paintEpoch++;workerReady=false;if(!workerClient)return;
    const mine=generation;
    try{const result=await workerClient[name](...args);if(disposed||mine!==generation)throw Object.assign(new Error('Native project changed.'),{name:'AbortError'});workerReady=true;return result;}
    catch(error){if(error.name!=='AbortError'&&!disposed){workerError=error.message;lifecycle('workout.changed',error);report(error);}throw error;}
  }
  function workoutCommand(name,args){
    if(disposed)return Promise.reject(new Error('This view has been disposed.'));
    if(!isWorkout())return Promise.reject(new Error('This command requires a native workout.'));
    try{
      const at=time,mine=generation,values=structuredClone(args);
      if(workerClient){pendingMirrorCommands++;return workerCommand(name,...values,at).then(result=>{if(disposed||mine!==generation)throw Object.assign(new Error('Native project changed.'),{name:'AbortError'});remember(name,values,at,result);return result;}).finally(()=>{if(mine===generation)pendingMirrorCommands--;});}
      if(mirrorJournal.at(-1)?.time>at)throw new Error('Cannot edit past workout history; sample the latest recorded time or reset.');
      sample(at);const result=action[name](...values);remember(name,values,at,result);mirrorCursor=mirrorJournal.length;return Promise.resolve(result);
    }catch(error){return Promise.reject(error);}
  }
  controls.addEventListener('change',()=>{if(action&&!disposed)renderer.render(scene,camera);});
  const observer=new ResizeObserver(()=>{if(action&&!disposed){resize();renderer.render(scene,camera);}});observer.observe(canvas);
  const view={setProject,sample,render,renderAsync,get duration(){return action?.duration||0;},get character(){return character;},get action(){return action;},get frame(){return frame;},get canvas(){return canvas;},
    finishSafely(at=time){
      if(disposed||!Number.isFinite(at)||at<0)return false;
      if(isWorkout()){
        time=at;
        if(workerClient){const mine=generation;pendingMirrorCommands++;workerCommand('finishSafely',at).then(result=>{if(!disposed&&mine===generation&&result?.supported)remember('interrupt',[at],at);}).catch(()=>{}).finally(()=>{if(mine===generation)pendingMirrorCommands--;});return true;}
        sample(at);const recovery=action.interrupt(at);if(recovery.supported){remember('interrupt',[at],at);mirrorCursor=mirrorJournal.length;render(at);}return !!recovery.supported;
      }
      const recovery=action?.interrupt?.(at);if(!recovery?.supported)return false;workerCommand('finishSafely',at).catch(()=>{});action=recovery;time=0;render(0);return true;
    },
    resetMovement(){
      if(disposed)throw new Error('This view has been disposed.');
      lifecycle('workout.reset');time=0;
      if(isWorkout())return setProject(project).then(()=>frame);
      workerCommand('reset').catch(()=>{});action=originalAction;lastEventSequence=0;return render(0);
    },
    setVariable(name,value){return workoutCommand('setVariable',[name,value]);},
    request(name,requestOptions={}){return workoutCommand('request',[name,requestOptions]);},
    cancel(request){return workoutCommand('cancel',[request]);},
    describe(){return action?.describe?.()??null;},
    subscribe(fn){if(typeof fn!=='function')throw new TypeError('An event callback is required.');if(disposed)throw new Error('This view has been disposed.');subscribers.add(fn);return ()=>subscribers.delete(fn);},
    environmentState(){return gymEnvironment.state();},
    moveLamp(index,position){return gymEnvironment.moveLamp(index,position);},
    cameraState(){return {position:camera.position.toArray(),target:controls.target.toArray(),height:(camera.top-camera.bottom)/camera.zoom};},
    stats(){const sorted=[...performanceSamples].sort((a,b)=>a-b);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,cpuMedianMs:sorted[Math.floor(sorted.length*.5)]||0,cpuP95Ms:sorted[Math.floor(sorted.length*.95)]||0,motionWorker:workerReady,workerError};},
    exportHTML(p=project){return exportNativeBenchHTML(p);},
    dispose(){if(disposed)return;disposed=true;generation++;lifecycle('workout.disposed');subscribers.clear();workerClient?.dispose();observer.disconnect();gymEnvironment.dispose();controls.dispose();character?.dispose();scene.traverse(node=>{if(node.isMesh&&!character?.root?.getObjectById(node.id))node.geometry.dispose();});for(const material of Object.values(materials))material.dispose();grid.geometry.dispose();grid.material.dispose();renderer.dispose();},
  };
  try{await setProject(options);return view;}catch(error){view.dispose();throw error;}
}
