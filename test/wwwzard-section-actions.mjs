import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
import {assertDocument,IllustrationController,renderSVG} from '@posecraft/runtime';
import {createWwwzardStoriesScene} from '../examples/wwwzard-stories.js';
import {createWwwzardProjectsScene} from '../examples/wwwzard-projects.js';

const cases=[['stories',createWwwzardStoriesScene,'turn-page','turning','turn',3.4],['projects',createWwwzardProjectsScene,'inspect-project','inspecting','inspect',3.6]];
const pictures=[],report=[];
await fs.mkdir('test-results/wwwzard-section-actions',{recursive:true});
for(const [name,factory,event,state,clip,duration] of cases){
 const scene=assertDocument(factory()),c=new IllustrationController(scene);
 let first=0;
 while(first<4&&c.frame().behavior.state!==state){c.step(1/60);first+=1/60;}
 assert(first<3,`${name} first meaningful action starts before 3 seconds`);
 const states=new Set();
 for(let i=0;i<60*45;i++){states.add(c.frame().behavior.state);c.step(1/60);}
 assert(states.has(state));assert(states.has('quiet'));
 c.dispatch('visitor');for(let i=0;i<30;i++)c.step(1/60);
 const before=c.frame().actors.find(a=>a.id==='wwzard').pose;
 c.dispatch(event);assert.equal(c.frame().behavior.state,state);
 assert.deepEqual(c.frame().actors.find(a=>a.id==='wwzard').pose,before);
 for(let i=0;i<60*5;i++)c.step(1/60);
 assert.notEqual(c.frame().behavior.state,state);
 for(const t of [0,.45,.95,1.45,2.05,2.85,duration]){
  c.previewClip('wwzard',clip,t);
  if(name==='stories')c.previewClip('book',clip,t);
  pictures.push({name,t,svg:renderSVG(scene,c.frame())});
 }
 if(name==='projects'){
  c.previewClip('wwzard','inspect',1);
  assert(c.frame().actors.find(a=>a.id==='wwzard').pose['leftHand.y']<-40);
 }
 await fs.writeFile(`releases/wwwzard-${name}.scene.json`,JSON.stringify(scene));
 report.push({name,event,firstActionSeconds:+first.toFixed(3),states:[...states],gzipBytes:gzipSync(JSON.stringify(scene)).length});
 c.dispose();
}
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}});
 const unique=(svg,i)=>svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="s${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#s${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#s${i}-${id}"`);
 for(const size of [120,90]){
  await page.setContent(`<style>body{margin:0;background:#faf9fc;font:11px system-ui}main{display:grid;grid-template-columns:repeat(7,140px)}figure{margin:0;padding:10px}svg{width:${size}px;height:${size}px;display:block}figcaption{margin-top:4px}</style><main>${pictures.map(({name,t,svg},i)=>`<figure>${unique(svg,i)}<figcaption>${name} ${t}s</figcaption></figure>`).join('')}</main>`);
  await page.screenshot({path:`test-results/wwwzard-section-actions/${size}px.png`,fullPage:true});
 }
}finally{await browser.close();}
await fs.writeFile('test-results/wwwzard-section-actions/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
