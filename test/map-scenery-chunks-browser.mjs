import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/scenery-cache-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'}));await page.goto(base+'/scenery-cache-fixture');
  const result=await page.evaluate(async()=>{
    const {createMapSceneryChunks}=await import('/src/map-scenery-chunks.js'),{projectMap}=await import('/src/map.js');
    const props=[{id:'chest',kind:'chest',x:5,y:5,width:1,height:1},...Array.from({length:48},(_,i)=>({id:`rock-${i}`,kind:'rock',x:2+i%12*4,y:2+Math.floor(i/12)*9,width:1,height:1}))];
    const map={format:'posecraft-map',version:1,id:'cache',name:'Cache',seed:1,width:64,height:64,tileSize:{width:64,height:32},terrain:Array(4096).fill(0),props,actors:[]};
    const drawShadow=(ctx,p)=>{const q=projectMap(map,{x:p.x+.5,y:p.y+.5});ctx.fillStyle='#2228';ctx.fillRect(q.x-14,q.y-4,28,8);};
    let propDraws=0;
    const drawProp=(ctx,p,state)=>{propDraws++;const q=projectMap(map,{x:p.x+.5,y:p.y+.5});ctx.fillStyle=state?.opened?'#f22':'#28f';ctx.fillRect(q.x-10,q.y-24,20,24);};
    const scene=createMapSceneryChunks(map,document,{drawShadow,drawProp}),canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d'),q=projectMap(map,{x:5.5,y:5.5}),rect={x:q.x-60,y:q.y-60,width:120,height:120};
    const paint=(objects,budgetMs)=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,512,512);ctx.setTransform(1,0,0,1,-rect.x,-rect.y);scene.draw(ctx,rect,objects,{scale:4,viewportPixels:512*512,budgetMs});};
    paint({},0);const fallback=scene.stats(),closed=[...ctx.getImageData(Math.floor(q.x-rect.x),Math.floor(q.y-rect.y-10),1,1).data];
    paint({},100);const built=scene.stats();paint({},100);const reused=scene.stats();
    paint({chest:{opened:true}},0);const changed=scene.stats(),opened=[...ctx.getImageData(Math.floor(q.x-rect.x),Math.floor(q.y-rect.y-10),1,1).data];paint({chest:{opened:true}},100);const rebuilt=scene.stats();
    const beforeLodDraws=propDraws;
    scene.draw(ctx,rect,{chest:{opened:true}},{scale:1,viewportPixels:512*512,budgetMs:0});
    const lod=scene.stats(),lodPropDraws=propDraws-beforeLodDraws,lodOpened=[...ctx.getImageData(Math.floor(q.x-rect.x),Math.floor(q.y-rect.y-10),1,1).data];
    ctx.setTransform(1,0,0,1,0,0);scene.draw(ctx,scene.worldBounds,{}, {scale:8,viewportPixels:1,budgetMs:0});const bounded=scene.stats();
    scene.draw(ctx,{x:100000,y:100000,width:100,height:100},{},{scale:1,viewportPixels:1,budgetMs:0});const empty=scene.stats();scene.dispose();
    return{fallback,built,reused,changed,rebuilt,lod,lodPropDraws,lodOpened,bounded,empty,closed,opened,released:scene.stats().pixels===0};
  });
  assert.ok(result.fallback.fallbackDraws>0,'A cold chunk receives a complete retained coarse image');
  assert.ok(result.closed[2]>result.closed[0]);assert.ok(result.opened[0]>result.opened[2]);
  assert.ok(result.built.builds>0);assert.equal(result.reused.builds,result.built.builds,'Camera-only redraw reuses retained chunks');
  assert.equal(result.changed.builds,result.built.builds,'State fallback stays correct before rebuild');assert.ok(result.rebuilt.builds>result.built.builds,'Changed object state rebuilds affected chunks');
  assert.ok(result.lod.lodReuses>0,'Zoom out downsamples completed scenery');assert.equal(result.lodPropDraws,0,'Warm zoom out does not paint individual props again');assert.ok(result.lodOpened[0]>result.lodOpened[2],'Downsampled scenery preserves opened chest state');
  assert.ok(result.bounded.pixels<=result.bounded.maxPixels,'Detail and coarse caches share the memory budget');
  assert.ok(result.bounded.workingSetPixels<=result.bounded.maxPixels);assert.ok(result.bounded.rasterScale<8,'Wide views lower cache resolution to remain bounded');
  assert.equal(result.empty.visibleChunks,0);assert.ok(result.empty.chunks<=result.bounded.chunks);assert.equal(result.released,true);assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,reusedBuilds:result.reused.builds,stateBuilds:result.rebuilt.builds,boundedScale:result.bounded.rasterScale,fallbackDraws:result.fallback.fallbackDraws}));
}finally{await browser.close();}
