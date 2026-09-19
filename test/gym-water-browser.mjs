import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {SceneController} from '../src/scene.js';
import {renderSVG} from '../src/svg.js';
import {sampleClip} from '../src/index.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5181').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),errors=[];
 page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/demos.html?legacy=1#gym-routine');
 const pending=page.waitForEvent('download');await page.locator('#download-demo').click();const doc=JSON.parse(await fs.readFile(await(await pending).path(),'utf8'));
 assert.equal(doc.poseBindings[0].joint,'water-bottle');
 const variants=doc.behaviorGraph.activities['drink-bar'].variants;assert.ok(variants.length>=6);assert.equal(new Set(variants.map(v=>v.when.value)).size,3);
 const options=await page.locator('#gym-grip-review option').evaluateAll(elements=>elements.map(e=>e.value));
 const choices=variants.filter(v=>options.includes(v.clip));assert.ok(choices.length>=3,'placement variations are reviewable');
 for(const v of choices.slice(0,3)){await page.locator('#gym-grip-review').selectOption(v.clip);const t=Math.round(doc.packs.atlas.clips[v.clip].duration*.5*25)/25;await page.locator('#demo-scrub').fill(String(t));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(+document.querySelector('#demo-art svg')?.dataset.sceneTime-t)<.03,t);assert.ok(!/NaN|Infinity/.test(await page.locator('#demo-art').innerHTML()));}
 assert.deepEqual(errors,[]);
 // Render the downloaded project itself to inspect pickup, travelling sips and placement.
 const c=new SceneController(doc),frames=[];
 try{for(const v of [variants[0],variants.find(v=>v.when.value===1),variants.find(v=>v.when.value===2)]){
  const clip=doc.packs.atlas.clips[v.clip];let sip=clip.duration*.5;
  for(let t=0;t<clip.duration;t+=.1)if(sampleClip(clip,t)['water-bottle.rotation']<-60){sip=t;break;}
  for(const [label,time]of [['Start',0],['Sip',sip+.4],['Placed',clip.duration]])frames.push(`<section><label>${v.id} / ${label}</label>${renderSVG(doc,c.previewClip('atlas',v.clip,time))}</section>`);
 }}finally{c.dispose();}
 await page.setViewportSize({width:1500,height:1900});await page.setContent('<style>body{margin:0;background:#25343b;color:white;font:14px system-ui}main{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding:8px}svg{display:block;width:100%}label{display:block;padding:8px}</style><main>'+frames.join('')+'</main>');await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/gym-water-placement-sheet.png',fullPage:true});
 console.log('Water placement browser passed: downloaded persistent locations, selectable action previews and nine rendered inspection frames.');
}finally{await browser.close();}
