import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createBottle} from '../examples/bottle.js';
import {SceneController} from '../src/scene.js';
import {renderSVG} from '../src/svg.js';
const d=createBottle(),c=new SceneController(d),shots=[];
try{c.fluidInput({type:'nudge',ax:1500,ay:-500});for(let i=1;i<=180;i++){const f=c.step(1/120);if([30,60,100,180].includes(i)){assert.ok(f.fluid.waveAmplitude>.5);shots.push(`<section><label>${(i/120).toFixed(2)}s · ${f.fluid.waveParticles} drops</label>${renderSVG(d,f)}</section>`);}}}finally{c.dispose();}
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{const page=await browser.newPage({viewport:{width:1280,height:790}});await page.setContent('<style>body{margin:0;background:#13262e;color:white;font:14px system-ui}main{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px}label{display:block;padding:8px}svg{width:100%;height:auto;display:block}</style><main>'+shots.join('')+'</main>');assert.equal(await page.locator('[data-fluid-effects]').count(),4);assert.ok(await page.locator('[data-fluid-splashes]').evaluateAll(nodes=>nodes.some(n=>n.getAttribute('d').length>0)));await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/bottle-waves-sheet.png',fullPage:true});console.log('Four wave/splash stills rendered with contained effects.');}finally{await browser.close();}
