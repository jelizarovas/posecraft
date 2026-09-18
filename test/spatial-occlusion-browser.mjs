import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5178';
await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/occlusion-fixture.html','<!doctype html><meta charset="utf-8"><title>Occlusion review</title><style>body{margin:24px;background:#edf0f3;color:#263044;font:14px system-ui}main{display:grid;grid-template-columns:repeat(3,320px);gap:16px}.case{background:white;padding:12px;border-radius:12px}svg{display:block;width:100%;height:210px}h2{font-size:15px;margin:0 0 8px}</style><main></main>','utf8');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1120,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/test-results/occlusion-fixture.html');
 const result=await page.evaluate(async()=>{
  const [{createDrawing},{renderSVG,mountSVG},{poseDefaults,spatialParts},{forwardKinematics},{addSpatialRig,addOnaArmJoints}]=await Promise.all([import('/src/vector-authoring.js'),import('/src/svg.js'),import('/src/spatial.js'),import('/src/index.js'),import('/src/character-rigs.js')]);
  const main=document.querySelector('main'),joint=(id,parent,x=0,y=0)=>({id,parent,x,y,length:0,rotation:0,min:-180,max:180}),scene=createDrawing(),pack=scene.packs.drawing;scene.bounds={width:160,height:160};scene.lighting={enabled:false};
  pack.spatial=true;pack.joints=[joint('root',null),joint('upper','root'),joint('elbow','upper',20),joint('hand','elbow',60)];pack.parts=[{id:'body',joint:'root',d:'M-25-30H25V35H-25Z',fill:'#0066ff',spatial:{order:10}},{id:'marking',joint:'root',d:'M-23-10H23V10H-23Z',fill:'#ff0000',spatial:{depth:100,surfaceOf:'body',order:11}},{id:'arm',joint:'upper',d:'M0 0',fill:'#00ff00',stroke:'#003300',strokeWidth:1,spatial:{softLimb:{elbow:'elbow',hand:'hand',radius:6},order:20}}];pack.clips={idle:{duration:1,loop:true,tracks:{}}};pack.states={idle:{clip:'idle'}};pack.initial='idle';pack.inputs={};scene.actors[0].inputs={};
  const pose={...poseDefaults(pack),'root.x':80,'root.y':80,'upper.z':-15,'upper.yaw':40,'elbow.yaw':-120},makeFrame=(p,q,id='character')=>({time:0,actors:[{id,pose:q,world:forwardKinematics(p.joints,q),inputs:{}}]}),f=makeFrame(pack,pose),card=document.createElement('section');card.className='case';card.innerHTML='<h2>Upper behind · forearm in front</h2><div id="fixture"></div>';main.append(card);const host=card.querySelector('div'),mounted=mountSVG(host,scene,f);
  const nodes=[...host.querySelectorAll('[data-slot]')],clips=[...host.querySelectorAll('[data-fragment-mask]')];
  const pixel=async(svg,points)=>{const image=new Image(),url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)],{type:'image/svg+xml'}));await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url;});const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,160,160);URL.revokeObjectURL(url);return points.map(([x,y])=>Array.from(ctx.getImageData(x,y,1,1).data));};
  const pixels=await pixel(host.querySelector('svg'),[[86,80],[100,80]]);
  for(let angle=-180;angle<=180;angle+=15)mounted.update(makeFrame(pack,{...pose,'root.yaw':angle,'elbow.rotation':30*Math.sin(angle*Math.PI/180)}));mounted.update(f);
  const stable=nodes.every(node=>node.isConnected)&&nodes.length===host.querySelectorAll('[data-slot]').length;
  const exportHost=document.createElement('section');exportHost.className='case';exportHost.innerHTML='<h2>Fresh export matches mounted view</h2>'+renderSVG(scene,f);main.append(exportHost);const exported=await pixel(exportHost.querySelector('svg'),[[86,80],[100,80]]);
  for(const name of ['dummy','ona'])for(const angle of [0,90,180]){
   const d=await(await fetch('/examples/characters/'+name+'.json')).json(),p=d.packs[name];addSpatialRig(p,name,{studies:false});if(name==='ona')addOnaArmJoints(p);d.lighting={enabled:false};const q={...poseDefaults(p),'root.yaw':angle};
   if(name==='dummy'){q['rightUpper.rotation']=-165;q['rightLower.rotation']=115;q['rightUpper.z']=1;}
   else{q['rightArm.yaw']=55;q['rightForearm.yaw']=-120;q['rightForearm.rotation']=-60;}
   const block=document.createElement('section');block.className='case';block.innerHTML=`<h2>${name} / ${angle}°</h2>`+renderSVG(d,makeFrame(p,q,d.actors[0].id));main.append(block);
  }
  return {pixels,exported,stable,slots:nodes.map(n=>n.dataset.slot),clipCount:clips.length};
 });
 assert.deepEqual(result.pixels[0],[255,0,0,255],'rear upper arm is occluded by the torso marking');assert.deepEqual(result.pixels[1],[0,255,0,255],'near forearm covers torso and its marking');assert.deepEqual(result.exported,result.pixels);assert.ok(result.stable,'turning updates existing fragment nodes');assert.equal(result.clipCount,3,'one stable clipping mask per limb segment');assert.ok(result.slots.includes('arm--upper')&&result.slots.includes('arm--forearm')&&result.slots.includes('arm--palm'));assert.deepEqual(errors,[]);
 await page.screenshot({path:'test-results/spatial-occlusion-review.png',fullPage:true});console.log('Occlusion pixels, full turn, stable mounted nodes, export parity, Dummy/Ona review passed.');
}finally{await browser.close();}
