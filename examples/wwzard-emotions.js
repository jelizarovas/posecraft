import {interpolate, sampleClip} from '@posecraft/runtime/animation';

// These are authoring-time edits to ordinary saved clips. The exported scene
// contains every key; playback needs no emotion-specific code.
const round = value => +value.toFixed(4) || 0;
const bounded = (channel,value) => channel.endsWith('.bend') ? round(Math.max(0,Math.min(1,value)))
  : channel === 'head.rotation' ? round(Math.max(-19,Math.min(19,value))) : round(value);
const unique = values => [...new Set(values.map(round))].sort((a, b) => a - b);
const moods = ['disappointed', 'angry'];
const names = ['work', 'notice', 'curious', 'greet', 'frustrated', 'rest', 'laptop'];

// Each action has its own posture and rhythm. Values are additive offsets to
// existing authored tracks, so the source action remains recognizable.
const accents = {
  disappointed: {
    work: {'head.rotation':[[0,0],[.2,7],[.68,8],[.86,3],[1,0]],'torso.bend':[[0,0],[.2,.42],[.69,.52],[.85,.24],[1,0]],'hatTip.bend':[[0,0],[.3,.22],[.75,.3],[1,0]]},
    notice: {'head.rotation':[[0,0],[.3,5],[.57,8],[.82,5],[1,0]],'torso.bend':[[0,0],[.3,.25],[.72,.48],[1,0]],'hatTip.bend':[[0,0],[.43,.35],[.8,.45],[1,0]]},
    curious: {'head.rotation':[[0,0],[.24,6],[.6,9],[.83,5],[1,0]],'torso.bend':[[0,0],[.3,.32],[.76,.48],[1,0]],'hatTip.bend':[[0,0],[.36,.2],[.74,.4],[1,0]]},
    greet: {'head.rotation':[[0,0],[.26,4],[.68,7],[.84,5],[1,0]],'torso.bend':[[0,0],[.26,.25],[.72,.42],[1,0]],'hatTip.bend':[[0,0],[.3,.3],[.76,.5],[1,0]]},
    frustrated: {'head.rotation':[[0,0],[.25,3],[.62,8],[.78,10],[1,0]],'torso.bend':[[0,0],[.25,.25],[.72,.5],[1,0]],'hatTip.bend':[[0,0],[.35,.25],[.8,.45],[1,0]]},
    rest: {'head.rotation':[[0,0],[.25,4],[.53,8],[.72,6],[1,0]],'torso.bend':[[0,0],[.25,.28],[.58,.5],[.8,.25],[1,0]],'hatTip.bend':[[0,0],[.34,.22],[.68,.34],[1,0]]},
  },
  angry: {
    work: {'head.rotation':[[0,0],[.16,-5],[.4,-8],[.62,-5],[.8,-8],[1,0]],'torso.bend':[[0,0],[.14,.55],[.43,.37],[.72,.6],[1,0]],'hatTip.bend':[[0,0],[.22,.55],[.48,.2],[.75,.72],[1,0]]},
    notice: {'head.rotation':[[0,0],[.2,-7],[.48,-12],[.75,-9],[1,0]],'torso.bend':[[0,0],[.2,.5],[.6,.65],[1,0]],'hatTip.bend':[[0,0],[.28,.7],[.64,.32],[1,0]]},
    curious: {'head.rotation':[[0,0],[.2,-6],[.56,-9],[.8,-6],[1,0]],'torso.bend':[[0,0],[.2,.55],[.7,.65],[1,0]],'hatTip.bend':[[0,0],[.27,.65],[.68,.4],[1,0]]},
    greet: {'head.rotation':[[0,0],[.18,-5],[.54,-8],[.8,-4],[1,0]],'torso.bend':[[0,0],[.18,.5],[.62,.6],[1,0]],'hatTip.bend':[[0,0],[.28,.6],[.7,.25],[1,0]]},
    frustrated: {'head.rotation':[[0,0],[.18,-5],[.4,-10],[.72,-7],[1,0]],'torso.bend':[[0,0],[.16,.6],[.52,.85],[.78,.45],[1,0]],'hatTip.bend':[[0,0],[.2,.75],[.5,.3],[.76,.8],[1,0]]},
    rest: {'head.rotation':[[0,0],[.2,-5],[.54,-8],[.78,-5],[1,0]],'torso.bend':[[0,0],[.17,.55],[.58,.7],[.83,.35],[1,0]],'hatTip.bend':[[0,0],[.26,.65],[.65,.35],[1,0]]},
  },
};

