import test from 'node:test';
import assert from 'node:assert/strict';
import {createTownMap} from '../examples/town-map.js';
import {animalCareBrushes} from '../examples/animal-care-assets.js';
import {assertMap,MapIndex,MapPathJob} from '../src/map.js';
const finish=job=>{for(let n=0;n<10000&&job.result.status==='pending';n++)job.step(256);return job.result;};

test('feed and water stations are reachable solid props and survive map export',()=>{
 const map=assertMap(JSON.parse(JSON.stringify(createTownMap()))),index=new MapIndex(map);
 const ids=new Set(animalCareBrushes.map(b=>b.prop.art)),stations=map.props.filter(p=>ids.has(p.art));
 assert.equal(stations.length,8);
 for(const station of stations){
  assert.ok(map.art.images[station.art]);
  const center={x:station.x+station.width/2,y:station.y+station.height/2};
  assert.equal(index.isPointBlocked(center.x,center.y),true,station.id+' has physical collision');
  assert.notEqual(map.terrain[Math.floor(center.y)*map.width+Math.floor(center.x)],2);
  const neighbors=[{x:station.x-.5,y:station.y+.5},{x:station.x+station.width+.5,y:station.y+.5},{x:station.x+.5,y:station.y-.5},{x:station.x+.5,y:station.y+station.height+.5}].filter(p=>!index.isPointBlocked(p.x,p.y));
  assert.ok(neighbors.length,station.id+' has open feeding access');
  assert.ok(neighbors.some(goal=>finish(new MapPathJob(map,index,map.actors[0],goal)).status==='complete'),station.id+' can be approached through a gate');
 }
});
