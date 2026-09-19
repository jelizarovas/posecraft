import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
import {MapController} from '../src/map-runtime.js';
import {woodlandArt} from '../examples/woodland-map.js';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
  const page=await browser.newPage({viewport:{width:1000,height:800},hasTouch:true}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/demos.html#littlelands-map');
  await page.waitForFunction(()=>window.mapDemo?.view.stats().visibleTiles>0);
  for(const raster of [false,true]){
    const map={format:'posecraft-map',version:1,id:'picking',name:'Picking regression',seed:1,width:16,height:16,tileSize:{width:64,height:32},terrain:Array(256).fill(0),
      art:raster?{images:{oak:woodlandArt.images.oak},props:{tree:['oak']}}:{images:{}},
      props:[{id:'tree',kind:'tree',x:8,y:8,width:1,height:1},{id:'chest',kind:'chest',x:5,y:8,width:1,height:1}],
      actors:[{id:'hero',x:6.5,y:7.5,speed:8}]};
    const controller=new MapController(map,{execution:'main'});
    const scene=controller.snapshot();controller.dispose();
    const saved={version:1,map,state:{format:'posecraft-map-view-state',version:1,camera:{x:0,y:240,zoom:1},scene}};
    await page.evaluate(saved=>localStorage.setItem('posecraft.littlelands.map.v1',JSON.stringify(saved)),saved);
    await page.locator('#map-restore').click();
    await page.waitForFunction(()=>document.querySelector('#demo-status').textContent==='Map restored.');
    await page.evaluate(()=>mapDemo.view.ready);
    await page.waitForFunction(()=>mapDemo.view.stats().terrainCache?.pending===false);
    // This ground tile is behind the opaque lower canopy, outside the trunk cell.
    const target={x:7.5,y:7.5};
    if(raster){
      const alpha=await page.evaluate(async()=>{
        const spec=mapDemo.map.art.images.oak,image=new Image();image.src=spec.src;await image.decode();
        const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');
        const x=spec.anchorX*image.naturalWidth,y=(spec.anchorY-32/spec.height)*image.naturalHeight;
        ctx.drawImage(image,Math.floor(x),Math.floor(y),1,1,0,0,1,1);return ctx.getImageData(0,0,1,1).data[3];
      });
      assert.ok(alpha>200,'Fixture must click opaque tree artwork');
    }
    const before=await page.evaluate(()=>mapDemo.events.length);
    let position=await page.evaluate(target=>mapDemo.view.mapToScreen(target),target);
    await page.locator('#demo-art canvas').tap({position});
    const command=await page.evaluate(before=>mapDemo.events.slice(before).find(e=>e.type==='map.move.started'),before);
    assert.deepEqual(command?.target,target,`Canopy must pass through to ground (${raster?'raster':'procedural'})`);
    await page.waitForFunction(target=>{const a=mapDemo.view.controller.actorPosition('hero');return !a.walking&&a.x===target.x&&a.y===target.y;},target);
    // Clicking the occupied ground cell must not turn the tree into an interaction.
    const commands=await page.evaluate(()=>mapDemo.events.filter(e=>e.type==='map.move.started').length);
    position=await page.evaluate(()=>mapDemo.view.mapToScreen({x:8.5,y:8.5}));
    await page.locator('#demo-art canvas').tap({position});
    assert.equal(await page.evaluate(()=>mapDemo.events.filter(e=>e.type==='map.move.started').length),commands);
    assert.equal(await page.evaluate(()=>mapDemo.view.controller.index.isBlocked(8,8)),true);
    // An interactive object still captures a click on its visible lid.
    position=await page.evaluate(()=>{const p=mapDemo.view.mapToScreen({x:5.5,y:8.5});return{x:p.x,y:p.y-15};});
    await page.locator('#demo-art canvas').tap({position});
    await page.waitForFunction(()=>mapDemo.view.controller.frame().objects.chest?.opened);
  }
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:true,proceduralCanopy:true,rasterCanopy:true,groundReached:true,trunkBlocked:true,chestInteraction:true}));
}finally{await browser.close();}
