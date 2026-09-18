import {chromium} from '@playwright/test';
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
await mkdir('test-results',{recursive:true});
await writeFile('test-results/roadmap-fixture.html','<!doctype html><html><head><meta charset="utf-8"></head><body></body></html>');
const server=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:5188,strictPort:true,hmr:false},appType:'mpa'});await server.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://127.0.0.1:5188/test-results/roadmap-fixture.html');
const report=await page.evaluate(async()=>{
 const [{createCatch},{SceneController},{IllustrationController},{SceneObjects},{PropGameRuntime},{applyContacts},{applyMotionLayers},{mountSVG},{WorkerSceneController}]=await Promise.all([import('/examples/catch.js'),import('/src/scene.js'),import('/src/illustration.js'),import('/src/scene-objects.js'),import('/src/prop-games.js'),import('/src/contacts.js'),import('/src/motion-layers.js'),import('/src/svg.js'),import('/src/worker.js')]);
 const doc=createCatch(),full=new SceneController(doc),lite=new IllustrationController(doc,{objectFactory:SceneObjects,gameFactory:PropGameRuntime,contactSolver:applyContacts,motionLayerSolver:applyMotionLayers}),worker=new WorkerSceneController(doc);await worker.ready;
 document.body.innerHTML='<style>body{font:14px system-ui;background:#f3f4f0;margin:15px}main{display:grid;grid-template-columns:1fr 1fr;gap:15px}.card{background:white;border-radius:12px;padding:10px}.card svg{width:100%;height:auto}h3{margin:0 0 4px}</style><h2>Catch · seed20260917 · saved runtime samples</h2><main></main>';
 const samples=[];for(const t of [0,1.3,2.2,4,8,16,25,35]){const f=full.seek(t),l=lite.seek(t);if(JSON.stringify(f.objects)!==JSON.stringify(l.objects)||JSON.stringify(f.actors)!==JSON.stringify(l.actors))throw Error('Catch full/lite diverged at '+t);const card=document.createElement('section');card.className='card';card.innerHTML='<h3>'+t+'s · '+f.objectGames[0].phase+'</h3><div></div>';document.querySelector('main').append(card);mountSVG(card.querySelector('div'),doc,f);samples.push({time:t,...f.objectGames[0],ball:f.objects[0],errors:f.actors.map(a=>a.objectContactError)});}
 worker.seek(35);await new Promise(resolve=>{const check=()=>worker.frame().time>=34.99?resolve():setTimeout(check,20);check();});if(JSON.stringify(worker.frame().objects)!==JSON.stringify(full.frame().objects))throw Error('Catch worker objects differ');
 full.previewClip('pip','idle',0,{'head.rotation':12});if(full.frame().actors.find(a=>a.id==='pip').pose['head.rotation']!==12)throw Error('Catch overwrote author pose preview');
 full.dispose();lite.dispose();worker.dispose();return samples;
});
await page.screenshot({path:'test-results/catch-acceptance.png',fullPage:true});await writeFile('test-results/catch-acceptance.json',JSON.stringify(report,null,2));
await page.goto('http://127.0.0.1:5188/demos.html#game-of-catch');await page.locator('#demo-art [data-object="ball"]').waitFor();await page.locator('#catch-nudge').click();await page.screenshot({path:'test-results/catch-gallery.png'});assert.equal(await page.locator('.demo-group').count(),3);assert.equal(await page.locator('.demo-card').count(),14);
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/catch-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Mobile horizontal overflow');
assert.deepEqual(errors,[]);console.log('Catch full/lite/worker, preview editing, gallery and mobile checks pass.',report.map(s=>({time:s.time,phase:s.phase,catches:s.catches,misses:s.misses})));
}finally{await browser.close();await server.close();}

