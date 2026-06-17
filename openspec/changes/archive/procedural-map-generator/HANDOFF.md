# HANDOFF — procedural-map-generator

> **New session: read this first**, then `session-log.md` (latest Work Log entry)
> and `tasks.md`. This is the consolidated "hit the ground running" doc.

## TL;DR — what this is and where it stands

We're building a **render-agnostic, deterministic generator for an infinite festival
world layout**, developed and tuned in a **2D top-down sandbox** — the planning brain
for a future "natural roads + intentional structure" worldgen. It is **NOT wired into
the live 3D game** (that's the next, separate change). The full OpenSpec pipeline ran:
`/opsx:ff` → tier-3 `/deliberate` → `/opsx:apply` (CG1–CG5) → `/opsx:verify` →
`/smart-review` (Approve), then Gary's post-handoff polish (lake-heart road
convergence + route-around + forest tree-dots). Determinism harness: **20/20
green**, current golden **`63c8dea2`** (Node) / **`a527d31e`** (browser — the two
differ by the known, pre-existing lake-outline `sin/cos` cross-engine wobble;
within-engine determinism holds). Live + verified in Chrome via the preview MCP.

## Why we're doing it (origin)

The live game's world is a per-chunk dice roll with a rigid `+`-path grid through every
chunk center — squirrely, stages-on-roads, no intentional structure. Goal: an infinite
world that still reads like a *real* festival via a **hierarchy of centers** (the way
real geography looks planned with no global planner): rare "hearts" connected by roads,
sparsity = the space between them.

## How to run + verify

```
python3 .claude/serve_nocache.py 8765
→ http://127.0.0.1:8765/map-sandbox.html?seed=1234
```
- **Headless determinism (fast, no browser):**
  `node --input-type=module -e "import('./src/worldgen/selftest.js').then(m=>{const r=m.runSelfTest();console.log(r.pass,r.goldenHash)})"`
  Modules import with NO `three`/DOM — proves render-agnostic.
- **Sandbox:** TUNING·LIVE sliders (drag to re-roll), layer toggles, point inspector
  ("would host" line), self-test button, `?seed=&cx=&cz=&zoom=&layers=` deep-links,
  `window.__mapSandbox` for scripting (`queryPoint`, `queryRegion`, `setView`, `setSeed`,
  `setConfig`, `config`, `runSelfTest`).
- This is **distinct from `sandbox.html`** (one model in 3D). This = whole world in 2D.

## Architecture / file map

**`src/worldgen/` (pure data, no three.js/DOM):**
- `index.js` — **THE CONTRACT.** `queryPoint(x,z)` → the layout tuple (heart, heartDist,
  heartInfluence, roleTier, onRoad, roadTier, facing, footprint, inLake, onRiver[stub],
  bridge[stub], noBuild, treeDensity, lifecycle, groundY). `queryRegion(bounds)` →
  {hearts, roads, lakes} for drawing. `setSeed`/`getSeed`. Tuple is **append-only** across
  the 2D→3D boundary.
- `constants.js` — `CONFIG` (MUTABLE tunables, live-sliders bind here), `SALT`,
  `heartNeighborhoodCells()` (derived from largest district), `roadNeighborhoodCells()`,
  `bumpWorldgen()`/`worldgenEpoch()` (memo-cache invalidation on CONFIG change).
- `hearts.js` — `heartInCell` (memoized, rank minor/major), `nearestHeart` (derived
  window), `heartsInBounds`, `influenceFrom`. Hearts MAY sit on lakes (lakeside stages OK).
- `water.js` — `lakeInCell` (memoized, lobed/peanut/oval outlines), `nearestLake`,
  `lakeAt`, `lakeContaining`, `lakesInBounds`. Integer point-in-polygon containment.
