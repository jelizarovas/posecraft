import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5197').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:1000,height:700},reducedMotion:'no-preference'}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/map-browser-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0}#map{height:100vh;width:100vw}</style><div id="map"></div>'}));
  await page.goto(base+'/map-browser-fixture');
  await page.evaluate(async()=>{const[{generateMap},{mountMap}]=await Promise.all([import('/src/map.js'),import('/src/map-browser.js')]);window.map=generateMap({width:256,height:256,seed:42});window.events=[];window.view=mountMap(document.querySelector('#map'),map,{onEvent:e=>events.push(e),onError:e=>console.error(e)});await view.controller.ready;});
  await page.waitForFunction(()=>view.stats().drawnFrames>0);
  const initial=await page.evaluate(()=>view.stats());assert.equal(initial.totalTiles,65536);assert.ok(initial.visibleTiles<1500);assert.ok(initial.visibleProps<initial.totalProps*.1);assert.equal(initial.backingWidth,1000);assert.equal(initial.backingHeight,700);
  await page.waitForTimeout(150);const idle=await page.evaluate(()=>view.stats().drawnFrames);await page.waitForTimeout(150);assert.equal(await page.evaluate(()=>view.stats().drawnFrames),idle,'Idle view must stop rendering');
  const coords=await page.evaluate(()=>{const p={x:128.5,y:128.5},s=view.mapToScreen(p);return{p,roundtrip:view.screenToMap(s.x,s.y)};});assert.deepEqual(coords.roundtrip,coords.p);
  await page.mouse.move(500,350);await page.mouse.wheel(0,-200);await page.waitForTimeout(100);assert.ok(await page.evaluate(()=>view.stats().camera.zoom>1));
  await page.evaluate(()=>{view.pause();window.move=view.moveTo('hero','village-chest');});await page.waitForFunction(()=>events.some(e=>e.type==='map.route.ready'));
  const paused=await page.evaluate(()=>view.controller.frame().actors[0]);await page.waitForTimeout(120);assert.deepEqual(await page.evaluate(()=>view.controller.frame().actors[0]),paused,'Paused map must not move');
  await page.evaluate(()=>view.play());await page.evaluate(()=>move);assert.ok(await page.evaluate(()=>view.controller.frame().objects['village-chest'].opened));
  const saved=await page.evaluate(()=>view.snapshot());await page.evaluate(()=>{view.panTo(30,30);view.zoomTo(.5);});await page.evaluate(state=>view.restore(state),saved);assert.deepEqual(await page.evaluate(()=>view.snapshot()),saved);
  await page.evaluate(()=>{window.outsideMove=view.moveTo('hero','village-house');});await page.waitForFunction(()=>view.controller.isMoving);
  await page.evaluate(()=>{document.querySelector('#map').style.transform='translateY(200vh)';});await page.waitForTimeout(120);
  const offscreen=await page.evaluate(()=>({actor:view.controller.actorPosition('hero'),frames:view.stats().drawnFrames}));await page.waitForTimeout(200);
  assert.deepEqual(await page.evaluate(()=>({actor:view.controller.actorPosition('hero'),frames:view.stats().drawnFrames})),offscreen,'Offscreen host must stop simulation and rendering');
  await page.evaluate(()=>{document.querySelector('#map').style.transform='';});await page.evaluate(()=>outsideMove);
  await page.setViewportSize({width:390,height:600});await page.waitForFunction(()=>view.stats().backingWidth===390);assert.ok((await page.evaluate(()=>view.stats())).visibleTiles<700);await page.screenshot({path:'test-results/map-view-mobile.png'});
  await page.evaluate(()=>view.dispose());assert.equal(await page.locator('canvas').count(),0);assert.equal(await page.locator('[role=status]').count(),0);assert.deepEqual(errors,[]);
  const parity=await page.evaluate(async()=>{
    const {MapController}=await import('/src/map-runtime.js');
    const document={format:'posecraft-map',version:1,id:'queued-routes',name:'Queued routes',width:192,height:192,seed:1,tileSize:{width:72,height:36},terrain:Array(192*192).fill(0),props:[],actors:Array.from({length:9},(_,i)=>({id:`actor-${i}`,x:8.5,y:8.5+i*2,speed:60}))};
    for(let y=0;y<180;y++)document.terrain[y*192+96]=2;
    const outcomes=[];
    for(const execution of ['main','worker']){
      const events=[],errors=[],controller=new MapController(document,{execution,onEvent:e=>events.push(e),onError:e=>errors.push(e.message)});
      try{
        await controller.ready;
        const requests=document.actors.map((a,i)=>controller.moveTo(a.id,{x:184.5,y:8.5+i*2}).then(event=>({ok:true,event}),error=>({ok:false,name:error.name})));
        // Ready callbacks have submitted all nine jobs before cancelling the first four.
        await Promise.resolve();for(let i=0;i<4;i++)controller.cancel(`actor-${i}`);
        const started=performance.now();
        while(events.filter(e=>e.type==='map.route.ready').length<5){if(performance.now()-started>20000)throw Error(`${execution} route queue did not drain`);await new Promise(resolve=>setTimeout(resolve,5));}
        let unsafe=false;
        for(let step=0;step<1500&&controller.isMoving;step++){
          controller.advance(.1);
          for(const actor of controller.frame().actors)if(controller.index.isBlocked(Math.floor(actor.x),Math.floor(actor.y)))unsafe=true;
        }
        if(controller.isMoving)throw Error(`${execution} routes never arrived`);
        outcomes.push({execution,results:await Promise.all(requests),actors:controller.snapshot().actors,events,errors,unsafe});
      }finally{controller.dispose();}
    }
    return outcomes;
  });
  for(const result of parity){assert.deepEqual(result.errors,[]);assert.equal(result.unsafe,false);assert.deepEqual(result.results.slice(0,4).map(r=>r.name),Array(4).fill('AbortError'));assert.ok(result.results.slice(4).every(r=>r.ok));assert.equal(result.events.filter(e=>e.type==='map.actor.arrived').length,5);assert.equal(result.events.filter(e=>e.type==='map.command.cancelled').length,4);result.actors.forEach((a,i)=>{assert.equal(a.x,i<4?8.5:184.5);assert.equal(a.y,8.5+i*2);});}
  assert.deepEqual(parity[0].actors,parity[1].actors,'Main and worker routes must produce the same actor state');assert.deepEqual(errors,[]);
  await page.setViewportSize({width:1000,height:700});
  const motion=await page.evaluate(async()=>{
    const {mountMap}=await import('/src/map-browser.js');
    document.body.innerHTML='<div id="normal" style="display:inline-block;width:400px;height:300px"></div><div id="reduced" style="display:inline-block;width:400px;height:300px"></div>';
    const map={format:'posecraft-map',version:1,id:'motion-policy',name:'Motion policy',width:12,height:12,seed:1,tileSize:{width:72,height:36},terrain:Array(144).fill(0),props:[],actors:[{id:'hero',x:2.5,y:2.5,speed:3.2}]};
    const views=[false,true].map((reducedMotion,i)=>mountMap(document.querySelector(i?'#reduced':'#normal'),map,{reducedMotion,execution:'main'}));
    try{
      await Promise.all(views.map(view=>view.controller.ready));
      return await Promise.all(views.map(async view=>{const start=performance.now();await view.moveTo('hero',{x:7.5,y:2.5});return performance.now()-start;}));
    }finally{views.forEach(view=>view.dispose());}
  });
  assert.ok(motion[1]/motion[0]>.75&&motion[1]/motion[0]<1.25,`Reduced motion must preserve travel speed: ${motion}`);
  const tall=await page.evaluate(async()=>{
    const {mountMap}=await import('/src/map-browser.js');
    const map={format:'posecraft-map',version:1,id:'large-tiles',name:'Large tiles',width:12,height:12,seed:1,tileSize:{width:512,height:256},terrain:Array(144).fill(0),props:[],actors:[{id:'hero',x:2.5,y:2.5,speed:3.2}]};
    const view=mountMap(document.querySelector('#normal'),map,{execution:'main'});
    try{view.panTo(2.5-300/256,2.5-300/256);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return view.stats();}finally{view.dispose();}
  });
  assert.equal(tall.visibleActors,1,'Large actor head must remain drawn when its feet are below the viewport');assert.deepEqual(errors,[]);
  console.log('Map view passed: viewport culling, backing, idle/offscreen suspension, coordinates, zoom, pause/resume, interaction, restore, cleanup and nine-route main/worker cancellation parity.');
}finally{await browser.close();}
