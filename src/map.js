/** Serializable isometric maps. Coordinates are cells; renderers use projected pixels. */
const integer = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

export function assertMap(map) {
  const fail = message => { throw new TypeError(`Invalid map: ${message}`); };
  if (!map || map.format !== 'posecraft-map' || map.version !== 1) fail('unsupported format or version');
  if (typeof map.id !== 'string' || !map.id || typeof map.name !== 'string') fail('id and name are required');
  if (!integer(map.width, 1, 512) || !integer(map.height, 1, 512)) fail('dimensions must be integers between 1 and 512');
  if (!Number.isSafeInteger(map.seed)) fail('seed must be a safe integer');
  if (!map.tileSize || !Number.isFinite(map.tileSize.width) || !Number.isFinite(map.tileSize.height)) fail('tileSize is required');
  if (!integer(map.tileSize.width, 8, 512) || !integer(map.tileSize.height, 4, 256)) fail('invalid tileSize');
  if (!Array.isArray(map.terrain) || map.terrain.length !== map.width * map.height) fail('terrain must contain one valid terrain value per cell');
  for (const value of map.terrain) if (!integer(value, 0, 3)) fail('terrain must contain one valid terrain value per cell');
  if (!Array.isArray(map.props) || map.props.length > 65536 || !Array.isArray(map.actors) || map.actors.length > 4096) fail('invalid props or actors');
  const ids = new Set();
  const occupied = new Uint8Array(map.width * map.height);
  const identify = value => {
    if (typeof value?.id !== 'string' || !value.id || ids.has(value.id)) fail('entity ids must be unique nonempty strings');
    ids.add(value.id);
  };
  for (const p of map.props) {
    identify(p);
    if (!['tree', 'rock', 'chest', 'house'].includes(p.kind)) fail(`unsupported prop kind ${p.kind}`);
    if (!integer(p.x, 0, map.width - 1) || !integer(p.y, 0, map.height - 1) || !integer(p.width, 1, 16) || !integer(p.height, 1, 16) || p.x + p.width > map.width || p.y + p.height > map.height) fail(`invalid footprint ${p.id}`);
    for (let y = p.y; y < p.y + p.height; y++) occupied.fill(1, y * map.width + p.x, y * map.width + p.x + p.width);
  }
  for (const a of map.actors) {
    identify(a);
    if (!point(a) || a.x < 0 || a.y < 0 || a.x >= map.width || a.y >= map.height || !Number.isFinite(a.speed) || a.speed <= 0 || a.speed > 100) fail(`invalid actor ${a.id}`);
    if (a.color !== undefined && (typeof a.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(a.color))) fail(`invalid actor color ${a.id}`);
    const cell = Math.floor(a.y) * map.width + Math.floor(a.x);
    if (map.terrain[cell] === 2 || occupied[cell]) fail(`actor ${a.id} starts in a blocked cell`);
  }
  return map;
}

export function projectMap(map, p) {
  return { x: (p.x - p.y) * map.tileSize.width / 2, y: (p.x + p.y) * map.tileSize.height / 2 };
}

export function unprojectMap(map, p) {
  return { x: p.x / map.tileSize.width + p.y / map.tileSize.height, y: p.y / map.tileSize.height - p.x / map.tileSize.width };
}

