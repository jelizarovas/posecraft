import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:700,height:550}}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tree-fence-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:700px;height:550px}</style><div id="map"></div>'}));
 await page.goto('http://localhost:5246/tree-fence-fixture');
 const results=[];
 for(const [name,y]of [['front',6],['behind',5]]){
  const result=await page.evaluate(async({y,name})=>{
   const {mountMap}=await import('/src/map-browser.js'),{farmImages}=await import('/examples/farm-assets.js');
   const {mapImageBounds}=await import('/src/map-art-layout.js');
   const tree={id:'tree',kind:'tree',art:'farm-poplar',x:5,y,width:1,height:1,collision:{shape:'circle',radius:.34}};
   const fence={id:'long-fence',kind:'decoration',x:2,y:5,width:13,height:1,fence:{nodes:[{x:.5,y:.75},{x:12.5,y:.75}],links:[[0,1]]}};
   const map={format:'posecraft-map',version:1,id:'depth',name:'Depth',seed:1,width:20,height:20,tileSize:{width:64,height:32},terrain:Array(400).fill(0),props:[tree,fence],actors:[],art:{images:farmImages}};
   async function render(props){
    window.view?.dispose();window.view=mountMap(document.querySelector('#map'),{...map,props},{execution:'main',autoplay:false});view.zoomTo(1.5);view.panTo(5.5,y-1);await view.ready;await new Promise(resolve=>setTimeout(resolve,500));
    return document.querySelector('#map canvas').getContext('2d').getImageData(0,0,700,550).data;
   }
   // Compare through the same chunk rasterization, not a differently sampled image.
   const baseline=await render([tree]);await render([tree,fence]);
   const canvas=document.querySelector('#map canvas'),ctx=canvas.getContext('2d'),reference=document.createElement('canvas');reference.width=canvas.width;reference.height=canvas.height;
   const image=new Image();image.src=farmImages['farm-poplar'].src;await image.decode();
   const origin=view.mapToScreen({x:0,y:0}),center=view.mapToScreen({x:5.5,y:y+.5}),bounds=mapImageBounds(map,{x:5.5,y:y+.5},farmImages['farm-poplar']);
   const rc=reference.getContext('2d');rc.setTransform(1.5,0,0,1.5,origin.x,origin.y);rc.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height);
   const expected=rc.getImageData(0,0,700,550).data,actual=ctx.getImageData(0,0,700,550).data;let samples=0,changed=0;
   for(let py=Math.max(0,Math.floor(center.y-90));py<Math.min(550,Math.ceil(center.y));py++)for(let px=Math.floor(center.x-6);px<Math.ceil(center.x+6);px++){
    const i=(py*700+px)*4;if(expected[i+3]<250)continue;samples++;if(Math.abs(baseline[i]-actual[i])+Math.abs(baseline[i+1]-actual[i+1])+Math.abs(baseline[i+2]-actual[i+2])>35)changed++;
   }
   return{name,samples,changed};
  },{y,name});
  results.push(result);await page.screenshot({path:`test-results/tree-fence-${name}.png`});
 }
 assert.ok(results[0].samples>200);assert.ok(results[0].changed/results[0].samples<.05,JSON.stringify(results));
 assert.ok(results[1].changed>20,'A nearer fence still hides part of a rear trunk');assert.deepEqual(errors,[]);
 console.log(results);await page.evaluate(()=>view.dispose());
}finally{await browser.close();}
