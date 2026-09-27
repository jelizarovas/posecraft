import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('dist');
const server=http.createServer(async(req,res)=>{
  try {
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+pathname+(pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep))throw Error('Invalid path');
    const body=await fs.readFile(file);
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');
    res.end(body);
  } catch {res.writeHead(404);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try {
  const page=await browser.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/demos/wwwzard.html`);
  await page.waitForFunction(()=>!!window.posecraft);
  await page.locator('#close-laptop').click();
  await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.state==='closedIdle');
  await page.locator('#open-laptop').click();
  assert.equal(await page.evaluate(()=>window.posecraft.controller.frame().behavior.state),'openingLaptop');
  await page.locator('.studio-link').click();
  await page.locator('#clip').waitFor();
  assert.match(page.url(),/\/studio\/\?demo=wwzard-desk$/);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({builtDemoPlayback:true,separateStudioLink:true,errors}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
