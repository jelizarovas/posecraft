import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {createGym} from '../examples/gym.js';
import {spatialParts,setWorldOrientation,turnaroundPath} from '../src/spatial.js';
import {forwardKinematics} from '../src/index.js';
const pack=createGym().packs.atlas,angles=[0,45,90,135,172.5,180,187.5,225,270,337.5,352.5,360],joint=(id,parent)=>({id,parent,x:0,y:0,rotation:0,min:-180,max:180}),shoe=structuredClone(pack.parts.find(p=>p.id==='leftshoe'));shoe.joint='foot';delete shoe.spatial.surfaceOf;
const rig={spatial:true,joints:[joint('root',null),joint('thigh','root'),joint('calf','thigh'),joint('foot','calf')],parts:[shoe]};
const cases=angles.map(angle=>{const pose={'thigh.rotation':105,'thigh.yaw':-36,'calf.rotation':-110,'calf.yaw':45};setWorldOrientation(pose,'foot',['root','thigh','calf'],{rotation:0,yaw:angle,pitch:-12});const view=spatialParts(rig,{pose,world:forwardKinematics(rig.joints,pose)}).parts.get(shoe.id);return {angle,view};});
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1100,height:850}});
try{
 await page.setContent(`<style>body{background:#edf0f2;font:14px system-ui;color:#263044;margin:24px}main{display:grid;grid-template-columns:repeat(6,160px);gap:14px}.case{background:white;border-radius:12px;padding:8px;text-align:center}svg{display:block;width:100%;height:140px}.shoe{height:90px}</style><h2>Directional contours · inherited leg rotation corrected</h2><main>${cases.map(({angle,view},index)=>`<div class="case"><b>${angle}°</b><svg viewBox="-43 -45 86 88">${['head-shape','hair','beard','eyes','eyebrows','nose','back-hair-strands'].map(id=>{const p=pack.parts.find(p=>p.id===id);return `<path d="${turnaroundPath(p,angle)}" fill="${p.fill}" stroke="${p.stroke||'none'}" stroke-width="${p.strokeWidth||0}"/>`;}).join('')}</svg><svg class="shoe" viewBox="-35 -18 70 38"><path id="shoe-${index}" d="${view.d}" transform="${view.transform}" fill="#e6e7eb" stroke="#292c38" stroke-width="2"/></svg></div>`).join('')}</main>`);
 const boxes=await page.evaluate(()=>[...document.querySelectorAll('[id^="shoe-"]')].map(p=>{const b=p.getBBox();return {width:b.width,height:b.height,length:p.getTotalLength()};}));for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].width>18&&boxes[i].width<36,`stable shoe width at ${angles[i]}`);assert.ok(boxes[i].height>10&&boxes[i].height<18,`stable shoe height at ${angles[i]}`);assert.ok(boxes[i].length>50&&boxes[i].length<110);}
 await page.screenshot({path:'test-results/directional-rotation-review.png',fullPage:true});console.log('Directional SVG review passed: stable shoes at front/profile/rear and former mirror-collapse intervals.');
}finally{await browser.close();}
