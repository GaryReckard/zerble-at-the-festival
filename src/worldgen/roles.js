// Roles — per-location role tier + (CG3) the off-road, road-facing anchor that
// structurally fixes the live "stages-on-roads" bug.
//
// roleTier is live now (GATE 1). The anchor (offset a placement OFF the nearest
// road and FACE it) lands with roads at GATE 2 / CG3 — until then `facing` is
// null in the tuple.

export function roleTier(heart, dist) {
  if (!heart) return 'outskirts';
  if (dist < heart.core) return 'core';
  if (dist < heart.district) return 'district';
  return 'outskirts';
}

// Suggested clear-radius for a placement of a given role tier. (First-pass
// values; tuned alongside theme placement in the 3D-integration follow-up.)
export function footprintFor(tier) {
  switch (tier) {
    case 'core': return 8;
    case 'district': return 5;
    default: return 3;
  }
}
