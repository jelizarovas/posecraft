import test from 'node:test';
import assert from 'node:assert/strict';
import {MapOcclusionIndex,createCliffTopProps,mapActorArtBounds,mapPropOccludesActor} from '../src/map-depth.js';

test('long props do not hide actors beyond either camera-facing ground edge',()=>{
 const boat={id:'wreck',kind:'decoration',x:4,y:4,width:6,height:2,collision:{shape:'rect',x:0,y:0,width:6,height:2}};
 // This point sorts behind the center despite being in front of the near side.
 assert.equal(mapPropOccludesActor(boat,{x:4.5,y:6.2}),false);
 assert.equal(mapPropOccludesActor(boat,{x:10.2,y:4.3}),false);
 assert.equal(mapPropOccludesActor(boat,{x:6,y:3.5}),true);
 assert.equal(mapPropOccludesActor(boat,{x:4.5,y:6}),false);
});

test('split wreck uses the real pieces rather than the enclosing rectangle',()=>{
 const boat={id:'wreck',kind:'decoration',x:4,y:4,width:6,height:2,collision:{shape:'compound',parts:[
  {shape:'rect',x:.15,y:.12,width:2.1,height:1.76},
  {shape:'rect',x:3.65,y:.12,width:2.2,height:1.76}
 ]}};
 assert.equal(mapPropOccludesActor(boat,{x:4.5,y:6.1}),false);
 assert.equal(mapPropOccludesActor(boat,{x:6.7,y:5.5}),false,'a far piece cannot occlude across the near end of the gap');
 assert.equal(mapPropOccludesActor(boat,{x:8,y:3.8}),true);
 assert.equal(mapPropOccludesActor(boat,{x:8,y:3.8,lift:1,vaultId:'wreck'}),false);
});

test('houses retain rear silhouettes and tree canopies retain center depth',()=>{
 const house={id:'inn',kind:'house',x:4,y:4,width:3,height:2};
 for(const [point,hidden]of [[{x:5.5,y:6.5},false],[{x:7.5,y:4.5},false],[{x:5.5,y:3.5},true],[{x:3.5,y:5.5},true],[{x:3.5,y:6.5},false]])assert.equal(mapPropOccludesActor(house,point),hidden);
 const tree={id:'tree',kind:'tree',x:4,y:4,width:1,height:1,collision:{shape:'circle',radius:.24}};
 assert.equal(mapPropOccludesActor(tree,{x:4,y:4}),true);
 assert.equal(mapPropOccludesActor(tree,{x:5,y:5}),false);
});

test('low foliage covers a walker inside its planted footprint regardless of center depth',()=>{
 const wheat={id:'wheat',kind:'decoration',x:4,y:4,width:2,height:2,occlusion:{mode:'low-foliage'}};
 assert.equal(mapPropOccludesActor(wheat,{x:4.1,y:4.1}),true);
 assert.equal(mapPropOccludesActor(wheat,{x:5.9,y:5.9}),true);
 assert.equal(mapPropOccludesActor(wheat,{x:3.99,y:5}),false);
 assert.equal(mapPropOccludesActor(wheat,{x:5,y:6.01}),false);
});

test('ground props always stay below walkers',()=>{
 const soil={id:'soil',kind:'decoration',x:4,y:4,width:1,height:1,occlusion:{mode:'ground'}};
 assert.equal(mapPropOccludesActor(soil,{x:4.1,y:4.1}),false);
 assert.equal(mapPropOccludesActor(soil,{x:3,y:3}),false);
});

test('raised terrace tops mask lower actors behind them but not actors in front or on top',()=>{
 const map={format:'posecraft-map',version:1,id:'terrace-depth',name:'Terrace depth',width:12,height:12,seed:1,tileSize:{width:72,height:36},terrain:Array(144).fill(0),terraces:[{id:'upper',x:5,y:5,width:2,height:2,heightOffset:3}],props:[],actors:[]},viewport={x:-500,y:-500,width:1000,height:1000};
 const tops=createCliffTopProps(map);assert.equal(tops.length,4);assert.equal(createCliffTopProps(map),tops,'derived masks are cached');
 const index=new MapOcclusionIndex(map,[],viewport),behind={id:'behind',x:2.5,y:2.5,speed:3},front={id:'front',x:8.5,y:8.5,speed:3},upper={id:'upper',x:5.5,y:5.5,speed:3};
 const hidden=index.foreground(behind,mapActorArtBounds(map,behind));assert.ok(hidden.props.some(prop=>prop.cliffTop));assert.ok(hidden.silhouetteProps.some(prop=>prop.cliffTop));
 assert.equal(index.foreground(front,mapActorArtBounds(map,front)).props.some(prop=>prop.cliffTop),false);
 assert.equal(index.foreground(upper,mapActorArtBounds(map,upper)).props.some(prop=>prop.cliffTop),false);
});
