import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '@playwright/test';
import {createGameExample} from '../examples/game-scene.js';
import {compileScene} from '../tools/compile-scene.mjs';

await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/game-export-'));
const scene=createGameExample();scene.actors=scene.actors.slice(0,1);scene.actors[0].transform={x:140,y:220,scale:1,rotation:0};scene.props=[];scene.game.anchors={home:{type:'point',x:140,y:220},destination:{type:'point',x:320,y:180}};scene.game.actors={shopkeeper:{...scene.game.actors.shopkeeper,locomotion:{mode:'float',speed:180,clearance:12}}};
const manifest=await compileScene(scene,root);assert.equal(manifest.runtime,'physics');assert.ok(manifest.features.includes('game-bindings'));assert.ok(!manifest.features.includes('physics'));assert.ok(manifest.files.some(f=>f.modules.some(m=>/game\.js$/.test(m))),'compiled game keeps the semantic facade');
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+decodeURIComponent(pathname)+(pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('Outside fixture');res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.json')?'application/json':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.posecraft);assert.equal(await page.locator('#error').isVisible(),false);
 const result=await page.evaluate(async()=>{
  const player=window.posecraft;await player.controller.ready;
  const actor=player.actor('shopkeeper'),moved=await actor.moveTo('destination'),saved=await player.snapshot();
  await actor.do('wave');await actor.moveTo('home');await player.object('shop-light').set('enabled',true);const changed=await player.snapshot();
  await player.restore(saved);const restored=await player.snapshot();return {worker:!!player.controller.worker,type:moved.type,mode:actor.capabilities().locomotion,saved,changed,restored};
 });
 assert.equal(result.worker,true);assert.equal(result.type,'actor.arrived');assert.equal(result.mode,'float');assert.notDeepEqual(result.changed.actors[0].position,result.saved.actors[0].position);assert.equal(result.changed.objects[0].enabled,true);assert.equal(result.saved.objects[0].enabled,false);assert.deepEqual(result.restored.actors[0].position,result.saved.actors[0].position);assert.deepEqual(result.restored.objects,result.saved.objects);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,selfContained:true,fullGameFacade:true,worker:true,moveAction:true,objectAcknowledgement:true,snapshotRestore:true,bytes:manifest.files.reduce((n,f)=>n+f.bytes,0)}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
