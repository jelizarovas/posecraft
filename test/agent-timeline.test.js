import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {inspectScene,proposeSceneEdit,applySceneProposal} from '../src/agent-authoring.js';
import {retimeSceneClip} from '../src/timeline-editing.js';

function fixture(){
 const d=createDrawing(),p=d.packs.drawing;
 for(const [id,parent,x]of [['upper','root',0],['lower','upper',20],['hand','lower',20]])p.joints.push({id,parent,x,y:0,length:20,rotation:0,min:-180,max:180});
 p.clips.idle={duration:2,loop:false,tracks:{'root.rotation':[[0,0],[1,20],[2,0]]},events:[{time:.5,name:'envelope:release'},{time:1.5,name:'land'}]};
 d.requiredFeatures=['contacts','contact-targets'];d.contacts=[{id:'grip',name:'Hand support',enabled:true,actor:'character',chain:{upper:'upper',lower:'lower',end:'hand'},target:{type:'point',x:30,y:0},bend:1,weight:1,start:.2,end:1.8,fadeIn:.2,fadeOut:.3,period:2,clip:'idle'}];return d;
}

test('semantic inspection returns independent marker descriptions',()=>{
 const d=fixture(),before=structuredClone(d),info=inspectScene(d);assert.deepEqual(info.packs.drawing.clips.idle.events,d.packs.drawing.clips.idle.events);info.packs.drawing.clips.idle.events[0].name='changed';info.packs.drawing.clips.idle.events.push({time:2,name:'extra'});assert.deepEqual(d,before);delete d.packs.drawing.clips.idle.events;assert.deepEqual(inspectScene(d).packs.drawing.clips.idle.events,[]);
});

test('create-clip accepts markers through shared validation without mutating inputs',()=>{
 const d=fixture(),before=structuredClone(d),operation={type:'create-clip',pack:'drawing',id:'wave',duration:1,tracks:{'root.rotation':[[0,0],[1,20]]},events:[{time:.25,name:'start'},{time:.75,name:'envelope:release'}]},request=structuredClone(operation),proposal=proposeSceneEdit(d,{expectedRevision:d.revision,operations:[operation]}),next=applySceneProposal(d,proposal);
 assert.deepEqual(next.packs.drawing.clips.wave.events,operation.events);assert.deepEqual(d,before);assert.deepEqual(operation,request);operation.events[0].name='changed after proposal';assert.equal(applySceneProposal(d,proposal).packs.drawing.clips.wave.events[0].name,'start');
 for(const events of [null,[{time:NaN,name:'bad'}],[{time:2,name:'past-end'}],[{time:.5,name:' ' }],[{time:.5,name:'bad\nname'}],[{time:.5,name:'duplicate'},{time:.5,name:'duplicate'}],[{time:.7,name:'later'},{time:.2,name:'earlier'}],Array.from({length:129},(_,i)=>({time:i/129,name:'event-'+i}))]){
  assert.throws(()=>proposeSceneEdit(d,{expectedRevision:d.revision,operations:[{...request,events}]}));assert.deepEqual(d,before);
 }
});

test('semantic retime delegates one revision-safe transaction including markers and contacts',()=>{
 const d=fixture(),before=structuredClone(d),request={expectedRevision:d.revision,operations:[{type:'retime-clip',pack:'drawing',id:'idle',duration:4}]},direct=retimeSceneClip(d,{packId:'drawing',clipId:'idle',duration:4}),proposal=proposeSceneEdit(d,request),next=applySceneProposal(d,proposal);
 assert.deepEqual(proposal.commands,direct.commands);assert.equal(proposal.expectedRevision,direct.expectedRevision);assert.deepEqual(proposal.summary[0].notes,direct.notes);assert.equal(proposal.summary[0].type,'retime-clip');assert.equal(proposal.diagnostics.valid,true);assert.deepEqual(next,direct.document);assert.equal(next.revision,d.revision+1);
 assert.deepEqual(next.packs.drawing.clips.idle.events,[{time:1,name:'envelope:release'},{time:3,name:'land'}]);assert.equal(next.contacts[0].start,.4);assert.equal(next.contacts[0].end,3.6);assert.equal(next.contacts[0].fadeIn,.4);assert.equal(next.contacts[0].fadeOut,.6);assert.equal(next.contacts[0].period,4);assert.deepEqual(d,before);
 const applied=structuredClone(next);assert.throws(()=>applySceneProposal(next,proposal),/Revision conflict/);assert.deepEqual(next,applied);assert.throws(()=>proposeSceneEdit(d,{...request,expectedRevision:d.revision+1}),/Revision conflict/);assert.deepEqual(d,before);
});

test('retime refuses mixed operations and invalid timing without partial changes',()=>{
 const d=fixture(),before=structuredClone(d),retime={type:'retime-clip',pack:'drawing',id:'idle',duration:4},create={type:'create-clip',pack:'drawing',id:'new',duration:1,tracks:{}};
 for(const operations of [[retime,create],[create,retime],[retime,retime]])assert.throws(()=>proposeSceneEdit(d,{expectedRevision:d.revision,operations}),/only operation/);
 for(const patch of [{duration:NaN},{duration:.05},{duration:181},{pack:'missing'},{id:'missing'}])assert.throws(()=>proposeSceneEdit(d,{expectedRevision:d.revision,operations:[{...retime,...patch}]}));assert.deepEqual(d,before);
});
