import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5184').replace(/\/$/,'');
const phone=process.env.MAP_PERF_PHONE==='1';
const viewport=phone?{width:390,height:844}:{width:1920,height:1080};
const deviceScaleFactor=Number(process.env.MAP_PERF_DPR|| (phone?2:1));
const throttle=Number(process.env.MAP_PERF_CPU_RATE||1);
const label=process.env.MAP_PERF_LABEL||'local';
assert.match(label,/^[\w-]+$/);
const browser=await chromium.launch({
  headless:true,...(process.platform==='win32'?{channel:'msedge'}:{}),
  args:['--disable-frame-rate-limit','--disable-gpu-vsync'],
});
const output='test-results/map-perf-'+label+'-'+Date.now();
await mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport,deviceScaleFactor,hasTouch:phone});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  if(throttle!==1){
    const session=await page.context().newCDPSession(page);
    await session.send('Emulation.setCPUThrottlingRate',{rate:throttle});
  }
  // Time only callbacks that paint the map canvas. Avoid querying stats on
  // every frame, since older builds perform a visibility search on each call.
  await page.addInitScript(()=>{
    const request=window.requestAnimationFrame.bind(window);
    let canvas,painted=false;
    const samples=[];
    for(const method of ['fillRect','clearRect']){
      const original=CanvasRenderingContext2D.prototype[method];
      CanvasRenderingContext2D.prototype[method]=function(x,y,w,h){
        if(this.canvas===canvas&&x===0&&y===0&&w===canvas.width&&h===canvas.height)painted=true;
        return original.call(this,x,y,w,h);
      };
    }
    window.requestAnimationFrame=callback=>request(now=>{
      painted=false;
      const start=performance.now();
      callback(now);
      if(painted)samples.push(performance.now()-start);
    });
    window.mapPerf={watch(value){canvas=value;},take(){return samples.splice(0);}};
  });
  await page.goto(base+'/demos.html#littlelands-map');
  await page.waitForFunction(()=>window.mapDemo||document.querySelector('#demo-status')?.textContent.startsWith('Could not'));
  await page.evaluate(()=>mapDemo.view.ready);
  await page.locator('#demo-fullscreen').click();
  const summary=await page.evaluate(async()=>{
    const view=mapDemo.view;
    mapPerf.watch(document.querySelector('#demo-art canvas'));
    const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>resolve(performance.now())));
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const stats=()=>view.stats?.()??{};
    const settled=(s,zoom)=>s.terrainCache!=null&&!(s.terrainCache.pending||s.sceneryCache?.pending)&&
      (s.camera?.zoom==null||Math.abs(s.camera.zoom-zoom)<.001);
    async function settle(zoom){
      const start=performance.now(),before=stats().drawnFrames;
      view.zoomTo(zoom);
      await nextFrame();
      do{
        const s=stats();
        if(settled(s,zoom)&&(before==null||s.drawnFrames>before))return {ms:performance.now()-start,timedOut:false};
        await sleep(20);
      }while(performance.now()-start<8000);
      return {ms:performance.now()-start,timedOut:true};
    }
    function distribution(samples){
      if(!samples.length)return {count:0,p50:null,p95:null,max:null,over16_7:0};
      samples.sort((a,b)=>a-b);
      const at=p=>samples[Math.ceil(samples.length*p)-1];
      return {count:samples.length,p50:at(.5),p95:at(.95),max:at(1),over16_7:samples.filter(ms=>ms>16.7).length};
    }
    async function measure(action,ms){
      mapPerf.take();
      const before=stats().drawnFrames,intervals=[];
      let previous=await nextFrame();
      const start=previous;
      do{
        action(Math.min(1,(previous-start)/ms));
        const now=await nextFrame();
        intervals.push(now-previous);
        previous=now;
      }while(previous-start<ms);
      const after=stats().drawnFrames,paint=mapPerf.take();
      return {raf:distribution(intervals),render:distribution(paint),drawnFrames:before==null||after==null?paint.length:after-before};
    }
    const home=mapDemo.map.actors[0];
    view.panTo(home.x,home.y);
    const initial=await settle(1);
    const idle=await measure(()=>{},3000);
    const pan=p=>view.panTo(home.x+Math.sin(p*Math.PI*2)*8,home.y+Math.sin(p*Math.PI*4)*4);
    await measure(pan,1500);
    const warmPan=await measure(pan,1500);
    const startZoom=await settle(5);
    const sweep=await measure(p=>view.zoomTo(5-4.55*(1-Math.abs(2*p-1))),2400);
    view.zoomTo(5);
    await nextFrame();
    const zoomOut=await settle(.45);
    const zoomIn=await settle(2.5);
    const state=stats();
    mapDemo.pause();
    await nextFrame();
    const pausedIdle=await measure(()=>{},1000);
    return {renderer:state.renderer,backing:{width:state.backingWidth,height:state.backingHeight},
      initial,idle,warmPan,startZoom,sweep,zoomOut,zoomIn,pausedIdle};
  });
  if(process.env.MAP_PERF_SCREENSHOTS==='1'){
    await page.emulateMedia({reducedMotion:'reduce'});
    const river=await page.evaluate(()=>{
      const {map,view}=mapDemo;
      const home=map.actors[0];
      let distance=Infinity,river;
      map.terrain.forEach((terrain,i)=>{
        if(terrain!==2)return;
        const x=i%map.width+.5,y=Math.floor(i/map.width)+.5,d=Math.hypot(x-home.x,y-home.y);
        if(d<distance){distance=d;river={x,y};}
      });
      view.panTo(river.x,river.y);
      return river;
    });
    summary.screenshotCenter=river;
    for(const zoom of [1,2.5]){
      await page.evaluate(value=>mapDemo.view.zoomTo(value),zoom);
      await page.waitForFunction(value=>{
        const s=mapDemo.view.stats();
        return s.camera?.zoom===value&&!s.terrainCache?.pending&&!s.sceneryCache?.pending;
      },zoom,{timeout:15000});
      await page.locator('#demo-art').screenshot({path:output+'-zoom-'+zoom+'.png'});
    }
  }
  const result={base,label,browser:browser.version(),viewport,deviceScaleFactor,
    cpuThrottle:throttle,cpuThrottlingEmulated:throttle!==1,phoneViewportEmulated:phone,...summary,errors};
  const json=JSON.stringify(result,null,2);
  await writeFile(output+'.json',json+'\n');
  console.log(json);
  assert.deepEqual(errors,[]);
  if(process.env.MAP_PERF_ASSERT==='1'){
    assert.ok(summary.warmPan.render.p95!==null&&summary.warmPan.render.p95<=5.5,'Warm pan render p95 exceeds 5.5 ms');
    assert.ok(summary.sweep.raf.max<=12&&summary.sweep.render.max!==null&&summary.sweep.render.max<=12,'Zoom sweep exceeds 12 ms');
    for(const settle of [summary.zoomOut,summary.zoomIn])assert.ok(!settle.timedOut&&settle.ms<=500,'Zoom settling exceeds 500 ms');
  }
}finally{
  await browser.close();
}
