// Where can a rider ask to go? Gathers destination candidates around a point.
//
// The worldgen PLAN is the main source: it knows every stage, court, market,
// drum circle and camp even where the world has not streamed in, which matters
// because a 300 m destination is usually outside the loaded chunks. The live
// registry adds the places the plan does not describe (beaches, hammocks,
// forest drum circles) and the exact porta-potties for the urgent run.
//
// Called once per boarding, never per frame. All reads are pure/memoized; no
// seeded stream is advanced.
import { heartsInBounds } from '../worldgen/hearts.js';
import { festivalPlan, campVillagesNear, MAX_POI_REACH } from '../worldgen/festival.js';
import { FESTIVAL_TUNING } from '../worldgen/tuning.js';
import { lakeAt } from '../worldgen/water.js';
import { quantize } from '../rng.js';
import { QUEST } from './catalog.js';
export { isGenericFacility, resolveNearbyFacility } from './facilityArrival.js';

const STAGES = new Set(['main_stage', 'side_stage', 'tent_stage']);
const PLAN_KINDS = new Set(['food_court', 'vendor_row', 'drum_circle', 'arch', 'healing_arts']);
// registry kind -> quest kind
const REGISTRY_KINDS = { beach: 'beach', hammock: 'hammock', forest_drum_circle: 'drum_circle', porta_potty: 'porta_potty' };
const LEGACY_REGISTRY_KINDS = { stage_front: 'side_stage', drum_circle: 'drum_circle', campsite: 'camp_village', arch: 'arch' };

function fromPlan(d) {
  const T = FESTIVAL_TUNING;
  if (STAGES.has(d.kind)) {
    // Riders want the dance floor, not the back of the deck: aim in front of
    // the stage along its facing (+Z under yaw, matching clusterShapes).
    const scale = d.scale || 1;
    const out = (T.KIND_FOOTPRINT[d.kind] || 11) * scale + T.DANCEFLOOR_DEPTH_BASE * scale * 0.55;
    return { kind: d.kind, x: d.x + Math.sin(d.yaw) * out, z: d.z + Math.cos(d.yaw) * out };
  }
  if (d.kind === 'camp_village') return { kind: 'camp_village', x: d.x, z: d.z, radius: Math.min(60, (d.footprint || 30) + 10) };
  if (d.kind === 'welfare_post') return { kind: 'porta_potty', x: d.x, z: d.z, radius: 18 };
  if (PLAN_KINDS.has(d.kind)) return { kind: d.kind, x: d.x, z: d.z };
  return null;
}

// `origin` is { x, z }. `reach` defaults to the farthest any quest type looks.
export function gatherDestinations(origin, { registry, worldgen = true, reach = QUEST.MAX_DIST, extra = [] } = {}) {
  const out = [];
  const within = (x, z) => Math.hypot(x - origin.x, z - origin.z) <= reach;
  if (worldgen) {
    const pad = reach + MAX_POI_REACH;
    const hearts = heartsInBounds(origin.x - pad, origin.z - pad, origin.x + pad, origin.z + pad);
    const plans = [];
    for (const heart of hearts) {
      // A hub farther than its longest POI reach cannot place anything in range.
      if (Math.hypot(heart.x - origin.x, heart.z - origin.z) > pad) continue;
      for (const d of festivalPlan(heart)) plans.push(d);
    }
    for (const d of campVillagesNear({ minX: origin.x - reach, minZ: origin.z - reach, maxX: origin.x + reach, maxZ: origin.z + reach })) plans.push(d);
    for (const d of plans) {
      const c = fromPlan(d);
      if (!c || !within(c.x, c.z)) continue;
      if (lakeAt(quantize(c.x), quantize(c.z))) continue;   // never ask to be dropped in a lake
      out.push(c);
    }
  }
  if (registry) {
    const kinds = worldgen ? REGISTRY_KINDS : { ...REGISTRY_KINDS, ...LEGACY_REGISTRY_KINDS };
    // Hammocks and potties come in clumps; one request per ~40 m cell is plenty.
    const seen = new Set();
    for (const [registryKind, kind] of Object.entries(kinds)) {
      for (const id of registry.byKind.get(registryKind) || []) {
        const entry = registry.entries.get(id);
        if (kind === 'hammock' && (!entry?.hammock || entry.hammock.occupied)) continue;
        const p = entry?.position;
        if (!p || !within(p.x, p.z)) continue;
        const cell = kind === 'porta_potty' ? null : `${kind}:${Math.floor(p.x / 40)},${Math.floor(p.z / 40)}`;
        if (cell) { if (seen.has(cell)) continue; seen.add(cell); }
        out.push({ kind, x: p.x, z: p.z, ...(kind === 'porta_potty' ? { radius: 16, exact: true } : {}) });
      }
    }
    // A built potty beats the plan's welfare-post centre for the same bank.
    const exact = out.filter((c) => c.exact);
    if (exact.length) for (let i = out.length - 1; i >= 0; i--) {
      const c = out[i];
      if (c.kind === 'porta_potty' && !c.exact && exact.some((e) => Math.hypot(e.x - c.x, e.z - c.z) < 30)) out.splice(i, 1);
    }
  }
  for (const c of extra) if (c && within(c.x, c.z)) out.push(c);
  return out;
}
