import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const scenes=await Promise.all(['wwwzard','wwwzard-contact'].map(async name=>JSON.parse(await fs.readFile(`releases/${name}.scene.json`,'utf8'))));
const runtime=process.env.POSECRAFT_COST_RUNTIME||'package';
const night=process.env.NIGHT==='1';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1000,height:700}});
 await page.goto('http://127.0.0.1:5247/wwwzard.html');await page.waitForFunction(()=>!!window.posecraft);
 const result=await page.evaluate(async ({scenes,runtime,night})=>{
  window.posecraft.dispose();document.body.innerHTML='<main style="display:flex"></main>';
  const module=await import(runtime==='source'?'/src/illustration-entry.js':'/packages/runtime/dist/index.js'),mount=module.mountIllustration||module.mountExport;
  const {applyMotionLayers,ActorBehaviorRuntime}=await import('/packages/runtime/dist/features.js');
  const players=await Promise.all(scenes.map(scene=>{const host=document.createElement('div');host.style.cssText='width:300px;height:340px';document.querySelector('main').append(host);return mount(host,scene,{autoplay:false,motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});}));
  if(night)players.forEach((player,i)=>{for(const actor of scenes[i].actors)if(scenes[i].packs[actor.pack].inputs?.night)player.setInput(actor.id,'night',1);});
  const samples=[];
  for(let i=0;i<150;i++){
   await new Promise(requestAnimationFrame);const start=performance.now();
   players[0].setHostTransition({phase:'depart',direction:-1,progress:(i%51)/50});
   players[1].setHostTransition({phase:'arrive',direction:-1,progress:(i%51)/50});
   if(i>=30)samples.push(performance.now()-start);
  }
  players.forEach(player=>player.dispose());samples.sort((a,b)=>a-b);
  return {p95Ms:samples[Math.floor(samples.length*.95)],maxMs:Math.max(...samples),averageMs:samples.reduce((a,b)=>a+b,0)/samples.length};
 },{scenes,runtime,night});
 const report={device:'Host desktop, headless Edge, two 300px SVG embeds',runtime,sceneSHA256:createHash('sha256').update(JSON.stringify(scenes)).digest('hex'),physicalPhone:false,excludesPaint:true,budgetP95Ms:12,...result};
 report.night=night;
 await fs.writeFile(`test-results/host-transition-cost${runtime==='source'?'-source':''}${night?'-night':''}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));assert(result.p95Ms<12);
}finally{await browser.close();}
