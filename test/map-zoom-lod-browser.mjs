import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const phase=process.env.POSECRAFT_LOD_PHASE||'before';
const cpuRate=Number(process.env.POSECRAFT_CPU_RATE||1);
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.setDefaultTimeout(60000);
 await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',error=>errors.push(error.message));
 if(cpuRate>1){const session=await context.newCDPSession(page);await session.send('Emulation.setCPUThrottlingRate',{rate:cpuRate});}
 await page.goto(base+'/play.html');await page.waitForFunction(()=>window.mapPlay?.view);await page.evaluate(()=>mapPlay.view.ready);
 await page.waitForFunction(()=>{const stats=mapPlay.view.stats(),art=stats.art;return art?.loaded===art?.requested&&!stats.terrainCache?.pending&&!stats.sceneryCache?.pending;},null,{timeout:60000});
 await page.evaluate(()=>{const cx=Math.floor(mapPlay.map.width/2),cy=Math.floor(mapPlay.map.height/2);mapPlay.view.stopFollowing();mapPlay.view.panTo(cx+30,cy-13);mapPlay.view.zoomTo(2.5);});
 await page.waitForTimeout(700);await page.waitForFunction(()=>{const s=mapPlay.view.stats();return !s.terrainCache?.pending&&!s.sceneryCache?.pending;},null,{timeout:60000});

 const before=await page.evaluate(()=>mapPlay.view.stats());
 const memoryBefore=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
 const samples=await page.evaluate(async()=>{
  const rows=[],animate=(from,to,duration,captureAt)=>new Promise(resolve=>{
   const started=performance.now();let previous=started,captured=false;
   const frame=now=>{const u=Math.min(1,(now-started)/duration),eased=u*u*(3-2*u);mapPlay.view.zoomTo(from+(to-from)*eased);const stats=mapPlay.view.stats(),terrain=stats.terrainCache??{},scenery=stats.sceneryCache??{};rows.push({time:now,interval:now-previous,zoom:stats.camera?.zoom,paintMs:stats.paintMs,terrainBuilds:stats.terrainBuilds,sceneryBuilds:stats.sceneryBuilds,terrainPending:!!terrain.pending,sceneryPending:!!scenery.pending,terrainPlaceholders:terrain.placeholders??terrain.placeholderTiles??null,sceneryPlaceholders:scenery.placeholders??null,terrainLod:terrain.lod??stats.terrainLod??null,staging:terrain.staging??0,swaps:terrain.swaps??0,resamples:terrain.resamples??0,previewBuilds:terrain.previewBuilds??0,tileBuilds:terrain.tileBuilds??0,lodReuses:scenery.lodReuses??0,coarseDraws:scenery.coarseDraws??0,coarsePixels:scenery.coarsePixels??0});previous=now;if(!captured&&captureAt&&u>=captureAt){captured=true;window.__zoomMidpoint=true;}if(u<1)requestAnimationFrame(frame);else resolve();};requestAnimationFrame(frame);
  });
  for(let cycle=0;cycle<2;cycle++){await animate(2.5,.65,900,.55);await new Promise(resolve=>setTimeout(resolve,250));await animate(.65,2.5,900);await new Promise(resolve=>setTimeout(resolve,250));}
  return rows;
 });
 // Re-run a short outward move so the screenshot records the transition rather than its endpoint.
 await page.evaluate(()=>new Promise(resolve=>{const start=performance.now(),step=now=>{const u=Math.min(1,(now-start)/450);mapPlay.view.zoomTo(2.5+(1.25-2.5)*u);if(u<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);}));
 await mkdir('test-results',{recursive:true});await page.screenshot({path:`test-results/map-zoom-lod-${phase}-zoomout.png`});
 await page.evaluate(()=>mapPlay.view.zoomTo(2.5));await page.waitForTimeout(700);
 await page.waitForFunction(()=>{const s=mapPlay.view.stats();return !s.terrainCache?.pending&&!s.sceneryCache?.pending;},null,{timeout:60000});
 await page.screenshot({path:`test-results/map-zoom-lod-${phase}-settled.png`});
 const after=await page.evaluate(()=>mapPlay.view.stats()),memoryAfter=await page.evaluate(()=>performance.memory?.usedJSHeapSize??null);
 const intervals=samples.map(row=>row.interval).slice(1).sort((a,b)=>a-b),paint=samples.map(row=>row.paintMs).filter(Number.isFinite).sort((a,b)=>a-b),quantile=(values,q)=>values[Math.min(values.length-1,Math.floor(values.length*q))]??null;
 const first=samples[0]??{},last=samples.at(-1)??{},delta=key=>(last[key]??0)-(first[key]??0);
 const report={phase,cpuRate,viewport:{width:390,height:844,deviceScaleFactor:2},frames:samples.length,rafMs:{median:quantile(intervals,.5),p95:quantile(intervals,.95),max:intervals.at(-1)??null,over50:intervals.filter(value=>value>50).length},paintMs:{median:quantile(paint,.5),p95:quantile(paint,.95),max:paint.at(-1)??null},builds:{terrain:(after.terrainBuilds??0)-(before.terrainBuilds??0),scenery:(after.sceneryBuilds??0)-(before.sceneryBuilds??0),tileBuilds:delta('tileBuilds'),previewBuilds:delta('previewBuilds')},terrainLod:{resamples:delta('resamples'),swaps:delta('swaps'),stagingPeak:Math.max(0,...samples.map(row=>row.staging))},sceneryLod:{lodReuses:delta('lodReuses'),coarseDraws:delta('coarseDraws'),coarsePixelsPeak:Math.max(0,...samples.map(row=>row.coarsePixels))},pendingFrames:{terrain:samples.filter(row=>row.terrainPending).length,scenery:samples.filter(row=>row.sceneryPending).length},placeholderPeak:{terrain:Math.max(0,...samples.map(row=>row.terrainPlaceholders??0)),scenery:Math.max(0,...samples.map(row=>row.sceneryPlaceholders??0))},lodValues:[...new Set(samples.map(row=>JSON.stringify(row.terrainLod)).filter(value=>value!==undefined))].map(value=>JSON.parse(value)),memory:{before:memoryBefore,after:memoryAfter,delta:memoryBefore===null||memoryAfter===null?null:memoryAfter-memoryBefore},art:after.art,errors};
 await writeFile(`test-results/map-zoom-lod-${phase}.json`,JSON.stringify(report,null,2));
 assert.equal(after.art.failed,0);assert.deepEqual(errors,[]);if(report.memory.after!==null){assert.ok(report.memory.after<512*1024*1024);assert.ok(report.memory.delta<128*1024*1024);}
 console.log(JSON.stringify(report));await page.evaluate(()=>{mapPlay.townLife?.dispose();mapPlay.view.dispose();});
}finally{await browser.close();}
