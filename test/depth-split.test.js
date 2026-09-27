import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createDrawing} from '../src/vector-authoring.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {SceneController} from '../src/scene.js';
import {evaluateDrawing} from '../src/render-evaluation.js';
import {renderSVG} from '../src/svg.js';
import {inspectSceneFeatures} from '../src/scene-export.js';
import {compileScene} from '../tools/compile-scene.mjs';

const gradient={type:'linear',x1:0,y1:0,x2:1,y2:1,stops:[[0,'#572d8c'],[1,'#d18bea']]};
function fixture(){
  const scene=createDrawing(),pack=scene.packs.drawing;
  scene.requiredFeatures=['spatial-rig','scene-depth','surface-decals','part-gradients'];
  scene.actors[0].depth={value:30};
  pack.spatial=true;
  pack.joints.push({id:'accent',parent:'root',x:0,y:0,length:0,rotation:0,min:-180,max:180});
  pack.parts=[
    {id:'host',joint:'root',d:'M0 0L40 0L40 20L0 20Z',fill:'#8753ba',gradient:structuredClone(gradient),spatial:{depthSplit:{axis:'x',at:20,low:{value:20},high:{value:40}}}},
    {id:'mark',joint:'root',d:'M16 5L24 5L24 10L16 10Z',fill:'#ffd786',spatial:{surfaceOf:'host'}},
  ];
  return scene;
}
function drawing(scene){const player=new SceneController(scene);try{const frame=player.frame();return {draw:evaluateDrawing(scene,frame),svg:renderSVG(scene,frame)};}finally{player.dispose();}}
const fragment=(draw,part,region)=>draw.units.flatMap(unit=>unit.commands.map(command=>({unit,command}))).find(item=>item.command.pick?.part===part&&item.command.pick.fragment===`${part}--depth-${region}`);
const unitIndex=(draw,id)=>draw.units.findIndex(unit=>unit.id===id);
const hasSplitError=scene=>validateDocument(scene).errors.some(error=>/depthSplit|surfaceOf/.test(error.path));

test('depth split keeps the full host path and paint in two independently clipped fragments',()=>{
  const scene=fixture();assertDocument(scene);
  const {draw,svg}=drawing(scene),low=fragment(draw,'host','low'),high=fragment(draw,'host','high'),markLow=fragment(draw,'mark','low'),markHigh=fragment(draw,'mark','high');
  for(const item of [low,high,markLow,markHigh])assert.ok(item,'host and same-joint attached mark each need two rendered fragments');
  assert.equal(low.command.d,scene.packs.drawing.parts[0].d);
  assert.equal(high.command.d,scene.packs.drawing.parts[0].d,'split must clip one full silhouette, not redraw separate shapes');
  assert.deepEqual(low.command.fill,high.command.fill,'both host fragments use the same complete gradient');
  assert.equal(low.command.fill.type,'linear');
  assert.equal(low.command.clips.length,1);assert.equal(high.command.clips.length,1);
  assert.notEqual(low.command.clips[0].d,high.command.clips[0].d,'the two fragments need complementary clip regions');
  assert.equal(markLow.command.d,scene.packs.drawing.parts[1].d);
  assert.equal(markHigh.command.d,scene.packs.drawing.parts[1].d);
  assert.match(svg,/data-fragment-path="host--depth-low"/);
  assert.match(svg,/data-fragment-path="host--depth-high"/);
  assert.match(svg,/data-fragment-path="mark--depth-low"/);
  assert.match(svg,/data-fragment-path="mark--depth-high"/);
  assert.equal((svg.match(/data-part-gradient="host"/g)||[]).length,1,'split geometry shares its authored paint definition');
});

