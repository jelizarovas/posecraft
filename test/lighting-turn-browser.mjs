import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto(base+'/?demo=light-and-shade');await page.locator('#art svg').waitFor();
 for(const style of ['cel','gradient']){
  await page.locator('[data-panel="light"]').click();await page.locator('#lighting-shading').selectOption(style);
  for(const [actor,part] of [['ona','face-0'],['dummy','head-shell']]){
   await page.locator('#actors').selectOption(actor);await page.locator('[data-panel="pose"]').click();await page.locator('[data-select-joint="root"]').click();await page.locator('#pose-channel').selectOption('yaw');
   for(const yaw of [0,45,89,90,91,135,180,-135,-91,-90,-89,0]){
    await page.locator('#rotation').fill(String(yaw));await page.locator('#rotation').dispatchEvent('input');await page.waitForTimeout(100);
    const direction=await page.locator(`#art [data-actor="${actor}"]`).evaluate((root,part)=>{const path=root.querySelector(`[data-part="${part}"]`),gradient=root.querySelector(`[data-surface="${part}"]`),box=path.getBBox(),m=path.getCTM(),dx=(+gradient.getAttribute('cx')-.5)*box.width,dy=(+gradient.getAttribute('cy')-.5)*box.height;return {x:m.a*dx+m.c*dy,y:m.b*dx+m.d*dy};},part);
    assert.ok(direction.x<-.1&&direction.y<-.1,`${style} ${actor} yaw ${yaw}: light must remain upper left, ${JSON.stringify(direction)}`);
    if(yaw===180)await page.screenshot({path:`test-results/light-turn-${style}-${actor}.png`});
   }
  }
 }
 assert.deepEqual(errors,[]);console.log('Turning light checks passed: both characters, soft and sharp shading, front/profile/back and both sides of 90 degrees.');
}finally{await browser.close();}