/** Seeded scenery with unobstructed roads and reachable village interactions. */
export function generateMap({ width = 128, height = 128, seed = 1 } = {}) {
  if (!integer(width, 8, 512) || !integer(height, 8, 512) || !Number.isSafeInteger(seed)) throw new TypeError('Invalid map generation dimensions or seed');
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const cx = Math.floor(width / 2), cy = Math.floor(height / 2);
  const terrain = new Array(width * height).fill(0), props = [];
  const lakes = Array.from({ length: Math.max(1, Math.floor(width * height / 1800)) }, () => ({ x: random() * width, y: random() * height, r: 2 + random() * 5 }));
  // Bucket lakes to keep generation linear as maps grow.
  const lakeBuckets = new Map();
  for (const lake of lakes) for (let y = Math.floor((lake.y - lake.r - 1) / 16); y <= Math.floor((lake.y + lake.r + 1) / 16); y++) for (let x = Math.floor((lake.x - lake.r - 1) / 16); x <= Math.floor((lake.x + lake.r + 1) / 16); x++) {
    const key = `${x},${y}`;
    if (!lakeBuckets.has(key)) lakeBuckets.set(key, []);
    lakeBuckets.get(key).push(lake);
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const nearVillage = Math.abs(x - cx) <= 6 && Math.abs(y - cy) <= 6;
    const road = Math.abs(x - cx) <= 1 || Math.abs(y - cy) <= 1;
    let t = road ? 1 : 0;
    if (!nearVillage && !road) for (const lake of lakeBuckets.get(`${Math.floor(x / 16)},${Math.floor(y / 16)}`) || []) {
      const d = Math.hypot(x - lake.x, (y - lake.y) * 1.25);
      if (d < lake.r) { t = 2; break; }
      if (d < lake.r + 1) t = 3;
    }
    terrain[y * width + x] = t;
    const chance = random();
    if (!nearVillage && !road && t !== 2 && chance < .13) props.push({ id: `scenery-${x}-${y}`, kind: chance < .111 ? 'tree' : 'rock', x, y, width: 1, height: 1 });
  }
  const house = { id: 'village-house', kind: 'house', x: Math.min(width - 2, cx + 2), y: Math.max(0, cy - 3), width: 2, height: 2 };
  const chest = { id: 'village-chest', kind: 'chest', x: Math.max(0, cx - 3), y: Math.min(height - 1, cy + 2), width: 1, height: 1 };
  props.push(house, chest);
  return assertMap({ format: 'posecraft-map', version: 1, id: `map-${seed}`, name: 'The wandering wood', width, height, seed, tileSize: { width: 72, height: 36 }, terrain, props, actors: [{ id: 'hero', x: cx + .5, y: cy + .5, speed: 3.2, color: '#8665be' }] });
}

