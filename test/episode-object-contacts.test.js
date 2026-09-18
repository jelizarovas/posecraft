import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {EpisodeController} from '../src/episode.js';
import {evaluatedProps} from '../src/scene-attachments.js';
import {objectGrip} from '../src/scene-objects.js';
import {createProjectBundle,readProjectBundle} from '../src/project-bundle.js';
import {renderSVG} from '../src/svg.js';

function project(){
 const d=createDrawing(),p=d.packs.drawing;p.clips.idle.duration=5;p.clips.idle.loop=false;
 for(const [id,parent,x]of [['upper','root',0],['lower','upper',20],['hand','lower',20]])p.joints.push({id,parent,x,y:0,length:20,rotation:0,min:-180,max:180});p.parts=[{id:'arm',joint:'upper',d:'M0 0L20 0',fill:'none',stroke:'#000000'}];
 d.actors[0].transform={x:100,y:80,rotation:0,scale:1};d.actors.push({...structuredClone(d.actors[0]),id:'carrier',name:'Carrier',transform:{x:80,y:100,rotation:0,scale:1}});
 d.requiredFeatures=['contacts','contact-targets','scene-objects','prop-attachments'];d.objects=[{id:'gift',name:'Gift',shape:'circle',x:0,y:0,radius:4,mass:1,fill:'#abcdef',owner:{actor:'carrier',joint:'hand'}}];d.objectPhysics={gravity:1000,floorY:400};
 d.props=[{id:'ribbon',name:'Ribbon',x:0,y:0,width:8,height:4,rotation:0,fill:'#123456',attachment:{type:'object',object:'gift'},collider:{enabled:false,x:0,y:0,width:8,height:4,friction:0,bounce:0}}];
 d.contacts=[{id:'reach',name:'Reach',actor:'character',enabled:true,chain:{upper:'upper',lower:'lower',end:'hand'},target:{type:'object',object:'gift'},bend:1,weight:1,start:0,end:5}];
 return {schemaVersion:1,kind:'episode',id:'held-props',name:'Held props',revision:0,fps:30,size:{width:640,height:480},scenes:{scene:d},shots:[{id:'shot',name:'Shot',scene:'scene',duration:5,camera:{x:[[0,0]],y:[[0,0]],zoom:[[0,1]],rotation:[[0,0]]},actors:{carrier:{clip:'idle',offset:0,speed:1,placement:{x:[[0,80,'linear'],[5,90]],y:[[0,100,'linear'],[5,110]]}}}}]};
}
test('Director contacts and attached art follow saved ownership at arbitrary shot times',()=>{
 const p=project(),before=structuredClone(p),c=new EpisodeController(p),d=p.scenes.scene;
 for(const t of [2,.5,4,2]){const f=c.frame(t),object=f.objects[0],grip=objectGrip(d,f,object.owner),prop=evaluatedProps(d,f)[0];assert.deepEqual(f.contacts[0].target,{x:120+t*2,y:100+t*2});assert.ok(f.contacts[0].error<.1);assert.equal(object.x,grip.x);assert.equal(object.y,grip.y);assert.equal(prop.x,object.x);assert.equal(prop.y,object.y);assert.equal(object.vx,0);assert.equal(object.vy,0);assert.equal(object.visible,true);assert.match(renderSVG(d,f),/data-object="gift"/);}
 assert.deepEqual(c.frame(2),new EpisodeController(p).frame(2));assert.deepEqual(p,before);
 // The saved source point is stationary when unowned: gravity is not simulated.
 delete p.scenes.scene.objects[0].owner;assert.equal(new EpisodeController(p).frame(4).objects[0].y,0);
});
test('Director resolves owned art again after contacts and hides unavailable grips',()=>{
 const p=project(),d=p.scenes.scene;d.contacts.push({...structuredClone(d.contacts[0]),id:'carrier-reach',actor:'carrier',target:{type:'point',x:100,y:120}});let frame=new EpisodeController(p).frame(0);
 assert.deepEqual(frame.contacts[0].target,{x:120,y:100});assert.ok(Math.hypot(frame.objects[0].x-100,frame.objects[0].y-120)<.1);assert.equal(evaluatedProps(d,frame)[0].x,frame.objects[0].x);
 d.actors[1].hidden=true;frame=new EpisodeController(p).frame(0);assert.equal(frame.objects[0].visible,false);assert.equal(frame.contacts[0].reason,'target-unavailable');assert.equal(evaluatedProps(d,frame)[0].hidden,true);
});
test('portable episode roundtrip preserves new contact and attachment references',async()=>{
 const p=project(),bundle=await createProjectBundle(p,async()=>{throw Error('No external assets expected');}),read=await readProjectBundle(JSON.stringify(bundle));assert.deepEqual(read.project,p);assert.deepEqual(new EpisodeController(read.project).frame(2),new EpisodeController(p).frame(2));
});
