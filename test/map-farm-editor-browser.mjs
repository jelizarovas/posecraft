import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {createTownMap} from '../examples/town-map.js';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:1400,height:900}}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 const map=createTownMap();map.props.push({id:'cover-fixture',kind:'decoration',art:'wheat',x:64,y:64,width:1,height:1,collision:{shape:'none'},occlusion:{mode:'low-foliage',lowerBodyFraction:.5}});
 await page.addInitScript(map=>localStorage.setItem('posecraft-map-editor-draft-v1',JSON.stringify(map)),map);
 await page.goto('http://localhost:5246/map-editor.html');
 for(const id of ['farm-pumpkin','farm-corn','farm-mine','farm-coop','farm-cow','farm-fence-broken-y','farm-hay-rack','farm-water-trough','farm-water-bucket','farm-chicken-feeder'])await page.locator(`[data-prop-brush="${id}"]`).waitFor();
 await page.locator('[data-action="home"]').click();await page.locator('[data-tool="select"]').click();
 const stage=await page.locator('.map-overlay').boundingBox();await page.mouse.click(stage.x+stage.width/2,stage.y+stage.height/2);
 await page.locator('[data-occlusion-field="fraction"]').fill('35');await page.locator('[data-occlusion-field="fraction"]').press('Tab');
 const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('posecraft-map-editor-draft-v1')).props.find(p=>p.id==='cover-fixture').occlusion);
 assert.deepEqual(await saved(),{mode:'low-foliage',lowerBodyFraction:.35});
 await page.locator('[data-occlusion-field="mode"]').selectOption('ground');assert.deepEqual(await saved(),{mode:'ground'});
 assert.deepEqual(errors,[]);console.log('Passed: farm palette and cover inspector persist edited map data.');
}finally{await browser.close();}
