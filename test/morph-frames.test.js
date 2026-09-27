import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createDemo} from '../examples/showcase.js';
import {assertDocument} from '../src/schema.js';
import {morphPath} from '../src/spatial.js';
import {compileScene} from '../tools/compile-scene.mjs';

const paths={source:'M0 0L10 20Z',early:'M0 0L20 30Z',late:'M0 0L40 20Z',target:'M0 0L50 10Z'};
function scene(){
 const doc=createDemo('turn-and-pose'),part=doc.packs.ona.parts[0];
 part.d=paths.source;
 part.spatial={...part.spatial,morph:{channel:'root.bend',target:paths.target,frames:[{value:.2,target:paths.early},{value:.7,target:paths.late}]}};
 return {doc,part};
}

test('intermediate contour frames interpolate each segment and preserve authored stops',()=>{
 const {part}=scene(),morph=part.spatial.morph;
 assert.equal(morphPath(part,0),paths.source);
 assert.equal(morphPath(part,.2),paths.early);
 assert.equal(morphPath(part,.45),'M0 0L30 25Z');
 assert.equal(morphPath(part,.45),'M0 0L30 25Z');
 assert.equal(morphPath(part,.85),'M0 0L45 15Z');
 assert.equal(morphPath(part,1),paths.target);
 morph.frames[0].target='M0 0L30 30Z';
 assert.equal(morphPath(part,.1),'M0 0L20 25Z','editing a held frame invalidates the cache');
 morph.frames[0].value=.25;
 assert.equal(morphPath(part,.2),'M0 0L26 28Z','editing a stop value invalidates the cache');
});

test('morph frame schema rejects invalid order, limits, and path topology',()=>{
 const bad=[
  [{value:0,target:paths.early}],
  [{value:1,target:paths.early}],
  [{value:.4,target:paths.early},{value:.4,target:paths.late}],
  [{value:.7,target:paths.early},{value:.2,target:paths.late}],
  [{value:NaN,target:paths.early}],
  [{value:.5,target:'M0 0L10 20L30 40Z'}],
  [{value:.5,target:'M0 0LNaN 20Z'}],
  Array.from({length:17},(_,i)=>({value:(i+1)/18,target:paths.early})),
  'not an array',
 ];
 for(const frames of bad){const {doc,part}=scene();part.spatial.morph.frames=frames;assert.throws(()=>assertDocument(doc),String(frames));}
 const {doc}=scene();assertDocument(doc);
});

test('intermediate frames survive reopening and compiled website export',async()=>{
 const {doc,part}=scene(),saved=assertDocument(JSON.parse(JSON.stringify(doc)));
 assert.deepEqual(saved.packs.ona.parts[0].spatial.morph,part.spatial.morph);
 await fs.mkdir('test-results',{recursive:true});
 const output=await fs.mkdtemp(path.resolve('test-results/morph-frames-'));
 const manifest=await compileScene(saved,output),html=await fs.readFile(path.join(output,'index.html'),'utf8');
 assert.equal(manifest.runtime,'illustration');
 const embedded=html.match(/<script id="posecraft-scene" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
 assert.ok(embedded);
 assert.deepEqual(JSON.parse(embedded).packs.ona.parts[0].spatial.morph,part.spatial.morph);
});
