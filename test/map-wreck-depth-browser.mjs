import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';
const base=process.env.POSECRAFT_URL||'http://localhost:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:660,height:500}}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));await page.routeWebSocket(/.*/,socket=>socket.close());
 await page.route('**/wreck-depth-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:660px;height:500px}</style><div id="map"></div>'}));
 await page.goto(base+'/wreck-depth-fixture');await mkdir('test-results',{recursive:true});
 for(const [name,x,y,hidden]of [['near-side',4.6,6.05,false],['open-gap',6.7,5.5,false],['far-side',8,3.7,true]]){
  const result=await page.evaluate(async({x,y})=>{
   const {mountMap}=await import('/src/map-browser.js'),{woodlandArt}=await import('/examples/woodland-map.js'),{editorImages,propBrushes}=await import('/examples/map-editor-catalog.js');
   window.view?.dispose();
   const art=structuredClone(woodlandArt);Object.assign(art.images,editorImages);
   const boat={...structuredClone(propBrushes.find(p=>p.id==='shipwreck').prop),id:'wreck',x:4,y:4};
   const map={format:'posecraft-map',version:1,id:'wreck-depth',name:'Wreck depth',seed:1,width:16,height:16,tileSize:{width:64,height:32},navigation:{mode:'continuous',radius:.12},terrain:Array(256).fill(0),props:[boat],actors:[{id:'hero',x,y,speed:3}],art};
   window.view=mountMap(document.querySelector('#map'),map,{execution:'main',autoplay:false});view.zoomTo(2);view.panTo(6.4,5.4);await view.ready;
   await new Promise(resolve=>setTimeout(resolve,300));return view.stats();
  },{x,y});
  assert.equal(result.art.failed,0);assert.equal(result.maskedActors,hidden?1:0,name);
  await page.screenshot({path:`test-results/map-wreck-${name}.png`});
 }
 assert.deepEqual(errors,[]);console.log('Passed: original wreck art leaves near-side and gap actors visible; far-side silhouette remains.');
 await page.evaluate(()=>view.dispose());
}finally{await browser.close();}
