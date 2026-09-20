import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTownMap} from '../examples/town-map.js';
import {assertMap} from '../src/map.js';

test('village cast exports six distinct adults, two children and eight animal actors',()=>{
 const map=assertMap(JSON.parse(JSON.stringify(createTownMap()))),adults=map.actors.filter(a=>a.npc?.species==='human'),children=map.actors.filter(a=>a.npc?.species==='child'),animals=map.actors.filter(a=>a.appearance?.kind==='livestock');
 assert.equal(adults.length,6);assert.equal(new Set(adults.map(a=>JSON.stringify(a.appearance))).size,6);
 assert.equal(children.length,2);assert.ok(children.every(a=>a.appearance.scale<.8));
 assert.equal(animals.length,8);assert.ok(animals.every(a=>!map.props.some(p=>p.id===a.id)));
 assert.deepEqual(animals.reduce((counts,a)=>(counts[a.npc.species]=(counts[a.npc.species]||0)+1,counts),{}),{sheep:3,chicken:3,cow:2});
});

test('actor artwork and routine metadata reject broken imports',()=>{
 for(const edit of [a=>a.appearance.scale=100,a=>a.appearance.palette='bogus',a=>a.npc.home.width=-1,a=>a.npc.species='unknown']){
  const map=createTownMap();edit(map.actors.find(a=>a.npc?.species==='human'));assert.throws(()=>assertMap(map),/appearance|NPC/);
 }
 const map=createTownMap();map.actors.find(a=>a.npc?.species==='cow').appearance.image='missing';assert.throws(()=>assertMap(map),/appearance image/);
});
