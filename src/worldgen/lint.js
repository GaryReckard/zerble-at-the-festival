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
import { heartsInBounds, nearestMajorHeart } from './hearts.js';
import { festivalPlan, dancefloorRect, MAX_POI_REACH } from './festival.js';
import { clusterExtent, FESTIVAL_TUNING } from './tuning.js';

// ── Link forms (the "eyes pipeline") ─────────────────────────────────────────
// Every violation gets all three so the next agent can open the exact spot in
// 2D, in 3D, or drop into the running game. The hub-sandbox 3D viewer is group
// 6; the `?at=x,z` slot is reserved here so links are forward-compatible.
function links(seed, x, z) {
  const sx = Math.round(x), sz = Math.round(z);
  return {
    map2d: `map-sandbox.html?seed=${seed}&cx=${sx}&cz=${sz}&zoom=2`,
    hub3d: `sandbox.html?entity=hub_preview&seed=${seed}&at=${sx},${sz}`,
    teleport: `__dbg.teleport(${sx}, ${sz})`,
  };
}

function violation(rule, seed, heart, x, z, detail) {
  return {
    rule: rule.id,
    severity: rule.severity,
    mode: rule.mode,
    seed: '0x' + (seed >>> 0).toString(16),
    hub: heart ? { cx: heart.cx, cz: heart.cz, rank: heart.rank } : null,
    x: Math.round(x * 1e4) / 1e4,
    z: Math.round(z * 1e4) / 1e4,
    detail,
    links: links(typeof seed === 'number' ? '0x' + (seed >>> 0).toString(16) : seed, x, z),
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
    // analytic extent circles for the overlap rule
    extents: plan.map(p => ({ p, r: clusterExtent(p.kind, p.scale || 1) })),
  };
}

// ── PLAN-mode rules (4.2) ────────────────────────────────────────────────────
// Each rule: { id, severity, mode, check(ctx, emit, env) }. `emit(x,z,detail)`
// pushes a violation. `env` = { seed, allHubs } for cross-hub reasoning.
const STAGE_KINDS = new Set(['main_stage', 'side_stage', 'tent_stage']);

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
    // APPROXIMATE: two clusters whose analytic extent circles intersect. The
    // de-overlap pass (festival.js resolveOverlaps) settles footprint circles,
    // not these fuller model-extent circles, so residual extent overlaps are a
    // real (approximate) signal. Registry mode is the exact authority (D-D).
    //
    // Stage extents include the dancefloor CLEARING, which food courts/vendor
    // rows are DESIGNED to sit at the edge of — so stage-involving pairs are
    // expected to "overlap" and would drown the signal. Skip them in plan mode;
    // the actionable clutter (the 4.5 truck×vendor-row clip) is non-stage pairs.
    check(ctx, emit) {
      const ex = ctx.extents;
      for (let i = 0; i < ex.length; i++) {
        for (let j = i + 1; j < ex.length; j++) {
          const a = ex[i], b = ex[j];
          // porta-banks intentionally tuck at the margin of a parent — exclude.
          if (a.p.kind === 'porta_bank' || b.p.kind === 'porta_bank') continue;
          if (STAGE_KINDS.has(a.p.kind) || STAGE_KINDS.has(b.p.kind)) continue;
          const d = Math.hypot(a.p.x - b.p.x, a.p.z - b.p.z);
          const need = a.r + b.r;
          if (d < need) {
            emit((a.p.x + b.p.x) / 2, (a.p.z + b.p.z) / 2,
              `${a.p.kind} × ${b.p.kind} extents overlap by ${(need - d).toFixed(1)}m (approx)`);
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
    // The player spawns at world (0,0) and must arrive into a festival: the
    // spawn point itself must be buildable ground (not in a lake), and the
    // nearest major hub's stage must be within reach. Fires once (spawn hub).
    check(ctx, emit, env) {
      const spawnHub = nearestMajorHeart(0, 0);
      if (!spawnHub || ctx.heart.cx !== spawnHub.cx || ctx.heart.cz !== spawnHub.cz) return;
      if (queryPoint(0, 0).inLake) {
        emit(0, 0, 'spawn point (0,0) is in a lake');
      }
      if (ctx.stage) {
        const d = Math.hypot(ctx.stage.x, ctx.stage.z);
        if (d > MAX_POI_REACH) {
          emit(ctx.stage.x, ctx.stage.z, `spawn hub stage is ${d.toFixed(0)}m from origin (> ${MAX_POI_REACH} reach)`);
        }
      } else {
        emit(ctx.heart.x, ctx.heart.z, 'spawn hub has no stage');
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
    const hearts = heartsInBounds(bounds.minX, bounds.minZ, bounds.maxX, bounds.maxZ);
    const contexts = hearts.map(planContext);
    const env = { seed, allHubs: hearts, contexts };
    for (const ctx of contexts) {
      for (const rule of rules) {
        const emit = (x, z, detail) => {
          const v = violation(rule, seed, ctx.heart, x, z, detail);
          violations.push(v);
          counts[rule.id] = (counts[rule.id] || 0) + 1;
        };
        rule.check(ctx, emit, env);
      }
    }
  }

  setSeed(prevSeed);
  return { seeds: seeds.map(s => (typeof s === 'number' ? '0x' + (s >>> 0).toString(16) : s)), bounds, counts, violations };
}

export { PLAN_RULES };
