import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateDocument,assertDocument} from '../src/schema.js';
import {forwardKinematics} from '../src/index.js';
import {removeSceneEntity} from '../src/scene-graph.js';
import {DocumentStore} from '../src/commands.js';
import {describeGameScene,gameActorBindings,resolveGameTarget} from '../src/game-bindings.js';
import ona from '../examples/characters/ona.json' with {type:'json'};

function fixture(){
 const joint=(id,parent,x,rotation=0)=>({id,parent,x,y:0,rotation,min:-180,max:180,length:10});
 const pack={joints:[joint('root',null,0),joint('head','root',0),joint('hand','root',10,90)],parts:[{id:'line',joint:'root',d:'M0 0L10 0',fill:'none',stroke:'#000000'}],inputs:{emotion:{type:'string',default:'neutral',options:['neutral','happy']}},clips:{idle:{duration:2,loop:true,tracks:{}},wave:{duration:2,loop:false,tracks:{}}},initial:'idle',states:{idle:{clip:'idle',transitions:[]}}};
 return {schemaVersion:1,kind:'scene',id:'game-test',name:'Game bindings',revision:0,bounds:{width:500,height:500},requiredFeatures:['game-bindings','scene-objects','prop-attachments'],packs:{rig:pack},actors:[{id:'a',name:'Guide',pack:'rig',transform:{x:0,y:0,rotation:0,scale:1}}],props:[{id:'table',name:'Table',x:40,y:50,width:20,height:20,rotation:90,fill:'#000000',collider:{enabled:false,x:0,y:0,width:20,height:20,bounce:0,friction:.5}},{id:'held',name:'Held sign',x:0,y:0,width:8,height:8,rotation:0,fill:'#000000',collider:{enabled:false,x:0,y:0,width:8,height:8,bounce:0,friction:.5},attachment:{type:'joint',actor:'a',joint:'hand',offsetX:3}}],objects:[{id:'ball',name:'Ball',shape:'circle',x:100,y:200,rotation:90,radius:10,fill:'#ffffff',mass:1},{id:'wall',name:'Wall',shape:'box',x:20,y:20,width:20,height:20,fill:'#000000',mass:0}],game:{anchors:{home:{type:'point',x:30,y:40},tableEdge:{type:'prop',prop:'table',offsetX:4,offsetY:2},gift:{type:'object',object:'ball',offsetX:10},hand:{type:'joint',actor:'a',joint:'hand',offsetX:4},sign:{type:'prop',prop:'held',offsetX:2}},actors:{a:{actions:{greet:'wave',idle:'wave'},reactions:{pleased:{action:'greet',emotion:'happy'}},gaze:{joint:'head',maxAngle:40},speech:true}}}};
}
function frame(doc){return {time:0,actors:[{id:'a',pose:{},world:forwardKinematics(doc.packs.rig.joints,{}),placement:{x:100,y:200,rotation:90,scale:2}}],objects:doc.objects.map(o=>({...o,visible:true}))};}
function near(point,x,y){assert.ok(point);assert.ok(Math.abs(point.x-x)<1e-8&&Math.abs(point.y-y)<1e-8,JSON.stringify(point));}

test('semantic actions merge defaults and aliases, and discovery returns isolated truthful capabilities',()=>{
 const doc=assertDocument(fixture()),before=structuredClone(doc),binding=gameActorBindings(doc,'a'),manifest=describeGameScene(doc);
 assert.deepEqual(binding.actions,{idle:'wave',wave:'wave',greet:'wave'});assert.equal(gameActorBindings(doc,'missing'),null);
 assert.deepEqual(manifest.actors[0],{id:'a',name:'Guide',actions:['greet','idle','wave'],reactions:['pleased'],canSpeak:true,canLook:true,locomotion:'none',anchors:['gift','hand','home','sign','tableEdge']});
 assert.deepEqual(manifest.objects[1],{id:'wall',properties:['enabled'],commands:['enable']});assert.deepEqual(manifest.objects[0].commands,['enable','place','attach','release']);
 for(const event of ['actor.action.completed','actor.command.failed','actor.reaction.completed','actor.look.completed','actor.speech.requested','actor.speech.completed','object.changed'])assert.ok(manifest.events.includes(event));
 assert.equal(manifest.events.includes('actor.arrived'),false);binding.reactions.pleased.emotion='changed';binding.gaze.joint='changed';manifest.actors[0].anchors.push('changed');assert.deepEqual(doc,before);
 const walking=describeGameScene(ona);assert.equal(walking.actors[0].locomotion,'ground-x');assert.equal(walking.actors[0].canSpeak,false);assert.equal(walking.actors[0].canLook,false);assert.deepEqual(walking.actors[0].reactions,[]);
});

