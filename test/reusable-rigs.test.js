import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo,demoCatalog} from '../examples/showcase.js';
import {SceneController} from '../src/scene.js';
test('existing gallery Ona and Dummy packs use reusable depth artwork and scene folders',()=>{
 for(const entry of demoCatalog.filter(e=>e.kind!=='map'&&!['corner-shop','a-little-handoff','game-of-catch','campfire-night','gym-routine','ship-in-a-bottle','loveseat-stairs'].includes(e.id))){const doc=createDemo(entry.id);for(const scene of doc.kind==='episode'?Object.values(doc.scenes):[doc]){assert.ok(scene.groups.length>=2);assert.ok(scene.lighting.enabled);for(const [id,p] of Object.entries(scene.packs)){if(!['ona','dummy'].includes(id))continue;assert.ok(p.spatial,entry.id+' '+id);if(id==='ona'){assert.ok(p.parts.some(part=>part.spatial?.hairShell));assert.ok(p.joints.some(j=>j.id==='rightWrist'));assert.ok(p.parts.some(part=>part.spatial?.softLimb));}else assert.ok(p.clips.idle.tracks['leftFoot.yaw']);}}}
});
test('explicit scene seek samples animation with paused playback and reduced motion, then restores policy',()=>{
 const doc=createDemo('gym-routine'),reference=new SceneController(doc),c=new SceneController(doc,{reducedMotion:true});
 try{const initial=reference.frame().actors.find(a=>a.id==='atlas').pose,expected=reference.seek(2).actors.find(a=>a.id==='atlas').pose;c.animationPlaying=false;c.pause();const f=c.seek(2),p=f.actors.find(a=>a.id==='atlas').pose;assert.deepEqual(p,expected);assert.notEqual(p['root.y'],initial['root.y']);assert.equal(c.reducedMotion,true);assert.equal(c.animationPlaying,false);assert.equal(c.playing,false);assert.equal(c.step(.1).time,f.time);}finally{reference.dispose();c.dispose();}
});
