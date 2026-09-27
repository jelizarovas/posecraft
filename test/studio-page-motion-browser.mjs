import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createDrawing} from '../src/vector-authoring.js';
const scene=createDrawing(),pack=scene.packs.drawing;
for(const [name,value]of [['host-depart-left',-20],['host-depart-right',20],['host-arrive-left',-10],['host-arrive-right',10]])pack.clips[name]={duration:1,loop:false,tracks:{'root.rotation':[[0,value],[1,value]]}};
const base=process.env.POSECRAFT_URL||'http://127.0.0.1:5247',browser=await chromium.launch({channel:'msedge',headless:true}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1400,height:1000},acceptDownloads:true});page.on('pageerror',error=>errors.push(error.message));
 await page.addInitScript(()=>{window.showOpenFilePicker=undefined;window.showSaveFilePicker=undefined;});
 await page.goto(base+'/');await page.locator('#clip').waitFor();
 const chooser=page.waitForEvent('filechooser');await page.locator('#import').click();await (await chooser).setFiles({name:'page-motion.posecraft.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(scene))});
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')).id==='drawing');
 await page.locator('#scene-workspace').click();await page.locator('#scene-behaviors').click();await page.locator('[data-behavior-page="page-motion"]').click();
 await page.locator('#page-motion-add').click();
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft.studio.v2')));
 assert.deepEqual((await saved()).hostTransition.actors[0],{actor:'character',depart:{left:'host-depart-left',right:'host-depart-right'},arrive:{left:'host-arrive-left',right:'host-arrive-right'}});
 await page.locator('#page-motion-arrive-right').selectOption('idle');assert.equal((await saved()).hostTransition.actors[0].arrive.right,'idle');
 await page.locator('#page-motion-preview').click();await page.locator('#page-motion-clear').click();
 const download=page.waitForEvent('download');await page.locator('#export').click();const file=await download;const data=JSON.parse(await fs.readFile(await file.path(),'utf8'));assert.equal(data.hostTransition.actors[0].arrive.right,'idle');
 await page.reload();await page.locator('#clip').waitFor();await page.locator('#scene-workspace').click();await page.locator('#scene-behaviors').click();await page.locator('[data-behavior-page="page-motion"]').click();
 assert.equal(await page.locator('#page-motion-arrive-right').inputValue(),'idle');
 await page.locator('#page-motion-remove').click();assert.equal((await saved()).hostTransition,undefined);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({add:true,clipSelection:true,preview:true,saveReopen:true,remove:true,graphRequired:false}));
}finally{await browser.close();}
