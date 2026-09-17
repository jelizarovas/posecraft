const easings = ['linear', 'smooth', 'step'];
const number = value => typeof value === 'number' && Number.isFinite(value);
const id = key => JSON.stringify([key.track, key.time]);
const quantize = time => Math.round(time * 1000) / 1000;

/** Pure clip edit. Callers commit the returned clip in one validated DocumentStore transaction. */
export function editTimelineKeys(clip, selection, operation) {
  if (!clip || !number(clip.duration) || clip.duration < .1 || clip.duration > 180 || typeof clip.loop !== 'boolean' || !clip.tracks || typeof clip.tracks !== 'object' || Array.isArray(clip.tracks)) throw new Error('Invalid animation clip.');
  for (const [track, keys] of Object.entries(clip.tracks)) {
    if (!Array.isArray(keys) || !keys.length || keys.length > 1000 || keys.some((key, i) => !Array.isArray(key) || key.length < 2 || key.length > 3 || !number(key[0]) || !number(key[1]) || key[0] < 0 || key[0] > clip.duration || i > 0 && key[0] <= keys[i - 1][0] || key[2] !== undefined && !easings.includes(key[2]))) throw new Error(`Invalid keys in ${track}.`);
  }
  if (!Array.isArray(selection) || !selection.length) throw new Error('Select one or more keys first.');
  const selected = new Map();
  for (const ref of selection) {
    if (!ref || typeof ref.track !== 'string' || !number(ref.time) || !Object.hasOwn(clip.tracks, ref.track) || !clip.tracks[ref.track].some(key => key[0] === ref.time)) throw new Error('A selected key no longer exists. Select it again.');
    selected.set(id(ref), ref);
  }
  if (!operation || !['move', 'copy', 'scale', 'delete', 'easing'].includes(operation.type)) throw new Error('Unknown key operation.');
  if (['move', 'copy'].includes(operation.type) && !number(operation.offset)) throw new Error('Enter a finite time offset in seconds.');
  if (operation.type === 'scale' && (!number(operation.factor) || operation.factor <= 0 || !number(operation.pivot))) throw new Error('Scale must be positive and its anchor must be a finite time.');
  if (operation.type === 'easing' && !easings.includes(operation.easing)) throw new Error('Choose Linear, Smooth or Step easing.');
  const result = structuredClone(clip), nextSelection = [];
  for (const [track, keys] of Object.entries(clip.tracks)) {
    const output = [], affected = [];
    for (const key of keys) {
      if (!selected.has(id({track, time:key[0]}))) { output.push([...key]); continue; }
      if (operation.type === 'delete') continue;
      if (operation.type === 'copy') output.push([...key]);
      const next = [...key];
      if (['move', 'copy'].includes(operation.type)) next[0] = quantize(key[0] + operation.offset);
      if (operation.type === 'scale') next[0] = quantize(operation.pivot + (key[0] - operation.pivot) * operation.factor);
      if (operation.type === 'easing') next[2] = operation.easing;
      if (!number(next[0]) || next[0] < 0 || next[0] > clip.duration) throw new Error(`Keys must stay between 0 and ${clip.duration} seconds. No keys changed.`);
      affected.push(next); nextSelection.push({track, time:next[0]});
    }
    output.push(...affected); output.sort((a,b) => a[0] - b[0]);
    if (output.some((key,i) => i > 0 && Math.abs(key[0] - output[i-1][0]) < .0000001)) throw new Error(`Keys would overlap in ${track}. No keys changed.`);
    if (output.length > 1000) throw new Error('A track can hold at most 1,000 keys. No keys changed.');
    if (output.length) result.tracks[track] = output; else delete result.tracks[track];
  }
  return {clip:result, selection:nextSelection};
}
