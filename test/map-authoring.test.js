import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMap,MapIndex} from '../src/map.js';
import {artPropSelection,artTerrainSelection} from '../src/map-art-layout.js';
import {continuousSegmentClear,propCollisionParts,propHitsSegment} from '../src/map-collision.js';
import {MapNavigationJob} from '../src/map-navigation.js';
import {shapeRidgeTerrain,upgradeStockBranches} from '../examples/map-editor-catalog.js';

const image=src=>({src,width:64,height:64,anchorX:.5,anchorY:1});
test('crop cover survives authoring round trips and rejects invalid coverage',()=>{
 const map=fixture(),prop=map.props[1];
 prop.occlusion={mode:'low-foliage',lowerBodyFraction:.5};
 assert.deepEqual(assertMap(JSON.parse(JSON.stringify(map))).props[1].occlusion,prop.occlusion);
 for(const occlusion of [{mode:'unknown'},{mode:'low-foliage',lowerBodyFraction:0},{mode:'low-foliage',lowerBodyFraction:1.1},{mode:'ground',lowerBodyFraction:.5}]){
  prop.occlusion=occlusion;assert.throws(()=>assertMap(map),/occlusion/);
 }
 prop.occlusion={mode:'ground'};assertMap(map);
});
test('stock branch migration preserves a saved actor standing on formerly walkable art',()=>{
 const map=fixture();map.art.images['editor-branches']=image('./assets/map/editor/branches.webp');
 map.props.push({id:'old-branch',kind:'decoration',art:'editor-branches',x:5,y:2,width:1,height:1,collision:{shape:'none'}});
 Object.assign(map.actors[0],{x:5.5,y:2.5});
 const upgraded=upgradeStockBranches(map);assert.equal(upgraded.props.at(-1).collision.shape,'none');assertMap(upgraded);
});
function fixture(){
  const width=12,height=12;
  return{
    format:'posecraft-map',version:1,id:'authoring',name:'Authoring fixture',width,height,seed:9,
    tileSize:{width:64,height:32},navigation:{mode:'continuous',radius:.12},
    terrain:Array(width*height).fill(0),groundPaint:{'13':'grass-dry','14':'grass-dry'},
    props:[
      {id:'wreck',kind:'decoration',art:'shipwreck',x:4,y:4,width:4,height:3,collision:{shape:'compound',parts:[
        {shape:'rect',x:0,y:0,width:1,height:3},
        {shape:'rect',x:3,y:0,width:1,height:3},
      ]}},
      {id:'bush',kind:'decoration',art:'bush',x:2,y:7,width:1,height:1},
      {id:'grave',kind:'decoration',art:'tombstone',x:9,y:7,width:1,height:1,collision:{shape:'circle',x:.5,y:.65,radius:.25}},
    ],
    actors:[{id:'hero',x:6,y:2.5,speed:3}],
    art:{images:{
      grass:image('./grass.png'),'grass-dry':image('./grass-dry.png'),shipwreck:image('./shipwreck.png'),bush:image('./bush.png'),tombstone:image('./tombstone.png'),
    },terrain:{grass:'grass'}},
  };
}

test('sparse ground paint and per-prop art survive validated JSON round trips',()=>{
  const map=fixture(),reopened=assertMap(JSON.parse(JSON.stringify(map)));
  assert.deepEqual(reopened.groundPaint,map.groundPaint);
  assert.equal(artTerrainSelection(reopened,0,13).id,'grass-dry');
  assert.equal(artTerrainSelection(reopened,0,15).id,'grass');
  assert.equal(artPropSelection(reopened,reopened.props[0]).id,'shipwreck');
});

