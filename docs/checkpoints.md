# Replay checkpoints

`IllustrationController` and the animated path of `SceneController` cache replay states during explicit seeks. They preserve input history, animation transitions, random seeds, active variation choices and offsets, behavior queues, pointer springs, campfire state, bottle waves and droplets, shared objects and catch planning.

```js
const controller = new IllustrationController(scene, {
  ...providers,
  checkpoints: { interval: 0.5, maxEntries: 32, maxBytes: 8 * 1024 * 1024 }
});
controller.seek(15);       // Builds checkpoints while replaying.
controller.seek(12.2);     // Resumes from the nearest retained checkpoint.
console.log(controller.checkpointStats());
```

Defaults are a two-second interval, 32 entries and an 8 MiB accounted payload budget. Set `checkpoints:false` to disable caching. The cache evicts entries to satisfy both limits. A state or input-history comparison that exceeds the budget falls back to normal replay. `checkpointStats()` reports retained bytes, hits, misses, replayed ticks and the most recent fallback reason.

The budget covers retained data using conservative object, string and array accounting. It is not a process RAM or JavaScript allocator limit. Snapshot construction and normal controller state require additional temporary memory.

Caches populate lazily during explicit seeking. A first seek still replays from zero. A warm seek typically replays at most one checkpoint interval when that region remains cached; eviction or a rejected snapshot can require a longer replay. Every seek reconstructs controller instances before restoring state so callbacks refer to the current instances. This setup cost remains even for an exact checkpoint hit.

New commands invalidate snapshots at and after their time. Exact serialized history comparison catches edits to earlier events. A document revision change, reset, disposal or `invalidateCheckpoints()` clears the cache. Replace the controller after editing rig or scene definitions; changing arbitrary document fields without updating its revision is unsupported.

The cache stores mutable runtime data, not rendered SVG/Canvas nodes or executable callbacks. Seek suppresses listener events while reconstructing state, then normal playback resumes event delivery. Paused and reduced-motion settings are restored after explicit scrubbing, matching existing seek behavior.

Planck ragdolls and recovery states are deliberately excluded. Their solver contacts, constraints and internal state are not reproduced by copying body positions. A physical scene replays from zero, or from an earlier fully animated checkpoint before physical motion began. No claim of bounded cold physical seeking is made.

Run `node --test test/illustration-checkpoints.test.js` for exact cached/uncached comparisons including changed input history, activity randomness, campfire interactions, fluid state, shared objects and physical fallback. `node test/checkpoint-benchmark.mjs` writes measured results to `test-results/checkpoint-benchmark.json`.

A local Node 22 measurement with four campfire characters and ten seeks measured p50 54.9 ms without caching and 30.4 ms with warm checkpoints; p95 was 77.4 ms and 34.6 ms. Thirty snapshots, including the four actor cooking graphs, used about 3.3 MB of accounted data. These figures exclude rendering and worker messaging and are not mobile frame-rate claims.
