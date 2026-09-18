import test from 'node:test';
import assert from 'node:assert/strict';
import {applyContacts} from '../src/contacts.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
import {SceneObjects} from '../src/scene-objects.js';
import {poseDefaults} from '../src/spatial.js';
import {forwardKinematics} from '../src/index.js';
import {validateDocument} from '../src/schema.js';

function fixture(){
 const joint=(id,parent,x)=>({id,parent,x,y:0,rotation:0,min:-180,max:180,length:20});
 return {schemaVersion:1,kind:'scene',id:'moving-grips',name:'Moving grips',revision:0,bounds:{width:400,height:300},requiredFeatures:['contacts','contact-targets','scene-objects'],packs:{rig:{joints:[joint('root',null,0),joint('upper','root',0),joint('lower','upper',20),joint('end','lower',20)],parts:[{id:'arm',joint:'upper',d:'M0 0L20 0',fill:'none',stroke:'#000000'}],inputs:{},clips:{idle:{duration:10,loop:false,tracks:{}}},states:{idle:{clip:'idle',transitions:[]}},initial:'idle'}},actors:[{id:'a',name:'A',pack:'rig',transform:{x:100,y:100,rotation:0,scale:1},appearance:{},behavior:{mode:'animated',autoFace:false}}],objects:[{id:'ball',name:'Ball',shape:'circle',x:120,y:120,radius:4,mass:1,fill:'#abcdef',damping:0}],objectPhysics:{gravity:0,floorY:290,actorCollisions:false},props:[{id:'handle',name:'Handle',x:120,y:110,rotation:90,width:10,height:10,fill:'#abcdef',collider:{enabled:false,x:0,y:0,width:10,height:10,friction:0,bounce:0}}],contacts:[{id:'hold',name:'Hold',enabled:true,actor:'a',chain:{upper:'upper',lower:'lower',end:'end'},target:{type:'object',object:'ball'},bend:1,weight:1,start:0,end:10}]};
}
function frame(d){const pose=poseDefaults(d.packs.rig);return {time:1,actors:[{id:'a',pose,world:forwardKinematics(d.packs.rig.joints,pose),state:'idle',physics:null}],objects:d.objects.map(o=>({...o,visible:true,enabled:true,owner:null}))};}
const near=(a,b,e=.06)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);

test('object and prop target offsets rotate in target space without mutating source data',()=>{
 for(const type of ['object','prop']){
  const d=fixture(),f=frame(d);f.objects[0].x=120;f.objects[0].y=110;f.objects[0].rotation=90;
  d.contacts[0].target={type,[type]:type==='object'?'ball':'handle',offsetX:10,offsetY:0};
  const source=structuredClone({d,f}),r=applyContacts(d,f),c=r.contacts[0];assert.equal(c.active,true);near(c.target.x,120);near(c.target.y,120);near(c.actual.x,120);near(c.actual.y,120);assert.equal(c.weight,1);assert.deepEqual({d,f},source);
 }
});

test('missing, disabled, hidden and self-owned targets are explicitly inactive',()=>{
 for(const change of [f=>f.objects=[],f=>f.objects[0].enabled=false,f=>f.objects[0].visible=false,f=>f.objects[0].hidden=true]){const d=fixture(),f=frame(d);change(f);const c=applyContacts(d,f).contacts[0];assert.equal(c.reason,'target-unavailable');assert.equal(c.target,null);assert.equal(c.error,null);assert.equal(c.weight,0);}
 const d=fixture(),f=frame(d);f.objects[0].owner={actor:'a',joint:'end'};let c=applyContacts(d,f).contacts[0];assert.equal(c.reason,'self-owned-object');assert.deepEqual(applyContacts(d,f).actors,f.actors);
 d.contacts[0].target={type:'prop',prop:'handle'};d.groups=[{id:'hidden',name:'Hidden',parent:null,hidden:true}];d.props[0].group='hidden';assert.equal(applyContacts(d,f).contacts[0].reason,'target-unavailable');delete d.props[0].group;d.props[0].attachment={type:'joint',actor:'a',joint:'end'};assert.equal(applyContacts(d,f).contacts[0].reason,'self-attached-prop');d.props[0].attachment={type:'object',object:'ball'};assert.equal(applyContacts(d,f).contacts[0].reason,'self-owned-object');
});

