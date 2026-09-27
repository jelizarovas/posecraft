import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
const scenes={};
for(const name of ['home','stories','projects','contact'])scenes[name]=JSON.parse(await fs.readFile(`releases/wwwzard${name==='home'?'':'-'+name}.scene.json`,'utf8'));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:850}});
 await page.goto('http://127.0.0.1:5247/wwwzard.html');
 await page.waitForFunction(()=>!!window.posecraft);
 const results=await page.evaluate(async scenes=>{
  window.posecraft.dispose();document.body.innerHTML='<main style="display:flex"></main>';
  const {IllustrationController,mountRenderer}=await import('/packages/runtime/dist/index.js');
  const {applyMotionLayers,ActorBehaviorRuntime}=await import('/packages/runtime/dist/features.js');
  const results=[];
  for(const names of [['home'],['stories'],['projects'],['contact'],['stories','projects','contact']]){
   const mounted=names.map(name=>{const element=document.createElement('div');element.style.cssText='width:300px;height:340px';document.querySelector('main').append(element);const controller=new IllustrationController(scenes[name],{motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime}),renderer=mountRenderer(element,scenes[name],controller.frame());return {element,controller,renderer};});
   const samples=[];
   for(let i=0;i<150;i++){
    await new Promise(requestAnimationFrame);
    const start=performance.now();
    for(const {controller,renderer}of mounted)renderer.update(controller.step(1/60));
    if(i>=30)samples.push(performance.now()-start);
   }
   samples.sort((a,b)=>a-b);
   results.push({scenes:names,averageMs:samples.reduce((a,b)=>a+b,0)/samples.length,p95Ms:samples[Math.floor(samples.length*.95)],p99Ms:samples[Math.floor(samples.length*.99)],svgNodes:mounted.reduce((n,m)=>n+m.element.querySelectorAll('svg *').length,0)});
   for(const {element,controller,renderer}of mounted){renderer.dispose();controller.dispose();element.remove();}
  }
  return results;
 },scenes);
 const report={device:'Host desktop, headless Chromium/Edge, SVG, 1280x850, 300px illustrations',physicalPhone:false,sampling:'120 warm animation/update samples per case; excludes browser paint',budgets:{oneSceneP95Ms:4,threeScenesP95Ms:12,sceneGzipBytes:30720},results,sceneGzipBytes:Object.fromEntries(Object.entries(scenes).map(([name,scene])=>[name,gzipSync(JSON.stringify(scene)).length]))};
 await fs.writeFile('test-results/portfolio-scenes/cost.json',JSON.stringify(report,null,2));
 for(const result of results)assert(result.p95Ms<(result.scenes.length===1?4:12),`${result.scenes}: p95 budget exceeded (${result.p95Ms}ms)`);
 console.log(JSON.stringify(report));
}finally{await browser.close();}
