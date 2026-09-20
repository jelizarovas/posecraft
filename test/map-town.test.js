import test from 'node:test';
import assert from 'node:assert/strict';
import {MapIndex,MapPathJob,approachTiles,assertMap} from '../src/map.js';
import {createTownMap,townImages,townNpcRoutes,townPropBrushes} from '../examples/town-map.js';
import {MapController} from '../src/map-runtime.js';

function finish(job){for(let i=0;i<10000&&job.result.status==='pending';i++)job.step(256);return job.result;}
async function drive(controller){for(let i=0;i<10000&&controller.active.size;i++){controller.advance(1/60);if(i%20===0)await new Promise(resolve=>setTimeout(resolve,0));}assert.equal(controller.active.size,0,'movement completes');}

test('town generation is deterministic and preserves the reusable map schema',()=>{
 const first=createTownMap(),second=createTownMap();
 assert.deepEqual(first,second);assert.equal(assertMap(JSON.parse(JSON.stringify(first))).id,'town-2026');
 assert.equal(first.width,128);assert.equal(first.height,128);
 assert.equal(first.props.filter(prop=>prop.kind==='house').length,8);
 assert.ok(first.props.filter(prop=>prop.art==='wheat').length>=70);
 assert.ok(first.props.filter(prop=>prop.art==='wheat').every(prop=>prop.occlusion?.mode==='low-foliage'&&prop.occlusion.lowerBodyFraction===.5));
 for(const art of ['farm-pumpkin','farm-vegetables','farm-soil','farm-shack','farm-tools','farm-scarecrow','farm-poplar','farm-mine','farm-fence-broken','farm-coop','farm-sheep','farm-chicken','farm-cow'])assert.ok(first.props.some(prop=>prop.art===art)||first.actors.some(actor=>actor.appearance?.image===art),`${art} is represented in town`);
 assert.ok(first.props.some(prop=>prop.fence),'connected fence geometry is represented in town');
 assert.equal(first.actors.filter(actor=>actor.npc?.species==='cow').length,2);
 assert.ok(first.terrain.some(tile=>tile===2),'town includes creek and pond water');
 assert.ok(first.props.some(prop=>prop.id==='town-wagon'&&prop.collision.shape==='rect'));
 assert.equal(first.art.actors.hero,first.art.actors['npc-farmer'],'actors share clip metadata in memory');
 assert.deepEqual(townPropBrushes.map(brush=>brush.prop.art).filter(Boolean),Object.keys(townImages).filter(id=>id!=='farm-fence-timber'&&!['farm-fence-x','farm-fence-y'].includes(id)));
 assert.deepEqual([townImages.cottage.width,townImages.workshop.width,townImages.barn.width],[342,450,450]);
 assert.deepEqual([first.art.images.inn.width,first.art.images.oak.width,first.art.images.fir.width,first.art.images.birch.width],[248.4,220,170,175]);
 for(const [id,width,height] of [['cottage-west',4,3],['town-workshop',6,4],['town-barn',6,4],['village-house',4,3]]){
  const building=first.props.find(prop=>prop.id===id);assert.deepEqual([building.width,building.height],[width,height],`${id} keeps its scaled footprint`);
 }
});

