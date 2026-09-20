// Diagnostic only: hardware timings are recorded, never pass/fail thresholds.
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5251').replace(/\/$/,''),label=process.env.MAP_PERF_LABEL||'baseline';
await fs.mkdir('.tmp',{recursive:true});await fs.mkdir('test-results',{recursive:true});
const revision=process.env.MAP_PERF_REV;
const readSource=file=>revision?execFileSync('git',['-c','safe.directory=C:/apps/posecraft','show',`${revision}:${file}`],{encoding:'utf8'}):fs.readFile(file,'utf8');
const source=await readSource('src/map-browser.js'),artSource=await readSource('src/map-art.js'),chunksSource=source.includes("'./map-terrain-chunks.js'")?await readSource('src/map-terrain-chunks.js'):'',terrainSource=chunksSource||source.includes("'./map-terrain.js'")?await readSource('src/map-terrain.js'):'',hash=crypto.createHash('sha256').update(source+artSource+terrainSource+chunksSource).digest('hex'),mapVariant=process.env.MAP_PERF_MAP||'flat72';
await fs.writeFile('.tmp/map-perf-renderer.mjs',source.replace(/(from\s+['"])\.\//g,'$1../src/').replace("'../src/map-art.js'","'./map-perf-art.mjs'").replace("'../src/map-terrain.js'","'./map-perf-terrain.mjs'").replace("'../src/map-terrain-chunks.js'","'./map-perf-chunks.mjs'"));
await fs.writeFile('.tmp/map-perf-art.mjs',artSource.replace(/(from\s+['"])\.\//g,'$1../src/'));
if(terrainSource)await fs.writeFile('.tmp/map-perf-terrain.mjs',terrainSource.replace(/(from\s+['"])\.\//g,'$1../src/'));
if(chunksSource)await fs.writeFile('.tmp/map-perf-chunks.mjs',chunksSource.replace(/(from\s+['"])\.\//g,'$1../src/').replace("'../src/map-terrain.js'","'./map-perf-terrain.mjs'"));
await fs.writeFile('.tmp/map-perf.html','<!doctype html><html><head><base href="/"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body,#host{margin:0;width:100%;height:100%;overflow:hidden}#host{position:relative}</style></head><body><div id="host"></div></body></html>');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),results=[];
const configs=[{name:'portrait-fullscreen',viewport:{width:390,height:844},deviceScaleFactor:2},{name:'desktop-fullscreen',viewport:{width:1366,height:900},deviceScaleFactor:1}];
if(process.env.MAP_PERF_DPR2==='1')configs.push({name:'desktop-fullscreen-dpr2',viewport:{width:1366,height:900},deviceScaleFactor:2});
try{
  for(const config of configs.filter(config=>!process.env.MAP_PERF_ONLY||config.name.includes(process.env.MAP_PERF_ONLY))){
    const context=await browser.newContext(config),page=await context.newPage();
    await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:'export {};'}));
    await page.addInitScript(()=>{
      const original=requestAnimationFrame,drawImage=CanvasRenderingContext2D.prototype.drawImage,fillRect=CanvasRenderingContext2D.prototype.fillRect;
      let active=null;window.paintSamples=[];window.measure=false;
      CanvasRenderingContext2D.prototype.drawImage=function(...args){if(active&&this.canvas===window.perfCanvas)active.draws++;return drawImage.apply(this,args);};
      CanvasRenderingContext2D.prototype.fillRect=function(...args){if(active&&this.canvas===window.perfCanvas)active.fills++;return fillRect.apply(this,args);};
      window.requestAnimationFrame=function(callback){return original.call(window,time=>{const previous=active,entry={timestamp:time,draws:0,fills:0},start=performance.now();active=entry;try{return callback(time);}finally{entry.duration=performance.now()-start;active=previous;if(window.measure&&(entry.draws||entry.fills))window.paintSamples.push(entry);}});};
    });
    await page.goto(base+'/.tmp/map-perf.html');
    await page.evaluate(async mapVariant=>{
      const [{mountMap},{createWoodlandMap}]=await Promise.all([import('/.tmp/map-perf-renderer.mjs'),import('/examples/woodland-map.js')]);
      const map=createWoodlandMap({seed:2026,width:128,height:128,elevation:mapVariant!=='flat72'});if(mapVariant==='flat72')map.tileSize={width:72,height:36};
      window.coldStart=performance.now();window.perfMap=mountMap(document.querySelector('#host'),map);window.perfCanvas=document.querySelector('canvas');await perfMap.ready;await perfMap.controller.ready;
    },mapVariant);
    let coldSettled=true;try{await page.waitForFunction(()=>perfMap.stats().art?.loaded===15&&perfMap.stats().terrainCache?.pending!==true,{},{timeout:10000});}catch{coldSettled=false;console.log(JSON.stringify({config,coldSettleTimeout:true,stats:await page.evaluate(()=>perfMap.stats())}));}
    const coldSettleMs=await page.evaluate(()=>performance.now()-coldStart);
    await page.screenshot({path:`test-results/map-perf-${label}-${config.name}.png`});
    for(const mode of ['idle','moving','panning']){
      const sample=await page.evaluate(async mode=>{
        const duration=mode==='idle'?1000:5000;window.paintSamples=[];window.measure=true;
        let stop=false,operation;
        if(mode==='moving')operation=(async()=>{while(!stop){await perfMap.moveTo('hero','village-chest').catch(()=>{});if(stop)break;await perfMap.moveTo('hero','village-house').catch(()=>{});}})();
        if(mode==='panning'){
          const start=performance.now();operation=new Promise(resolve=>{function pan(now){const t=(now-start)/1000;perfMap.panTo(64+Math.sin(t*.9)*6,64+Math.cos(t*.7)*5);if(!stop)requestAnimationFrame(pan);else resolve();}requestAnimationFrame(pan);});
        }
        await new Promise(resolve=>setTimeout(resolve,duration));stop=true;window.measure=false;if(mode==='moving')perfMap.controller.cancel('hero');await operation;
        return{samples:paintSamples,stats:perfMap.stats(),elapsed:duration};
      },mode);
      const durations=sample.samples.map(s=>s.duration).sort((a,b)=>a-b),draws=sample.samples.map(s=>s.draws).sort((a,b)=>a-b),intervals=sample.samples.slice(1).map((s,i)=>s.timestamp-sample.samples[i].timestamp).sort((a,b)=>a-b);
      const percentile=(a,p)=>a.length?a[Math.min(a.length-1,Math.floor((a.length-1)*p))]:null;
      const result={config,mode,coldSettled,coldSettleMs,frames:durations.length,submissionMs:{p50:percentile(durations,.5),p95:percentile(durations,.95),max:durations.at(-1)||null},frameIntervalMs:{p50:percentile(intervals,.5),p95:percentile(intervals,.95)},drawImages:{p50:percentile(draws,.5),p95:percentile(draws,.95)},...sample.stats};results.push(result);console.log(JSON.stringify(result));
    }
    await context.close();
  }
}finally{await browser.close();}
await fs.writeFile(`test-results/map-render-performance-${label}.json`,JSON.stringify({rendererHash:hash,revision:revision||'working-tree',label,mapVariant,notes:'Local headless desktop Chromium. RAF CPU callback time includes Canvas submission and movement update, not GPU completion. Fullscreen portrait DPR2 is emulation, not a real phone measurement.',results},null,2));
