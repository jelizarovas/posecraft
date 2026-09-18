import test from 'node:test';
import assert from 'node:assert/strict';
import {validateScene3D,assertScene3D} from '../src/scene-3d-schema.js';
import {validateDocument} from '../src/schema.js';
import {createBenchContact3D} from '../examples/bench-contact-3d.js';

test('native scene is independent plain data with stable semantic anchors',()=>{
 const position=[1,.5,-2],d=createBenchContact3D({height:1.9,benchPosition:position,benchYaw:.7}),before=structuredClone(d);assert.deepEqual(validateScene3D(d),{valid:true,errors:[]});assert.equal(assertScene3D(d),d);assert.deepEqual(d,before);assert.equal(validateDocument(d).valid,false);position[0]=99;assert.equal(d.objects[0].transform.position[0],1);assert.equal(d.contacts[0].chain,'left-arm');assert.equal(d.contacts[0].target.anchor,'bar-left');
 const small=createBenchContact3D({height:1.5}),large=createBenchContact3D({height:2});assert.ok(large.rigs['bench-person'].joints[4].position[0]<small.rigs['bench-person'].joints[4].position[0]);assert.deepEqual(small.objects,large.objects);assert.notDeepEqual(small.actors[0].transform.position,large.actors[0].transform.position);
});

test('validation reports paths for invalid transforms, references and local data',()=>{
 const cases=[
  [d=>d.kind='scene','$.kind'],[d=>d.units='pixels','$.units'],[d=>d.up='Z','$.up'],[d=>d.revision=-1,'$.revision'],[d=>d.extra=true,'$.extra'],
  [d=>d.actors[0].transform.rotation=[0,0,0,2],'$.actors.0.transform.rotation'],[d=>d.actors[0].transform.scale=0,'$.actors.0.transform.scale'],[d=>d.actors[0].transform.position=[0,NaN,0],'$.actors.0.transform.position.1'],
  [d=>d.objects[0].geometry.size=[1,0,1],'$.objects.0.geometry.size'],[d=>d.objects[0].transform.rotation=[0,0,0,.99],'$.objects.0.transform.rotation'],[d=>d.objects[0].anchors.bad={position:[0,0,0],rotation:[0,0,0,0]},'$.objects.0.anchors.bad.rotation'],
  [d=>d.actors[0].rig='missing','$.actors.0.rig'],[d=>d.actors[0].pose.missing={position:[0,0,0]},'$.actors.0.pose.missing'],[d=>d.actors[0].pose.pelvis={yaw:1},'$.actors.0.pose.pelvis.yaw'],
  [d=>d.contacts[0].target.anchor='missing','$.contacts.0.target.anchor'],[d=>d.contacts[0].target.object='missing','$.contacts.0.target.object'],[d=>d.contacts[0].chain='unknown','$.contacts.0.chain'],[d=>d.contacts[0].actor='missing','$.contacts.0.actor'],
  [d=>d.camera.target=d.camera.position.slice(),'$.camera.target'],[d=>d.camera.projection='perspective','$.camera.projection']
 ];
 for(const [change,path]of cases){const d=createBenchContact3D();change(d);const before=structuredClone(d),result=validateScene3D(d);assert.equal(result.valid,false,path);assert.ok(result.errors.some(e=>e.path===path),JSON.stringify(result.errors));assert.throws(()=>assertScene3D(d),/Invalid 3D scene/);assert.deepEqual(d,before);}
});

test('rig topology, lengths, bend limits and duplicate ownership are validated',()=>{
 for(const mutate of [r=>r.joints[0].parent='head',r=>r.joints[1].parent='head',r=>r.joints[4].parent='pelvis',r=>r.joints[4].position=[0,0,0],r=>r.joints[2].id='torso',r=>r.joints[1].parent='missing',r=>r.chains['left-arm'].bend={min:2,max:1},r=>r.chains['left-arm'].bend.max=4,r=>r.chains['left-arm'].pole=[1,2]]){const d=createBenchContact3D();mutate(d.rigs['bench-person']);assert.equal(validateScene3D(d).valid,false);}
 const d=createBenchContact3D();d.contacts.push({...structuredClone(d.contacts[0]),id:'duplicate-target'});assert.ok(validateScene3D(d).errors.some(e=>e.path==='$.contacts.2.chain'));d.contacts[2].enabled=false;assert.equal(validateScene3D(d).valid,true);
});

test('strict JSON and resource limits reject hostile structures without evaluating getters',()=>{
 for(const modify of [d=>d.objects[0].geometry=new Date(),d=>d.contacts.push(undefined),d=>d.objects[0].geometry.callback=()=>{},d=>d.objects[0].geometry.self=d.objects[0].geometry,d=>d.camera.position=Array(3),d=>d.objects[0].anchors[Symbol('hidden')]=true,d=>d.actors=Array.from({length:65},(_,i)=>({...d.actors[0],id:'actor-'+i})),d=>d.rigs['bench-person'].joints=Array.from({length:129},(_,i)=>({id:'joint-'+i,parent:i?'joint-0':null,position:[0,1,0],rotation:[0,0,0,1]}))]){const d=createBenchContact3D();modify(d);assert.equal(validateScene3D(d).valid,false);}
 const d=createBenchContact3D();let calls=0;Object.defineProperty(d,'name',{enumerable:true,get(){calls++;throw Error('getter invoked');}});assert.equal(validateScene3D(d).valid,false);assert.equal(calls,0);
 assert.equal(validateScene3D(JSON.parse('{"__proto__":{}}')).valid,false);assert.equal(validateScene3D({kind:'scene',schemaVersion:1}).valid,false);
});

test('fixture options are bounded and validated before generation',()=>{
 for(const options of [{height:NaN},{height:0},{benchPosition:[1,2]},{benchPosition:[0,Infinity,0]},{benchYaw:Infinity}])assert.throws(()=>createBenchContact3D(options));
});

test('validation is total for malformed JSON at every structural level',()=>{
 const values=[null,false,4,'bad',[],{},[0,{toString:null},0],{toString:null},[1,2,3,4,5]],paths=[[],['rigs'],['rigs','bench-person'],['rigs','bench-person','joints'],['rigs','bench-person','joints',4],['rigs','bench-person','joints',4,'position'],['rigs','bench-person','chains'],['rigs','bench-person','chains','left-arm','bend'],['actors'],['actors',0],['actors',0,'pose'],['objects'],['objects',0,'anchors'],['contacts'],['contacts',0,'target'],['camera'],['camera','position']];
 for(const path of paths)for(const value of values){let d=createBenchContact3D();if(!path.length)d=value;else{let parent=d;for(const key of path.slice(0,-1))parent=parent[key];parent[path.at(-1)]=structuredClone(value);}let result;assert.doesNotThrow(()=>result=validateScene3D(d),JSON.stringify(path));assert.equal(typeof result.valid,'boolean');assert.ok(Array.isArray(result.errors));assert.ok(result.errors.length<=100);}
 const d=createBenchContact3D();d.rigs['bench-person'].joints[4].position=[0,{toString:null},0];assert.ok(validateScene3D(d).errors.some(e=>e.path==='$.rigs.bench-person.joints.4.position'));
 const inaccessible=new Proxy({}, {ownKeys(){throw Error('not JSON');}});assert.equal(validateScene3D(inaccessible).valid,false);
 const longKey=createBenchContact3D();longKey['x'.repeat(10000)]='bad';const bounded=validateScene3D(longKey);assert.equal(bounded.valid,false);assert.ok(bounded.errors.every(e=>e.path.length<=512));
});