test('low and high fragments sort independently around the actor and fuse at exactly equal depth',()=>{
  const scene=fixture();
  for(const [low,high,expected] of [[20,40,['low','actor','high']],[40,20,['high','actor','low']]]){
    scene.packs.drawing.parts[0].spatial.depthSplit.low={value:low};scene.packs.drawing.parts[0].spatial.depthSplit.high={value:high};
    const {draw,svg}=drawing(scene),ids=expected.map(key=>key==='actor'?'actor:character':`part:character:host--depth-${key}`),positions=ids.map(id=>unitIndex(draw,id));
    assert.ok(positions.every(index=>index>=0),`missing split depth units for ${low}/${high}: ${positions}`);
    assert.ok(positions.every((index,i)=>i===0||positions[i-1]<index),`wrong depth order for ${low}/${high}: ${positions}`);
    const rendered=ids.map(id=>svg.indexOf(`data-scene-unit="${id}"`));
    assert.ok(rendered.every((index,i)=>index>=0&&(i===0||rendered[i-1]<index)),`SVG order disagrees for ${low}/${high}: ${rendered}`);
  }
  for(const side of ['low','high']){
    scene.packs.drawing.parts[0].spatial.depthSplit.low={value:side==='low'?30:20};
    scene.packs.drawing.parts[0].spatial.depthSplit.high={value:side==='high'?30:40};
    const {draw}=drawing(scene),local=fragment(draw,'host',side);
    assert.equal(local.unit.id,'actor:character',`${side} fragment at actor depth should fuse into local artwork`);
    assert.equal(unitIndex(draw,`part:character:host--depth-${side}`),-1);
    assert.ok(fragment(draw,'host',side==='low'?'high':'low').unit.id.startsWith('part:character:'));
  }
});

test('depth split rejects malformed anchors, conflicting geometry and cross-joint attached surfaces',()=>{
  const invalid=[
    [part=>{part.spatial.depthSplit.axis='z';},true],
    [part=>{part.spatial.depthSplit.at=NaN;},false],
    [part=>{part.spatial.depthSplit.at='20';},true],
    [part=>{delete part.spatial.depthSplit.high;},true],
    [part=>{part.spatial.depthSplit.low={value:Infinity};},false],
    [part=>{part.spatial.depthSplit.high={joint:'missing'};},true],
    [part=>{part.spatial.sceneDepth={value:30};},true],
    [part=>{part.spatial.surface={x:0,width:20,depth:10};},true],
    [part=>{part.spatial.hairShell={width:10,height:10,depth:10,y:0};},true],
    [part=>{part.spatial.turnaround={views:[{angle:0,d:part.d},{angle:180,d:part.d},{angle:360,d:part.d}]};},true],
    [part=>{part.spatial.softLimb={elbow:'root',hand:'accent',radius:5};},true],
    [part=>{part.spatial.mesh={};},true],
  ];
  for(const [mutate,specific] of invalid){const scene=fixture();mutate(scene.packs.drawing.parts[0]);const result=validateDocument(scene);assert.equal(result.valid,false,mutate.toString());if(specific)assert.ok(hasSplitError(scene),`expected a depthSplit error for ${mutate.toString()}`);}
  const crossJoint=fixture();crossJoint.packs.drawing.parts[1].joint='accent';assert.ok(hasSplitError(crossJoint),'attached detail on another joint cannot share a host split');
  const ownSplit=fixture();ownSplit.packs.drawing.parts[1].spatial.depthSplit=structuredClone(ownSplit.packs.drawing.parts[0].spatial.depthSplit);assert.ok(hasSplitError(ownSplit),'attached detail inherits the host split');
});

test('depth split survives save/reopen, scene inspection, and compiled website JSON',async()=>{
  const source=fixture(),reopened=assertDocument(JSON.parse(JSON.stringify(source)));
  assert.deepEqual(reopened.packs.drawing.parts[0].spatial.depthSplit,source.packs.drawing.parts[0].spatial.depthSplit);
  assert.ok(inspectSceneFeatures(reopened).features.includes('scene-depth'));
  await fs.mkdir('test-results',{recursive:true});
  const output=await fs.mkdtemp(path.resolve('test-results/depth-split-'));
  const manifest=await compileScene(reopened,output),html=await fs.readFile(path.join(output,'index.html'),'utf8');
  assert.equal(manifest.runtime,'illustration');
  const embedded=html.match(/<script id="posecraft-scene" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(embedded);
  assert.deepEqual(JSON.parse(embedded).packs.drawing.parts[0].spatial.depthSplit,source.packs.drawing.parts[0].spatial.depthSplit);
  assert.ok(!manifest.files.flatMap(file=>file.modules).some(id=>/planck|scene-3d|physics\.js/.test(id)));
});
