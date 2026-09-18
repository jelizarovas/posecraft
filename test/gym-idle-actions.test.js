import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymPose,gymTravelPose} from '../examples/gym.js';
import {installGymIdleActions,gymIdleReviews,gymWaterReviews,gymBottleLocations} from '../examples/gym-idle-actions.js';
import {gymRoomStations} from '../examples/gym-room.js';
import {sampleClip} from '../src/index.js';
import {spatialKinematics} from '../src/spatial.js';
import {assertDocument} from '../src/schema.js';
import {BehaviorRuntime} from '../src/behaviors.js';
function makeClip(duration,sampler){const tracks={};for(let i=0;i<=Math.ceil(duration*30);i++){const t=Math.min(duration,i/30);for(const [key,value]of Object.entries(sampler(t)))(tracks[key]??=[]).push([t,value,'linear']);}for(const [key,keys]of Object.entries(tracks)){const keep=new Set([0,keys.length-1]);function visit(a,b){let worst=.01,index=-1;for(let i=a+1;i<b;i++){const q=(keys[i][0]-keys[a][0])/(keys[b][0]-keys[a][0]),error=Math.abs(keys[i][1]-keys[a][1]-(keys[b][1]-keys[a][1])*q);if(error>worst){worst=error;index=i;}}if(index>=0){keep.add(index);visit(a,index);visit(index,b);}}visit(0,keys.length-1);tracks[key]=[...keep].sort((a,b)=>a-b).map(i=>keys[i]);}return {duration,loop:false,tracks};}
function fixture(){const doc=createGym();let metadata;const installed=!!doc.packs.atlas.clips['window-look-bar'];installGymIdleActions(installed?structuredClone(doc):doc,{poseAt:gymPose,makeClip:installed?(duration=>({duration,loop:false,tracks:{}})):makeClip,walkPose:gymTravelPose,stations:gymRoomStations,onInstalled:v=>metadata=v.metadata});assertDocument(doc);return {doc,metadata};}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('idle actions are editable, bounded and return to their documented body endpoints',()=>{
 const {doc,metadata}=fixture(),pack=doc.packs.atlas;
 for(const {clip:id}of gymIdleReviews){const clip=pack.clips[id],m=metadata[id];assert.ok(clip&&!clip.loop);for(const [t,source]of [[0,m.startPose],[clip.duration,m.endPose]]){const pose=sampleClip(clip,t),expected=gymPose(source,'full-set');for(const [key,value]of Object.entries(expected))if(!key.startsWith('water-bottle.'))assert.ok(Math.abs((pose[key]||0)-value)<1e-5,`${id}/${t}/${key}`);}for(let t=0;t<=clip.duration;t+=.1){const p=sampleClip(clip,t);for(const value of Object.values(p))assert.ok(Number.isFinite(value));for(const j of Object.values(spatialKinematics(pack,p)))assert.ok([j.x,j.y,j.z,...j.m].every(Number.isFinite));}for(const keys of Object.values(clip.tracks))assert.ok(keys.length<=1000);}
});
test('one bottle travels between supported locations with continuous hand contact',()=>{
 const {doc,metadata}=fixture(),pack=doc.packs.atlas;
 for(const spec of gymWaterReviews){const clip=pack.clips[spec.clip],m=metadata[spec.clip],source=gymBottleLocations[spec.source].point,destination=gymBottleLocations[spec.destination].point;
  for(const [time,point]of [[0,source],[m.arrive,source],[m.pickup-.001,source],[m.replace+.001,destination],[m.depart,destination],[clip.duration,destination]]){const w=spatialKinematics(pack,sampleClip(clip,time));assert.ok(distance(w['water-bottle'],point)<.3,`${spec.id} anchored at ${time}`);}
  for(let time=m.pickup;time<=m.replace;time+=.05){const p=sampleClip(clip,time),w=spatialKinematics(pack,p),b=w['water-bottle'],grip={x:b.x+b.m[0]*8,y:b.y+b.m[3]*8};assert.ok(distance(grip,w.rightHand)<.9,`${spec.id} bottle hand contact at ${time}: ${distance(grip,w.rightHand)}`);assert.equal(p['water-bottle.opacity'],1);}
  for(const boundary of [m.pickup,m.replace]){const a=spatialKinematics(pack,sampleClip(clip,boundary-.001))['water-bottle'],b=spatialKinematics(pack,sampleClip(clip,boundary+.001))['water-bottle'];assert.ok(distance(a,b)<.4,'no ownership-switch jump');}
 }
 const search=metadata['drink-from-1-to-2-bar'];assert.equal(search.search,true);assert.ok(search.searchEnd-search.searchStart>=1.79);
});
test('excursions travel in depth and seated recovery holds the bench before rising',()=>{
 const {doc,metadata}=fixture(),pack=doc.packs.atlas;
 for(const kind of ['window-look','mirror-flex'])for(const place of ['bar','bench']){const id=kind+'-'+place,m=metadata[id],p=sampleClip(pack.clips[id],m.arrive+.1),home=gymPose(m.startPose,'full-set');assert.ok(Math.abs(p['root.y']-home['root.y'])>25,id+' depth travel');assert.ok(Math.abs(p['root.x']-m.station.x)<.2);}
 const seated=spatialKinematics(pack,sampleClip(pack.clips['rack-contemplate-rise'],4)),base=spatialKinematics(pack,gymPose(51,'full-set'));assert.ok(distance(seated.root,base.root)<.01);for(const side of ['left','right'])assert.ok(distance(seated[side+'Foot'],base[side+'Foot'])<.01);
});
test('rest effects occur once on completion and variants have authored weights',()=>{
 const {doc}=fixture();for(const where of ['bar','bench']){const g=structuredClone(doc);g.behaviorGraph.initial='isolated';g.behaviorGraph.states.isolated={actions:[{type:'perform',activity:'idle-'+where}]};g.behaviorGraph.edges=[];g.behaviorGraph.variables.fatigue=50;const runtime=new BehaviorRuntime(g);assert.equal(runtime.variables.fatigue,50);const variants=g.behaviorGraph.activities['idle-'+where].variants;assert.deepEqual(variants.map(v=>v.weight),[3,1,1]);for(let i=0;i<500;i++)runtime.tick(.1);assert.equal(runtime.variables.fatigue,40);for(let i=0;i<100;i++)runtime.tick(.1);assert.equal(runtime.variables.fatigue,40);}
 assert.equal(doc.behaviorGraph.activities['rack-and-rise'].variants.filter(v=>v.id==='rack-contemplate-rise').length,1);
});
