import {chromium} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.POSECRAFT_URL||'http://localhost:5246',rate=Number(process.env.MAP_CPU_RATE||1);
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),results=[];
try{
  for(const renderer of ['canvas2d','webgl2']){
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});
    await page.route('**/@vite/client',r=>r.fulfill({contentType:'application/javascript',body:'export function createHotContext(){return {on(){},accept(){},dispose(){}}}'}));
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    if(rate>1)await(await page.context().newCDPSession(page)).send('Emulation.setCPUThrottlingRate',{rate});
    const start=performance.now();await page.goto(base+'/play.html?renderer='+renderer);await page.waitForFunction(()=>window.mapPlay?.view);
    await page.evaluate(()=>mapPlay.view.ready);await page.waitForFunction(()=>{const s=mapPlay.view.stats();return !s.terrainCache.pending&&!s.sceneryCache.pending;},null,{timeout:120000});
    const startupMs=performance.now()-start;
    await page.evaluate(()=>{mapPlay.townLife?.dispose();for(const a of mapPlay.map.actors)mapPlay.view.controller.cancel(a.id);mapPlay.view.pause();});
    const samples=await page.evaluate(async()=>{
      const rows=[];for(let cycle=0;cycle<2;cycle++)for(const [from,to]of [[2.5,.65],[.65,2.5]])await new Promise(resolve=>{const start=performance.now();let previous;const step=now=>{const u=Math.min(1,(now-start)/1000);mapPlay.view.zoomTo(from+(to-from)*u);const s=mapPlay.view.stats();if(previous)rows.push({cycle,interval:now-previous,paint:s.paintMs,renderer:s.renderer});previous=now;if(u<1)requestAnimationFrame(step);else resolve();};requestAnimationFrame(step);});return rows;
    });
    await page.waitForFunction(()=>{const s=mapPlay.view.stats();return !s.terrainCache.pending&&!s.sceneryCache.pending;},null,{timeout:60000});
    const stats=await page.evaluate(()=>mapPlay.view.stats());
    const q=(values,p)=>{const a=values.sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)];};
    results.push({renderer,rate,startupMs,frames:samples.length,frameP95:q(samples.map(s=>s.interval),.95),frameMax:q(samples.map(s=>s.interval),1),paintP95:q(samples.map(s=>s.paint),.95),over50:samples.filter(s=>s.interval>50).length,warmFrameP95:q(samples.filter(s=>s.cycle===1).map(s=>s.interval),.95),warmPaintP95:q(samples.filter(s=>s.cycle===1).map(s=>s.paint),.95),stats,errors});
    assert.equal(stats.renderer,renderer,stats.rendererFallback);assert.deepEqual(errors,[]);await page.close();
  }
  await mkdir('test-results',{recursive:true});await writeFile(`test-results/map-renderer-comparison-${rate}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({stats,...r})=>({...r,gpu:stats.gpu}))));
}finally{await browser.close();}
