import test from 'node:test';
import assert from 'node:assert/strict';
import { assertMap, generateMap, projectMap, unprojectMap, MapIndex, MapPathJob, approachTiles } from '../src/map.js';

function empty(width = 16, height = 16) {
  return { format: 'posecraft-map', version: 1, id: 'test', name: 'Test', width, height, seed: 1, tileSize: { width: 72, height: 36 }, terrain: Array(width * height).fill(0), props: [], actors: [] };
}
function finish(job, budget = 13) {
  for (let step = 0; step < 100000 && job.result.status === 'pending'; step++) {
    const before = job.result.visited;
    job.step(budget);
    assert.ok(job.result.visited - before <= budget, 'search respects work budget');
  }
  return job.result;
}

test('map projection preserves fractional coordinates including outside map', () => {
  const map = empty();
  for (const p of [{ x: .5, y: .5 }, { x: 114.73, y: 277.65 }, { x: -6, y: 4 }]) {
    const roundtrip = unprojectMap(map, projectMap(map, p));
    assert.ok(Math.abs(roundtrip.x - p.x) < 1e-10);
    assert.ok(Math.abs(roundtrip.y - p.y) < 1e-10);
  }
});

test('generated maps are deterministic and village targets reachable across seeds and sizes', () => {
  assert.deepEqual(generateMap({ seed: 55 }), generateMap({ seed: 55 }));
  assert.notDeepEqual(generateMap({ seed: 55 }).terrain, generateMap({ seed: 56 }).terrain);
  for (const size of [8, 16, 128, 512]) for (const seed of [0, 8, 2026]) {
    const map = generateMap({ width: size, height: size, seed }), index = new MapIndex(map);
    for (const id of ['village-house', 'village-chest']) {
      const prop = index.prop(id), goals = approachTiles(map, index, prop);
      const result = finish(new MapPathJob(map, index, map.actors[0], goals));
      assert.equal(result.status, 'complete');
      assert.ok(goals.some(goal => goal.x === result.path.at(-1).x && goal.y === result.path.at(-1).y));
    }
  }
});

test('viewport query work stays local as map grows and never scans all props', () => {
  const counts = [];
  for (const size of [128, 512]) {
    const map = generateMap({ width: size, height: size }), index = new MapIndex(map);
    const center = projectMap(map, map.actors[0]);
    const visible = index.visible({ x: center.x - 400, y: center.y - 300, width: 800, height: 600 }, 40);
    assert.ok(visible.tiles.length > 200);
    assert.ok(visible.stats.candidateTiles < 3000, JSON.stringify(visible.stats));
    assert.ok(visible.stats.visitedChunks < 25);
    assert.ok(visible.stats.candidateProps < map.props.length / 2);
    counts.push(visible.stats.candidateTiles);
    assert.equal(new Set(visible.props.map(p => p.id)).size, visible.props.length);
  }
  assert.equal(counts[0], counts[1], 'viewport cost independent of total map size');
});

test('visible query retains tall props whose base is below screen', () => {
  const map = empty(64, 64);
  map.props.push({ id: 'tree', kind: 'tree', x: 30, y: 30, width: 1, height: 1 });
  const index = new MapIndex(map), base = projectMap(map, { x: 30.5, y: 30.5 });
  const view = index.visible({ x: base.x - 50, y: base.y - 90, width: 100, height: 60 }, 0);
  assert.ok(view.props.some(p => p.id === 'tree'));
  assert.ok(!view.tiles.some(t => t.x === 30 && t.y === 30));
});

test('tall prop culling scales with authored tile dimensions', () => {
  const map = empty(64, 64);
  map.tileSize = { width: 512, height: 256 };
  map.props.push({ id: 'tree', kind: 'tree', x: 30, y: 30, width: 1, height: 1 });
  const index = new MapIndex(map), base = projectMap(map, { x: 30.5, y: 30.5 });
  const view = index.visible({ x: base.x - 50, y: base.y - 550, width: 100, height: 60 }, 0);
  assert.ok(view.props.some(p => p.id === 'tree'));
  assert.ok(!view.tiles.some(t => t.x === 30 && t.y === 30));
});

