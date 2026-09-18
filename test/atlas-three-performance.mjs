import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5199').replace(/\/$/,''),warmup=20,count=90;
const summarize=values=>{const sorted=[...values].sort((a,b)=>a-b);return {samples:values.length,median:sorted[Math.floor(sorted.length*.5)],p95:sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*.95)-1)],mean:values.reduce((n,v)=>n+v,0)/values.length};};
const browser=await chromium.launch({headless:true,...process.platform==='win32'?{channel:'msedge'}:{}}),results=[];
try{
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['narrow-desktop',{width:390,height:844}]]){
  const page=await browser.newPage({viewport,deviceScaleFactor:1,reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.route('**/favicon.ico',r=>r.fulfill({status:204,body:''}));await page.goto(base+'/atlas-3d.html');await page.waitForFunction(()=>window.atlas3d?.snapshot().ready);await page.locator('#mode').selectOption('recorded');await page.waitForFunction(()=>atlas3d.snapshot().ready&&atlas3d.snapshot().mode==='recorded');
  for(const comparison of [true,false]){
   await page.locator('#compare').setChecked(comparison);await page.locator('#reset').click();await page.waitForFunction(()=>atlas3d.snapshot().ready);await page.locator('#play').click();
   const trace=await page.evaluate(async({warmup,count})=>new Promise((resolve,reject)=>{
    const values=[],rafIntervals=[];let delivered=0,seen=-1,lastDelivery=null,lastRAF=null,stopped=false;
    const timeout=setTimeout(()=>{stopped=true;reject(Error('Performance sampling did not receive enough frames within90 seconds.'));},90000);
    const collect=now=>{if(stopped)return;const state=atlas3d.snapshot();if(state.errors.length){stopped=true;clearTimeout(timeout);reject(Error(state.errors.join('; ')));return;}
     if(delivered>warmup&&lastRAF!==null)rafIntervals.push(now-lastRAF);lastRAF=now;
     if(state.frameId!==seen&&state.ready){seen=state.frameId;delivered++;if(delivered>warmup)values.push({frame:state.frameId,time:state.time,...state.timing,deliveryMs:lastDelivery===null?0:now-lastDelivery,three:state.three});lastDelivery=now;}
     if(values.length===count){stopped=true;clearTimeout(timeout);resolve({values,rafIntervals,devicePixelRatio});return;}requestAnimationFrame(collect);
    };requestAnimationFrame(collect);
   }),{warmup,count});
   await page.locator('#play').click();if(errors.length)throw Error(errors.join('; '));
   const summary=Object.fromEntries(['threeMs','referenceMs','simulationMs','deliveryMs'].map(key=>[key,summarize(trace.values.map(v=>v[key]))]));results.push({name,viewport,comparison,devicePixelRatio:trace.devicePixelRatio,warmupFrames:warmup,measuredFrames:count,summary,rafIntervalMs:summarize(trace.rafIntervals),lastRendererStats:trace.values.at(-1).three,trace:trace.values});
  }await page.close();
 }
 await fs.mkdir('test-results',{recursive:true});const report={browser:await browser.version(),headless:true,platform:process.platform,measurement:'CPU update/submission and observed frame delivery. No GPU timer queries, physical phone or battery measurements. Narrow viewport is the same desktop browser.',results};await fs.writeFile('test-results/atlas-three-performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify({browser:report.browser,measurement:report.measurement,results:results.map(({name,comparison,summary,lastRendererStats})=>({name,comparison,summary,drawCalls:lastRendererStats.calls,triangles:lastRendererStats.triangles}))},null,2));
}finally{await browser.close();}