test('attached prop targets follow another actor unconstrained placement and are order independent',()=>{
 const d=fixture();d.actors.push({...structuredClone(d.actors[0]),id:'b',name:'B',transform:{x:80,y:120,rotation:0,scale:1}});d.props[0].attachment={type:'joint',actor:'b',joint:'end'};d.contacts[0].target={type:'prop',prop:'handle'};d.contacts.push({...structuredClone(d.contacts[0]),id:'other',actor:'b',target:{type:'point',x:100,y:100}});
 const f=frame(d);f.actors.push({...structuredClone(f.actors[0]),id:'b'});const c=applyContacts(d,f);assert.deepEqual(c.contacts[0].target,{x:120,y:120});assert.ok(c.contacts[0].error<.1);assert.deepEqual(c.actors,applyContacts({...d,contacts:[...d.contacts].reverse()},f).actors);
 f.actors[1].placement={x:90,y:125,rotation:0,scale:1};assert.deepEqual(applyContacts(d,f).contacts[0].target,{x:130,y:125});
});

test('fades ramp the solved pose and repeat on actor-local contact windows',()=>{
 const d=fixture(),f=frame(d);Object.assign(d.contacts[0],{start:1,end:5,fadeIn:1,fadeOut:2,period:6,weight:.8});
 for(const [time,weight]of [[1,0],[1.5,.4],[2,.8],[3,.8],[4,.4],[5,0],[7.5,.4]]){const result=applyContacts(d,f,{actorTimes:{a:time}}),c=result.contacts[0];near(c.weight,weight,1e-10);assert.equal(c.active,weight>0);if(weight===0)assert.deepEqual(result.actors,f.actors);}
 assert.equal(applyContacts(d,f,{actorTimes:{a:.5}}).contacts[0].reason,'outside-window');
 const half=applyContacts(d,f,{actorTimes:{a:1.5}}).actors[0].pose,full=applyContacts(d,f,{actorTimes:{a:2}}).actors[0].pose;near(half['lower.rotation'],full['lower.rotation']/2);
 d.packs.rig.joints[1].min=-5;d.packs.rig.joints[1].max=5;d.packs.rig.joints[2].min=-10;d.packs.rig.joints[2].max=10;
 const limited=applyContacts(d,f,{actorTimes:{a:2}});assert.equal(limited.contacts[0].limited,true);assert.ok(Math.abs(limited.actors[0].pose['upper.rotation'])<=5);assert.ok(Math.abs(limited.actors[0].pose['lower.rotation'])<=10);
});

test('moving live object targets match full and lightweight controllers through command replay',()=>{
 const d=fixture(),before=structuredClone(d),full=new SceneController(d),lite=new IllustrationController(d,{objectFactory:SceneObjects,contactSolver:applyContacts});
 try{for(const c of [full,lite])c.objectCommand({type:'impulse',object:'ball',vx:8,vy:-2});
  for(const time of [.1,.5,1,.25]){const a=full.seek(time),b=lite.seek(time);assert.deepEqual(b.contacts,a.contacts);assert.deepEqual(b.actors[0].pose,a.actors[0].pose);near(a.contacts[0].target.x,a.objects[0].x);near(a.contacts[0].target.y,a.objects[0].y);assert.ok(a.contacts[0].error<.1);}
  for(const c of [full,lite])c.objectCommand({type:'enable',object:'ball',enabled:false});assert.equal(full.frame().contacts[0].reason,'target-unavailable');assert.equal(lite.frame().contacts[0].reason,'target-unavailable');assert.deepEqual(d,before);
 }finally{full.dispose();lite.dispose();}
});

test('target references and fade windows validate without silently accepting malformed values',()=>{
 assert.equal(validateDocument(fixture()).valid,true);
 for(const change of [d=>d.contacts[0].target.object='absent',d=>d.contacts[0].target={type:'prop',prop:'absent'},d=>d.contacts[0].fadeIn=-1,d=>d.contacts[0].fadeOut=Infinity,d=>Object.assign(d.contacts[0],{fadeIn:6,fadeOut:6}),d=>d.contacts[0].target.offsetX=NaN]){const d=fixture();change(d);assert.equal(validateDocument(d).valid,false,change.toString());}
});
