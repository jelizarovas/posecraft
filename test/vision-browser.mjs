import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage(),external=[];page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('blob:'))external.push(r.url());});await page.goto(base+'/director.html');
 const path=process.env.POSECRAFT_URL?'/assets/'+fs.readdirSync('dist/assets').find(n=>n.startsWith('vision-worker-')):'/studio/vision-worker.js';
 const results=await page.evaluate(async({images,url,base})=>{
  // Accelerate the SDK telemetry timer to verify it cannot send requests.
  const wrapper=URL.createObjectURL(new Blob([`const interval=self.setInterval.bind(self);self.setInterval=(fn,ms)=>interval(fn,ms===60000?100:ms);await import(${JSON.stringify(url)});self.postMessage({type:"boot"});`],{type:'text/javascript'})),worker=new Worker(wrapper,{type:'module'}),results=[];
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{worker.terminate();reject(new Error('Vision timeout'));},45000);let i=0;const finish=()=>{clearTimeout(timer);worker.terminate();URL.revokeObjectURL(wrapper);};
   worker.onerror=e=>{finish();reject(new Error(e.message));};worker.onmessage=async({data:m})=>{if(m.type==='boot'){worker.postMessage({type:'init',base:base+'/vision'});return;}if(m.type==='error'){finish();reject(new Error(m.message));return;}if(m.type==='result')results.push({face:m.face?.length||0,hands:m.hands.length,ms:m.computeMs,blendshapes:Object.keys(m.blendshapes).length});if(i===images.length){await new Promise(r=>setTimeout(r,350));finish();resolve(results);return;}const image=new Image();image.src='data:image/jpeg;base64,'+images[i++];await image.decode();const bitmap=await createImageBitmap(image);worker.postMessage({type:'frame',bitmap,time:i*100},[bitmap]);};
  });
 },{images:['vision-face.jpg','vision-hands.jpg'].map(n=>fs.readFileSync('test-results/'+n).toString('base64')),url:base+path,base});
 assert.equal(results[0].face,478);assert.equal(results[0].blendshapes,52);assert.equal(results[1].hands,2);assert.deepEqual(external,[]);console.log('Real model checks passed: 478 face landmarks, 52 blendshapes, two hands; SDK telemetry timer cannot send external requests.',results);
}finally{await browser.close();}
