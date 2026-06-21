// Layout linter (group 4) — rules-as-data over the worldgen PLAN (analytic,
// headless, pure) and, where a built/captured registry is supplied, over the
// exact sub-component positions. PLAN mode is approximate-by-design (it reasons
// over cluster-center analytic extents); REGISTRY mode is the exact authority
// (design D-D). Where they disagree, registry mode wins.
//
// Dependency direction (tuning.js header rule): worldgen/ imports only worldgen/
// — NEVER chunks/registry/lakes/models. This file is consumable from node (the
// `bin/lint` CLI) with no game running, and from the browser sandboxes.
//
// A violation carries the FULL eyes pipeline so a finding is one click from a
// look: a 2D map-sandbox link, a 3D hub-sandbox link, and a paste-ready
// `__dbg.teleport` snippet for the live game.

import { setSeed, getSeed, queryPoint } from './index.js';
import { nearestRoad } from './roads.js';
import { CONFIG } from './constants.js';
import { heartsInBounds } from './hearts.js';
import { festivalPlan, dancefloorRect, spawnHeart, MAX_POI_REACH } from './festival.js';
import { clusterExtent, clusterShapes, clustersOverlap, shapesContainPoint, FESTIVAL_TUNING } from './tuning.js';
import { treeDensity } from './density.js';

// ── Link forms (the "eyes pipeline") ─────────────────────────────────────────
// Every violation gets all three so the next agent can open the exact spot in
// 2D, in 3D, or drop into the running game. The hub-sandbox 3D viewer is group
// 6; the `?at=x,z` slot is reserved here so links are forward-compatible.
function seedHex(seedNum) { return '0x' + (seedNum >>> 0).toString(16); }
function round4(v) { return Math.round(v * 1e4) / 1e4; }

// The link seed is the DECIMAL numeric session seed — NOT the 0x… hex. Both
// main.js and map-sandbox.html resolve `?seed=` via `/^-?\d+$/.test(raw) ?
// Number(raw) : FNV(raw)`: a decimal string round-trips through the number path
// to the exact same SESSION_SEED, but a `0x…` string falls to the FNV path and
// resolves to a DIFFERENT world. So a finding's links must carry the decimal or
// they reopen the wrong seed.
function links(seedDec, x, z) {
  const sx = Math.round(x), sz = Math.round(z);
  return {
    map2d: `map-sandbox.html?seed=${seedDec}&cx=${sx}&cz=${sz}&zoom=2`,
    hub3d: `hub-sandbox.html?seed=${seedDec}&at=${sx},${sz}`,
    teleport: `__dbg.teleport(${sx}, ${sz})`,
  };
}

// `seedNum` is ALWAYS the numeric session seed (getSeed() after setSeed) — never
// a raw string, so `>>> 0` is safe for both decimal (1234) and hex (0xf7ef2a3c)
// seeds. Earlier this took the raw `seed`, which `>>> 0`'d a hex STRING to 0.
function violation(rule, seedNum, heart, x, z, detail) {
  const u = seedNum >>> 0;
  const hex = '0x' + u.toString(16);
  return {
    rule: rule.id,
    severity: rule.severity,
    mode: rule.mode,
    seed: hex,
    hub: heart ? { cx: heart.cx, cz: heart.cz, rank: heart.rank } : null,
    x: round4(x),
    z: round4(z),
    detail,
    links: links(String(u), x, z),
  };
}

// ── Per-hub plan context — everything a plan-mode rule needs, computed once ──
function planContext(heart) {
  const plan = festivalPlan(heart);
  const stage = plan.find(p => p.anchor) || plan[0] || null;
  return {
    heart,
    plan,
    stage,
    floor: stage ? dancefloorRect(heart) : null,
    // legacy scalar extent circles (water-clear / truck-off-road only read p)
    extents: plan.map(p => ({ p, r: clusterExtent(p.kind, p.scale || 1) })),
    // true ORIENTED extents (group 3 / D3) — what the overlap rule now tests
    shapes: plan.map(p => ({ p, s: clusterShapes(p.kind, p.scale || 1, p.x, p.z, p.yaw) })),
  };
}

