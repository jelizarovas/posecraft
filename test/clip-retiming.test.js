import test from 'node:test';
import assert from 'node:assert/strict';
import {retimeSceneClip} from '../src/timeline-editing.js';
import {DocumentStore} from '../src/commands.js';
import {createDrawing} from '../src/vector-authoring.js';
import {sampleClip} from '../src/index.js';

function fixture(){
 const d=createDrawing(),p=d.packs.drawing;for(const [id,parent,x]of [['upper','root',0],['lower','upper',20],['hand','lower',20]])p.joints.push({id,parent,x,y:0,length:20,rotation:0,min:-180,max:180});
 p.clips.wave={duration:2,loop:false,tracks:{'root.rotation':[[0,0,'linear'],[.5,30,'step'],[1,-20,'smooth'],[2,0]],'upper.rotation':[[0,0],[2,60]]},events:[{time:.5,name:'hand:ready'},{time:1,name:'grip'},{time:1,name:'sound'}]};
 d.actors.push({...structuredClone(d.actors[0]),id:'second'});d.packs.other=structuredClone(p);d.actors.push({...structuredClone(d.actors[0]),id:'unrelated',pack:'other'});d.requiredFeatures=['contacts','contact-targets'];
 const contact={id:'grip',name:'Grip',enabled:true,actor:'character',chain:{upper:'upper',lower:'lower',end:'hand'},target:{type:'point',x:20,y:20},bend:1,weight:1,clip:'wave',start:.5,end:1.5,fadeIn:.2,fadeOut:.3,period:2};
 d.contacts=[contact,{...structuredClone(contact),id:'second-grip',actor:'second'},{...structuredClone(contact),id:'other-pack',actor:'unrelated'},{...structuredClone(contact),id:'other-clip',clip:'idle'},{...structuredClone(contact),id:'all-clips'}];delete d.contacts.at(-1).clip;return d;
}
const request=duration=>({packId:'drawing',clipId:'wave',duration});
test('whole clip retimes every channel, simultaneous markers and only matching shared-pack contacts',()=>{
 const d=fixture(),before=structuredClone(d),r=retimeSceneClip(d,request(4));assert.deepEqual(d,before);assert.equal(r.scale,2);assert.equal(r.expectedRevision,0);assert.equal(r.document.revision,1);assert.deepEqual(r.contacts,['grip','second-grip']);
 const clip=r.document.packs.drawing.clips.wave;assert.equal(clip.duration,4);assert.deepEqual(clip.tracks['root.rotation'],[[0,0,'linear'],[1,30,'step'],[2,-20,'smooth'],[4,0]]);assert.deepEqual(clip.events,[{time:1,name:'hand:ready'},{time:2,name:'grip'},{time:2,name:'sound'}]);
 assert.deepEqual(r.document.contacts[0],{...d.contacts[0],start:1,end:3,fadeIn:.4,fadeOut:.6,period:4});assert.deepEqual(r.document.contacts.slice(2),d.contacts.slice(2));assert.deepEqual(r.document.packs.other,d.packs.other);assert.ok(r.notes.some(note=>note.includes('Unfiltered')));
 for(const t of [0,.25,.5,.75,1,1.5,2])assert.deepEqual(sampleClip(clip,t*2),sampleClip(d.packs.drawing.clips.wave,t));
 const store=new DocumentStore(d);store.transact(r.commands,r.expectedRevision);assert.deepEqual(store.document,r.document);store.undo();assert.deepEqual(store.document.contacts,d.contacts);store.redo();assert.deepEqual(JSON.parse(JSON.stringify(store.document)).packs.drawing.clips.wave,clip);assert.throws(()=>store.transact(r.commands,r.expectedRevision),/Revision conflict/);
});
test('matching authored-scroll windows scale while transition blends keep wall-clock seconds',()=>{
 const d=fixture();d.packs.drawing.states.wave={clip:'wave'};d.packs.drawing.inputs.go={type:'boolean',default:false};d.packs.drawing.states.idle.transitions=[{to:'wave',duration:.2,when:{input:'go',equals:true}}];d.requiredFeatures.push('scroll-bindings');d.scroll={mode:'authored',clips:[{actor:'character',clip:'wave',start:.5,end:1.5},{actor:'second',clip:'wave'},{actor:'unrelated',clip:'wave',start:.5,end:1.5}]};
 const r=retimeSceneClip(d,request(1));assert.deepEqual(r.document.scroll.clips,[{actor:'character',clip:'wave',start:.25,end:.75},{actor:'second',clip:'wave'},{actor:'unrelated',clip:'wave',start:.5,end:1.5}]);assert.equal(r.document.packs.drawing.states.idle.transitions[0].duration,.2);assert.ok(r.notes.some(n=>n.includes('blend durations')));
});
test('millisecond key, marker and contact collisions reject the whole transaction',()=>{
 for(const change of [d=>d.packs.drawing.clips.wave.tracks['upper.rotation']=[[1,0],[1.001,1]],d=>d.packs.drawing.clips.wave.events=[{time:1,name:'first'},{time:1.001,name:'second'}],d=>Object.assign(d.contacts[0],{start:1,end:1.001,fadeIn:0,fadeOut:0}),d=>d.contacts[0].fadeIn=.001]){
  const d=fixture();change(d);const before=structuredClone(d);assert.throws(()=>retimeSceneClip(d,request(.1)),/merge|collapse/);assert.deepEqual(d,before);
 }
 const d=fixture();for(const duration of [NaN,Infinity,0,.099,180.001,1.0001])assert.throws(()=>retimeSceneClip(d,request(duration)),/Duration/);assert.throws(()=>retimeSceneClip(d,{...request(2),clipId:'absent'}),/existing/);
 d.contacts[0].end=180;assert.throws(()=>retimeSceneClip(d,request(4)),/Contact window|Contact fades/);assert.equal(d.packs.drawing.clips.wave.duration,2);
});
test('live recipe and graph dependencies reject retiming instead of silently moving wall clocks',()=>{
 const d=fixture();d.behaviorGraph={seed:1,variables:{},initial:'idle',states:{idle:{actions:[]}},edges:[],activities:{wave:{actor:'character',variants:[{id:'main',clip:'wave',weight:1,speed:{min:1,max:1}}],success:{base:1,modifiers:[]},onStart:[],onSuccess:[],onFailure:[]}}};d.requiredFeatures.push('behavior-graphs','action-variations');const before=structuredClone(d);assert.throws(()=>retimeSceneClip(d,request(4)),/activity recipe/);assert.deepEqual(d,before);
 delete d.behaviorGraph.activities;assert.throws(()=>retimeSceneClip(d,request(4)),/Live behavior graphs/);d.presentation='sequence';assert.equal(retimeSceneClip(d,request(4)).document.packs.drawing.clips.wave.duration,4);
});
test('only motion layers affecting the selected clip block retiming',()=>{
 const d=fixture();d.motionLayers=[{id:'sway',actor:'character',joint:'root',channel:'rotation',type:'sine',amplitude:3,frequency:1,phase:0,seed:1,clips:['wave']}];d.requiredFeatures.push('motion-layers');assert.throws(()=>retimeSceneClip(d,request(4)),/motion layer/);d.motionLayers[0].clips=['idle'];assert.deepEqual(retimeSceneClip(d,request(4)).document.motionLayers,d.motionLayers);d.motionLayers[0].clips=['wave'];d.motionLayers[0].enabled=false;assert.equal(retimeSceneClip(d,request(4)).document.packs.drawing.clips.wave.duration,4);
});
