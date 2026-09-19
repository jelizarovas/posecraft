import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5247';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage(),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.route('**/test-results/game-state',r=>r.fulfill({contentType:'text/html',body:'<main></main>'}));await page.goto(base+'/test-results/game-state');
 const result=await page.evaluate(async()=>{
  const [{SceneController},{WorkerSceneController},{createDemo}]=await Promise.all([import('/src/scene.js'),import('/src/worker.js'),import('/examples/showcase.js')]);
  const doc=createDemo('corner-shop');doc.objects.push({id:'parcel',name:'Parcel',shape:'circle',x:50,y:50,radius:8,fill:'#aa6633',mass:1});const main=new SceneController(doc),worker=new WorkerSceneController(doc);await worker.ready;
  main.setInput('shopkeeper','emotion','happy');worker.setInput('shopkeeper','emotion','happy');const ordered=worker.snapshot();worker.setInput('shopkeeper','emotion','sad');const before=await ordered,after=await worker.snapshot();
  const coalescingBarrier=before.actors[0].inputs.emotion==='happy'&&after.actors[0].inputs.emotion==='sad';
  await worker.restore(main.snapshot());const restoredParity=JSON.stringify(await worker.snapshot())===JSON.stringify(main.snapshot());
  const applied=await worker.objectCommandAck({type:'enable',object:'shop-light',enabled:true});main.objectCommandAck({type:'enable',object:'shop-light',enabled:true});
  const actualFailure=await worker.objectCommandAck({type:'attach',object:'parcel',actor:'shopkeeper',joint:'rightArm',maxDistance:0});
  let rejected=false;try{await worker.objectCommandAck({type:'place',object:'shop-light',x:10,y:10});}catch(error){rejected=/Static/.test(error.message);}
  const events=[];worker.subscribe(e=>events.push(e));worker.gameCommand({type:'action',actor:'shopkeeper',request:'cancel-on-load',clip:'wave'});await worker.restore(main.snapshot());
  const cancelled=events.some(e=>e.request==='cancel-on-load'&&e.cancelled);const noReplay=events.filter(e=>e.request==='cancel-on-load').length===1;
  main.setActorSleeping('shopkeeper',true);await worker.setActorSleeping('shopkeeper',true);const frozen=worker.frame().actors[0].pose;
  for(let i=0;i<6;i++){main.step(1/30);worker.step(1/30);await worker.snapshot();}
  const sleepParity=JSON.stringify(await worker.snapshot())===JSON.stringify(main.snapshot()),stillFrozen=JSON.stringify(frozen)===JSON.stringify(worker.frame().actors[0].pose);
  main.setActorSleeping('shopkeeper',false);await worker.setActorSleeping('shopkeeper',false);main.step(1/30);worker.step(1/30);await worker.snapshot();const wakeParity=JSON.stringify(await worker.snapshot())===JSON.stringify(main.snapshot());
  const saved=await worker.snapshot(),bad=structuredClone(saved);bad.objects[0].enabled='bad';let validation=false;try{await worker.restore(bad);}catch{validation=JSON.stringify(await worker.snapshot())===JSON.stringify(saved);}
  const pending=worker.snapshot();worker.dispose();let disposed=false;try{await pending;}catch{disposed=true;}main.dispose();return {coalescingBarrier,restoredParity,applied,actualFailure,rejected,cancelled,noReplay,sleepParity,stillFrozen,wakeParity,validation,disposed};
 });
 for(const [name,value] of Object.entries(result))assert.equal(value,name==='actualFailure'?false:true,name);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,...result}));
}finally{await browser.close();}
