import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5247';
const browser=await chromium.launch({headless:true,channel:'msedge'}),errors=[];
await fs.mkdir('test-results/wwzard-interruption',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/wwzard.html');await page.waitForFunction(()=>!!window.posecraft);
 const result=await page.evaluate(async()=>{
  window.posecraft.pause();
  const [{IllustrationController},{BehaviorRuntime},{ScenePointerInteraction},{renderSVG}]=await Promise.all([import('/src/illustration.js'),import('/src/behaviors.js'),import('/src/pointer-interactions.js'),import('/src/svg.js')]);
  const scene=window.wwzardScene,sheets=[];
  for(const [mood,idle]of [['normal',3],['angry',2.8],['angry',6.5],['disappointed',3],['disappointed',8.8]]){
   const p=new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
   p.dispatch('mood-'+mood);p.dispatch('close-laptop');
   for(let i=0;i<1200&&p.frame().behavior.state!=='closedIdle';i++)p.step(1/60);
   for(let i=0;i<Math.round(idle*60);i++)p.step(1/60);
   const beforePose=p.frame().actors.find(a=>a.id==='wwzard').pose;
   const pictures=[{at:'before',svg:renderSVG(scene,p.frame())}];
   p.dispatch('open-laptop');
   const afterPose=p.frame().actors.find(a=>a.id==='wwzard').pose;
   if(JSON.stringify(beforePose)!==JSON.stringify(afterPose))throw Error('Visible pose changed at input: '+mood);
   const paths=svg=>[...svg.matchAll(/<path data-source-part="([^"]+)"[^>]+/g)].map(m=>[m[1],m[0].match(/ d="([^"]+)"/)?.[1],m[0].match(/opacity="([^"]+)"/)?.[1]]);
   if(JSON.stringify(paths(pictures[0].svg))!==JSON.stringify(paths(renderSVG(scene,p.frame()))))throw Error('Visible SVG changed at input: '+mood);
   if(p.frame().behavior.state!=='openingLaptop')throw Error('Open did not interrupt');
   for(let i=0;i<=240;i++){
    if(i%6===0&&i<=30||i%15===0)pictures.push({at:(i/60).toFixed(2),svg:renderSVG(scene,p.frame())});
    p.step(1/60);
   }
   sheets.push({name:mood+'-'+idle,pictures});p.dispose();
  }
  return sheets;
 });
 for(const {name,pictures}of result){
  const sheet=await browser.newPage({viewport:{width:1120,height:850}});
  await sheet.setContent(`<style>body{margin:0;font:12px system-ui;color:#57456b;background:#fff}main{display:grid;grid-template-columns:repeat(4,280px)}figure{margin:0}svg{display:block;width:280px;height:280px}figcaption{padding:5px 15px}</style><main>${pictures.map(({svg,at},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${name} · ${at}s after Open</figcaption></figure>`).join('')}</main>`);
  await sheet.screenshot({path:`test-results/wwzard-interruption/${name}.png`,fullPage:true});await sheet.close();
 }
 // Exercise the actual buttons and live scheduler, including a command reversal.
 await page.reload();await page.waitForFunction(()=>!!window.posecraft);await page.locator('#close-laptop').click();
 assert.equal(await page.evaluate(()=>window.posecraft.controller.frame().behavior.state),'closingLaptop');
 await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.state==='closedIdle');
 await page.locator('#open-laptop').click();
 assert.equal(await page.evaluate(()=>window.posecraft.controller.frame().behavior.state),'openingLaptop');
 await page.waitForTimeout(350);await page.locator('#close-laptop').click();
 assert.equal(await page.evaluate(()=>window.posecraft.controller.frame().behavior.state),'closingLaptop');
 await page.locator('#open-laptop').click();
 await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.state==='working');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({immediateButtons:true,liveReversal:true,sheets:result.map(s=>s.name),phone:'390px emulation'}));
}finally{await browser.close();}
