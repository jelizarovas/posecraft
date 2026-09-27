import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
import {assertDocument,createIllustrationController,renderSVG,supportsIllustration} from '@posecraft/runtime';
import {createWwwzardProjectsScene} from '../examples/wwwzard-projects.js';

const scene=assertDocument(createWwwzardProjectsScene());
const serialized=JSON.stringify(scene),bytes=gzipSync(serialized).length;
assert(bytes<=30*1024);
assert(supportsIllustration(JSON.parse(serialized)));
assert(!scene.actors.some(actor=>/keyboard|screen/.test(actor.id)));
await fs.mkdir('releases',{recursive:true});
await fs.mkdir('test-results/wwwzard-projects',{recursive:true});
await fs.writeFile('releases/wwwzard-projects.scene.json',serialized);

const runtime=createIllustrationController(scene),visited=new Set();
for(let frame=0;frame<60*35;frame++){
  visited.add(runtime.frame().behavior.state);runtime.step(1/60);
}
for(const state of ['drafting','inspecting','quiet'])assert(visited.has(state));
// A visitor can interrupt a stroke, inspection or stillness immediately while
// preserving the currently displayed hand and prop pose at the request edge.
for(const state of ['drafting','inspecting','quiet']){
  const c=createIllustrationController(scene);
  for(let i=0;i<60*20&&c.frame().behavior.state!==state;i++)c.step(1/60);
  c.step(.08);
  const before=c.frame().actors.find(actor=>actor.id==='wwzard').pose;
  c.dispatch('visitor');
  assert.equal(c.frame().behavior.state,'greeting');
  assert.deepEqual(c.frame().actors.find(actor=>actor.id==='wwzard').pose,before);
  for(let i=0;i<60*3;i++)c.step(1/60);
  assert.equal(c.frame().behavior.state,'quiet');
  c.dispose();
}

const sheets=[];
for(const [clip,times] of [['draft',[0,.35,.7,.95,1.3,1.55,1.9,2.6]],['inspect',[0,.4,.8,1.75,2.15,2.45,3,3.6]],['visitor',[0,.15,.3,.6,.95,1.15,1.4,1.8]]]){
  const pictures=times.map(time=>{
    runtime.previewClip('wwzard',clip,time);
    return {time,svg:renderSVG(scene,runtime.frame())};
  });
  sheets.push({clip,pictures});
}
runtime.dispose();
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1200,height:700}});
  for(const {clip,pictures} of sheets){
    await page.setContent(`<style>body{margin:0;background:#fff;font:13px system-ui;color:#584669}main{display:grid;grid-template-columns:repeat(4,300px)}figure{margin:0}svg{width:300px;height:310px}figcaption{padding:6px 20px}</style><main>${pictures.map(({time,svg},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${clip} ${time}s</figcaption></figure>`).join('')}</main>`);
    await page.screenshot({path:`test-results/wwwzard-projects/${clip}.png`,fullPage:true});
  }
}finally{await browser.close();}
const report={valid:true,publicRuntime:true,saveReopen:true,sceneGzipBytes:bytes,states:[...visited],immediateVisitor:true,physicalPhone:false,renderedAt:300};
await fs.writeFile('test-results/wwwzard-projects/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
