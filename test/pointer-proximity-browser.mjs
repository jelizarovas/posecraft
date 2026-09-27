import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1280,height:950}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5247/wwwzard.html');await page.waitForFunction(()=>!!window.posecraft);
 const point=(x,y)=>page.evaluate(({x,y})=>{const p=new DOMPoint(x,y).matrixTransform(document.querySelector('#illustration svg').getScreenCTM());return{x:p.x,y:p.y};},{x,y});
 const from=await point(195,280),to=await point(150,280);
 await page.mouse.move(from.x,from.y);await page.waitForTimeout(20);await page.mouse.move(to.x,to.y);
 await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.actions.room?.activity==='gustLeft');
 await page.waitForTimeout(900);await page.mouse.move(to.x,to.y);await page.waitForTimeout(20);await page.mouse.move(from.x,from.y);
 await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.actions.room?.activity==='gustRight');
 await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.actions.room?.active===false);
 const settled=await page.evaluate(()=>window.posecraft.controller.frame().behavior.actions.room);
 const a=await point(440,120),b=await point(485,120);
 await page.mouse.move(a.x,a.y);await page.waitForTimeout(20);await page.mouse.move(b.x,b.y);
 assert.deepEqual(await page.evaluate(()=>window.posecraft.controller.frame().behavior.actions.room),settled,'distant movement does not trigger a new gust');
 const laptop=await point(365,300);await page.mouse.click(laptop.x,laptop.y);
 await page.waitForFunction(()=>window.posecraft.controller.frame().behavior.state==='closingLaptop');
 assert.equal(await page.evaluate(()=>window.posecraft.controller.frame().behavior.variables.anger),28);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({blankAreaProximity:true,directionalGusts:true,distantIgnored:true,actualLidClick:true}));
}finally{await browser.close();}
