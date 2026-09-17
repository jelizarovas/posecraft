import test from 'node:test';
import assert from 'node:assert/strict';
import {createCampfire,campPhase,convertCampfireEffects} from '../examples/campfire.js';
import {SceneController} from '../src/scene.js';
import {assertDocument,validateDocument} from '../src/schema.js';
import {spatialParts} from '../src/spatial.js';
import {renderSVG} from '../src/svg.js';
import {sampleEmitter} from '../src/emitters.js';
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
 const l=lightingConfig(createCampfire());assert.equal(l.pointY,316);assert.ok(lightAt(l,200,l.pointY).angle===0);assert.ok(Math.abs(lightAt(l,600,l.pointY).angle)===180);assert.ok(lightAt(l,390,l.pointY).intensity>lightAt(l,20,l.pointY).intensity);
 assert.notEqual(sampleLighting(l,1).intensity,sampleLighting(l,1.5).intensity);assert.deepEqual(sampleLighting(l,1),sampleLighting(l,1));
 const moving={...l,emitterSettings:undefined,motion:'orbit'};assert.notEqual(sampleLighting(moving,0).pointX,sampleLighting(moving,2).pointX);
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
 const svg=renderSVG(d,later);assert.ok(svg.indexOf('data-actor="night"')<svg.indexOf('data-light-effects'));assert.ok(svg.indexOf('data-actor="fire"')<svg.indexOf('data-actor="camper-3"')&&svg.indexOf('data-actor="fire"')>svg.indexOf('data-actor="camper-1"'));assert.doesNotMatch(svg,/data-wall-shadow/);assert.match(svg,/opacity="0" data-part="/);c.dispose();
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

test('campfire hands grip the planted stick and carry food in front of the face',()=>{
 const d=createCampfire(),c=new SceneController(d);
 for(let i=0;i<4;i++){
  const actor=d.actors.find(a=>a.id==='camper-'+i),p=d.packs[actor.pack];
  for(const t of [15.5,16.45,16.73,17.25,17.83,18.2,18.7,21,21.3]){
   c.previewClip(actor.id,'campfire',(t-i*5+24)%24,{});const f=c.frame().actors.find(a=>a.id===actor.id),view=spatialParts(p,f),hand=view.world['take-hand'],food=view.world.food,stick=view.parts.get('roasting-stick').matrix,hold=view.world['hold-hand'],tip={x:stick[4]+stick[0]*Number(view.parts.get('roasting-stick').d.split('H')[1]),y:stick[5]+stick[1]*Number(view.parts.get('roasting-stick').d.split('H')[1])};
   assert.ok(Math.abs(Math.hypot(f.world['hold-hand'].x-f.world.skewer.x,f.world['hold-hand'].y-f.world.skewer.y)-18)<.15,'holding hand stays on shaft');
   if(t>=16.4&&t<19||t>=20.7&&t<21.5)assert.ok(Math.hypot(hand.x-food.x,hand.y-food.y)<.2,'food follows taking hand');
   if(t===15.5){assert.ok(Math.abs(stick[5]-56)<.01,'butt of stick is planted at ground');assert.ok(Math.hypot(food.x-tip.x,food.y-tip.y)<.2,'food remains on stick before grasp');}
   assert.ok(view.order.indexOf('take-skin')>view.order.indexOf('face-0'),'hand draws in front of head');
  }
 }
 c.previewClip('camper-0','campfire',2.2,{});assert.equal(c.frame().actors.find(a=>a.id==='camper-0').pose['camp-blink.opacity'],1);
 c.previewClip('camper-0','campfire',12.4,{});assert.equal(c.frame().actors.find(a=>a.id==='camper-0').pose['camp-oh.opacity'],1);
 c.previewClip('camper-0','campfire',18.2,{});assert.ok(c.frame().actors.find(a=>a.id==='camper-0').pose['camp-chew-open.opacity']>0);c.dispose();
 const light=lightingConfig(d),a=sampleLighting(light,1),b=sampleLighting(light,1.5);assert.notEqual(a.celThickness,b.celThickness);assert.equal(sampleLighting({...light,emitterSettings:{...light.emitterSettings,randomness:0}},1).celThickness,light.celThickness);
});


test('campfire fire, smoke and embers are bounded procedural emitters, not authored loops',()=>{
 const d=assertDocument(createCampfire());assert.deepEqual(d.packs.fire.clips.loop.tracks,{});assert.deepEqual(d.packs.fire.joints.map(j=>j.id),['root']);assert.equal(d.packs.fire.parts.length,14);
 assert.deepEqual(d.emitters.map(e=>e.type),['flame','smoke','embers']);assert.equal(d.lighting.emitter,'fire-flame');assert.deepEqual(d.groups.map(g=>g.id),['scenery','characters','campfire']);
 for(const e of d.emitters){assert.equal(e.actor,'fire');assert.equal(e.group,'campfire');const a=sampleEmitter(e,2.345),b=sampleEmitter(e,6.345);assert.deepEqual(a,sampleEmitter(e,2.345));assert.notDeepEqual(a,b,'effects do not repeat the old four-second loop');assert.ok(a.length<=e.maxParticles);assert.ok(sampleEmitter({...e,rate:0},20).every(p=>p.opacity===0));}
 const hidden=structuredClone(d);hidden.groups.find(g=>g.id==='campfire').hidden=true;assert.equal(sampleLighting(lightingConfig(hidden),2).intensity,0,'hiding the fire folder also extinguishes its light');const moved=structuredClone(d);Object.assign(moved.actors.find(a=>a.id==='fire').transform,{x:20,y:30,scale:2});assert.equal(lightingConfig(moved).pointX,820);assert.equal(lightingConfig(moved).pointY,662);
 const smoke=d.emitters.find(e=>e.type==='smoke'),slow=sampleEmitter({...smoke,rate:.5},8).filter(p=>p.opacity>0),fast=sampleEmitter({...smoke,rate:4},8).filter(p=>p.opacity>0);assert.ok(fast.length>slow.length,'rate controls how many smoke births remain alive');
});

test('explicit legacy campfire conversion keeps authored characters and custom fire dependencies',()=>{
 const legacy=createCampfire();delete legacy.emitters;delete legacy.lighting.emitter;legacy.groups=[{id:'campfire',name:'My custom folder',parent:null}];for(const a of legacy.actors)delete a.group;
 legacy.requiredFeatures=legacy.requiredFeatures.filter(f=>!['scene-groups','procedural-emitters'].includes(f));const p=legacy.packs.fire;
 for(const id of ['flame-0','smoke-0','ember-0']){p.joints.push({id,parent:'root',x:400,y:352,rotation:0,min:-180,max:180,length:0});p.parts.push({id,joint:id,d:'M0 0L4 0L2 -8Z',fill:'#ff9900'});p.clips.loop.tracks[id+'.y']=[[0,0],[4,-30]];}
 p.parts.push({id:'custom-fire-sign',joint:'smoke-0',d:'M0 0H10V10H0Z',fill:'#ff0000'});legacy.packs['camper-0'].clips.campfire.tracks['head.rotation']=[[0,3],[24,6]];
 const before=structuredClone(legacy),converted=assertDocument(convertCampfireEffects(legacy));assert.deepEqual(legacy,before,'conversion never mutates the open draft');assert.deepEqual(converted.packs['camper-0'],legacy.packs['camper-0']);assert.ok(converted.packs.fire.parts.some(p=>p.id==='custom-fire-sign'));assert.ok(converted.packs.fire.joints.some(j=>j.id==='smoke-0'));assert.ok(converted.packs.fire.clips.loop.tracks['smoke-0.y']);assert.ok(!converted.packs.fire.joints.some(j=>j.id==='flame-0'));assert.ok(!converted.packs.fire.clips.loop.tracks['flame-0.y']);assert.ok(!converted.packs.fire.parts.some(p=>p.id==='smoke-0'));assert.equal(converted.groups.find(g=>g.id==='campfire').name,'My custom folder');assert.ok(converted.groups.some(g=>g.id==='campfire-2'));
 assert.deepEqual(convertCampfireEffects(converted),converted,'conversion is idempotent even with retained custom dependencies');
});


test('reaction artwork stays hidden in authored cooking clips until explicitly directed',()=>{
 const d=assertDocument(createCampfire()),channels=['camp-startle','camp-sweat','camp-disappointed','camp-shout','camp-notice'],controller=new SceneController(d);
 for(const actor of d.actors.filter(a=>a.id.startsWith('camper-'))){const p=d.packs[actor.pack];for(const id of channels){assert.ok(p.parts.some(part=>part.id===id&&part.opacityChannel===id+'.opacity'));assert.ok(p.clips.campfire.tracks[id+'.opacity'].every(key=>key[1]===0));}
  controller.previewClip(actor.id,'campfire',12.4,{});const frame=controller.frame().actors.find(a=>a.id===actor.id);for(const id of channels)assert.equal(frame.pose[id+'.opacity'],0);
 }
 controller.previewClip('camper-0','campfire',12.4,{'camp-startle.opacity':1});const svg=renderSVG(d,controller.frame());assert.match(svg,/opacity="1" data-part="camp-startle"/);assert.match(svg,/opacity="1" data-part="camp-startle-eyes"/);assert.doesNotMatch(svg,/data-part="camp-point"/);controller.dispose();
});
