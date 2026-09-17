import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../examples/showcase.js';
import {SceneController} from '../src/scene.js';
import {assertDocument} from '../src/schema.js';
import {spatialParts,spatialKinematics,morphPath} from '../src/spatial.js';
import {renderSVG} from '../src/svg.js';
import {EpisodeController} from '../src/episode.js';
const doc=()=>createDemo('turn-and-pose');
function view(d,id,overrides){const c=new SceneController(d);c.previewClip(id,'idle',0,overrides);const f=c.frame().actors.find(a=>a.id===id);return {f,v:spatialParts(d.packs[id],f)};}
test('turning preserves head volume at profile, hides the far eye and exposes back artwork',()=>{
 const d=doc(),front=view(d,'ona',{'root.yaw':0}),profile=view(d,'ona',{'root.yaw':90}),back=view(d,'ona',{'root.yaw':180});
 assert.ok(front.v.parts.get('face-2').visible&&front.v.parts.get('face-3').visible);assert.ok(profile.v.parts.get('face-2').visible);assert.equal(profile.v.parts.get('face-3').visible,false);assert.equal(back.v.parts.get('face-2').visible,false);assert.ok(back.v.parts.get('shirt-back-seam').visible);
 const m=profile.v.parts.get('face-0').matrix;assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2])>.5,'Head volume must not collapse to a line');assert.equal(front.v.parts.get('shirt-back-seam').visible,false);
});
test('limb depth changes drawing order and a tucked knee projects toward the camera',()=>{
 const d=doc(),behind=view(d,'ona',{'rightArm.z':-30}),ahead=view(d,'ona',{'rightArm.z':30});assert.equal(behind.v.world.rightArm.x,ahead.v.world.rightArm.x);assert.equal(behind.v.world.rightArm.y,ahead.v.world.rightArm.y);const i=(v,id)=>v.order.indexOf(id);assert.ok(i(behind.v,'right-arm-volume')<i(behind.v,'shirt-0'));assert.ok(i(ahead.v,'right-arm-volume')>i(ahead.v,'shirt-0'));
 const rest=view(d,'dummy',{}),tuck=view(d,'dummy',{'rightThigh.yaw':-100,'rightCalf.yaw':130});assert.ok(tuck.v.world.rightCalf.z>30);assert.ok(tuck.v.world.rightCalf.y<rest.v.world.rightCalf.y-30);assert.ok(i(tuck.v,'rightThigh-shell')>i(tuck.v,'root-shell'));
});
test('shape morphs interpolate coordinates without changing path topology or source data',()=>{
 const d=doc(),p=d.packs.ona.parts.find(p=>p.id==='right-arm-volume'),source=p.d;assert.equal(morphPath(p,0),morphPath(p,-1));assert.equal(morphPath(p,1),morphPath(p,2));assert.notEqual(morphPath(p,.5),morphPath(p,0));assert.equal(p.d,source);
});
test('spatial clips survive JSON, seek and the episode pipeline',()=>{
 const d=JSON.parse(JSON.stringify(doc())),c=new SceneController(d);assertDocument(d);c.previewClip('ona','turnaround',3);const f=c.frame().actors[0];assert.equal(f.pose['root.yaw'],180);const svg=renderSVG(d,c.frame());assert.match(svg,/<clipPath/);assert.match(svg,/data-slot="shirt-back-seam"/);
 const base=createDemo('www-after-hours'),project={...base,scenes:{study:d},shots:[{...base.shots[0],scene:'study',actors:{ona:{clip:'glance',offset:0,speed:1,pose:{'root.yaw':[[0,45],[4,135]],'rightArm.bend':[[0,0],[4,1]]}}}}]};const e=new EpisodeController(project);assert.equal(e.frame(2).actors[0].pose['root.yaw'],90);assert.equal(e.frame(2).actors[0].pose['rightArm.bend'],.5);assert.deepEqual(e.frame(2),new EpisodeController(project).frame(2));
});
test('bad spatial imports reject invalid masks, morph geometry and out-of-range keys',()=>{
 for(const corrupt of [d=>d.packs.ona.parts[0].spatial.mask='missing',d=>d.packs.ona.clips.glance.tracks['head.pitch']=[[0,100]],d=>d.packs.ona.parts.find(p=>p.spatial.morph).spatial.morph.target='M0 0<script>',d=>d.packs.ona.parts[0].spatial.surface={x:10,width:1,depth:20},d=>{const p=d.packs.ona.parts.find(p=>p.spatial.morph);p.d='Z';p.spatial.morph.target='Z';}]){const d=doc();corrupt(d);assert.throws(()=>assertDocument(d));}
});
test('all study clips have finite projection across their entire duration',()=>{
 const d=doc(),c=new SceneController(d);for(const id of ['ona','dummy'])for(const clip of ['turnaround','glance','reach-depth','tuck-jump'])for(let t=0;t<d.packs[id].clips[clip].duration;t+=.1){c.previewClip(id,clip,t);const f=c.frame().actors.find(a=>a.id===id),v=spatialParts(d.packs[id],f);for(const part of v.parts.values())assert.ok(part.matrix.every(Number.isFinite));}
});
