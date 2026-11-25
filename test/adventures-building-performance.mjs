// Run after building Adventures. Set ADVENTURES_REPO for a non-sibling checkout.
// node --experimental-strip-types test/adventures-building-performance.mjs [width]
// BENCH_HEADED=1 measures foreground presentation. BROWSER_CHANNEL can select Chrome.
// A 60 Hz display has 16.7 ms per frame. Report the slow frames as well as the mean.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';
import {createRequire} from 'node:module';

const game=process.env.ADVENTURES_REPO||fileURLToPath(new URL('../../play.littlelands.co/',import.meta.url));
const dist=path.join(game,'dist');
const {newSave,parseSave,SAVE_KEY}=await import(pathToFileURL(path.join(game,'src/game/state.ts')));
const {DECORATION_FEATURES}=await import(pathToFileURL(path.join(game,'src/game/decorationFeatures.ts')));
const width=Number(process.argv[2]||960),phone=width<768;
// Optional mixed lot: 36 loose props plus up to eight 14-part zombies.
// The Porch does not yet play joint clips. BENCH_DANCERS=0 measures the
// same assembled lot with its normal, stationary production behavior.
const zombies=Number(process.env.BENCH_ZOMBIES||0);
const dance=zombies>0 && process.env.BENCH_DANCERS!=='0';
assert.ok(Number.isInteger(zombies)&&zombies>=0&&zombies<=8);
const looseCount=Number(process.env.BENCH_PROPS||(zombies?36:120));
assert.ok(Number.isInteger(looseCount)&&looseCount>=12&&looseCount+14*zombies<=150);
const save=newSave();
save.user.firstName='Performance';
save.sign=true;
const cleared=n=>({cleared:Array.from({length:n},(_,i)=>i),theme:'clearing'});
Object.assign(save.homes.house,{style:'moon',left:1,right:1,roomsLeft:1,roomsRight:1,level:2,plots:{'-1':cleared(8),'1':cleared(7)}});
const kinds=['bat','ghost','skeleton','pumpkin','lantern','spider','zombieArm','skull','rat','gargoyle','eyeball','frankenstein'];
for(let i=0;i<looseCount;i++){
  const kind=kinds[i%kinds.length],glow=[2,1,0][i%3];
  save.decorations.push({id:'stress-'+i,kind,building:'house',plot:i<96?0:(i%2?1:-1),
    x:12+i%10*8,y:12+Math.floor(i%100/10)*8,size:.8,level:1,rotation:0,choices:Array(glow).fill('glow'),
    paths:{glow,motion:0},investment:{stars:[0,3,8][glow],blocks:glow===2?1:0},
    ...(i%4<2?{features:Object.fromEntries(DECORATION_FEATURES[kind].map(f=>[f.id,f.options[1].id]))}:{})});
}
Object.assign(save.decorations[0],{x:50,y:47,layer:3999});
Object.assign(save.decorations[3],{x:18,y:64,size:.6});
Object.assign(save.decorations[9],{x:76,y:64,size:1.8});
for(const [i,ability] of ['twinkle','levitate','star-storm'].entries()){
  save.inventory.owned.push(ability);
  save.decorations[i].ability=ability;
}
const roots=[];
if(zombies){
  const {arrangeSculpture}=await import(pathToFileURL(path.join(game,'src/game/sculpture.ts')));
  const kinds=['Torso','Head','Arm','Arm','Arm','Arm','Hand','Hand','Leg','Leg','Leg','Leg','Foot','Foot'];
  for(let i=0;i<zombies;i++){
    const id='dancer-'+i;
    const pieces=kinds.map((kind,j)=>({
      id:j?id+'-'+j:id,kind:'zombie'+kind,building:'house',size:.62,
      x:26+i%4*15,y:32+Math.floor(i/4)*24,rotation:0,level:1,
      ...(j?{assembly:{rootId:id,x:0,y:0,rotation:0,size:1}}:{}),
    }));
    roots.push(id);
    save.decorations.push(...arrangeSculpture(pieces,id,'stand'));
  }
}
const seed=JSON.stringify(parseSave(JSON.stringify(save)));
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
await stat(path.join(dist,'index.html'));
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(dist,pathname.slice(1)||'index.html');
    if(!file.startsWith(path.resolve(dist)+path.sep)||!(await stat(file)).isFile())throw Error();
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream',
      'Content-Security-Policy':"connect-src 'self'; frame-src 'none'",'Cache-Control':'public, max-age=3600'});
    createReadStream(file).pipe(res);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try {
  const channel=process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined);
  const headed=process.env.BENCH_HEADED==='1';
  browser=await chromium.launch({headless:!headed,channel,
    args:['--disable-background-timer-throttling','--disable-renderer-backgrounding','--disable-backgrounding-occluded-windows']});
  const page=await browser.newPage({viewport:{width,height:phone?844:720},deviceScaleFactor:phone?2:1,hasTouch:phone,serviceWorkers:'block'});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(({seed,key})=>{
    if(!localStorage.getItem(key))localStorage.setItem(key,seed);
    localStorage.setItem('littlelands_voice_muted','true');
  },{seed,key:SAVE_KEY});
  await page.goto('http://127.0.0.1:'+server.address().port);
  if(headed)await page.bringToFront();
  const target=page.locator('[data-decoration-id="stress-0"]').first();
  await target.waitFor();
  assert.equal(await page.locator('.placed-prop').count(),save.decorations.length);
  await page.evaluate(()=>Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))));
  const bodies=page.locator('.placed-prop .decoration-body');
  assert.equal(await bodies.count(),save.decorations.length);
  await bodies.evaluateAll(async nodes=>{
    const sources=new Set(nodes.map(n=>n.dataset.body||n.src));
    await Promise.all([...sources].map(async url=>{const im=new Image();im.src=url;await im.decode();}));
  });
  // The arm is a tall, tightly cropped WebP. Its glow extends past the hit box,
  // while its paint must fit inside the original artwork square.
  await page.waitForFunction(()=>{
    const arm=document.querySelector('.kind-zombieArm .decoration-body');
    if(!arm)return false;
    const style=getComputedStyle(arm),paint=arm.offsetWidth-2*parseFloat(style.paddingLeft);
    return style.backgroundSize.split(',')[0].trim()==='contain'
      && Math.abs(paint-arm.closest('.customized-art').offsetWidth)<1.5;
  });
  const cdp=await page.context().newCDPSession(page);
  if(dance){
    const require=createRequire(path.join(game,'package.json'));
    const {outputFiles}=await require('esbuild').build({stdin:{
      contents:"export * from './animatronic.ts'; export * from './animationClock.ts';",
      resolveDir:path.join(game,'src/game')},bundle:true,format:'iife',globalName:'crowdBench',write:false});
    await page.addScriptTag({content:outputFiles[0].text});
    await page.evaluate(({roots,parts})=>{
      const {compileAnimatronic,sampleAnimatronic,animateCreature}=window.crowdBench;
      window.dancerTicks=Object.fromEntries(roots.map(id=>[id,0]));
      for(const [index,rootId] of roots.entries()){
        const root=parts.find(p=>p.id===rootId);
        const rig=compileAnimatronic(parts,rootId);
        const pieces=rig.joints.map(j=>{
          const part=parts.find(p=>p.id===j.id);
          const button=document.querySelector('[data-decoration-id="'+j.id+'"]');
          const rest=part.assembly||{x:0,y:0,rotation:0};
          // An alternating two-step exercises both branches of the leg and arm chains.
          const swing=part.kind.includes('Torso')?3:part.kind.includes('Arm')?22:14;
          const sign=rest.x<0?-1:1;
          rig.clip.tracks[j.id+'.rotation']=[[0,j.rotation],[.7,j.rotation+sign*swing],
            [1.4,j.rotation],[2.1,j.rotation-sign*swing],[2.8,j.rotation]];
          return {id:j.id,button,rest};
        });
        const stage=pieces[0].button.offsetParent;
        let dx,dy;
        const resize=()=>{dx=stage.clientWidth*root.size/100;dy=stage.clientHeight*root.size/100;};
        resize();
        new ResizeObserver(resize).observe(stage);
        animateCreature(pieces[0].button,t=>{
          const frame=sampleAnimatronic(rig,t+index*.31);
          for(const {id,button,rest} of pieces){
            const p=frame[id];
            button.style.transform='translate(-50%,-50%) translate('+((p.x-rest.x)*dx)+'px,'+
              ((p.y-rest.y)*dy)+'px) rotate('+p.rotation+'deg)';
          }
          window.dancerTicks[rootId]++;
        });
      }
    },{roots,parts:save.decorations});
    await page.waitForFunction(()=>Object.values(window.dancerTicks).every(n=>n>=3));
  }
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).decorations[0],SAVE_KEY);
  const rows=[];
  async function measure(mode,work){
    const ticks=dance?await page.evaluate(()=>({...window.dancerTicks})):null;
    await page.evaluate(()=>new Promise(resolve=>{
      window.intervals=[];
      requestAnimationFrame(first=>{
        let previous=first;
        function tick(t){window.intervals.push(t-previous);previous=t;window.lotRaf=requestAnimationFrame(tick);}
        window.lotRaf=requestAnimationFrame(tick);
        resolve();
      });
    }));
    await work();
    const timing=await page.evaluate(()=>{
      cancelAnimationFrame(window.lotRaf);
      const a=window.intervals.sort((a,b)=>a-b);
      return {fps:+(1000*a.length/a.reduce((v,x)=>v+x,0)).toFixed(1),p95ms:+a[Math.floor(a.length*.95)].toFixed(1),frames:a.length};
    });
    if(ticks){
      const counts=await page.evaluate(()=>window.dancerTicks);
      const updates=roots.map(id=>counts[id]-ticks[id]);
      timing.activeDancers=updates.filter(n=>n>0).length;
      timing.minDancerUpdates=Math.min(...updates);
      if(timing.activeDancers<roots.length){
        // The compact editor can make the Porch inert and pause its shared clock.
        const sleeping=await page.evaluate(ids=>ids.filter(id=>{
          const node=document.querySelector('[data-decoration-id="'+id+'"]');
          const r=node.getBoundingClientRect();
          return node.closest('[inert]')||!r.width||!r.height||r.right<=0||r.bottom<=0||r.left>=innerWidth||r.top>=innerHeight;
        }),roots);
        assert.ok(roots.every((id,i)=>updates[i]>0||sleeping.includes(id)),'A visible dancer stopped during '+mode);
      }
    }
    rows.push({mode,...timing});
  }
  const idle=()=>page.waitForTimeout(2500);
  await measure('idle',idle);
  const switchSelection=start=>page.evaluate(async start=>{
    const buttons=document.querySelectorAll('.yard-section[data-plot="0"] .placed-prop[data-decoration-id^="stress-"]');
    for(let i=0;i<18;i++){
      const button=buttons[(start+i*13)%buttons.length];
      button.click();
      await new Promise(r=>setTimeout(r,120));
      if(!button.classList.contains('selected'))throw new Error('Selection did not follow the clicked prop');
    }
  },start);
  await measure('switch selection',()=>switchSelection(0));
  await measure('switch selection, warm artwork',()=>switchSelection(24));
  await target.evaluate(b=>b.click());
  await page.waitForTimeout(400);
  const {x,y}=await target.evaluate(b=>{const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};});
  const finger=(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x,y,radiusX:3,radiusY:3}]});
  if(phone){await finger('touchStart',x,y);await finger('touchMove',x+12,y+8);}
  else {await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+12,y+8);}
  await page.locator('.lot-drag-ghost').waitFor();
  await measure('drag',async()=>{
    for(let i=0;i<90;i++){
      const px=x+16+i*.4,py=y+10+10*Math.sin(i/8);
      if(phone)await finger('touchMove',px,py);else await page.mouse.move(px,py);
    }
  });
  if(phone)await finger('touchEnd');else await page.mouse.up();
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await read()).x-50)>1);
  const editor=page.getByRole('dialog',{name:'Edit decoration'});
  if(!await editor.isVisible())await page.getByRole('button',{name:'Edit selected prop'}).click();
  await editor.waitFor();
  await measure('open editor',idle);
  const before=await read();
  await measure('change appearance',()=>page.evaluate(async()=>{
    for(let i=0;i<17;i++){
      document.querySelector('.decoration-editor .decoration-kit-choice:not(:disabled)').click();
      await new Promise(r=>setTimeout(r,120));
    }
  }));
  assert.notDeepEqual((await read()).features,before.features);
  await measure('rotate',()=>page.evaluate(async()=>{
    for(let i=0;i<14;i++){
      document.querySelector('.decoration-editor [aria-label="Rotate decoration"]').click();
      await new Promise(r=>setTimeout(r,130));
    }
  }));
  const edited=await read();
  assert.notEqual(edited.rotation,before.rotation);
  await page.reload();await target.waitFor();
  assert.deepEqual(await read(),edited);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({width,dpr:phone?2:1,channel,headed,browser:browser.version(),looseCount,zombies,dance,rows},null,2));
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
