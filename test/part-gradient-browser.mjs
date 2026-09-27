import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {chromium} from '@playwright/test';
import {createServer} from 'vite';

await fs.mkdir('test-results',{recursive:true});
await fs.writeFile('test-results/part-gradient-fixture.html','<!doctype html><html><body></body></html>');
const server=await createServer({configFile:false,root:process.cwd(),server:{host:'127.0.0.1',port:5192,strictPort:true,hmr:false},appType:'mpa'});
await server.listen();
const browser=await chromium.launch({headless:true,...(process.platform==='win32'?{channel:'msedge'}:{})});
try{
 const page=await browser.newPage();
 await page.goto('http://127.0.0.1:5192/test-results/part-gradient-fixture.html');
 const pixels=await page.evaluate(async()=>{
  const [{SceneController},{evaluateDrawing},{renderCanvas},{renderSVG}]=await Promise.all([
   import('/src/scene.js'),import('/src/render-evaluation.js'),import('/src/canvas.js'),import('/src/svg.js'),
  ]);
  const scene={schemaVersion:1,kind:'scene',id:'gradient-pixels',name:'Gradient pixels',revision:0,
   bounds:{width:100,height:100},requiredFeatures:['rigs','paths','instances','timelines','input-states','part-gradients'],
   packs:{shape:{name:'Shape',joints:[{id:'root',parent:null,x:0,y:0,length:0,rotation:0,min:0,max:0}],
    parts:[{id:'shade',joint:'root',d:'M0 0H100V100H0Z',fill:'#000000',gradient:{type:'linear',x1:0,y1:0,x2:1,y2:0,stops:[[0,'#ff0000'],[1,'#0000ff']]}}],
    clips:{idle:{duration:1,loop:true,tracks:{}}},inputs:{},states:{idle:{clip:'idle'}},initial:'idle'}},
   actors:[{id:'shape',name:'Shape',pack:'shape',transform:{x:0,y:0,scale:1,rotation:0}}]};
  const controller=new SceneController(scene),frame=controller.frame(),drawing=evaluateDrawing(scene,frame),canvas=document.createElement('canvas');
  canvas.width=canvas.height=100;renderCanvas(canvas.getContext('2d'),drawing);
  const image=new Image(),url=URL.createObjectURL(new Blob([renderSVG(scene,frame)],{type:'image/svg+xml'}));
  image.src=url;await image.decode();const reference=document.createElement('canvas');reference.width=reference.height=100;
  reference.getContext('2d').drawImage(image,0,0);URL.revokeObjectURL(url);controller.dispose();
  const pixel=(target,x)=>[...target.getContext('2d').getImageData(x,50,1,1).data];
  return {canvas:[pixel(canvas,20),pixel(canvas,80)],svg:[pixel(reference,20),pixel(reference,80)]};
 });
 assert.ok(pixels.canvas[0][0]>pixels.canvas[0][2],JSON.stringify(pixels));
 assert.ok(pixels.canvas[1][2]>pixels.canvas[1][0],JSON.stringify(pixels));
 for(let i=0;i<2;i++)for(let channel=0;channel<4;channel++)assert.ok(Math.abs(pixels.canvas[i][channel]-pixels.svg[i][channel])<4,JSON.stringify(pixels));
 console.log('Authored linear gradient paints equivalent SVG and Canvas pixels.');
}finally{await browser.close();await server.close();}
