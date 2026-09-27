import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createWwwzardContactScene} from '../examples/wwwzard-contact.js';
import {IllustrationController,renderSVG} from '@posecraft/runtime';
import {applyMotionLayers,ActorBehaviorRuntime} from '@posecraft/runtime/features';
const scene=createWwwzardContactScene();
const controller=new IllustrationController(scene,{motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
const frames=[];
for(const [hero,plane,times] of [['prepare-windy','prepare',[0,.3,.6,1,1.5]],['prepared','hold',[0,1.6]],['sending','throw',[0,.16,.38,.52,.72,1,1.4]]]){
 for(const t of times){controller.previewClip('wwzard',hero,t);controller.previewClip('plane',plane,t); controller.previewClip('window',hero==='prepare-windy'?'window-open':'window-hold',hero==='prepare-windy'?t:0); controller.previewClip('room','window-gust',hero==='prepare-windy'?t:1.5); frames.push({name:hero+' '+t,svg:renderSVG(scene,controller.frame())});}
}
await fs.mkdir('test-results/contact-plane',{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
try{const page=await browser.newPage({viewport:{width:1240,height:800}});await page.setContent(`<style>body{margin:0;font:14px system-ui}main{display:grid;grid-template-columns:repeat(4,310px)}figure{margin:0}svg{width:300px;height:309px}</style><main>${frames.map(f=>`<figure>${f.svg}<figcaption>${f.name}</figcaption></figure>`).join('')}</main>`);await page.screenshot({path:'test-results/contact-plane/sequence.png',fullPage:true});controller.previewClip('wwzard','prepared',0);controller.previewClip('plane','hold',0);controller.previewClip('window','window-hold',0);await page.setContent(`<style>body{margin:0}svg{width:800px;height:825px}</style>${renderSVG(scene,controller.frame())}`);await page.screenshot({path:'test-results/contact-plane/grip.png'});console.log('Plane sequence reviewed');}finally{await browser.close();}
