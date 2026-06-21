# Deliberation Briefing: Festival layout grammar — the hub redesign

## Task

Stress-test, **before any code is written**, the FESTIVAL LAYOUT GRAMMAR spec at
`openspec/changes/v2-worldgen-3d-integration/festival-layout-grammar.md`. This
spec redesigns how `src/worldgen/festival.js` decides WHERE a hub's pieces go
(stage / dancefloor / vendor rows / food court / drum circle / bubble vendor /
porta-banks / camps), replacing the current independent-placement logic that
ships visibly broken layouts.

Read these first (all under `openspec/changes/v2-worldgen-3d-integration/` unless noted):
- `festival-layout-grammar.md` — **the spec under review** (the front-axis idea,
  the per-entity placement rules, the overlap guard, the spawn arch, §8 resolved forks).
- `festival-polish-backlog.md` — Gary's 18 playtest notes (A–H) + the
  one-infinite-festival framing the grammar must serve.
- `src/worldgen/festival.js` — the CURRENT POI layer being rebuilt (read
  `_computePlan` — the independent-placement logic is the thing being replaced).
- `design.md` "Festival Layout Redesign (D-K..D-Q)" — the prior plan + invariants (D-P).
- `deliberations/002-festival-layout/results.md` — the PRIOR council's Change
  Groups + Risk Register for this same area (R16–R20: window-invariance,
  cross-engine trig, allocation spikes, cluster ownership).
- `CLAUDE.md` + `ARCHITECTURE.md` (chunk/registry/lifecycle sections).

## Context

- **Status: SALVAGE v2.** All v2 content groups (roads/festival/spawn/lakes/woods/
  crowd) landed behind `?worldgen=1` (`DEFAULT_WORLDGEN_V2=false`). Gary playtested
  and the ARRANGEMENT — not density — is the real problem: stage facing water with
  chairs IN the water, a vendor row punched through a stage, the festival arch
  dumped mid-vendor-row, a food court with a road + porta INSIDE it. Root cause:
  `festival.js` places each piece relative to the heart+roads INDEPENDENTLY, with
  no rule about how they relate, and no overlap guard.
- **Framing (Gary):** it is ONE infinite festival; "hearts" are HUBS / gathering
  areas within it, connected by roads; the gaps between are still the festival
  (chill/camping), just less dense. The spec says "hub" for what the code calls a heart.
- **The fix under review:** give each hub ONE computed **front axis `F`**, then
  place every entity by a rule relative to `F` + the roads + the water, with a
  final footprint-overlap guard. `F` = bisector of the widest *dry* gap between
  the hub's roads (so the dancefloor faces open ground between roads, never down a
  road or at a lake). One arch only, at the player's spawn, on the approach road.
- **Subsystems:** worldgen POI layer (`src/worldgen/festival.js`, pure), the chunk
  build half (`src/chunks.js` cluster builders + `scatterWorldgenTrees`), spawn
  (`src/main.js`), determinism (`src/rng.js` salts), per-tier perf budgets.
- **Data the grammar consumes (already exists):** `approachRoadsOf(heart)` →
  `[{neighbor, oriented (heart-first), bearing, lenQ}]`; `nearestLake(x,z)`;
  `queryPoint(x,z)` → `{noBuild, inLake, facing, treeDensity, roleTier, heart, heartInfluence}`;
  `nearestMajorHeart(x,z)`. `buildStage(ctx,x,z,isMain,yaw)` — model local +Z is the
  stage FRONT; chairs band behind the dancefloor. NO dancefloor tree-clearing exists today.

## Constraints (the tripwires — non-negotiable)

- No build step; a new `src/` module goes in the importmap in `index.html`,
  `sandbox.html`, AND `map-sandbox.html`.
- ES module namespaces are frozen — no `THREE.X = Y` after import; tier overrides via `src/threeShim.js`.
- iOS audio inits synchronously inside the start gesture — no async hop before `Sound.init()`.
- **Determinism is load-bearing.** Fresh salts (don't reorder/re-salt existing
  `rng()` draws); **quantize every trig result before a threshold compare**
  (`sin/cos/atan2` aren't bit-identical cross-engine — the front-axis bearing is
  the new risk surface). `festivalPlan(heart)` stays memoized, gated on `(seed,epoch)`,
  seeded ONLY off the heart (window-invariance). The POI layer must not touch the
  `queryPoint` tuple (queryPoint golden stays; the POI golden may move — that's fine, flag-off).
- Lakes/roads omit `chunkKey` on purpose (persistent colliders); shared pooled
  resources tagged `userData.shared = true` must not be disposed.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M;
  the dancefloor tree-clearing + camp/tree-ring counts are the levers; don't reflexively `castShadow = true`.
- A cluster is chunk-keyed at the chunk containing its center, spills into
  neighbors; per-chunk placement enumerates hearts in the widened AABB and filters
  by cluster-center ownership — it must stay a per-chunk SAMPLER, not a heart
  lifecycle manager (design.md D-A).
- Sandbox-pass ≠ game-pass — the running game must boot clean at `?worldgen=1`.

### Your Output

Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (Round 1)

1. Propose your prioritized order of operations for rebuilding `festival.js`
   around this grammar (what to build first, what to park).
2. Identify the risks/concerns from YOUR domain, grounded in the spec + the
   docs/code. Be concrete: name files, functions, the specific failure mode.
3. Give a Verdict (Proceed | Proceed with mitigations | Block).

You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that's handled later.
</content>