// ── PLAN-mode rules (4.2) ────────────────────────────────────────────────────
// Each rule: { id, severity, mode, check(ctx, emit, env) }. `emit(x,z,detail)`
// pushes a violation. `env` = { seed, allHubs } for cross-hub reasoning.
const STAGE_KINDS = new Set(['main_stage', 'side_stage', 'tent_stage']);
// The big LEAF drum circle. Plan descriptor kind = 'drum_circle'; in the built
// registry it shows up as a 'firepit' (damage 9) + a 'bench_ring'.
const DRUM_PLAN_KIND = 'drum_circle';

// Plan clusters whose ORIENTED envelope CONTAINS point (x,z), excluding the given
// kinds (the drum itself, scenery). Shared by the drum-in-trees rule in both
// modes: "the drum's center sits inside a food-court ring / vendor-row rect /
// stage+dancefloor envelope" — the bug Gary saw (a drum inside a food-truck
// circle), which plain `overlap` misses (benches nest between trucks). The stage
// shape (clusterShapes) is its deck circle + the DIRECTIONAL dancefloor OBB, so a
// drum BEHIND the stage isn't falsely flagged — no special-case rect needed.
// (`heart` is no longer read; kept in the signature for call-site stability.)
function clustersContaining(plan, heart, x, z, exclude) {
  const out = [];
  for (const p of plan) {
    if (exclude.has(p.kind)) continue;
    if (shapesContainPoint(clusterShapes(p.kind, p.scale || 1, p.x, p.z, p.yaw), x, z)) {
      out.push({ kind: p.kind });
    }
  }
  return out;
}

