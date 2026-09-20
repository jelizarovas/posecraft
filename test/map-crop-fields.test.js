import test from 'node:test';
import assert from 'node:assert/strict';
import {createTownMap} from '../examples/town-map.js';
import {farmPropBrushes} from '../examples/farm-assets.js';

test('crop plots fill contiguous field footprints and use height-specific cover',()=>{
 const map=createTownMap();
 for(const [art,fraction]of [['farm-vegetables',.1],['farm-pumpkin',.12],['farm-corn',2/3]]){
  const props=map.props.filter(p=>p.art===art);assert.equal(props.length,60);
  const cells=new Set(props.map(p=>`${p.x}:${p.y}`)),x=Math.min(...props.map(p=>p.x)),y=Math.min(...props.map(p=>p.y));
  for(let row=0;row<6;row++)for(let col=0;col<10;col++)assert.ok(cells.has(`${x+col}:${y+row}`));
  for(const p of props){assert.equal(p.collision.shape,'none');assert.equal(p.occlusion.lowerBodyFraction,fraction);}
  assert.equal(farmPropBrushes.find(b=>b.id===art).prop.occlusion.lowerBodyFraction,fraction);
 }
 assert.ok(map.props.filter(p=>p.art==='wheat').every(p=>p.occlusion.lowerBodyFraction===.5));
 const wheat=map.props.filter(p=>p.art==='wheat');assert.equal(wheat.length,11*13);
 assert.equal(new Set(wheat.map(p=>p.y)).size,13,'Wheat fills adjacent rows');
 const fences=map.props.filter(p=>['showcase-fence','corn-fence-east','corn-fence-side'].includes(p.id));assert.equal(fences.length,3);
 const corn=map.props.filter(p=>p.art==='farm-corn');
 for(const f of fences)assert.ok(f.fence);
 const original=fences.find(p=>p.id==='showcase-fence');
 assert.equal(original.x,30);assert.equal(original.y,74);assert.ok(Math.abs(original.fence.nodes[0].y-.42)<1e-8);
 assert.ok(corn.some(p=>original.x<p.x+p.width&&original.x+original.width>p.x&&original.y<p.y+p.height&&original.y+original.height>p.y),'Fences are allowed to overlap planted edge cells');
});