test('footprint routing avoids obstacles, uses exact cell centers and never cuts corners', () => {
  const map = empty();
  map.props.push({ id: 'house', kind: 'house', x: 4, y: 3, width: 4, height: 5 });
  const index = new MapIndex(map), result = finish(new MapPathJob(map, index, { x: 2.5, y: 4.5 }, { x: 10.5, y: 4.5 }));
  assert.equal(result.status, 'complete');
  for (let i = 0; i < result.path.length; i++) {
    const p = result.path[i];
    assert.equal(p.x % 1, .5); assert.equal(p.y % 1, .5); assert.ok(!index.isBlocked(p.x, p.y));
    if (i) {
      const prior = result.path[i - 1];
      if (p.x !== prior.x && p.y !== prior.y) { assert.ok(!index.isBlocked(p.x, prior.y)); assert.ok(!index.isBlocked(prior.x, p.y)); }
    }
  }
  const approaches = approachTiles(map, index, index.prop('house'));
  assert.deepEqual(approaches, [{ x: 5.5, y: 8.5 }, { x: 6.5, y: 8.5 }]);
});

test('house interaction approaches its rendered door and cannot use a blocked entrance', () => {
  const map = empty();
  map.props.push({ id: 'house', kind: 'house', x: 5, y: 5, width: 3, height: 2 });
  const index = new MapIndex(map), goals = approachTiles(map, index, index.prop('house'));
  assert.deepEqual(goals, [{ x: 6.5, y: 7.5 }]);
  const result = finish(new MapPathJob(map, index, { x: 6.5, y: 3.5 }, goals));
  assert.equal(result.status, 'complete');
  assert.deepEqual(result.path.at(-1), { x: 6.5, y: 7.5 });
  map.terrain[7 * map.width + 6] = 2;
  const blocked = new MapIndex(map);
  assert.deepEqual(approachTiles(map, blocked, blocked.prop('house')), []);
});

test('path failures are explicit and searches bounded', () => {
  const map = empty();
  for (let y = 0; y < 16; y++) map.terrain[y * 16 + 8] = 2;
  const index = new MapIndex(map);
  assert.equal(finish(new MapPathJob(map, index, { x: 2.5, y: 2.5 }, { x: 12.5, y: 2.5 })).reason, 'unreachable');
  assert.equal(finish(new MapPathJob(map, index, { x: 2.5, y: 2.5 }, { x: 7.5, y: 7.5 }, { maxVisited: 2 })).reason, 'search-limit');
  assert.equal(new MapPathJob(map, index, { x: 8.5, y: 2.5 }, { x: 1.5, y: 1.5 }).result.reason, 'blocked-start');
  assert.equal(new MapPathJob(map, index, { x: 1.5, y: 1.5 }, { x: 8.5, y: 2.5 }).result.reason, 'blocked-target');
});

test('terrain cost favors longer road over slow sand', () => {
  const map = empty(); map.terrain.fill(3);
  for (let x = 1; x <= 12; x++) map.terrain[4 * 16 + x] = 1;
  const index = new MapIndex(map);
  const result = finish(new MapPathJob(map, index, { x: 1.5, y: 5.5 }, { x: 12.5, y: 5.5 }, { diagonal: false }));
  assert.equal(result.status, 'complete');
  assert.ok(result.path.some(p => p.y === 4.5));
});

test('invalid imported maps fail before index allocation', () => {
  for (const edit of [m => { m.width = 513; }, m => { m.terrain.pop(); }, m => { m.terrain[2] = NaN; }, m => { m.tileSize.width = Infinity; }, m => { m.props.push({ id: 'bad', kind: 'tree', x: 15, y: 1, width: 2, height: 1 }); }, m => { m.actors.push({ id: 'hero', x: NaN, y: 1, speed: 2 }); }]) {
    const map = empty(); edit(map); assert.throws(() => new MapIndex(map), /Invalid map/);
  }
  const map = empty(); map.terrain[0] = 2; map.actors.push({ id: 'hero', x: .5, y: .5, speed: 2 });
  assert.throws(() => assertMap(map), /blocked cell/);
});
