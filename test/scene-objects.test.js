import test from 'node:test';
import assert from 'node:assert/strict';
import {createCatch} from '../examples/catch.js';
import {SceneController} from '../src/scene.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {SceneObjects,objectGrip} from '../src/scene-objects.js';
import {predictIntercept} from '../src/prop-games.js';
const bare=()=>{const d=createCatch();delete d.objectGames;delete d.objects[0].owner;d.objectPhysics.actorCollisions=false;return d;};
test('shared prop validation rejects invalid references, oversized work and unsupported dynamic boxes',()=>{
 const d=createCatch();assertDocument(d);for(const change of [d=>d.objects[0].radius=0,d=>d.objects[0].owner.joint='missing',d=>d.objectGames[0].participants[1].actor='missing',d=>d.objectGames[0].participants[0].skill=2,d=>d.objects[0].shape='box',d=>d.objects=Array(65).fill(d.objects[0])]){const bad=structuredClone(d);change(bad);assert.equal(validateDocument(bad).valid,false);}
});
test('grips require reach and one owner; transfers require current ownership and release preserves velocity',()=>{
 const d=bare(),c=new SceneController(d),o=c.objects,ball=o.bodies[0],f=c.frame(),hand={actor:'pip',joint:'rightWrist'},p=objectGrip(d,f,hand);assert.equal(o.command({type:'attach',object:'ball',actor:'fern',joint:'leftWrist'},f),false);o.command({type:'place',object:'ball',x:p.x,y:p.y},f);assert.equal(o.command({type:'attach',object:'ball',...hand},f),true);assert.equal(o.command({type:'attach',object:'ball',...hand},f),false);assert.equal(o.command({type:'transfer',object:'ball',from:'fern',...hand},f),false);assert.equal(o.command({type:'transfer',object:'ball',from:'pip',...hand},f),true);o.command({type:'release',object:'ball',actor:'pip',vx:123,vy:-45},f);assert.equal(ball.owner,null);assert.equal(ball.vx,123);assert.equal(ball.vy,-45);c.dispose();
});
test('fast circles hit thin rotated obstacles; collision filters and snapshots preserve bounded simulation',()=>{
 const d=bare();d.objectPhysics.gravity=0;d.props=[{id:'wall',name:'Wall',x:400,y:220,width:4,height:300,rotation:10,fill:'#445566',collider:{enabled:true,width:4,height:300,x:0,y:0,friction:.5,bounce:.8}}];const c=new SceneController(d),o=c.objects;o.command({type:'place',object:'ball',x:350,y:220},c.frame());o.command({type:'impulse',object:'ball',vx:2000},c.frame());for(let i=0;i<10;i++)c.tick();assert.ok(o.bodies[0].vx<0);const snapshot=o.snapshot();for(let i=0;i<20;i++)c.tick();const result=o.snapshot();o.restore(snapshot);for(let i=0;i<20;i++)o.tick(1/120,c.frame());assert.deepEqual(o.snapshot(),result);assert.ok(o.events.length<=128);c.dispose();
});
test('catch runs catches, misses, actual retrieval and return throws; reset and checkpoints replay',()=>{
 const d=createCatch(),events=[],c=new SceneController(d);c.subscribe(e=>events.push(e.type));for(let i=0;i<120*35;i++)c.tick();const f=c.frame(),g=f.objectGames[0];assert.ok(g.catches>=1&&g.misses>=1&&g.throws>=4);assert.ok(events.includes('retrieve'));assert.ok(f.actors.every(a=>Object.values(a.pose).every(Number.isFinite)));const before=structuredClone(f.objects);c.seek(35);assert.deepEqual(c.frame().objects,before);c.dispose();
});
test('interception predicts the descending chest crossing and reports unreachable heights',()=>{
 const p=predictIntercept({x:0,y:100,vx:100,vy:-200},400,100,{damping:0,step:1/120});assert.ok(Math.abs(p.time-1)<.02);assert.ok(Math.abs(p.x-100)<2);assert.equal(predictIntercept({x:0,y:100,vx:100,vy:0},400,0),null);
});
