## Context

The `procedural-map-generator` change built and tuned a deterministic, render-agnostic
`src/worldgen/` generator (hearts → arterial roads → lobed lakes → density forests) and a
2D sandbox to design it. It is verified (self-test 20/20) but **not wired into the game**.
This design covers spending that asset: replacing the live game's per-chunk content with
worldgen-driven placement.

**Current game world systems (what we're replacing/keeping), from the codebase map:**

- **`chunks.js`** — 80m chunks, lazy-load ring (`PERF.chunkLoadRadius` 1–2), **1 chunk/frame
  budget**, never-unload-until-`UNLOAD_RADIUS`. Per chunk: `placePaths` stamps a rigid `+`
  (two 5m dirt ribbons through the chunk center), `pickTheme(cx,cz)` (`mulberry32(worldHash(cx,cz,1))`,
  salt=1) selects a theme, `THEME_BUILDERS[theme](ctx)` places props **radially/randomly
  around the chunk center** (the stages-on-roads problem), then `scatterTrees` / `scatterPortaPotties`
  / `spawnAmbientCrowd` / `scatterBubbleJugs`. The `ctx` carries `{cx,cz,key,theme,cxWorld,
  czWorld,rng,group,crowd}`. Props `registry.add({kind,position,footprint,collider,attractor,
  chunkKey:ctx.key})`. On unload, `registry.removeChunk(key)` sweeps chunkKey'd entries (skips
  `userData.shared`).  **KEEP** the streaming engine + budget + lifecycle; **REPLACE** paths +
  pickTheme + THEME_BUILDERS + scatterTrees source.
