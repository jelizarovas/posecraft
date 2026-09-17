import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampfire} from '../examples/campfire.js';
import {createDemo} from '../examples/showcase.js';
import {SceneController} from '../src/scene.js';
import {spatialParts,softLimbPath} from '../src/spatial.js';
import {lightingConfig,partLighting,surfaceRamp} from '../src/lighting.js';
import {validateDocument} from '../src/schema.js';
test('hair and head share projection through front, profile and back turns',()=>{
 const d=createCampfire(),c=new SceneController(d),p=d.packs['camper-3'];
 for(const yaw of [-180,-135,-91,-90,-89,-45,0,45,89,90,91,135,180])for(const pitch of [-25,0,25]){c.previewClip('camper-3','campfire',0,{'root.yaw':yaw,'head.yaw':0,'head.pitch':pitch});const f=c.frame().actors.find(a=>a.id==='camper-3'),v=spatialParts(p,f);for(const id of ['hair-back','hair-front','hair-rear-cap'])assert.deepEqual(v.parts.get(id).matrix,v.parts.get('face-0').matrix);}
 c.dispose();
});
test('point light behind near campers does not illuminate their visible rear surface',()=>{
 const d=createCampfire(),c=new SceneController(d),a=d.actors.find(a=>a.id==='camper-3'),p=d.packs[a.pack];c.previewClip(a.id,'campfire',0,{'head.yaw':0,'head.pitch':0});const f=c.frame().actors.find(v=>v.id===a.id),v=spatialParts(p,f),part=p.parts.find(p=>p.id==='hair-rear-cap'),light=lightingConfig(d),back=partLighting(light,a,f,part,v),front=partLighting({...light,pointX:a.transform.x,pointY:a.groundY+150},a,f,part,v);assert.equal(back.intensity,0);assert.ok(front.intensity>0);assert.equal(new Set(surfaceRamp('#ceb16d',back)).size,1);assert.ok(new Set(surfaceRamp('#ceb16d',front)).size>1);c.dispose();
});
test('soft skin follows elbow and wrist turns while preserving the joint chain',()=>{
 const d=createCampfire(),c=new SceneController(d),p=d.packs['camper-0'],part=p.parts.find(p=>p.id==='take-skin');c.previewClip('camper-0','campfire',0,{});const f=c.frame().actors.find(a=>a.id==='camper-0'),baseline=softLimbPath(p,part,f.pose);
 for(const joint of ['take-upper','take-elbow','take-hand'])for(const channel of ['rotation','yaw','pitch']){const pose={...f.pose,[joint+'.'+channel]:(f.pose[joint+'.'+channel]||0)+45},skin=softLimbPath(p,part,pose);assert.notEqual(skin,baseline,joint+'.'+channel);assert.doesNotMatch(skin,/NaN|Infinity/);}
 for(const yaw of [-180,-90,0,90,180]){const pose={...f.pose,'root.yaw':yaw};assert.doesNotMatch(softLimbPath(p,part,pose),/NaN|Infinity/);}
 for(const patch of [{hand:'head'},{radius:0},{elbow:'missing'}]){const bad=structuredClone(d);Object.assign(bad.packs['camper-0'].parts.find(p=>p.id==='take-skin').spatial.softLimb,patch);assert.equal(validateDocument(bad).valid,false);}
 c.dispose();
});
test('Dummy feet face different directions and turn without moving the calves',()=>{
 const d=createDemo('turn-and-pose'),c=new SceneController(d),p=d.packs.dummy;const view=overrides=>{c.previewClip('dummy','idle',0,overrides);return spatialParts(p,c.frame().actors.find(a=>a.id==='dummy'));},rest=view({});assert.ok(rest.parts.get('leftFoot-shell').matrix[0]<0);assert.ok(rest.parts.get('rightFoot-shell').matrix[0]>0);
 for(const yaw of [-180,-90,0,90,180]){const v=view({'rightFoot.yaw':yaw});assert.deepEqual(v.parts.get('rightCalf-shell').matrix,rest.parts.get('rightCalf-shell').matrix);const m=v.parts.get('rightFoot-shell').matrix;assert.ok(Math.abs(m[0]*m[3]-m[1]*m[2])>.4);}
 c.dispose();
});
