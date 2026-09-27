import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {laptopGrip,laptopFoldKeys} from '../examples/wwzard-laptop.js';
import {IllustrationController} from '../src/illustration.js';
import {BehaviorRuntime} from '../src/behaviors.js';
import {ScenePointerInteraction} from '../src/pointer-interactions.js';
import {morphPath,spatialParts} from '../src/spatial.js';
import {assertDocument} from '../src/schema.js';
import {compileScene} from '../tools/compile-scene.mjs';

const number=/[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g;
const vertices=d=>{const values=(d.match(number)||[]).map(Number),points=[];for(let i=0;i<values.length;i+=2)points.push(values.slice(i,i+2));return points;};
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const near=(actual,expected,tolerance=.005)=>assert.ok(distance(actual,expected)<=tolerance,`${actual} differs from ${expected} by ${distance(actual,expected).toFixed(3)}px`);
const part=(pack,id)=>pack.parts.find(item=>item.id===id);
const actor=(frame,id)=>frame.actors.find(item=>item.id===id);

test('laptop lid keeps its hinge fixed and closes over the keyboard footprint',()=>{
 const scene=createWwzardIllustration(),screen=scene.packs.screen,keyboard=scene.packs.keyboard;
 const deck=vertices(part(keyboard,'keyboard-top').d),lid=part(screen,'lid-back');
 for(let i=0;i<=32;i++){
  const fold=i/32,quad=vertices(morphPath(lid,fold));
  near(quad[0],deck[3]);near(quad[1],deck[2]);
  assert.ok(distance(quad[2],quad[3])>100,`lid retains width at fold ${fold}`);
 }
 const closed=vertices(morphPath(lid,1));
 for(let i=0;i<4;i++)near(closed[i],deck[[3,2,1,0][i]]);
});

test('trackpad stays on the deck and clear of the keyboard well',()=>{
 const keyboard=createWwzardIllustration().packs.keyboard,deck=vertices(part(keyboard,'keyboard-top').d);
 const [origin,right,,back]=deck,u=[right[0]-origin[0],right[1]-origin[1]],v=[back[0]-origin[0],back[1]-origin[1]],cross=(a,b)=>a[0]*b[1]-a[1]*b[0],denominator=cross(u,v);
 const uv=point=>{const offset=[point[0]-origin[0],point[1]-origin[1]];return [cross(offset,v)/denominator,cross(u,offset)/denominator];};
 const pad=vertices(part(keyboard,'trackpad').d).map(uv),well=vertices(part(keyboard,'keyboard-well').d).map(uv);
 for(const [x,y] of pad)assert.ok(x>0&&x<1&&y>0&&y<1,`trackpad must stay inside the deck: ${x}, ${y}`);
 assert.ok(Math.max(...pad.map(([,y])=>y))+.02<Math.min(...well.map(([,y])=>y)),'trackpad and keyboard well need a visible deck gap');
});

test('screen contour and hand preview stay in contact across the close and reopen action',()=>{
 const scene=createWwzardIllustration(),player=new IllustrationController(scene,{behaviorFactory:BehaviorRuntime,pointerFactory:ScenePointerInteraction});
 try{
  const samples=new Set([1.05,2.55,3.8,5.4,...laptopFoldKeys.filter(([time])=>time>=1.05&&time<=5.4).map(([time])=>time)]);
  for(let i=0;i<=Math.ceil((5.4-1.05)*30);i++)samples.add(Math.min(5.4,1.05+i/30));
  for(const time of [...samples].sort((a,b)=>a-b)){
   player.previewClip('wwzard','laptop',time);player.previewClip('screen','laptop',time);
   const frame=player.frame(),hero=actor(frame,'wwzard'),screen=actor(frame,'screen');
   const hand=hero.world.leftHand,handPoint=[hand.x,hand.y],fold=screen.pose['hinge.bend'];
   const lid=vertices(spatialParts(scene.packs.screen,screen).parts.get('lid-back').d);
   const deck=vertices(part(scene.packs.keyboard,'keyboard-top').d);
   near(lid[0],deck[3]);near(lid[1],deck[2]);
   const freeEdge=[lid[3][0]+(lid[2][0]-lid[3][0])*.055,lid[3][1]+(lid[2][1]-lid[3][1])*.055],renderedGrip=[freeEdge[0]-3,freeEdge[1]-3];
   assert.ok(distance(handPoint,renderedGrip)<=1,`hand misses rendered lid by ${distance(handPoint,renderedGrip).toFixed(3)}px at ${time.toFixed(3)}s`);
   assert.ok(distance(renderedGrip,laptopGrip(fold))<=1,`piecewise lid differs from laptopGrip by more than 1px at ${time.toFixed(3)}s`);
  }
 }finally{player.dispose();}
});

test('laptop morph frames survive scene reopening and website compilation',async()=>{
 const scene=createWwzardIllustration(),reopened=assertDocument(JSON.parse(JSON.stringify(scene)));
 for(const [pack,id] of [['screen','lid-back'],['wwzard','left-sleeve']]){
  assert.deepEqual(part(reopened.packs[pack],id).spatial.morph,part(scene.packs[pack],id).spatial.morph);
 }
 await fs.mkdir('test-results',{recursive:true});
 const output=await fs.mkdtemp(path.resolve('test-results/wwzard-laptop-'));
 await compileScene(reopened,output);
 const html=await fs.readFile(path.join(output,'index.html'),'utf8');
 const embedded=html.match(/<script id="posecraft-scene" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(embedded);
 const exported=JSON.parse(embedded);
 for(const [pack,id] of [['screen','lid-back'],['wwzard','left-sleeve']]){
  assert.deepEqual(part(exported.packs[pack],id).spatial.morph,part(scene.packs[pack],id).spatial.morph);
 }
});
