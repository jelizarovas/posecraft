import test from 'node:test';
import assert from 'node:assert/strict';
import {createLoveseat,loveseatActions,loveseatBeat,loveseatPhaseTimes,loveseatBeats} from '../examples/loveseat.js';
import {assertDocument} from '../src/schema.js';
import {SceneController} from '../src/scene.js';
import {spatialKinematics} from '../src/spatial.js';
const sample=(scene,controller,action,time)=>{for(const a of scene.actors)controller.previewClip(a.id,action,time,{});return Object.fromEntries(controller.frame().actors.map(a=>[a.id,{pose:a.pose,world:spatialKinematics(scene.packs[scene.actors.find(v=>v.id===a.id).pack],a.pose)}]));};
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
test('loveseat is an editable bounded scene with synchronized carry and rest actions',()=>{const d=assertDocument(JSON.parse(JSON.stringify(createLoveseat())));assert.deepEqual(d.groups.map(g=>g.id),['scenery','carriers','furniture']);assert.equal(d.actors.filter(a=>a.group==='carriers').length,2);assert.ok(JSON.stringify(d).length<1000000);for(const p of Object.values(d.packs)){assert.deepEqual(p.inputs.action.options,loveseatActions);for(const action of loveseatActions)assert.ok(p.clips[action].loop);}assert.equal(d.lighting.floorShadow,0,'a flat global floor shadow cannot represent a staircase');});
test('every supporting hand stays on its loveseat handle between authored keys',()=>{const d=createLoveseat(),c=new SceneController(d);let maximum=0;for(const action of loveseatActions){const duration=action==='carry'?12:6;for(let t=.013;t<duration;t+=.073){const frame=sample(d,c,action,t),rests=loveseatBeat(t,action).rests;let supported=0;for(const [id,index] of [['lower',0],['upper',1]])for(const side of ['left','right']){const released=(index===0&&side==='left'||index===1&&side==='right')&&rests[index]>.0001;if(released)continue;supported++;const hand=frame[id].world[side+'Hand'],handle=frame.loveseat.world[id+(side==='left'?'Left':'Right')];maximum=Math.max(maximum,distance(hand,handle));assert.ok(distance(hand,handle)<.12,`${action} ${t.toFixed(3)} ${id} ${side} hand stays on its handle`);}assert.ok(supported>=3,'at least three hands support the load');}}assert.ok(maximum<.12);c.dispose();});
test('planted feet remain on actual moving stair treads and resting pauses the staircase',()=>{const d=createLoveseat(),c=new SceneController(d);for(let t=.02;t<12;t+=.077){const frame=sample(d,c,'carry',t),steps=Object.entries(frame.stairs.world).filter(([id])=>id.startsWith('step-')).map(([,w])=>w);for(const id of ['lower','upper'])for(const side of ['left','right'])if(frame[id].pose[side+'Contact.opacity']>.129){const foot=frame[id].world[side+'Foot'],step=steps.find(s=>foot.x>=s.x&&foot.x<=s.x+60);assert.ok(step);assert.ok(Math.abs(foot.y+5-step.y)<.12,`${id} ${side} planted on its tread at ${t}`);}}
 const a=sample(d,c,'carry',4.6),b=sample(d,c,'carry',5.2);assert.equal(a.stairs.world.root.x,b.stairs.world.root.x);assert.equal(a.stairs.world.root.y,b.stairs.world.root.y);c.dispose();});
test('one arm rests while the partner compensates and the full cycle returns continuously',()=>{const d=createLoveseat(),c=new SceneController(d);for(const [action,rester,side,partner] of [['rest-left','lower','left','upper'],['rest-right','upper','right','lower']]){const start=sample(d,c,action,0),rest=sample(d,c,action,3);assert.ok(distance(rest[rester].world[side+'Hand'],rest.loveseat.world[rester+(side==='left'?'Left':'Right')])>25);assert.ok(Math.abs(rest[partner].pose['torso.rotation']-start[partner].pose['torso.rotation'])>=5);}
 const first=sample(d,c,'carry',0),last=sample(d,c,'carry',11.9999);for(const id of ['lower','upper','loveseat'])for(const joint of Object.keys(first[id].world))assert.ok(distance(first[id].world[joint],last[id].world[joint])<.02,`${id}.${joint} has no loop teleport`);
 const visible=frame=>Object.entries(frame.stairs.world).filter(([id])=>id.startsWith('step-')).map(([,w])=>w).filter(w=>w.x>=0&&w.x<800&&w.y>=0&&w.y<450).map(w=>[Math.round(w.x),Math.round(w.y)]).sort((a,b)=>a[0]-b[0]);assert.deepEqual(visible(first),visible(last),'stair identities wrap to visually identical treads outside the frame');c.dispose();});


