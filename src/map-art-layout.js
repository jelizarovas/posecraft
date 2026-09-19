/** Pure image placement shared by spatial queries and browser drawing. */
/** Continuous NW-NE-SE / NW-SE-SW ground triangles, clamped beyond map edges. */
export function groundHeight(map, point) {
  if (!map.elevations) return 0;
  const px = Math.max(0, Math.min(map.width, point.x)), py = Math.max(0, Math.min(map.height, point.y));
  const x = Math.min(map.width - 1, Math.floor(px)), y = Math.min(map.height - 1, Math.floor(py));
  const fx = px - x, fy = py - y, stride = map.width + 1, i = y * stride + x, h = map.elevations;
  return fx >= fy
    ? h[i] + (h[i + 1] - h[i]) * fx + (h[i + stride + 1] - h[i + 1]) * fy
    : h[i] + (h[i + stride + 1] - h[i + stride]) * fx + (h[i + stride] - h[i]) * fy;
}

export function artPropSelection(map, prop) {
  const variants = map.art?.props?.[prop.kind];
  if (!variants?.length) return null;
  let hash = (2166136261 ^ map.seed) >>> 0;
  for (let i = 0; i < prop.id.length; i++) hash = Math.imul(hash ^ prop.id.charCodeAt(i), 16777619) >>> 0;
  const id = variants[hash % variants.length];
  return { id, image: map.art.images[id] };
}

export function artTerrainSelection(map, terrain) {
  const id = map.art?.terrain?.[['grass', 'road', 'water', 'sand'][terrain]];
  return id === undefined ? null : { id, image: map.art.images[id] };
}

export function mapImageBounds(map, point, image) {
  const scale = map.tileSize.width / 64;
  const width = image.width * scale, height = image.height * scale;
  return {
    x: (point.x - point.y) * map.tileSize.width / 2 - image.anchorX * width,
    y: (point.x + point.y) * map.tileSize.height / 2 - (point.z ?? groundHeight(map, point)) * map.tileSize.height - image.anchorY * height,
    width, height,
  };
}
