// The batched chunk painter (`drawChunks`) reimplements material blending in
// software for speed. This keeps it in agreement with the canonical per-tile
// material path (`drawReady`) on real woodland art, transitions and slopes.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';

const base=(process.env.POSECRAFT_URL||'http://127.0.0.1:5246').replace(/\/$/,'');
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
await mkdir('test-results',{recursive:true});
try{
  const page=await browser.newPage({viewport:{width:800,height:600}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/@vite/client',route=>route.fulfill({contentType:'application/javascript',body:''}));
  await page.route('**/map-terrain-parity-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><base href="/demos.html"><body></body>'}));
  await page.goto(base+'/map-terrain-parity-fixture');
  const results=await page.evaluate(async()=>{
    const {createWoodlandMap,withWoodlandArt}=await import('/examples/woodland-map.js');
    const {createMapTerrainPainter}=await import('/src/map-terrain.js');
    const {loadMapArt}=await import('/src/map-art.js');
    const map=withWoodlandArt(createWoodlandMap({width:128,height:128,seed:2026}));
    const art=loadMapArt(map,{document});await art.ready;
    // Windows with the most transitions overall and around a road.
    const size=12,windows=[];
    for(const needsRoad of [false,true]){
      let best=null;
      for(let wy=0;wy+size<=map.height;wy+=4)for(let wx=0;wx+size<=map.width;wx+=4){
        let edges=0,road=false;
        for(let y=wy;y<wy+size;y++)for(let x=wx;x<wx+size;x++){const v=map.terrain[y*map.width+x];if(v===1)road=true;if(x<wx+size-1&&v!==map.terrain[y*map.width+x+1])edges+=needsRoad&&v!==1&&map.terrain[y*map.width+x+1]!==1?0:1;}
        if((!needsRoad||road)&&(!best||edges>best.edges))best={wx,wy,edges,road:needsRoad};
      }
      windows.push(best);
    }
    const out=[];
    for(const best of windows){
    const tiles=[];
    for(let y=best.wy;y<best.wy+size;y++)for(let x=best.wx;x<best.wx+size;x++)tiles.push({x,y,terrain:map.terrain[y*map.width+x]});
    tiles.sort((a,b)=>a.x+a.y-b.x-b.y||a.x-b.x);
    const kinds=new Set(tiles.map(t=>t.terrain)).size;
    const tw=map.tileSize.width,th=map.tileSize.height;
    const xs=tiles.map(t=>(t.x-t.y)*tw/2),ys=tiles.map(t=>(t.x+t.y)*th/2);
    const left=Math.min(...xs)-tw,top=Math.min(...ys)-th*6,width=Math.max(...xs)+tw-left,height=Math.max(...ys)+th*3-top;
    for(const scale of [1,2]){
      const surface=()=>{const canvas=document.createElement('canvas');canvas.width=Math.ceil(width*scale);canvas.height=Math.ceil(height*scale);return canvas;};
      const reference=surface(),batched=surface();
      const painter=createMapTerrainPainter(map,document,art);
      // Canonical path: one material per tile, drawn directly.
      const rctx=reference.getContext('2d');
      for(let pass=0,index=0;index<tiles.length;pass++){
        if(pass>500)throw Error('Reference terrain never settled');
        painter.beginFrame(scale,reference.width*reference.height);
        rctx.setTransform(scale,0,0,scale,-left*scale,-top*scale);
        while(index<tiles.length){const result=painter.drawReady(rctx,tiles[index],{direct:true});if(result===null)break;index++;}
        if(index<tiles.length)await new Promise(requestAnimationFrame);
      }
      // Batched path, as terrain chunks use it.
      const bctx=batched.getContext('2d'),entry={tiles,cursor:0,scale,left,top,ctx:bctx};
      bctx.setTransform(scale,0,0,scale,-left*scale,-top*scale);
      for(let pass=0;entry.cursor<tiles.length;pass++){
        if(pass>500)throw Error('Batched terrain never settled');
        painter.beginFrame(scale,batched.width*batched.height);
        painter.drawChunks([entry],1e9,performance.now(),null,null);
      }
      const a=rctx.getImageData(0,0,reference.width,reference.height).data,b=bctx.getImageData(0,0,batched.width,batched.height).data;
      let compared=0,sum=0,large=0;
      for(let i=0;i<a.length;i+=4){
        // Compare where both paths painted opaque ground; tile silhouettes match.
        if(a[i+3]<250||b[i+3]<250)continue;
        const d=(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]))/3;
        compared++;sum+=d;if(d>32)large++;
      }
      // Texture resampling differs per pixel; blend masks and shading must agree
      // in 8x8 block averages.
      const W=reference.width,B=8;let blocks=0,blockSum=0,blockMax=0;
      for(let by=0;by+B<=reference.height;by+=B)for(let bx=0;bx+B<=W;bx+=B){
        const ma=[0,0,0],mb=[0,0,0];let opaque=true;
        for(let y=by;y<by+B&&opaque;y++)for(let x=bx;x<bx+B;x++){const i=(y*W+x)*4;if(a[i+3]<250||b[i+3]<250){opaque=false;break;}for(let c=0;c<3;c++){ma[c]+=a[i+c];mb[c]+=b[i+c];}}
        if(!opaque)continue;
        const d=(Math.abs(ma[0]-mb[0])+Math.abs(ma[1]-mb[1])+Math.abs(ma[2]-mb[2]))/(3*B*B);
        blocks++;blockSum+=d;blockMax=Math.max(blockMax,d);
      }
      const sheet=document.createElement('canvas');sheet.width=reference.width*2+8;sheet.height=reference.height;
      const sctx=sheet.getContext('2d');sctx.drawImage(reference,0,0);sctx.drawImage(batched,reference.width+8,0);
      out.push({scale,window:best,kinds,compared,mean:sum/Math.max(1,compared),largePercent:100*large/Math.max(1,compared),blocks,blockMean:blockSum/Math.max(1,blocks),blockMax,png:sheet.toDataURL('image/png').split(',')[1]});
      painter.dispose?.();
    }
    }
    art.dispose();
    return out;
  });
  for(const result of results){
    await writeFile(`test-results/map-terrain-parity-${result.window.road?'road':'shore'}-${result.scale}x.png`,Buffer.from(result.png,'base64'));
    console.log(JSON.stringify({scale:result.scale,window:result.window,kinds:result.kinds,compared:result.compared,mean:+result.mean.toFixed(2),largePercent:+result.largePercent.toFixed(2),blockMean:+result.blockMean.toFixed(2),blockMax:+result.blockMax.toFixed(2)}));
    assert.ok(result.kinds>=2,'Parity window should contain a terrain transition');
    assert.ok(result.compared>10000,'Parity comparison should cover the painted window');
    assert.ok(result.mean<=10,`Batched terrain drifted from the material path at ${result.scale}x (mean ${result.mean.toFixed(2)})`);
    assert.ok(result.blockMean<=2&&result.blockMax<=16,`Batched terrain blending drifted at ${result.scale}x (8x8 block mean ${result.blockMean.toFixed(2)}, max ${result.blockMax.toFixed(2)})`);
    assert.ok(result.largePercent<=2,`Batched terrain differs strongly on ${result.largePercent.toFixed(2)}% of pixels at ${result.scale}x`);
  }
  assert.deepEqual(errors,[]);
}finally{
  await browser.close();
}
