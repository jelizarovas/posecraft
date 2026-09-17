import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampfire} from '../examples/campfire.js';
import {SceneController} from '../src/scene.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {spatialKinematics} from '../src/spatial.js';
import {assertDocument} from '../src/schema.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const point=(document,frame,id,joint)=>{const source=document.actors.find(a=>a.id===id),actor=frame.actors.find(a=>a.id===id),p=actor.placement||source.transform,w=spatialKinematics(document.packs[source.pack],actor.pose)[joint],r=p.rotation*Math.PI/180;return {x:p.x+p.scale*(w.x*Math.cos(r)-w.y*Math.sin(r)),y:p.y+p.scale*(w.x*Math.sin(r)+w.y*Math.cos(r))};};
function fixture(){const document=createCampfire(),controller=new SceneController(document),events=[],pointer=new ScenePointerInteraction(document,{dispatch:(event,payload)=>events.push({event,payload})});return {document,controller,pointer,events,frame:controller.frame()};}

test('portable campfire binds every food, head, hand and fast-hover interaction',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(createCampfire())));assert.equal(d.interactions.length,21);for(const actor of d.ensemble.members){const bindings=d.interactions.filter(b=>b.actor===actor);assert.deepEqual(bindings.filter(b=>b.gesture==='drag').map(b=>b.joint),['food','head','hold-hand','take-hand']);assert.equal(bindings.find(b=>b.gesture==='hover-fast').threshold,450);}assert.ok(d.requiredFeatures.includes('pointer-interactions'));
});

test('carry follows the screen cursor through actor rotation, scale and parent yaw',()=>{
 const d=createCampfire();Object.assign(d.actors.find(a=>a.id==='camper-0').transform,{rotation:37,scale:1.3});d.packs['camper-0'].clips.campfire.tracks['root.rotation']=[[0,17],[24,17]];const c=new SceneController(d),base=c.frame(),events=[],p=new ScenePointerInteraction(d,{dispatch:(event,payload)=>events.push({event,payload})}),start=point(d,base,'camper-0','food');p.apply(base);p.input({binding:'camper-0-food',phase:'start',...start});p.input({binding:'camper-0-food',phase:'move',x:start.x+83,y:start.y-41});const moved=p.apply(base);assert.ok(distance(point(d,moved,'camper-0','food'),{x:start.x+83,y:start.y-41})<.001);assert.equal(moved.actors.find(a=>a.id==='camper-0').pose['skewer.opacity'],0);assert.equal(moved.actors.find(a=>a.id==='camper-0').pose['food.opacity'],1);p.input({binding:'camper-0-food',phase:'end',x:start.x+83,y:start.y-41});assert.deepEqual(events,[{event:'food-throw',payload:{actor:'camper-0',x:start.x+83,y:start.y-41}}]);assert.equal(p.active,null);c.dispose();
});

test('resistance limits a large head tug and settles fully after release',()=>{
 const {document:d,controller:c,pointer:p,events,frame}=fixture(),start=point(d,frame,'camper-0','head');p.apply(frame);p.input({binding:'camper-0-head',phase:'start',...start});p.input({binding:'camper-0-head',phase:'move',x:start.x+1500,y:start.y-1500});for(let i=0;i<60;i++)p.step(1/60);const moved=p.apply(frame),displacement=distance(point(d,moved,'camper-0','head'),start);assert.ok(displacement>5&&displacement<=Math.SQRT2*32+.001);p.input({binding:'camper-0-head',phase:'end',x:start.x+1500,y:start.y-1500});for(let i=0;i<180;i++)p.step(1/60);assert.equal(p.active,null);assert.deepEqual(p.apply(frame),frame);assert.equal(events.length,1);assert.equal(events[0].event,'face-shoo');c.dispose();
});

test('event-only drag needs no joint and never changes the pose',()=>{
 const {document:d,controller:c,events,frame}=fixture();d.interactions.push({id:'actor-drag',actor:'camper-0',gesture:'drag',response:'event',event:'actor-moved',resistance:0});const p=new ScenePointerInteraction(d,{dispatch:(event,payload)=>events.push({event,payload})});p.apply(frame);p.input({binding:'actor-drag',phase:'start',x:320,y:260});p.input({binding:'actor-drag',phase:'move',x:390,y:220});p.step(.1);assert.equal(p.apply(frame),frame);p.input({binding:'actor-drag',phase:'end',x:390,y:220});assert.deepEqual(events,[{event:'actor-moved',payload:{actor:'camper-0',x:390,y:220}}]);assert.equal(p.active,null);c.dispose();
});

test('cancelling carry or resistance never dispatches a release event',()=>{
 for(const binding of ['camper-0-food','camper-0-head']){const {document:d,controller:c,pointer:p,events,frame}=fixture(),joint=d.interactions.find(b=>b.id===binding).joint,start=point(d,frame,'camper-0',joint);p.apply(frame);p.input({binding,phase:'start',...start});p.input({binding,phase:'move',x:start.x+60,y:start.y-20});p.step(.1);p.apply(frame);p.input({binding,phase:'cancel',x:start.x+60,y:start.y-20});for(let i=0;i<180;i++)p.step(1/60);assert.equal(events.length,0);assert.equal(p.active,null);assert.deepEqual(p.apply(frame),frame);c.dispose();}
});

test('whole-actor hover reactions have a cooldown and do not capture a drag',()=>{
 const {controller:c,pointer:p,events}=fixture();p.input({binding:'camper-0-hover',phase:'hover',x:320,y:200});p.step(.3);p.input({binding:'camper-0-hover',phase:'hover',x:340,y:200});assert.equal(events.length,1);p.step(.6);p.input({binding:'camper-0-hover',phase:'hover',x:330,y:200});assert.equal(events.length,2);assert.equal(p.active,null);c.dispose();
});


test('fire click and ignite control dispatch the authored graph events',()=>{
 const c=new SceneController(createCampfire());c.pointer({binding:'fire-click',phase:'click',x:400,y:350});assert.equal(c.frame().ensemble.fire.lit,false);assert.equal(c.frame().behavior.state,'cold');c.dispatch('ignite-fire');c.step(.05);assert.equal(c.frame().ensemble.fire.lit,true);assert.equal(c.frame().behavior.state,'warm');c.dispose();
});
