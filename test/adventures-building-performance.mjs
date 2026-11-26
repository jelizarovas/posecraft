// Run after building Adventures. Set ADVENTURES_REPO for a non-sibling checkout.
// node --experimental-strip-types test/adventures-building-performance.mjs [width]
// BENCH_HEADED=1 measures foreground presentation. BROWSER_CHANNEL can select Chrome.
// A 60 Hz display has 16.7 ms per frame. Report the slow frames as well as the mean.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createReadStream} from 'node:fs';
import {stat,readFile} from 'node:fs/promises';
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
// Measures the production Porch animation; the benchmark never supplies a rig or clip.
const zombies=Number(process.env.BENCH_ZOMBIES||0);
const dance=zombies>0;
assert.ok(Number.isInteger(zombies)&&zombies>=0&&zombies<=8);
const looseCount=Number(process.env.BENCH_PROPS||(zombies?36:120));
assert.ok(Number.isInteger(looseCount)&&looseCount>=12&&looseCount+14*zombies<=150);
const save=newSave();
save.user.firstName='Performance';
save.sign=true;
const cleared=n=>({cleared:Array.from({length:n},(_,i)=>i),theme:'clearing'});
Object.assign(save.homes.house,{style:'moon',left:1,right:1,roomsLeft:1,roomsRight:1,level:2,plots:{'-1':cleared(8),'1':cleared(7)}});
if(process.argv.includes('--navigation'))save.homes.library={...save.homes.house,style:'mossy',left:0,right:0,roomsLeft:0,roomsRight:0,level:0,plots:{}};
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
// BENCH_ZOMBIES=8 node --experimental-strip-types test/adventures-building-performance.mjs 960 --dev
if(process.argv.includes('--dev')){
  process.chdir(game);
  const requireGame=createRequire(path.join(game,'package.json'));
  const {createServer:createVite}=await import(pathToFileURL(requireGame.resolve('vite')));
  const dev=await createVite({root:game,configFile:path.join(game,'vite.config.ts'),
    server:{host:'0.0.0.0',port:Number(process.env.PORT||5272),strictPort:true},
    plugins:[{name:'local-test-town',transformIndexHtml:()=>[{tag:'script',injectTo:'head-prepend',
      children:'if(!localStorage.getItem('+JSON.stringify(SAVE_KEY)+'))localStorage.setItem('+JSON.stringify(SAVE_KEY)+','+JSON.stringify(seed)+');'}]}]});
  await dev.listen();dev.printUrls();await new Promise(()=>{});
}
const preview=process.argv.includes('--serve');
const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webp':'image/webp','.svg':'image/svg+xml','.json':'application/json','.woff2':'font/woff2','.png':'image/png'};
await stat(path.join(dist,'index.html'));
const server=createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(dist,pathname.slice(1)||'index.html');
    if(!file.startsWith(path.resolve(dist)+path.sep)||!(await stat(file)).isFile())throw Error();
    res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream',
      'Content-Security-Policy':"connect-src 'self'; frame-src 'none'",'Cache-Control':'public, max-age=3600'});
    if(preview&&path.basename(file)==='index.html'){
      const html=await readFile(file,'utf8');
      const init='if(!localStorage.getItem('+JSON.stringify(SAVE_KEY)+'))localStorage.setItem('+JSON.stringify(SAVE_KEY)+','+JSON.stringify(seed)+');';
      res.end(html.replace('<head>','<head><script>'+init+'</script>'));
    }else createReadStream(file).pipe(res);
  } catch {res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(preview?Number(process.env.PORT||5262):0,preview?'0.0.0.0':'127.0.0.1',resolve));
