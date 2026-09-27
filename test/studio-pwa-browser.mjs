import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve('dist/studio'),prefix='/apps/studio/';
const server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost'),relative=url.pathname.startsWith(prefix)?url.pathname.slice(prefix.length):null;if(relative===null)throw new Error('missing');const file=path.resolve(root,relative||'index.html');if(!file.startsWith(root+path.sep))throw new Error('invalid');const body=await fs.readFile(file),type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.png':'image/png','.woff':'font/woff','.woff2':'font/woff2'}[path.extname(file)]||'application/octet-stream';res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache'});res.end(body);}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}${prefix}`;
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const context=await browser.newContext(),page=await context.newPage({viewport:{width:1280,height:850}}),errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(url);await page.locator('#clip').waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);
 assert.equal(await page.locator('.gallery-entry').getAttribute('href'),'../demos/demos.html');
 assert.equal(await page.locator('a[href="../demos/wwwzard.html"]').count(),1);
 assert.equal(await page.locator('a[href="../demos/wwwzard-legacy.html"]').count(),1);
 const cache=await page.evaluate(async()=>{const name=(await caches.keys()).find(key=>key.startsWith('posecraft-studio-')),entries=await(await caches.open(name)).keys();return entries.map(entry=>entry.url);});
 assert.ok(cache.some(url=>url.includes('simulation-worker')),'worker included');assert.ok(cache.some(url=>url.includes('material-symbols')),'icons available offline');assert.ok(cache.every(url=>url.includes(prefix)));assert.ok(!cache.some(url=>/\/assets\/(map|native-3d)\//.test(url)));
 await page.reload();await page.locator('#clip').waitFor();assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true);await context.setOffline(true);await page.reload();await page.locator('#clip').waitFor();await page.locator('#duplicate').click();assert.equal(await page.locator('#actors option').count(),2);await page.reload();await page.locator('#clip').waitFor();assert.equal(await page.locator('#actors option').count(),2,'offline draft recovered');
 await page.screenshot({path:'test-results/studio-offline.png'});assert.deepEqual(errors,[]);
 let bytes=0;for(const entry of cache)bytes+=(await fs.stat(path.join(root,new URL(entry).pathname.slice(prefix.length)))).size;
 console.log(JSON.stringify({offline:true,nestedPath:true,draftRecovered:true,cachedFiles:cache.length,cachedBytes:bytes}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