test('knees keep one anatomical bend direction and never fold tightly or lock',()=>{
 const d=createLoveseat(),c=new SceneController(d);
 for(let t=0;t<12;t+=.031){const f=sample(d,c,'carry',t);for(const id of ['lower','upper'])for(const side of ['left','right']){
  const angle=f[id].pose[side+'Calf.rotation'];assert.ok(angle>25&&angle<112,`${id} ${side} knee stays in a loaded walking range at ${t}: ${angle}`);
  const hip=f[id].world[side+'Thigh'],knee=f[id].world[side+'Calf'],ankle=f[id].world[side+'Foot'];
  const cross=(knee.x-hip.x)*(ankle.y-knee.y)-(knee.y-hip.y)*(ankle.x-knee.x);assert.ok(cross>0,'knees bend uphill throughout the cycle');
  assert.ok(distance(hip,ankle)<73&&distance(hip,ankle)>40,'no IK target reaches a singular stretched or folded leg');
  const pack=d.packs[id];for(const suffix of ['Thigh','Calf','Foot']){const j=pack.joints.find(j=>j.id===side+suffix),v=f[id].pose[j.id+'.rotation'];assert.ok(v>j.min&&v<j.max,'the authored pose never hits its anatomical joint limit');}
 }}c.dispose();
});

test('whole shoe clears each real riser, with at least one planted support foot',()=>{
 const d=createLoveseat(),c=new SceneController(d);
 for(let t=.003;t<12;t+=.019){const f=sample(d,c,'carry',t),stairs=f.stairs.world.root;for(const id of ['lower','upper']){
  assert.ok(['left','right'].some(side=>f[id].pose[side+'Contact.opacity']>.129),'the load never floats between two swinging feet');
  for(const side of ['left','right']){const foot=f[id].world[side+'Foot'];for(const offset of [-8,0,22]){
   const step=Math.floor((foot.x+offset-stairs.x)/60),surface=480-step*18+stairs.y;
   assert.ok(foot.y+5<=surface+.12,`${id} ${side} shoe clears riser at ${t.toFixed(3)} (${offset}): ${foot.y+5-surface}`);
  }}
 }}c.dispose();
});

test('review phases expose foot clearance, planting, transfer and the two rests',()=>{
 const d=createLoveseat(),c=new SceneController(d),times=loveseatPhaseTimes;
 assert.deepEqual(loveseatBeats.map(b=>b.id),['lift','transfer','climb','rest-lower','climb-again','rest-upper']);
 assert.equal(loveseatBeats[0].start,0);assert.equal(loveseatBeats.at(-1).end,12);
 for(let i=1;i<loveseatBeats.length;i++)assert.equal(loveseatBeats[i].start,loveseatBeats[i-1].end);
 const standing=sample(d,c,'carry',times.stand),lift=sample(d,c,'carry',times.clearRiser),plant=sample(d,c,'carry',times.transfer),follow=sample(d,c,'carry',times.followSwing);
 assert.ok(lift.lower.pose['rightContact.opacity']<.001);assert.ok(lift.lower.pose['leftContact.opacity']>.129);
 assert.ok(plant.lower.pose['rightContact.opacity']>.129);assert.ok(plant.lower.pose['leftContact.opacity']>.129);
 assert.ok(follow.lower.pose['leftContact.opacity']<.001);assert.ok(follow.lower.pose['rightContact.opacity']>.129);
 assert.ok(lift.lower.world.root.x<standing.lower.world.root.x,'weight shifts over the trailing support before the lead foot advances');
 assert.ok(follow.lower.world.root.x>standing.lower.world.root.x,'weight shifts over the planted lead foot before the trail foot follows');
 assert.ok(loveseatBeat(times.lowerRest).rests[0]>.99);assert.ok(loveseatBeat(times.upperRest).rests[1]>.99);c.dispose();
});