- **`lakes.js`** — `LakeManager`, 320m macrocell, 45% density, load 720 / unload 1500, builds
  `ShapeGeometry` from an outline polygon + sealed-perimeter sphere colliders (`lake_edge`,
  **NO chunkKey** — footgun #5) + beaches + lakeside campsites + tree rings. `WATER_MAT`
  shared. **KEEP** lifecycle/mesh/collider; **REPLACE** the placement source (its own rng →
  worldgen `lakesInBounds`/`lakeInCell` lobed outlines).
- **`forests.js`** — 5x5 chunk blocks, one center at (2,2), 3x3 footprint, `getForestAt`
  pure-hash, chunk-keyed, designed interior (paths + central campsite/drum circle). Tree
  models in `models/tree.js` (pooled trunk geo + foliage mats `userData.shared`, lowest-tier
  castShadow only). **REPLACE** the 5x5 system with per-chunk `treeDensity` scatter; **KEEP**
  the tree models + pooling + shadow discipline.
- **Boot** (`main.js`/`world.js`): title tap → `Sound.init()` (sync, iOS) → `buildWorld(scene,
  crowd)` → `lakeManager.update()` (FIRST, so chunks see lake footprints) → `chunkManager.update()`
  → render loop. Seed: `?seed=` → `setSessionSeed` → `SESSION_SEED` global → **worldgen already
  reads it** via `worldgen/index.js setSeed`. threeShim Lambert swap on low tier. Importmap
  `mods`/`models` arrays in **both** `index.html` and `sandbox.html`.
- **Crowd** (`crowd.js`): `spawnAmbientCrowd(ctx,count)` clusters NPCs at in-chunk attractors
  (weight≥0.5, 70% near), counts per theme; NPCs also pulled toward the 80m path grid. **KEEP**
  the contract; **CHANGE** counts (heart-influence weighted) + the path attraction source
  (worldgen roads, not the grid).
- **Collision** (`main.js`/`registry.js`): circle-circle via 8m spatial hash; damage per kind.
  **UNCHANGED** (only what registers changes).

## Goals / Non-Goals

**Goals:**
- The game boots and generates a worldgen-driven festival: hearts as themed anchors, arterial
  roads, lobed lakes, density forests, themed props per role — **no JS errors**, reads well at
  noon + midnight.
- Structurally kill stages-on-roads + structures-in-water by honoring `noBuild`/`facing`.
- Hold per-tier perf budgets (low 80/150k, mid 200/400k, high 400/1.2M) and keep the
  determinism self-test green; re-verify the golden on the game path.
- Ship behind a flag so the game stays bootable and rollback is one switch.
- Land the road junction-merge (the "lens" fix), tuned in 2D first.

**Non-Goals:**
- Rivers + bridges, mega-heart, in-game map view, footpath/collector road tiers (parked, ROADMAP).
- Changing the registry/collision/spatial-hash/audio contracts or the model set.
- A new lifecycle manager for hearts (we reuse the chunk streaming engine — see D-A).
- Removing the old `THEME_BUILDERS`/`forests.js` code in THIS change (kept behind the flag;
  a follow-up cleanup retires it once v2 is proven in production).

## Decisions

### D-A — Integration shape: a per-chunk worldgen *sampler*, not a heart lifecycle manager
When a chunk `(cx,cz)` generates, it computes its world AABB, calls `queryRegion(bounds)` once
(hearts/roads/lakes intersecting), and samples `queryPoint` at candidate placement points
within its 80m cell. It places only what belongs in *its* cell. **Alternative considered:** a
`HeartManager` (like `LakeManager`) that builds a whole heart's worth of geometry on distance.
**Rejected:** a major district is ~1000m (12+ chunks) — building it at once blows the 1-chunk/frame
budget and stalls on boost into new territory; per-chunk scatter spreads cost across the existing
streaming budget and reuses the proven engine (D1). The chunk stays the unit of work.

### D-B — `placement.js`: the single role→theme mapping
A new pure module maps `(heart, roleTier, rank, point, rng)` → what to place, centralizing the
decision that's today scattered across `THEME_BUILDERS`. It promotes the `wouldHost()` mapping
Gary already tuned in the map sandbox inspector into real placement:
- `core` + `major` → main stage + food-truck court + vendor rows (anchor at heart center)
- `core` + `minor` → side/tent stage + a few trucks/vendors
- `district` + `major` → campsites + drum circles + porta-potty banks + vendors
- `district` + `minor` → campsites + small vendors + porta-potties
- `outskirts` → sparse; dense-forest cells may host a drum-circle clearing
**Alternative:** keep per-theme builders keyed on a worldgen-derived "theme". Rejected — that
re-introduces the chunk-as-theme model; role+rank is the worldgen-native axis and avoids a
lossy theme round-trip.

### D-C — Heart-anchor ownership: the chunk containing the heart center builds the anchor
A heart's single anchor structures (main/side stage, entrance arch, court) are built by the one
chunk where `floor(heart.x/CHUNK_SIZE)==cx && floor(heart.z/CHUNK_SIZE)==cz`. Chunk-keyed
(unloads with that chunk; regenerates identically). District/outskirts props (camps, vendors,
potties, trees) are **scattered per-chunk** by sampling role at jittered points. This cleanly
resolves "a heart spans many chunks": one owner for the anchor, distributed scatter for the rest.

### D-D — Roads: chunk-clipped arterial ribbons, chunk-keyed, passable
Each chunk renders the portions of worldgen arterials passing through its AABB: clip each
polyline to the chunk, build a dirt ribbon (reuse the `buildCurvedPath` ribbon + the shared
road material). Because the whole arterial is one pair-owned deterministic curve, the two halves
in adjacent chunks meet at the boundary with **no kink** (footgun-free seam). Roads are
**passable** (no collider) and register as a crowd path-attractor so NPCs drift along them.
Chunk-keyed mesh (regenerates identically on reload).

### D-E — Lakes: `LakeManager` reads worldgen, keeps everything else
Swap only the placement source: `LakeManager` enumerates lakes from `lakesInBounds`/`lakeInCell`
(lobed outlines, 1050m cell) instead of its own 320m-macrocell rng, and builds its existing
`ShapeGeometry` water + sealed-perimeter colliders along the worldgen outline. Lifecycle
(distance load/unload), `WATER_MAT` (shared), beaches, and **no-chunkKey** colliders are
unchanged. Minimal blast radius; preserves footgun #5.

### D-F — Forests: per-chunk `treeDensity` scatter, reusing the tree models
Replace the 5x5 block system. Per chunk, scatter `buildForestTree` instances at jittered points
where `treeDensity(x,z) > placeThreshold`, count ∝ `density × cellArea × PERF.forestTreeDensityMul`,
chunk-keyed, honoring `noBuild` + building footprints. Keep pooled geometry/materials
(`userData.shared`) and lowest-tier-only castShadow. The "drum circle nested in dense forest"
POI becomes a role+density-driven placement (outskirts + high density), sampled deterministically.

### D-G — Feature flag `USE_WORLDGEN_V2`
A const (read with `?worldgen=0` override) gates the new content-selection path in `chunks.js`
and the placement source in `lakes.js`. Both paths coexist *during this change*; the old code is
retired in a follow-up once v2 is proven in production. Keeps the game bootable at every commit
and gives an instant rollback for a world-regenerating break (D2).

### D-H — Determinism on the game path
Worldgen is already deterministic + seed-routed. The WHAT (role→theme) comes from worldgen
(deterministic); per-chunk scatter JITTER uses the chunk's existing `mulberry32(chunkSeed)`
stream OR fresh salts — **new randomness gets a fresh salt** (footgun #4), never reorders an
existing `rng()` call. The worldgen self-test stays green (worldgen logic unchanged except the
junction pass, which carries its own T4/T5 invariance). Re-verify the golden on the game path;
cross-engine `sin/cos` divergence is documented (dangling thread).

### D-I — Road junction-merge: a deterministic, window-bounded 2nd pass (2D-first)
Per heart B, gather its incoming arterials (from B's window-bounded neighbors), cluster
approaches by arrival bearing, and merge a same-bearing cluster into a single shared trunk
(junction → B) with the edges forking to the junction. Pure function of B's local edge set →
deterministic, symmetric, non-recursive (reads pass-1 polylines, doesn't feed back). Built and
tuned in `map-sandbox.html` first. Must keep self-test T4/T5 green.

### D-I REVISED (post-deliberation 001-initial, 2026-06-06) — road SOURCE-OF-TRUTH = RAW
The council (Adversary V1, Architect #7) surfaced that the junction-merge produces a *merged*
road network, but every placement gate the game relies on (`nearestRoad` → `onRoad`/`roadTier`/
`facing` → `noBuild`, and the self-test T4/T5 + the golden) reads the **raw first-pass arterials**.
Shipping "3D consumes the merged network" while gates read raw = a silent desync (a stage lands
where the old arterial ran; a rendered merged road passes a build-OK spot) with a green self-test
giving false confidence.

**Decision (Option b, the council's recommendation; Gary's standing autonomous directive → take
the default):** the **3D game consumes the RAW arterial network for both rendering and the
`noBuild`/`facing`/crowd gates.** `nearestRoad`/`roadsInBounds` are the single source of truth and
are **unchanged** by this change → the contract stays append-only, the self-test stays green **by
construction**, the golden does not move for the 3D wire-in, and no cross-engine merge math
(`atan2`/bearing-cluster) enters the per-chunk hot path. The world reads as a coherent place with
raw per-edge arterials; the redundant-"lens" cosmetics are a known, accepted minor.

**Consequence:** the junction-merge (was the leading task here) is **deferred to a separate
2D-sandbox-only fast-follow change** (`worldgen-road-junction-merge`). It would later add merged
roads to `queryRegion` as an additive (append-only) passthrough; the 3D consumer does not need it
now. If a future call prefers merged-everywhere for visual quality, that override MUST re-derive
T4/T5 and re-record the cross-engine golden against the merged network before the roads task.

### D-J — Perf
Roads = few ribbon draws; trees = existing pooled models (InstancedMesh where the current forest
uses it); shadow discipline preserved. Per-chunk `queryRegion` is bounded (60k-cell cap +
memoized cells + the arterial memo already added). Measure draws/tris in the backtick HUD at
`?perf=low` and `?perf=mid` every milestone; the budget panel is the gate.

## Risks / Trade-offs

- **Boot crash in the longest call chain** (`buildWorld → ChunkManager.update → _generate →
  placement`) → Mitigation: feature flag + boot smoke test (title→start→2.5s→console) every
  milestone; watch the `{group,...}` vs `Group` return-shape footgun that bit a prior change.
- **Frame stall when a heart-anchor chunk loads** (stage + court at once) → Mitigation: anchors
  are ~1 per ≥440m so they're rare per frame; if a stall shows in the HUD, split anchor build
  across frames. Accept minor first-load stalls (existing behavior).
- **Determinism regression** → Mitigation: self-test green gate + golden re-check; fresh salts only.
- **Lake feel changes** (worldgen 1050m cell + lobed vs old 320m round) → Mitigation: tune
  worldgen lake CONFIG by eye in the map sandbox; A/B against `?worldgen=0`.
- **Crowd pathing with continuous roads** (vs the old 80m grid attraction) → Mitigation: tune
  road attractor weight; keep heart attractors dominant.
- **Cross-engine road-existence flip** (sin/cos) → Mitigation: documented; integer orientation
  test only if it flips a *collider's* existence (not just cosmetic shore wobble).
- **Scope is large** → Mitigation: phased Change Groups (tasks.md), HANDOFF + compact at ~75%
  context, each CG independently bootable behind the flag.

## Migration Plan

Phased, flag-gated, each phase ends bootable + verified:
1. **Road junction-merge** (2D sandbox only) — tune + self-test green.
2. **Scaffolding** — `USE_WORLDGEN_V2` flag, importmap in both html files, `placement.js`
   skeleton, seed routing confirmed.
3. **Roads** — chunk-clipped arterial ribbons replace the `+`-grid (flag on).
4. **Lakes** — LakeManager reads worldgen.
5. **Forests** — density scatter replaces 5x5.
6. **Themes/props** — placement.js drives anchors + scatter per role/rank.
7. **Crowd** — heart-influence-weighted spawn + road attraction.
8. **Perf + determinism + cross-engine** — budget gate, golden re-check, ?perf=low/mid.
9. **Docs** — CHANGELOG, ROADMAP trim, ARCHITECTURE update, HANDOFF.

**Rollback:** `?worldgen=0` (or flip `USE_WORLDGEN_V2`) restores the shipped world instantly.

## Open Questions

None blocking — running autonomously per Gary's standing directive (questions-for-human Q0).
Logged assumptions A1–A5 (session-log) carry sensible defaults: A2 (forest feature parity) and
the lake-feel trade-off are the two to eyeball during apply.
