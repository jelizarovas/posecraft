import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createDrawing} from '../src/vector-authoring.js';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5247',browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/material-review.html','<!doctype html><html><body></body></html>');
try{
 const page=await browser.newPage({viewport:{width:1280,height:520}});page.on('pageerror',error=>errors.push(error.message));await page.goto(base+'/test-results/material-review.html');
 const evidence=await page.evaluate(async()=>{
  const [{createWwwzardContactScene},{illustrationProviders},{IllustrationController},{mountSVG},{evaluateDrawing}]=await Promise.all([import('/examples/wwwzard-contact.js'),import('/src/illustration-entry.js'),import('/src/illustration.js'),import('/src/svg.js'),import('/src/render-evaluation.js')]);
  document.body.innerHTML='<main style="display:flex;gap:8px;padding:12px;background:#111827;min-height:470px"></main>';const main=document.querySelector('main'),scene=createWwwzardContactScene(),controller=new IllustrationController(scene,await illustrationProviders(scene));
  const before=controller.frame(),signal=scene.materialLighting.weight;controller.setInput(signal.actor,'night',1);const night=controller.frame();
  const moon=structuredClone(night);moon.actors.find(a=>a.id==='wwzard').pose['display.bend']=0;
  const closed=structuredClone(night);closed.actors.find(a=>a.id==='screen').pose['hinge.bend']=1;
  const instances=[],pathCounts=[];
  for(const [label,frame]of [['Day',before],['Moon',moon],['Moon + screen',night],['Closed lid',closed]]){const card=document.createElement('section');card.style.cssText='width:300px;flex:0 0 300px;color:#ccd0e7;font:14px system-ui;text-align:center';card.innerHTML='<div style="width:300px;height:380px;background:'+(label==='Day'?'#fbfbfe':'#111827')+'"></div><p>'+label+'</p>';main.append(card);const host=card.firstElementChild,renderer=mountSVG(host,scene,before);renderer.update(frame);instances.push({renderer,host,frame});pathCounts.push(host.querySelectorAll('path').length);}
  const node=instances[2].host.querySelector('[data-actor="wwzard"] [data-part-gradient]'),id=node.dataset.partGradient,svgColors=[...node.children].map(n=>n.getAttribute('stop-color'));
  const canvasColors=evaluateDrawing(scene,night).units.flatMap(u=>u.commands).find(c=>c.id==='actor:wwzard:'+id).fill.stops.map(s=>s[1]);
  const dayColors=[...instances[0].host.querySelector('[data-actor="wwzard"] [data-part-gradient]').children].map(n=>n.getAttribute('stop-color'));instances[2].renderer.update(before);const restored=[...node.children].map(n=>n.getAttribute('stop-color'));instances[2].renderer.update(night);
  const costs=[];for(let i=0;i<160;i++){const start=performance.now();for(const item of instances.slice(1,3)){const frame={...item.frame,effectsTime:i/60};item.renderer.update(frame);}if(i>19)costs.push(performance.now()-start);}costs.sort((a,b)=>a-b);
  window.materialReview={controller,instances};return {pathCounts,svgColors,canvasColors,dayColors,restored,twoEmbedP95:costs[Math.floor(costs.length*.95)],filters:instances[2].host.querySelectorAll('filter').length};
 });
 assert.deepEqual(evidence.svgColors,evidence.canvasColors);assert.deepEqual(evidence.restored,evidence.dayColors);assert(evidence.pathCounts.every(v=>v===evidence.pathCounts[0]));assert.equal(evidence.filters,0);assert(evidence.twoEmbedP95<12,JSON.stringify(evidence));
 await page.screenshot({path:'test-results/material-lighting-contact.png'});await page.close();
 const studio=await browser.newPage({viewport:{width:1400,height:1000},acceptDownloads:true});studio.on('pageerror',e=>errors.push(e.message));await studio.addInitScript(()=>{window.showOpenFilePicker=undefined;window.showSaveFilePicker=undefined;});await studio.goto(base+'/');await studio.locator('#clip').waitFor();
 const fixture=createDrawing();fixture.packs.drawing.parts.push({id:'key',joint:'root',d:'M0 0L20 0L20 20L0 20Z',fill:'#ffffff'});const chooser=studio.waitForEvent('filechooser');await studio.locator('#import').click();await(await chooser).setFiles({name:'material-lighting.posecraft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await studio.waitForFunction(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')).id==='drawing');await studio.locator('[data-panel="light"]').click();await studio.locator('#material-lighting-add').click();
 await studio.locator('[data-material-number="ambient"]').fill('.42');await studio.locator('[data-material-number="ambient"]').press('Tab');await studio.locator('#material-lighting-add-source').click();await studio.locator('[data-material-signal="lights.1.gains.0"]').selectOption('character|root.opacity');await studio.locator('[data-material-invert="lights.1.gains.0"]').check();
 await studio.locator('[data-material-emission="1"]').selectOption('character');await studio.locator('[data-material-highlights="0"]').selectOption('character');
 const download=studio.waitForEvent('download');await studio.locator('#export').click();const data=JSON.parse(await fs.readFile(await(await download).path(),'utf8'));assert.equal(data.materialLighting.ambient,.42);assert.equal(data.materialLighting.lights[0].highlights.actor,'character');assert.equal(data.materialLighting.lights[1].emission.actor,'character');assert(data.materialLighting.lights[1].emission.parts.length>0);assert.equal(data.materialLighting.lights[1].gains[0].invert,true);
 await studio.reload();await studio.locator('#clip').waitFor();await studio.locator('[data-panel="light"]').click();assert.equal(await studio.locator('[data-material-number="ambient"]').inputValue(),'0.42');assert(await studio.locator('[data-material-invert="lights.1.gains.0"]').isChecked());assert.equal(await studio.locator('[data-material-emission="1"]').inputValue(),'character');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({svgCanvasParity:true,dayRestored:true,samePaths:true,noFilters:true,studioSaveReopen:true,...evidence}));
}finally{await browser.close();}
