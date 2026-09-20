import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=process.env.POSECRAFT_URL||'http://localhost:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket(/.*/,s=>s.close());
 await page.route('**/animal-picking-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body,#map{margin:0;width:100%;height:100%}</style><div id="map"></div>'}));
 await page.goto(base+'/animal-picking-fixture');
 for(const species of ['sheep','cow','chicken'])for(const zoom of [1,3]){
  await page.evaluate(async({species,zoom})=>{
   window.view?.dispose();
   const [{mountMap},{farmImages},{drawMapNpc,npcActorBounds},{projectMap}]=await Promise.all([import('/src/map-browser.js'),import('/examples/farm-assets.js'),import('/src/map-npc-renderer.js'),import('/src/map.js')]);
   const id='farm-'+species;
   const animal={id:'animal',x:9,y:7.2,speed:2,appearance:{kind:'livestock',image:id},npc:{species,home:{x:2,y:2,width:12,height:12}}};
   const map={format:'posecraft-map',version:1,id:'picking',name:'Animal picking',width:20,height:20,seed:1,tileSize:{width:36,height:18},navigation:{mode:'continuous',radius:.12},terrain:Array(400).fill(0),actors:[{id:'hero',x:6,y:6.5,speed:7},animal],props:[{id:'fence',kind:'decoration',x:4,y:8,width:8,height:1,fence:{nodes:[{x:0,y:0},{x:8,y:0}],links:[[0,1]]},traversal:{kind:'vault',activation:'click',height:.55,endpoints:[{x:4,y:-.9},{x:4,y:.9}]}}],art:{images:{[id]:farmImages[id]}}};
   window.events=[];window.failures=[];window.view=mountMap(document.querySelector('#map'),map,{execution:'main',onEvent:e=>events.push(e),onError:e=>{if(e.name!=='AbortError')failures.push(e.message);}});
   await view.ready;view.zoomTo(zoom);view.panTo(8,7);
   // Locate an opaque body pixel using the same pose renderer, with no shadow.
   const image=new Image();image.src=farmImages[id].src;await image.decode();
   const actor=view.controller.actorPosition('animal'),bounds=npcActorBounds(map,actor,animal),canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.width);canvas.height=Math.ceil(bounds.height);
   const c=canvas.getContext('2d');c.translate(-bounds.x,-bounds.y);drawMapNpc(c,map,actor,animal,false,{shadow:false,art:{image:()=>image}});
   const data=c.getImageData(0,0,canvas.width,canvas.height).data;let pixel;
   for(let y=Math.floor(canvas.height*.2);y<canvas.height*.65&&!pixel;y++)for(let x=Math.floor(canvas.width*.35);x<canvas.width*.65;x++)if(data[(y*canvas.width+x)*4+3]>200){pixel={x:bounds.x+x+.5,y:bounds.y+y+.5};break;}
   if(!pixel)throw Error('No opaque animal body pixel');
   const ground=projectMap(map,actor),screen=view.mapToScreen(actor);window.animalTap={x:screen.x+(pixel.x-ground.x)*zoom,y:screen.y+(pixel.y-ground.y)*zoom};
   const rail=projectMap(map,{x:10,y:8,z:.62}),base=projectMap(map,{x:10,y:8}),railScreen=view.mapToScreen({x:10,y:8});window.railTap={x:railScreen.x+(rail.x-base.x)*zoom,y:railScreen.y+(rail.y-base.y)*zoom};
  },{species,zoom});
  await page.waitForTimeout(150);
  const ground={x:7,y:6.8},point=await page.evaluate(p=>view.mapToScreen(p),ground);
  await page.touchscreen.tap(point.x,point.y);
  let command=await page.evaluate(()=>events.find(e=>e.type==='map.move.started'));
  assert.ok(Math.hypot(command.target.x-ground.x,command.target.y-ground.y)<.02,`${species}@${zoom}: grass inside fence bounds must remain ground`);
  await page.waitForFunction(()=>!view.controller.active.size);
  await page.evaluate(()=>events.length=0);
  const tap=await page.evaluate(()=>animalTap);await page.touchscreen.tap(tap.x,tap.y);
  command=await page.evaluate(()=>events.find(e=>e.type==='map.move.started'));
  assert.ok(command&&typeof command.target==='object',`${species}@${zoom}: body should target an approach point`);
  assert.ok(Math.abs(Math.hypot(command.target.x-9,command.target.y-7.2)-(species==='chicken'?.4:.7))<.02);
  assert.ok(command.target.y<8,'Animal click must not choose the other side of the fence');
  await page.waitForFunction(()=>!view.controller.active.size);
  assert.equal(await page.evaluate(()=>events.some(e=>e.type==='map.traversal.started')),false);
  await page.waitForTimeout(350);await page.evaluate(()=>events.length=0);
  const rail=await page.evaluate(()=>railTap);await page.touchscreen.tap(rail.x,rail.y);
  command=await page.evaluate(()=>events.find(e=>e.type==='map.move.started'));
  assert.equal(command?.target,'fence','The actual foreground rail still selects fence traversal');
  assert.deepEqual(await page.evaluate(()=>failures),[]);
 }
 assert.deepEqual(errors,[]);console.log('Passed: sheep/cow/chicken body picking, nearby grass and actual rails on mobile at two zoom levels.');
}finally{await browser.close();}
