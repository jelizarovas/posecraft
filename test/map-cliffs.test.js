import test from 'node:test';
import assert from 'node:assert/strict';
import {MapIndex,MapPathJob,assertMap,cliffFaces,cliffGroundPick,groundHeight,projectMap,terrainHeightOffset,terrainTileCorners,unprojectMap} from '../src/map.js';
import {continuousSegmentClear} from '../src/map-collision.js';
import {MapController} from '../src/map-runtime.js';

const fixture=()=>({format:'posecraft-map',version:1,id:'cliffs',name:'Cliffs',width:12,height:12,seed:1,tileSize:{width:72,height:36},navigation:{mode:'continuous',radius:.12},terrain:Array(144).fill(0),terraces:[{id:'mesa',x:4,y:3,width:4,height:5,heightOffset:16}],props:[],actors:[]});
const finish=job=>{for(let i=0;i<1000&&job.result.status==='pending';i++)job.step(20);return job.result;};

test('terraces validate, overlap by maximum height, and expose bounded vertical faces',()=>{
 const map=fixture();map.terraces.push({id:'step',x:5,y:4,width:2,height:2,heightOffset:3});assert.equal(assertMap(map),map);
 assert.equal(terrainHeightOffset(map,{x:5.5,y:4.5}),16);assert.equal(groundHeight(map,{x:5.5,y:4.5}),16);
 assert.ok(terrainTileCorners(map,5,4).every(p=>p.z===16));
 const faces=cliffFaces(map);assert.equal(faces.length,18);assert.ok(faces.every(face=>face.top[0].z===16&&face.bottom[0].z===0));
 assert.equal(cliffFaces(map,{x:4,y:3,width:1,height:1}).length,2);
 for(const edit of [m=>m.terraces.push({...m.terraces[0],id:'mesa-2',heightOffset:17}),m=>m.terraces.push({...m.terraces[0]}),m=>m.terraces[0].x=-1]){const bad=fixture();edit(bad);assert.throws(()=>assertMap(bad),/terrace/);}
});

test('plateau projection round trips and elevated terrain remains visible to culling',()=>{
 const map=fixture(),point={x:5.25,y:5.5},pixel=projectMap(map,point),back=unprojectMap(map,pixel);
 assert.ok(Math.abs(back.x-point.x)<1e-8&&Math.abs(back.y-point.y)<1e-8);
 const index=new MapIndex(map),visible=index.visible({x:pixel.x-4,y:pixel.y-4,width:8,height:8},0);
 assert.ok(visible.tiles.some(tile=>tile.x===5&&tile.y===5));
});

test('a projected cliff wall picks the adjacent lower ground at its foot',()=>{
 const map=fixture(),face=cliffFaces(map).find(item=>item.edge==='east'),middle={x:(face.top[0].x+face.top[1].x)/2,y:(face.top[0].y+face.top[1].y)/2,z:(face.top[0].z+face.bottom[0].z)/2},pixel=projectMap(map,middle),pick=cliffGroundPick(map,pixel),inverse=unprojectMap(map,pixel);
 assert.ok(pick);assert.ok(pick.x>8+(map.navigation.radius??0));assert.equal(terrainHeightOffset(map,pick),0);
 assert.ok(Math.abs(inverse.x-pick.x)<1e-8&&Math.abs(inverse.y-pick.y)<1e-8,'visible wall inverse resolves to its reachable lower foot');
});

test('plateau tops are walkable but cliff edges block continuous and grid navigation',()=>{
 const map=fixture(),index=new MapIndex(map);
 assert.equal(continuousSegmentClear(index,{x:4.5,y:4.5},{x:7.5,y:6.5},.12),true);
 assert.equal(continuousSegmentClear(index,{x:3.5,y:4.5},{x:4.5,y:4.5},.12),false);
 assert.equal(index.isPointBlocked(4.05,4.5,.12),true,'radius cannot overhang a cliff edge');
 assert.equal(finish(new MapPathJob(map,index,{x:4.5,y:4.5},{x:7.5,y:6.5})).status,'complete');
 assert.equal(finish(new MapPathJob(map,index,{x:3.5,y:4.5},{x:4.5,y:4.5})).reason,'unreachable');
});

test('saved runtime state cannot restore onto different terrace heights',()=>{
 const first=fixture();first.actors=[{id:'hero',x:5.5,y:4.5,speed:3}];const source=new MapController(first,{execution:'main'}),state=source.snapshot();
 const changed=fixture();changed.terraces[0].heightOffset=15;changed.actors=[{id:'hero',x:5.5,y:4.5,speed:3}];const target=new MapController(changed,{execution:'main'});
 assert.throws(()=>target.restore(state),/Incompatible map save/);source.dispose();target.dispose();
});
