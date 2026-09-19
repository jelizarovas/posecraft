import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMap,generateMap,groundHeight,projectMap,unprojectMap,MapIndex,MapPathJob} from '../src/map.js';
import {mapImageBounds} from '../src/map-art-layout.js';

function fixture(width=32,height=32){return {format:'posecraft-map',version:1,id:'hills',name:'Hills',width,height,seed:1,tileSize:{width:72,height:36},terrain:Array(width*height).fill(0),props:[],actors:[]};}
function field(map,fn){map.elevations=Array.from({length:(map.width+1)*(map.height+1)},(_,i)=>fn(i%(map.width+1),Math.floor(i/(map.width+1))));return assertMap(map);}

test('ground height follows the same continuous triangles as rendered terrain',()=>{
 const map=fixture(1,1);map.elevations=[0,.2,.3,.4];assertMap(map);
 assert.ok(Math.abs(groundHeight(map,{x:.75,y:.25})-.2)<1e-12);
 assert.ok(Math.abs(groundHeight(map,{x:.25,y:.75})-.25)<1e-12);
 assert.equal(groundHeight(map,{x:.5,y:.5}),.2);
 assert.ok(Math.abs(groundHeight(map,{x:.5+1e-8,y:.5})-groundHeight(map,{x:.5-1e-8,y:.5}))<1e-8);
 assert.equal(groundHeight(map,{x:1,y:1}),.4);
 assert.equal(groundHeight(map,{x:10,y:10}),.4);
 const p={x:.25,y:.75},projected=projectMap(map,p),flat=projectMap(map,{...p,z:0});
 assert.ok(Math.abs(flat.y-projected.y-.25*map.tileSize.height)<1e-10);
 const image={width:64,height:100,anchorX:.5,anchorY:1},bounds=mapImageBounds(map,p,image);
 assert.equal(bounds.y+bounds.height,projected.y,'sprite feet use the terrain height');
});

test('picking round trips across hills, dips, cell borders and extended map edges',()=>{
 const map=field(fixture(48,48),(x,y)=>1.8*Math.sin(x/9)*Math.cos(y/11));
 for(let y=-2;y<=50;y+=1.37)for(let x=-2;x<=50;x+=1.63){
  const p={x,y},picked=unprojectMap(map,projectMap(map,p));
  assert.ok(Math.abs(picked.x-x)<1e-8&&Math.abs(picked.y-y)<1e-8,JSON.stringify({p,picked}));
 }
 const flat=fixture();assert.deepEqual(unprojectMap(flat,projectMap(flat,{x:5.5,y:8.5})),{x:5.5,y:8.5});
});

test('elevation culling never omits projected terrain or a raised prop',()=>{
 const map=field(fixture(64,64),(x,y)=>7+1.4*Math.sin(x/8)*Math.cos(y/10));
 map.props=[{id:'tree',kind:'tree',x:30,y:30,width:1,height:1}];
 const center=projectMap(map,{x:30.5,y:30.5}),rect={x:center.x-80,y:center.y-60,width:160,height:120};
 const index=new MapIndex(map),view=index.visible(rect,0),ids=new Set(view.tiles.map(p=>`${p.x},${p.y}`));
 assert.ok(view.props.some(p=>p.id==='tree'));
 let intersections=0;
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
  const vertices=[{x,y},{x:x+1,y},{x:x+1,y:y+1},{x,y:y+1}].map(p=>projectMap(map,p));
  const left=Math.min(...vertices.map(p=>p.x)),right=Math.max(...vertices.map(p=>p.x)),top=Math.min(...vertices.map(p=>p.y)),bottom=Math.max(...vertices.map(p=>p.y));
  if(right>=rect.x&&left<=rect.x+rect.width&&bottom>=rect.y&&top<=rect.y+rect.height){intersections++;assert.ok(ids.has(`${x},${y}`));}
 }
 assert.ok(intersections>0);assert.ok(view.stats.candidateTiles<1000);
 assert.ok(index.minElevation>=5.5&&index.maxElevation<=8.5);
});

test('opt-in generated hills are deterministic and preserve level water, roads and building foundations',()=>{
 const map=generateMap({width:64,height:64,seed:2026,elevation:true});
 assert.deepEqual(map,generateMap({width:64,height:64,seed:2026,elevation:true}));
 assert.deepEqual(assertMap(JSON.parse(JSON.stringify(map))),map);
 assert.ok(map.elevations.some(h=>h<-.1));assert.ok(map.elevations.some(h=>h>.1));
 const stride=map.width+1;
 for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)if([1,2].includes(map.terrain[y*map.width+x]))for(const offset of [0,1,stride,stride+1])assert.equal(map.elevations[y*stride+x+offset],0);
 for(const p of map.props.filter(p=>p.kind==='house'||p.kind==='chest'))for(let y=p.y;y<=p.y+p.height;y++)for(let x=p.x;x<=p.x+p.width;x++)assert.equal(map.elevations[y*stride+x],0);
 assert.equal(generateMap({width:8,height:8}).elevations,undefined);
 const without=structuredClone(map);delete without.elevations;
 const start=map.actors[0],goal={x:start.x+4,y:start.y},a=new MapPathJob(map,new MapIndex(map),start,goal),b=new MapPathJob(without,new MapIndex(without),start,goal);
 while(a.result.status==='pending')a.step();while(b.result.status==='pending')b.step();
 assert.deepEqual(a.result.path,b.result.path,'navigation remains in ground XY');
});

test('malformed or folded elevation fields are rejected',()=>{
 for(const edit of [m=>m.elevations.pop(),m=>m.elevations[3]=NaN,m=>m.elevations[3]=17,m=>m.elevations[3]=-.401,m=>delete m.elevations[3]]){
  const map=field(fixture(8,8),()=>0);edit(map);assert.throws(()=>assertMap(map),/elevation/);
 }
 assert.throws(()=>generateMap({elevation:'yes'}),/Invalid map generation/);
});
