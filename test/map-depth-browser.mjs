import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {mapPropOccludesActor} from '../src/map-depth.js';

const house={id:'inn',kind:'house',x:4,y:4,width:3,height:2};
for(const [point,behind]of [[{x:5.5,y:6.5},false],[{x:7.5,y:4.5},false],[{x:5.5,y:3.5},true],[{x:3.5,y:5.5},true],[{x:7.5,y:3.5},false],[{x:3.5,y:6.5},false]])assert.equal(mapPropOccludesActor(house,point),behind);
const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5197').replace(/\/$/,''),browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:680,height:500}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/map-depth-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:680px;height:500px}</style><div id="map"></div>'}));await page.goto(base+'/map-depth-fixture');
  await page.evaluate(async()=>{window.mountMap=(await import('/src/map-browser.js')).mountMap;window.drawMapActor=(await import('/src/map-character.js')).drawMapActor;});
  const result=[];
  for(const [name,x,y]of [['front-door',5.5,6.5],['front-side',7.5,4.5],['behind-north',5.5,3.5],['behind-west',3.5,5.5]]){
    const pixels=await page.evaluate(async({x,y,house})=>{
      window.view?.dispose();const actor={id:'hero',x,y,speed:3,color:'#e65bb1'},map={format:'posecraft-map',version:1,id:'depth',name:'Depth',seed:1,width:12,height:12,tileSize:{width:96,height:48},terrain:Array(144).fill(0),props:[house],actors:[actor]};window.view=mountMap(document.querySelector('#map'),map,{execution:'main',reducedMotion:true});view.panTo(5.5,4.5);view.zoomTo(1.8);await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      const actual=document.querySelector('#map canvas'),reference=document.createElement('canvas');reference.width=actual.width;reference.height=actual.height;const context=reference.getContext('2d'),center=view.mapToScreen({x:0,y:0});context.setTransform(1.8,0,0,1.8,center.x,center.y);drawMapActor(context,map,view.controller.actorPosition('hero'),actor,true,{shadow:false});
      const source=reference.getContext('2d').getImageData(0,0,reference.width,reference.height).data,rendered=actual.getContext('2d').getImageData(0,0,actual.width,actual.height).data;let opaque=0,matches=0,changed=0;for(let i=0;i<source.length;i+=4)if(source[i+3]===255){opaque++;if(Math.abs(source[i]-rendered[i])+Math.abs(source[i+1]-rendered[i+1])+Math.abs(source[i+2]-rendered[i+2])<8)matches++;else changed++;}return{opaque,matches,changed,stats:view.stats()};
    },{x,y,house});result.push({name,...pixels});await page.screenshot({path:`test-results/map-depth-${name}.png`});
  }
  for(const sample of result.slice(0,2))assert.ok(sample.matches/sample.opaque>.97,`${sample.name} must remain normally colored in front of the wall: ${JSON.stringify(sample)}`);
  for(const sample of result.slice(2)){assert.ok(sample.changed>80,`${sample.name} must show the masked silhouette`);assert.ok(sample.stats.scratchPixels<sample.stats.backingWidth*sample.stats.backingHeight*3,'Scratch canvases must stay within viewport dimensions');}
  assert.ok(result[3].matches>500,'Partially hidden actor must retain normal colors outside the prop artwork, rather than tinting the whole character');
  assert.deepEqual(errors,[]);console.log(JSON.stringify(result.map(({name,opaque,matches,changed})=>({name,opaque,matches,changed}))));await page.evaluate(()=>view.dispose());
}finally{await browser.close();}
