import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sampleClip} from '../src/index.js';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1440,height:950},reducedMotion:'reduce'}),errors=[],panels=[];page.setDefaultTimeout(30000);page.on('pageerror',e=>errors.push(e.message));await page.routeWebSocket('**',socket=>socket.close());await page.goto(base+'/demos.html#gym-routine');
 const pending=page.waitForEvent('download');await page.locator('#download-demo').click();const doc=JSON.parse(await fs.readFile(await(await pending).path(),'utf8')),pack=doc.packs.atlas;
 assert.ok(doc.requiredFeatures.includes('scene-depth'));assert.equal(doc.actors.find(a=>a.id==='atlas').depth.joint,'floor-depth');assert.equal(doc.actors.find(a=>a.id==='gym-water-table').depth.value,383);
 const select=async(clip,rawTime,label)=>{const t=Math.round(rawTime*25)/25;await page.locator('#gym-grip-review').selectOption(clip);await page.locator('#demo-scrub').fill(String(t));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(+document.querySelector('#demo-art svg')?.dataset.sceneTime-t)<.03,t);const art=await page.locator('#demo-art').innerHTML();assert.ok(!/NaN|Infinity/.test(art));const units=await page.locator('#demo-art [data-scene-layer="characters"] > [data-scene-unit]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.sceneUnit,display:n.getAttribute('display')||'inline'})));const pose=sampleClip(pack.clips[clip],t),floor=383+(pose['floor-depth.y']||0),bottle=383+(pose['depth-bottle.y']||0),index=id=>units.findIndex(u=>u.id===id),part=id=>units.find(u=>u.id==='part:atlas:'+id);
  assert.ok(index('actor:atlas')>=0&&index('actor:gym-water-table')>=0);if(floor<382.9)assert.ok(index('actor:atlas')<index('actor:gym-water-table'),clip+' walks through the front of the table');if(floor>383.1)assert.ok(index('actor:atlas')>index('actor:gym-water-table'),clip+' is hidden behind a farther table');
  assert.equal(part('water-bottle-body').display,Math.abs(floor-bottle)<1e-4?'none':'inline',clip+' parked/held bottle grouping');assert.equal(part('barbell-shaft').display,Math.abs(floor-399.52)<1e-4?'none':'inline',clip+' barbell grouping');
  panels.push(`<section><label>${label||clip} / ${t}s</label>${art}</section>`);return {pose,floor,bottle};};
 for(const t of [0,3,6,9,12])await select('floor-walk',t,'Depth walk');
 for(const t of [.8,1.8])assert.equal((await select('jump-grab-left',t,'Jump keeps its ground plane')).floor,383);
 await select('bench-lead-left',1.64,'Press / bar rejoins rig');await select('mirror-flex-bench',4,'Behind the equipment');
 const water=doc.behaviorGraph.activities['drink-bar'].variants.find(v=>v.when.value===1&&v.clip.includes('to-2'))||doc.behaviorGraph.activities['drink-bar'].variants[0],clip=pack.clips[water.clip];let held;
 for(let t=0;t<clip.duration;t+=.04){const p=sampleClip(clip,t);if(p['water-bottle.rotation']<-60&&Math.abs(p['floor-depth.y']||0)>5){held=t;break;}}
 assert.ok(held!==undefined,'water clip has a held bottle away from the home floor plane');for(const t of [0,held,Math.min(held+2,clip.duration),clip.duration])await select(water.clip,t,'Bottle placement / carry');
 assert.deepEqual(errors,[]);await fs.mkdir('test-results',{recursive:true});await page.setViewportSize({width:1440,height:1100});await page.setContent('<style>body{margin:0;background:#eef0e9;font:14px system-ui}main{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;padding:10px}section{min-width:0}label{display:block;padding:7px}svg{display:block;width:100%;height:auto}</style><main>'+panels.join('')+'</main>');await page.screenshot({path:'test-results/gym-occlusion-sheet.png',fullPage:true});console.log('Gym depth browser passed:13 frames, table ordering, stable jump plane, parked/held props and bench fusion.');
}finally{await browser.close();}
