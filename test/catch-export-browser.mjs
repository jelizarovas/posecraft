import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {chromium} from '@playwright/test';
import {gzipSync} from 'node:zlib';
import {createCatch} from '../examples/catch.js';
import {SceneController} from '../src/scene.js';
import {compileScene} from '../tools/compile-scene.mjs';
await fs.mkdir('test-results',{recursive:true});const root=await fs.mkdtemp(path.resolve('test-results/catch-export-')),doc=createCatch(),c=new SceneController(doc),expected=c.seek(35);c.dispose();
const manifest=await compileScene(doc,path.join(root,'site'));assert.equal(manifest.runtime,'illustration');assert.ok(manifest.features.includes('prop-games'));assert.ok(!manifest.files.some(f=>f.modules.some(id=>/planck|\/physics\.js|\/scene\.js/.test(id))));
let compressed=0;for(const file of manifest.files)compressed+=gzipSync(await fs.readFile(path.join(root,'site/runtime',file.file))).length;
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('Outside fixture');res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(await fs.readFile(file));}catch{res.writeHead(404);res.end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{const page=await browser.newPage({viewport:{width:800,height:450}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/site/`);await page.waitForFunction(()=>window.posecraft?.controller);const actual=await page.evaluate(()=>{const p=window.posecraft;p.pause();p.seek(35);return p.controller.frame();});const rounded=value=>JSON.parse(JSON.stringify(value,(_k,v)=>typeof v==='number'?Math.round(v*1e8)/1e8:v));assert.deepEqual(rounded(actual.objects),rounded(expected.objects));assert.deepEqual(actual.objectGames,expected.objectGames);assert.deepEqual(rounded(actual.actors),rounded(expected.actors));assert.equal(await page.locator('[data-object="ball"]').count(),1);await page.screenshot({path:'test-results/catch-export.png'});assert.deepEqual(errors,[]);const report={runtime:manifest.runtime,features:manifest.features,bytes:manifest.files.reduce((sum,f)=>sum+f.bytes,0),gzipBytes:compressed,game:actual.objectGames[0],parity:true};await fs.writeFile('test-results/catch-export-report.json',JSON.stringify(report,null,2));console.log(report);}finally{await browser.close();await new Promise(r=>server.close(r));}
