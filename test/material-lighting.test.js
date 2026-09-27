import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {SceneController} from '../src/scene.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {sampleMaterialLighting,materialAppearance} from '../src/material-lighting.js';
import {appearance} from '../src/render-shared.js';
import {evaluateDrawing} from '../src/render-evaluation.js';
import {renderSVG} from '../src/svg.js';
import {inspectSceneFeatures} from '../src/scene-export.js';

function fixture(){const scene=createDrawing(),pack=scene.packs.drawing;pack.spatial=true;scene.requiredFeatures=['part-gradients','material-lighting'];
 pack.parts=[{id:'paint',joint:'root',d:'M0 0L100 0L100 100L0 100Z',fill:'#8877aa',gradient:{type:'linear',x1:0,y1:1,x2:1,y2:0,stops:[[0,'#665599'],[1,'#aabbdd']]}}];
 pack.joints.push({id:'night',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0},{id:'screen',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0},{id:'shutter',parent:'root',x:0,y:0,rotation:0,min:-180,max:180,length:0});
 const signal=channel=>({actor:'character',channel:channel+'.bend'});
 scene.materialLighting={weight:signal('night'),ambient:.55,tint:'#798bcc',actors:['character'],lights:[{type:'directional',angle:-45,color:'#d9eaff',intensity:.45},{type:'point',actor:'character',x:25,y:75,range:100,color:'#89dfff',intensity:.8,gains:[signal('screen'),{...signal('shutter'),invert:true}],flicker:.08}]};
 return assertDocument(scene);
}
const colors=(d,f)=>{const a=d.actors[0],pack=d.packs[a.pack],part=pack.parts[0];return materialAppearance(sampleMaterialLighting(d,f),part,a,f.actors[0],appearance(part,a,f.actors[0]),null).gradient.stops;};
test('day keeps authored materials exact; moon shades upper-right stop and gain product shutters screen',()=>{
 const d=fixture(),c=new SceneController(d),f=c.frame(),original=d.packs.drawing.parts[0].gradient.stops;
 assert.equal(sampleMaterialLighting(d,f),null);assert.equal(colors(d,f),original);
 f.actors[0].pose['night.bend']=1;
 const moon=colors(d,f);assert.notDeepEqual(moon,original);assert.deepEqual(moon.map(s=>s[0]),[0,1]);
 const opposite=structuredClone(d);opposite.materialLighting.lights[0].angle=135;const reverse=colors(opposite,f);
 const brightness=hex=>[1,3,5].reduce((sum,i)=>sum+parseInt(hex.slice(i,i+2),16),0);assert(brightness(moon[1][1])>brightness(reverse[1][1]));
 f.actors[0].pose['screen.bend']=1;assert.notDeepEqual(colors(d,f),moon);
 f.actors[0].pose['shutter.bend']=1;assert.deepEqual(colors(d,f),moon);
 f.actors[0].pose['night.bend']=0;assert.equal(colors(d,f),original);c.dispose();
});
test('flicker is deterministic and no faster than 30Hz; whitelist leaves unselected artwork exact',()=>{
 const d=fixture(),c=new SceneController(d),f=c.frame();f.actors[0].pose['night.bend']=1;f.actors[0].pose['screen.bend']=1;
 f.effectsTime=.1;const a=colors(d,f);f.effectsTime=.12;assert.deepEqual(colors(d,f),a);f.effectsTime=.5;assert.notDeepEqual(colors(d,f),a);f.effectsTime=.1;assert.deepEqual(colors(d,f),a);
 d.materialLighting.actors=[];assert.equal(colors(d,f),d.packs.drawing.parts[0].gradient.stops);c.dispose();
});
test('SVG and Canvas use the same authored stops and saved exports detect the feature',()=>{
 const d=fixture(),c=new SceneController(d),f=c.frame();f.actors[0].pose['night.bend']=1;f.actors[0].pose['screen.bend']=1;
 const expected=colors(d,f),drawing=evaluateDrawing(d,f),svg=renderSVG(d,f);
 const commands=drawing.units.flatMap(u=>u.commands);assert.deepEqual(commands.find(c=>c.id==='actor:character:paint').fill.stops,expected);
 for(const [,color]of expected)assert(svg.includes('stop-color="'+color+'"'));
 assert(!svg.includes('<filter'));assert.equal((svg.match(/data-fragment-path=/g)||[]).length,1);
 assert.deepEqual(assertDocument(JSON.parse(JSON.stringify(d))).materialLighting,d.materialLighting);assert(inspectSceneFeatures(d).features.includes('material-lighting'));c.dispose();
});
test('material lighting validates all bounded source and channel references',()=>{
 for(const corrupt of [d=>d.materialLighting.weight.actor='missing',d=>d.materialLighting.weight.channel='missing.bend',d=>d.materialLighting.lights.push(d.materialLighting.lights[0]),d=>d.materialLighting.lights[1].gains.push(d.materialLighting.weight),d=>d.materialLighting.lights[1].gains[0].invert='yes',d=>d.materialLighting.lights[1].range=0,d=>d.materialLighting.ambient=NaN,d=>d.materialLighting.tint='red',d=>d.materialLighting.actors=['missing']]){const d=fixture();corrupt(d);assert.equal(validateDocument(d).valid,false);}
});