const scales = {
  disappointed:{work:1.37,notice:1.42,curious:1.3,greet:1.34,frustrated:1.28,rest:1.4},
  angry:{work:.89,notice:.86,curious:.9,greet:.9,frustrated:.87,rest:.93},
};

function retimeSimple(source, mood, name) {
  const duration = round(source.duration * scales[mood][name]);
  const tracks = Object.fromEntries(Object.entries(source.tracks).map(([channel, keys]) => [
    channel, keys.map(([time, value, easing]) => [round(time * duration / source.duration), value, ...(easing ? [easing] : [])]),
  ]));
  for (const [channel, offsets] of Object.entries(accents[mood][name])) {
    const baseline = source.tracks[channel];
    const times = unique([0, duration, ...offsets.map(([phase]) => phase * duration), ...(baseline || []).map(([time]) => time * duration / source.duration)]);
    tracks[channel] = times.map(time => [time, bounded(channel,(baseline ? interpolate(baseline, time * source.duration / duration) : 0) + interpolate(offsets.map(([phase, value]) => [phase * duration, value]), time))]);
  }
  return {duration, loop:source.loop, tracks,
    ...(source.events ? {events:source.events.map(event => ({...event, time:round(event.time * duration / source.duration)}))} : {})};
}

// Laptop uses a shared target-time -> source-time score. Repeated and reversed
// phrases are baked into both the wrist/grip and screen hinge clips.
function laptopScore(sourceHinge, mood) {
  const foldTime = value => {
    const keys = sourceHinge.tracks['hinge.bend'];
    for (let i = 1; i < keys.length; i++) if (keys[i][0] <= 3.8 && keys[i][1] >= value) {
      const [aTime, aValue] = keys[i-1], [bTime, bValue] = keys[i];
      return aTime + (value - aValue) * (bTime - aTime) / (bValue - aValue);
    }
    throw new Error('Laptop fold target is missing');
  };
  if (mood === 'disappointed') {
    const almost = foldTime(.875), stepBack = foldTime(.75);
    return [[0,0],[4.25,almost],[5.2,almost],[5.75,stepBack],[6.9,stepBack],[8.3,3.8],[8.8,3.8],[11.2,5.4],[12.4,7]];
  }
  // Reach the lid, brace for half a second, then drive the full close in
  // 270 ms. The following source interval holds the lid shut for recoil.
  return [[0,0],[1.05,1.05],[1.55,1.05],[1.82,2.55],[2.35,3.8],[4.45,5.4],[5.55,7]];
}

