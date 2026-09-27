import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256',throttle=Number(process.env.CPU_THROTTLE||1),name=process.env.PERF_REPORT||'current';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.addInitScript(theme=>localStorage.setItem('portfolio-theme',theme),process.env.NIGHT==='1'?'dark':'light');
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:throttle});
 await page.addInitScript(()=>{
  const metrics={frames:[],longFrames:[],longTasks:[]};window.routeMetrics=metrics;let previous=null;
  function frame(now){const moving=!!document.querySelector('[data-route-moving]');if(moving&&previous!==null)metrics.frames.push(now-previous);previous=moving?now:null;requestAnimationFrame(frame);}requestAnimationFrame(frame);
  for(const [type,key]of [['long-animation-frame','longFrames'],['longtask','longTasks']])if(PerformanceObserver.supportedEntryTypes.includes(type))new PerformanceObserver(list=>{for(const e of list.getEntries())metrics[key].push({duration:e.duration,startTime:e.startTime});}).observe({type,buffered:true});
 });
 const routes=['/contact','/projects','/stories','/','/contact','/'];
 const records=[];await page.goto(base);await page.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
 for(let round=0;round<2;round++)for(const href of routes){
  await page.evaluate(()=>{window.routeMetrics.frames=[];window.routeMetrics.longFrames=[];window.routeMetrics.longTasks=[];});
  const before=await page.evaluate(()=>performance.now());
  await page.locator(`.site-shell>header a[href="${href}"]`).filter({visible:true}).first().click();
  await page.waitForURL(url=>url.pathname===href);await page.waitForFunction(()=>!!document.querySelector('[data-route-moving]'));
  await page.waitForFunction(()=>!document.querySelector('.route-outgoing')&&!document.querySelector('[data-route-moving]'));
  const result=await page.evaluate(()=>window.routeMetrics);records.push({round,href,elapsedMs:await page.evaluate(()=>performance.now())-before,...result});
 }
 const samples=records.filter(r=>r.round===1).flatMap(r=>r.frames).sort((a,b)=>a-b),sum=a=>a.reduce((s,v)=>s+v,0);
 const report={device:'Host desktop, headless Edge, 1280x900',cpuThrottle:throttle,physicalPhone:false,phase:'six warmed real page transitions',p50FrameMs:samples[Math.floor(samples.length*.5)],p95FrameMs:samples[Math.floor(samples.length*.95)],over25ms:samples.filter(v=>v>25).length,frames:samples.length,longFrameCount:records.filter(r=>r.round===1).reduce((n,r)=>n+r.longFrames.length,0),longTaskMs:sum(records.filter(r=>r.round===1).flatMap(r=>r.longTasks.map(t=>t.duration))),records};
 await fs.mkdir('test-results/route-performance',{recursive:true});await fs.writeFile(`test-results/route-performance/${name}.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,records:undefined}));
}finally{await browser.close();}
