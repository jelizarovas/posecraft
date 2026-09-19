import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5197').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:1200,height:680}});
  await page.goto(base+'/');
  await page.evaluate(async()=>{
    const {drawMapActor}=await import('/src/map-character.js');
    document.body.innerHTML='<canvas width="1200" height="680"></canvas>';document.body.style.cssText='margin:0;background:#edf0e3;';
    const ctx=document.querySelector('canvas').getContext('2d');ctx.fillStyle='#edf0e3';ctx.fillRect(0,0,1200,680);
    ctx.fillStyle='#35463d';ctx.font='18px system-ui';ctx.fillText('Map character: world heading, idle and alternating stride poses',24,30);
    for(let i=0;i<8;i++){
      const facing=i*Math.PI/4,left=(i%4)*300,top=Math.floor(i/4)*310+50;
      ctx.strokeStyle='#c5ceba';ctx.strokeRect(left+8,top,284,294);ctx.fillStyle='#53624f';ctx.font='14px system-ui';ctx.fillText(`World heading ${i*45}°`,left+22,top+25);
      const arrow={x:(Math.cos(facing)-Math.sin(facing))*16,y:(Math.cos(facing)+Math.sin(facing))*8};ctx.beginPath();ctx.moveTo(left+150,top+65);ctx.lineTo(left+150+arrow.x,top+65+arrow.y);ctx.strokeStyle='#8665be';ctx.lineWidth=3;ctx.stroke();
      [0,1,2].forEach((pose)=>{ctx.save();ctx.translate(left+55+pose*95,top+230);ctx.scale(2.9,2.9);drawMapActor(ctx,{tileSize:{width:64,height:32}},{x:0,y:0,facing,travelFacing:facing,phase:pose===1?Math.PI*.4:Math.PI*1.4,walking:pose!==0},{color:'#8665be'},false);ctx.restore();ctx.fillStyle='#66715e';ctx.font='12px system-ui';ctx.fillText(pose===0?'Standing':pose===1?'Step A':'Step B',left+34+pose*95,top+269);});
    }
  });
  await fs.mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/map-character-directions.png'});
  console.log('Eight-direction map character contact sheet saved.');
}finally{await browser.close();}