/** Rebuild after terrain/footprint edits. No per-frame traversal of the map or all props. */
export class MapIndex {
  constructor(map, { chunkSize = 16 } = {}) {
    assertMap(map);
    if (!integer(chunkSize, 1, 64)) throw new TypeError('Invalid map chunk size');
    this.map = map;
    this.chunkSize = chunkSize;
    this.chunks = new Map();
    this.props = new Map();
    this.blocked = new Uint8Array(map.width * map.height);
    for (let i = 0; i < map.terrain.length; i++) this.blocked[i] = map.terrain[i] === 2 ? 1 : 0;
    for (const p of map.props) {
      this.props.set(p.id, p);
      for (let y = p.y; y < p.y + p.height; y++) for (let x = p.x; x < p.x + p.width; x++) this.blocked[y * map.width + x] = 1;
      for (let y = Math.floor(p.y / chunkSize); y <= Math.floor((p.y + p.height - 1) / chunkSize); y++) for (let x = Math.floor(p.x / chunkSize); x <= Math.floor((p.x + p.width - 1) / chunkSize); x++) {
        const key = `${x},${y}`;
        if (!this.chunks.has(key)) this.chunks.set(key, []);
        this.chunks.get(key).push(p);
      }
    }
  }
  isBlocked(x, y) {
    x = Math.floor(x); y = Math.floor(y);
    return !Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x >= this.map.width || y >= this.map.height || this.blocked[y * this.map.width + x] === 1;
  }
  prop(id) { return this.props.get(id); }
  visible(rect, overscan = 128) {
    if (!point(rect) || !Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width <= 0 || rect.height <= 0 || !Number.isFinite(overscan) || overscan < 0 || overscan > 2048) throw new TypeError('Invalid map viewport');
    const map = this.map, tw = map.tileSize.width, th = map.tileSize.height;
    // Map-browser props scale with tile width. Include roofs and canopies whose
    // footprints sit below the viewport, even with large authored tile sizes.
    const propHeight = 110 * tw / 64;
    const view = { x: rect.x - overscan, y: rect.y - overscan, width: rect.width + overscan * 2, height: rect.height + overscan * 2 };
    const corners = [{ x: view.x - tw, y: view.y - th }, { x: view.x + view.width + tw, y: view.y - th }, { x: view.x - tw, y: view.y + view.height + propHeight }, { x: view.x + view.width + tw, y: view.y + view.height + propHeight }].map(p => unprojectMap(map, p));
    const minX = clamp(Math.floor(Math.min(...corners.map(p => p.x))), 0, map.width - 1);
    const maxX = clamp(Math.ceil(Math.max(...corners.map(p => p.x))), 0, map.width - 1);
    const minY = clamp(Math.floor(Math.min(...corners.map(p => p.y))), 0, map.height - 1);
    const maxY = clamp(Math.ceil(Math.max(...corners.map(p => p.y))), 0, map.height - 1);
    const tiles = [], props = [], found = new Set();
    const stats = { visitedChunks: 0, candidateTiles: 0, candidateProps: 0 };
    const intersects = (left, top, right, bottom) => right >= view.x && bottom >= view.y && left <= view.x + view.width && top <= view.y + view.height;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      stats.candidateTiles++;
      const p = projectMap(map, { x: x + .5, y: y + .5 });
      if (intersects(p.x - tw / 2, p.y - th / 2, p.x + tw / 2, p.y + th / 2)) tiles.push({ x, y, terrain: map.terrain[y * map.width + x] });
    }
    for (let cy = Math.floor(minY / this.chunkSize); cy <= Math.floor(maxY / this.chunkSize); cy++) for (let cx = Math.floor(minX / this.chunkSize); cx <= Math.floor(maxX / this.chunkSize); cx++) {
      stats.visitedChunks++;
      for (const prop of this.chunks.get(`${cx},${cy}`) || []) {
        if (found.has(prop.id)) continue;
        found.add(prop.id); stats.candidateProps++;
        const center = projectMap(map, { x: prop.x + prop.width / 2, y: prop.y + prop.height / 2 });
        const rx = (prop.width + prop.height) * tw / 4, ry = (prop.width + prop.height) * th / 4;
        if (intersects(center.x - rx - tw / 2, center.y - ry - propHeight, center.x + rx + tw / 2, center.y + ry)) props.push(prop);
      }
    }
    return { tiles, props, stats };
  }
}

export function approachTiles(map, index, prop) {
  if (!prop || index.prop(prop.id) !== prop) throw new TypeError('Unknown map prop');
  const result = [];
  const add = (x, y) => { if (!index.isBlocked(x, y)) result.push({ x: x + .5, y: y + .5 }); };
  // The standard house artwork places its door at the center of its +Y wall.
  // An obstructed entrance must fail rather than interact through another wall.
  if (prop.kind === 'house') {
    const first = Math.floor((prop.width - 1) / 2), last = Math.ceil((prop.width - 1) / 2);
    for (let x = first; x <= last; x++) add(prop.x + x, prop.y + prop.height);
    return result;
  }
  for (let x = prop.x; x < prop.x + prop.width; x++) { add(x, prop.y - 1); add(x, prop.y + prop.height); }
  for (let y = prop.y; y < prop.y + prop.height; y++) { add(prop.x - 1, y); add(prop.x + prop.width, y); }
  return result;
}

// Binary min-heap; duplicate entries are discarded when expanded.
class Heap {
  items = [];
  push(value) {
    const a = this.items; let i = a.length; a.push(value);
    while (i > 0) { const p = (i - 1) >> 1; if (a[p].f <= value.f) break; a[i] = a[p]; i = p; }
    a[i] = value;
  }
  pop() {
    const a = this.items, first = a[0], last = a.pop();
    if (a.length) {
      let i = 0;
      while (i * 2 + 1 < a.length) { let c = i * 2 + 1; if (c + 1 < a.length && a[c + 1].f < a[c].f) c++; if (a[c].f >= last.f) break; a[i] = a[c]; i = c; }
      a[i] = last;
    }
    return first;
  }
}

