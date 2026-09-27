import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';

// Samples every authored movement into inspectable sheets; never an approval by itself.
const base=process.env.BASE_URL||'http://localhost:5247';
const out='test-results/wwzard-review';
await fs.mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  await page.goto(base+'/wwzard.html');
  await page.waitForFunction(()=>!!window.posecraft);
  await page.evaluate(()=>window.posecraft.pause());
  await page.screenshot({path:out+'/desktop.png',fullPage:true});
  const durations=await page.evaluate(()=>Object.fromEntries(Object.entries(window.wwzardScene.packs.wwzard.clips).map(([k,v])=>[k,v.duration])));
  for(const [clip,duration] of Object.entries(durations)){
    if(process.env.CLIPS&&!process.env.CLIPS.split(',').includes(clip))continue;
    const pictures=[];
    const count=Math.ceil(duration*5);
    for(let i=0;i<=count;i++){
      const t=Math.min(duration,i/5);
      pictures.push(await page.evaluate(({clip,t})=>{const paired=!!window.wwzardScene.packs.screen.clips[clip];window.posecraft.previewClip('wwzard',clip,t);window.posecraft.previewClip('screen',paired?clip:'still',paired?t:0);return document.querySelector('#illustration').innerHTML;},{clip,t}));
    }
    const sheet=await browser.newPage({viewport:{width:1120,height:900}});
    await sheet.setContent(`<style>body{margin:0;background:#fff;font:12px system-ui;color:#57456b}main{display:grid;grid-template-columns:repeat(4,280px)}figure{margin:0;position:relative}svg{display:block;width:280px;height:280px}figcaption{padding:5px 15px}</style><main>${pictures.map((svg,i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${clip} · ${Math.min(duration,i/5).toFixed(2)} s</figcaption></figure>`).join('')}</main>`);
    await sheet.screenshot({path:`${out}/${clip}.png`,fullPage:true});await sheet.close();
  }
  await page.setViewportSize({width:390,height:844});await page.reload();await page.waitForFunction(()=>!!window.posecraft);await page.screenshot({path:out+'/phone-viewport.png',fullPage:true});
  console.log(JSON.stringify({directory:out,clips:Object.keys(durations),review:'pending human/model visual inspection; phone viewport is emulation'}));
} finally {await browser.close();}
