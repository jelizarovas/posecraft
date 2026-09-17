import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {softLimbPath,spatialKinematics} from '../src/spatial.js';
const pack={spatial:true,joints:[{id:'root',parent:null,x:0,y:0,rotation:0},{id:'upper',parent:'root',x:0,y:0,rotation:0},{id:'elbow',parent:'upper',x:26,y:0,rotation:0},{id:'hand',parent:'elbow',x:26,y:0,rotation:0}]},part={joint:'upper',spatial:{softLimb:{elbow:'elbow',hand:'hand',radius:7}}};
const samples=[];for(const elbow of [0,45,90,135,175,-175])for(const wrist of [-180,-90,0,90,180]){const pose={'elbow.rotation':elbow,'hand.rotation':wrist},world=spatialKinematics(pack,pose);samples.push({pose,path:softLimbPath(pack,part,pose),world,label:`elbow ${elbow} · wrist ${wrist}`});}
for(const yaw of [-180,-91,-90,-89,0,89,90,91,180])for(const pitch of [-80,0,80]){const pose={'root.yaw':yaw,'upper.pitch':pitch,'elbow.rotation':125,'hand.rotation':180,'hand.pitch':pitch},world=spatialKinematics(pack,pose);samples.push({pose,path:softLimbPath(pack,part,pose),world,label:`yaw ${yaw} · pitch ${pitch}`});}
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1150,height:1000}});
try{
 await page.setContent(`<style>body{font:12px Arial;background:#eee}main{display:grid;grid-template-columns:repeat(6,180px);gap:8px}.case{background:white;padding:4px;text-align:center}svg{display:block;width:170px;height:120px}</style><main>${samples.map((s,i)=>`<div class="case"><svg viewBox="-35 -45 110 100"><path id="p${i}" d="${s.path}" fill="#fafbf8" stroke="#383936" stroke-width="1.5"/>${['upper','elbow','hand'].map(id=>`<circle cx="${s.world[id].x}" cy="${s.world[id].y}" r="1" fill="#d44"/>`).join('')}</svg>${s.label}</div>`).join('')}</main>`);
 const checks=await page.evaluate(samples=>samples.map((s,i)=>{const p=document.getElementById('p'+i),box=p.getBBox(),points=['upper','elbow','hand'].map(id=>new DOMPoint(s.world[id].x,s.world[id].y));return {filled:points.map(point=>p.isPointInFill(point)),seams:points.map(point=>p.isPointInStroke(point)),box:{x:box.x,y:box.y,width:box.width,height:box.height},length:p.getTotalLength()};}),samples);
 checks.forEach((c,i)=>{assert.ok(c.filled.every(Boolean),samples[i].label+' must enclose the actual joint centers');assert.ok(c.seams.every(v=>!v),samples[i].label+' has no interior elbow/wrist stroke');assert.ok(c.box.width<=75&&c.box.height<=75,samples[i].label+' stays within the finite limb reach');assert.ok(Number.isFinite(c.length)&&c.length<220);});
 // Cross the old wrist normal reversal one degree at a time. Filled contact and
 // perimeter stay continuous, even when the palm folds back into the forearm.
 const turn=[];for(let rotation=170;rotation<=190;rotation++){const pose={'elbow.rotation':140,'hand.rotation':rotation};turn.push(softLimbPath(pack,part,pose));}
 const lengths=await page.evaluate(paths=>{const p=document.getElementById('p0');return paths.map(d=>{p.setAttribute('d',d);return p.getTotalLength();});},turn);for(let i=1;i<lengths.length;i++)assert.ok(Math.abs(lengths[i]-lengths[i-1])<1,'no wrist perimeter jump at reversal');
 await page.locator('#p0').evaluate((p,d)=>p.setAttribute('d',d),samples[0].path);
 await page.screenshot({path:'test-results/soft-limb-volumes.png',fullPage:true});console.log('Soft limb geometry checks passed: 57 folded/turned/foreshortened poses enclose joint contacts with no internal strokes; wrist reversal is continuous.');
}finally{await browser.close();}
