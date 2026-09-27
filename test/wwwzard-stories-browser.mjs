import {illustrationFeatures} from '@posecraft/runtime/features';
import {chromium} from '@playwright/test';
import {createWwwzardStoriesScene} from '../examples/wwwzard-stories.js';
import {IllustrationController,renderSVG,assertDocument} from '@posecraft/runtime';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';

const scene=createWwwzardStoriesScene();assertDocument(scene);
assert(gzipSync(JSON.stringify(scene)).length<30*1024);
await fs.mkdir('test-results/wwwzard-stories',{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const controller=new IllustrationController(scene,illustrationFeatures),pictures=[];
 for(const name of ['reading','turn','thought','visitor'])for(const t of [0,.45,.95,1.45,2.05,2.85,3.4]){
  controller.previewClip('wwzard',name,Math.min(t,scene.packs.wwzard.clips[name].duration));
  controller.previewClip('book',name,Math.min(t,scene.packs.book.clips[name].duration));
  pictures.push({name,t,svg:renderSVG(scene,controller.frame())});
 }
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.setContent(`<style>body{margin:0;background:#faf9fc;font:12px system-ui;color:#665875}main{display:grid;grid-template-columns:repeat(4,300px)}figure{margin:0}svg{display:block;width:300px;height:300px}figcaption{padding:5px 15px}</style><main>${pictures.map(({svg,name,t},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${name} ${t}s</figcaption></figure>`).join('')}</main>`);
 await page.screenshot({path:'test-results/wwwzard-stories/actions.png',fullPage:true});
 await page.setContent(`<style>body{margin:0;background:#faf9fc}svg{width:400px;height:400px}</style>${pictures[0].svg}`);
 await page.screenshot({path:'test-results/wwwzard-stories/still.png',clip:{x:0,y:0,width:400,height:400}});
 const occlusion=await page.evaluate(()=>{const svg=document.querySelector('svg');return [[69,260],[229,232]].map(([x,y])=>{const p=new DOMPoint(x,y).matrixTransform(svg.getScreenCTM());return document.elementsFromPoint(p.x,p.y).find(el=>el.hasAttribute('data-source-part'))?.getAttribute('data-source-part');});});
 assert(occlusion.every(id=>id?.startsWith('book-')),JSON.stringify({palmsMustBeBehindCover:occlusion}));
 controller.dispose();
 const interruptionPictures=[];
 for(const at of [.5,.95,1.45,2.05,2.8]){
  const interrupted=new IllustrationController(scene,illustrationFeatures);
  for(let i=0;i<1500&&interrupted.frame().behavior.state!=='turning';i++)interrupted.step(1/60);
  for(let i=0;i<Math.round(at*60);i++)interrupted.step(1/60);
  const artwork=svg=>[...svg.matchAll(/<path data-source-part="([^"]+)"[^>]+/g)].map(m=>[m[1],m[0].match(/ d="([^"]+)"/)?.[1],m[0].match(/opacity="([^"]+)"/)?.[1]]);
  const before=artwork(renderSVG(scene,interrupted.frame()));interrupted.dispatch('visitor');
  assert.deepEqual(artwork(renderSVG(scene,interrupted.frame())),before,'Interrupt preserves visible artwork');
  for(let i=0;i<=24;i++){
   if(i%6===0)interruptionPictures.push({label:`turn ${at}s / greeting +${i/60}s`,svg:renderSVG(scene,interrupted.frame())});
   interrupted.step(1/60);
  }
  interrupted.dispose();
 }
 await page.setViewportSize({width:1500,height:900});
 await page.setContent(`<style>body{margin:0;background:#faf9fc;font:12px system-ui}main{display:grid;grid-template-columns:repeat(5,300px)}figure{margin:0}svg{width:300px;height:300px}</style><main>${interruptionPictures.map(({svg,label},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="i${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#i${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#i${i}-${id}"`)}<figcaption>${label}</figcaption></figure>`).join('')}</main>`);
 await page.screenshot({path:'test-results/wwwzard-stories/interruptions.png',fullPage:true});
 const live=new IllustrationController(scene,illustrationFeatures);let sawTurn=false;
 for(let i=0;i<60*90;i++){live.step(1/60);sawTurn ||= live.frame().behavior.state==='turning';}
 assert(sawTurn);const before=live.frame().actors.find(a=>a.id==='wwzard').pose;
 live.dispatch('visitor');assert.equal(live.frame().behavior.state,'greeting');
 assert.deepEqual(live.frame().actors.find(a=>a.id==='wwzard').pose,before);
 for(let i=0;i<200;i++)live.step(1/60);
 assert.equal(live.frame().behavior.state,'reading');
 assert.equal(live.frame().behavior.droppedEvents,0);
 live.dispose();
 console.log(JSON.stringify({sceneBytes:gzipSync(JSON.stringify(scene)).length,interruptFromDisplayedPose:true,autonomousTurn:true,sheet:'test-results/wwwzard-stories/actions.png'}));
}finally{await browser.close();}
