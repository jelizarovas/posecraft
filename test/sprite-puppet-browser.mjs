import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from '@playwright/test';

const output=resolve('test-results/sprite-puppet');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||(process.platform==='win32'?'msedge':undefined)});
try{
  const page=await browser.newPage({viewport:{width:900,height:660},reducedMotion:'reduce'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.POSECRAFT_PUPPET_URL||'http://127.0.0.1:5261/puppet.html');
  await page.locator('#track option').first().waitFor({state:'attached'});
  const canvas=page.locator('canvas');
  const scrub=t=>page.locator('#time').evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input'));},String(t));
  // A connected silhouette also passes with a rigid shirt and a bare arm across
  // its opening. Isolate the fabric and check the actual painted cuff as it lifts.
  const shirt=JSON.parse(await readFile(new URL('../examples/characters/porch-zombie.puppet.json',import.meta.url),'utf8'));
  shirt.bounds=[-7,-6,14,12];
  shirt.parts=shirt.parts.filter(p=>p.id==='body'||p.id.endsWith('Shoulder'));
  for(const p of shirt.parts.slice(1))p.size=.001;
  shirt.clip={duration:2,loop:false,tracks:{view:[[0,48,'step']],
    'leftShoulder.rotation':[[0,0,'linear'],[1,84,'linear'],[2,84]],
    'rightShoulder.rotation':[[0,0,'linear'],[1,0,'linear'],[2,-74]]}};
  await page.locator('#open').setInputFiles({name:'shirt-check.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(shirt))});
  await page.getByText('Opened shirt-check.json').waitFor();
  for(let step=0;step<=20;step++){
    await scrub(step/10);
    const check=await canvas.evaluate((c,{step,pivots})=>{
      const ctx=c.getContext('2d'),fit=Math.min(c.width/14,c.height/12)*9/128;
      function pixel(x,y){return ctx.getImageData(Math.round(c.width/2+(x-64)*fit),Math.round(c.height/2+(y-64)*fit),1,1).data;}
      const cuffs=[[0,14,Math.min(step,10)*8.4],[1,114,-Math.max(step-10,0)*7.4]];
      for(const [side,rest,angle] of cuffs){
        const [px,py]=pivots[side],a=angle*Math.PI/180;
        const x=px+(rest-px)*Math.cos(a)-(60-py)*Math.sin(a);
        const y=py+(rest-px)*Math.sin(a)+(60-py)*Math.cos(a);
        for(let n=0;n<=12;n++){
          const t=n/12,p=pixel(x+(64-x)*t,y+(53-y)*t);
          if(p[3]<190||p[0]<=p[1])return {step,x,y,n,rgba:[...p]};
        }
      }
      return null;
    },{step,pivots:shirt.parts[0].skin.views[48].pivots});
    assert.equal(check,null,JSON.stringify(check));
  }
  // With the actual arms restored, skin must fill the width of the opening,
  // including the inside corners where a narrow, offset arm leaves a dark hole.
  const original=JSON.parse(await readFile(new URL('../examples/characters/porch-zombie.puppet.json',import.meta.url),'utf8'));
  shirt.parts=original.parts.filter(p=>p.id==='body'||p.id.endsWith('Shoulder'));
  shirt.clip={duration:1,loop:false,tracks:{view:[[0,0,'linear'],[1,48,'linear']]}};
  for(const side of ['left','right'])for(const axis of ['x','y','depth']){
    const key=side+'Shoulder.'+axis;
    shirt.clip.tracks[key]=[original.clip.tracks[key][0]];
  }
  await page.locator('#open').setInputFiles({name:'cuff-fit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(shirt))});
  await page.getByText('Opened cuff-fit.json').waitFor();
  for(const view of [0,8,16,24,32,40,48]){
    await scrub(view/48);
    const missing=await canvas.evaluate((c,view)=>{
      const ctx=c.getContext('2d'),scale=Math.min(c.width/14,c.height/12)*9/128;
      const lips=[[[46,66,80,80],[86,77,116,63],[106,78,126,63]]];
      if(view>=24)lips.push([[54,64,66,70],[15,61,24,69],[3,63,25,78]]);
      const i=view<24?0:1,f=(view-24*i)/24,missing=[];
      for(const [side,samples] of lips.entries()){
        const [x1,y1,x2,y2]=samples[i].map((a,j)=>a+(samples[i+1][j]-a)*f);
        for(const u of [.2,.35,.5,.65,.8]){
          const x=x1+(x2-x1)*u+(side?-1.2:1.2),y=y1+(y2-y1)*u+3;
          const [r,g,,a]=ctx.getImageData(Math.round(c.width/2+(x-64)*scale),Math.round(c.height/2+(y-64)*scale),1,1).data;
          if(a<220||g<=r)missing.push([side,u]);
        }
      }
      return missing;
    },view);
    assert.deepEqual(missing,[],'painted arm fills the cuff at view '+view);
  }
  await page.reload();await page.locator('#track option').first().waitFor({state:'attached'});
  // A correct joint transform alone cannot prove that the painted pieces touch.
  const detached=await page.evaluate(()=>{
    const c=document.querySelector('canvas'),input=document.querySelector('#time'),ctx=c.getContext('2d');
    const w=c.width,h=c.height,queue=new Int32Array(w*h),bad=[];
    for(let frame=0;frame<=204;frame++){
      input.value=String(frame/30);input.dispatchEvent(new Event('input'));
      const pixels=ctx.getImageData(0,0,w,h).data;
      let components=0;
      for(let i=0;i<w*h;i++){
        if(pixels[4*i+3]<100)continue;
        let read=0,count=1;queue[0]=i;pixels[4*i+3]=0;
        while(read<count){
          const p=queue[read++];
          for(const n of [p-w,p+w,p%w?p-1:-1,p%w<w-1?p+1:-1]){
            if(n<0||n>=w*h||pixels[4*n+3]<100)continue;
            pixels[4*n+3]=0;queue[count++]=n;
          }
        }
        if(count>=12)components++;
      }
      if(components!==1)bad.push(frame);
    }
    return bad;
  });
  assert.deepEqual(detached,[],'every full-body pose has one connected painted silhouette');
  for(const t of [0,.65,1.3,1.85,2.7,3.2,4,4.35,5.15,6.7]){
    await scrub(t);await canvas.screenshot({path:resolve(output,'pose-'+t+'.png')});
  }
  await scrub(3.21);
  await page.getByLabel('Face close-up').check();
  const dial=(name,n)=>page.getByRole('slider',{name,exact:true}).evaluate((input,v)=>{
    input.value=v;input.dispatchEvent(new Event('input'));
  },String(n));
  const artwork=()=>canvas.evaluate(c=>c.toDataURL());
  for(const [name,count] of [['Head turn',49],['Left eyelid',11],['Right eyelid',11],['Whistle',11]]){
    const frames=new Set();
    for(let i=0;i<count;i++){await dial(name,i);frames.add(await artwork());}
    assert.equal(frames.size,count,name+' must produce distinct rendered drawings');
  }
  await dial('Right eyelid',0);await dial('Whistle',6);
  await page.getByRole('button',{name:'Key at playhead'}).click();
  await page.getByText('Face keys saved at 3.21 s.').waitFor();
  await page.getByLabel('Face close-up').uncheck();
  const painted=await artwork();
  await page.getByLabel('3D skeleton').selectOption('overlay');const joints=await artwork();
  await page.getByLabel('3D skeleton').selectOption('side');const side=await artwork();
  assert.equal(new Set([painted,joints,side]).size,3);
  await page.getByLabel('3D skeleton').selectOption('');
  await page.locator('#track').selectOption('head.yaw');
  await page.locator('#value input').fill('-12');await page.locator('#set').click();
  await page.getByText('Keyframes updated.').waitFor();
  await page.locator('#track').selectOption('leftElbow.twist');
  assert.equal(await page.getByLabel('Minimum °').inputValue(),'0');
  await page.getByLabel('Maximum °').fill('82');await page.getByRole('button',{name:'Apply limits'}).click();
  await page.getByText('Joint limits saved.').waitFor();
  await page.getByLabel('Forearm twist in degrees').fill('240');await page.locator('#set').click();
  await page.getByText('Key saved at the joint limit of 82°.').waitFor();
  await page.locator('#track').selectOption('grip');await page.locator('#key').selectOption('2');
  await page.locator('#at').fill('3.11');await page.locator('#set').click();
  await page.getByText('Keyframes updated.').waitFor();
  const save=page.waitForEvent('download');await page.locator('#save').click();
  const file=resolve(output,'edited.puppet.json');await (await save).saveAs(file);
  const saved=JSON.parse(await readFile(file,'utf8')),tracks=saved.clip.tracks;
  assert.deepEqual(saved.parts.find(p=>p.id==='leftElbow').space.limits.twist,[0,82]);
  assert.equal(tracks['leftElbow.twist'][0][1],82);
  assert.equal(tracks.grip[2][0],3.11);
  assert.equal(tracks['head.yaw'][0][1],-12);
  for(const [channel,value] of [['leftEyelid',10],['rightEyelid',0],['mouth',6]])
    assert.deepEqual(tracks[channel].find(([time])=>time===3.21),[3.21,value,'smooth']);
  await page.reload();await page.locator('#open').setInputFiles(file);
  await page.getByText('Opened edited.puppet.json').waitFor();await page.locator('#track').selectOption('grip');
  assert.match(await page.locator('#key').innerText(),/3.11 s · Four/);
  const exported=page.waitForEvent('download');await page.locator('#website').click();
  const html=resolve(output,'export.html');await (await exported).saveAs(html);
  await page.context().setOffline(true);
  await page.goto(pathToFileURL(html).href);
  await page.waitForFunction(()=>document.querySelector('canvas').width>300);
  const pixels=()=>page.locator('canvas').evaluate(c=>c.toDataURL());
  const still=await pixels();await page.waitForTimeout(250);assert.equal(await pixels(),still);
  await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(600);
  assert.notEqual(await pixels(),still);
  const embed=await readFile(html,'utf8');
  await page.goto('about:blank');
  await page.evaluate(markup=>{
    document.body.style.height='300vh';
    const input=document.createElement('input');input.setAttribute('aria-label','Host input');document.body.append(input);
    for(let i=0;i<2;i++){
      const frame=document.createElement('iframe');frame.style.cssText='display:block;width:220px;height:180px';
      frame.srcdoc=markup;document.body.append(frame);
    }
  },embed);
  await page.waitForFunction(()=>[...document.querySelectorAll('iframe')].every(f=>f.contentDocument?.querySelector('canvas')?.width===220));
  const embeddedPixels=()=>page.evaluate(()=>[...document.querySelectorAll('iframe')].map(f=>f.contentDocument.querySelector('canvas').toDataURL()));
  await page.getByRole('textbox').fill('still responsive');
  await page.evaluate(()=>scrollTo(0,1400));await page.waitForTimeout(180);
  const sleeping=await embeddedPixels();await page.waitForTimeout(220);assert.deepEqual(await embeddedPixels(),sleeping);
  await page.evaluate(()=>scrollTo(0,0));await page.waitForTimeout(650);
  const resumed=await embeddedPixels();assert.ok(resumed.every((p,i)=>p!==sleeping[i]));
  await page.evaluate(()=>document.querySelectorAll('iframe').forEach(f=>f.remove()));
  assert.equal(await page.getByRole('textbox').inputValue(),'still responsive');
  assert.deepEqual(errors,[]);
  console.log('PASS key editing, saved file, reopen, offline animated export and reduced motion.');
}catch(error){
  const page=browser.contexts()[0]?.pages()[0];
  console.error('Studio status:',await page?.locator('#status').textContent({timeout:500}).catch(()=>'unavailable'));
  throw error;
}finally{await browser.close();}
