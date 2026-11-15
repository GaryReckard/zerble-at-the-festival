// "Take me to the mountaintop": destinations from admitted Mountain Top
// districts. Only districts the landscape planner has already admitted
// (`ready`) qualify, so the request always names a place with a real road up
// to it, never an arbitrary high point or an unreachable face. The read does
// not ask the planner for new work.
import { QUEST } from './catalog.js';

// The drop-off is the point on the district's own main road nearest its
// commons (the upper lawn), i.e. where the road turns in at the top. A cart
// can always stop on that road; the lawn itself may be ringed by camps.
export function summitDropOff(plan) {
  const road = plan?.mainRoad, commons = plan?.commons;
  if (!Array.isArray(road) || !road.length || !Number.isFinite(commons?.x) || !Number.isFinite(commons?.z)) return null;
  let best = null, bestSq = Infinity;
  for (const p of road) {
    if (!Number.isFinite(p?.x) || !Number.isFinite(p?.z)) continue;
    const sq = (p.x - commons.x) ** 2 + (p.z - commons.z) ** 2;
    if (sq < bestSq) { bestSq = sq; best = p; }
  }
  return best ? { x: best.x, z: best.z } : null;
}

export function summitDestinations(origin, landscape, reach = QUEST.SUMMIT_MAX) {
  if (!landscape?.access || landscape.disposed) return [];
  const records = landscape.access.query(
    { minX: origin.x - reach, maxX: origin.x + reach, minZ: origin.z - reach, maxZ: origin.z + reach },
    { request: false },
  );
  const out = [];
  for (const { candidate, state } of records) {
    if (candidate.kind !== 'mountain-top' || state?.status !== 'ready') continue;
    const spot = summitDropOff(state.plan);
    if (!spot) continue;
    // The district's main road runs from its entrance up to the commons, so
    // its end farthest from the commons is where the climb starts. A straight
    // arrow to the summit can point at a cliff; this gives the compass a
    // sensible first target.
    const road = state.plan.mainRoad;
    const ends = [road[0], road[road.length - 1]];
    const foot = ends.reduce((a, b) => (Math.hypot(a.x - spot.x, a.z - spot.z) >= Math.hypot(b.x - spot.x, b.z - spot.z) ? a : b));
    const via = Math.hypot(foot.x - spot.x, foot.z - spot.z) > 60 ? { x: foot.x, z: foot.z } : null;
    out.push({ kind: 'mountaintop', x: spot.x, z: spot.z, radius: 40, districtId: candidate.id, via });
  }
  return out;
}
