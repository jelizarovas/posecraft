import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2}),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const base=process.env.POSECRAFT_URL||'http://localhost:5246';
 const ready=async renderer=>{await page.waitForFunction(renderer=>window.mapPlay?.view.stats().renderer===renderer,renderer);await page.evaluate(()=>mapPlay.view.ready);};
 await page.goto(base+'/play.html');await ready('canvas2d');
 await page.evaluate(()=>{mapPlay.townLife?.dispose();mapPlay.view.panTo(65,66);mapPlay.view.zoomTo(1.75);});
 const before=await page.evaluate(()=>mapPlay.view.snapshot());
 await page.getByRole('button',{name:'Open game settings'}).click();
 await page.getByRole('combobox',{name:'Renderer',exact:true}).selectOption('webgl2');
 await page.waitForURL('**/play.html?renderer=webgl2');await ready('webgl2');
 const after=await page.evaluate(()=>mapPlay.view.snapshot());
 assert.deepEqual(after.camera,before.camera,'Camera survives renderer switch');
 const hero=state=>state.scene.actors.find(actor=>actor.id==='hero');
 assert.deepEqual(hero(after),hero(before),'Player position survives renderer switch');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft-map-play-settings-v1')).renderer),'webgl2');
 await page.goto(base+'/play.html');await ready('webgl2');
 await page.getByRole('button',{name:'Open game settings'}).click();
 assert.equal(await page.getByRole('combobox',{name:'Renderer',exact:true}).inputValue(),'webgl2');
 await page.getByRole('combobox',{name:'Renderer',exact:true}).selectOption('canvas2d');
 await page.waitForURL('**/play.html?renderer=canvas2d');await ready('canvas2d');
 await page.goto(base+'/play.html');await ready('canvas2d');
 // An unsupported device must render with Canvas2D and explain the fallback.
 await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==='webgl2'?null:original.call(this,type,...args);};});
 await page.goto(base+'/play.html?renderer=webgl2');await ready('canvas2d');
 await page.getByRole('button',{name:'Open game settings'}).click();
 assert.match(await page.locator('[data-renderer-status]').innerText(),/using Canvas2D/);
 assert.deepEqual(errors,[]);
 console.log('Renderer switching, saved preference, position/camera preservation, and fallback passed.');
}finally{await browser.close();}
