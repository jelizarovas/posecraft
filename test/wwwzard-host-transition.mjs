import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from '@playwright/test';
import {createIllustrationController,assertDocument,renderSVG} from '@posecraft/runtime';
import {applyMotionLayers,ActorBehaviorRuntime} from '@posecraft/runtime/features';
import {createWwwzardHomeScene} from '../examples/wwwzard-home.js';
import {createWwwzardStoriesScene} from '../examples/wwwzard-stories.js';
import {createWwwzardProjectsScene} from '../examples/wwwzard-projects.js';
import {createWwwzardContactScene} from '../examples/wwwzard-contact.js';

const scenes=[createWwwzardHomeScene(),createWwwzardStoriesScene(),createWwwzardProjectsScene(),createWwwzardContactScene()].map(assertDocument);
const out='test-results/wwwzard-host-transition';await fs.mkdir(out,{recursive:true});
const step=(c,seconds)=>{for(let i=0;i<Math.round(seconds*120);i++)c.step(1/120);};
const browser=await chromium.launch({channel:'msedge',headless:true}),reports=[];
try{
  const page=await browser.newPage({viewport:{width:1200,height:720}});
  for(const scene of scenes){
    const bytes=gzipSync(JSON.stringify(scene)).length;assert(bytes<30*1024);
    const p=createIllustrationController(JSON.parse(JSON.stringify(scene)),{motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime});
    for(const phase of ['depart','arrive'])for(const direction of [-1,1]){
      const baseline=p.frame();
      for(const progress of [0,1]){p.setHostTransition({phase,direction,progress});assert.deepEqual(p.frame().actors.map(a=>a.pose),baseline.actors.map(a=>a.pose));}
      p.setHostTransition({phase,direction,progress:.5});
      for(const actor of p.frame().actors.filter(a=>a.id!=='wwzard')){
        const before=baseline.actors.find(a=>a.id===actor.id);
        if(actor.id==='room')assert.deepEqual(Object.fromEntries(Object.entries(actor.pose).filter(([key])=>key!=='hostPlant.rotation')),Object.fromEntries(Object.entries(before.pose).filter(([key])=>key!=='hostPlant.rotation')),'Only foliage may move in the room');
        else if(actor.id==='book')for(const key of ['root.x','root.y','root.rotation'])assert.equal(actor.pose[key],before.pose[key]);
        else assert.deepEqual(actor.pose,before.pose,'Furniture/props must remain anchored');
      }
      p.clearHostTransition();assert.deepEqual(p.frame().actors.map(a=>a.pose),baseline.actors.map(a=>a.pose));
      if(phase==='arrive'){
        p.setHostTransition({phase,direction,progress:.45});const lag=p.frame(),lagSVG=renderSVG(scene,lag);
        p.setHostTransition({phase,direction,progress:.75});const stop=p.frame(),stopSVG=renderSVG(scene,stop);
        const wizard=frame=>frame.actors.find(a=>a.id==='wwzard');
        assert.notEqual(wizard(lag).pose['hostBody.bend'],wizard(stop).pose['hostBody.bend'],'Torso changes direction when travel stops');
        const hands=frame=>Object.fromEntries(Object.entries(wizard(frame).pose).filter(([key])=>/^(leftHand|rightHand|pageHand)\./.test(key)));
        assert.deepEqual(hands(lag),hands(stop),'Body recoil must preserve wrist contacts');
        const robe=svg=>svg.match(/<path[^>]*data-source-part="robe-body"[^>]*>/)?.[0];
        assert(robe(lagSVG)&&robe(stopSVG),'Rendered robe is present');
        assert.notEqual(robe(lagSVG),robe(stopSVG),'Visible body contour must lean, not only the head');
        if(scene.packs.room){
          const room=frame=>frame.actors.find(a=>a.id==='room');
          assert(Math.sign(room(lag).pose['hostPlant.rotation'])!==Math.sign(room(stop).pose['hostPlant.rotation']),'Foliage reverses after stopping');
          for(const part of scene.packs.room.parts.filter(part=>/^(pot-|window-)/.test(part.id)))assert.equal(part.joint,'root','Plant inertia leaves furniture attached to stationary room root');
        }
        p.clearHostTransition();
      }
      const pictures=[];
      for(const progress of [0,.12,.25,.5,.68,.75,.86,.94,1]){
        p.setHostTransition({phase,direction,progress});pictures.push({progress,svg:renderSVG(scene,p.frame())});
      }
      p.clearHostTransition();
      await page.setContent(`<style>body{margin:0;background:#fff;font:12px system-ui;color:#574667}main{display:grid;grid-template-columns:repeat(4,300px)}figure{margin:0}svg{width:300px;height:310px}figcaption{padding:6px 12px}</style><main>${pictures.map(({progress,svg},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${scene.id} ${phase} ${direction} · ${progress}</figcaption></figure>`).join('')}</main>`);
      await page.screenshot({path:`${out}/${scene.id}-${phase}-${direction}.png`,fullPage:true});
    }
    const reduced=createIllustrationController(scene,{reducedMotion:true,motionLayerSolver:applyMotionLayers,actorBehaviorFactory:ActorBehaviorRuntime}),before=reduced.frame();reduced.setHostTransition({phase:'depart',direction:1,progress:.5});assert.deepEqual(reduced.frame().actors.map(a=>a.pose),before.actors.map(a=>a.pose));reduced.dispose();
    if(scene.id==='wwwzard-contact'){
      p.dispatch('almost-done');step(p,1.7);const before=p.frame();p.setHostTransition({phase:'depart',direction:-1,progress:.5});const after=p.frame();
      const right=frame=>Object.fromEntries(Object.entries(frame.actors.find(a=>a.id==='wwzard').pose).filter(([key])=>key.startsWith('right')));
      assert.deepEqual(right(after),right(before));
      assert.deepEqual(after.actors.find(a=>a.id==='plane').pose,before.actors.find(a=>a.id==='plane').pose);
      p.clearHostTransition();
    }
    if(['wwzard-desk','wwwzard-contact'].includes(scene.id)){
      const label=scene.id==='wwzard-desk'?'closed-laptop':'held-plane';
      if(label==='closed-laptop'){
        p.dispatch('close-laptop');for(let i=0;i<1800&&p.frame().behavior.state!=='closedIdle';i++)p.step(1/120);
        assert.equal(p.frame().behavior.state,'closedIdle');
      }
      const baseline=p.frame(),pictures=[];
      for(const direction of [-1,1])for(const phase of ['depart','arrive'])for(const progress of [0,.25,.5,.75,.88,1]){
        p.setHostTransition({phase,direction,progress});const frame=p.frame();
        const prop=label==='closed-laptop'?'screen':'plane';
        assert.deepEqual(frame.actors.find(a=>a.id===prop).pose,baseline.actors.find(a=>a.id===prop).pose);
        pictures.push({label:`${label} ${phase} ${direction} ${progress}`,svg:renderSVG(scene,frame)});
      }
      await page.setContent(`<style>body{margin:0;background:white;font:12px system-ui}main{display:grid;grid-template-columns:repeat(4,300px)}figure{margin:0}svg{width:300px;height:310px}figcaption{padding:6px}</style><main>${pictures.map(({label,svg},i)=>`<figure>${svg.replaceAll(/id="([^"]+)"/g,(_,id)=>`id="${i}-${id}"`).replaceAll(/url\(#([^)]*)\)/g,(_,id)=>`url(#${i}-${id})`).replaceAll(/href="#([^"]+)"/g,(_,id)=>`href="#${i}-${id}"`)}<figcaption>${label}</figcaption></figure>`).join('')}</main>`);
      await page.screenshot({path:`${out}/${label}.png`,fullPage:true});p.clearHostTransition();
    }
    p.dispose();reports.push({scene:scene.id,gzipBytes:bytes,endpointsRestore:true,propsAnchored:true,reducedMotion:true});
  }
}finally{await browser.close();}
await fs.writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));
