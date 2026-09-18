import fs from 'node:fs/promises';
import os from 'node:os';
import {performance} from 'node:perf_hooks';
import {createGym} from '../examples/gym.js';
import {createCampfire} from '../examples/campfire.js';
import {SceneController} from '../src/scene.js';
import {createAnimationPreview} from '../src/animation-preview.js';
import {renderSVG} from '../src/svg.js';
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const rows=[];
for(const [create,actor,clip,joint,time]of [[createGym,'atlas','full-set','rightHand',42],[createCampfire,'camper-0','campfire','hold-hand',3]]){
 const doc=create(),pack=doc.packs[doc.actors.find(a=>a.id===actor).pack],selectedJoint=pack.joints.some(j=>j.id===joint)?joint:pack.joints.at(-1).id,selectedClip=pack.clips[clip]?clip:Object.keys(pack.clips)[0],controller=new SceneController(doc),frame=controller.previewClip(actor,selectedClip,Math.min(time,pack.clips[selectedClip].duration)),runs=[];
 for(let i=0;i<7;i++){let start=performance.now();const preview=createAnimationPreview(doc,frame,{actor,clip:selectedClip});const snapshot=performance.now()-start;start=performance.now();const ghosts=preview.onion(time,{step:.15,count:1});const sampleGhosts=performance.now()-start;start=performance.now();preview.path(selectedJoint,{samples:31});const path=performance.now()-start;start=performance.now();for(const ghost of ghosts)renderSVG(doc,ghost.frame,{camera:null});const renderGhosts=performance.now()-start;const source=doc.actors.find(a=>a.id===actor),drawPack={...pack,clips:Object.fromEntries(Object.entries(pack.clips).map(([id,c])=>[id,{duration:c.duration,loop:c.loop,tracks:{}}]))},drawing={schemaVersion:1,kind:'scene',id:'pose-guide',name:'Pose guide',revision:0,bounds:doc.bounds,requiredFeatures:doc.requiredFeatures||[],packs:{[source.pack]:drawPack},actors:[{...source,unlit:true}],props:[],...(doc.groups?{groups:doc.groups}:{})};start=performance.now();for(const ghost of ghosts)renderSVG(drawing,ghost.frame,{camera:null});const selectedGhosts=performance.now()-start;if(i>=2)runs.push({snapshot,sampleGhosts,path,renderGhosts,selectedGhosts,total:snapshot+sampleGhosts+path+selectedGhosts});}
 rows.push({scene:doc.id,actor,clip:selectedClip,joint:selectedJoint,actors:doc.actors.length,bytes:JSON.stringify(doc).length,medianMs:Object.fromEntries(Object.keys(runs[0]).map(k=>[k,+median(runs.map(r=>r[k])).toFixed(2)])),runs});controller.dispose();
}
const report={environment:{platform:process.platform,node:process.version,cpu:os.cpus()[0].model},warmup:2,measured:5,notes:'Paused authored31point path + two SVG ghosts. Node timings omit browser DOM parsing/painting; no phone FPS claim.',rows};await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/animation-preview-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
