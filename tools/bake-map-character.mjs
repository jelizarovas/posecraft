// Bake an authored glTF's animation clips into reusable directional atlases.
// Run against `npm run dev -- --port 5246`; only this build tool uses WebGL.
import {chromium} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const requested=process.argv.slice(2);
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:600,height:600}});
 await page.route('**/bake-adventurer.html',route=>route.fulfill({contentType:'text/html',body:'<!doctype html>'}));
 await page.goto(new URL('/bake-adventurer.html',base).href);
 const result=await page.evaluate(async requested=>{
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
  const {traversalPoser}=await import('/tools/adventurer-traversal-poses.mjs');
  const neutral=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle_Neutral'));
  neutral.play();mixer.setTime(0);
  const pose=traversalPoser(T,model);
  mixer.stopAllAction();
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
   {name:'climbUp',clipName:'Kick_Left',frames:12,times:climbTimes,blendClipName:'Interact',blendTimes:climbReach,blendWeights:climbReach.map(()=>1),blendMask:'arms',frameWidth:96,frameHeight:132},
   {name:'vault',pose:true,frames:14,duration:.72,frameWidth:96,frameHeight:132,supportJoints:['WristL'],supportWindow:[.2,.62]},
   {name:'hang',pose:true,frames:6,duration:1.2,frameWidth:96,frameHeight:132,supportJoints:['WristL','WristR'],supportWindow:[0,1],loop:true},
   {name:'climbLedge',pose:true,frames:12,duration:1,frameWidth:96,frameHeight:132,supportJoints:['WristL','WristR'],supportWindow:[0,8/11],loop:false}
  ];
  for(const name of requested)if(!jobs.some(job=>job.name===name))throw Error('Unknown clip '+name);
  for(const job of jobs){
   const {name,clipName,frames,times,blendClipName,blendTimes,blendWeights,blendMask,frameWidth=128,frameHeight=176,supportJoints,supportWindow}=job;
   if(requested.length&&!requested.includes(name))continue;
   const clip=gltf.animations.find(c=>c.name===clipName);if(!job.pose&&!clip)throw Error('Missing '+clipName);
   const blendSource=blendClipName&&gltf.animations.find(c=>c.name===blendClipName);if(blendClipName&&!blendSource)throw Error('Missing '+blendClipName);
   const masked=track=>blendMask==='arms'?/^(Shoulder|UpperArm|LowerArm|Wrist)[LR]\./.test(track.name):true;
   const blendClip=blendSource&&(blendMask?new T.AnimationClip(blendSource.name+'-'+blendMask,blendSource.duration,blendSource.tracks.filter(masked)):blendSource);
   mixer.stopAllAction();const action=clip&&mixer.clipAction(clip);action?.reset().play();
   const blendAction=blendClip&&mixer.clipAction(blendClip);blendAction?.reset().play();
   renderer.setSize(frameWidth,frameHeight);const supportAnchors=supportJoints?Array.from({length:16},()=>new Array(frames)):null;
   const atlas=document.createElement('canvas');atlas.width=frameWidth*frames;atlas.height=frameHeight*16;const ctx=atlas.getContext('2d');
   // Legacy mixer jobs retain direction-major sampling. Posed jobs have one
   // skeleton evaluation per frame, followed by the sixteen camera headings.
   const renderCell=(d,frame)=>{
    root.rotation.y=Math.PI/2-d*Math.PI*2/16;
    scene.updateMatrixWorld(true);renderer.render(scene,camera);
    if(supportAnchors){
      const p=new T.Vector3();
      for(const joint of supportJoints)p.add(model.getObjectByName(joint).getWorldPosition(new T.Vector3()));
      p.divideScalar(supportJoints.length).project(camera);
      supportAnchors[d][frame]={x:(p.x+1)*frameWidth/2,y:(1-p.y)*frameHeight/2};
    }
    ctx.drawImage(renderer.domElement,frame*frameWidth,d*frameHeight);
   };
   if(job.pose){
    for(let frame=0;frame<frames;frame++){
     root.rotation.y=0;pose(name,frame);
     for(let d=0;d<16;d++)renderCell(d,frame);
    }
   }else{
    for(let d=0;d<16;d++)for(let frame=0;frame<frames;frame++){
     action.weight=blendAction&&!blendMask?1-(blendWeights?.[frame]??.5):1;mixer.setTime(times?clip.duration*times[frame]:clip.duration*frame/frames);
     if(blendAction){blendAction.weight=blendWeights?.[frame]??.5;blendAction.time=blendClip.duration*(blendTimes?.[frame]??frame/frames);mixer.update(0);}
     animatedRoot.position.x=rootPosition.x;animatedRoot.position.z=rootPosition.z;
     renderCell(d,frame);
    }
   }
   files.push({name,sourceClip:job.pose?'Idle_Neutral':blendClipName?[clipName,blendClipName]:clipName,frames,directions:16,frameWidth,frameHeight,duration:job.duration??clip.duration,anchorY,rootMotion:'map-owned',
    ...(job.pose?{poseSource:'tools/adventurer-traversal-poses.mjs',anchorX:.5,displayWidth:60,displayHeight:82.5,loop:job.loop??false,supportJoints}:{}),
    ...(times?{sampleTimes:times}:{}),...(supportAnchors?{supportAnchors,supportWindow}:{}),png:atlas.toDataURL('image/png').split(',')[1]});
  }
  renderer.dispose();return files;
 },requested);
 const dir='public/assets/map/characters';
 await mkdir(dir,{recursive:true});
 const manifestPath=dir+'/animation.json';
 const manifest=requested.length?JSON.parse(await readFile(manifestPath,'utf8')):[];
 for(const {png,...meta} of result){
  const path=dir+'/adventurer-'+meta.name;
  await writeFile(path+'.png',Buffer.from(png,'base64'));
  execFileSync('python',['-c','from PIL import Image; import sys; Image.open(sys.argv[1]+".png").save(sys.argv[1]+".webp",quality=92)',path]);
  const index=manifest.findIndex(entry=>entry.name===meta.name);
  if(index<0)manifest.push(meta);else manifest[index]=meta;
  console.log(meta.name,meta.frames+' frames x '+meta.directions+' headings');
 }
 await writeFile(manifestPath,JSON.stringify(manifest,null,2));
 async function anchors(path,name,data){
  await writeFile(path,`// Generated by tools/bake-map-character.mjs. Cell pixels, indexed by direction and frame.\nexport const ${name}=${JSON.stringify(data)};\n`);
 }
 if(result.some(file=>file.name==='vault'))
  await anchors('examples/adventurer-crossing-anchors.js','vaultSupportAnchors',manifest.find(file=>file.name==='vault').supportAnchors);
 if(result.some(file=>['hang','climbLedge'].includes(file.name))){
  const ledge=Object.fromEntries(manifest.filter(file=>['hang','climbLedge'].includes(file.name)).map(file=>[file.name,file.supportAnchors]));
  await anchors('examples/adventurer-ledge-anchors.js','ledgeHandAnchors',ledge);
 }
}finally{await browser.close();}
