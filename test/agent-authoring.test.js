import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createDrawing} from '../src/vector-authoring.js';
import {proposeSceneEdit,applySceneProposal,diagnoseScene,inspectScene} from '../src/agent-authoring.js';
import {createAgentService} from '../tools/agent-service.mjs';

export function authoringFixture(){const d=createDrawing(),p=d.packs.drawing;for(const [id,parent,x]of [['upper','root',0],['lower','upper',20],['hand','lower',20]])p.joints.push({id,parent,x,y:0,length:20,rotation:0,min:-180,max:180});p.parts=[{id:'body',joint:'root',d:'M0 0H40V40H0Z',fill:'#7354ba'}];return d;}
const operations=()=>[{type:'create-clip',pack:'drawing',id:'wave',duration:1,tracks:{'root.rotation':[[0,0],[1,30]]}},{type:'create-contact',value:{id:'grip',name:'Hand support',enabled:true,actor:'character',chain:{upper:'upper',lower:'lower',end:'hand'},target:{type:'point',x:30,y:0},bend:1,weight:1,start:0,end:1,clip:'wave'}},{type:'create-interaction',value:{id:'tap',actor:'character',gesture:'click',response:'event',event:'hello',resistance:0}}];
test('semantic builders produce reviewable atomic transactions and preserve originals',()=>{
 const d=authoringFixture(),before=structuredClone(d),proposal=proposeSceneEdit(d,{expectedRevision:0,operations:operations()});assert.deepEqual(d,before);assert.equal(proposal.commands[0].path.join('.'),'packs.drawing.clips.wave');assert.equal(proposal.summary.length,3);const edited=applySceneProposal(d,proposal);assert.equal(edited.revision,1);assert.ok(edited.packs.drawing.clips.wave);assert.equal(edited.contacts[0].id,'grip');assert.equal(edited.interactions[0].id,'tap');assert.ok(edited.requiredFeatures.includes('contacts'));assert.equal(inspectScene(edited).revision,1);assert.throws(()=>applySceneProposal(edited,proposal),/Revision conflict/);
 for(const request of [{expectedRevision:3,operations:operations()},{operations:operations()},{expectedRevision:0,operations:[{type:'generate-cycle'}]},{expectedRevision:0,operations:[{...operations()[0],id:'idle'}]},{expectedRevision:0,operations:[{...operations()[0],tracks:{'missing.rotation':[[0,1]]}}]},{expectedRevision:0,operations:[{...operations()[1],value:{...operations()[1].value,actor:'missing'}}]},{expectedRevision:0,operations:[{...operations()[2],value:{...operations()[2].value,event:'bad event'}}]}]){assert.throws(()=>proposeSceneEdit(d,request));assert.deepEqual(d,before);}
 const bad=structuredClone(proposal);bad.commands=[{op:'set',path:['revision'],value:9}];assert.throws(()=>applySceneProposal(d,bad));assert.deepEqual(d,before);
});
test('diagnostics separate structural reachability and rapid curves from authored steps',()=>{
 const d=authoringFixture(),p=d.packs.drawing;p.states.unreachable={clip:'idle'};p.clips.idle.tracks['root.rotation']=[[0,0],[.001,90],[2,0]];let report=diagnoseScene(d);assert.ok(report.diagnostics.some(v=>v.code==='unreachable-state'));assert.ok(report.diagnostics.some(v=>v.code==='rapid-track-change'));p.clips.idle.tracks['root.rotation'][0][2]='step';report=diagnoseScene(d);assert.ok(!report.diagnostics.some(v=>v.code==='rapid-track-change'));assert.equal(diagnoseScene({}).valid,false);assert.throws(()=>diagnoseScene(d,{maxDiagnostics:10000}));
});

test('semantic contact creation declares object, prop and fade capabilities atomically',()=>{
 for(const patch of [{target:{type:'object',object:'gift'}},{target:{type:'prop',prop:'handle'}},{fadeIn:.2},{fadeOut:0}]){
  const d=authoringFixture();d.requiredFeatures=['scene-objects'];d.objects=[{id:'gift',name:'Gift',shape:'circle',x:30,y:0,radius:4,mass:1,fill:'#abcdef'}];d.props=[{id:'handle',name:'Handle',x:30,y:0,width:10,height:10,rotation:0,fill:'#abcdef',collider:{enabled:false,x:0,y:0,width:10,height:10,friction:0,bounce:0}}];
  const contact={...operations()[1].value,...patch};delete contact.clip;const before=structuredClone(d),proposal=proposeSceneEdit(d,{expectedRevision:0,operations:[{type:'create-contact',value:contact}]}),result=applySceneProposal(d,proposal);
  assert.deepEqual(d,before);assert.ok(result.requiredFeatures.includes('contacts'));assert.ok(result.requiredFeatures.includes('contact-targets'));assert.ok(result.requiredFeatures.includes('scene-objects'));assert.deepEqual(result.contacts,[contact]);assert.equal(result.revision,1);
 }
 const legacy=applySceneProposal(authoringFixture(),proposeSceneEdit(authoringFixture(),{expectedRevision:0,operations:operations()}));assert.equal(legacy.requiredFeatures.includes('contact-targets'),false);
});

