// Bake an authored glTF's animation clips into reusable directional atlases.
// Run against `npm run dev -- --port 5246`; only this build tool uses WebGL.
import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:600,height:600}});
 await page.goto(base);
 const result=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js');
  const {GLTFLoader}=await import('/node_modules/three/examples/jsm/loaders/GLTFLoader.js');
  const gltf=await new GLTFLoader().loadAsync('/assets/map/characters/adventurer.gltf');
  const scene=new T.Scene(),model=gltf.scene,root=new T.Group();scene.add(root);root.add(model);
  const bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),scale=1.8/size.y;
  model.scale.multiplyScalar(scale);model.position.y=-bounds.min.y*scale;
  scene.add(new T.HemisphereLight(0xe3deca,0x33372a,2.1));
  const key=new T.DirectionalLight(0xffe2ae,3.2);key.position.set(-3,6,4);scene.add(key);
  const fill=new T.DirectionalLight(0xb5c2c9,.6);fill.position.set(4,2,-3);scene.add(fill);
  const camera=new T.OrthographicCamera(-.945454545,.945454545,1.3,-1.3,.1,40);camera.position.set(4,3.266,4).add(new T.Vector3(0,.9,0));camera.lookAt(0,.9,0);
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(128,176);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;
  renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  const mixer=new T.AnimationMixer(model),files=[],animatedRoot=model.getObjectByName('Root');
  const rootPosition=animatedRoot.position.clone();
  camera.updateMatrixWorld(true);const ground=new T.Vector3(0,0,0).project(camera),anchorY=(1-ground.y)/2;
  const vaultTimes=[0,.03,.07,.11,.15,.19,.23,.27,.3,.24,.18,.12,.06,0];
  const reachTimes=[.12,.2,.32,.45,.54,.59,.62,.64,.62,.56,.45,.32,.2,.12];
  const reachWeights=[.2,.45,.75,1,1,1,1,1,1,1,.8,.55,.3,.15];
  const climbTimes=[0,.08,.17,.27,.38,.5,.62,.73,.82,.9,.97,0];
  const climbReach=[.12,.24,.36,.48,.58,.64,.66,.62,.52,.4,.25,0];
  const jobs=[
   {name:'idle',clipName:'Idle_Neutral',frames:1},
   {name:'walk',clipName:'Walk',frames:12},
   {name:'run',clipName:'Run',frames:12},
   // A compact crouch/tuck/landing sequence sampled from the authored roll. It reads as a hop
   // while airborne without leaking the roll's root translation into map-owned movement.
   {name:'jump',clipName:'Roll',frames:8,times:[0,.035,.07,.11,.11,.07,.035,0]},
   {name:'roll',clipName:'Roll',frames:16},
   // Roll supplies the slow crouch and tuck while Interact holds a reaching support arm.
   {name:'vault',clipName:'Roll',frames:14,times:vaultTimes,blendClipName:'Interact',blendTimes:reachTimes,blendWeights:reachWeights,blendMask:'leftArm',frameWidth:96,frameHeight:132,supportJoint:'WristL',supportWindow:[.2,.62]},
   {name:'climbUp',clipName:'Kick_Left',frames:12,times:climbTimes,blendClipName:'Interact',blendTimes:climbReach,blendWeights:climbReach.map(()=>1),blendMask:'arms',frameWidth:96,frameHeight:132}
  ];
  for(const {name,clipName,frames,times,blendClipName,blendTimes,blendWeights,blendMask,frameWidth=128,frameHeight=176,supportJoint,supportWindow} of jobs){
   const clip=gltf.animations.find(c=>c.name===clipName);if(!clip)throw Error('Missing '+clipName);
   const blendSource=blendClipName&&gltf.animations.find(c=>c.name===blendClipName);if(blendClipName&&!blendSource)throw Error('Missing '+blendClipName);
   const masked=track=>blendMask==='leftArm'?/^(ShoulderL|UpperArmL|LowerArmL|WristL)\./.test(track.name):blendMask==='arms'?/^(Shoulder|UpperArm|LowerArm|Wrist)[LR]\./.test(track.name):true;
   const blendClip=blendSource&&(blendMask?new T.AnimationClip(blendSource.name+'-'+blendMask,blendSource.duration,blendSource.tracks.filter(masked)):blendSource);
   mixer.stopAllAction();const action=mixer.clipAction(clip);action.reset().play();
   const blendAction=blendClip&&mixer.clipAction(blendClip);blendAction?.reset().play();
   renderer.setSize(frameWidth,frameHeight);const supportAnchors=supportJoint?Array.from({length:16},()=>new Array(frames)):null;
   const atlas=document.createElement('canvas');atlas.width=frameWidth*frames;atlas.height=frameHeight*16;const ctx=atlas.getContext('2d');
   for(let d=0;d<16;d++)for(let frame=0;frame<frames;frame++){
    root.rotation.y=Math.PI/2-d*Math.PI*2/16;
    action.weight=blendAction&&!blendMask?1-(blendWeights?.[frame]??.5):1;mixer.setTime(times?clip.duration*times[frame]:clip.duration*frame/frames);
    if(blendAction){blendAction.weight=blendWeights?.[frame]??.5;blendAction.time=blendClip.duration*(blendTimes?.[frame]??frame/frames);mixer.update(0);}
    // Authored clips may translate the armature. The map controller owns all world displacement.
    animatedRoot.position.x=rootPosition.x;animatedRoot.position.z=rootPosition.z;
    scene.updateMatrixWorld(true);renderer.render(scene,camera);
    if(supportAnchors){const p=new T.Vector3();model.getObjectByName(supportJoint).getWorldPosition(p);p.project(camera);supportAnchors[d][frame]={x:(p.x+1)*frameWidth/2,y:(1-p.y)*frameHeight/2};}
    ctx.drawImage(renderer.domElement,frame*frameWidth,d*frameHeight);
   }
   files.push({name,sourceClip:blendClipName?[clipName,blendClipName]:clipName,frames,directions:16,frameWidth,frameHeight,duration:clip.duration,anchorY,rootMotion:'map-owned',...(times?{sampleTimes:times}:{}),...(supportAnchors?{supportAnchors,supportWindow}:{}),png:atlas.toDataURL('image/png').split(',')[1]});
  }
  renderer.dispose();return files;
 });
 await mkdir('public/assets/map/characters',{recursive:true});
 for(const file of result){const {png,...meta}=file;await writeFile(`public/assets/map/characters/adventurer-${file.name}.png`,Buffer.from(png,'base64'));console.log(meta);}
 await writeFile('public/assets/map/characters/animation.json',JSON.stringify(result.map(({png,...meta})=>meta),null,2));
 const vault=result.find(file=>file.name==='vault');
 await writeFile('examples/adventurer-crossing-anchors.js',`// Generated by tools/bake-map-character.mjs.\nexport const vaultSupportAnchors=${JSON.stringify(vault.supportAnchors)};\n`);
}finally{await browser.close();}
