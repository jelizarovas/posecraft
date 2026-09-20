import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage();await page.routeWebSocket(/.*/,socket=>socket.close());
 await page.goto('http://localhost:5246/play.html');
 const result=await page.evaluate(async()=>{
  const [{mapPropShadowGeometry,drawMapPropShadow},{woodlandArt},{loadMapArt}]=await Promise.all([import('/src/map-ground-shadow.js'),import('/examples/woodland-map.js'),import('/src/map-art.js')]);
  const prop={id:'tree',kind:'tree',art:'oak',x:5,y:5,width:1,height:1};
  const map={width:12,height:12,tileSize:{width:64,height:32},seed:1,props:[prop],actors:[],art:structuredClone(woodlandArt)};
  const art=loadMapArt(map,{document});await art.ready;
  const g=mapPropShadowGeometry(map,prop),canvas=document.createElement('canvas');canvas.width=600;canvas.height=300;
  const ctx=canvas.getContext('2d');ctx.translate(250,-50);drawMapPropShadow(ctx,map,prop,art);
  const pixels=ctx.getImageData(0,0,600,300).data;let opaque=0,maxX=0,maxY=0,outside=0;
  for(let y=0;y<300;y++)for(let x=0;x<600;x++)if(pixels[(y*600+x)*4+3]>5){opaque++;maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);if(x<g.bounds.x+250-1||x>g.bounds.x+g.bounds.width+251||y<g.bounds.y-51||y>g.bounds.y+g.bounds.height-49)outside++;}
  const low=mapPropShadowGeometry(map,{...prop,occlusion:{mode:'low-foliage'}});art.dispose();return{opaque,maxX,maxY,outside,base:{x:g.base.x+250,y:g.base.y-50},low};
 });
 assert.ok(result.opaque>1000,'Tree casts a substantial raster silhouette');assert.ok(result.maxX>result.base.x+30&&result.maxY>result.base.y+20,'Sun direction projects right and down');assert.equal(result.outside,0,'Chunk bounds contain all shadow pixels');assert.equal(result.low,null,'Crops do not acquire large object shadows');console.log(result);
}finally{await browser.close();}
