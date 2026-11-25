// Run against either checkout's dev server with POSECRAFT_URL. The timings
// cover Canvas2D submission and displayed frame intervals separately.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {woodlandArt} from '../examples/woodland-map.js';
import {townImages} from '../examples/town-map.js';
import {assertMap,projectMap} from '../src/map.js';
import {MapController} from '../src/map-runtime.js';
import {rendererResumeKey} from '../examples/map-play-settings.js';

const actors=[],props=[],bindings={};
const {idle,walk,run}=woodlandArt.actors.hero;
for(let row=0;row<6;row++){
  for(let col=0;col<8;col++){
    const id='actor-'+actors.length;
    const x=22+(col-3.5)*.9+(row-2.5)*1.5;
    const y=22-(col-3.5)*.9+(row-2.5)*1.5;
    actors.push({id,x,y,speed:3});
    bindings[id]={idle,walk,run};
    const prop={id:'prop-'+id,kind:'decoration',x:Math.floor(x),y:Math.floor(y),width:1,height:1,collision:{shape:'none'}};
    if(col<4){
      const short=col<2;
      props.push({...prop,art:short?'farm-vegetables':'wheat',occlusion:{mode:'low-foliage',lowerBodyFraction:short?.2:.5}});
    }else{
      props.push({...prop,x:prop.x+1,art:'birch'});
    }
    if(col===3)props.push({...prop,id:'short-'+id,art:'farm-vegetables',occlusion:{mode:'low-foliage',lowerBodyFraction:.2}});
  }
}
const draft={
  format:'posecraft-map',version:1,id:'crowd-diagnostic',name:'Crowd diagnostic',
  width:44,height:44,seed:19,tileSize:{width:64,height:32},terrain:Array(44*44).fill(0),props,actors,
  art:{images:{...woodlandArt.images,wheat:townImages.wheat,'farm-vegetables':townImages['farm-vegetables']},actors:bindings,terrain:{grass:'meadow'}},
};
assertMap(draft);
const controller=new MapController(draft,{execution:'main'});
const snapshot={
  format:'posecraft-map-view-state',version:1,scene:controller.snapshot(),
  camera:{...projectMap(draft,{x:22,y:21}),zoom:1},
};
controller.dispose();

const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5246';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:960,height:640},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.routeWebSocket(/.*/,socket=>socket.close());
  await page.addInitScript(({map,snapshot,resumeKey})=>{
    localStorage.setItem('posecraft-map-editor-draft-v1',JSON.stringify(map));
    localStorage.setItem('posecraft-map-play-settings-v1',JSON.stringify({reducedMotion:true}));
    // Open directly at the measured zoom so asynchronous scenery preparation
    // cannot retain different resolutions from the initial play camera.
    sessionStorage.setItem(resumeKey,JSON.stringify({renderer:'canvas2d',path:'/play.html',draft:true,snapshot}));
  },{map:draft,snapshot,resumeKey:rendererResumeKey});
  await page.goto(new URL('/play.html?draft=1&renderer=canvas2d',base).href);
  await page.waitForFunction(()=>window.mapPlay?.map.id==='crowd-diagnostic');
  await page.evaluate(()=>mapPlay.view.ready);
  await page.waitForFunction(()=>{
    const s=mapPlay.view.stats();
    return s.visibleActors===48&&s.maskedActors===48&&s.art.loaded===s.art.requested&&!s.terrainCache.pending&&!s.sceneryCache.pending;
  },null,{timeout:45000});
  const result=await page.evaluate(async()=>{
    const {view}=mapPlay, paints=[],intervals=[];
    const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
    let previous=await nextFrame();
    for(let i=0;i<84;i++){
      const phase=(i%42)*2*Math.PI/42;
      view.panTo(22+Math.cos(phase)*.7,21+Math.sin(phase)*.7);
      const now=await nextFrame();
      if(i>=12){paints.push(view.stats().paintMs);intervals.push(now-previous);}
      previous=now;
    }
    const stats=view.stats();
    const proto=CanvasRenderingContext2D.prototype,drawImage=proto.drawImage;
    let imageDraws=0;
    // Count one extra settled frame outside the timing samples.
    try{
      proto.drawImage=function(...args){imageDraws++;return drawImage.apply(this,args);};
      view.panTo(22,21);
      await nextFrame();
    }finally{proto.drawImage=drawImage;}
    const canvas=document.querySelector('#game canvas');
    const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
    let checksum=2166136261;
    for(const channel of pixels)checksum=Math.imul(checksum^channel,16777619);
    const percentile=(a,p)=>a.toSorted((x,y)=>x-y)[Math.floor((a.length-1)*p)];
    return {
      actors:stats.visibleActors,maskedActors:stats.maskedActors,samples:paints.length,imageDraws,
      paintP50:percentile(paints,.5),paintP95:percentile(paints,.95),intervalP95:percentile(intervals,.95),
      scratchPixels:stats.scratchPixels,art:stats.art,pixelHash:(checksum>>>0).toString(16).padStart(8,'0'),
    };
  });
  assert.equal(result.actors,draft.actors.length);
  assert.equal(result.maskedActors,draft.actors.length);
  assert.deepEqual(errors,[]);
  const report={browser:browser.version(),base,renderer:'Canvas2D',width:960,height:640,props:props.length,...result};
  await mkdir('test-results',{recursive:true});
  await writeFile('test-results/map-crowd-performance.json',JSON.stringify(report,null,2));
  console.log(report);
  await page.evaluate(()=>mapPlay.view.dispose());
}finally{await browser.close();}
