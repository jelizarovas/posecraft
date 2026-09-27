import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const base=process.env.PORTFOLIO_URL||'http://192.168.0.17:5256';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
const errors=[],requests=[],dir='test-results/portfolio-scenes';
await fs.mkdir(dir,{recursive:true});
try{
  for(const width of [1280,390]){
    const page=await browser.newPage({viewport:{width,height:850}});
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
    for(const scene of ['stories','projects','contact']){
      await page.goto(base+'/'+scene);
      const host=page.locator(`.portfolio-character[data-scene="${scene}"][data-posecraft-ready="true"]`);
      await host.waitFor();
      assert.equal(await page.locator('.portfolio-character-runtime svg').count(),1);
      assert.equal(await page.locator('.portfolio-character img').count(),0,'fallback is removed after live mount');
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width,'no horizontal overflow');
      const time=await host.locator('svg').getAttribute('data-scene-time');
      await page.waitForFunction(time=>document.querySelector('.portfolio-character-runtime svg')?.getAttribute('data-scene-time')!==time,time);
      await page.waitForTimeout(700);
      await page.screenshot({path:`${dir}/${scene}-${width}.png`,fullPage:true});
      if(scene==='projects'){
        await page.locator('.site-scroll').evaluate(element=>element.scrollTop=650);
        await page.waitForTimeout(350);
        const stopped=await host.locator('svg').getAttribute('data-scene-time');
        await page.waitForTimeout(300);
        assert.equal(await host.locator('svg').getAttribute('data-scene-time'),stopped,'offscreen scene suspends');
        await page.locator('.site-scroll').evaluate(element=>element.scrollTop=0);
        await page.waitForFunction(time=>document.querySelector('.portfolio-character-runtime svg')?.getAttribute('data-scene-time')!==time,stopped);
      }
      if(scene==='contact'){
        const name=page.getByPlaceholder('Your name');
        await name.focus();assert.equal(await host.getAttribute('data-activity'),'ready','focus alone does not type');
        await name.fill('Preview check');
        assert.equal(await host.getAttribute('data-activity'),'typing');
        await page.waitForFunction(()=>document.querySelector('.portfolio-character')?.dataset.activity==='ready');
        await page.getByPlaceholder('Email or phone').fill('preview@example.invalid');
        await page.getByPlaceholder('A role, a project, or a quick hello').fill('Local animation check');
        await page.getByPlaceholder('Write your message').fill('Browser test; intercepted before delivery.');
        let submitted=0;
        await page.route('**/*submitPortfolioContact*',async route=>{
          submitted++;
          await new Promise(resolve=>setTimeout(resolve,700));
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{ok:true}})});
        });
        await page.getByRole('button',{name:'Send message'}).click();
        await page.waitForFunction(()=>document.querySelector('.portfolio-character')?.dataset.activity==='sending');
        await page.waitForFunction(()=>document.querySelector('.portfolio-character')?.dataset.activity==='sent');
        assert.equal(submitted,1,'submission was intercepted, never sent to the backend');
        await page.screenshot({path:`${dir}/contact-sent-${width}.png`});
        await page.getByRole('button',{name:'Send another one'}).click();
        await name.fill('Preview check');
        await page.getByPlaceholder('Email or phone').fill('preview@example.invalid');
        await page.getByPlaceholder('A role, a project, or a quick hello').fill('Local animation check');
        await page.getByPlaceholder('Write your message').fill('Mocked error test.');
        await page.unroute('**/*submitPortfolioContact*');
        await page.route('**/*submitPortfolioContact*',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{status:'INTERNAL',message:'Preview test failure'}})}));
        await page.getByRole('button',{name:'Send message'}).click();
        await page.waitForFunction(()=>document.querySelector('.portfolio-character')?.dataset.activity==='error');
        assert.equal(await page.getByPlaceholder('Write your message').inputValue(),'Mocked error test.');
      }
    }
    await page.goto(base+'/');await page.locator('.wwwzard-runtime[tabindex="0"]:visible').waitFor();
    assert.equal(await page.locator('.portfolio-character-runtime svg').count(),0,'section scene disposed on home route');
    await page.close();
  }
  const reduced=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
  reduced.on('pageerror',e=>errors.push(e.message));
  for(const scene of ['stories','projects','contact']){
    await reduced.goto(base+'/'+scene);await reduced.locator('.portfolio-character[data-posecraft-ready="true"]').waitFor();
    const svg=reduced.locator('.portfolio-character-runtime svg'),time=await svg.getAttribute('data-scene-time');
    await reduced.waitForTimeout(300);assert.equal(await svg.getAttribute('data-scene-time'),time,'reduced motion has no continuous playback');
  }
  assert(!requests.some(url=>/localhost:5247|127\.0\.0\.1:5247|\/src\/|\/examples\//.test(url)));
  assert.deepEqual(errors,[]);
  const report={routes:['stories','projects','contact'],widths:[1280,390],physicalPhone:false,reducedMotion:true,contactResults:'mocked success and failure',sourceCheckoutRequests:false,errors};
  await fs.writeFile(`${dir}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}