const PLAN_RULES = [
  {
    id: 'water-clear',
    severity: 'error',
    mode: 'plan',
    // No cluster center may sit in a lake, and the stage's dancefloor mouth must
    // be on dry ground. Lakes deliberately survive chunk unload (CLAUDE.md #5),
    // so a cluster in water is a hard placement bug, not a transient.
    check(ctx, emit) {
      for (const e of ctx.extents) {
        if (queryPoint(e.p.x, e.p.z).inLake) {
          emit(e.p.x, e.p.z, `${e.p.kind} center sits in a lake`);
        }
      }
      if (ctx.floor) {
        const f = ctx.floor;
        const mouthX = f.cx + f.dirx * f.depth;
        const mouthZ = f.cz + f.dirz * f.depth;
        if (queryPoint(mouthX, mouthZ).inLake) {
          emit(mouthX, mouthZ, 'dancefloor mouth opens onto water');
        }
      }
    },
  },
  {
    id: 'overlap',
    severity: 'warn',
    mode: 'plan',
    // APPROXIMATE: two clusters whose ORIENTED extents (group 3 / D3) intersect —
    // a food-court ring circle vs a vendor-row OBB, not two bounding circles, so
    // it no longer over-counts the rectangle's empty corners. The de-overlap pass
    // (festival.js resolveOverlaps) settles SCALAR footprint circles, not these
    // fuller shapes, so residual overlaps are a real (approximate) signal.
    // Registry mode is the exact authority (D-D).
    //
    // Stage shapes include the dancefloor CLEARING (its forward OBB), which food
    // courts/vendor rows are DESIGNED to sit at the edge of — so stage-involving
    // pairs are expected to "overlap" and would drown the signal. Skip them in
    // plan mode; the actionable clutter (the 4.5 truck×vendor-row clip) is
    // non-stage pairs.
    check(ctx, emit) {
      const sh = ctx.shapes;
      for (let i = 0; i < sh.length; i++) {
        for (let j = i + 1; j < sh.length; j++) {
          const a = sh[i], b = sh[j];
          // porta-banks intentionally tuck at the margin of a parent — exclude.
          if (a.p.kind === 'porta_bank' || b.p.kind === 'porta_bank') continue;
          if (STAGE_KINDS.has(a.p.kind) || STAGE_KINDS.has(b.p.kind)) continue;
          // bubble_vendor is the GUARANTEED refuel (D15) — it sits in/near the food
          // court's central PLAZA, and a food court's clusterShape is a FILLED circle
          // while its real occupancy is a hollow RING of trucks. So the plan-mode
          // overlap over-counts (filled-circle vs the bubble) without a real clip:
          // registry-confirmed clear (seed 2951152942, every built bubble ≥ ~9 m from
          // the nearest truck). Excluded like porta_bank/stage so the warn isn't drowned.
          if (a.p.kind === 'bubble_vendor' || b.p.kind === 'bubble_vendor') continue;
          if (clustersOverlap(a.s, b.s)) {
            emit((a.p.x + b.p.x) / 2, (a.p.z + b.p.z) / 2,
              `${a.p.kind} × ${b.p.kind} oriented extents overlap (approx)`);
          }
        }
      }
    },
  },
  {
    id: 'truck-off-road',
    severity: 'warn',
    mode: 'plan',
    // APPROXIMATE: a food court (sugar shacks + trucks) should sit just OFF the
    // drag, not adrift in deep outskirts with no road to pull up to. Fires when
    // the court center has no road within HEART_CELL (queryPoint.facing null).
    check(ctx, emit) {
      for (const e of ctx.extents) {
        if (e.p.kind !== 'food_court') continue;
        if (queryPoint(e.p.x, e.p.z).facing == null) {
          emit(e.p.x, e.p.z, 'food_court has no road in range (truck stranded off-road, approx)');
        }
      }
    },
  },
  {
    id: 'stage-spacing',
    severity: 'warn',
    mode: 'plan',
    // Cross-hub: two hearts' stages must not crowd each other. Min gap = the sum
    // of their dancefloor depths (back-to-back floors shouldn't interpenetrate).
    // Runs once per env (allHubs), keyed on the first hub to avoid N× dupes.
    check(ctx, emit, env) {
      if (env.allHubs[0] !== ctx.heart || !ctx.stage) return;
      const stages = env.contexts
        .filter(c => c.stage)
        .map(c => ({ c, x: c.stage.x, z: c.stage.z, depth: c.floor ? c.floor.depth : 0 }));
      for (let i = 0; i < stages.length; i++) {
        for (let j = i + 1; j < stages.length; j++) {
          const a = stages[i], b = stages[j];
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          const need = a.depth + b.depth;
          if (d < need) {
            emit((a.x + b.x) / 2, (a.z + b.z) / 2,
              `stages at hubs (${a.c.heart.cx},${a.c.heart.cz}) & (${b.c.heart.cx},${b.c.heart.cz}) within ${d.toFixed(0)}m < ${need.toFixed(0)}m`);
          }
        }
      }
    },
  },
  {
    id: 'spawn-arrival',
    severity: 'error',
    mode: 'plan',
    // Arrival is anchored at the SPAWN HUB: main.js teleports Zerble to that hub's
    // entrance arch (or its dancefloor front) and opens the game there — it does NOT
    // spawn the player at world (0,0). So the old checks ("(0,0) is dry", "stage within
    // MAX_POI_REACH of origin") tested a premise that no longer holds — origin is just
    // the coordinate root the player never stands on, and the dry-spawn picker
    // (`spawnHeart`) legitimately skips near wet majors for a farther dry one (seed 42:
    // ~1.2 km), which is correct, not a defect. The real arrival invariant is that the
    // spawn hub HAS a stage to arrive at. It's the nearest DRY major and stages are
    // heart-anchored, so this holds — but guard it: a stageless spawn hub would break
    // the opening. Uses `spawnHeart` (the EXACT hub main.js opens on). Fires once.
    check(ctx, emit, env) {
      const spawnHub = spawnHeart();
      if (!spawnHub || ctx.heart.cx !== spawnHub.cx || ctx.heart.cz !== spawnHub.cz) return;
      if (!ctx.stage) emit(ctx.heart.x, ctx.heart.z, 'spawn hub has no stage — arrival broken');
    },
  },
  {
    id: 'drum-in-trees',
    severity: 'error',
    mode: 'plan',
    // The big LEAF drum circle belongs in a treed pocket (Gary 2026-06-12) and
    // must NOT sit inside another cluster's envelope (he saw one spawn INSIDE a
    // food-truck circle). Plan mode is approximate: no built trees to count, so
    // it uses the density FIELD as the treed-pocket proxy; the envelope check is
    // exact against the same analytic extents the planner de-overlaps on.
    check(ctx, emit) {
      const T = FESTIVAL_TUNING;
      for (const p of ctx.plan) {
        if (p.kind !== DRUM_PLAN_KIND) continue;
        if (treeDensity(p.x, p.z) < T.DRUM_TREE_MIN_DENSITY) {
          emit(p.x, p.z, `drum circle in a thin-tree spot (density ${treeDensity(p.x, p.z).toFixed(2)} < ${T.DRUM_TREE_MIN_DENSITY}; should sit in woods)`);
        }
        const inside = clustersContaining(ctx.plan, ctx.heart, p.x, p.z, new Set([DRUM_PLAN_KIND]));
        for (const c of inside) emit(p.x, p.z, `drum circle center inside a ${c.kind} envelope (approx)`);
      }
    },
  },
];

