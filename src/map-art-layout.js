/** Pure image placement shared by spatial queries and browser drawing. */
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
    y: (point.x + point.y) * map.tileSize.height / 2 - image.anchorY * height,
    width, height,
  };
}