/** A bounded incremental weighted A* job; call step between rendering frames or in a worker. */
export class MapPathJob {
  constructor(map, index, start, goals, { diagonal = true, maxVisited = map.width * map.height } = {}) {
    if (index.map !== map || !point(start) || !integer(maxVisited, 1, map.width * map.height)) throw new TypeError('Invalid path job');
    this.map = map; this.index = index; this.diagonal = diagonal; this.maxVisited = maxVisited;
    this.result = { status: 'pending', path: null, reason: null, visited: 0 };
    this.goals = (Array.isArray(goals) ? goals : [goals]);
    if (!this.goals.length || this.goals.some(p => !point(p))) throw new TypeError('Path goals are required');
    this.goals = this.goals.filter(p => !index.isBlocked(p.x, p.y)).map(p => ({ x: Math.floor(p.x), y: Math.floor(p.y) }));
    this.goalIds = new Set(this.goals.map(p => p.y * map.width + p.x));
    this.open = new Heap(); this.cost = new Float64Array(map.width * map.height).fill(Infinity); this.parents = new Int32Array(map.width * map.height).fill(-1); this.closed = new Uint8Array(map.width * map.height);
    if (index.isBlocked(start.x, start.y)) this.fail('blocked-start');
    else if (!this.goals.length) this.fail('blocked-target');
    else { const x = Math.floor(start.x), y = Math.floor(start.y), id = y * map.width + x; this.cost[id] = 0; this.open.push({ id, g: 0, f: this.heuristic(x, y) }); }
  }
  heuristic(x, y) {
    let best = Infinity;
    for (const goal of this.goals) { const dx = Math.abs(x - goal.x), dy = Math.abs(y - goal.y); best = Math.min(best, this.diagonal ? Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy) : dx + dy); }
    return best;
  }
  fail(reason) { this.result.status = 'failed'; this.result.reason = reason; }
  step(budget = 128) {
    if (!integer(budget, 1, 10000)) throw new TypeError('Path budget must be between 1 and 10000');
    let work = 0;
    while (this.result.status === 'pending' && this.open.items.length && work++ < budget) {
      const node = this.open.pop();
      if (this.closed[node.id] || node.g !== this.cost[node.id]) continue;
      this.closed[node.id] = 1; this.result.visited++;
      if (this.goalIds.has(node.id)) {
        const path = []; let id = node.id;
        while (id !== -1) { path.push({ x: id % this.map.width + .5, y: Math.floor(id / this.map.width) + .5 }); id = this.parents[id]; }
        this.result.status = 'complete'; this.result.path = path.reverse(); break;
      }
      if (this.result.visited >= this.maxVisited) { this.fail('search-limit'); break; }
      const x = node.id % this.map.width, y = Math.floor(node.id / this.map.width);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || (!this.diagonal && dx && dy)) continue;
        const nx = x + dx, ny = y + dy;
        if (this.index.isBlocked(nx, ny) || (dx && dy && (this.index.isBlocked(x + dx, y) || this.index.isBlocked(x, y + dy)))) continue;
        const id = ny * this.map.width + nx;
        if (this.closed[id]) continue;
        const t = this.map.terrain[id], g = node.g + (dx && dy ? Math.SQRT2 : 1) * (t === 1 ? 1 : t === 3 ? 1.6 : 1.2);
        if (g >= this.cost[id]) continue;
        this.cost[id] = g; this.parents[id] = node.id; this.open.push({ id, g, f: g + this.heuristic(nx, ny) });
      }
    }
    if (this.result.status === 'pending' && !this.open.items.length) this.fail('unreachable');
    return this.result;
  }
}
