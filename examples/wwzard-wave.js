// The near sleeve folds at the body, then its forearm swings while the elbow
// stays tucked. All three contours are saved as editable path morphs.
const folded = [150, 231];
const waved = [162, 227];
const palm = 'M266 316Q261 310 265 303L274 299Q283 297 288 304L291 312L288 321L282 328Q275 332 270 325Q267 321 266 316Z';
const thumb = 'M266 308Q258 297 255 302L258 310L266 321L272 320L271 315Z';
// These contours retain the source paths' command topology. The third curve
// cups below the elbow before rising to the wrist; a straight reach contour
// folds over itself when the hand crosses to the viewer's left.
function nearSleeve([x, y], shadow) {
  if (shadow) return `M186 279Q193 295 200 295L${x + 9} ${y - 5}L${x + 13} ${y + 3}L191 288Q188 285 186 279Z`;
  return `M181 244Q197 232 207 247Q218 268 204 298Q196 308 182 296L${x - 12} ${y + 8}L${x + 9} ${y - 5}Q${x + 15} ${y + 18} 185 276Q187 269 183 263Q171 256 181 244Z`;
}
const keys = points => points;
const scale = (track, factor) => track.map(([time, value, easing]) =>
  [Math.min(2.2 * factor, +(time * factor).toFixed(2)), value, ...(easing ? [easing] : [])]);

