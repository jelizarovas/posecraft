import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';

const exec=promisify(execFile),repo=fileURLToPath(new URL('..',import.meta.url));
const npm=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const manifest=JSON.parse(await fs.readFile(path.join(repo,'package.json'),'utf8'));
await fs.mkdir(path.join(repo,'.tmp'),{recursive:true});
const root=await fs.mkdtemp(path.join(repo,'.tmp/map-consumer-'));
async function run(args,cwd=root){return(await exec(process.execPath,args,{cwd,env:{...process.env,npm_config_cache:path.join(repo,'.tmp/npm-cache')},maxBuffer:4*1024*1024,timeout:180000})).stdout;}
const [packed]=JSON.parse(await run([npm,'pack','--json','--pack-destination',root],repo));
await fs.writeFile(path.join(root,'package.json'),JSON.stringify({name:'map-consumer',private:true,type:'module',dependencies:{posecraft:`file:./${packed.filename}`,vite:manifest.devDependencies.vite,typescript:manifest.devDependencies.typescript}}));
await run([npm,'install','--offline','--ignore-scripts','--no-audit','--no-fund']);
assert.equal((await fs.lstat(path.join(root,'node_modules/posecraft'))).isSymbolicLink(),false);
await fs.access(path.join(root,'node_modules/posecraft/docs/map.md'));
await fs.writeFile(path.join(root,'types.ts'),`import {generateMap} from 'posecraft/map';import {mountMap, type MapView} from 'posecraft/map-browser';import {MapController} from 'posecraft/map-runtime';const map=generateMap({seed:42});const view:MapView=mountMap(document.createElement('div'),map);view.moveTo('hero','village-chest');view.restore(view.snapshot());new MapController(map).visibleFrame({x:0,y:0,width:500,height:500});`);
await run(['node_modules/typescript/bin/tsc','--noEmit','--strict','--module','nodenext','--target','es2022','types.ts']);
await fs.writeFile(path.join(root,'index.html'),'<!doctype html><style>body{margin:0}#map{width:800px;height:500px}</style><div id="map"></div><script type="module" src="/main.js"></script>');
await fs.writeFile(path.join(root,'main.js'),`import {generateMap} from 'posecraft/map';import {mountMap} from 'posecraft/map-browser';window.view=mountMap(document.querySelector('#map'),generateMap({seed:42}),{onError:e=>{throw e;}});`);
await fs.writeFile(path.join(root,'vite.config.js'),`import fs from 'node:fs';export default {base:'./',plugins:[{name:'modules',generateBundle(_,bundle){fs.writeFileSync('modules.json',JSON.stringify(Object.values(bundle).filter(v=>v.type==='chunk').flatMap(v=>Object.keys(v.modules))));}}]};`);
await run(['node_modules/vite/bin/vite.js','build']);
const modules=JSON.parse(await fs.readFile(path.join(root,'modules.json'),'utf8')).map(p=>p.replaceAll('\\','/'));
assert.ok(modules.some(p=>p.includes('/node_modules/posecraft/src/map-browser.js')));
assert.ok(!modules.some(p=>/\/node_modules\/(planck|three|react)\//.test(p)),'Map consumer must exclude physics, Three and React');
assert.ok(!modules.some(p=>p.startsWith(repo.replaceAll('\\','/').replace(/\/$/,'')+'/src/')));
const dist=path.join(root,'dist'),files=await fs.readdir(path.join(dist,'assets')),assets=[];
assert.ok(files.some(f=>/^map-worker-.*\.js$/.test(f)));
for(const file of files){const data=await fs.readFile(path.join(dist,'assets',file));assets.push({file,bytes:data.length,gzipBytes:gzipSync(data).length});}
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,filename=path.resolve(dist,'.'+pathname+(pathname.endsWith('/')?'index.html':''));if(!filename.startsWith(dist+path.sep))throw Error('Outside root');const data=await fs.readFile(filename);res.writeHead(200,{'content-type':filename.endsWith('.js')?'text/javascript':'text/html'});res.end(data);}catch{res.writeHead(404);res.end();}});
let browser;
try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
 const page=await browser.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>errors.push(r.url()));page.on('request',r=>requests.push(r.url()));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.view?.stats().visibleTiles>0);await page.evaluate(()=>view.controller.ready);
 const arrived=await page.evaluate(async()=>{const result=await view.moveTo('hero','village-chest'),saved=view.snapshot();await view.restore(JSON.parse(JSON.stringify(saved)));return{type:result.type,opened:view.controller.frame().objects['village-chest'].opened,stats:view.stats()};});
 assert.equal(arrived.type,'map.actor.arrived');assert.equal(arrived.opened,true);assert.ok(arrived.stats.visibleTiles<arrived.stats.totalTiles/4);
 assert.ok(requests.some(url=>/map-worker-.*\.js$/.test(url)));await page.evaluate(()=>view.dispose());assert.equal(await page.locator('canvas').count(),0);assert.deepEqual(errors,[]);
 const report={passed:true,fixture:root,assets,totalGzipBytes:assets.reduce((n,a)=>n+a.gzipBytes,0),checks:['installed tarball','public types','no Planck, Three or React in map bundle','emitted worker loaded','arrival and chest state','save/restore','viewport culling','dispose']};await fs.mkdir('test-results',{recursive:true});await fs.writeFile('test-results/map-package.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await browser?.close();await new Promise(resolve=>server.close(resolve));}
