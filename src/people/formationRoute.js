// Preserved loop placement/sampling for parade and band. No actor storage or clock.
import {_pickPositionAvoidingLakes} from './placement.js';
import {projectOutOfLake} from '../lakes.js';
function avoidLakes(path) {
  for (let i = 0; i < path.length; i++) {
    const fixed = projectOutOfLake(path[i].x, path[i].z, 3.0);
    if (fixed) {
      path[i].x = fixed.x;
      path[i].z = fixed.z;
    }
  }
}

// ---- Loop relocation (puppet parade + brass band) ---------------------------
// Both the parade and the band march a fixed-shape loop that is *placed* at a
// random anchor rather than hardcoded near origin. The loop spawns 0..150m from
// world origin (so it isn't always sitting on the start area), and once the
// player has driven a long way off — LOOP_RECYCLE_DIST, deliberately farther
// than the wook recycle (300m) so relocation is a rarer event — the whole loop
// hops to a fresh anchor 150..300m around the player. That "far" reappear range
// means the unit shows up across the field (and, for the band, the music —
// inaudible at recycle distance — fades in naturally as you approach) rather
// than popping in right on top of you.
export const LOOP_INITIAL_SPREAD = 150;   // initial spawn radius around world origin
const LOOP_RECYCLE_DIST   = 500;   // player must get this far from the loop to relocate
const LOOP_REAPPEAR_NEAR  = 150;   // relocate ring min, around the player
const LOOP_REAPPEAR_FAR   = 300;   // relocate ring max

// Rewrite `path` in place to `basePath` (the loop's local shape) shifted to a
// lake-free anchor picked at radius [rNear, rFar] from (cx, cz). Returns the
// chosen anchor so the caller can track the loop's center for the recycle test.
export function placeLoop(path, basePath, cx, cz, rNear, rFar) {
  const a = _pickPositionAvoidingLakes(cx, cz, rNear, rFar);
  for (let i = 0; i < path.length; i++) {
    path[i].set(basePath[i].x + a.x, 0, basePath[i].z + a.z);
  }
  avoidLakes(path);
  return a;
}

// If the player has wandered past LOOP_RECYCLE_DIST from `anchor`, relocate the
// loop 150..300m around the player and return the new anchor; else return null.
// A null zerblePos (sandbox / no-player tick) never recycles.
export function maybeRecycleLoop(path, basePath, anchor, zerblePos) {
  if (!zerblePos) return null;
  const dx = anchor.x - zerblePos.x;
  const dz = anchor.z - zerblePos.z;
  if (dx * dx + dz * dz <= LOOP_RECYCLE_DIST * LOOP_RECYCLE_DIST) return null;
  return placeLoop(path, basePath, zerblePos.x, zerblePos.z, LOOP_REAPPEAR_NEAR, LOOP_REAPPEAR_FAR);
}

export function pathLength(path) {
  let total = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    total += a.distanceTo(b);
  }
  return total;
}

export function samplePath(path, distance, outPos, outDir) {
  let remaining = distance;
  for (let i = 0; i < path.length; i++) {
    const a = path[i];
    const b = path[(i + 1) % path.length];
    const seg = a.distanceTo(b);
    if (remaining <= seg) {
      const t = remaining / seg;
      outPos.lerpVectors(a, b, t);
      outDir.subVectors(b, a).normalize();
      return { pos: outPos, dir: outDir };
    }
    remaining -= seg;
  }
  outPos.copy(path[0]);
  outDir.set(0, 0, 1);
  return { pos: outPos, dir: outDir };
}
