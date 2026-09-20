import test from 'node:test';
import assert from 'node:assert/strict';
import {assertMap,MapIndex} from '../src/map.js';
import {fenceCollisionParts,fencePiece,fenceWorldPosts} from '../src/map-fence.js';
import {farmPropBrushes} from '../examples/farm-assets.js';

const base=prop=>({format:'posecraft-map',version:1,id:'fence',name:'Fence',seed:1,width:12,height:12,tileSize:{width:64,height:32},terrain:Array(144).fill(0),props:[prop],actors:[]});

test('connected fence collision follows links and leaves unrelated cells open',()=>{
 const prop={id:'join',kind:'decoration',x:2,y:2,width:5,height:5,fence:{nodes:[{x:0,y:0},{x:5,y:0},{x:5,y:5},{x:2,y:0},{x:2,y:5}],links:[[0,1],[1,2],[3,4]]}};
 const map=assertMap(base(prop)),index=new MapIndex(map),parts=fenceCollisionParts(prop);
 assert.equal(parts.length,3);assert.ok(index.isPointBlocked(4,2.02));assert.ok(index.isPointBlocked(7.01,5));assert.equal(index.isPointBlocked(3,4),false);
 assert.equal(fenceWorldPosts(prop).filter(post=>post.x===7&&post.y===2).length,1,'shared corner owns one post');
 assert.ok(fenceWorldPosts(prop).some(post=>post.x>2&&post.x<7&&post.y===2),'long rails gain support posts');
});

test('separate spans deterministically draw a shared junction post once',()=>{
 const a={id:'a',kind:'decoration',x:2,y:2,width:2,height:1,fence:{nodes:[{x:0,y:.5},{x:2,y:.5}],links:[[0,1]]}},b={id:'b',kind:'decoration',x:4,y:2,width:1,height:2,fence:{nodes:[{x:0,y:.5},{x:0,y:2}],links:[[0,1]]}},map={...base(a),props:[a,b]};
 const key=post=>`${post.x}:${post.y}`,posts=[...fenceWorldPosts(a,map),...fenceWorldPosts(b,map)];
 assert.equal(posts.filter(post=>key(post)==='4:2.5').length,1);
});

test('schema accepts straight vaults and rejects traversal on junctions',()=>{
 const straight={id:'straight',x:2,y:2,...structuredClone(fencePiece('straight','Straight',['w','e']).prop),traversal:{activation:'click',kind:'vault',height:.55,endpoints:[{x:.5,y:-.4},{x:.5,y:1.4}]}};
 assert.equal(assertMap(base(straight)).props[0].id,'straight');
 const junction={id:'join',x:2,y:2,...structuredClone(fencePiece('join','Join',['n','e','w']).prop),traversal:{activation:'click',kind:'vault',height:.55,endpoints:[{x:.5,y:-.4},{x:.5,y:1.4}]}};
 assert.throws(()=>assertMap(base(junction)),/junction.*cannot define traversal/);
 const zero={id:'zero',kind:'decoration',x:2,y:2,width:1,height:1,fence:{nodes:[{x:.5,y:.5},{x:.5,y:.5}],links:[[0,1]]}};
 assert.throws(()=>assertMap(base(zero)),/nonzero and axis-aligned/);
});

test('farm palette contains both straights, every corner and T rotation, and a cross',()=>{
 const ids=farmPropBrushes.filter(brush=>brush.prop.fence).map(brush=>brush.id);
 assert.deepEqual(ids,['farm-fence-x','farm-fence-y','farm-fence-ne','farm-fence-es','farm-fence-sw','farm-fence-wn','farm-fence-t-n','farm-fence-t-e','farm-fence-t-s','farm-fence-t-w','farm-fence-cross']);
});
