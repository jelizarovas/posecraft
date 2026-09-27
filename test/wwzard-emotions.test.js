import assert from 'node:assert/strict';
import test from 'node:test';
import {createWwzardIllustration} from '../examples/wwzard-illustration.js';
import {laptopGrip} from '../examples/wwzard-laptop.js';
import {sampleClip} from '../src/index.js';
import {assertDocument} from '../src/schema.js';

const scene=()=>createWwzardIllustration();
const heroNames=['work','notice','curious','greet','frustrated','rest','laptop'];
const moods=['disappointed','angry'];
const near=(a,b,tolerance=.001)=>assert.ok(Math.abs(a-b)<=tolerance,`${a} differs from ${b}`);

test('each Wwzard action has saved variants and returns to its source neutral pose',()=>{
  const document=assertDocument(JSON.parse(JSON.stringify(scene())));
  const hero=document.packs.wwzard, screen=document.packs.screen;
  for(const name of heroNames)for(const mood of moods){
    const variant=hero.clips[`${name}--${mood}`],base=hero.clips[name];
    assert.ok(variant,`${name}/${mood} missing`);
    assert.equal(variant.loop,base.loop);
    assert.ok(variant.duration>0);
    for(const time of [0,variant.duration]){
      const pose=sampleClip(variant,time),source=sampleClip(base,time===0?0:base.duration);
      for(const channel of Object.keys(base.tracks))near(pose[channel],source[channel],.001);
    }
    for(const keys of Object.values(variant.tracks))for(const [time,value] of keys){
      assert.ok(Number.isFinite(time)&&Number.isFinite(value));
      assert.ok(time>=0&&time<=variant.duration);
    }
  }
  for(const mood of moods){
    const id=`laptop--${mood}`;
    assert.ok(screen.clips[id]);
    assert.equal(screen.clips[id].duration,hero.clips[id].duration);
  }
  assert.ok(Buffer.byteLength(JSON.stringify(document))<132*1024,'editable scene stays below the 132 KiB allowance documented in docs/wwzard-performance.md');
});

test('each action changes posture with mood, while Normal remains the authored source',()=>{
  const document=scene(),clips=document.packs.wwzard.clips;
  for(const name of heroNames){
    const base=clips[name],sad=clips[`${name}--disappointed`],angry=clips[`${name}--angry`];
    assert.notEqual(sad.duration,base.duration);
    assert.notEqual(angry.duration,base.duration);
    const sample=(clip,phase)=>sampleClip(clip,clip.duration*phase);
    assert.ok(Math.abs(sample(sad,.6)['head.rotation']-sample(base,.6)['head.rotation'])>2,`${name} disappointed posture`);
    assert.ok(Math.abs(sample(angry,.6)['head.rotation']-sample(base,.6)['head.rotation'])>2,`${name} angry posture`);
    assert.ok(Math.abs(sample(sad,.6)['head.rotation']-sample(angry,.6)['head.rotation'])>4,`${name} distinct silhouette`);
  }
});

test('laptop mood phrases keep the hand on the lid and preserve timed visibility',()=>{
  const document=scene(),hero=document.packs.wwzard,screen=document.packs.screen;
  for(const mood of moods){
    const id=`laptop--${mood}`,h=hero.clips[id],s=screen.clips[id];
    let engaged=0;
    for(let time=0;time<=h.duration;time+=1/60){
      const hp=sampleClip(h,time),sp=sampleClip(s,time),fold=sp['hinge.bend'];
      if(hp['leftGrip.bend']>=.2 && fold>=0 && fold<=1){
        const target=laptopGrip(fold),hand=[275+(hp['leftHand.x']||0),317+(hp['leftHand.y']||0)];
        assert.ok(Math.hypot(hand[0]-target[0],hand[1]-target[1])<1.1,`${id} misses lid at ${time.toFixed(2)}`);
        near(hp['leftGrip.bend'],.2+.3*fold,.005);
        engaged++;
      }
    }
    assert.ok(engaged>100);
    if(h.tracks['leftGrip.opacity']){
      near(sampleClip(h,0)['leftGrip.opacity'],0);
      near(sampleClip(h,h.duration)['leftGrip.opacity'],0);
      const seen=Array.from({length:Math.ceil(h.duration*30)},(_,i)=>sampleClip(h,i/30)['leftGrip.opacity']);
      assert.ok(seen.some(value=>value>0));
    }
  }
  const sad=screen.clips['laptop--disappointed'],angry=screen.clips['laptop--angry'];
  assert.ok(sad.duration>=11&&sad.duration<=13);
  assert.ok(angry.duration>=5&&angry.duration<=6);
  const fold=t=>sampleClip(sad,t)['hinge.bend'];
  near(fold(4.25),.875,.002);near(fold(5.2),.875,.002);
  assert.ok(fold(5.75)<fold(5.2),'disappointed lid backs off after hesitation');
  near(fold(6.9),.75,.002);near(fold(8.3),1,.002);near(fold(sad.duration),0,.002);
  near(sampleClip(hero.clips['laptop--disappointed'],1.5)['rightArm.z'],-18);
  near(sampleClip(angry,1.05)['hinge.bend'],0,.002);
  near(sampleClip(angry,1.55)['hinge.bend'],0,.002);
  assert.ok(sampleClip(angry,1.7)['hinge.bend']>.2,'angry slam is under way');
  assert.ok(sampleClip(angry,1.82)['hinge.bend']>.995,'angry lid slams shut in 270 ms');
  near(sampleClip(angry,2.35)['hinge.bend'],1,.002);
  const angryHero=hero.clips['laptop--angry'];
  assert.ok(sampleClip(angryHero,1.82)['head.rotation']>sampleClip(angryHero,1.75)['head.rotation']+8,'impact snaps the head');
  assert.ok(sampleClip(angryHero,1.82)['torso.bend']>sampleClip(angryHero,2.08)['torso.bend']+.3,'body recoils after impact');
});