// ── Entry point ──────────────────────────────────────────────────────────────
// runLint({ seeds, bounds?, rules? }) — for each seed, enumerate the hubs in
// `bounds` (default a ±2km window around origin), build each hub's plan, run the
// plan-mode rules, and return { violations, counts, seeds }.
const DEFAULT_BOUNDS = { minX: -2000, minZ: -2000, maxX: 2000, maxZ: 2000 };

export function runLint(opts = {}) {
  const seeds = opts.seeds || [1234];
  const bounds = opts.bounds || DEFAULT_BOUNDS;
  const rules = (opts.rules || PLAN_RULES).filter(r => r.mode === 'plan');
  const prevSeed = getSeed();
  const violations = [];
  const counts = {};

  for (const seed of seeds) {
    setSeed(seed);
    const seedNum = getSeed();   // numeric session seed (parses both 1234 and 0x… strings)
    const hearts = heartsInBounds(bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ);
    const contexts = hearts.map(planContext);
    const env = { seed: seedNum, allHubs: hearts, contexts };
    for (const ctx of contexts) {
      for (const rule of rules) {
        const emit = (x, z, detail) => {
          const v = violation(rule, seedNum, ctx.heart, x, z, detail);
          violations.push(v);
          counts[rule.id] = (counts[rule.id] || 0) + 1;
        };
        rule.check(ctx, emit, env);
      }
    }
  }

  setSeed(prevSeed);
  return { mode: 'plan', seeds: seeds.map(seedHex), bounds, counts, violations };
}

// ── REGISTRY mode (4.3) — exact, over a built/captured dumpRegistry payload ───
// The PRIMARY mode (design D-D): where plan and registry disagree, registry
// wins. It reads the EXACT sub-component positions the game built (trucks,
// booth-tents, stage-deck tiles, camp tents…) — far finer than plan mode's
// cluster-center analytic circles — and cross-references the live plan (seeded
// from the snapshot's `seed`) for the dancefloor-clear / potty-attach context.
//
// Scenery + structural kinds are NOT festival layout (forests/water/roads place
// them; lake_edge is a deliberately-continuous ring) — excluded from `overlap`
// so it reports FESTIVAL clutter, not 1000-tree forest density. (Measured: a
// spawn window holds ~520 forest_tree + ~117 lake_edge colliders.)
const SCENERY_KINDS = new Set(['forest_tree', 'lake_edge', 'shore', 'path_node', 'lamppost']);

// Pairs that are tight BY CONSTRUCTION (sub-components of one cluster). Keyed by
// the kind pair, sorted + '|'-joined. Grounded in measuring seeds 1234 /
// 0xf7ef2a3c / 0xf7ef2a3d: one stage deck is many 'stage' collider tiles, the
// spawn arch is 6 'arch' colliders, a drum circle nests its 'firepit' inside its
// 'bench_ring', food-court seating packs 'picnic_table's. Everything NOT here
// that interpenetrates is a real (exact) clutter signal — INCLUDING tent×truck,
// the round-2 booth-clips-food-truck bug (4.5), which penetrates 5.8–7.5m.
const ALLOWED_OVERLAP = new Set([
  'arch|arch', 'stage|stage', 'bench_ring|bench_ring', 'bench_ring|firepit',
  'picnic_table|picnic_table',
]);
const PEN_TOL = 0.5;   // grazing tolerance (m) — below this two colliders merely touch

// Big obstacles whose presence inside a dancefloor clearing breaks "the floor in
// front of the stage is clear" (chairs/picnic/stage_front are no-collider markers
// or the stage's own audience seating, deliberately in front — excluded).
const BLOCKING_KINDS = new Set(['truck', 'tent', 'campsite', 'bubble_vendor', 'porta_potty', 'picnic_table', 'firepit']);
// Festival cluster kinds a porta-bank should sit at the margin OF (A8 "attached").
const POTTY_PARENTS = new Set(['truck', 'tent', 'stage', 'bubble_vendor', 'campsite']);

