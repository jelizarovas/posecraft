import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createBottle} from '../examples/bottle.js';
import {assertDocument,validateDocument,capabilities} from '../src/schema.js';
import {validateFluidCommand} from '../src/bottle-validation.js';
import {SceneController} from '../src/scene.js';
import {IllustrationController} from '../src/illustration.js';
import {BottleFluid} from '../src/bottle-fluid.js';
import {removeSceneEntity} from '../src/scene-graph.js';
import {inspectSceneFeatures,createSceneExport} from '../src/scene-export.js';
import {compileScene} from '../tools/compile-scene.mjs';
const constructors=[d=>new SceneController(d),d=>new IllustrationController(d,{fluidFactory:BottleFluid})];
const grab={type:'grab',points:[{id:1,x:400,y:220}]};
const move={type:'move',points:[{id:1,x:470,y:180}]};
const release={type:'release',points:[]};

test('bottle config roundtrips and rejects invalid boundaries, references and ranges',()=>{
 const scene=createBottle();assertDocument(JSON.parse(JSON.stringify(scene)));assert.ok(capabilities.features.includes('bottle-fluid'));
 for(const [key,value] of [['vessel','missing'],['contents',scene.fluid.vessel],['fill',.9],['damping',0],['wind',3],['pivot',{x:Infinity,y:0}],['boundary',[{x:0,y:0},{x:2,y:2},{x:0,y:2},{x:2,y:0}]],['boundary',[{x:0,y:0},{x:1,y:0},{x:2,y:0}]],['ship',{joint:'missing',scale:.5,mass:1}],['ship',{...scene.fluid.ship,mass:11}]]){const d=structuredClone(scene);d.fluid[key]=value;assert.equal(validateDocument(d).valid,false,key);}
 const removed=removeSceneEntity(scene,'actor',scene.fluid.contents);assert.equal(removed.fluid,undefined);assert.ok(!removed.requiredFeatures.includes('bottle-fluid'));assertDocument(removed);assert.ok(scene.fluid);
});
test('commands are bounded and copied before recording or crossing a worker boundary',()=>{
 for(const bad of [{type:'grab',points:[]},{type:'move',points:[{id:1,x:NaN,y:0}]},{type:'grab',points:[{id:1,x:0,y:0},{id:1,x:1,y:1}]},{type:'cancel',points:[{id:1,x:0,y:0}]},{type:'wind',value:3},{type:'nudge',ax:6001,ay:0},{type:'motion',ax:0,ay:0,turn:0,gravityY:3}])assert.throws(()=>validateFluidCommand(bad));
 const safe=validateFluidCommand(move);assert.deepEqual(safe,move);assert.notEqual(safe.points,move.points);assert.notEqual(safe.points[0],move.points[0]);
});
test('full and lightweight bottle motion match and ordered gestures replay exactly',()=>{
 const scene=createBottle(),a=constructors[0](scene),b=constructors[1](scene);
 for(const c of [a,b]){c.fluidInput(grab);c.fluidInput({...move,points:[{id:1,x:430,y:200}]});c.fluidInput(move);assert.deepEqual(c.log.map(e=>e.command.type),['grab','move']);}
 for(let i=0;i<90;i++){if(i===20)for(const c of [a,b]){c.fluidInput(release);c.fluidInput({type:'wind',value:-1});c.fluidInput({type:'nudge',ax:500,ay:-200});}if(i===40)for(const c of [a,b])c.fluidInput({type:'motion',ax:100,ay:200,turn:35,gravityX:.3,gravityY:.95});assert.deepEqual(a.step(1/60).fluid,b.step(1/60).fluid);}
 for(const c of [a,b]){const frame=c.frame().fluid,time=c.time;c.seek(.1);assert.deepEqual(c.seek(time).fluid,frame);c.dispose();}
});
test('explicit contents previews suppress both procedural transforms; reduced motion accepts manual commands',()=>{
 for(const make of constructors){const d=createBottle(),c=make(d);const actor=d.actors.find(a=>a.id===d.fluid.contents),clip=d.packs[actor.pack].states[d.packs[actor.pack].initial].clip;c.previewClip(actor.id,clip,.2);assert.equal(c.frame().fluid,undefined);assert.equal(c.frame().actors.find(a=>a.id===d.fluid.vessel).placement,undefined);c.clearPreview(actor.id);assert.ok(c.frame().fluid);c.reducedMotion=true;const still=c.frame().fluid;for(let i=0;i<20;i++)c.step(1/60);assert.deepEqual(c.frame().fluid,still);c.pause();c.fluidInput({type:'nudge',ax:1000,ay:0});assert.notEqual(c.frame().fluid.bottle.x,still.bottle.x);c.reset();c.pause();c.fluidInput(grab);c.fluidInput(move);const manual=c.frame().fluid;assert.deepEqual(c.seek(0).fluid,manual);c.dispose();}
 assert.throws(()=>new IllustrationController(createBottle()),/Missing illustration provider: bottle fluid/);
});
test('bottle website selects only the fluid provider, includes gesture-gated motion, and excludes Planck',async()=>{
 const d=createBottle();assert.deepEqual(inspectSceneFeatures(d).runtime,'illustration');assert.ok(inspectSceneFeatures(d).features.includes('bottle-fluid'));const html=createSceneExport(d,{local:true}).html;assert.match(html,/id="phone-motion"/);assert.match(html,/addEventListener\('click',async/);assert.match(html,/await player.enableMotion\(\)/);
 await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/bottle-compile-')),manifest=await compileScene(d,path.join(root,'site')),modules=manifest.files.flatMap(file=>file.modules);assert.ok(modules.some(id=>id.endsWith('bottle-fluid.js')));assert.ok(!modules.some(id=>/planck|\/physics\.js|\/scene\.js/.test(id)));console.log('Bottle website bytes:',manifest.files.reduce((sum,f)=>sum+f.bytes,0));
});