test('compound collision leaves an exact and coarse walkable gap through large art',()=>{
  const map=fixture(),index=new MapIndex(map),wreck=index.prop('wreck');
  assert.equal(index.isBlocked(4.5,5.5),true);
  assert.equal(index.isBlocked(5.5,5.5),false);
  assert.equal(index.isBlocked(6.5,5.5),false);
  assert.equal(index.isBlocked(7.5,5.5),true);
  assert.equal(index.isPointBlocked(6,5.5,.2),false);
  assert.equal(continuousSegmentClear(index,{x:6,y:3.5},{x:6,y:7.5},.2),true);
  assert.equal(continuousSegmentClear(index,{x:4.5,y:3.5},{x:4.5,y:7.5},.12),false);
  assert.equal(propHitsSegment(wreck,{x:5.2,y:5.5},{x:6.8,y:5.5},.19),false);
  assert.deepEqual(propCollisionParts(wreck).map(({shape,x,y,width,height})=>({shape,x,y,width,height})),[
    {shape:'rect',x:4,y:4,width:1,height:3},{shape:'rect',x:7,y:4,width:1,height:3},
  ]);
});

test('decoration is walk-through by default but accepts explicit collision',()=>{
  const map=fixture(),index=new MapIndex(map);
  assert.equal(index.isBlocked(2.5,7.5),false);
  assert.equal(index.isPointBlocked(2.5,7.5),false);
  assert.equal(index.isPointBlocked(9.5,7.65,.12),true);
  const job=new MapNavigationJob(map,index,{x:6,y:2.5},{x:6,y:8.5});
  while(job.result.status==='pending')job.step(64);
  assert.equal(job.result.status,'complete');
  assert.ok(job.result.path.slice(1).every((point,i)=>continuousSegmentClear(index,job.result.path[i],point,map.navigation.radius)));
});

test('authoring validation rejects bad paint and local shapes before indexing',()=>{
  const edits=[
    map=>{map.groundPaint['01']='grass-dry';},
    map=>{map.groundPaint['12']='missing';},
    map=>{map.groundPaint['144']='grass-dry';},
    map=>{map.props[0].collision.parts[0].width=4.1;},
    map=>{map.props[0].collision.parts[0]={shape:'circle',radius:.2};},
    map=>{map.props[1].art='missing';},
  ];
  for(const edit of edits){const map=fixture();edit(map);assert.throws(()=>assertMap(map),/Invalid map/);}
});

test('stock branch migration adds a hand vault without touching custom branch art',()=>{
 const map=fixture();map.art.images['editor-branches']={src:'./assets/map/editor/branches.webp',width:74,height:49.333,anchorX:.5,anchorY:.6};
 map.props.push({id:'stock-branch',kind:'decoration',art:'editor-branches',x:1,y:1,width:1,height:1,collision:{shape:'none'}});
 map.props.push({id:'custom-branch',kind:'decoration',art:'editor-branches',x:3,y:1,width:1,height:1,collision:{shape:'rect',x:0,y:0,width:1,height:1}});
 const upgraded=upgradeStockBranches(map);
 assert.equal(upgraded.props.find(prop=>prop.id==='stock-branch').traversal.kind,'vault');
 assert.equal(upgraded.props.find(prop=>prop.id==='stock-branch').collision.shape,'rect');
 assert.equal(upgraded.props.find(prop=>prop.id==='custom-branch').traversal,undefined);
});

test('ridge terrain rises toward its smaller-Y side and keeps the elevation slope bound',()=>{
 const map=fixture(12,12);map.actors=[{id:'hero',x:1,y:1,speed:3}];map.elevations=Array((map.width+1)*(map.height+1)).fill(0);
 const ridge={id:'ridge',kind:'decoration',x:5,y:5,width:3,height:3};
 assert.equal(shapeRidgeTerrain(map,ridge),true);
 const stride=map.width+1;
 assert.equal(map.elevations[5*stride+6],.4);assert.equal(map.elevations[6*stride+6],.2);assert.equal(map.elevations[7*stride+6],0);
 for(let y=0;y<=map.height;y++)for(let x=0;x<=map.width;x++){
  if(x)assert.ok(Math.abs(map.elevations[y*stride+x]-map.elevations[y*stride+x-1])<=.4);
  if(y)assert.ok(Math.abs(map.elevations[y*stride+x]-map.elevations[(y-1)*stride+x])<=.4);
 }
});