function pairKey(a, b) { return a < b ? a + '|' + b : b + '|' + a; }

function boundsOf(entries) {
  if (!entries.length) return { ...DEFAULT_BOUNDS };
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const e of entries) { if (e.x < minX) minX = e.x; if (e.x > maxX) maxX = e.x; if (e.z < minZ) minZ = e.z; if (e.z > maxZ) maxZ = e.z; }
  return { minX, minZ, maxX, maxZ };
}
function nearestHubOf(hubs, x, z) {
  let best = null, bd = Infinity;
  for (const h of hubs) { const d = Math.hypot(h.x - x, h.z - z); if (d < bd) { bd = d; best = h; } }
  return best;
}
// Point inside an oriented dancefloor rect {cx,cz,dirx,dirz,depth,halfWidth}:
// project onto +F (0..depth) and the perpendicular (±halfWidth).
function inFloor(f, x, z) {
  const rx = x - f.cx, rz = z - f.cz;
  const along = rx * f.dirx + rz * f.dirz;
  const lateral = rx * -f.dirz + rz * f.dirx;
  return along >= 0 && along <= f.depth && Math.abs(lateral) <= f.halfWidth;
}

const REGISTRY_RULES = [
  {
    id: 'overlap',
    severity: 'error',
    mode: 'registry',
    // Exact: two solid colliders interpenetrate by more than PEN_TOL and are not
    // an ALLOWED_OVERLAP same-cluster pair. O(n²) over festival solids only
    // (scenery excluded), so a window is a few hundred — fine for a CLI sweep.
    check(rctx, emit) {
      const es = rctx.solids;
      for (let i = 0; i < es.length; i++) {
        for (let j = i + 1; j < es.length; j++) {
          const a = es[i], b = es[j];
          if (ALLOWED_OVERLAP.has(pairKey(a.kind, b.kind))) continue;
          const d = Math.hypot(a.x - b.x, a.z - b.z);
          const pen = (a.colliderR + b.colliderR) - d;
          if (pen > PEN_TOL) {
            emit((a.x + b.x) / 2, (a.z + b.z) / 2,
              `${a.kind} × ${b.kind} colliders overlap by ${pen.toFixed(1)}m`,
              nearestHubOf(rctx.hubs, a.x, a.z));
          }
        }
      }
    },
  },
  {
    id: 'water-clear',
    severity: 'error',
    mode: 'registry',
    // Any festival solid whose center sits in a lake. Lakes survive chunk unload
    // (CLAUDE.md #5) so this is a hard placement bug, not a transient.
    check(rctx, emit) {
      for (const e of rctx.solids) {
        if (queryPoint(e.x, e.z).inLake) emit(e.x, e.z, `${e.kind} sits in a lake`, nearestHubOf(rctx.hubs, e.x, e.z));
      }
    },
  },
  {
    id: 'dancefloor-clear',
    severity: 'warn',
    mode: 'registry',
    // No big obstacle inside any hub's dancefloor clearing. The authoritative
    // rect is the plan's dancefloorRect (seeded from the snapshot), checked
    // against the BUILT obstacle positions — the cross-half check plan mode
    // can't do alone.
    check(rctx, emit) {
      const floors = rctx.hubs.map(h => dancefloorRect(h)).filter(Boolean);
      for (const e of rctx.solids) {
        if (!BLOCKING_KINDS.has(e.kind)) continue;
        for (const f of floors) {
          if (inFloor(f, e.x, e.z)) {
            emit(e.x, e.z, `${e.kind} intrudes into a dancefloor clearing`, nearestHubOf(rctx.hubs, e.x, e.z));
            break;
          }
        }
      }
    },
  },
  {
    id: 'booth-on-road',
    severity: 'warn',
    mode: 'registry',
    // A vendor booth (tent) whose center sits on the DRIVABLE road SURFACE blocks the
    // aisle. Rows are DESIGNED to straddle the road at ±VENDOR_ROW_OFFSET (7 m) — which
    // equals the ±ROAD_WIDTH noBuild *corridor* edge, so `queryPoint().onRoad` (the
    // generous ±ROAD_WIDTH corridor) flags every straddling booth as a false positive.
    // The VISIBLE ribbon is only ±ROAD_WIDTH/2 wide (chunks.js ROAD_RIBBON_WIDTH leaves
    // a cleared shoulder), so flag a booth only when it's within the ribbon half-width +
    // its own radius of the centerline — i.e. actually on the drive lane, not the shoulder.
    check(rctx, emit) {
      const tol = CONFIG.ROAD_WIDTH / 2 + 1;   // visible ribbon half-width + grazing margin
      for (const e of rctx.solids) {
        if (e.kind !== 'tent') continue;
        if (nearestRoad(e.x, e.z).dist < tol) emit(e.x, e.z, 'vendor booth sits on the road surface (blocks the aisle)', nearestHubOf(rctx.hubs, e.x, e.z));
      }
    },
  },
  {
    id: 'potty-attached',
    severity: 'warn',
    mode: 'registry',
    // A porta-bank should tuck at the margin of a parent cluster (A8), not strand
    // in open ground. Fires when no parent-kind solid is within ATTACH range.
    check(rctx, emit) {
      const ATTACH = FESTIVAL_TUNING.POTTY_ATTACH_OFFSET + 10;
      const parents = rctx.solids.filter(e => POTTY_PARENTS.has(e.kind));
      for (const e of rctx.solids) {
        if (e.kind !== 'porta_potty') continue;
        const near = parents.some(p => Math.hypot(p.x - e.x, p.z - e.z) <= ATTACH);
        if (!near) emit(e.x, e.z, `porta-bank has no parent cluster within ${ATTACH}m (orphaned)`, nearestHubOf(rctx.hubs, e.x, e.z));
      }
    },
  },
  {
    id: 'truck-off-road',
    severity: 'warn',
    mode: 'registry',
    // A food truck with no road within range — stranded with nowhere to pull up.
    check(rctx, emit) {
      for (const e of rctx.solids) {
        if (e.kind !== 'truck') continue;
        if (queryPoint(e.x, e.z).facing == null) emit(e.x, e.z, 'food truck has no road in range (stranded)', nearestHubOf(rctx.hubs, e.x, e.z));
      }
    },
  },
  {
    id: 'truck-on-road',
    severity: 'error',
    mode: 'registry',
    // The mirror of `truck-off-road`: a food truck or Sugar Shack (both register as
    // `kind: 'truck'`) whose center sits ON the drivable road ribbon blocks the lane
    // and is a collidable obstacle in the driving line. The court ring (~24 m) overshoots
    // the drag it parks near, so the road-side ring slots used to land on the pavement
    // (Gary playtest 2026-06-16). buildFoodCourtAt now skips those slots; this is the
    // regression tripwire. Same ribbon-half-width tolerance as `booth-on-road`.
    check(rctx, emit) {
      const tol = CONFIG.ROAD_WIDTH / 2 + 1;
      for (const e of rctx.solids) {
        if (e.kind !== 'truck') continue;
        if (nearestRoad(e.x, e.z).dist < tol) emit(e.x, e.z, 'food truck / sugar shack sits on the road surface (blocks the lane)', nearestHubOf(rctx.hubs, e.x, e.z));
      }
    },
  },
  {
    id: 'drum-in-trees',
    severity: 'error',
    mode: 'registry',
    // The big LEAF drum circle (its built `bench_ring`) must sit in a treed
    // pocket (forest_tree colliders within DRUM_TREE_RADIUS ≥ DRUM_TREE_MIN) and
    // NOT inside another cluster's analytic envelope. Gary 2026-06-12 saw one
    // spawn INSIDE a food-truck circle — `overlap` misses it because the benches
    // nest between trucks without a collider interpenetration.
    check(rctx, emit) {
      const T = FESTIVAL_TUNING;
      const trees = rctx.entries.filter(e => e.kind === 'forest_tree');
      for (const e of rctx.solids) {
        if (e.kind !== 'bench_ring') continue;
        const hub = nearestHubOf(rctx.hubs, e.x, e.z);
        let n = 0;
        for (const t of trees) if (Math.hypot(t.x - e.x, t.z - e.z) <= T.DRUM_TREE_RADIUS) n++;
        if (n < T.DRUM_TREE_MIN) emit(e.x, e.z, `drum circle has ${n} trees within ${T.DRUM_TREE_RADIUS}m (< ${T.DRUM_TREE_MIN}; not in a treed pocket)`, hub);
        if (hub) {
          for (const c of clustersContaining(festivalPlan(hub), hub, e.x, e.z, new Set(['drum_circle']))) {
            emit(e.x, e.z, `drum circle center inside a ${c.kind} envelope`, hub);
          }
        }
      }
    },
  },
  {
    id: 'arch-placement',
    severity: 'error',
    mode: 'registry',
    // The ONE spawn arch (built in main.js; registry kind 'arch') should read as
    // a threshold you drive THROUGH on a road BEFORE the stage scene: OVER a road,
    // OUTSIDE every dancefloor clearing, and ≥ ARCH_MIN_STAGE_DIST from the stage
    // (past the string-light rows). Today it lands ~15·scale from the stage inside
    // the lit dancefloor (RECORD-not-fix; the grammar change re-places it).
    // Registry-only: the arch is NOT a plan descriptor (festival.js emits none),
    // so there is nothing for a plan-mode variant to read.
    check(rctx, emit) {
      const archs = rctx.entries.filter(e => e.kind === 'arch');
      if (!archs.length) return;
      const cx = archs.reduce((s, a) => s + a.x, 0) / archs.length;
      const cz = archs.reduce((s, a) => s + a.z, 0) / archs.length;
      const hub = nearestHubOf(rctx.hubs, cx, cz);
      if (!queryPoint(cx, cz).onRoad) emit(cx, cz, 'spawn arch is not over a road (should straddle the approach road)', hub);
      const floors = rctx.hubs.map(h => dancefloorRect(h)).filter(Boolean);
      if (floors.some(f => inFloor(f, cx, cz))) emit(cx, cz, 'spawn arch sits inside a dancefloor clearing (should be the threshold BEFORE it)', hub);
      let d = Infinity;
      for (const s of rctx.solids) if (s.kind === 'stage') d = Math.min(d, Math.hypot(s.x - cx, s.z - cz));
      if (d < FESTIVAL_TUNING.ARCH_MIN_STAGE_DIST) emit(cx, cz, `spawn arch ${d.toFixed(0)}m from the stage (< ${FESTIVAL_TUNING.ARCH_MIN_STAGE_DIST}m; too close, inside the light rows)`, hub);
    },
  },
];

