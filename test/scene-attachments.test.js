import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrawing} from '../src/vector-authoring.js';
import {SceneController} from '../src/scene.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {evaluatedProps} from '../src/scene-attachments.js';
import {renderSVG} from '../src/svg.js';
import {evaluateDrawing} from '../src/render-evaluation.js';
import {removeSceneEntity} from '../src/scene-graph.js';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function fixture(){const d=createDrawing();d.requiredFeatures=[...(d.requiredFeatures||[]),'prop-attachments','scene-objects'];d.actors[0].transform={x:100,y:150,scale:2,rotation:90};d.objects=[{id:'parcel',name:'Parcel',shape:'circle',x:200,y:100,radius:10,mass:1,fill:'#669988',rotation:90}];d.props=[{id:'decoration',name:'Decoration',x:0,y:0,width:20,height:10,rotation:0,fill:'#ff8844',collider:{enabled:false,width:20,height:10,x:0,y:0,friction:.5,bounce:.2},attachment:{type:'object',object:'parcel',offsetX:5,offsetY:3,rotation:10}}];return d;}
test('attachments use authoritative object positions, rotate offsets and preserve scene-sized artwork',()=>{
 const d=fixture(),c=new SceneController(d),f=c.frame(),source=structuredClone(d);f.objects[0]={...f.objects[0],x:300,y:200,rotation:90};const p=evaluatedProps(d,f)[0];near(p.x,297);near(p.y,205);near(p.rotation,100);assert.equal(p.width,20);assert.deepEqual(d,source);
 d.props[0].attachment.inheritRotation=false;near(evaluatedProps(d,f)[0].rotation,10);
 const svg=renderSVG(d,f),draw=evaluateDrawing(d,f).units.find(u=>u.id==='prop:decoration').commands[0];assert.ok(svg.includes('translate(297 205) rotate(10)'));near(draw.matrix[4],297);near(draw.matrix[5],205);c.dispose();
});
test('joint attachments follow scaled rotated live placement and hidden targets hide instead of snapping',()=>{
 const d=fixture(),actor=d.actors[0],joint=d.packs[actor.pack].joints[0];d.props[0].attachment={type:'joint',actor:actor.id,joint:joint.id,offsetX:5,offsetY:3};const c=new SceneController(d),f=c.frame(),w=f.actors[0].world[joint.id];f.actors[0].placement={x:400,y:300,scale:2,rotation:90};const p=evaluatedProps(d,f)[0],r=w.rotation*Math.PI/180;
 near(p.x,400-2*(w.y+5*Math.sin(r)+3*Math.cos(r)));near(p.y,300+2*(w.x+5*Math.cos(r)-3*Math.sin(r)));near(p.rotation,w.rotation+90);actor.hidden=true;assert.equal(evaluatedProps(d,f)[0].hidden,true);assert.equal(evaluateDrawing(d,f).units.find(u=>u.id==='prop:decoration').commands[0].visible,false);c.dispose();
});
test('disabled objects, hidden owners, invalid references and static collisions have defined outcomes',()=>{
 const d=fixture(),c=new SceneController(d),f=c.frame();f.objects[0].enabled=false;assert.equal(evaluatedProps(d,f)[0].hidden,true);f.objects=[];assert.equal(evaluatedProps(d,f)[0].hidden,true);
 for(const mutate of [d=>d.props[0].collider.enabled=true,d=>d.props[0].attachment.object='missing',d=>d.props[0].attachment.offsetX=NaN,d=>d.props[0].attachment.inheritRotation=1,d=>d.props[0].attachment.extra=1,d=>d.requiredFeatures=[],d=>d.objects=[null]]){const bad=structuredClone(d);mutate(bad);assert.equal(validateDocument(bad).valid,false);}
 d.objects[0].owner={actor:d.actors[0].id,joint:d.packs[d.actors[0].pack].joints[0].id};d.actors[0].hidden=true;const hidden=new SceneController(d);assert.equal(hidden.frame().objects[0].visible,false);assert.equal(evaluatedProps(d,hidden.frame())[0].hidden,true);hidden.dispose();c.dispose();
});
test('removing attachment targets cleans references and leaves the source unchanged',()=>{
 const d=fixture();d.props[0].attachment={type:'joint',actor:d.actors[0].id,joint:d.packs[d.actors[0].pack].joints[0].id};assertDocument(d);const next=removeSceneEntity(d,'actor',d.actors[0].id);assert.equal(next.props[0].attachment,undefined);assert.ok(d.props[0].attachment);assertDocument(next);
});
