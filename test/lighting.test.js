import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemo} from '../examples/showcase.js';
import {SceneController} from '../src/scene.js';
import {spatialParts} from '../src/spatial.js';
import {renderSVG} from '../src/svg.js';
import {validateDocument} from '../src/schema.js';
import {lightingConfig,surfaceRamp,surfaceFocus,shadowProjection,contactShadow} from '../src/lighting.js';
test('lighting is opt-in and scene data round-trips with bounded values',()=>{
 const doc=createDemo('light-and-shade');assert.ok(validateDocument(JSON.parse(JSON.stringify(doc))).valid);
 for(const [key,value] of [['angle',181],['elevation',0],['softness',17],['reflection',1],['enabled','yes'],['shading','unknown'],['color','url(https://example.com)'],['shadowColor','#fff']]){const d=structuredClone(doc);d.lighting[key]=value;assert.equal(validateDocument(d).valid,false,key);}
 const c=new SceneController(doc),f=c.frame();assert.match(renderSVG(doc,f),/data-floor-shadow/);doc.lighting.enabled=false;const flat=renderSVG(doc,f);assert.doesNotMatch(flat,/data-surface|data-reflection|data-light-effects|feGaussianBlur/);delete doc.lighting;assert.equal(lightingConfig(doc).enabled,false);assert.equal(lightingConfig(doc).shading,'gradient');c.dispose();
});
test('surface ramps preserve detail, tint colors, and compensate mirrored joint transforms',()=>{
 const l=lightingConfig(createDemo('light-and-shade'));assert.equal(surfaceRamp('none',l),null);assert.equal(surfaceRamp('#111111',l),null);assert.equal(surfaceRamp('#abcd',l),null);assert.equal(surfaceRamp('#fff',l).length,3);
 assert.notDeepEqual(surfaceRamp('#ddaa55',l),surfaceRamp('#ddaa55',{...l,color:'#88bbff'}));
 const a=surfaceFocus(l),b=surfaceFocus(l,0,'scale(-1 1)'),c=surfaceFocus(l,180);assert.ok(Math.abs(a.cx+b.cx-1)<1e-9);assert.ok(Math.abs(a.cy+b.cy-2*a.cy)<1e-9);assert.ok(Math.abs(a.cx+c.cx-1)<1e-9);
});
test('cast projection anchors the ground and contact shadow fades during a jump',()=>{
 const doc=createDemo('light-and-shade'),l=lightingConfig(doc),controller=new SceneController(doc),actor=doc.actors[0],pack=doc.packs[actor.pack],f=controller.frame().actors[0];
 const numbers=shadowProjection(l).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number),[a,b,c,d,e,g]=numbers;
 assert.ok(Math.abs(a*123+c*l.floorY+e-123)<1e-9);assert.ok(Math.abs(b*123+d*l.floorY+g-l.floorY)<1e-9);
 const ground=contactShadow(actor,pack,f,l),jump=structuredClone(f);for(const j of Object.values(jump.world))j.y-=60;
 const lifted=contactShadow(actor,pack,jump,l);assert.ok(lifted.opacity<ground.opacity*.4);assert.ok(lifted.rx>ground.rx);assert.equal(lifted.cx,ground.cx);controller.dispose();
});
test('silhouette instances share live artwork, have unique IDs and follow camera placement',()=>{
 const doc=createDemo('light-and-shade'),c=new SceneController(doc),f=c.frame();f.actors[0].placement={x:321,y:222,rotation:20,scale:1.3};f.camera={x:400,y:225,width:800,height:450,zoom:1.2,rotation:0};
 const svg=renderSVG(doc,f),other=renderSVG(doc,f),ids=[...svg.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(ids.length,new Set(ids).size);
 for(const id of ids)assert.ok(!other.includes(`id="${id}"`));for(const href of svg.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(href[1]));
 assert.match(svg,/data-reflection/);assert.match(svg,/translate\(0 730\) scale\(1 -1\)/);assert.match(svg,/data-light-placement="" href="[^"]+" transform="translate\(321 222\) rotate\(20\) scale\(1.3\)"/);assert.ok(svg.indexOf('data-camera')<svg.indexOf('data-light-effects'));c.dispose();
});

test('exported shading stays scene-facing across yaw, pitch, mirrored art and actor rotation',()=>{
 const doc=createDemo('light-and-shade'),actor=doc.actors.find(a=>a.id==='dummy'),pack=doc.packs.dummy,part=pack.parts.find(p=>p.id==='head-shell'),controller=new SceneController(doc);
 for(const yaw of [-180,-91,-90,-89,0,89,90,91,180])for(const pitch of [-35,0,35])for(const mirror of [-1,1]){
  part.transform=`scale(${mirror} 1)`;controller.previewClip(actor.id,'idle',0,{'root.yaw':yaw,'head.pitch':pitch,'head.rotation':15});const frame=controller.frame(),evaluated=frame.actors.find(a=>a.id===actor.id);evaluated.placement={...actor.transform,rotation:27};
  const svg=renderSVG(doc,frame),tag=svg.match(/<radialGradient data-surface="head-shell"[^>]+>/)[0],x=Number(tag.match(/cx="([^"]+)"/)[1])-.5,y=Number(tag.match(/cy="([^"]+)"/)[1])-.5,m=spatialParts(pack,evaluated).parts.get(part.id).matrix,r=27*Math.PI/180;
  const dx=m[0]*x*mirror+m[2]*y,dy=m[1]*x*mirror+m[3]*y,wx=Math.cos(r)*dx-Math.sin(r)*dy,wy=Math.sin(r)*dx+Math.cos(r)*dy;
  assert.ok(wx<0&&wy<0,`Scene light direction at ${yaw}/${pitch}/${mirror}`);assert.ok(Math.abs(wx-wy)<1e-5,'Projected focus points toward the fixed diagonal light');
 }
 controller.dispose();
});