export function addWwzardWave(scene) {
  const pack = scene.packs.wwzard;
  pack.joints.push({
    id: 'waveNear', parent: 'root', x: 0, y: 0,
    rotation: 0, min: -180, max: 180, length: 0,
  });
  for (const id of ['left-sleeve', 'left-sleeve-shadow']) {
    const part = pack.parts.find(item => item.id === id);
    const shadow = id.endsWith('shadow');
    part.spatial.morph.layers ??= [];
    part.spatial.morph.layers.push({
      channel: 'waveNear.bend',
      frames: [{ value: .6, target: nearSleeve(folded, shadow) }],
      target: nearSleeve(waved, shadow),
    });
  }
  // The resting shoulder sits in front of the robe but behind the desk. Once
  // the bent forearm clears the desk, lift its low-depth fragment to the near layer.
  pack.parts.find(part => part.id === 'left-sleeve').spatial.depthSplit.low = {
    value: 2, channel: 'waveNear.z',
  };
  for (const id of ['left-hand','left-thumb']) {
  const hand = pack.parts.find(part => part.id === id), contour = id === 'left-hand' ? palm : thumb;
  hand.spatial.morph.layers ??= [];
  hand.spatial.morph.layers.push({
    channel: 'waveNear.bend', frames: [{ value: .6, target: contour }], target: contour,
  });
  }
  // Fingers unfold from zero-area contours while the palm opens. They share
  // the hand joint and bend channel, including captured interruption poses.
  const skin=pack.parts.find(part=>part.id==='left-hand');
  const fingers = [
    'M265 309L262 296Q261 291 265 291Q269 291 270 296L274 307Z',
    'M273 305L272 290Q272 285 277 285Q282 285 282 290L282 307Z',
    'M281 308L285 294Q286 290 290 291Q294 292 292 297L288 312Z',
  ].join('');
  const collapsed = fingers.replace(/[-+]?(?:\d*\.\d+|\d+\.?\d*)\s+[-+]?(?:\d*\.\d+|\d+\.?\d*)/g, '276 310');
  pack.parts.push({
    id: 'wave-fingers', joint: 'leftHand', d: collapsed,
    transform: skin.transform, fill: skin.fill, gradient: structuredClone(skin.gradient),
    spatial: { sceneDepth: structuredClone(skin.spatial.sceneDepth), morph: {
      channel: 'waveNear.bend', frames: [{ value: .6, target: fingers }], target: fingers,
    } },
  });
  pack.clips.greet = {
    duration: 2.2, loop: false,
    tracks: {
      'torso.rotation': keys([[0, 0], [.19, 5], [1.5, 5], [1.82, -1], [2.2, 0]]),
      'torso.x': keys([[0, 0], [.25, -4], [1.57, -4], [2.2, 0]]),
      'torso.bend': keys([[0, 0], [.22, .2], [1.55, .2], [2.2, 0]]),
      'head.rotation': keys([[0, 0], [.28, 0], [.62, 8], [1.47, 8], [1.85, -2], [2.2, 0]]),
      'head.x': keys([[0, 0], [.32, 0], [.68, -5], [1.55, -5], [2.2, 0]]),
      'hat.rotation': keys([[0, 0], [.48, 0], [.81, 3], [1.63, 3], [1.96, -1], [2.2, 0]]),
      'hatTip.bend': keys([[0, 0], [.52, 0], [.87, .42], [1.43, .34], [1.94, .1], [2.2, 0]]),
      'leftArm.rotation': keys([[0, 0], [2.2, 0]]),
      'leftArm.bend': keys([[0, 0], [2.2, 0]]),
      'leftGrip.bend': keys([[0, 0], [2.2, 0]]),
      'waveNear.bend': keys([[0, 0], [.18, .04, 'linear'], [.78, .6],
        [.91, 1], [1.13, .64], [1.34, .98], [1.56, .65],
        [1.65, .6], [2.2, 0]]),
      'waveNear.z': keys([[0, 0], [.45, 0], [.75, 38], [1.69, 38], [2, 0], [2.2, 0]]),
      'leftHand.x': keys([[0, 0], [.18, -8, 'linear'], [.78, -130],
        [.91, -118], [1.13, -129], [1.34, -119], [1.56, -128, 'linear'], [2.2, 0]]),
      'leftHand.y': keys([[0, 0], [.18, -6, 'linear'], [.78, -93],
        [.91, -97], [1.13, -93], [1.34, -97], [1.56, -93, 'linear'], [2.2, 0]]),
      'leftHand.rotation': keys([[0, 0], [.6, -3], [.88, 9], [1.11, -8],
        [1.34, 8], [1.56, -4], [2.2, 0]]),
      'rightHand.y': keys([[0, 0], [.65, -2], [1.5, -2], [2.2, 0]]),
      'rightArm.bend': keys([[0, 0], [.65, .2], [1.5, .2], [2.2, 0]]),
      'leftGrip.opacity': keys([[0, 0], [2.2, 0]]),
      ...Object.fromEntries(pack.joints.filter(joint => /^magic-\d+$/.test(joint.id))
        .map(joint => [joint.id + '.opacity', [[0, 0], [2.2, 0]]])),
    },
    events: [{ time: .78, name: 'greet-gesture' }, { time: 2.2, name: 'greet-complete' }],
  };
  // Constant channels need one key; their value is held for the entire clip.
  for (const [channel, track] of Object.entries(pack.clips.greet.tracks)) {
    if (track.every(key => key[1] === track[0][1])) pack.clips.greet.tracks[channel] = [track[0]];
  }
  for (const mood of ['disappointed', 'angry']) {
    const name = 'greet--' + mood;
    const original = pack.clips[name];
    if (!original) continue;
    const factor = original.duration / pack.clips.greet.duration;
    const tracks = Object.fromEntries(Object.entries(pack.clips.greet.tracks)
      .map(([channel, track]) => [channel, scale(track, factor)]));
    const posture = mood === 'disappointed' ? 4 : -3;
    for (const key of tracks['head.rotation'].slice(1, -1)) key[1] += posture;
    for (const key of tracks['torso.bend'].slice(1, -1))
      key[1] = Math.min(1, key[1] + (mood === 'disappointed' ? .12 : .2));
    pack.clips[name] = {
      duration: original.duration, loop: false, tracks,
      events: pack.clips.greet.events.map(event => ({
        ...event, time: Math.min(original.duration, +(event.time * factor).toFixed(2)),
      })),
    };
  }
  return scene;
}
