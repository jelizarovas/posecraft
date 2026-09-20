import {test} from 'node:test';
import assert from 'node:assert/strict';
import {orderMapScenery} from '../src/map-scenery-depth.js';
import {createTownMap} from '../examples/town-map.js';
import {mapPropArtBounds} from '../src/map-depth.js';

test('town oak sorts in front of the barn and behind the south cottage regardless of insertion order',()=>{
 const map=createTownMap(),ids=['town-barn','oak-lawn-west','cottage-south'];
 const entries=ids.map((id,order)=>{
  const prop=map.props.find(p=>p.id===id);
  return{prop,order,bounds:mapPropArtBounds(map,prop),depth:prop.x+prop.y+(prop.width+prop.height)*(prop.kind==='tree'?.5:1)};
 });
 for(const list of [entries,[...entries].reverse(),[entries[1],entries[2],entries[0]]])assert.deepEqual(orderMapScenery(list).map(e=>e.prop.id),ids);
});

test('rails can share a crop tile and sort on either side of its roots',()=>{
 const crop={id:'crop',kind:'decoration',x:5,y:5,width:1,height:1,occlusion:{mode:'low-foliage',lowerBodyFraction:2/3}};
 const bounds={x:0,y:0,width:100,height:100};
 for(const axis of ['x','y'])for(const near of [false,true]){
  const at=near?5.9:5.1,nodes=axis==='y'?[{x:4,y:at},{x:7,y:at}]:[{x:at,y:4},{x:at,y:7}];
  const rail={prop:{id:'rail',fence:{}},part:{nodes,posts:[]},depth:0,order:0,bounds};
  const plant={prop:crop,depth:12,order:1,bounds};
  assert.deepEqual(orderMapScenery([plant,rail]).map(e=>e.prop.id),near?['crop','rail']:['rail','crop']);
 }
});
