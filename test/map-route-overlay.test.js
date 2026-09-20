import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRouteArrows} from '../src/map-route-overlay.js';
const map={width:512,height:512,tileSize:{width:64,height:32}};
const rect={x:-80,y:-50,width:400,height:200};
const route=[{from:{x:0,y:0},to:{x:512,y:0}}];
test('Route arrows clip long offscreen routes before allocating their glyphs',()=>{
 const arrows=mapRouteArrows(map,route,rect);
 assert.ok(arrows.length>0&&arrows.length<25);
 for(const a of arrows){assert.ok(a.x>=rect.x-8&&a.x<=rect.x+rect.width+8);assert.equal(a.angle,Math.atan2(16,32));}
});
test('Animated arrows advance toward destination; reduced motion is stable',()=>{
 const a=mapRouteArrows(map,route,rect,{time:0}),b=mapRouteArrows(map,route,rect,{time:100});
 assert.ok(b[0].x>a[0].x&&b[0].y>a[0].y);
 assert.deepEqual(mapRouteArrows(map,route,rect,{reduced:true,time:0}),mapRouteArrows(map,route,rect,{reduced:true,time:999}));
 const backwards=mapRouteArrows(map,[{from:{x:4,y:0},to:{x:0,y:0}}],rect);
 assert.ok(backwards.every(a=>Math.cos(a.angle)<0));
});
test('Dense visible route fragments have a hard glyph budget',()=>{
 const segments=Array.from({length:2000},()=>({from:{x:0,y:0},to:{x:8,y:0}}));
 assert.equal(mapRouteArrows(map,segments,rect).length,240);
});