// lintRegistry({ snapshot | entries, seed?, bounds?, rules? }) — `snapshot` is a
// parsed bin/layout-snapshot file (carries seed + entries); or pass `entries`
// (a raw dumpRegistry array) + `seed`. Returns the same mode-tagged shape as
// runLint, so a report can interleave plan + registry violations.
export function lintRegistry(opts = {}) {
  const snap = opts.snapshot || null;
  const entries = opts.entries || (snap && snap.entries) || [];
  const seedIn = opts.seed != null ? opts.seed : (snap ? snap.seed : 1234);
  const rules = (opts.rules || REGISTRY_RULES).filter(r => r.mode === 'registry');
  const prevSeed = getSeed();
  setSeed(seedIn);
  const seedNum = getSeed();
  const bounds = opts.bounds || boundsOf(entries);
  // Enumerate owning hubs with the MAX_POI_REACH AABB-expand (placement.js
  // pattern) so a hub whose stage was clipped into the window is still resolved.
  const hubs = heartsInBounds(bounds.minX - MAX_POI_REACH, bounds.minZ - MAX_POI_REACH, bounds.maxX + MAX_POI_REACH, bounds.maxZ + MAX_POI_REACH);
  const solids = entries.filter(e => e.colliderR != null && !SCENERY_KINDS.has(e.kind));
  const rctx = { seed: seedNum, entries, solids, hubs, bounds };
  const violations = [];
  const counts = {};
  for (const rule of rules) {
    const emit = (x, z, detail, heart) => {
      violations.push(violation(rule, seedNum, heart || null, x, z, detail));
      counts[rule.id] = (counts[rule.id] || 0) + 1;
    };
    rule.check(rctx, emit);
  }
  setSeed(prevSeed);
  return { mode: 'registry', seed: seedHex(seedNum), bounds, entryCount: entries.length, solidCount: solids.length, counts, violations };
}

export { PLAN_RULES, REGISTRY_RULES };
