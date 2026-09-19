import test from 'node:test';
import assert from 'node:assert/strict';
import { assertMap, generateMap, projectMap, unprojectMap, MapIndex, MapPathJob, approachTiles } from '../src/map.js';
import { artPropSelection, artTerrainSelection, mapImageBounds } from '../src/map-art-layout.js';

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

function mapArt() {
  return { images: {
    pine: { src: './art/pine.png', width: 80, height: 160, anchorX: .5, anchorY: .95 },
    oak: { src: 'https://example.com/oak.png', width: 120, height: 130, anchorX: .5, anchorY: 1 },
    grass: { src: 'http://127.0.0.1:4173/grass.png', width: 64, height: 32, anchorX: .5, anchorY: .5 },
  }, props: { tree: ['pine', 'oak'] }, terrain: { grass: 'grass' } };
}

test('optional art survives JSON round trips and prop variants remain deterministic', () => {
  const map = generateMap({ seed: 2026 }); map.art = mapArt();
  const reopened = assertMap(JSON.parse(JSON.stringify(map)));
  assert.deepEqual(reopened.art, map.art);
  const trees = map.props.filter(p => p.kind === 'tree').slice(0, 20);
  const before = trees.map(p => artPropSelection(map, p).id);
  const after = trees.map(p => artPropSelection(reopened, p).id);
  assert.deepEqual(after, before);assert.equal(new Set(before).size, 2);
  assert.equal(artTerrainSelection(map, 0).id, 'grass');
  assert.equal(artTerrainSelection(map, 2), null);
  assert.equal(artPropSelection(map, map.props.find(p => p.kind === 'house')), null);
});

test('custom image culling includes large sprites with offscreen bases in every direction', () => {
  const map = empty(128, 128), prop = { id: 'large', kind: 'tree', x: 60, y: 60, width: 1, height: 1 };
  map.props.push(prop);
  for (const anchor of [0, 1]) {
    map.art = { images: { huge: { src: './huge.png', width: 1024, height: 1024, anchorX: anchor, anchorY: anchor } }, props: { tree: ['huge'] } };
    const bounds = mapImageBounds(map, { x: 60.5, y: 60.5 }, map.art.images.huge);
    const rect = { x: bounds.x + (anchor ? 20 : bounds.width - 60), y: bounds.y + (anchor ? 20 : bounds.height - 60), width: 40, height: 40 };
    const visible = new MapIndex(map).visible(rect, 0);
    assert.ok(visible.props.some(p => p.id === 'large'));
    assert.ok(!visible.tiles.some(p => p.x === 60 && p.y === 60));
    const plain = structuredClone(map);delete plain.art;
    assert.equal(visible.stats.candidateTiles, new MapIndex(plain).visible(rect, 0).stats.candidateTiles, 'prop image size does not inflate terrain query work');
  }
});

test('large terrain texture dimensions do not expand tile geometry or viewport work', () => {
  const map = empty(64, 64);
  map.terrain.fill(1);map.terrain[30 * 64 + 30] = 0;
  map.art = { images: { grass: { src: './grass.png', width: 64, height: 512, anchorX: .5, anchorY: 1 } }, terrain: { grass: 'grass' } };
  const center = projectMap(map, { x: 30.5, y: 30.5 });
  const view = new MapIndex(map).visible({ x: center.x - 10, y: center.y - 500, width: 20, height: 30 }, 0);
  assert.ok(!view.tiles.some(p => p.x === 30 && p.y === 30));
  const plain=structuredClone(map);delete plain.art;
  const baseline=new MapIndex(plain).visible({ x: center.x - 10, y: center.y - 500, width: 20, height: 30 }, 0);
  assert.equal(view.stats.candidateTiles,baseline.stats.candidateTiles);
});

test('invalid image references, URLs and dimensions fail before loading', () => {
  const edits = [
    a => { a.props.tree = ['missing']; }, a => { a.terrain.water = 'missing'; },
    a => { a.images.pine.width = 1025; }, a => { a.images.pine.height = 0; },
    a => { a.images.pine.anchorX = -1; }, a => { a.images.pine.anchorY = NaN; },
    a => { a.props.tree = []; }, a => { a.props.tree = Array(1); },
    a => { for (let i = 0; i < 65; i++) a.images[`extra-${i}`] = { ...a.images.pine }; },
  ];
  for (const src of ['javascript:alert(1)', 'file:///tmp/pine.png', '//evil.example/tree.png', 'http://example.com/tree.png', 'https://user:password@example.com/tree.png', 'data:image/png;base64,AAAA', 'https:\\example.com\\tree.png']) edits.push(a => { a.images.pine.src = src; });
  for (const edit of edits) { const map = empty();map.art = mapArt();edit(map.art);assert.throws(() => assertMap(map), /Invalid map/); }
  for (const src of ['./tree.png', '/assets/tree.png', 'https://example.com/tree.png', 'http://localhost:4173/tree.png', 'http://127.0.0.1/tree.png', 'http://[::1]/tree.png']) { const map = empty();map.art = mapArt();map.art.images.pine.src = src;assert.doesNotThrow(() => assertMap(map)); }
});
