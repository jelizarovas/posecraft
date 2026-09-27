import { reachingSleeve } from './wwzard-laptop.js';
import {windowPoint} from './wwwzard-window.js';

const clip = (duration, tracks, loop = false) => ({ duration, loop, tracks });
const copy = source => {
  const result = structuredClone(source);
  delete result.events;
  return result;
};
const invisible = (pack, duration) => Object.fromEntries(pack.joints
  .filter(joint => /^magic-\d+$/.test(joint.id) || joint.id === 'leftGrip')
  .map(joint => [`${joint.id}.opacity`, [[0, 0], [duration, 0]]]));
const round = value => +(value.toFixed(3)) || 0;
const movePath = (path, transform) => path.replace(
  /[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g,
  pair => transform(...pair.split(/\s+/).map(Number)).map(round).join(' '),
);

function addReachShapes(pack) {
  for (const id of ['faceReach', 'paperReach']) pack.joints.push({
    id, parent: 'root', x: 0, y: 0, rotation: 0, min: -180, max: 180, length: 0,
  });
  const layer = (id, channel, target, frames) => {
    const part = pack.parts.find(part => part.id === id);
    if (!part?.spatial?.morph) throw new Error(`Missing approved sleeve morph: ${id}`);
    part.spatial.morph.layers ??= [];
    part.spatial.morph.layers.push({ channel, target, ...(frames ? {frames} : {}) });
  };
  layer('left-sleeve', 'faceReach.bend', reachingSleeve([215, 235], false, [205, 273]));
  layer('left-sleeve-shadow', 'faceReach.bend', reachingSleeve([215, 235], true, [205, 273]));
  for (const id of ['right-sleeve', 'right-cuff']) {
    const part = pack.parts.find(part => part.id === id);
    const pivot = id === 'right-sleeve' ? 249 : 284;
    const span = id === 'right-sleeve' ? 56 : 20;
    const target = (dx, dy) => movePath(part.d, (x, y) => {
      const weight = Math.max(0, Math.min(1, (x - pivot) / span));
      return [x + dx * weight, y + dy * weight];
    });
    layer(id, 'faceReach.bend', target(-55, -40));
    // Fold around an elbow below the wrist, rather than translating a straight sleeve.
    const held = id === 'right-sleeve'
      ? 'M237 234Q246 233 259 247L278 273L284 244L299 253L290 294L234 253Z'
      : 'M278 245Q284 239 294 244L303 254Q301 264 289 267L281 258Z';
    const released = id === 'right-sleeve'
      ? 'M237 234Q246 231 259 238L300 241L320 219L331 231L308 270L234 253Z'
      : 'M312 219Q320 214 328 220L334 232Q331 241 320 242L313 233Z';
    layer(id, 'paperReach.bend', released, [{value:.6,target:held}]);
  }
  // A thumb and curled index pinch the central fold. The plane is painted behind
  // these fingers, so its paper edge actually disappears into the grip.
  const palm = pack.parts.find(part => part.id === 'right-hand');
  palm.spatial.morph.layers ??= [];
  const pinched = 'M299 287Q304 279 313 281Q319 282 322 287L320 295L316 295L313 301L304 303Q295 302 293 296Q292 291 299 287Z';
  palm.spatial.morph.layers.push({channel:'paperReach.bend',target:pinched,
    frames:[{value:.6,target:pinched}]});
  const thumb = pack.parts.find(part => part.id === 'right-thumb');
  const pinchThumb = 'M311 283Q317 280 321 283L323 286L320 290L315 289L311 290Z';
  thumb.spatial.morph.layers ??= [];
  thumb.spatial.morph.layers.push({channel:'paperReach.bend',target:pinchThumb,
    frames:[{value:.6,target:pinchThumb}]});
}

const face = {
  'faceReach.bend': 1,
  'leftHand.x': -60, 'leftHand.y': -82, 'leftHand.rotation': -10,
  'rightHand.x': -61, 'rightHand.y': -65, 'rightHand.rotation': 10,
  'rightArm.z': 28, 'head.rotation': 9, 'hatTip.bend': .72,
  'torso.y': 4, 'torso.bend': .55,
};
const paper = {
  'paperReach.bend': .6, 'rightHand.x': -18, 'rightHand.y': -41,
  'rightHand.rotation': 0, 'head.rotation': -4, 'hatTip.bend': .28,
};
const rest = {
  'torso.y': 0, 'head.rotation': 0, 'hatTip.bend': 0,
  'faceReach.bend': 0, 'paperReach.bend': 0,
  'leftHand.x': 0, 'leftHand.y': 0, 'leftHand.rotation': 0,
  'rightHand.x': 0, 'rightHand.y': 0, 'rightHand.rotation': 0,
  'rightArm.z': 0, 'torso.bend': 0,
};
const poseClip = (duration, stops, channels, pack) => clip(duration, {
  ...Object.fromEntries(channels.map(channel => [channel,
    stops.map(([time, pose]) => [time, pose[channel] ?? 0])])),
  ...invisible(pack, duration),
});

function planePack() {
  const root = { id: 'root', parent: null, x: 299, y: 246,
    rotation: 0, min: -180, max: 180, length: 0 };
  const destination=windowPoint(365,160),flight=[destination[0]-root.x,destination[1]-root.y];
  const part = (id, d, fill, outlined = false) => ({
    id, joint: 'root', d, fill, opacityChannel: 'root.opacity',
    spatial:{morph:{channel:'root.bend',target:movePath(d,(x,y)=>[x*.25,y*.25])}},
    ...(outlined ? { stroke: '#7b66aa', strokeWidth: 1.1 } : {}),
  });
  return {
    name: 'Paper plane', spatial: true, joints: [root],
    parts: [
      part('plane-shadow', 'M-21 -10L45 -28L-7 7L0 0Z', '#9f8cce'),
      part('plane-top', 'M-21 -10L45 -28L0 0L-2 -1Z', '#fffdf5', true),
      part('plane-wing', 'M-21 -10L0 0L-7 7Z', '#dce1fa', true),
      part('plane-crease', 'M0 0L45 -28L-2 -1Z', '#f3edff'),
    ],
    inputs: {},
    clips: {
      hide: clip(.28, { 'root.opacity': [[0, 0], [.28, 0]] }),
      prepare: clip(1.5, {
        'root.opacity': [[0, 0], [.42, 0], [.68, 1], [1.5, 1]],
        'root.x': [[0, 18], [.43, 10], [1.05, 0], [1.5, 0]],
        'root.y': [[0, 38], [.43, 28], [1.05, 0], [1.5, 0]],
        'root.rotation': [[0, 24], [.52, 12], [1.05, 0], [1.5, 0]],
        'root.bend': [[0,0],[1.5,0]],
      }),
      hold: clip(3.2, {
        'root.opacity': [[0, 1], [3.2, 1]],
        'root.rotation': [[0, 0], [3.2, 0]],
        'root.x': [[0,0],[3.2,0]], 'root.y': [[0,0],[3.2,0]],
        'root.bend': [[0,0],[3.2,0]],
      }),
      throw: clip(1.4, {
        'root.opacity': [[0, 1], [.82, 1], [1.3, 0], [1.4, 0]],
        'root.bend': [[0,0],[.38,0],[.72,.65],[1.4,1]],
        'root.x': [[0,0],[.16,-5],[.38,30],[.72,flight[0]],[1.05,flight[0]+10],[1.4,flight[0]+14]],
        'root.y': [[0,0],[.16,3],[.38,-35],[.72,flight[1]],[1.05,flight[1]-3],[1.4,flight[1]-6]],
        'root.rotation': [[0,0],[.16,3],[.38,-12],[.72,-30],[1.4,-12]],
      }),
    },
    states: {}, initial: 'hide',
  };
}

export function addContactMotion(scene) {
  const hero = scene.packs.wwzard, screen = scene.packs.screen, source = hero.clips;
  addReachShapes(hero);
  const ready = poseClip(4.4, [[0, rest], [1, rest], [1.8, { ...rest, 'torso.y': 2, 'hatTip.bend': .14 }],
    [2.5, { ...rest, 'torso.y': 2, 'hatTip.bend': .14 }], [4.4, rest]],
  ['torso.y', 'hatTip.bend'], hero);
  const prepare = poseClip(1.5, [[0, rest], [.16, { ...rest, 'rightHand.x': 4, 'rightHand.y': 5 }],
    [1.05, paper], [1.5, paper]], Object.keys(paper), hero);
  const prepared = poseClip(3.2, [[0, paper], [.8, paper],
    [1.02, { ...paper, 'leftHand.y': -4 }], [1.2, paper], [2.2, paper],
    [2.43, { ...paper, 'leftHand.y': -3 }], [2.62, paper], [3.2, paper]],
  [...Object.keys(paper), 'leftHand.y'], hero);
  const release = {...paper,'paperReach.bend':1,'rightHand.x':12,'rightHand.y':-66,
    'rightHand.rotation':-12,'head.rotation':-8,'hatTip.bend':.45};
  const wait = poseClip(1.4, [[0,paper],[.16,{...paper,'rightHand.x':-23,'rightHand.y':-38}],
    [.38,release],[.52,release],[.9,{...rest,'head.rotation':-8,'hatTip.bend':.45}],
    [1.4,{...rest,'head.rotation':-6,'hatTip.bend':.38}]],
  [...new Set([...Object.keys(paper), 'rightArm.rotation', 'head.rotation', 'hatTip.bend'])], hero);
  const windyPrepare = copy(prepare);
  Object.assign(windyPrepare.tracks, {
    'torso.x':[[0,0],[.18,0],[.42,-7],[.72,-3],[1.1,0],[1.5,0]],
    'torso.rotation':[[0,0],[.18,0],[.42,-3],[.75,-1],[1.1,0],[1.5,0]],
    'hat.rotation':[[0,0],[.28,0],[.58,-4],[.86,1],[1.2,0],[1.5,0]],
    'head.rotation':[[0,0],[.25,0],[.55,-8],[.85,-5],[1.05,-4],[1.5,-4]],
    'hatTip.bend':[[0,0],[.26,0],[.6,.8],[.95,.42],[1.5,.28]],
  });
  const error = poseClip(2.8, [[0, rest], [.22, { ...rest, 'torso.y': -2 }],
    [.85, face], [1.7, face], [2.8, rest]], Object.keys(face), hero);
  const closed = Object.fromEntries(Object.entries(source['closed-pause'].tracks)
    .map(([channel, track]) => [channel, track[0][1]]));
  closed['head.x'] = 0;
  closed['head.y'] = 0;
  const sleepy = { ...closed, 'head.x': -5, 'head.y': 12,
    'head.rotation': closed['head.rotation'] + 17,
    'hat.rotation': closed['hat.rotation'] - 3,
    'torso.y': closed['torso.y'] + 2.5,
    'torso.rotation': closed['torso.rotation'] + 2,
    'torso.bend': closed['torso.bend'] + .3,
    'hatTip.bend': closed['hatTip.bend'] + .7 };
  const napEntry = poseClip(2.1, [[0, closed], [.55, { ...closed,
    'head.rotation': closed['head.rotation'] - 3 }], [1.45, sleepy], [2.1, sleepy]],
  Object.keys(closed), hero);
  const breath = { ...sleepy, 'torso.y': sleepy['torso.y'] + 1,
    'hatTip.bend': sleepy['hatTip.bend'] + .06 };
  const nap = poseClip(6.4, [[0, sleepy], [2.6, sleepy], [3.4, breath],
    [4.2, sleepy], [6.4, sleepy]],
    Object.keys(closed), hero);

  const typing = clip(1.28, {
    'leftHand.y': [[0, 0], [.035, 0], [.12, -10], [.22, 0], [.39, -7], [.49, 0],
      [.72, -10], [.83, 0], [1.04, -7], [1.16, 0], [1.28, 0]],
    'leftHand.x': [[0, 0], [.12, -6], [.22, 0], [.39, -3], [.49, 0],
      [.72, -6], [.83, 0], [1.04, -3], [1.16, 0], [1.28, 0]],
    'rightHand.y': [[0, 0], [.1, 0], [.22, -5], [.31, 0], [.55, -6], [.65, 0],
      [.91, -5], [1.02, 0], [1.28, 0]],
    'leftArm.bend': [[0, 0], [.12, .55], [.22, 0], [.39, .4], [.49, 0],
      [.72, .55], [.83, 0], [1.04, .4], [1.16, 0], [1.28, 0]],
    'rightArm.bend': [[0, 0], [.22, .22], [.31, 0], [.55, .28], [.65, 0],
      [.91, .22], [1.02, 0], [1.28, 0]],
    'leftGrip.bend': [[0, 0], [.12, .06], [.22, 0], [.39, .045], [.49, 0],
      [.72, .06], [.83, 0], [1.04, .045], [1.16, 0], [1.28, 0]],
    'torso.y': [[0, 0], [.22, .8], [.49, 0], [.83, .8], [1.28, 0]],
    ...invisible(hero, 1.28),
  });

  hero.clips = {
    ready, typing, prepare, prepared, 'prepare-windy':windyPrepare,
    sending: wait, sent: copy(source.greet), error,
    visitor: copy(source.notice), close: copy(source.close),
    'nap-entry': napEntry, nap, open: copy(source.open),
  };
  screen.clips = {
    still: copy(screen.clips.still), close: copy(screen.clips.close),
    nap: clip(6.4, { 'hinge.bend': [[0, 1]], 'hinge.z': [[0, -20]] }),
    open: copy(screen.clips.open),
  };
  const plane = planePack();
  for (const pack of [hero, screen, plane]) {
    pack.states = Object.fromEntries(Object.keys(pack.clips).map(id => [id, {
      clip: id, transitions: [],
    }]));
    pack.initial = pack === hero ? 'ready' : pack === plane ? 'hide' : 'still';
  }
  scene.packs.plane = plane;
  scene.actors.push({
    id: 'plane', name: 'Paper plane', pack: 'plane', layer: 'characters',
    depth: { value: 19 }, unlit: true,
    transform: { ...scene.actors.find(actor => actor.id === 'wwzard').transform },
  });
  return scene;
}
