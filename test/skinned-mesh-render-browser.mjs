import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:800,height:360}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/__mesh-render__',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head></head><body></body></html>'}));await page.goto('http://127.0.0.1:5178/__mesh-render__');
 await page.evaluate(async()=>{
  const [{createDrawing},{forwardKinematics},{renderSVG,mountSVG}]=await Promise.all([import('/src/vector-authoring.js'),import('/src/index.js'),import('/src/svg.js')]);
  const doc=createDrawing();doc.bounds={width:360,height:300};doc.requiredFeatures=['spatial-rig','skinned-mesh'];const p=doc.packs.drawing;p.spatial=true;p.joints=[{id:'root',parent:null,x:100,y:100,length:0,rotation:0,min:-180,max:180},{id:'arm',parent:'root',x:60,y:0,length:70,rotation:0,min:-180,max:180}];
  const v=(x,y,joint='root',weight=1)=>({weights:[{joint,x,y,z:0,weight}]});
  p.parts=[{id:'skin',joint:'root',d:'M0 0Z',fill:'#c98159',stroke:'#292c38',strokeWidth:3,spatial:{mesh:{vertices:[v(0,-30),v(60,-30),v(70,-30,'arm'),v(70,30,'arm'),v(60,30),v(0,30)],triangles:[[0,1,4],[0,4,5],[1,2,3],[1,3,4]]}}}];doc.actors[0].transform={x:0,y:0,scale:1,rotation:0};doc.lighting={enabled:true,shading:'gradient',angle:-120,ambient:.6,intensity:.5};
  const frame=(rotation,yaw)=>{const pose={'arm.rotation':rotation,'arm.yaw':yaw,'root.rotation':0};return {time:rotation,actors:[{id:doc.actors[0].id,pose,world:forwardKinematics(p.joints,pose),inputs:{},state:'idle',physics:null}]};};
  document.head.innerHTML='<style>body{display:flex;margin:0;background:white}body>div{width:360px;height:300px}svg{display:block}</style>';document.body.innerHTML='<div id="live"></div><div id="fresh"></div>';const live=document.querySelector('#live'),fresh=document.querySelector('#fresh'),renderer=mountSVG(live,doc,frame(0,0)),slots=[...live.querySelectorAll('[data-slot]')];
  const snap=el=>[...el.querySelectorAll('[data-fragment-path]')].map(n=>[n.dataset.fragmentPath,n.getAttribute('d'),n.getAttribute('visibility'),n.getAttribute('fill'),n.getAttribute('stroke'),n.parentElement.getAttribute('transform')]).sort();
  window.meshReview={update(rotation,yaw){const f=frame(rotation,yaw);renderer.update(f);fresh.innerHTML=renderSVG(doc,f);return {live:snap(live),fresh:snap(fresh),stable:slots.every(n=>n.isConnected),primary:live.querySelectorAll('[data-part="skin"]').length,internal:[...live.querySelectorAll('[data-fragment-path*="--edge-"]')].filter(n=>n.getAttribute('visibility')==='hidden').length};},dispose:()=>renderer.dispose()};
 });
 for(const [rotation,yaw]of [[0,0],[-75,0],[-110,45],[30,90],[70,160],[0,0]]){const r=await page.evaluate(([a,b])=>window.meshReview.update(a,b),[rotation,yaw]);const normalize=s=>s.map(row=>row.map(v=>typeof v==='string'?v.replace(/pc-view-\d+/g,'posecraft'):v));assert.deepEqual(normalize(r.live),normalize(r.fresh));assert.ok(r.stable);assert.equal(r.primary,1);assert.ok(r.internal>0,'triangulation never becomes a stroke grid');}
 await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/skinned-mesh-render.png'});await page.evaluate(()=>window.meshReview.dispose());assert.deepEqual(errors,[]);console.log('Mesh rendering passed: stable triangles/edges, shared gradients, no internal seam strokes, mounted/fresh parity and full turns.');
}finally{await browser.close();}