function bakeScore(source, score) {
  const duration = score.at(-1)[0], tracks = {};
  for (const [channel, keys] of Object.entries(source.tracks)) {
    if (keys.some(key => key[2] === 'step')) {
      const samples = [{time:0,sourceTime:score[0][1]}];
      for (let i=1;i<score.length;i++) {
        const [from,a]=score[i-1], [to,b]=score[i];
        if(a!==b) for(const [sourceTime] of keys) if(sourceTime>Math.min(a,b) && sourceTime<Math.max(a,b)) {
          const time=round(from+(sourceTime-a)*(to-from)/(b-a));
          // Keep the exact source key with its rounded destination time. A
          // round-trip through the inverse map can land just before a step.
          samples.push({time,sourceTime});
          if (b<a) samples.push({time:round(time+.0001),sourceTime:sourceTime-.00001});
        }
        samples.push({time:to,sourceTime:b});
      }
      samples.sort((left,right)=>left.time-right.time);
      const result=[];
      for(const {time,sourceTime} of samples){
        const key=[time,round(sampleClip(source,sourceTime)[channel]),'step'];
        if(result.at(-1)?.[0]===time)result[result.length-1]=key;
        else result.push(key);
      }
      tracks[channel]=result;
      continue;
    }
    const result = [];
    const add = (time, sourceTime, easing) => {
      const value = round(sampleClip(source, sourceTime)[channel]);
      const old = result.at(-1);
      if (old && Math.abs(old[0] - time) < .00001) result[result.length-1] = [time, value, ...(easing ? [easing] : [])];
      else result.push([time, value, ...(easing ? [easing] : [])]);
    };
    add(0,score[0][1]);
    for (let i = 1; i < score.length; i++) {
      const [from, a] = score[i-1], [to, b] = score[i];
      if (a !== b) {
        const interior=keys.filter(([sourceTime])=>sourceTime>Math.min(a,b)+.000001 && sourceTime<Math.max(a,b)-.000001)
          .map(([sourceTime])=>({sourceTime,time:round(from+(sourceTime-a)*(to-from)/(b-a))}))
          .sort((left,right)=>left.time-right.time);
        for (const {time,sourceTime} of interior) if (time>from && time<to) add(time,sourceTime);
      }
      add(to,b);
    }
    // The original grip/hinge intervals are linear. Retiming them as linear
    // preserves identical fold/hand paths through the held and reversed poses.
    if (channel === 'hinge.bend' || channel === 'leftGrip.bend' || channel === 'leftHand.x' || channel === 'leftHand.y') for (const key of result) key[2] = 'linear';
    tracks[channel] = result;
  }
  return {duration,loop:false,tracks};
}

function addLaptopAttitude(clip, mood) {
  const duration = clip.duration;
  const accent = mood === 'disappointed'
    ? {'head.rotation':[[0,0],[3.2,4],[5.7,5],[6.3,12],[7.1,9],[8.4,4],[10,3],[duration,0]],
       'torso.bend':[[0,0],[4.2,.2],[5.7,.35],[6.35,.9],[7.2,.55],[8.5,.25],[10.5,.1],[duration,0]],
       'hatTip.bend':[[0,0],[4.3,.18],[6.2,.38],[6.75,.72],[8.4,.25],[duration,0]]}
    : {'head.rotation':[[0,0],[1.05,-4],[1.55,-9],[1.75,-10],[1.82,9],[2.05,-4],[3.8,-4],[duration,0]],
       'torso.bend':[[0,0],[1.05,.25],[1.55,.5],[1.75,.65],[1.82,1],[2.08,.16],[4.4,.2],[duration,0]],
       'hatTip.bend':[[0,0],[1.4,.25],[1.75,.62],[1.82,1],[2.1,-.15],[4.3,.2],[duration,0]]};
  for (const [channel, keys] of Object.entries(accent)) {
    const baseline = clip.tracks[channel];
    const times = unique([...keys.map(([time])=>time), ...(baseline || []).map(([time])=>time)]);
    clip.tracks[channel] = times.map(time => [time,bounded(channel,(baseline ? interpolate(baseline,time) : 0)+interpolate(keys,time))]);
  }
  return clip;
}

export function addWwzardEmotions(scene) {
  const hero = scene.packs.wwzard, screen = scene.packs.screen;
  if (!hero || !screen || !hero.clips.laptop || !screen.clips.laptop) throw new Error('Wwzard laptop scene required');
  for (const mood of moods) {
    for (const name of names) {
      const id = `${name}--${mood}`;
      hero.clips[id] = name === 'laptop'
        ? addLaptopAttitude(bakeScore(hero.clips.laptop, laptopScore(screen.clips.laptop,mood)),mood)
        : retimeSimple(hero.clips[name],mood,name);
    }
    screen.clips[`laptop--${mood}`] = bakeScore(screen.clips.laptop,laptopScore(screen.clips.laptop,mood));
  }
  return scene;
}
