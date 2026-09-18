import test from 'node:test';
import assert from 'node:assert/strict';
import {gymBenchTransitionTargets} from '../examples/gym-bench-transition.js';
import {createGym,gymPose} from '../examples/gym.js';
import {spatialKinematics} from '../src/spatial.js';
import {SceneController} from '../src/scene.js';

test('bench setup moves one foot at a time, then keeps feet and bracing palms planted',()=>{
 for(let t=36;t<=41;t+=1/120){const q=gymBenchTransitionTargets(t);assert.ok(Object.values(q.feet).some(p=>p.planted),'both feet leave the floor');for(const name of ['left','right']){const p=q.feet[name],h=q.hips[name],s=q.shoulders[name],hand=q.hands[name];assert.ok(Math.hypot(p.x-q.root.x-h.x,p.y-q.root.y-h.y)<=71.941,'leg target exceeds reach');assert.ok(Math.hypot(hand.x-q.root.x-s.x,hand.y-q.root.y-s.y)<79.94,'palm target exceeds reach');}}
 const seated=gymBenchTransitionTargets(38);for(const t of [38.25,38.8,39.4,40]){const q=gymBenchTransitionTargets(t);for(const name of ['left','right']){assert.deepEqual(q.feet[name],seated.feet[name]);assert.deepEqual(q.hands[name],seated.braces[name]);}}
 for(const [setup,rise]of [[40,49],[39.5,49.5],[39,50],[38,51]]){const a=gymBenchTransitionTargets(setup),b=gymBenchTransitionTargets(rise);assert.deepEqual(a,b);}
});

test('portable and live bench setup retain subpixel palm supports after key reduction',()=>{
 const d=createGym();assert.ok(d.contacts.length<=64);assert.equal(d.contacts.filter(c=>c.id.includes('bench-brace')).length,16);d.behaviorGraph.initial='bench-setup';const controller=new SceneController(d);
 try{
  for(const clip of ['full-set','workout','fail-six','fail-seven'])for(const t of [38,38.8,39.4,40,49,50.2,51,...(clip==='workout'?[98.8,158.8]:[])]){const f=controller.previewClip('atlas',clip,t),active=f.contacts.filter(c=>c.active&&c.id.includes('bench-brace'));assert.equal(active.length,2);for(const c of active)assert.ok(c.error<.15,`${clip} ${t}s: palm misses support by ${c.error}`);}
  controller.clearPreview('atlas');let supported=0;for(let i=0;i<50;i++){const f=controller.step(.1);for(const c of f.contacts.filter(c=>c.active&&c.id.includes('bench-brace'))){assert.ok(c.error<.15);supported++;}}assert.ok(supported>=20,'live setup never bears weight on the pad');
 }finally{controller.dispose();}
});

test('authored bench setup keeps contacts on support and avoids discontinuous joint turns',()=>{
 const pack=createGym().packs.atlas;for(const [start,end]of [[36,41],[48,52.5]]){let previous;
 for(let t=start;t<=end+1e-7;t+=1/120){const pose=gymPose(t,'full-set'),q=gymBenchTransitionTargets(t),w=spatialKinematics(pack,pose);for(const value of Object.values(pose))assert.ok(Number.isFinite(value));for(const name of ['left','right']){if(t>start+.001&&t<end-.001){const expected=q.feet[name],actual=w[name+'Foot'];assert.ok(Math.hypot(actual.x-expected.x,actual.y-expected.y)<.002,'ankle leaves its authored floor point');}if(q.s>=2&&q.s<=4){const hand=w[name+'Hand'];assert.ok(Math.hypot(hand.x-q.braces[name].x,hand.y-q.braces[name].y)<.002,'supporting palm slips');}if(previous)for(const joint of ['Upper','Lower','Hand','Thigh','Calf','Foot']){const a=w[name+joint],b=previous[name+joint];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)<4,`${name}${joint} jumps at ${t}`);}}
  previous=w;
 }}
});
