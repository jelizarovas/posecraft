import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampfire,campPhase} from '../examples/campfire.js';
import {SceneController} from '../src/scene.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {renderSVG} from '../src/svg.js';
import {lightingConfig,sampleLighting,lightAt,shadowVectors,shadowProjection,wallProjection,surfaceRamp,surfaceStopValues} from '../src/lighting.js';
test('floor and wall projections meet at the same corner point',()=>{
 const l=lightingConfig({bounds:{width:800,height:450},lighting:{enabled:true,floorY:365,wallY:300}});
 for(const angle of [-160,-135,-90,-45,-20]){l.angle=angle;const v=shadowVectors(l),height=(l.floorY-l.wallY)/-v.y,source={x:250,y:l.floorY-height};
  const [a,b,c,d,e,f]=shadowProjection(l).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number),[wx,wy]=wallProjection(l).match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/gi).map(Number);
  assert.ok(Math.abs(a*source.x+c*source.y+e-source.x-wx)<1e-8);assert.ok(Math.abs(b*source.x+d*source.y+f-l.wallY)<1e-8);assert.ok(Math.abs(source.y+wy-l.wallY)<1e-8);
 }
 assert.equal(wallProjection({...l,receiver:'floor'}),null);assert.equal(wallProjection({...l,angle:90}),null);
});
test('point light position controls bearing, falloff and deterministic flicker',()=>{
 const l=lightingConfig(createCampfire());assert.ok(lightAt(l,200,315).angle===0);assert.ok(Math.abs(lightAt(l,600,315).angle)===180);assert.ok(lightAt(l,390,315).intensity>lightAt(l,20,315).intensity);
 assert.notEqual(sampleLighting(l,1).intensity,sampleLighting(l,1.5).intensity);assert.deepEqual(sampleLighting(l,1),sampleLighting(l,1));
 const moving={...l,motion:'orbit'};assert.notEqual(sampleLighting(moving,0).pointX,sampleLighting(moving,2).pointX);
 const left=shadowVectors(l,{x:200}),right=shadowVectors(l,{x:600});assert.ok(left.x<0&&right.x>0);
});
test('cel width and contrast are independent and reject invalid scene options',()=>{
 const doc=createCampfire(),l=lightingConfig(doc),ramp=surfaceRamp('#eecc88',l),thin=surfaceStopValues(ramp,{...l,celThickness:.1}),thick=surfaceStopValues(ramp,{...l,celThickness:.8});assert.ok(thin[1][0]>thick[1][0]);
 const flat=surfaceStopValues(ramp,{...l,celIntensity:0});assert.equal(flat[0][1],flat[2][1]);const noShadow=surfaceStopValues(ramp,{...l,celThickness:0});assert.equal(noShadow[0][1],noShadow[2][1]);
 for(const [key,value] of [['celThickness',2],['celIntensity',-1],['pointHeight',0],['pointX',Infinity],['type','sunset'],['motion','random-code'],['receiver','ceiling'],['showSource','yes']]){const bad=structuredClone(doc);bad.lighting[key]=value;assert.equal(validateDocument(bad).valid,false,key);}
});
test('campfire exports all four looks, cooking phases and layered scenery as scene data',()=>{
 const d=assertDocument(JSON.parse(JSON.stringify(createCampfire()))),campers=d.actors.filter(a=>!a.layer);assert.equal(campers.length,4);assert.equal(new Set(campers.map(a=>a.inputs.hair)).size,4);assert.equal(new Set(campers.map(a=>a.appearance.clothing)).size,4);assert.equal(new Set(campers.map(a=>a.appearance.eyes)).size,4);
 const c=new SceneController(d),sample=t=>{for(const a of d.actors){const p=d.packs[a.pack],clip=p.states[p.initial].clip;c.previewClip(a.id,clip,t%p.clips[clip].duration,{});}return {...c.frame(),time:t};};
 for(let i=0;i<4;i++){const actor=campers[i],at=phase=>sample((phase-i*5+24)%24).actors.find(a=>a.id===actor.id);assert.equal(campPhase((13-i*5+24)%24,i),'burning');assert.ok(at(13).pose['snack-flame.opacity']>0);assert.equal(at(19.5).pose['food.opacity'],0);assert.equal(at(23).pose['food.opacity'],1);assert.equal(at(23).pose['toast.opacity'],0);assert.notEqual(at(18).pose['food.x'],at(2).pose['food.x']);}
 const first=sample(0),later=sample(8.8);assert.notEqual(first.actors[0].pose['cloud-0.x'],later.actors[0].pose['cloud-0.x']);assert.equal(first.actors[0].pose['meteor-0.opacity'],0);assert.ok(later.actors[0].pose['meteor-0.opacity']>.5);
 const svg=renderSVG(d,later);assert.ok(svg.indexOf('data-actor="night"')<svg.indexOf('data-light-effects'));assert.ok(svg.indexOf('data-actor="fire"')>svg.indexOf('data-actor="camper-3"'));assert.doesNotMatch(svg,/data-wall-shadow/);assert.match(svg,/opacity="0" data-part="/);c.dispose();
});

test('campers can leave and return to cooking without carrying props into other actions',()=>{
 const d=createCampfire(),c=new SceneController(d);
 c.setInput('camper-0','action','wave');for(let i=0;i<120;i++)c.step(1/120);
 assert.equal(c.frame().actors.find(a=>a.id==='camper-0').state,'wave');
 assert.match(renderSVG(d,c.frame()),/data-part="roasting-stick"[^>]+visibility="hidden"/);
 c.setInput('camper-0','action','campfire');for(let i=0;i<120;i++)c.step(1/120);
 assert.equal(c.frame().actors.find(a=>a.id==='camper-0').state,'campfire');
 assert.match(renderSVG(d,c.frame()),/data-part="roasting-stick"[^>]+visibility="visible"/);c.dispose();
});
