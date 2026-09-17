import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SceneController,STEP} from '../src/scene.js';
import {validateDocument} from '../src/schema.js';
import {renderSVG} from '../src/svg.js';
import {DocumentStore} from '../src/commands.js';
const fixture=(enabled=true,rotation=0)=>{
 const d=JSON.parse(fs.readFileSync(new URL('../examples/characters/dummy.json',import.meta.url)));
 d.bounds.height=650;d.actors[0].transform={x:320,y:190,scale:1,rotation:0};
 d.props=[{id:'platform',name:'Platform',x:320,y:460,width:500,height:24,rotation,fill:'#b9c8c2',collider:{enabled,width:500,height:24,x:0,y:0,friction:.8,bounce:.1}}];return d;
};
test('dummy predicts and lands on real platform contacts, including rotated boxes',()=>{
 for(const rotation of [0,12,-12]){
  const d=fixture(true,rotation),c=new SceneController(d);c.setBehavior('dummy',{mode:'protective'});
  let prediction=-1,contact=-1,impact=false,upward=false;
  for(let i=0;i<500;i++){c.step(STEP);const p=c.frame().actors[0].physics;
   if(p.predictedSurface==='platform'&&prediction<0)prediction=i;
   if(p.contacts.some(v=>v.surface==='platform')){if(contact<0)contact=i;upward ||= p.contacts.some(v=>v.surface==='platform'&&v.normal.y<-.5);}
   impact ||= p.impact?.surface==='platform';
  }
  assert.ok(prediction>=0&&prediction<contact,`${rotation}: predicts ${prediction} before contact ${contact}`);assert.ok(impact);assert.ok(upward);
 }
});
test('disabled boxes remain visible while physical characters pass through to the floor',()=>{
 const d=fixture(false),c=new SceneController(d);c.setBehavior('dummy',{mode:'ragdoll'});let floor=false;
 for(let i=0;i<600;i++){c.step(STEP);const p=c.frame().actors[0].physics;assert.equal(p.predictedSurface==='platform',false);assert.ok(p.contacts.every(v=>v.surface!=='platform'));floor ||= p.contacts.some(v=>v.surface==='bounds'&&v.normal.y<-.5);}
 assert.ok(floor);assert.match(renderSVG(d,c.frame(),{colliders:true}),/data-collider="platform"/);
});
test('prop geometry and collision edits round-trip, undo atomically, and reject unsafe data',()=>{
 const d=fixture(),store=new DocumentStore(d);store.transact([{op:'set',path:['props',0,'collider','width'],value:330}]);
 assert.equal(JSON.parse(JSON.stringify(store.document)).props[0].collider.width,330);store.undo();assert.equal(store.document.props[0].collider.width,500);
 for(const [field,value] of [['width',NaN],['height',0],['enabled','true'],['friction',3],['bounce',-1]]){const bad=fixture();bad.props[0].collider[field]=value;assert.equal(validateDocument(bad).valid,false);}
 const bad=fixture();bad.props.push(structuredClone(bad.props[0]));assert.equal(validateDocument(bad).valid,false);
 d.props[0].name='<script>oops</script>';const svg=renderSVG(d,new SceneController(d).frame());assert.ok(!svg.includes('<script>'));assert.match(svg,/&lt;script&gt;/);
});
test('dropping a rotating dummy preserves relative joint angles across normalized turns',()=>{
 const c=new SceneController(fixture());c.setBehavior('dummy',{mode:'floating'});c.interact('dummy','toss');
 for(let i=0;i<400;i++)c.step(STEP);
 const physical=c.actors[0].physics,angles=new Map([...physical.joints].map(([id,j])=>[id,j.getJointAngle()]));
 c.interact('dummy','drop');
 for(const [id,j] of physical.joints)assert.ok(Math.abs(j.getJointAngle()-angles.get(id))<1e-8,id);
});
