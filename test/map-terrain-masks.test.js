import assert from 'node:assert/strict';
import test from 'node:test';
import {createMapTerrainMasks} from '../src/map-terrain-masks.js';

function fixture(){const canvases=[];return{canvases,createElement(){const canvas={width:0,height:0,getContext(){return{createImageData(w,h){return{data:new Uint8ClampedArray(w*h*4)};},putImageData(image){canvas.data=image.data;}};}};canvases.push(canvas);return canvas;}};}
function reference(size,bits){const out=new Uint8ClampedArray(size*size*4),smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};for(let y=0;y<size;y++)for(let x=0;x<size;x++){const gx=(x+.5)/size-.5,gy=(y+.5)/size-.5,ix=Math.floor(gx),iy=Math.floor(gy),sx=smooth((gx-ix-.30)/.40),sy=smooth((gy-iy-.30)/.40);const at=(dx,dy)=>(bits>>((iy+dy+1)*3+ix+dx+1))&1;const a=(at(0,0)*(1-sx)+at(1,0)*sx)*(1-sy)+(at(0,1)*(1-sx)+at(1,1)*sx)*sy;out[(y*size+x)*4+3]=Math.round(a*255);}return out;}

test('cached transition alpha matches existing terrain for every neighbor pattern at both resolutions',()=>{
  const doc=fixture(),cache=createMapTerrainMasks(doc);
  for(const size of [48,96])for(let bits=0;bits<512;bits++)assert.deepEqual(cache.get(size,bits).data,reference(size,bits));
  assert.equal(cache.stats().masks,32);cache.clear();assert.ok(doc.canvases.every(c=>c.width===1&&c.height===1));
});

test('terrain masks reuse independent of texture phase and release least-recently used surfaces',()=>{
  const doc=fixture(),cache=createMapTerrainMasks(doc,2),first=cache.get(48,42),second=cache.get(48,43);
  assert.equal(cache.get(48,42),first);assert.equal(cache.stats().maskBuilds,2);
  cache.get(96,42);assert.equal(second.width,1);assert.equal(first.width,48);cache.clear();assert.equal(first.width,1);
});
