// Diagnostic: actual standalone game, including follow camera and slow-CPU emulation.
// CPU submission time excludes GPU completion. Emulation is not a phone benchmark.
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://localhost:5246').replace(/\/$/,''),label=process.env.MAP_PERF_LABEL||'current';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const results=[];
const percentile=(values,p)=>{const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.floor((a.length-1)*p)]:null;};
await fs.mkdir('test-results',{recursive:true});
try {
  for(const rate of [1,4]) {
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true});
    await page.routeWebSocket(/.*/,socket=>socket.close());
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(process.env.MAP_PERF_SNAPSHOT==='1'){
      for(const [url,file]of [['map-browser.js','map-perf-renderer.mjs'],['map-perf-art.mjs','map-perf-art.mjs'],['map-perf-chunks.mjs','map-perf-chunks.mjs'],['map-perf-terrain.mjs','map-perf-terrain.mjs']]){
        const body=await fs.readFile('.tmp/'+file,'utf8');
        await page.route('**/src/'+url+'*',r=>r.fulfill({contentType:'application/javascript',body}));
      }
    }
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate});
    await page.addInitScript(()=>{
      const raf=requestAnimationFrame;window.frameSamples=[];window.measuring=false;let active=null;
      for(const method of ['drawImage','fillRect']){const original=CanvasRenderingContext2D.prototype[method];CanvasRenderingContext2D.prototype[method]=function(...args){if(active&&this.canvas===window.perfCanvas)active.painted=true;return original.apply(this,args);};}
      window.requestAnimationFrame=function(callback){return raf.call(window,t=>{const start=performance.now(),previous=active,entry={t,painted:false};active=entry;try{return callback(t);}finally{entry.ms=performance.now()-start;active=previous;if(window.measuring&&entry.painted)window.frameSamples.push(entry);}});};
    });
    const start=Date.now();await page.goto(base+'/play.html');
    await page.waitForFunction(()=>window.mapPlay,{},{polling:100});
    await page.evaluate(()=>{window.perfCanvas=document.querySelector('#game canvas');});
    await page.waitForFunction(()=>{const s=mapPlay.view.stats();return s.art.requested>0&&s.art.loaded===s.art.requested&&!s.terrainCache.pending&&!s.sceneryCache?.pending;},{},{timeout:60000,polling:100});
    const settledMs=Date.now()-start;
    for(const mode of ['follow','pan','zoom']) {
      const result=await page.evaluate(async mode=>{
        const view=mapPlay.view;view.controller.cancel('hero');view.focusActor('hero');view.zoomTo(2.5);
        await new Promise(r=>setTimeout(r,300));
        const before=view.stats();frameSamples=[];measuring=true;
        let stop=false,operation;
        if(mode==='follow') operation=(async()=>{while(!stop){await view.moveTo('hero','village-chest',{gait:'run'}).catch(()=>{});if(!stop)await view.moveTo('hero','village-house',{gait:'run'}).catch(()=>{});}})();
        else {
          view.stopFollowing();const a=view.controller.actorPosition('hero'),start=performance.now();
          operation=new Promise(resolve=>{function change(now){if(stop){resolve();return;}const t=(now-start)/1000;if(mode==='pan')view.panTo(a.x+Math.sin(t*1.2)*8,a.y+Math.cos(t)*7);else view.zoomTo(2.5+Math.sin(t*1.2)*1.4);requestAnimationFrame(change);}requestAnimationFrame(change);});
        }
        await new Promise(r=>setTimeout(r,4000));stop=true;measuring=false;view.controller.cancel('hero');await operation;
        return{samples:frameSamples,before,after:view.stats()};
      },mode);
      const intervals=result.samples.slice(1).map((v,i)=>v.t-result.samples[i].t),durations=result.samples.map(v=>v.ms);
      const summary={rate,mode,settledMs,frames:durations.length,cpuMs:{p50:percentile(durations,.5),p95:percentile(durations,.95),max:Math.max(0,...durations)},intervalMs:{p50:percentile(intervals,.5),p95:percentile(intervals,.95)},over33ms:intervals.filter(v=>v>33.4).length,sceneryBuilds:result.after.sceneryBuilds-result.before.sceneryBuilds,terrainBuilds:result.after.terrainBuilds-result.before.terrainBuilds,stats:result.after,errors};
      results.push(summary);console.log(JSON.stringify(summary));
    }
    await page.screenshot({path:`test-results/map-play-perf-${label}-${rate}x.png`});
    await page.close();
  }
} finally {await browser.close();}
await fs.writeFile(`test-results/map-play-performance-${label}.json`,JSON.stringify({label,notes:'Actual play.html, portrait DPR2 on local desktop Chromium, 1x and 4x CPU slowdown. Not real mobile GPU measurements.',results},null,2));