test('game targets resolve rotated joints, attached artwork and current moving-object positions',()=>{
 const doc=assertDocument(fixture()),f=frame(doc),before=structuredClone({doc,f});
 near(resolveGameTarget(doc,f,'home'),30,40);near(resolveGameTarget(doc,f,'tableEdge'),38,54);near(resolveGameTarget(doc,f,'gift'),100,210);near(resolveGameTarget(doc,f,'hand'),92,220);near(resolveGameTarget(doc,f,'sign'),92,220);
 near(resolveGameTarget(doc,f,{type:'point',x:-4,y:6}),-4,6);assert.deepEqual({doc,f},before);
 f.objects[0].x=300;f.objects[0].y=400;f.objects[0].rotation=180;near(resolveGameTarget(doc,f,'gift'),290,400);
 doc.props[1].attachment={type:'object',object:'ball',offsetX:5};near(resolveGameTarget(doc,f,'sign'),293,400);
});

test('hidden, disabled, unknown and malformed targets never fall back to stale saved coordinates',()=>{
 const doc=fixture(),f=frame(doc);assert.equal(resolveGameTarget(doc,f,'missing'),null);assert.equal(resolveGameTarget(doc,f,'constructor'),null);assert.equal(resolveGameTarget(doc,f,{type:'point',x:NaN,y:0}),null);
 f.objects[0].enabled=false;assert.equal(resolveGameTarget(doc,f,'gift'),null);f.objects=[];assert.equal(resolveGameTarget(doc,f,'gift'),null);
 doc.props[0].hidden=true;assert.equal(resolveGameTarget(doc,f,'tableEdge'),null);doc.actors[0].hidden=true;assert.equal(resolveGameTarget(doc,f,'hand'),null);assert.equal(resolveGameTarget(doc,f,'sign'),null);
});

test('saved game binding validation rejects malformed mappings, references and prototype keys',()=>{
 const changes=[d=>d.game=null,d=>d.game.anchors=null,d=>d.game.actors=[],d=>d.game.actors.a.actions=null,d=>d.game.actors.a.reactions=null,d=>d.game.actors.a.actions.bad='absent',d=>d.game.actors.a.reactions.pleased.action='absent',d=>d.game.actors.a.reactions.pleased.emotion='absent',d=>d.game.actors.a.gaze.joint='absent',d=>d.game.actors.a.gaze.maxAngle=181,d=>d.game.actors.a.speech='yes',d=>d.game.anchors.hand.offsetX=1001,d=>d.game.anchors.gift.object='absent',d=>d.game.anchors.tableEdge.prop='absent',d=>d.game.anchors.home.extra=true,d=>d.game.actors.missing={},d=>d.game.actors.a.extra=true,d=>d.requiredFeatures=[]];
 for(const change of changes){const doc=fixture();change(doc);const result=validateDocument(doc);assert.equal(result.valid,false,change.toString());assert.ok(result.errors.some(e=>e.path.startsWith('game')||e.path==='requiredFeatures'),JSON.stringify(result.errors));}
 const polluted=fixture();polluted.game.anchors=JSON.parse('{"__proto__":{"type":"point","x":0,"y":0}}');assert.equal(validateDocument(polluted).valid,false);assert.equal({}.type,undefined);
 const inherited=fixture();inherited.game.actors.a.actions=Object.create({sneak:'wave'});assert.equal(validateDocument(inherited).valid,false);
 const oversized=fixture();oversized.game.anchors=Object.fromEntries(Array.from({length:129},(_,i)=>['p'+i,{type:'point',x:i,y:0}]));assert.equal(validateDocument(oversized).valid,false);
});

