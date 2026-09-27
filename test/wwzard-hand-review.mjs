import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {spatialParts} from '../src/spatial.js';
import {chromium} from '@playwright/test';
import {createWwwzardHomeScene} from '../examples/wwwzard-home.js';
import {IllustrationController,renderSVG} from '@posecraft/runtime';
import {illustrationFeatures} from '@posecraft/runtime/features';
const frames=[];
const poses=process.env.RETRACTION==='1'?Array.from({length:7},(_,i)=>['rest',+(i*.3).toFixed(1)]):[['greet',.9],['rest',.45],['rest',.9],['closed-idle--angry',6.5],['closed-idle--disappointed',9.5]];
for(const night of [0,1])for(const [clip,time]of poses){
 const s=createWwwzardHomeScene(),c=new IllustrationController(s,illustrationFeatures);c.setInput('sky','night',night);c.previewClip('wwzard',clip,time);c.previewClip('screen',clip.startsWith('closed')?clip:'still',clip.startsWith('closed')?time:0);const actor=c.frame().actors.find(a=>a.id==='wwzard');const sleeve=spatialParts(s.packs.wwzard,actor).parts.get('left-sleeve').d;frames.push({sleeve,night,label:clip+' '+time,svg:renderSVG(s,c.frame(),{idPrefix:'review-'+frames.length})});c.dispose();
}
const browser=await chromium.launch({headless:true,channel:'msedge'});try{const page=await browser.newPage({viewport:{width:poses.length*300,height:740}});await page.setContent(`<style>body{margin:0;font:12px Arial}main{display:grid;grid-template-columns:repeat(${poses.length},300px)}figure{margin:0}svg{width:300px;height:320px}figcaption{padding:8px;color:#888}</style><main>${frames.map(f=>`<figure style="background:${f.night?'#121121':'white'}">${f.svg}<figcaption>${f.label}</figcaption></figure>`).join('')}</main>`);await page.screenshot({path:process.env.RETRACTION==='1'?'test-results/hand-retraction.png':'test-results/hand-night-tuck.png',fullPage:true});
 const widths=await page.evaluate(frames=>{const ctx=document.createElement('canvas').getContext('2d');return frames.filter(f=>f.label==='rest 0.9'||f.label.startsWith('closed')).map(f=>{const p=new Path2D(f.sleeve),xs=[];for(let x=150;x<260;x+=.5)if(ctx.isPointInPath(p,x,290))xs.push(x);return {pose:f.label,width:xs.at(-1)-xs[0]};});},frames);
 assert(widths.length>=2,'tucked sleeve samples must be measured');
 for(const row of widths)assert(row.width>=20,row.pose+' sleeve narrowed to '+row.width);console.log(JSON.stringify({tuckedSleeveWidths:widths}));
}finally{await browser.close();}
