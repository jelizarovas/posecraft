import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5197').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:700,height:520}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/fence-pick-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body,#map{margin:0;width:100%;height:100%}</style><div id="map"></div>'}));await page.goto(base+'/fence-pick-fixture');
 await page.evaluate(async()=>{const[{mountMap},{createTownMap}]=await Promise.all([import('/src/map-browser.js'),import('/examples/town-map.js')]),map=createTownMap(),cx=Math.floor(map.width/2),cy=Math.floor(map.height/2);map.actors[0].x=cx;map.actors[0].y=cy+12.6;window.events=[];window.view=mountMap(document.querySelector('#map'),map,{execution:'main',autoplay:true,onEvent:event=>events.push(event)});await view.ready;view.zoomTo(2);view.panTo(cx,cy+13.5);});
 const point=await page.evaluate(()=>view.mapToScreen({x:64,y:77.5,z:.62}));await page.mouse.click(point.x,point.y);
 await page.waitForFunction(()=>events.some(event=>event.type==='map.traversal.started'&&event.object==='pasture-north-west-a'));
 await page.waitForFunction(()=>!view.controller.isMoving);
 const result=await page.evaluate(()=>({actor:view.controller.actorPosition('hero'),event:events.find(event=>event.type==='map.traversal.started'),errors:events.filter(event=>event.type==='map.error')}));
 assert.ok(result.actor.y>77.5,'rendered rail click lands inside pasture');assert.equal(result.event.object,'pasture-north-west-a');assert.deepEqual(result.errors,[]);assert.deepEqual(errors,[]);console.log('Passed: rendered no-art pasture span picks and vaults to the opposite side.');
}finally{await browser.close();}
