import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const root = process.argv[2];
if (!root) throw new Error('Pass the path to the trusted local Ukis checkout.');
const context = vm.createContext({});
const source = path.join(root, 'src/core/characters/ona');
for (const filename of ['traces.js', 'hair.js', 'ona.js']) {
  vm.runInContext(fs.readFileSync(path.join(source, filename), 'utf8'), context, { filename, timeout: 5000 });
}
const activitySource = fs.readFileSync(path.join(root, 'src/modules/dashboard/activities.js'), 'utf8');
const activities = [...activitySource.matchAll(/^\s*\['([^']+)',/gm)].map(match => match[1]);
assert.ok(activities.length > 0, 'No activity entries found; review the inventory extractor.');
const scenes = Array.from(context.Ona.scenes);
const missing = activities.filter(id => !scenes.includes(id));
assert.deepEqual(missing, [], 'Dashboard activities must resolve to authored scenes.');
const coverage = scenes.map(id => {
  const svg = context.Ona.scene(id);
  assert.equal(svg.match(/data-scene="([^"]+)"/)?.[1], id);
  assert.ok(svg.startsWith('<svg'));
  return { id, traced: svg.includes('ona-traced'), actors: (svg.match(/data-actor=/g) || []).length,
    partGroups: (svg.match(/data-part=/g) || []).length };
});
console.log(JSON.stringify({ sceneCount: scenes.length, activityCount: activities.length,
  focusFallback: context.Ona.scene('focus').match(/data-scene="([^"]+)"/)?.[1],
  parts: Object.keys(context.OnaTraces.parts), coverage }, null, 2));
