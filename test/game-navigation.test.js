import test from 'node:test';
import assert from 'node:assert/strict';
import {SceneController} from '../src/scene.js';
import {createGameScene} from '../src/game.js';
import {createGameExample} from '../examples/game-scene.js';
import {navigationSegmentClear} from '../src/navigation.js';

function fixture(){const d=createGameExample();d.actors=d.actors.slice(0,1);d.actors[0].transform={x:140,y:220,scale:1,rotation:0};d.props=[{id:'wall',name:'Wall',x:430,y:220,width:70,height:170,rotation:0,fill:'#333333',layer:'background',collider:{enabled:true,width:70,height:170,x:0,y:0,friction:.5,bounce:0}}];d.objects=[];d.game.anchors={destination:{type:'point',x:730,y:220},above:{type:'point',x:400,y:20}};d.game.actors={shopkeeper:{...d.game.actors.shopkeeper,locomotion:{mode:'float',speed:180,clearance:18,cellSize:16}}};return d;}
function root(c){const a=c.frame().actors[0],p=a.world.root,t=a.placement??c.document.actors[0].transform,r=t.rotation*Math.PI/180;return {x:t.x+(p.x*Math.cos(r)-p.y*Math.sin(r))*t.scale,y:t.y+(p.x*Math.sin(r)+p.y*Math.cos(r))*t.scale};}
async function advance(c,promise,visit=()=>{}){let done=false,error,value;promise.then(v=>{done=true;value=v;},e=>{done=true;error=e;});for(let i=0;i<6000&&!done;i++){await Promise.resolve();c.step(1/120);visit();}assert.ok(done,'command settled');if(error)throw error;return value;}
test('floating routes around obstacles, arrives exactly and retains the position through actions',async()=>{
 const d=fixture(),c=new SceneController(d),g=createGameScene(c);try{let previous=root(c),detoured=false;await advance(c,g.actor('shopkeeper').moveTo('destination'),()=>{const p=root(c);assert.ok(navigationSegmentClear(d,previous,p,{clearance:18}),'every traveled segment stays outside the collider');detoured ||= Math.abs(p.y-220)>100;previous=p;});assert.ok(detoured);assert.ok(Math.hypot(root(c).x-730,root(c).y-220)<1e-6);await advance(c,g.actor('shopkeeper').do('wave'));assert.ok(Math.hypot(root(c).x-730,root(c).y-220)<1e-6);}finally{g.dispose();c.dispose();}
});
test('walking, gaze and host speech coexist; priority protects only its own channel',async()=>{
 const c=new SceneController(fixture());let endSpeech;const g=createGameScene(c,{onSpeechRequest:()=>new Promise(r=>endSpeech=r)});try{const a=g.actor('shopkeeper'),move=a.moveTo('destination',{priority:10});await assert.rejects(a.do('wave',{priority:1}),/higher priority/);const gaze=a.lookAt('above'),speech=a.say('Over here');await advance(c,Promise.all([move,gaze]));assert.ok(endSpeech);endSpeech();await speech;assert.ok(Math.abs(root(c).x-730)<1e-6);}finally{g.dispose();c.dispose();}
});
test('unreachable movement fails without teleporting, and cancellation preserves its last position',async()=>{
 const d=fixture();d.props[0].y=250;d.props[0].height=d.props[0].collider.height=500;const c=new SceneController(d),g=createGameScene(c);try{const start=root(c);await assert.rejects(advance(c,g.actor('shopkeeper').moveTo('destination')),/route/i);assert.deepEqual(root(c),start);}finally{g.dispose();c.dispose();}
 const c2=new SceneController(fixture()),g2=createGameScene(c2);try{const p=g2.actor('shopkeeper').moveTo('destination'),rejected=assert.rejects(p,{name:'AbortError'});await Promise.resolve();for(let i=0;i<120;i++)c2.step(1/120);const position=root(c2);g2.actor('shopkeeper').cancel();await rejected;for(let i=0;i<120;i++)c2.step(1/120);assert.deepEqual(root(c2),position);}finally{g2.dispose();c2.dispose();}
});
test('reduced motion still routes and settles without an animation timer',async()=>{
 const c=new SceneController(fixture(),{reducedMotion:true}),g=createGameScene(c);try{await g.actor('shopkeeper').moveTo('destination');assert.ok(Math.hypot(root(c).x-730,root(c).y-220)<1e-6);}finally{g.dispose();c.dispose();}
});
test('planar navigation requires an authored gait and validates both coordinates before replacing a command',()=>{
 const d=fixture();d.game.actors.shopkeeper.locomotion.mode='planar';assert.throws(()=>new SceneController(d),/clip/);d.game.actors.shopkeeper.locomotion.clip='idle';const c=new SceneController(d);try{assert.throws(()=>c.gameCommand({type:'move',actor:'shopkeeper',request:'bad',x:700,y:NaN}),/inside/);}finally{c.dispose();}
});
test('invalid public destinations leave the current valid movement running',async()=>{
 const c=new SceneController(fixture()),g=createGameScene(c);try{const a=g.actor('shopkeeper'),moving=a.moveTo('destination');assert.throws(()=>a.moveTo({type:'point',x:950,y:220}),/inside/);await advance(c,moving);assert.ok(Math.abs(root(c).x-730)<1e-6);}finally{g.dispose();c.dispose();}
});
test('a static object enabled during planning blocks the first traveled segment',async()=>{
 const d=fixture();d.objects=[{id:'gate',name:'Gate',shape:'box',x:430,y:250,width:80,height:500,mass:0,enabled:false,fill:'#333333'}];const c=new SceneController(d),g=createGameScene(c);try{const start=root(c),moving=g.actor('shopkeeper').moveTo('destination');await Promise.resolve();c.objectCommand({type:'enable',object:'gate',enabled:true});await assert.rejects(advance(c,moving),/blocked/);assert.ok(root(c).x<395);assert.ok(Math.hypot(root(c).x-start.x,root(c).y-start.y)<450);}finally{g.dispose();c.dispose();}
});
test('public commands wake a sleeping actor, and restore cancels speech without replaying it',async()=>{
 const c=new SceneController(fixture());let speech;const g=createGameScene(c,{onSpeechRequest:request=>{speech=request;return new Promise(()=>{});}});try{const a=g.actor('shopkeeper');await a.sleep();assert.equal(c.frame().actors[0].sleeping,true);await advance(c,a.moveTo('destination'));assert.notEqual(c.frame().actors[0].sleeping,true);const saved=await g.snapshot(),spoken=a.say('Waiting'),cancelled=assert.rejects(spoken,{name:'AbortError'});await Promise.resolve();const invalid=structuredClone(saved);invalid.version=999;await assert.rejects(g.restore(invalid));assert.equal(speech.signal.aborted,false);await g.restore(JSON.parse(JSON.stringify(saved)));await cancelled;assert.equal(speech.signal.aborted,true);assert.ok(Math.abs(root(c).x-730)<1e-6);}finally{g.dispose();c.dispose();}
});
test('a restored event can start the next game command after the restore barrier clears',async()=>{
 const c=new SceneController(fixture());let next;const errors=[];const g=createGameScene(c,{onError:e=>errors.push(e),onEvent:e=>{if(e.type==='scene.restored')next=g.actor('shopkeeper').do('wave');}});try{await g.restore(await g.snapshot());assert.ok(next);await advance(c,next);assert.deepEqual(errors,[]);}finally{g.dispose();c.dispose();}
});