test('reflected light preserves dark material color; emission is selected, shuttered and exportable',()=>{
 const d=fixture(),part=d.packs.drawing.parts[0];part.gradient.stops=[[0,'#301040'],[1,'#301040']];
 const c=new SceneController(d),f=c.frame();f.actors[0].pose['night.bend']=1;f.actors[0].pose['screen.bend']=1;
 const reflected=colors(d,f),rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 for(const [,color]of reflected){const [r,g,b]=rgb(color);assert(g<r&&g<b,'purple material must not become white');}
 d.materialLighting.lights[1].emission={actor:'character',parts:['paint']};
 const glowing=colors(d,f);assert(rgb(glowing[0][1])[2]>rgb(reflected[0][1])[2]);
 const commands=evaluateDrawing(d,f).units.flatMap(u=>u.commands);
 assert.deepEqual(commands.find(c=>c.id==='actor:character:paint').fill.stops,glowing);
 assert.deepEqual(assertDocument(JSON.parse(JSON.stringify(d))).materialLighting,d.materialLighting);
 f.actors[0].pose['shutter.bend']=1;const off=colors(d,f);delete d.materialLighting.lights[1].emission;assert.deepEqual(colors(d,f),off);
 d.materialLighting.lights[0].highlights={actor:'character',parts:['paint']};
 assert(rgb(colors(d,f)[1][1])[2]>rgb(off[1][1])[2],'selected rim follows the directional source');
 for(const field of ['emission','highlights'])for(const selection of [{actor:'missing',parts:['paint']},{actor:'character',parts:['missing']},{actor:'character',parts:[]}]){d.materialLighting.lights[1][field]=selection;assert.equal(validateDocument(d).valid,false);delete d.materialLighting.lights[1][field];}
 c.dispose();
});


test('an unfolded contour receives the same light as identical static geometry',()=>{
 const d=fixture(),part=d.packs.drawing.parts[0],open=part.d;
 part.d='M50 50L50 50L50 50L50 50Z';
 part.spatial={morph:{channel:'root.bend',target:open}};
 const c=new SceneController(d),f=c.frame();f.actors[0].pose['night.bend']=1;
 const stops=(doc)=>evaluateDrawing(doc,f).units.flatMap(u=>u.commands).find(c=>c.pick?.part==='paint').fill.stops;
 f.actors[0].pose['root.bend']=1;const unfolded=stops(d);
 const reference=structuredClone(d);reference.packs.drawing.parts[0].d=open;delete reference.packs.drawing.parts[0].spatial;
 assert.deepEqual(unfolded,stops(reference),'lighting must use the visible geometry, not the collapsed rest bounds');
 f.actors[0].pose['root.bend']=0;assert.notDeepEqual(stops(d),unfolded,'contour changes invalidate cached lighting bounds');
 c.dispose();
});