test('CLI describe validates the scene and prints the same manifest without mutating the file',()=>{
 fs.mkdirSync('test-results',{recursive:true});const path='test-results/game-describe-scene.json',doc=fixture(),source=JSON.stringify(doc);fs.writeFileSync(path,source);
 const result=spawnSync(process.execPath,['tools/cli.mjs','describe',path],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),describeGameScene(doc));assert.equal(fs.readFileSync(path,'utf8'),source);
 doc.game.actors.a.actions.greet='absent';fs.writeFileSync(path,JSON.stringify(doc));const invalid=spawnSync(process.execPath,['tools/cli.mjs','describe',path],{encoding:'utf8'});assert.equal(invalid.status,1);assert.match(invalid.stderr,/Missing action clip/);assert.equal(invalid.stdout,'');
});


function applyRemoval(store,kind,id){
 const next=removeSceneEntity(store.document,kind,id),commands=Object.keys(next).filter(key=>JSON.stringify(next[key])!==JSON.stringify(store.document[key])).map(key=>({op:'set',path:[key],value:next[key]}));
 return store.transact(commands);
}

test('entity deletion atomically removes only the matching game bindings and undo restores them',()=>{
 for(const [kind,id,removedAnchor]of [['actor','a','hand'],['prop','table','tableEdge'],['object','ball','gift']]){
  const store=new DocumentStore(fixture()),before=structuredClone(store.document),result=applyRemoval(store,kind,id);
  assertDocument(result);assert.equal(result.game.anchors[removedAnchor],undefined);assert.deepEqual(result.game.anchors.home,before.game.anchors.home);assert.deepEqual(result.game.anchors.sign,before.game.anchors.sign);
  if(kind==='actor'){assert.equal(result.game.actors.a,undefined);assert.equal(result.props.find(p=>p.id==='held').attachment,undefined);}else assert.deepEqual(result.game.actors,before.game.actors);
  const undone=store.undo();assert.deepEqual(undone.game,before.game);assert.deepEqual(undone.actors,before.actors);assert.deepEqual(undone.objects,before.objects);assert.deepEqual(undone.props,before.props);
  const redone=store.redo();assert.equal(redone.game.anchors[removedAnchor],undefined);assertDocument(redone);
 }
});

test('shared-object deletion cleans attached artwork and commands in scene, recipe and actor graphs',()=>{
 const doc=fixture(),effect={type:'object',command:{type:'enable',object:'ball',enabled:false}},keep={type:'set',variable:'kept',value:true};
 doc.props[1].attachment={type:'object',object:'ball'};doc.requiredFeatures.push('behavior-graphs','actor-behaviors');
 doc.behaviorGraph={seed:1,variables:{kept:false},initial:'idle',states:{idle:{actions:[effect,keep]}},edges:[],handlers:[{event:'hide',actions:[effect]}],activities:{wave:{actor:'a',variants:[{id:'first',clip:'wave',weight:1,speed:{min:1,max:1},onSuccess:[effect]}],success:{base:1,modifiers:[]},onStart:[effect],onSuccess:[effect],onFailure:[effect]}}};
 doc.actorBehaviors=[{id:'actor-scope',actor:'a',graph:{seed:2,variables:{kept:false},initial:'idle',states:{idle:{actions:[effect,keep]}},edges:[],handlers:[{event:'hide',actions:[effect]}]}}];
 const before=structuredClone(doc),store=new DocumentStore(doc),next=applyRemoval(store,'object','ball');assertDocument(next);assert.deepEqual(doc,before);
 assert.equal(next.props[1].attachment,undefined);assert.deepEqual(next.behaviorGraph.states.idle.actions,[keep]);assert.deepEqual(next.behaviorGraph.handlers[0].actions,[]);assert.deepEqual(next.actorBehaviors[0].graph.states.idle.actions,[keep]);assert.deepEqual(next.actorBehaviors[0].graph.handlers[0].actions,[]);
 const recipe=next.behaviorGraph.activities.wave;for(const key of ['onStart','onSuccess','onFailure'])assert.deepEqual(recipe[key],[]);assert.deepEqual(recipe.variants[0].onSuccess,[]);assert.equal(next.game.anchors.gift,undefined);assert.ok(next.game.anchors.sign);
});

test('deleting a clip used by semantic aliases fails atomically with the binding diagnostic',()=>{
 const store=new DocumentStore(fixture()),before=structuredClone(store.document);
 assert.throws(()=>store.transact([{op:'delete',path:['packs','rig','clips','wave']}]),/game\.actors\.a\.actions.*Missing action clip/);assert.deepEqual(store.document,before);assert.equal(store.past.length,0);
});
