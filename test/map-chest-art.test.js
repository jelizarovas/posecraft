import test from 'node:test';
import assert from 'node:assert/strict';
import {createTownMap} from '../examples/town-map.js';
import {upgradeWoodlandArt} from '../examples/woodland-map.js';
import {assertMap} from '../src/map.js';
import {artPropSelection} from '../src/map-art-layout.js';

test('stock chest keeps its art footprint when opened and survives serialization',()=>{
 const map=JSON.parse(JSON.stringify(createTownMap()));assertMap(map);
 const chest=map.props.find(prop=>prop.kind==='chest');
 assert.equal(artPropSelection(map,chest).id,'chest');
 assert.equal(artPropSelection(map,chest,{opened:true}).id,'chest-open');
 map.art.images.chest.opened='missing';assert.throws(()=>assertMap(map),/opened artwork/);
 map.art.images.chest.opened='chest-open';map.art.images['chest-open'].height++;
 assert.throws(()=>assertMap(map),/same canvas/);
});

test('old stock drafts gain the chest artwork without replacing custom chest bindings',()=>{
 const map=createTownMap();delete map.art.props.chest;delete map.art.images.chest;delete map.art.images['chest-open'];
 const upgraded=upgradeWoodlandArt(map);assertMap(upgraded);assert.deepEqual(upgraded.art.props.chest,['chest']);
 map.art.props.chest=['boulder'];assert.deepEqual(upgradeWoodlandArt(map).art.props.chest,['boulder']);
});
