import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5189').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1100,height:800},reducedMotion:'no-preference'}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
 await page.routeWebSocket('**',socket=>socket.close());
 await page.route('**/game-browser-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}.stage{width:400px;height:300px;display:inline-block}#scroll-source{height:140px;overflow:auto}#scroll-content{height:900px}</style><div id="stage" class="stage"></div><div id="react" class="stage"></div><div id="scroll-source"><div id="scroll-content"><div id="scroll-stage" class="stage"></div></div></div>'}));
 await page.goto(base+'/game-browser-fixture');
 await page.evaluate(async()=>{
  const [{createDrawing},{mountScene}]=await Promise.all([import('/src/vector-authoring.js'),import('/src/browser.js')]);
  const scene=createDrawing(),pack=scene.packs.drawing;scene.id='game-browser';scene.name='Game browser fixture';scene.requiredFeatures=['game-bindings','scene-objects'];
  pack.joints[0].x=160;pack.joints[0].y=160;pack.joints.push({id:'head',parent:'root',x:0,y:-30,rotation:0,min:-90,max:90,length:12});
  pack.parts=[{id:'body',joint:'root',d:'M-20 -20H20V20H-20Z',fill:'#6275bb'},{id:'face',joint:'head',d:'M-12 -12H12V12H-12Z',fill:'#e8bd79'}];
  pack.clips.idle.duration=.2;pack.clips.wave={duration:.2,loop:false,tracks:{'root.rotation':[[0,0],[.1,12],[.2,0]]}};
  pack.inputs.emotion={type:'string',default:'neutral',options:['neutral','happy']};
  scene.game={anchors:{star:{type:'point',x:320,y:20}},actors:{character:{actions:{greet:'wave'},reactions:{delighted:{action:'greet',emotion:'happy'}},gaze:{joint:'head',maxAngle:40},speech:true}}};
  scene.objects=[{id:'ball',name:'Ball',shape:'circle',x:400,y:300,radius:10,mass:0,fill:'#db9279'}];
  window.fixture=scene;window.mountGame=mountScene;window.events=[];window.speech=[];window.failures=[];
  window.speak=request=>{speech.push(request);if(request.text==='hold')return new Promise(()=>{});};
 });
 const results=[];
 for(const execution of ['main','worker']){
  await page.evaluate(async execution=>{window.events=[];window.speech=[];window.player=mountGame(document.querySelector('#stage'),fixture,{execution,reducedMotion:false,autoplay:false,onEvent:e=>events.push(e),onError:e=>failures.push(e.message),onSpeechRequest:speak});await player.controller.ready;},execution);
  assert.equal(await page.evaluate(()=>player.controller.playing),false);
  const completed=await page.evaluate(()=>player.actor('character').do('greet'));
  assert.equal(completed.type,'actor.action.completed');assert.equal(await page.evaluate(()=>player.controller.playing),true);
  assert.deepEqual(await page.evaluate(request=>({raw:events.filter(e=>e.type==='actor.command.completed'&&e.request===request).length,semantic:events.filter(e=>e.type==='actor.action.completed'&&e.request===request).length}),completed.request),{raw:1,semantic:1});
  assert.ok((await page.evaluate(()=>player.describe())).actors[0].actions.includes('greet'));
  const reactions=await page.evaluate(async()=>{await player.actor('character').react('delighted');await player.actor('character').lookAt('star',{duration:.1});return player.controller.frame().actors[0].inputs.emotion;});assert.equal(reactions,'happy');
  await page.evaluate(()=>player.object('ball').set('enabled',false));await page.waitForFunction(()=>player.controller.frame().objects.find(o=>o.id==='ball').enabled===false);
  await page.evaluate(()=>player.prop('ball').set('enabled',true));await page.waitForFunction(()=>player.controller.frame().objects.find(o=>o.id==='ball').enabled===true);
  await page.evaluate(async()=>{const sequence=player.sequence([{actor:'character',do:'greet'},{actor:'character',say:'done'}]);await sequence.finished;});
  assert.equal(await page.evaluate(()=>speech.at(-1).text),'done');
  for(const method of ['reset','seek']){
   await page.evaluate(()=>{window.speechJob=player.actor('character').say('hold').then(()=>({resolved:true}),error=>({name:error.name}));});await page.waitForFunction(()=>speech.at(-1)?.text==='hold');
   const result=await page.evaluate(async method=>{const signal=speech.at(-1).signal;player[method](0);return {settled:await speechJob,aborted:signal.aborted};},method);assert.deepEqual(result,{settled:{name:'AbortError'},aborted:true});
  }
  const cancellation=await page.evaluate(async()=>{const abort=new AbortController(),job=player.actor('character').do('greet',{signal:abort.signal}).catch(error=>error.name);abort.abort();return job;});assert.equal(cancellation,'AbortError');
  const replacement=await page.evaluate(async()=>{const one=player.actor('character').do('greet').catch(error=>error.name),two=player.actor('character').lookAt('star',{duration:.1});return [await one,(await two).type];});assert.deepEqual(replacement,['AbortError','actor.look.completed']);
  await page.evaluate(()=>{window.pendingDispose=player.actor('character').say('hold').catch(error=>error.name);});await page.waitForFunction(()=>speech.at(-1)?.text==='hold');
  const disposed=await page.evaluate(async()=>{const signal=speech.at(-1).signal,original=player.controller.dispose.bind(player.controller);let abortedBeforeController=false;player.controller.dispose=()=>{abortedBeforeController=signal.aborted;original();};const actor=player.actor('character');player.dispose();player.dispose();let message;try{actor.capabilities();}catch(error){message=error.message;}return {result:await pendingDispose,abortedBeforeController,message};});
  assert.equal(disposed.result,'AbortError');assert.equal(disposed.abortedBeforeController,true);assert.match(disposed.message,/disposed/);results.push(execution);
 }
 for(const execution of ['main','worker']){
  await page.evaluate(async execution=>{window.player=mountGame(document.querySelector('#stage'),fixture,{execution,reducedMotion:true,autoplay:false});await player.controller.ready;await player.actor('character').lookAt('star');},execution);
  await page.waitForFunction(()=>{const head=player.controller.frame().actors[0].world.head;return Math.abs(head.rotation)>1&&document.querySelector('#stage [data-joint="head"]').getAttribute('transform')===`translate(${head.x} ${head.y}) rotate(${head.rotation})`;});
  await page.evaluate(()=>player.object('ball').set('enabled',false));await page.waitForFunction(()=>document.querySelector('#stage [data-object="ball"]').getAttribute('display')==='none');await page.evaluate(()=>player.dispose());
 }
 for(const execution of ['main','worker']){
  const isolated=await page.evaluate(async execution=>{const caught=[],player=mountGame(document.querySelector('#stage'),fixture,{execution,reducedMotion:false,autoplay:false,onEvent:event=>{if(event.type==='actor.command.completed'||event.type==='actor.action.completed')throw Error('Host callback failed: '+event.type);},onError:error=>{caught.push(error.message);throw Error('Host error callback failed');}});await player.controller.ready;const result=await player.actor('character').do('greet');player.dispose();return {type:result.type,caught};},execution);
  assert.equal(isolated.type,'actor.action.completed');assert.deepEqual(isolated.caught,['Host callback failed: actor.command.completed','Host callback failed: actor.action.completed']);
  const guarded=await page.evaluate(async execution=>{const player=mountGame(document.querySelector('#scroll-stage'),fixture,{execution,reducedMotion:false,autoplay:false,onSpeechRequest:speak,scroll:{source:document.querySelector('#scroll-source'),mode:'authored',clips:[{actor:'character',clip:'idle'}]}});await player.controller.ready;const messages=[];for(const command of [()=>player.actor('character').do('greet'),()=>player.actor('character').say('scroll'),()=>player.sequence([{actor:'character',do:'greet'}]).finished,()=>player.object('ball').set('enabled',false)])try{await command();messages.push('Unexpected success');}catch(error){messages.push(error.message);}const paused=!player.controller.playing&&player.controller.time===0;player.dispose();return {paused,messages};},execution);
  assert.equal(guarded.paused,true);assert.equal(guarded.messages.length,4);for(const message of guarded.messages)assert.match(message,/unavailable during authored scrolling/);
 }
 await page.evaluate(async()=>{
  const [ReactModule,ReactDOM,components]=await Promise.all([import('/node_modules/.vite/deps/react.js'),import('/node_modules/.vite/deps/react-dom_client.js'),import('/src/react.js')]);
  const React=ReactModule.default||ReactModule;window.React=React;window.reactRoot=(ReactDOM.default||ReactDOM).createRoot(document.querySelector('#react'));window.components=components;window.reactRef=React.createRef();window.reactSpeech=[];
  window.renderReact=version=>reactRoot.render(React.createElement(components.PosecraftScene,{ref:reactRef,scene:fixture,execution:'worker',reducedMotion:false,onSpeechRequest:request=>{reactSpeech.push({version,request});if(request.text==='hold')return new Promise(()=>{});},onError:e=>failures.push(e.message)}));renderReact(1);
 });
 await page.waitForFunction(()=>reactRef.current?.controller?.ready);await page.evaluate(()=>reactRef.current.controller.ready);
 assert.equal(await page.evaluate(()=>components.Posecraft===components.PosecraftScene),true);
 assert.equal((await page.evaluate(()=>reactRef.current.actor('character').do('greet'))).type,'actor.action.completed');
 await page.evaluate(()=>{window.originalReactController=reactRef.current.controller;renderReact(2);});await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>reactRef.current.controller===originalReactController),true);await page.evaluate(()=>reactRef.current.actor('character').say('updated'));assert.equal(await page.evaluate(()=>reactSpeech.at(-1).version),2);
 await page.evaluate(()=>{window.oldHandle=reactRef.current;window.reactPending=oldHandle.actor('character').say('hold').catch(error=>error.name);});await page.waitForFunction(()=>reactSpeech.at(-1)?.request.text==='hold');
 const unmounted=await page.evaluate(async()=>{const request=reactSpeech.at(-1).request;reactRoot.unmount();let message;try{oldHandle.actor('character');}catch(error){message=error.message;}return {result:await reactPending,aborted:request.signal.aborted,message,ref:reactRef.current};});
 assert.equal(unmounted.result,'AbortError');assert.equal(unmounted.aborted,true);assert.match(unmounted.message,/not mounted/);assert.equal(unmounted.ref,null);
 assert.deepEqual(await page.evaluate(()=>failures),[]);assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,execution:results,autoplayWake:true,completionOnce:true,cancellation:true,speech:true,scrollGuard:true,react:true}));
}finally{await browser.close();}