if(preview){
  console.log('Crowded-lot preview on port '+server.address().port);
  await new Promise(()=>{});
}
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
  if(process.argv.includes('--first-editor')){
    assert.ok(dance&&phone);
    const cdp=await page.context().newCDPSession(page);
    await page.waitForFunction(n=>[...document.querySelectorAll('[data-puppet=performing]')].filter(el=>el.getAnimations()[0]?.playState==='running').length===n,zombies);
    await target.tap();
    const opener=page.getByRole('button',{name:'Edit selected prop'});
    await opener.tap({trial:true});
    const bounds=await opener.boundingBox(),x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(t=>{
      const roots=[...document.querySelectorAll('[data-puppet=performing]')];
      const clocks=roots.map(e=>e.getAnimations()[0]),starts=clocks.map(a=>Number(a.currentTime));
      window.firstEdit={frames:[],tap:null,visible:null,clocks,starts,start:t};
      const panel=document.querySelector('.prop-editor-panel [role=dialog]');
      const observer=new IntersectionObserver(entries=>{
        const hit=entries.find(e=>e.intersectionRatio>=.05&&panel.closest('.prop-editor-layer.open'));
        if(hit){window.firstEdit.visible=hit.time;observer.disconnect();}
      },{threshold:.05});
      observer.observe(panel);
      document.addEventListener('touchstart',event=>{window.firstEdit.tap=event.timeStamp;},{once:true,capture:true});
      let last=t;
      function tick(now){
        window.firstEdit.frames.push([last,now-last]);last=now;
        window.firstEdit.raf=requestAnimationFrame(tick);
      }
      window.firstEdit.raf=requestAnimationFrame(tick);resolve();
    })));
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    // The in-page observer above records the reveal. A simultaneous role lookup
    // would walk the town's accessibility tree during the interval being timed.
    await page.waitForTimeout(450);
    const result=await page.evaluate(()=>{
      const {frames,tap,visible,clocks,starts,raf,start}=window.firstEdit;cancelAnimationFrame(raf);
      const d=frames.filter(([t,ms])=>t+ms>=tap).map(row=>row[1]);
      if(visible===null||tap===null)throw Error('The first tap did not reveal the drawer');
      return {fps:+(1000*d.length/d.reduce((a,b)=>a+b,0)).toFixed(1),worstMs:+Math.max(...d).toFixed(1),
        over25:d.filter(ms=>ms>25).length,visibleMs:Math.round(visible-tap),
        dancers:clocks.filter((a,i)=>a.playState==='running'&&Number(a.currentTime)-starts[i]>=frames.at(-1)[0]-start-18).length};
    });
    assert.ok(result.visibleMs>=0);assert.equal(result.dancers,zombies);assert.deepEqual(errors,[]);console.log('First editor tap',JSON.stringify(result));
  }else{
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
  const performers=()=>page.evaluate(()=>Object.fromEntries(
    [...document.querySelectorAll('[data-puppet="performing"]')].map(root=>{
      const animation=root.getAnimations().find(a=>a.id==='posecraft-joint');
      return [root.dataset.decorationId,{time:Number(animation?.currentTime),playing:animation?.playState==='running'}];
    })));
  if(dance){
    await page.waitForFunction(n=>document.querySelectorAll('[data-puppet="performing"]').length===n,zombies);
    assert.equal(await page.locator('canvas.puppet-composite').count(),zombies);
    const canvas=page.locator('canvas.puppet-composite').first();
    const firstFrame=await canvas.evaluate(c=>c.toDataURL());
    await page.waitForFunction(previous=>document.querySelector('canvas.puppet-composite').toDataURL()!==previous,firstFrame);
    await page.waitForFunction(()=>[...document.querySelectorAll('[data-puppet]')].every(b=>b.getAnimations().some(a=>a.id==='posecraft-joint'&&a.playState==='running')));
  }
  if(dance){
    // The hidden lot must stop its clocks and resume those same players on return.
    const animation=await page.locator('[data-puppet=performing]').first().evaluateHandle(root=>root.getAnimations()[0]);
    for(let i=0;i<3;i++){
      await page.getByRole('button',{name:'Learning map',exact:true}).click();
      await page.waitForFunction(a=>a.playState==='paused',animation);
      await page.getByRole('button',{name:'Back to home',exact:true}).click();
      await page.waitForFunction(a=>a.playState==='running'&&document.querySelector('[data-puppet=performing]')?.getAnimations().includes(a),animation);
    }
    await animation.dispose();
  }
  const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)).decorations[0],SAVE_KEY);
  const rows=[];
  async function measure(mode,work){
    const ticks=dance?await performers():null;
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
      const elapsed=a.reduce((v,x)=>v+x,0);
      return {fps:+(1000*a.length/elapsed).toFixed(1),p95ms:+a[Math.floor(a.length*.95)].toFixed(1),
        worstMs:+a.at(-1).toFixed(1),frames:a.length,elapsedMs:Math.round(elapsed),framesOver25ms:a.filter(ms=>ms>25).length};
    });
    if(ticks){
      const after=await performers();
      timing.activeDancers=roots.filter(id=>after[id]?.playing&&after[id].time>ticks[id]?.time).length;
      if(['drag','idle','switch selection','switch selection, warm artwork','open editor','change appearance','rotate'].includes(mode))assert.equal(timing.activeDancers,zombies,'Every zombie must play throughout '+mode);
      if(mode==='drag')for(const id of roots)assert.ok(after[id].time-ticks[id].time>=timing.elapsedMs*.97,'Puppet paused during drag: '+id);
    }
    rows.push({mode,...timing});
    if(process.argv.includes('--navigation'))console.log(mode,JSON.stringify(timing));
  }
  if(process.argv.includes('--navigation')){
    assert.ok(dance&&phone,'Navigation fixture requires dancing zombies and a touch viewport');
    const camera=await page.locator('.scene-camera').boundingBox();
    const artwork=await page.locator('.puppet-composite').first().evaluateHandle(c=>c);
    const clock=await page.locator('[data-puppet=performing]').first().evaluateHandle(el=>el.getAnimations()[0]);
    async function swipe(distance,expected){
      const x=camera.x+camera.width*(distance<0?.72:.24),y=camera.y+camera.height*.73;
      const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
      await touch('touchStart',[{x,y}]);
      for(let i=1;i<=14;i++){await touch('touchMove',[{x:x+distance*i/14,y}]);await page.waitForTimeout(13);}
      await touch('touchEnd',[]);
      await page.waitForFunction(title=>document.querySelector('.home-name-switch h1')?.textContent===title,expected);
      await page.waitForTimeout(350);
    }
    await measure('swipe yards',async()=>{
      for(let i=0;i<2;i++){await swipe(-160,'East yard 1');await swipe(160,'My little home');}
    });
    await measure('swipe between owned homes',async()=>{
      await swipe(-160,'East yard 1');await swipe(-160,'Moon cottage');
      await page.waitForFunction(a=>a.playState==='paused',clock);
      await swipe(160,'East yard 1');await swipe(160,'My little home');
    });
    for(let i=0;i<3;i++){
      await page.getByRole('button',{name:'Learning map',exact:true}).click();
      await page.waitForFunction(a=>a.playState==='paused',clock);
      await measure('Star Map return '+(i+1),async()=>{
        await page.getByRole('button',{name:'Back to home',exact:true}).evaluate(b=>b.click());
        await page.waitForFunction(a=>a.playState==='running',clock);
        await page.waitForTimeout(1000);
      });
    }
    assert.ok(await artwork.evaluate(c=>c===document.querySelector('.puppet-composite')&&c.isConnected));
    await target.tap();await page.waitForSelector('[data-decoration-id="stress-0"].selected');
    await page.getByRole('button',{name:'Little Lands home',exact:true}).click();
    await clock.dispose();await artwork.dispose();
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
    const until=Date.now()+(dance?14500:0);
    for(let i=0;i<90||Date.now()<until;i++){
      const px=x+38+20*Math.sin(i/17),py=y+10+10*Math.sin(i/8);
      if(phone)await finger('touchMove',px,py);else await page.mouse.move(px,py);
    }
  });
  if(phone)await finger('touchEnd');else await page.mouse.up();
  await page.waitForTimeout(250);
  assert.ok(Math.abs((await read()).x-50)>1);
  const editor=page.getByRole('dialog',{name:'Edit decoration'});
  if(await editor.isVisible()){
    await page.getByRole('button',{name:'Close decoration editor'}).click();
    await editor.waitFor({state:'hidden'});
  }
  const editButton=await page.getByRole('button',{name:'Edit selected prop'}).elementHandle();
  const editBounds=await editButton.boundingBox();
  const editX=editBounds.x+editBounds.width/2,editY=editBounds.y+editBounds.height/2;
  await measure('open editor',async()=>{
    if(phone){await finger('touchStart',editX,editY);await finger('touchEnd');}
    else await page.mouse.click(editX,editY);
    await page.waitForTimeout(850);
  });
  await editor.waitFor();
  await editButton.dispose();
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
  if(dance){
    // Exercise a genuinely customized assembly after timing the eight ordinary dancers.
    const feature=DECORATION_FEATURES.zombieFoot[0];
    await page.evaluate(({key,id,value})=>{
      const town=JSON.parse(localStorage.getItem(key));
      town.decorations.find(d=>d.id==='dancer-0-12').features={[id]:value};
      localStorage.setItem(key,JSON.stringify(town));
    },{key:SAVE_KEY,id:feature.id,value:feature.options[1].id});
  }
  await page.reload();await target.waitFor();
  assert.deepEqual(await read(),edited);
  if(dance){
    const root=page.locator('[data-decoration-id="dancer-0"]');
    await page.waitForFunction(n=>document.querySelectorAll('[data-puppet]').length===n,zombies);
    const shirt=root.locator('canvas[data-slot="body"]');
    const firstShirt=await shirt.evaluate(c=>c.toDataURL());
    await page.waitForFunction(previous=>document.querySelector('[data-decoration-id="dancer-0"] canvas[data-slot="body"]').toDataURL()!==previous,firstShirt);
    const drawings=await page.evaluate(async()=>{
      const parts=[...document.querySelectorAll('[data-scene-prop-id="dancer-0"]')];
      const animations=parts.flatMap(p=>p.getAnimations({subtree:true})).filter(a=>a.id.startsWith('posecraft-'));
      const layer=slot=>parts.map(p=>p.querySelector('[data-slot="'+slot+'"]')).find(Boolean);
      const head=layer('head'),hand=layer('rightHand'),tiles=[];
      const facial=['leftEyelid','rightEyelid','mouth'].map(channel=>parts.map(p=>p.querySelector('[data-face-channel="'+channel+'"]')).find(Boolean));
      // Inspect the production animations after the timed interaction has ended.
      const sweep=(a,b,step)=>Array.from({length:Math.ceil((b-a)/step)},(_,i)=>a+i*step);
      for(const ms of [...sweep(100,1050,16),...sweep(1150,1520,6),2690,3200,...sweep(3520,4000,12),4400]){
        for(const a of animations){a.pause();a.currentTime=ms;}
        await new Promise(requestAnimationFrame);
        tiles.push([head,hand,...facial].map(node=>getComputedStyle(node).backgroundPosition));
      }
      for(const a of animations)a.play();
      return tiles;
    });
    assert.equal(new Set(drawings.map(d=>d[0])).size,49);
    assert.equal(new Set(drawings.map(d=>d[1])).size,3);
    for(const i of [2,3,4])assert.ok(new Set(drawings.map(d=>d[i].split(' ')[0])).size>=11);
    await root.evaluate(b=>b.click());
    await page.waitForFunction(n=>document.querySelectorAll('[data-puppet]').length===n,zombies-1);
    await target.evaluate(b=>b.click());
    await page.waitForFunction(n=>document.querySelectorAll('[data-puppet]').length===n,zombies);
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForFunction(()=>!document.querySelector('[data-puppet]'));
    assert.equal(await page.locator('[data-slot=pelvis]').count(),1);
    assert.equal(await page.locator('canvas.puppet-composite').count(),zombies-1);
  }
  assert.deepEqual(errors,[]);
  const system=await browser.newBrowserCDPSession();
  const {gpu}=await system.send('SystemInfo.getInfo');
  console.log(JSON.stringify({width,dpr:phone?2:1,channel,headed,browser:browser.version(),
    renderer:gpu.auxAttributes?.glRenderer||gpu.devices[0]?.deviceString,looseCount,zombies,dance,rows},null,2));
  }
} finally {
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
