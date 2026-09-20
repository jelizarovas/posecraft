import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:640,height:480}}),errors=[];
 await page.routeWebSocket(/.*/,s=>s.close());page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/crop-height-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:640px;height:480px}</style><div id="map"></div>'}));
 await page.goto('http://localhost:5246/crop-height-fixture');
 const results=[];
 for(const kind of ['farm-vegetables','farm-pumpkin','wheat','farm-corn']){
  const result=await page.evaluate(async kind=>{
   const {createTownMap}=await import('/examples/town-map.js'),{mountMap}=await import('/src/map-browser.js'),{loadMapArt}=await import('/src/map-art.js');
   const map=createTownMap(),source=map.props.find(p=>p.art===kind),actor={...map.actors[0],x:5.5,y:5.5};
   Object.assign(map,{width:12,height:12,terrain:Array(144).fill(0),actors:[actor]});delete map.elevations;delete map.groundPaint;
   const props=[];for(let y=4;y<=6;y++)for(let x=4;x<=6;x++)props.push({...source,id:`crop-${x}-${y}`,x,y});
   async function render(cover,actors=map.actors){
    window.view?.dispose();window.view=mountMap(document.querySelector('#map'),{...map,actors,props:props.map(p=>({...p,occlusion:cover?p.occlusion:{mode:'ground'}}))},{execution:'main',autoplay:false,reducedMotion:true});
    view.zoomTo(4);view.panTo(5.5,5);await view.ready;await new Promise(r=>setTimeout(r,600));
    return document.querySelector('#map canvas').getContext('2d').getImageData(0,0,640,480).data;
   }
   const baseline=await render(false),cropOnly=await render(true,[]),covered=await render(true),foot=view.mapToScreen(actor);
   const art=loadMapArt({...map,props},{document});await art.ready;
   const visibleHeight=art.standingHeight('hero'),height=visibleHeight*map.tileSize.width/64*4;art.dispose();
   const cut=foot.y-height*source.occlusion.lowerBodyFraction;let changed=0,aboveCut=0,revealed=0;const edge=new Map();
   for(let y=Math.floor(foot.y-height);y<foot.y;y++)for(let x=Math.floor(foot.x-22);x<foot.x+22;x++){
    const i=(y*640+x)*4,delta=Math.abs(baseline[i]-covered[i])+Math.abs(baseline[i+1]-covered[i+1])+Math.abs(baseline[i+2]-covered[i+2]);
    if(delta>35){changed++;if(y<Math.floor(cut)-1)aboveCut++;
     if(Math.abs(x-foot.x)<7&&!edge.has(x))edge.set(x,y);
     const tint=[231,244,197],revealDelta=tint.reduce((sum,c,k)=>sum+Math.abs(covered[i+k]-(c*.66+cropOnly[i+k]*.34)),0);
     if(revealDelta<8)revealed++;
    }
   }
   return{kind,changed,aboveCut,revealed,edgeRows:new Set(edge.values()).size,fraction:source.occlusion.lowerBodyFraction,visibleHeight};
  },kind);
  results.push(result);await page.screenshot({path:`test-results/crop-height-${kind}.png`});
  assert.equal(result.aboveCut,0,JSON.stringify(result));assert.ok(result.changed>20,JSON.stringify(result));assert.ok(result.visibleHeight>35&&result.visibleHeight<55,'Measured height excludes sprite padding');
  if(result.fraction>=.3){assert.ok(result.revealed>50,JSON.stringify(result));assert.ok(result.edgeRows>=3,'Tall crops have an irregular cover boundary');}
  else assert.equal(result.revealed,0,'Low crops do not turn ankles into a bright silhouette');
 }
 assert.deepEqual(errors,[]);console.log(results);await page.evaluate(()=>view.dispose());
}finally{await browser.close();}