test('plaza, farm lanes, buildings, and NPC routes stay connected and collision-safe',()=>{
 const map=createTownMap(),index=new MapIndex(map),hero=map.actors[0];
 for(const actor of map.actors)assert.equal(index.isPointBlocked(actor.x,actor.y),false,`${actor.id} has a safe spawn`);
 for(const building of map.props.filter(prop=>prop.kind==='house')){
  const goals=approachTiles(map,index,building),result=finish(new MapPathJob(map,index,hero,goals));
  assert.ok(goals.length,`${building.id} has a door approach`);assert.equal(result.status,'complete',`${building.id} is reachable`);
  assert.ok(goals.some(goal=>map.terrain[Math.floor(goal.y)*map.width+Math.floor(goal.x)]===1),`${building.id} opens onto a road`);
 }
 for(const [id,route] of Object.entries(townNpcRoutes(map))){
  const actor=map.actors.find(value=>value.id===id);let start=actor;
  for(const destination of route){assert.equal(index.isPointBlocked(destination.x,destination.y),false,`${id} route is clear`);assert.equal(map.terrain[Math.floor(destination.y)*map.width+Math.floor(destination.x)],1,`${id} route stays on planted roads`);const result=finish(new MapPathJob(map,index,start,destination));assert.equal(result.status,'complete',`${id} can reach its route`);start=destination;}
 }
 const water=(x,y)=>map.terrain[y*map.width+x]===2;
 const cx=Math.floor(map.width/2),cy=Math.floor(map.height/2);
 assert.ok([26,27,28].every(x=>water(cx+x,cy-10)),'creek crosses the east meadow in one channel');
 for(const edgeY of [cy-17,cy-11,cy-5])for(const x of [cx+26,cx+27,cx+28]){
  assert.ok(water(x,edgeY-1)&&water(x,edgeY),`creek stays continuous across cliff edge ${edgeY}`);
 }
 for(const y of [cy-2,cy-1,cy+13,cy+14])assert.ok(!water(cx+25,y),`crossing at row ${y} stays dry`);
 for(const id of ['sheep-1','sheep-2','sheep-3','cow-1','cow-2','chicken-1','chicken-2','chicken-3']){
  const animal=map.actors.find(actor=>actor.id===id);assert.ok(animal,`${id} is an NPC`);assert.equal(map.terrain[Math.floor(animal.y)*map.width+Math.floor(animal.x)],0,`${id} starts on grass`);
 }
 for(const [gateId,replacedId] of [['west-pasture-gate','west-pasture-n-3'],['east-pasture-gate','east-pasture-n-2']]){
  const gate=map.props.find(prop=>prop.id===gateId);assert.ok(gate,`${gateId} is placed`);assert.ok(!map.props.some(prop=>prop.id===replacedId),'broken gate replaces its intact fence segment');
  assert.equal(index.isPointBlocked(gate.x+1,gate.y+.5),false,`${gateId} leaves a walkable opening`);
 }
 const pasture=map.props.filter(prop=>prop.id.startsWith('pasture-')&&prop.fence);assert.equal(pasture.length,9,'nine connected spans enclose both pastures');assert.ok(pasture.every(prop=>prop.fence.nodes.length===2&&prop.fence.links.length===1&&prop.traversal?.activation==='auto'),'every pasture span supports automatic and explicit vaults');assert.ok(pasture.some(prop=>prop.id==='pasture-divider'),'shared divider joins both T posts');
 const livestock=map.actors.filter(actor=>actor.appearance?.kind==='livestock');assert.equal(livestock.length,8);
 for(const animal of livestock){
  assert.ok(!index.isPointBlocked(animal.x,animal.y),`${animal.id} does not overlap another collider`);
  assert.ok(!water(Math.floor(animal.x),Math.floor(animal.y)),`${animal.id} stays out of the water`);
 }
 for(const destination of [{x:cx+23.5,y:cy-1.5},{x:cx+28.5,y:cy-1.5},{x:cx+23.5,y:cy+13.5},{x:cx+28.5,y:cy+13.5}]){
  assert.equal(index.isPointBlocked(destination.x,destination.y),false,'creek crossing endpoint stays open');
  assert.equal(finish(new MapPathJob(map,index,hero,destination)).status,'complete','both creek banks remain reachable');
 }
 const wheat=map.props.filter(prop=>prop.art==='wheat');
 assert.ok(wheat.every(prop=>!map.props.some(tree=>tree.kind==='tree'&&overlap(prop,tree))),'fields contain no generated trees');
 assert.ok(wheat.every(prop=>map.terrain[prop.y*map.width+prop.x]===0),'farm lanes do not paint beneath wheat');
 for(let x=Math.floor(map.width/2)-24;x<=Math.floor(map.width/2)-15;x++)assert.equal(map.terrain[(Math.floor(map.height/2)+5)*map.width+x],1,'farm access lane connects to the west road');
 const plantings=map.props.filter(prop=>prop.id.startsWith('oak-')||prop.id.startsWith('bush-'));
 assert.equal(plantings.length,14);assert.ok(plantings.every(prop=>map.terrain[prop.y*map.width+prop.x]===0),'plantings stay in grass pockets');
 for(const planting of plantings){assert.ok(!map.actors.some(actor=>Math.floor(actor.x)===planting.x&&Math.floor(actor.y)===planting.y));assert.ok(!map.props.some(prop=>prop!==planting&&!prop.id.startsWith('oak-')&&!prop.id.startsWith('bush-')&&overlap(planting,prop)),`${planting.id} has a clear lawn cell`);}
 const ridge=map.props.find(prop=>prop.id==='showcase-ridge'),stride=map.width+1;
 assert.equal(ridge.traversal.kind,'climb');assert.equal(map.elevations[ridge.y*stride+ridge.x],.4);assert.equal(map.elevations[(ridge.y+1)*stride+ridge.x],.2);assert.equal(map.elevations[(ridge.y+2)*stride+ridge.x],0);
 for(let y=0;y<=map.height;y++)for(let x=0;x<=map.width;x++){const height=map.elevations[y*stride+x];if(x)assert.ok(Math.abs(height-map.elevations[y*stride+x-1])<=.400000001);if(y)assert.ok(Math.abs(height-map.elevations[(y-1)*stride+x])<=.400000001);}
});

test('clicking a pasture straight span vaults across its rail',async()=>{
 const map=createTownMap(),cx=Math.floor(map.width/2),cy=Math.floor(map.height/2),hero=map.actors[0];hero.x=cx;hero.y=cy+12.6;
 const events=[],controller=new MapController(map,{execution:'main',onEvent:event=>events.push(event)});
 try{await controller.ready;const move=controller.moveTo(hero.id,'pasture-north-west-a');await drive(controller);await move;assert.ok(controller.actorPosition(hero.id).y>cy+13.5,'hero lands inside the pasture');assert.ok(events.some(event=>event.type==='map.traversal.started'&&event.object==='pasture-north-west-a'));}finally{controller.dispose();}
});

test('clicking the lower cliff ridge climbs from ground to the mine ledge',async()=>{
 const map=createTownMap(),cx=Math.floor(map.width/2),cy=Math.floor(map.height/2),hero=map.actors[0];
 hero.x=cx+38.5;hero.y=cy-2.5;
 const events=[],controller=new MapController(map,{execution:'main',onEvent:event=>events.push(event)});
 try{
  await controller.ready;const move=controller.moveTo(hero.id,'showcase-ridge');await drive(controller);await move;
  const end=controller.actorPosition(hero.id);assert.ok(end.y<cy-5,'hero lands on the lower terrace');
  assert.ok(events.some(event=>event.type==='map.traversal.started'&&event.object==='showcase-ridge'&&event.action==='climb-up'));
 }finally{controller.dispose();}
});

function overlap(a,b){return a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y;}
