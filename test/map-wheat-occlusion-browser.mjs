import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/map-wheat-occlusion',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:640px;height:480px}</style><div id="map"></div>'}));
 await page.goto(base+'/map-wheat-occlusion');
 const proof=await page.evaluate(async()=>{
  const [{mountMap},{drawMapActor},{townImages},{woodlandArt},{loadMapArt}]=await Promise.all([import('/src/map-browser.js'),import('/src/map-character.js'),import('/examples/town-map.js'),import('/examples/woodland-map.js'),import('/src/map-art.js')]);
  const wheat={id:'wheat',kind:'decoration',art:'wheat',x:5,y:5,width:1,height:1,collision:{shape:'none'},occlusion:{mode:'low-foliage',lowerBodyFraction:.5}};
  const actor={id:'hero',x:5.5,y:5.5,speed:3,color:'#e65bb1'};
  const map={format:'posecraft-map',version:1,id:'wheat-proof',name:'Wheat proof',seed:1,width:12,height:12,tileSize:{width:72,height:36},terrain:Array(144).fill(0),navigation:{mode:'continuous',radius:.12},props:[wheat],actors:[actor],art:{...structuredClone(woodlandArt),images:{...structuredClone(woodlandArt.images),wheat:townImages.wheat}}};
  const art=loadMapArt(map,{document});await art.ready;const view=mountMap(document.querySelector('#map'),map,{execution:'main',reducedMotion:true});await view.ready;view.panTo(5.5,5.5);view.zoomTo(2.4);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const canvas=document.querySelector('#map canvas'),reference=document.createElement('canvas');reference.width=canvas.width;reference.height=canvas.height;
  const center=view.mapToScreen(actor),origin=view.mapToScreen({x:0,y:0}),ratio=canvas.width/640,context=reference.getContext('2d');context.setTransform(2.4*ratio,0,0,2.4*ratio,origin.x*ratio,origin.y*ratio);drawMapActor(context,map,view.controller.frame().actors[0],actor,true,{shadow:false,art});
  const source=context.getImageData(0,0,reference.width,reference.height).data,rendered=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
  let head=0,headMatch=0,legs=0,legCovered=0,pale=0;
  for(let y=0;y<canvas.height;y++)for(let x=0;x<canvas.width;x++){
   const i=(y*canvas.width+x)*4;if(source[i+3]!==255)continue;const delta=Math.abs(source[i]-rendered[i])+Math.abs(source[i+1]-rendered[i+1])+Math.abs(source[i+2]-rendered[i+2]);
   if(y<(center.y-100)*ratio){head++;if(delta<8)headMatch++;}
   if(y>=(center.y-18)*ratio){legs++;if(delta>30){legCovered++;if(Math.abs(rendered[i]-231)<20&&Math.abs(rendered[i+1]-244)<20&&Math.abs(rendered[i+2]-197)<20)pale++;}}
  }
  await view.moveTo('hero',{x:5.75,y:5.75},{gait:'walk'});window.wheatView=view;art.dispose();return{head,headMatch,legs,legCovered,pale};
 });
 assert.ok(proof.head>20&&proof.headMatch>400,`Wheat must leave the head intact: ${JSON.stringify(proof)}`);
 assert.ok(proof.legs>20&&proof.legCovered>20,`Real wheat artwork must cover lower-body pixels: ${JSON.stringify(proof)}`);
 // Tall-crop silhouette and its irregular boundary are checked against the
 // exact composited color in map-crop-height-browser.mjs.
 await page.screenshot({path:'test-results/map-wheat-occlusion.png'});await page.evaluate(()=>wheatView.dispose());assert.deepEqual(errors,[]);console.log(JSON.stringify(proof));
}finally{await browser.close();}