- `roads.js` — `neighborsOf` (K-nearest proximity graph), `arterialPolyline` (pair-seeded
  meander), `arterial` (nulls if it crosses a lake — no bridges), `landingPoint`
  (dry shore landing for lake-hearts), `roadAnchor` (back-compat single anchor),
  `nearestRoad`, `roadAt`, `roadsInBounds`. **Whole arterial is one pair-owned curve →
  no seam halves → no kink (supersedes design D5's perpendicular-crossing idea).**
- `density.js` — `treeDensity` (organic domain-warped noise, gap-fill: cleared at heart
  cores → ramps through districts; lakeshore tree-rings with ~30% causeway gaps; 0 on water).
- `roles.js` — `roleTier` (core/district/outskirts), `footprintFor`.
- `selftest.js` — `runSelfTest`: T1 round-trip, T2 heart window-invariance (full sample),
  T3 heart negative-control, T4 road window-invariance, T5 road negative-control, + golden hash.
- `README.md` — glossary + "how to look at it" + role→theme mapping table.

**`src/rng.js`** — added the determinism primitives: `quantize`, `cellHash`, `cellRng`,
`edgeHash`, `pairHash`, `pairRng` (thin wrappers on `hash2`/`worldHash`/`mulberry32` —
ONE seeding regime, fresh `0x4D41_xx` salts).

**`map-sandbox.html`** — Canvas-2D viewer. Its own cache-buster importmap (lists every
`src/worldgen/*` + `rng`). Keep-alive (`document.hidden→setTimeout`) for the preview MCP.
Zoom floor 0.02 + 60k-cell region-scan caps (perf backstop).

## Key decisions (rationale + where documented)

- **D-determinism (load-bearing):** shared features are **edge/pair-seeded** (canonical
  `(min,max)`), everything integer-**quantized** before any hash/threshold (Math
  transcendentals aren't bit-identical cross-engine). REJECTED the "neighbor generates
  first, passes ports forward" idea — order-dependent, breaks on reload/`?seed`. → design D4.
- **Central-place hearts hierarchy** for intentional structure in infinity. → design D3.
- **Render-agnostic generator + 2D Canvas sandbox = single source of truth** (future 3D
  world + map view consume the same data). → design D1/D2/D11.
- **Scope = generator + 2D sandbox only;** 3D wire-in is a future change. → proposal.
- **Q1 (heart spacing):** tuned by eye; Gary's values baked as CONFIG defaults.
- **Q4:** rivers/bridges + mega-heart **CUT** from this change (kept in spec as `(deferred)`
  + contract stubs). → questions-for-human, proposal Decision Record, spec annotations.
- **Gary 2026-06-06:** hearts ALLOWED on/near lakes (lakeside stages, real LEAF); roads do
  NOT cross open water; on-lake hearts get dry shore landings.

**Current CONFIG defaults (Gary-tuned):** HEART_CELL 440, jitter 0.40, none 0.48 /
minorBelow 0.96, minor 95/290, major 350/1000, LAKE_PROB 0.60, LAKE_CELL 1050,
LAKE_ELONGATE 1.9, LAKE_CIRCLE_FRAC 0.12, DENSITY_CELL 230, DENSITY_THRESHOLD 0.36,
LAKE_RING_BAND 70.

## What's DONE

Hearts (rank-weighted, lakeside-allowed) · arterials connecting them (routed around
water) · lobed/peanut/oval lakes (point-in-polygon) · organic gap-fill forests with
lakeshore rings · the full tuning/inspector/self-test harness · glossary · CHANGELOG
(2026-06-06) + ROADMAP section · all CG1–CG5 tasks (1 parked) · deliberation +
review artifacts. **Lake-heart roads converge on a single shore proxy** (`heartProxy`)
and **route AROUND lakes** (`arterial`→`arcAround`) so far-side neighbors + opposite-
shore hearts connect (seed 1234, 18 km box: 11/11 lake-hearts roaded, 113 around-the-
lake links that were all previously nulled, **0/90,026** road samples in water).
**Forests render as green tree-dots** in the sandbox, not the old wash (render-only;
generation unchanged).

## OPEN / next (prioritized)

> ✅ **DONE 2026-06-06** (Gary's top asks): single shore-proxy convergence for
> lake-hearts + route-around-the-lake routing (`heartProxy` / `arcAround` in
> `roads.js`), and forest tree-dots in the sandbox. See the latest Work Log entry +
> -> D-road-proxy. The two-hearts-across-a-lake gap is fixed by the same route-around.

1. **(Parked, ROADMAP)** rivers + bridges, mega-heart (2×2), in-game map view, collector +
   footpath road tiers, drive-time/traversal probe.
2. **THE BIG ONE — wire the generator into the live 3D game as v2 worldgen.** Replaces
   `chunks.js` `+`-grid + `lakes.js`/`forests.js` placement (not additive). Themes
   (stages/food trucks/vendors/potties/campsites) placed per-point from roleTier + rank +
   facing + noBuild → structurally kills stages-on-roads + keeps structures off water.
   Add every `src/worldgen/*` to BOTH `index.html` AND `sandbox.html` importmaps. Re-run the
   golden hash on Safari/Firefox (cross-engine sin/cos in lake outlines).

## Tripwires for the next agent

- **Determinism (footgun #4):** quantize before any hash/`<`/`===`; reuse `rng.js`; new
  salt for new streams. The self-test must stay green; golden changes only when output
  legitimately changes.
- **Memo caches** in hearts.js/water.js gate on `seed:epoch` — any CONFIG mutation MUST
  call `bumpWorldgen()` (the sandbox sliders do).
- **Cross-engine wobble:** lake outlines use `sin/cos` → a shore vertex can land 1m
  differently across engines, which can flip whether a near-shore arterial exists. Cosmetic
  in 2D; re-verify golden on Safari/Firefox at 3D wire-in (noted in `water.js`).
- **Not wired to the game** — no importmap entries in index.html/sandbox.html yet (by design).
- `map-sandbox.html` has its OWN cache-buster importmap (separate from the game's).

## Artifact pointers (all under `openspec/changes/procedural-map-generator/`)

`proposal.md` (+ Decision Record) · `design.md` (D1–D11) ·
`specs/world-layout-generator/spec.md` + `specs/worldgen-2d-sandbox/spec.md` ·
`tasks.md` (CG1–CG5) · `session-log.md` (work-log history) · `questions-for-human.md`
(Q1/Q4 answered; Q2/Q3 parked) · `deliberations/001-initial/` (briefing + 5 council +
results) · `reviews/001-worldgen/review-summary.md` (Approve + fixes).
