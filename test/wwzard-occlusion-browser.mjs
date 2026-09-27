import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

const server=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:5193,strictPort:true,hmr:false},appType:'mpa'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage();await page.goto((process.env.POSECRAFT_URL||'http://127.0.0.1:5193')+'/wwzard.html',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.posecraft);
 const result=await page.evaluate(async()=>{
  const [{createWwzardIllustration},{IllustrationController},{evaluateDrawing},{renderCanvas},{renderSVG},{BehaviorRuntime},{ScenePointerInteraction}]=await Promise.all([import('/examples/wwzard-illustration.js'),import('/src/illustration.js'),import('/src/render-evaluation.js'),import('/src/canvas.js'),import('/src/svg.js'),import('/src/behaviors.js'),import('/src/pointer-interactions.js')]);
  const providers={behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction};
  const scene=createWwzardIllustration(),withoutBody=structuredClone(scene);
  for(const part of withoutBody.packs.wwzard.parts)if(['robe-body','robe-front-fold'].includes(part.id)){part.fill='none';delete part.gradient;}
  const withoutArms=structuredClone(scene);
  for(const part of withoutArms.packs.wwzard.parts)if(['leftArm','rightArm','leftHand','rightHand'].includes(part.joint)&&part.id!=='left-grip-fingers'){part.fill='none';delete part.gradient;}
  const player=new IllustrationController(scene,providers);
  const canvas=()=>{const el=document.createElement('canvas');el.width=513;el.height=529;return el;};
  const pixels=el=>el.getContext('2d').getImageData(0,0,513,529).data;
  const render=(source,frame)=>{const el=canvas();renderCanvas(el.getContext('2d'),evaluateDrawing(source,frame));return pixels(el);};
  const svgPixels=async(source,frame)=>{const markup=renderSVG(source,frame),parseError=new DOMParser().parseFromString(markup,'image/svg+xml').querySelector('parsererror');if(parseError)throw new Error(parseError.textContent);const url=URL.createObjectURL(new Blob([markup],{type:'image/svg+xml'})),image=new Image();try{image.src=url;await image.decode();const el=canvas();el.getContext('2d').drawImage(image,0,0);return pixels(el);}finally{URL.revokeObjectURL(url);}};
  const hitContext=canvas().getContext('2d');
  const pathInside=(path,x,y)=>{const [a,b,c,d,e,f]=path.matrix,det=a*d-b*c;return hitContext.isPointInPath(new Path2D(path.d),(d*(x-e)-c*(y-f))/det,(-b*(x-e)+a*(y-f))/det);};
  const inside=(command,x,y)=>pathInside(command,x,y)&&(command.clips||[]).every(clip=>pathInside(clip,x,y));
  const delta=(a,b,x,y)=>Math.max(...[0,1,2,3].map(c=>Math.abs(a[(y*513+x)*4+c]-b[(y*513+x)*4+c])));
  const checks=[];let lidProbes=0,supportedProbes=0;
  try{
   for(const [name,clip] of Object.entries(scene.packs.wwzard.clips))for(const fraction of [0,.3,.65,1]){
    player.previewClip('wwzard',name,clip.duration*fraction);
    const paired=Object.hasOwn(scene.packs.screen.clips,name);
    const frame=player.previewClip('screen',paired?name:'still',paired?clip.duration*fraction:0),drawing=evaluateDrawing(scene,frame),commands=drawing.units.flatMap(unit=>unit.commands);
    const body=commands.find(c=>c.pick?.part==='robe-body'),desk=commands.filter(c=>c.pick?.actor==='desk');
    const actual=render(scene,frame),hidden=render(withoutBody,frame),svg=await svgPixels(scene,frame),svgHidden=await svgPixels(withoutBody,frame);
    let covered=0;
    for(let y=310;y<410;y+=5)for(let x=160;x<275;x+=5){
     if(![-2,0,2].every(dx=>[-2,0,2].every(dy=>inside(body,x+dx,y+dy)&&desk.some(c=>inside(c,x+dx,y+dy)))))continue;
     covered++;
     if(delta(actual,hidden,x,y)>1||delta(svg,svgHidden,x,y)>1)throw new Error(`${name} ${fraction}: robe paints over furniture at ${x},${y}; Canvas delta=${delta(actual,hidden,x,y)}, SVG delta=${delta(svg,svgHidden,x,y)}; units=${drawing.units.map(u=>u.id+':'+u.depth).join(',')}`);
    }
    if(covered<30)throw new Error(`${name}: lower robe is cropped instead of continuing behind the desk (${covered} probes)`);
    checks.push({clip:name,fraction,covered});
    const arms=commands.filter(c=>['left-hand','right-hand','left-sleeve','right-sleeve'].includes(c.pick?.part));
    const lid=commands.filter(c=>c.pick?.part==='lid-back');
    const noArms=render(withoutArms,frame),svgNoArms=await svgPixels(withoutArms,frame);
    const pose=frame.actors.find(a=>a.id==='wwzard').pose;
    const closed=frame.actors.find(a=>a.id==='screen').pose['hinge.bend']===1;
    for(let y=205;y<380;y+=3)for(let x=200;x<410;x+=3){
     if(!arms.some(c=>inside(c,x+.5,y+.5))||![-2,0,2].every(dx=>[-2,0,2].every(dy=>lid.some(c=>inside(c,x+.5+dx,y+.5+dy)))))continue;
     // A foreground arm's antialiased edge can affect this pixel even when
     // its center belongs only to an occluded arm underneath it.
     const supported=closed&&arms.some(c=>(c.pick.part.startsWith('left')?pose['leftArm.z']>0:pose['rightArm.z']>0)&&[-1,0,1].some(dx=>[-1,0,1].some(dy=>inside(c,x+.5+dx,y+.5+dy))));
     if(supported){if(delta(actual,noArms,x,y)>5&&delta(svg,svgNoArms,x,y)>5)supportedProbes++;continue;}
     lidProbes++;
     if(delta(actual,noArms,x,y)>1||delta(svg,svgNoArms,x,y)>1)throw new Error(`${name} ${fraction}: whole palm or sleeve covers the laptop at ${x},${y}, Canvas=${delta(actual,noArms,x,y)}, SVG=${delta(svg,svgNoArms,x,y)}, covering=${lid.filter(c=>inside(c,x,y)).map(c=>c.pick.part)}, paints=${commands.filter(c=>inside(c,x,y)).map(c=>c.pick?.part)}`);
    }
   }
   if(lidProbes<100)throw new Error(`Insufficient hand/lid overlap coverage: ${lidProbes}`);
   if(supportedProbes<100)throw new Error(`Hands resting on the closed cover were not rendered: ${supportedProbes}`);
   // The full supported elbow must reach the hand. Merely finding some
   // visible forearm pixels misses a split that buries half the elbow.
   const fullNearSleeve=structuredClone(scene);
   const split=fullNearSleeve.packs.wwzard.parts.find(p=>p.id==='left-sleeve').spatial.depthSplit;
   split.low=structuredClone(split.high);
   let elbowProbes=0;
   for(const time of [0,1.8,3.1,6,7.5,9]){
    player.previewClip('wwzard','closed-idle',time);
    const frame=player.previewClip('screen','closed-idle',time);
    const commands=evaluateDrawing(fullNearSleeve,frame).units.flatMap(u=>u.commands);
    const sleeve=commands.find(c=>c.pick?.part==='left-sleeve'),lid=commands.find(c=>c.pick?.part==='lid-back');
    const actual=render(scene,frame),expected=render(fullNearSleeve,frame),svg=await svgPixels(scene,frame),expectedSVG=await svgPixels(fullNearSleeve,frame);
    for(let y=290;y<350;y++)for(let x=195;x<245;x++){
     if(![-2,0,2].every(dx=>[-2,0,2].every(dy=>pathInside(sleeve,x+dx,y+dy)&&inside(lid,x+dx,y+dy))))continue;
     elbowProbes++;
     if(delta(actual,expected,x,y)>1||delta(svg,expectedSVG,x,y)>1)throw new Error(`Closed idle ${time}: elbow is cut by the laptop at ${x},${y}`);
    }
   }
   if(elbowProbes<100)throw new Error(`Insufficient supported elbow coverage: ${elbowProbes}`);
   let angryContactProbes=0;
   for(const time of [1.3,2.7,4.3]){
    player.previewClip('wwzard','closed-idle--angry',time);
    const frame=player.previewClip('screen','closed-idle--angry',time);
    const commands=evaluateDrawing(scene,frame).units.flatMap(u=>u.commands);
    const sleeve=commands.find(c=>c.pick?.part==='left-sleeve'),lid=commands.find(c=>c.pick?.part==='lid-back');
    // The lower elbow's contact patch must sit inside the cover, not hang
    // beyond its near edge. Use the complete silhouette, including hidden bits.
    for(let y=330;y<380;y++)for(let x=235;x<275;x++){
     if(![-1,0,1].every(dx=>[-1,0,1].every(dy=>pathInside(sleeve,x+dx,y+dy))))continue;
     angryContactProbes++;
     if(![-2,0,2].every(dx=>[-2,0,2].every(dy=>inside(lid,x+dx,y+dy))))throw new Error(`Angry idle ${time}: elbow hangs beyond the lid at ${x},${y}`);
    }
   }
   if(angryContactProbes<100)throw new Error(`Missing angry elbow contact: ${angryContactProbes}`);
   player.previewClip('screen','still',0);
   // Tucked hands remain opaque geometry. Changing only their animated order
   // must hide them behind furniture, and undoing that order must expose them.
   const noHands=structuredClone(scene);
   for(const part of noHands.packs.wwzard.parts)if(['leftHand','rightHand'].includes(part.joint)){part.fill='none';delete part.gradient;}
   const tuckedTime=scene.packs.wwzard.clips.rest.duration/2;
   const tuck=player.previewClip('wwzard','rest',tuckedTime),tuckCommands=evaluateDrawing(scene,tuck).units.flatMap(unit=>unit.commands),hands=tuckCommands.filter(c=>['left-hand','right-hand'].includes(c.pick?.part)),furniture=tuckCommands.filter(c=>c.pick?.part==='desk-solid');
   const covered=render(scene,tuck),noHandPixels=render(noHands,tuck),coveredSVG=await svgPixels(scene,tuck),noHandSVG=await svgPixels(noHands,tuck);
   const exposed=render(scene,player.previewClip('wwzard','rest',tuckedTime,{'leftArm.z':0,'rightArm.z':0}));
   let handProbes=0,reappeared=0;
   if(hands.some(hand=>hand.opacity!==1))throw new Error('Tucked hands must not be hidden using opacity');
   for(let y=270;y<380;y+=2)for(let x=180;x<325;x+=2){
    if(![-1,0,1].every(dx=>[-1,0,1].every(dy=>hands.some(c=>inside(c,x+dx,y+dy))&&furniture.some(c=>inside(c,x+dx,y+dy)))))continue;
    handProbes++;if(delta(covered,noHandPixels,x,y)>1||delta(coveredSVG,noHandSVG,x,y)>1)throw new Error('A tucked hand shows through the desk');
    if(delta(covered,exposed,x,y)>30)reappeared++;
   }
   if(handProbes<30||reappeared<30)throw new Error(`Tuck was not proven by depth alone: ${handProbes}/${reappeared}`);
   // The far shoulder is covered by the robe, while the near shoulder must
   // remain visible on top of it through the same movement.
   const noSleeves=structuredClone(scene);
   for(const part of noSleeves.packs.wwzard.parts)if(['left-sleeve','right-sleeve','left-sleeve-shadow'].includes(part.id)){part.fill='none';delete part.gradient;}
   let shoulderProbes=0,nearShoulderProbes=0;
   for(const [clip,time] of [['work',0],['rest',.15],['curious',1],['greet',.6]]){
    const frame=player.previewClip('wwzard',clip,time),commands=evaluateDrawing(scene,frame).units.flatMap(unit=>unit.commands);
    const shoulders=commands.filter(c=>c.pick?.fragment==='right-sleeve--depth-low'),nearShoulder=commands.find(c=>c.pick?.fragment==='left-sleeve--depth-low'),forearms=commands.filter(c=>c.pick?.fragment?.endsWith('--depth-high')),robe=commands.filter(c=>['robe-body','robe-soft-shoulder'].includes(c.pick?.part));
    const a=render(scene,frame),b=render(noSleeves,frame),sa=await svgPixels(scene,frame),sb=await svgPixels(noSleeves,frame);
    let count=0,nearVisible=0;
    for(let y=225;y<295;y+=2)for(let x=165;x<265;x+=2){
     if(![-2,0,2].every(dx=>[-2,0,2].every(dy=>shoulders.some(c=>inside(c,x+dx,y+dy))&&robe.some(c=>inside(c,x+dx,y+dy))&&!forearms.some(c=>inside(c,x+dx,y+dy)))))continue;
     count++;if(delta(a,b,x,y)>1||delta(sa,sb,x,y)>1)throw new Error(`${clip}: shoulder paints over robe at ${x},${y}`);
    }
    for(let y=230;y<310;y+=2)for(let x=165;x<265;x+=2){
     if(![-2,0,2].every(dx=>[-2,0,2].every(dy=>inside(nearShoulder,x+dx,y+dy)&&robe.some(c=>inside(c,x+dx,y+dy))&&!forearms.some(c=>inside(c,x+dx,y+dy)))))continue;
     if(delta(a,b,x,y)>1&&delta(sa,sb,x,y)>1)nearVisible++;
    }
    if(count<10)throw new Error(`${clip}: insufficient shoulder overlap probes (${count})`);
    if(nearVisible<40)throw new Error(`${clip}: near upper arm is buried under the robe (${nearVisible} visible probes)`);
    shoulderProbes+=count;
    nearShoulderProbes+=nearVisible;
   }
   for(const [time,behind] of [[0,false],[tuckedTime,true],[scene.packs.wwzard.clips.rest.duration,false]]){
    window.posecraft.previewClip('wwzard','rest',time);
    const units=[...document.querySelectorAll('#illustration [data-scene-unit]')].map(el=>el.dataset.sceneUnit),deskIndex=units.indexOf('actor:desk');
    for(const part of ['left-sleeve','right-sleeve']){
     const index=units.indexOf('part:wwzard:'+part+'--depth-high');
     if(index<0||deskIndex<0||(index<deskIndex)!==behind)throw new Error(`Mounted SVG did not update ${part} order at ${time}`);
    }
    const shoulder=units.indexOf('part:wwzard:right-sleeve--depth-low');
    if(shoulder<0||shoulder>=deskIndex)throw new Error(`Mounted SVG shoulder did not stay behind the desk at ${time}`);
   }
   // Move the actual furniture. The complete robe must be revealed where it
   // used to be covered; a stationary crop or a shortened drawing cannot pass.
   const moved=structuredClone(scene);for(const actor of moved.actors)if(['desk','keyboard','screen'].includes(actor.id))actor.transform.y+=140;
   const movedPlayer=new IllustrationController(moved,providers);
   try{
    const frame=player.previewClip('wwzard','work',0),a=render(scene,frame),b=render(moved,movedPlayer.previewClip('wwzard','work',0));
    let revealed=0;for(let y=350;y<400;y+=3)for(let x=185;x<245;x+=3)if(delta(a,b,x,y)>30)revealed++;
    if(revealed<150)throw new Error(`Moving furniture did not expose the lower robe (${revealed} probes)`);
    return {poses:checks.length,minCovered:Math.min(...checks.map(c=>c.covered)),revealed,handProbes,reappeared,shoulderProbes,nearShoulderProbes,lidProbes,supportedProbes,elbowProbes,angryContactProbes,mountedOrder:true,renderers:['SVG','Canvas']};
   }finally{movedPlayer.dispose();}
  }finally{player.dispose();}
 });
 assert.equal(result.poses,132);console.log(JSON.stringify(result));
}finally{await browser.close();await server.close();}