test('scene inspection exposes independent object and attached prop target descriptions',()=>{
 const d=authoringFixture();d.requiredFeatures=['scene-objects','prop-attachments'];d.objects=[{id:'gift',name:'Gift',shape:'circle',x:30,y:20,radius:4,mass:1,fill:'#abcdef',owner:{actor:'character',joint:'hand'}}];d.props=[{id:'ribbon',name:'Ribbon',x:0,y:0,width:10,height:10,rotation:0,fill:'#abcdef',attachment:{type:'object',object:'gift',offsetY:-4},collider:{enabled:false,x:0,y:0,width:10,height:10,friction:0,bounce:0}}];
 const before=structuredClone(d),inspected=inspectScene(d);assert.equal(inspected.objects[0].id,'gift');assert.deepEqual(inspected.objects[0].owner,{actor:'character',joint:'hand'});assert.equal(inspected.props[0].id,'ribbon');assert.deepEqual(inspected.props[0].attachment,{type:'object',object:'gift',offsetY:-4});
 inspected.objects[0].owner.joint='root';inspected.props[0].attachment.offsetY=99;inspected.props[0].collider.enabled=true;inspected.objects.pop();assert.deepEqual(d,before);assert.deepEqual(inspectScene(authoringFixture()).objects,[]);assert.deepEqual(inspectScene(authoringFixture()).props,[]);
});

test('agent simulation preserves unavailable contact diagnostics without numeric errors',async()=>{
 await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/agent-contact-')),service=await createAgentService(root),d=authoringFixture();d.requiredFeatures=['contacts','contact-targets'];d.props=[{id:'hidden-handle',name:'Hidden handle',hidden:true,x:20,y:20,width:10,height:10,rotation:0,fill:'#abcdef',collider:{enabled:false,x:0,y:0,width:10,height:10,friction:0,bounce:0}}];d.contacts=[{...operations()[1].value,target:{type:'prop',prop:'hidden-handle'}}];delete d.contacts[0].clip;
 await fs.writeFile(path.join(root,'scene.json'),JSON.stringify(d));const result=await service.simulate({file:'scene.json',duration:.1,samples:2}),contact=result.frame.contacts[0];assert.equal(contact.reason,'target-unavailable');assert.equal(contact.error,null);assert.equal(contact.target,null);assert.equal(contact.weight,0);assert.equal(result.diagnostics.some(d=>d.code==='contact-error'),false);assert.ok(!JSON.stringify(result).includes('NaN'));
});
test('file service rejects stale content, unsafe paths and overwrite while preserving source',async()=>{
 await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/agent-service-')),service=await createAgentService(root),d=authoringFixture(),bytes=JSON.stringify(d);await fs.writeFile(path.join(root,'scene.json'),bytes);await service.propose({file:'scene.json',expectedRevision:0,operations:operations(),output:'proposal.json'});
 const candidate=await service.validate({file:'scene.json',proposal:'proposal.json'});assert.equal(candidate.valid,true);await assert.rejects(()=>service.apply({file:'scene.json',proposal:'proposal.json',output:'scene.json'}),/separate|EEXIST/);assert.equal(await fs.readFile(path.join(root,'scene.json'),'utf8'),bytes);
 await service.apply({file:'scene.json',proposal:'proposal.json',output:'edited.json'});assert.equal(JSON.parse(await fs.readFile(path.join(root,'edited.json'),'utf8')).revision,1);await assert.rejects(()=>service.apply({file:'scene.json',proposal:'proposal.json',output:'edited.json'}),/EEXIST/);await assert.rejects(()=>service.inspect({file:'../outside.json'}),/outside/);
 await fs.writeFile(path.join(root,'scene.json'),bytes+'\n');await assert.rejects(()=>service.apply({file:'scene.json',proposal:'proposal.json',output:'stale.json'}),/Source content changed/);await assert.rejects(()=>fs.stat(path.join(root,'stale.json')),/ENOENT/);
 const simulation=await service.simulate({file:'edited.json',duration:.1,samples:3});assert.ok(simulation.time>=.099);assert.equal(simulation.revision,1);await assert.rejects(()=>service.simulate({file:'edited.json',duration:61}),/0..60/);await assert.rejects(()=>service.simulate({file:'edited.json',events:[{time:0,type:'execute',code:'bad'}]}),/supported events/);
 await service.preview({file:'edited.json',output:'frame.svg',time:0,preview:{actor:'character',clip:'wave',time:.5}});assert.ok((await fs.readFile(path.join(root,'frame.svg'),'utf8')).startsWith('<svg'));assert.equal((await fs.readdir(root)).some(name=>name.endsWith('.tmp')),false);
});
