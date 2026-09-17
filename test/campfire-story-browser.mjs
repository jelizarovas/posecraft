import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5178').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})}),page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));
const part=(actor,name)=>page.locator(`#demo-art [data-actor="${actor}"] [data-part="${name}"]`);
async function seek(t){t=Math.round(t/.04)*.04;await page.locator('#demo-scrub').fill(String(Number(t.toFixed(2))));await page.locator('#demo-scrub').dispatchEvent('input');await page.waitForFunction(t=>Math.abs(+document.querySelector('#demo-art svg').dataset.sceneTime-t)<.025,t);return page.locator('#demo-art svg').evaluate(e=>({...e.dataset}));}
async function start(event){await page.locator('#demo-reset').click();if(event==='share')await page.locator('#camp-share').click();else await page.locator('#camp-reaction').selectOption(event);}
async function point(actor,name){return part(actor,name).evaluate(e=>{const m=e.getCTM();return {x:m.e,y:m.f};});}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
async function capture(name){await page.locator('#demo-art').screenshot({path:`test-results/story-${name}.png`});}
try{
 await page.goto(base+'/demos.html#campfire-night');await page.locator('#demo-art svg').waitFor();
 await start('share');const offer=await seek(3.8),giver=offer.shareGiver,receiver=offer.shareReceiver;
 assert.equal(offer.sharePhase,'offer');assert.equal(offer.shareOwner,giver);await capture('offer');
 await seek(4.72);assert.ok(+await part(receiver,'camp-notice').getAttribute('opacity')>.4);await capture('notice');
 const from=await point(receiver,'take-palm');const walk=await seek(6.8);assert.equal(walk.sharePhase,'approach');assert.ok(distance(from,await point(receiver,'take-palm'))>25,'distant recipient visibly approaches');assert.equal(+await part(receiver,'roasting-stick').getAttribute('opacity'),0);const shadow=page.locator(`#demo-art [data-contact="${receiver}"]`);assert.ok(+await shadow.getAttribute('cy')<390,'contact shadow follows depth');await capture('walk');
 const near=await seek(8.72);assert.equal(near.shareOwner,giver);const a=await point(giver,'take-palm'),b=await point(receiver,'take-palm');assert.ok(distance(a,b)<3,'hands meet before ownership transfers');await capture('contact');
 const eating=await seek(9.2);assert.equal(eating.shareOwner,receiver);assert.ok(+eating.shareContact<3);assert.equal(+await part(giver,'marshmallow').getAttribute('opacity'),0);assert.equal(+await part(receiver,'marshmallow').getAttribute('opacity'),1);assert.ok(distance(await point(receiver,'take-palm'),await point(receiver,'marshmallow'))<1);assert.equal(+await part(giver,'toast').getAttribute('opacity'),0);await capture('eat');
 assert.equal((await seek(20)).sharePhase,'');
 await start('share-missed');assert.equal((await seek(8.92)).sharePhase,'disappointed');assert.ok(+await part(giver,'camp-disappointed').getAttribute('opacity')>.8);await capture('disappointed');
 const flying=await seek(10.4);assert.equal(flying.shareOwner,'');const before=await point(giver,'marshmallow');await capture('toss');await seek(10.72);assert.ok(distance(before,await point(giver,'marshmallow'))>5);await seek(11.48);assert.equal(+await part(giver,'marshmallow').getAttribute('opacity'),0);assert.equal(+await part(giver,'toast').getAttribute('opacity'),0);
 await start('share-help');await seek(6.2);assert.ok(+await part('camper-0','camp-shout').getAttribute('opacity')>.4);await capture('help');assert.equal((await seek(11.2)).shareOwner,receiver);
 await start('burn');await seek(.36);for(const id of ['camp-startle','camp-startle-eyes','camp-startle-mouth','camp-sweat'])assert.ok(+await part('camper-0',id).first().getAttribute('opacity')>.6,id+' visible');await capture('burn');await seek(1.2);assert.ok(+await part('camper-0','camp-startle').getAttribute('opacity')<1e-8);
 await page.setViewportSize({width:390,height:844});const footer=await page.locator('.demo-footer').boundingBox();assert.ok(footer.y+footer.height<=845);await page.screenshot({path:'test-results/story-mobile.png'});
 assert.deepEqual(errors,[]);console.log('Campfire story passed: offer, delayed notice, distant approach, actual hand contact, ownership, return, missed offer/toss, friend callout, burn reaction and mobile fit.');
}finally{await browser.close();}
