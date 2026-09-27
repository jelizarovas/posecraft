import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const starter=JSON.parse(fs.readFileSync(new URL('../examples/characters/ona.json',import.meta.url)));
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5247';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1300,height:850},acceptDownloads:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(({doc})=>{
  window.testFileReady=(async()=>{const dir=await navigator.storage.getDirectory(),handle=await dir.getFileHandle('browser-test.posecraft.json',{create:true});if(!localStorage.getItem('file-test-seeded')){const writer=await handle.createWritable();await writer.write(JSON.stringify(doc));await writer.close();localStorage.setItem('file-test-seeded','1');}return handle;})();
  window.showOpenFilePicker=async()=>[await window.testFileReady];window.showSaveFilePicker=async()=>window.testFileReady;
 },{doc:{...starter,id:'local-project'}});
 await page.goto(base+'/');await page.locator('#clip').waitFor();await page.locator('#import').click();await page.waitForFunction(()=>document.querySelector('#saved').textContent.includes('Saved · browser-test'));
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')).id),'local-project');
 await page.locator('#duplicate').click();await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#saved').textContent.includes('Saved · browser-test'));
 const saved=await page.evaluate(async()=>JSON.parse(await (await (await window.testFileReady).getFile()).text()));assert.equal(saved.actors.length,starter.actors.length+1);
 await page.reload();await page.locator('#clip').waitFor();await page.locator('.more summary').click();await page.locator('#reopen-project').click();await page.waitForFunction(()=>document.querySelector('#saved').textContent.includes('Saved · browser-test'));assert.equal(await page.locator('#actors option').count(),saved.actors.length);
 await page.evaluate(async()=>{const writer=await (await window.testFileReady).createWritable();await writer.write('{"external":true}');await writer.close();});await page.locator('.more summary').click();await page.locator('#save').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('changed outside Studio'));
 assert.deepEqual(errors,[]);
 // Browsers without direct file access retain file chooser and download.
 const fallback=await browser.newPage({acceptDownloads:true});await fallback.addInitScript(()=>{window.showOpenFilePicker=undefined;window.showSaveFilePicker=undefined;});await fallback.goto(base+'/');await fallback.locator('#clip').waitFor();
 const chooser=fallback.waitForEvent('filechooser');await fallback.locator('#import').click();await (await chooser).setFiles({name:'fallback.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...starter,id:'fallback-project'}))});await fallback.waitForFunction(()=>document.querySelector('#toast').textContent.includes('Project opened'));
 const downloading=fallback.waitForEvent('download');await fallback.locator('#save').click();assert.equal((await downloading).suggestedFilename(),'fallback-project.posecraft.json');
 console.log('Studio file open, save, IndexedDB reopen, external conflict and fallback UI passed. Picker selections mocked; file handles and browser storage are real.');
}finally{await browser.close();}
