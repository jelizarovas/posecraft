import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try {
 const page=await browser.newPage();await page.goto((process.env.POSECRAFT_URL||'http://127.0.0.1:5178')+'/draw.html');
 const result=await page.evaluate(async()=>{
  const [{createDrawing},{createEmitter},{SceneController},{mountSVG,renderSVG}]=await Promise.all([import('/src/vector-authoring.js'),import('/src/scene-graph.js'),import('/src/scene.js'),import('/src/svg.js')]);
  const doc=createDrawing();doc.packs.drawing.parts.push({id:'body',joint:'root',d:'M20 20H80V120H20Z',fill:'#ccaabb'});
  doc.emitters=[{...createEmitter('smoke','smoke'),actor:'character',rate:8,x:25,y:30},{...createEmitter('flame','fire'),actor:'character',x:40,y:80}];doc.lighting={enabled:true,emitter:'fire',showSource:true,shading:'cel'};
  const controller=new SceneController(doc),host=document.createElement('div');host.style.cssText='position:fixed;inset:0;width:640px;height:480px';document.body.append(host);
  const frame=t=>({...controller.frame(),time:t,effectsTime:t});
  const render=mountSVG(host,doc,frame(2)),nodes=[...host.querySelectorAll('[data-particle]')];
  const particle=()=>[...host.querySelectorAll('[data-particle]')].map(n=>[n.getAttribute('opacity'),n.getAttribute('transform'),n.getAttribute('fill')]);
  const visual=root=>[...root.querySelectorAll('[data-particle],[data-light-source],[data-floor-strength],[data-wall-strength],[data-surface],[data-surface] stop')].map(n=>['transform','opacity','fill','cx','cy','offset','stop-color'].map(a=>n.getAttribute(a)));
  let childChanges=0;const observer=new MutationObserver(records=>{childChanges+=records.filter(r=>r.type==='childList').length;});observer.observe(host,{subtree:true,childList:true});
  const original=particle();render.update(frame(3));const moved=particle();render.update(frame(2));const repeated=particle();render.update({...frame(900),effectsTime:2});const frozen=particle();
  const shifted=frame(4);shifted.actors[0].placement={x:42,y:80,rotation:20,scale:1.5};render.update(shifted);const anchor=host.querySelector('[data-emitter="smoke"]').getAttribute('transform');
  const mountedVisual=visual(host),exported=document.createElement('div');exported.innerHTML=renderSVG(doc,shifted);const exportedVisual=visual(exported),lightPosition=host.querySelector('[data-light-source]').getAttribute('transform');
  doc.actors[0].hidden=true;render.update(frame(5));const hidden=host.querySelector('[data-emitter="smoke"]').getAttribute('visibility'),actorDisplay=getComputedStyle(host.querySelector('[data-actor]')).display,artRect=host.querySelector('[data-part]').getBoundingClientRect(),emitterDisplay=getComputedStyle(host.querySelector('[data-emitter]')).display;
  doc.actors[0].hidden=false;render.update(frame(6));const reshown=getComputedStyle(host.querySelector('[data-actor]')).display;
  doc.emitters[1].enabled=false;render.update(frame(7));const shadowOff=[...host.querySelectorAll('[data-floor-strength],[data-wall-strength]')].every(n=>Number(n.getAttribute('opacity'))===0);
  await Promise.resolve();const same=nodes.every((n,i)=>n===host.querySelectorAll('[data-particle]')[i]);observer.disconnect();render.dispose();controller.dispose();
  return {original,moved,repeated,frozen,same,childChanges,anchor,hidden,mountedVisual,exportedVisual,lightPosition,actorDisplay,emitterDisplay,hiddenWidth:artRect.width,reshown,shadowOff};
 });
 assert.notDeepEqual(result.original,result.moved);assert.deepEqual(result.original,result.repeated);assert.deepEqual(result.original,result.frozen);assert.equal(result.same,true);assert.equal(result.childChanges,0);assert.equal(result.anchor,'translate(42 80) rotate(20) scale(1.5)');assert.equal(result.hidden,'hidden');assert.equal(result.actorDisplay,'none');assert.equal(result.emitterDisplay,'none');assert.equal(result.hiddenWidth,0);assert.equal(result.reshown,'inline');assert.equal(result.shadowOff,true);assert.deepEqual(result.mountedVisual,result.exportedVisual);
 const theta=20*Math.PI/180,x=42+1.5*(40*Math.cos(theta)-44*Math.sin(theta)),y=80+1.5*(40*Math.sin(theta)+44*Math.cos(theta));assert.equal(result.lightPosition,`translate(${x} ${y})`);
 console.log('Emitter browser checks passed: deterministic seeks, held effects time, actor and light anchors, mounted/export parity, hidden groups and stable particle nodes.');
} finally {await browser.close();}
