// Separate seeded encounters from frame rate and the world's shared RNG streams.
export const NUT_WAGON_TUNING = Object.freeze({
  worldScale: 1.6, speed: .75, stopSeconds: 24, cruiseSeconds: 48, stallSeconds: 8,
  encounterSeconds: 45, normalChance: .08, tripChance: .8,
  spawnMin: 65, spawnMax: 145, despawnDistance: 245,
});

export function makeWagonRoute(points) {
  const route = {points: [], distances: [], length: 0};
  for (const p of points) {
    const prev = route.points.at(-1);
    const d = prev ? Math.hypot(p.x - prev.x, p.z - prev.z) : 0;
    if (prev && d < .001) continue;
    route.length += d;
    route.points.push({x: p.x, z: p.z}); route.distances.push(route.length);
  }
  return route;
}

export function sampleWagonRoute(route, distance, out) {
  const d = Math.max(0, Math.min(route.length, distance));
  for (let i = 1; i < route.points.length; i++) {
    if (d > route.distances[i]) continue;
    const a = route.points[i - 1], b = route.points[i];
    const t = (d - route.distances[i - 1]) / (route.distances[i] - route.distances[i - 1]);
    out.x = a.x + (b.x - a.x) * t; out.z = a.z + (b.z - a.z) * t;
    out.heading = Math.atan2(b.x - a.x, b.z - a.z); return out;
  }
  return null;
}

// Dense checks cover the corridor between road vertices, including unloaded water.
export function wagonRoutes(roads, center, isClear, radius = 150) {
  const routes = [];
  for (const road of roads) {
    let run = [];
    const flush = () => {
      const route = makeWagonRoute(run);
      if (route.length >= 28) routes.push(route);
      run = [];
    };
    for (let i = 1; i < road.length; i++) {
      const a = road[i - 1], b = road[i];
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
      for (let j = 0; j <= n; j++) {
        const x = a.x + (b.x - a.x) * j / n, z = a.z + (b.z - a.z) * j / n;
        if (Math.hypot(x - center.x, z - center.z) > radius || !isClear(x, z, Math.atan2(b.x - a.x, b.z - a.z))) flush();
        else run.push({x, z});
      }
    }
    flush();
  }
  return routes;
}

// Conservative model-local rectangles include the open hatch and offset platform.
// Keeping these separate avoids pretending that the entire car is platform-wide.
const FOOTPRINTS = [
  {x: 0, z: -.3, halfX: .96, halfZ: 2.7},
  {x: -.55, z: 2.82, halfX: .65, halfZ: .60},
];
export function wagonOverlapsCircle(x, z, yaw, ox, oz, radius) {
  const c = Math.cos(yaw), s = Math.sin(yaw), scale = NUT_WAGON_TUNING.worldScale;
  const dx = ox - x, dz = oz - z;
  const lx = (dx * c - dz * s) / scale, lz = (dx * s + dz * c) / scale;
  for (const box of FOOTPRINTS) {
    const ex = Math.max(0, Math.abs(lx - box.x) - box.halfX);
    const ez = Math.max(0, Math.abs(lz - box.z) - box.halfZ);
    if (ex * ex + ez * ez <= ((radius + .12) / scale) ** 2) return true;
  }
  return false;
}

// Sample the full covered area, including corners, at less than one world metre.
const WATER_SAMPLES = FOOTPRINTS.flatMap(box => {
  const out = [], nx = Math.ceil(box.halfX * 2 / .5), nz = Math.ceil(box.halfZ * 2 / .5);
  for (let ix = 0; ix <= nx; ix++) for (let iz = 0; iz <= nz; iz++) {
    out.push([(box.x - box.halfX + ix * box.halfX * 2 / nx) * NUT_WAGON_TUNING.worldScale,
      (box.z - box.halfZ + iz * box.halfZ * 2 / nz) * NUT_WAGON_TUNING.worldScale]);
  }
  return out;
});
export function wagonTouchesWater(x, z, yaw, isWater) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return WATER_SAMPLES.some(([lx, lz]) => isWater(x + lx * c + lz * s, z - lx * s + lz * c));
}
