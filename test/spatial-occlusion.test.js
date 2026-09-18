import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spatialParts,poseDefaults} from '../src/spatial.js';
import {forwardKinematics} from '../src/index.js';
import {addSpatialRig,addOnaArmJoints} from '../src/character-rigs.js';

const joint=(id,parent,x=0,y=0)=>({id,parent,x,y,length:0,rotation:0,min:-180,max:180});
function fixture(){return {spatial:true,joints:[joint('root',null),joint('upper','root'),joint('elbow','upper',20),joint('hand','elbow',60)],parts:[
 {id:'body',joint:'root',d:'M-25-30H25V35H-25Z',fill:'#abc',spatial:{order:10}},
 {id:'marking',joint:'root',d:'M-8-8H8V8H-8Z',fill:'#fde',spatial:{depth:100,surfaceOf:'body',order:11}},
 {id:'arm',joint:'upper',d:'M0 0',fill:'#edb',spatial:{softLimb:{elbow:'elbow',hand:'hand',radius:6},order:20}}
 ]};}
const frame=(pack,pose)=>({pose,world:forwardKinematics(pack.joints,pose)});

test('one seamless soft limb can place its upper arm behind the torso and forearm/palm in front',()=>{
 const p=fixture(),pose={...poseDefaults(p),'upper.z':-15,'upper.yaw':40,'elbow.yaw':-120},view=spatialParts(p,frame(p,pose));
 assert.deepEqual(view.fragmentOrder,['arm--upper','body','marking','arm--forearm','arm--palm']);
 assert.ok(view.fragments.get('arm--upper').depth<0);assert.ok(view.fragments.get('arm--forearm').depth>0);
 for(const kind of ['upper','forearm','palm']){const part=view.fragments.get('arm--'+kind);assert.equal(part.partId,'arm');assert.equal(part.kind,kind);assert.equal(part.d,view.parts.get('arm').d,'all slices share the external silhouette, without elbow seam strokes');assert.ok(part.clipD.startsWith('M'));assert.ok(part.clipD.endsWith('Z'));assert.equal(part.transform,view.parts.get('arm').transform);assert.ok(!/NaN|Infinity/.test(part.d+part.clipD));}
 assert.equal(view.parts.get('marking').depth,view.parts.get('body').depth,'surface marking cannot float above a foreground hand');
 assert.deepEqual(spatialParts(p,frame(p,pose)).fragmentOrder,view.fragmentOrder,'repeated frames have stable slots');
});

test('surface grouping keeps descendant-joint face details together and follows host visibility',()=>{
 const p=fixture();p.joints.push(joint('face','root',0,-10));p.parts[1].joint='face';p.parts[1].spatial={surfaceOf:'body',depth:200,order:11};p.parts[0].spatial.facing='front';
 const front=spatialParts(p,frame(p,poseDefaults(p)));assert.equal(front.fragmentOrder.indexOf('marking'),front.fragmentOrder.indexOf('body')+1);
 const pose={...poseDefaults(p),'root.yaw':180},back=spatialParts(p,frame(p,pose));assert.equal(back.parts.get('body').visible,false);assert.equal(back.fragments.get('marking').visible,false);
});

test('a forearm decoration stays with its host forearm rather than the upper-arm slice',()=>{
 const p=fixture();p.parts.push({id:'forearm-mark',joint:'elbow',d:'M0-2H20V2H0Z',fill:'#345',spatial:{surfaceOf:'arm',depth:90}});
 const pose={...poseDefaults(p),'upper.z':-15,'upper.yaw':40,'elbow.yaw':-120},view=spatialParts(p,frame(p,pose));assert.equal(view.fragmentOrder.indexOf('forearm-mark'),view.fragmentOrder.indexOf('arm--forearm')+1);assert.equal(view.fragments.get('forearm-mark').depth,view.fragments.get('arm--forearm').depth);
});

test('standard Dummy markings and Ona clothing details name their real carrier surfaces',()=>{
 for(const name of ['dummy','ona']){
  const d=JSON.parse(fs.readFileSync(new URL('../examples/characters/'+name+'.json',import.meta.url),'utf8')),p=d.packs[name];addSpatialRig(p,name,{studies:false});if(name==='ona')addOnaArmJoints(p);
  const pose=poseDefaults(p),view=spatialParts(p,frame(p,pose));
  for(const part of p.parts.filter(part=>part.spatial?.surfaceOf)){assert.ok(p.parts.some(host=>host.id===part.spatial.surfaceOf));assert.equal(view.parts.get(part.id).depth,view.parts.get(part.spatial.surfaceOf).depth);}
  if(name==='dummy'){assert.equal(p.parts.find(p=>p.id==='chest-target').spatial.surfaceOf,'torso-shell');for(const part of p.parts.filter(p=>p.id.endsWith('-joint')))assert.equal(part.spatial.surfaceOf,part.joint+'-shell');const backPose={...pose,'root.yaw':180},back=spatialParts(p,frame(p,backPose));assert.ok(view.parts.get('rightLower-shell').depth>view.parts.get('torso-shell').depth);assert.ok(back.parts.get('rightLower-shell').depth<back.parts.get('torso-shell').depth,'rotating away puts the crossed arm behind the back');}
  else assert.ok(view.fragments.has('left-arm-volume--forearm'));
 }
});
