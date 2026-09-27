import assert from 'node:assert/strict';
import test from 'node:test';
import {createWwwzardContactScene} from '../examples/wwwzard-contact.js';
import {windowPoint} from '../examples/wwwzard-window.js';
import {assertDocument,IllustrationController} from '@posecraft/runtime';
import {applyMotionLayers,ActorBehaviorRuntime} from '@posecraft/runtime/features';
test('plane grip, release, and aperture crossing stay coherent in saved channels',()=>{
 const scene=createWwwzardContactScene();assertDocument(scene);
 const hero=scene.packs.wwzard,plane=scene.packs.plane;
 assert.equal(hero.clips.prepare.duration,1.5);assert.equal(hero.clips['prepare-windy'].duration,1.5);
 for(const part of hero.parts) assert.ok((part.spatial?.morph?.layers?.length??0)<=8,part.id);
 const planeDepth=scene.actors.find(a=>a.id==='plane').depth.value;
 assert.ok(planeDepth<hero.parts.find(p=>p.id==='right-hand').spatial.sceneDepth.value);
 assert.equal(hero.clips.prepared.tracks['rightHand.y'][0][1],-41);
 assert.equal(hero.clips.prepared.tracks['paperReach.bend'][0][1],.6);
 const at=(track,time)=>track.find(p=>p[0]===time)?.[1];
 const aperture=windowPoint(365,160);
 assert.ok(Math.abs(at(plane.clips.throw.tracks['root.x'],.72)+plane.joints[0].x-aperture[0])<.001);
 assert.ok(Math.abs(at(plane.clips.throw.tracks['root.y'],.72)+plane.joints[0].y-aperture[1])<.001);
 assert.ok(at(plane.clips.throw.tracks['root.bend'],.72)>=.65,'plane recedes before entering the distant opening');
 assert.equal(at(plane.clips.throw.tracks['root.opacity'],.82),1);
 assert.equal(at(plane.clips.throw.tracks['root.opacity'],1.4),0);
 const controller=new IllustrationController(scene,{motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
 for(const [clip,other]of[['prepare','prepare'],['prepared','hold'],['sending','throw']]){
  for(let t=0;t<=hero.clips[clip].duration;t+=.04){controller.previewClip('wwzard',clip,t);controller.previewClip('plane',other,t);assert.ok(controller.frame());}
 }
 controller.dispose();
});
