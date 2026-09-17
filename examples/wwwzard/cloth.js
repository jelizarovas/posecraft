const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// A spring hem, not a 3D cloth mesh. The waist stays attached to the torso.
// Capsule contacts approximate the legs; displacement limits keep the silhouette stable.
export function hemTargets(world, stance = 0) {
  const torso = world.torso;
  return Array.from({ length: 9 }, (_, i) => {
    const x = -84 + i * 21;
    const y = 74 + stance * 36 + Math.sin(i / 8 * Math.PI) * 8;
    const a = torso.rotation * Math.PI / 180;
    return { x: torso.x + x * Math.cos(a) - y * Math.sin(a), y: torso.y + x * Math.sin(a) + y * Math.cos(a) };
  });
}

export function createCloth(world, stance) {
  return hemTargets(world, stance).map(point => ({ ...point, vx: 0, vy: 0 }));
}

function resolveContact(point, a, b, fallback) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  const x = a.x + t * dx, y = a.y + t * dy;
  const distance = Math.hypot(point.x - x, point.y - y);
  if (distance >= 14) return;
  const nx = distance > .001 ? (point.x - x) / distance : fallback;
  const ny = distance > .001 ? (point.y - y) / distance : 0;
  point.x = x + nx * 14; point.y = y + ny * 14;
  const inward = point.vx * nx + point.vy * ny;
  if (inward < 0) { point.vx -= inward * nx; point.vy -= inward * ny; }
}

export function stepCloth(previous, world, stance, dt, time, enabled = true) {
  const targets = hemTargets(world, stance);
  if (!enabled) return createCloth(world, stance);
  const points = previous.map(point => ({ ...point }));
  const duration = Math.min(dt, .1);
  const steps = Math.max(1, Math.ceil(duration * 120));
  const h = duration / steps;
  for (let step = 0; step < steps; step++) {
    const forces = points.map((point, i) => {
      let fx = (targets[i].x - point.x) * 95 - point.vx * 13;
      let fy = (targets[i].y - point.y) * 110 - point.vy * 15 + 9;
      for (const neighbor of [i-1,i+1]) {
        if (!points[neighbor]) continue;
        fx += ((points[neighbor].x - point.x) - (targets[neighbor].x - targets[i].x)) * 35;
        fy += ((points[neighbor].y - point.y) - (targets[neighbor].y - targets[i].y)) * 35;
      }
      fx += Math.sin(time * 1.7 + i * .35) * 5;
      return { fx, fy };
    });
    points.forEach((point, i) => {
      point.vx += forces[i].fx * h; point.vy += forces[i].fy * h;
      point.x += point.vx * h; point.y += point.vy * h;
      for (const side of ['left','right']) {
        const knee = world[side + 'Calf'];
        if (knee) resolveContact(point, knee, {x:knee.endX,y:knee.endY}, i < 4 ? -1 : 1);
      }
      point.x = clamp(point.x, targets[i].x - 28, targets[i].x + 28);
      point.y = clamp(point.y, targets[i].y - 24, targets[i].y + 24);
      if (i > 0) point.x = Math.max(point.x, points[i-1].x + 7);
    });
  }
  return points;
}
