import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1000,height:800}}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());
 page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/play.html');
 await page.waitForFunction(()=>window.mapPlay?.view);
 await page.evaluate(()=>mapPlay.view.ready);
 await page.waitForFunction(()=>{const stats=mapPlay.view.stats(),art=stats.art;return art?.loaded===art?.requested&&!stats.terrainCache?.pending&&!stats.sceneryCache?.pending;},null,{timeout:60000});
 const art=await page.evaluate(()=>mapPlay.view.stats().art);
 assert.equal(art.failed,0);assert.equal(art.loaded,art.requested);

 const falls=await page.evaluate(async()=>{
  const [{cliffFaces},{cliffDrawProps,drawCliffWater}]=await Promise.all([import('/src/map-cliffs.js'),import('/src/map-cliff-renderer.js')]);
  const faces=cliffFaces(mapPlay.map).filter(face=>face.edge==='south'&&mapPlay.map.terrain[face.y*mapPlay.map.width+face.x]===2);
  const transitions=[...new Set(faces.map(face=>`${face.heightOffset}:${face.neighborHeightOffset}`))].sort();
  const props=cliffDrawProps(mapPlay.map).filter(prop=>prop.cliffFace.edge==='south'&&mapPlay.map.terrain[prop.cliffFace.y*mapPlay.map.width+prop.cliffFace.x]===2);
  const bounds=props.reduce((result,prop)=>({x:Math.min(result.x,prop.cliffBounds.x),y:Math.min(result.y,prop.cliffBounds.y),right:Math.max(result.right,prop.cliffBounds.x+prop.cliffBounds.width),bottom:Math.max(result.bottom,prop.cliffBounds.y+prop.cliffBounds.height)}),{x:Infinity,y:Infinity,right:-Infinity,bottom:-Infinity});
  const canvas=document.createElement('canvas');canvas.width=Math.ceil(bounds.right-bounds.x)+8;canvas.height=Math.ceil(bounds.bottom-bounds.y)+8;
  const context=canvas.getContext('2d');context.translate(4-bounds.x,4-bounds.y);
  const rect={x:bounds.x-1,y:bounds.y-1,width:bounds.right-bounds.x+2,height:bounds.bottom-bounds.y+2};
  const render=(time,reduced=false)=>{context.save();context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,canvas.width,canvas.height);context.restore();return drawCliffWater(context,mapPlay.map,props,rect,time,{reduced});};
  const pixels=()=>{const data=context.getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261;for(let i=0;i<data.length;i+=17)hash=Math.imul(hash^data[i],16777619);return hash>>>0;};
  const visible0=render(0),frame0=pixels(),visible1=render(.3),frame1=pixels();render(0,true);const reduced0=pixels();render(.3,true);const reduced1=pixels();
  const offscreen=drawCliffWater(context,mapPlay.map,props,{x:1e6,y:1e6,width:10,height:10},1);
  return{transitions,visible0,visible1,frame0,frame1,reduced0,reduced1,offscreen};
 });
 assert.deepEqual(falls.transitions,['15:8','3:0','8:3']);
 assert.ok(falls.visible0>0);assert.equal(falls.visible1,falls.visible0);assert.notEqual(falls.frame0,falls.frame1);
 assert.equal(falls.reduced0,falls.reduced1);assert.equal(falls.offscreen,0);

 await page.evaluate(()=>{const cx=Math.floor(mapPlay.map.width/2),cy=Math.floor(mapPlay.map.height/2);mapPlay.view.zoomTo(1.5);mapPlay.view.panTo(cx+31,cy-14);});
 await page.waitForTimeout(700);
 await page.waitForFunction(()=>{const stats=mapPlay.view.stats();return !stats.terrainCache?.pending&&!stats.sceneryCache?.pending;},{},{timeout:60000});
 await mkdir('test-results',{recursive:true});
 await page.screenshot({path:'test-results/map-cliff-valley-browser.png'});

 const climb=await page.evaluate(async()=>{
  const controller=mapPlay.view.controller,ridge=mapPlay.map.props.find(prop=>prop.id==='showcase-ridge');
  const endpoints=ridge.traversal.endpoints.map(point=>({x:point.x+ridge.x,y:point.y+ridge.y})).sort((a,b)=>b.y-a.y),actor=controller.actors.get('hero');
  Object.assign(actor,{x:endpoints[0].x,y:endpoints[0].y+1.2});controller.indexActor(actor);mapPlay.view.focusActor('hero');mapPlay.view.play();
  await mapPlay.view.moveTo('hero','showcase-ridge');
  const landed=controller.actorPosition('hero'),cx=Math.floor(mapPlay.map.width/2),cy=Math.floor(mapPlay.map.height/2);
  await mapPlay.view.moveTo('hero',{x:cx+35.5,y:cy-8.5});
  const walked=controller.actorPosition('hero'),[{groundHeight},{terrainHeightOffset}]=await Promise.all([import('/src/map.js'),import('/src/map-cliffs.js')]);
  return{landed,walked,landedHeight:groundHeight(mapPlay.map,landed),walkedHeight:groundHeight(mapPlay.map,walked),landedOffset:terrainHeightOffset(mapPlay.map,landed),walkedOffset:terrainHeightOffset(mapPlay.map,walked)};
 });
 assert.equal(climb.landedOffset,3,JSON.stringify(climb));assert.equal(climb.walkedOffset,3,JSON.stringify(climb));assert.ok(climb.walked.y<climb.landed.y);

 await page.setViewportSize({width:390,height:844});
 await page.evaluate(()=>{const cx=Math.floor(mapPlay.map.width/2),cy=Math.floor(mapPlay.map.height/2);mapPlay.view.zoomTo(1.5);mapPlay.view.panTo(cx+31,cy-14);});
 await page.waitForTimeout(500);
 await page.waitForFunction(()=>{const stats=mapPlay.view.stats();return !stats.terrainCache?.pending&&!stats.sceneryCache?.pending;},{},{timeout:60000});
 await page.screenshot({path:'test-results/map-cliff-valley-browser-mobile.png'});
 assert.deepEqual(errors,[]);
 console.log('Passed: cliff assets, three waterfall levels, animated and reduced water, culling, climb, plateau walk, desktop and mobile renders.');
 await page.evaluate(()=>{mapPlay.townLife?.dispose();mapPlay.view.dispose();});
}finally{await browser.close();}
