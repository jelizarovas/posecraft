import assert from 'node:assert/strict';
import {chromium} from '@playwright/test';
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage({viewport:{width:700,height:650}}),errors=[];
 await page.routeWebSocket(/.*/,socket=>socket.close());page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/tree-building-fixture',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>body{margin:0}#map{width:700px;height:650px}</style><div id="map"></div>'}));
 await page.goto('http://localhost:5246/tree-building-fixture');
 const result=await page.evaluate(async()=>{
  const {mountMap}=await import('/src/map-browser.js'),{createTownMap}=await import('/examples/town-map.js');
  const map=createTownMap();map.actors=[];
  const ids=['town-barn','oak-lawn-west','cottage-south'],props=ids.map(id=>map.props.find(p=>p.id===id));
  async function render(selected){
   window.view?.dispose();window.view=mountMap(document.querySelector('#map'),{...map,props:selected},{execution:'main',autoplay:false});view.zoomTo(3);view.panTo(54.5,65);
   await view.ready;await new Promise(resolve=>setTimeout(resolve,600));
   return document.querySelector('#map canvas').getContext('2d').getImageData(0,0,700,650).data;
  }
  const bg=await render([]),barn=await render([props[0]]),tree=await render([props[1]]),cottage=await render([props[2]]),all=await render(props);
  const delta=(a,b,i)=>Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);
  let treeOverBarn=0,cottageOverTree=0;
  for(let i=0;i<all.length;i+=4){
   if(delta(tree,bg,i)>90&&delta(barn,bg,i)>90&&delta(tree,barn,i)>90&&delta(cottage,bg,i)<5&&delta(all,tree,i)<5)treeOverBarn++;
   if(delta(tree,bg,i)>90&&delta(cottage,bg,i)>90&&delta(tree,cottage,i)>90&&delta(all,cottage,i)<5)cottageOverTree++;
  }
  const full=await render(map.props);let fullTreeOverBarn=0,fullCottageOverTree=0;
  for(let i=0;i<all.length;i+=4){
   if(delta(tree,bg,i)>90&&delta(barn,bg,i)>90&&delta(tree,barn,i)>90&&delta(cottage,bg,i)<5&&delta(full,tree,i)<5)fullTreeOverBarn++;
   if(delta(tree,bg,i)>90&&delta(cottage,bg,i)>90&&delta(tree,cottage,i)>90&&delta(full,cottage,i)<5)fullCottageOverTree++;
  }
  return{treeOverBarn,cottageOverTree,fullTreeOverBarn,fullCottageOverTree};
 });
 await page.screenshot({path:'test-results/tree-between-buildings.png'});
 for(const count of Object.values(result))assert.ok(count>100,JSON.stringify(result));assert.deepEqual(errors,[]);
 console.log(result);await page.evaluate(()=>view.dispose());
}finally{await browser.close();}
