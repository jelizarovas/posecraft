import test from 'node:test';
import assert from 'node:assert/strict';
import {createGym,gymWalk} from '../examples/gym.js';
import {SceneController} from '../src/scene.js';
import {spatialKinematics} from '../src/spatial.js';
const setup=()=>{const doc=createGym(),controller=new SceneController(doc);return {doc,controller,pose(clip,time){const frame=controller.previewClip('atlas',clip,time),actor=frame.actors.find(a=>a.id==='atlas');return {frame,actor,world:spatialKinematics(doc.packs.atlas,actor.pose)};}};};
const point=(joint,x,y)=>({x:joint.x+joint.m[0]*x+joint.m[1]*y,y:joint.y+joint.m[3]*x+joint.m[4]*y});
test('free gym arms bend in depth outside the torso instead of folding inward',()=>{
 const q=setup();try{for(const [clip,time,side,sign]of [['jump-grab-left',1.8,'right',1],['jump-grab-right',1.8,'left',-1],['full-set',1,'left',-1],['full-set',1,'right',1]]){const {world:w,frame}=q.pose(clip,time);assert.ok((w[side+'Lower'].x-w[side+'Upper'].x)*sign>1,clip+' elbow folds inward');assert.ok(w[side+'Lower'].z-w[side+'Upper'].z>8,clip+' elbow needs depth');for(const c of frame.contacts.filter(c=>c.active))assert.ok(c.error<.1);}}finally{q.controller.dispose();}
});
test('gym knees gain depth while projected feet stay on their authored support',()=>{
 const q=setup();try{for(const [clip,time]of [['jump-grab-left',1.8],['jump-grab-right',1.8],['full-set',6.8]]){const {world:w}=q.pose(clip,time);for(const side of ['left','right']){const hip=w[side+'Thigh'],knee=w[side+'Calf'],foot=w[side+'Foot'];assert.ok(knee.z-hip.z>5,clip+' knee remains flat');assert.ok(Math.abs(knee.x-(hip.x+foot.x)/2)<15,clip+' knee splays sideways');}}
  const {world:w}=q.pose('full-set',31.2),walk=gymWalk(31.2,29,36,180,710);for(const side of ['left','right']){const hip=w[side+'Thigh'],knee=w[side+'Calf'],foot=w[side+'Foot'],depth=knee.z-hip.z;assert.ok(depth>0,'walking knee reverses its depth bend');if(!walk.feet[side].planted)assert.ok(depth>5,'swinging knee remains flat');else assert.ok(Math.hypot(foot.x-hip.x,foot.y-hip.y)>68,'support leg collapses under weight');assert.ok(Math.hypot(foot.x-walk.feet[side].x,foot.y-walk.feet[side].y)<1.5,'depth rotation moves support foot');}
 }finally{q.controller.dispose();}
});
test('reclining pelvis follows torso orientation and maintains the waistband seam',()=>{
 const q=setup();try{assert.equal(q.doc.packs.atlas.parts.find(p=>p.id==='shorts').joint,'pelvis');for(const t of [38,38.5,39,39.5,40,42,49,49.5,50,50.5,51]){const {world:w,actor}=q.pose('full-set',t);assert.ok(Math.abs(actor.pose['pelvis.rotation']-actor.pose['torso.rotation'])<.1);assert.ok(Math.abs(actor.pose['pelvis.yaw']-actor.pose['torso.yaw'])<.1);const waist=point(w.torso,0,42),band=point(w.pelvis,0,-10);assert.ok(Math.hypot(waist.x-band.x,waist.y-band.y)<5,`waist separates during recline at ${t}s`);}}finally{q.controller.dispose();}
});
