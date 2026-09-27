import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
import {createIllustrationController,assertDocument,renderSVG} from '@posecraft/runtime';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {addWwwzardLiving} from '../examples/wwwzard-living.js';

const scene=assertDocument(addWwwzardLiving(createWwzardIllustration()));
assert.equal(addWwwzardLiving(scene),scene);
assert(gzipSync(JSON.stringify(scene)).length<30*1024);
assert(!scene.actors.some(a=>a.id==='angerMeter'));
const make=()=>createIllustrationController(JSON.parse(JSON.stringify(scene)));
const step=(c,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)c.step(1/60);};
const until=(c,state,limit=20)=>{for(let i=0;i<limit*60&&c.frame().behavior.state!==state;i++)c.step(1/60);assert.equal(c.frame().behavior.state,state);};
const c=make(),seen=new Set();
for(let clicks=1;clicks<=3;clicks++){
  const before=c.frame().actors.map(a=>a.pose);
  c.dispatch('laptop-click');
  assert.equal(c.frame().behavior.state,'visitorClosing');
  assert.equal(c.frame().behavior.variables.anger,clicks*28);
  assert.deepEqual(c.frame().actors.map(a=>a.pose),before,'Click must preserve character and prop poses at the interruption edge');
  step(c,.65);assert.equal(c.frame().actors.find(a=>a.id==='screen').pose['hinge.bend'],1);
  assert.equal(c.frame().actors.find(a=>a.id==='wwzard').pose['leftGrip.opacity'],0,'Wizard must not grip the lid the visitor closes');
  until(c,clicks<3?'puzzled':'annoyed');seen.add(c.frame().behavior.state);
  if(clicks===3){until(c,'breathing');seen.add('breathing');step(c,3.3);assert.equal(c.frame().behavior.variables.anger,42);assert.equal(c.frame().behavior.state,'breathing');step(c,3.7);assert.equal(c.frame().behavior.variables.anger,0);until(c,'openingLaptop');assert.equal(c.frame().behavior.variables.anger,0);assert.equal(c.frame().behavior.variables.mood,1);}
  until(c,'working');
}
// No ordinary action has to finish before a manual command reverses the lid.
c.dispatch('close-laptop');step(c,.5);c.dispatch('open-laptop');assert.equal(c.frame().behavior.state,'openingLaptop');
until(c,'working');c.dispatch('close-laptop');until(c,'closedIdle');step(c,14);assert(c.frame().behavior.variables.laptopClosed);c.dispatch('open-laptop');until(c,'working');
for(let i=0;i<60*240;i++){seen.add(c.frame().behavior.state);c.step(1/60);}
for(const state of ['trackpad','browsing','sighing'])assert(seen.has(state),`Missing autonomous ${state}`);
c.dispose();
// Repeated clicks remain bounded. A quiet interval always permits recovery.
const spam=make();for(let i=0;i<19;i++){spam.dispatch('laptop-click');step(spam,.15);}assert.equal(spam.frame().behavior.variables.anger,100);until(spam,'breathing');until(spam,'working',20);assert.equal(spam.frame().behavior.variables.anger,0);spam.dispose();

const out='test-results/wwwzard-living';await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const page=await browser.newPage({viewport:{width:1200,height:720}});
  for(const name of ['trackpad','doomscroll','sigh','visitor-close','laptop-puzzled','laptop-annoyed','breathe','gust-left','gust-right']){
    const controller=make(),gust=name.startsWith('gust'),actor=gust?'room':'wwzard',pack=scene.packs[actor],clip=pack.clips[name];
    const times=Array.from({length:8},(_,i)=>+(i*clip.duration/7).toFixed(4));
    const svgs=times.map(time=>{
      if(name==='breathe')controller.setVariable('anger',time<3.25?84:time<6.95?42:0);
      if(name==='laptop-annoyed')controller.setVariable('anger',84);
      if(name.startsWith('laptop-')||name==='breathe')controller.previewClip('screen','closed-pause',0);
      if(name==='visitor-close')controller.previewClip('screen','visitor-close',time);
      controller.previewClip(actor,name,time);
      return {time,svg:renderSVG(scene,controller.frame())};
    });
    controller.dispose();
    await page.setContent(`<style>body{margin:0;background:#fff;font:12px system-ui;color:#645273}main{display:grid;grid-template-columns:repeat(4,300px)}figure{margin:0}svg{width:300px;height:310px}figcaption{padding:5px 12px}</style><main>${svgs.map(({svg,time},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${name} ${time}s</figcaption></figure>`).join('')}</main>`);
    await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
  }
  for(const [name,anger,times] of [['visitor-cycle',0,[0,.1,.2,.35,.6,.9,1.3,1.9,2.6,3.2,3.4,3.8,4.2,4.8,5.5,6.5,7.4]],['angry-recovery',56,[3.3,3.6,3.7,3.85,4,4.15,4.25,4.6,5.4,7.5,9.1,11.25,11.7,12,12.5,13.2,14.2,15.7]]]){
  const flow=make(),samples=[];flow.setVariable('anger',anger);flow.dispatch('laptop-click');
  let elapsed=0;
  for(const at of times){
    while(elapsed+1/60<=at+.0001){flow.step(1/60);elapsed+=1/60;}
    samples.push({at,state:flow.frame().behavior.state,svg:renderSVG(scene,flow.frame())});
  }
  flow.dispose();
  await page.setContent(`<style>body{margin:0;background:#fff;font:12px system-ui;color:#645273}main{display:grid;grid-template-columns:repeat(4,300px)}figure{margin:0}svg{width:300px;height:310px}figcaption{padding:5px 12px}</style><main>${samples.map(({svg,at,state},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${at}s · ${state}</figcaption></figure>`).join('')}</main>`);
  await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
  }
}finally{await browser.close();}
const report={valid:true,publicRuntime:true,sceneGzipBytes:gzipSync(JSON.stringify(scene)).length,states:[...seen],clickAnger:[28,56,84],angerClamped:100,breathingCalmsTo:0,manualReversal:true,manualCloseStaysClosed:true,physicalPhone:false};
await fs.writeFile(`${out}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
