import test from 'node:test';
import assert from 'node:assert/strict';
import {solveContact,applyContacts} from '../src/contacts.js';
import {forwardKinematics} from '../src/index.js';
import {poseDefaults,spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';
import {validateDocument,assertDocument} from '../src/schema.js';
import {DocumentStore} from '../src/commands.js';
import {EpisodeController} from '../src/episode.js';
import {removeSceneEntity,removeGroup} from '../src/scene-graph.js';

const chain={upper:'upper',lower:'lower',end:'end'};
const near=(a,b,epsilon=.05)=>assert.ok(Math.abs(a-b)<epsilon,`${a} differs from ${b}`);
function fixture(){
 const joint=(id,parent,x,y)=>({id,parent,x,y,rotation:0,min:-180,max:180,length:20});
 const pack={spatial:true,joints:[joint('root',null,0,0),joint('upper','root',0,0),joint('lower','upper',20,0),joint('end','lower',20,0)],parts:[{id:'line',joint:'upper',d:'M0 0L20 0',fill:'none',stroke:'#000000'}],inputs:{},clips:{idle:{duration:2,loop:true,tracks:{}},reach:{duration:180,loop:false,tracks:{'root.x':[[0,0],[180,10]]}}},initial:'idle',states:{idle:{clip:'idle',transitions:[]},reach:{clip:'reach',transitions:[]}}};
 return {schemaVersion:1,kind:'scene',id:'contacts-test',name:'Contact test',revision:0,bounds:{width:400,height:300},packs:{rig:pack},actors:[{id:'a',name:'A',pack:'rig',transform:{x:0,y:0,rotation:0,scale:1},appearance:{}}],contacts:[{id:'plant',name:'Plant',enabled:true,actor:'a',chain:{...chain},target:{type:'point',x:20,y:20},bend:1,weight:1,start:0,end:180}]};
}
function base(d){const bare={...d,contacts:[]};return new SceneController(bare).frame();}

test('reachable contacts choose either bend side and preserve flat hand orientation',()=>{
 const d=fixture(),pack=d.packs.rig,source=poseDefaults(pack);
 for(const bend of [-1,1]){const r=solveContact(pack,source,chain,{x:20,y:20},{bend});near(r.actual.x,20);near(r.actual.y,20);assert.ok(r.pose['lower.rotation']*bend>0);near(forwardKinematics(pack.joints,r.pose).end.rotation,0,.1);assert.equal(r.limited,false);}
 assert.deepEqual(source,poseDefaults(pack));
 const noCompensation=solveContact(pack,source,chain,{x:20,y:20},{keepOrientation:false});assert.equal(noCompensation.pose['end.rotation'],0);
});

test('scene contacts honor evaluated actor placements and target joint local offsets',()=>{
 const d=fixture();d.actors.push({...structuredClone(d.actors[0]),id:'b',name:'B'});
 const f=base(d);f.actors[0].placement={x:100,y:100,rotation:90,scale:2};f.actors[1].placement={x:50,y:130,rotation:90,scale:1};
 d.contacts[0].target={type:'joint',actor:'b',joint:'root',offsetX:10,offsetY:-10};
 const original=structuredClone(f),r=applyContacts(d,f),diag=r.contacts[0];near(diag.target.x,60);near(diag.target.y,140);near(diag.actual.x,60);near(diag.actual.y,140);assert.ok(diag.active);
 assert.deepEqual(r.actors[0].world,forwardKinematics(d.packs.rig.joints,r.actors[0].pose));assert.deepEqual(f,original);
});

test('projected chains preserve yaw, pitch and translation while reaching rendered endpoint',()=>{
 const pack=fixture().packs.rig,source={...poseDefaults(pack),'root.yaw':35,'upper.pitch':20,'lower.yaw':-25,'lower.y':3,'end.y':-2};
 const authored={...source,'upper.rotation':25,'lower.rotation':65},target=spatialKinematics(pack,authored).end,r=solveContact(pack,source,chain,target);
 assert.ok(r.error<.2,`Projected error ${r.error}`);for(const k of ['root.yaw','upper.pitch','lower.yaw','lower.y','end.y'])assert.equal(r.pose[k],source[k]);
 const actual=spatialKinematics(pack,r.pose).end;near(r.actual.x,actual.x);near(r.actual.y,actual.y);
 const singular=solveContact(pack,{...source,'root.yaw':90},chain,{x:100,y:100});assert.ok(Object.values(singular.pose).every(Number.isFinite));assert.equal(singular.limited,true);
});

test('unreachable targets and restricted joints stay finite and report limits; weight blends',()=>{
 const pack=fixture().packs.rig,source=poseDefaults(pack),target={x:20,y:20},full=solveContact(pack,source,chain,target),half=solveContact(pack,source,chain,target,{weight:.5}),zero=solveContact(pack,source,chain,target,{weight:0});
 near(half.pose['lower.rotation'],full.pose['lower.rotation']/2);assert.deepEqual(zero.pose,source);assert.ok(half.error>full.error);
 pack.joints[1].min=-10;pack.joints[1].max=10;pack.joints[2].min=-20;pack.joints[2].max=20;
 for(const p of [{x:500,y:500},{x:0,y:0}]){const r=solveContact(pack,source,chain,p);assert.ok(Math.abs(r.pose['upper.rotation'])<=10);assert.ok(Math.abs(r.pose['lower.rotation'])<=20);assert.ok(Object.values(r.pose).every(Number.isFinite));assert.equal(r.limited,true);}
});

test('already authored contacts avoid changing pose within contact tolerance',()=>{
 const pack=fixture().packs.rig,pose={...poseDefaults(pack),'upper.rotation':20,'lower.rotation':60,'end.rotation':-80},end=spatialKinematics(pack,pose).end;
 assert.deepEqual(solveContact(pack,pose,chain,{x:end.x+.01,y:end.y}).pose,pose);
});

test('clip-local windows, preview, clip filters and physical actors disable contacts explicitly',()=>{
 const d=fixture();d.contacts[0].start=.5;d.contacts[0].end=1;d.contacts[0].clip='reach';const c=new SceneController(d);
 assert.equal(c.frame().contacts[0].reason,'clip');c.previewClip('a','reach',.75);assert.equal(c.frame().contacts[0].active,true);c.previewClip('a','reach',1.2);assert.equal(c.frame().contacts[0].reason,'outside-window');
 const f=base(d);f.actors[0].clip='reach';f.actors[0].clipTime=.75;
 for(const key of ['physics','recovery']){const physical=structuredClone(f);physical.actors[0][key]={};const r=applyContacts(d,physical);assert.equal(r.contacts[0].reason,'physics');assert.deepEqual(r.actors[0].pose,f.actors[0].pose);}
 d.contacts[0].enabled=false;assert.equal(applyContacts(d,f).contacts[0].reason,'disabled');
 d.contacts[0].enabled=true;d.contacts[0].weight=0;assert.equal(applyContacts(d,f).contacts[0].reason,'weight');
 delete d.contacts[0].clip;d.contacts[0].weight=1;const looping=new SceneController(d);assert.equal(looping.seek(2.75).contacts[0].active,true);
});

test('contacts survive transactional save and arbitrary seek order without pose feedback',()=>{
 const d=fixture(),store=new DocumentStore(d);store.transact([{op:'set',path:['contacts',0,'target','x'],value:25}]);store.undo();assert.deepEqual(store.document.contacts,d.contacts);store.redo();
 const c=new SceneController(JSON.parse(JSON.stringify(store.document))),expected=c.seek(1.5);c.seek(.5);assert.deepEqual(c.seek(1.5),expected);assert.ok(expected.contacts[0].error<.05);
});

test('serialized constraints reject malformed chains, targets, windows and unsupported clips',()=>{
 assertDocument(fixture());for(const corrupt of [d=>d.contacts[0].chain.lower='root',d=>d.contacts[0].target={type:'joint',actor:'missing',joint:'end'},d=>d.contacts[0].target={type:'joint',actor:'a',joint:'missing'},d=>d.contacts[0].weight=2,d=>d.contacts[0].period=0,d=>d.contacts[0].period=181,d=>d.contacts[0].bend=0,d=>d.contacts[0].start=181,d=>d.contacts[0].end=-1,d=>d.contacts[0].clip='missing',d=>d.contacts.push(structuredClone(d.contacts[0])),d=>d.contacts=Array.from({length:17},(_,i)=>({...d.contacts[0],id:'contact-'+i}))]){const d=fixture();corrupt(d);assert.equal(validateDocument(d).valid,false,corrupt.toString());}
});

test('180-second clips and bounded seek support long workouts and late replay events',()=>{
 const d=fixture(),c=new SceneController(d);assertDocument(d);const f=c.seek(180);near(f.time,180,1e-6);assert.throws(()=>c.seek(180.1),/180/);c.seek(90);c.setAcceleration(10,0);assert.equal(c.log.at(-1).type,'acceleration');assert.ok(c.log.at(-1).time>89);
 d.packs.rig.clips.reach.duration=180.1;assert.equal(validateDocument(d).valid,false);
});


test('periodic contact windows repeat within long clips without duplicating constraints',()=>{
 const d=fixture();Object.assign(d.contacts[0],{clip:'reach',start:10,end:20,period:60});assertDocument(d);const c=new SceneController(d);
 for(const time of [15,75,135]){c.previewClip('a','reach',time);assert.equal(c.frame().contacts[0].active,true);}
 for(const time of [0,30,60,125,180]){c.previewClip('a','reach',time);assert.equal(c.frame().contacts[0].reason,'outside-window');}
});

test('Director evaluates contact anchors after placement animation and clip speed/offset',()=>{
 const d=fixture();d.actors.push({...structuredClone(d.actors[0]),id:'b',name:'B'});d.contacts[0].target={type:'joint',actor:'b',joint:'root'};Object.assign(d.contacts[0],{clip:'reach',start:10,end:20});
 const project={schemaVersion:1,kind:'episode',id:'contact-episode',name:'Contact episode',revision:0,fps:30,size:{width:400,height:300},scenes:{scene:d},shots:[{id:'shot',name:'Shot',scene:'scene',duration:10,camera:{x:[[0,0]],y:[[0,0]],zoom:[[0,1]],rotation:[[0,0]]},actors:{a:{clip:'reach',offset:5,speed:2,placement:{x:[[0,100]],y:[[0,100]],scale:[[0,2]],rotation:[[0,90]]}},b:{clip:'idle',offset:0,speed:1,placement:{x:[[0,55],[10,65]],y:[[0,140]]}}}}]};
 const controller=new EpisodeController(project);assert.equal(controller.frame(0).contacts[0].reason,'outside-window');const frame=controller.frame(5);assert.equal(frame.actors[0].clipTime,15);near(frame.contacts[0].target.x,60);near(frame.contacts[0].actual.x,60);near(frame.contacts[0].actual.y,140);assert.deepEqual(controller.frame(5),new EpisodeController(project).frame(5));
});

test('mutual joint targets read the base frame and never feed solved pose back into anchors',()=>{
 const d=fixture();d.actors.push({...structuredClone(d.actors[0]),id:'b',name:'B',transform:{x:0,y:20,rotation:0,scale:1}});d.contacts[0].target={type:'joint',actor:'b',joint:'end'};d.contacts.push({...structuredClone(d.contacts[0]),id:'other',actor:'b',target:{type:'joint',actor:'a',joint:'end'}});
 const frame=base(d),r=applyContacts(d,frame);assert.deepEqual(r.contacts[0].target,{x:40,y:20});assert.deepEqual(r.contacts[1].target,{x:40,y:0});const reversed=applyContacts({...d,contacts:[...d.contacts].reverse()},frame);assert.deepEqual(r.actors,reversed.actors);
});


test('actor deletion cleans source and target contacts while folder deletion preserves them',()=>{
 const d=fixture();d.groups=[{id:'folder',name:'Folder',parent:null}];d.actors[0].group='folder';d.actors.push({...structuredClone(d.actors[0]),id:'b',name:'B'});d.contacts.push({...structuredClone(d.contacts[0]),id:'other',actor:'b',target:{type:'joint',actor:'a',joint:'end'}});
 const ungrouped=removeGroup(d,'folder');assert.deepEqual(ungrouped.contacts,d.contacts);assertDocument(ungrouped);const removed=removeSceneEntity(d,'actor','a');assert.deepEqual(removed.contacts,[]);assertDocument(removed);assert.equal(d.contacts.length,2);
});
