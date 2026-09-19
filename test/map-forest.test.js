import test from 'node:test';
import assert from 'node:assert/strict';
import {generateMap,MapIndex,MapPathJob} from '../src/map.js';

test('groves contain solid forest cores and leave navigable clearings and roads',()=>{
  for(const seed of [1,55,2026]){
    const map=generateMap({seed}),index=new MapIndex(map),trees=new Set(map.props.filter(p=>p.kind==='tree').map(p=>`${p.x},${p.y}`));
    let core=null,adjacent=0,clear=0;
    for(const p of map.props.filter(p=>p.kind==='tree')){
      const neighbors=[[1,0],[-1,0],[0,1],[0,-1]].filter(([x,y])=>trees.has(`${p.x+x},${p.y+y}`)).length;
      if(neighbors)adjacent++;
      if(neighbors===4)core=p;
    }
    assert.ok(adjacent/trees.size>.8,'Most trees should be in groves, not isolated scatter');
    assert.ok(core,'Dense forest must contain fully enclosed trunk cells');
    const job=new MapPathJob(map,index,map.actors[0],{x:core.x+.5,y:core.y+.5});
    assert.equal(job.result.status,'failed','Dense forest interior is not walkable');
    for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++){
      if(map.terrain[y*map.width+x]===1)assert.equal(index.isBlocked(x,y),false,'Road corridors remain open');
      if(map.terrain[y*map.width+x]===0&&!index.isBlocked(x,y))clear++;
    }
    assert.ok(clear>map.width*map.height*.45,'Keep substantial open grassland');
  }
});
