import test from 'node:test';
import assert from 'node:assert/strict';
import {demoCatalog,createDemo} from '../examples/showcase.js';
import {assertDocument} from '../src/schema.js';
import {EpisodeController,assertEpisode,episodeDuration} from '../src/episode.js';
import {SceneController} from '../src/scene.js';
test('all nine demo projects round-trip, validate and sample finite constrained poses',()=>{
 assert.equal(demoCatalog.length,9);
 for(const entry of demoCatalog){const doc=JSON.parse(JSON.stringify(createDemo(entry.id))),episode=doc.kind==='episode';(episode?assertEpisode:assertDocument)(doc);const c=episode?new EpisodeController(doc):new SceneController(doc);for(const t of [0,.5,1,2,3,5,7,episode?episodeDuration(doc):8]){const f=episode?c.frame(t):c.step(.1),scene=episode?doc.scenes[f.scene]:doc;assert.ok(f.actors.length>=2);for(const a of f.actors)for(const j of scene.packs[scene.actors.find(v=>v.id===a.id).pack].joints){const v=a.pose[j.id+'.rotation'];assert.ok(Number.isFinite(v)&&v>=j.min-1e-8&&v<=j.max+1e-8,entry.id+' '+j.id);}}c.dispose?.();}
});
test('demo factories do not share mutable artwork or actor inputs',()=>{const a=createDemo('expression-ensemble');a.packs.ona.joints[0].rotation=123;a.actors[0].inputs.emotion='happy';const b=createDemo('expression-ensemble');assert.notEqual(b.packs.ona.joints[0].rotation,123);assert.equal(b.actors[0].inputs.emotion,'neutral');assert.throws(()=>createDemo('unknown'));});
test('drop lab characters hit collision props with distinct passive and protective behavior',()=>{
 const doc=createDemo('drop-lab'),c=new SceneController(doc),hits=new Set();
 for(const a of doc.actors){c.setBehavior(a.id,{mode:a.id==='loose'?'ragdoll':'protective',strategy:a.id==='brace'?'brace':'protect',gravity:1,resistance:.75});c.interact(a.id,'drop');}
 for(let i=0;i<600;i++){const f=c.step(1/120);for(const a of f.actors)for(const contact of a.physics?.contacts||[])if(contact.surface.startsWith('platform-'))hits.add(a.id);}
 assert.equal(hits.size,3);assert.equal(c.actors[0].behavior.mode,'ragdoll');assert.equal(c.actors[1].behavior.strategy,'protect');assert.equal(c.actors[2].behavior.strategy,'brace');c.dispose();
});
