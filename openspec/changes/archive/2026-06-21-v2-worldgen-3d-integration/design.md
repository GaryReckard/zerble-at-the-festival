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

## Festival Layout Redesign (D-K..D-Q — 2026-06-07, supersedes the Group D random scatter)

> **Why this section exists.** Group D (`0ee3c7c`) wired placement end-to-end, but its scatter was
> `10 random slots × per-role probability` — mechanically correct (right kinds in right role bands,
> off road/water) but spatially *uncorrelated*: a confetti of single props, sugar shacks appearing
> solo anywhere a "vendor" slot rolled, drum circles on arbitrary grass, no clustering. Gary flagged
> it from the running game. This section redesigns placement as **structured, feature-anchored
> clusters**. Three deep investigations grounded it: (1) the legacy theme-builder spatial rules, (2)
> the worldgen feature API, (3) the git/CHANGELOG history of how placement was tuned. The history's
> smoking gun: the **camp_village took three framings** to get right (CHANGELOG 2026-05-28, `f0c763a`)
> precisely because the *chunk grid was the wrong anchor* — the packing RULE was good, the
> chunk-centering was the bug. That is the thesis of this redesign: **port the tuned rules, re-anchor
> them to hearts / roads / lakes.**

### D-K — Principle: feature-anchored POI clusters, not per-chunk random scatter
Nothing places per-point-random except sparse low-weight texture (a lone hammock/picnic). Every
festival structure is a **cluster anchored to a worldgen feature** — a heart, one of its approach
roads, or a lakeshore/causeway band. This realizes the worldgen thesis already in the codebase
("a hierarchy of centers … sparsity is the space between hearts" — CHANGELOG 2026-06-06) and the
festival-density bar ("reads as a real festival, not an empty fairgrounds" — `chunks.js:618`). The
legacy distance-ring density (`pickTheme` inner/middle/outer, `chunks.js:585-615`) becomes a
**heart-influence falloff** (cluster count ∝ rank, density ∝ `heartInfluence`), not a world-origin
ring. **Keep the rules that were tuned across multiple passes; drop the chunk-dice anchoring.**

### D-L — New pure sub-layer `src/worldgen/festival.js` (the POI layer)
A new render-agnostic module (no `three`, no `models/*`; may import `hearts/roads/water/density/roles`).
It computes, **memoized per heart and gated on (seed, epoch)** like the other worldgen caches:
- `festivalPlan(heart)` → the heart's full POI list: `[{ kind, x, z, yaw, footprint, role, rank, clusterSeed }]`
  (anchor stage at center; arch+lights, food courts, vendor rows, bubble vendors along approach
  roads; drum circles in the treed district; porta-potty banks attached to each). Counts scale with
  `heart.rank`.
- `poisInBounds(bounds)` / `campVillagesNear(bounds)` → camp villages + lakeshore/causeway camps in a
  region (district/outskirts, off the drag).
- Seeded per heart with `cellRng(heart.cx, heart.cz, SALT.poiLayout = 0x4D41_0B)`; road-shared content
  (clusters living on the H↔neighbor street) with `pairRng(H.cx,H.cz, nb.cx,nb.cz, SALT.poiLayout)` so
  both hearts agree (the same trick `arterialPolyline` uses). A second free salt `0x4D41_0C` is
  reserved for a jitter sub-stream if needed. (`01`–`0A` are taken; `0B`/`0C` confirmed free.)

Three small **new worldgen exports** (additive — they don't reorder any existing rng draw, so the
self-test golden `63c8dea2` stays stable):
- `roads.js approachRoadsOf(heart)` → `[{ neighbor, polyline, bearing }]` — the road-graph-per-heart
  query (compose of `neighborsOf` + `arterial` + `heartProxy`; pick the polyline endpoint matching
  `heartProxy(H)` for the leaving-bearing). This is how courts/rows line the heart's streets.
- `hearts.js nearestMajorHeart(x, z)` → the spawn anchor (expanding-window scan of `heartsInBounds`,
  filter `rank==='major'`, nearest). No rank-filtered query exists today.
- `water.js shoreBand(x, z, N)` → `{ lake, beyond, shoreR } | null` (point dry but within N m of a
  lobed shore; reuse the bearing-sampled outline math `density.lakeRingBoost` already uses). Optional
  helper for causeway/lakeshore camp placement.

### D-M — The cluster catalog (port the tuned legacy numbers; re-anchor)
Each cluster is built world-positioned by `chunks.js` (the build half stays there; `festival.js` is
pure decision). Numbers carried from the tuned legacy builders:
- **Stage anchor** (heart center, off `noBuild`, road-facing `yaw`): major → main stage (6-piece band,
  **22** guaranteed audience), minor → side stage (trio, **12**). Keep the Group-D yaw-aware `buildStage`.
- **Entrance arch + string lights**: along the **primary** approach road (longest/first from
  `approachRoadsOf`), ~25–40 m out from center toward the road, facing the stage. (Legacy main stage
  had arch at `+30`, lights at `z=-25..25` — `chunks.js:1124`.)
- **Food court**: the truck **ring** (3–5 trucks, ~24 m radius, inward-facing; 35% one **sugar shack**;
  one **bubble vendor** at the edge). Positioned **along an approach road**, offset perpendicular off
  the road corridor (off `noBuild`), within ~60–120 m of center. Major: 1–2; minor: 0–1. **Sugar
  shacks ONLY here** (fixes the solo-shack bug). **Fix the one-shot bug:** the legacy ring has *no
  inter-truck overlap check* (`chunks.js:1357`, only the spawn-corridor guard ever saved it) — add a
  min-arc/overlap guard.
- **Vendor row**: double-row tents (5–7/side, 5 m spacing, 7 m offset) oriented **parallel to an
  approach road** (the vendor street). Major: 1–2; minor: 0–1.
- **Bubble vendor**: **one guaranteed refuel vendor per heart** (court edge or roadside) + the court
  edge-chance — refuel becomes a first-class spatial constraint (history flagged it under-structured).
- **Drum circle**: a *destination*, so anchored not scattered — in the **district ring, off-road, in a
  treed/quiet cell** (`treeDensity` high, off-road). Major: 1–2; minor: 0–1. Keep the fire+8-stone-ring
  +djembe+one-proxy-light+polyrhythm-music build.
- **Porta-potty bank**: **attached to each cluster** (court/stage/village), tucked `r+3.5+rng*8` beyond
  it, doors facing the cluster, per-cluster-type size mix (carry `POTTY_THEME`). The legacy
  attach-to-strongest-*chunk*-attractor (`pickPottyAnchor`, `chunks.js:1489`) becomes attach-to-cluster
  (the cluster is known at decision time, no registry/chunk-boundary limit).
- **Camp village**: the **12–20 packed sites** (50/35/15 small/med/large, 5.5 m spacing, 30 m envelope —
  keep the packing engine) in district/outskirts cells **away from roads + the heart center** ("back of
  the festival"), **preferentially in lakeshore bands / causeways** (`shoreBand`). Drop the chunk-corner
  anchor (the thing the 3-attempt history proved wrong).
- **Lakeshore camps + tree rings**: `lakes.js` already does this feature-anchored (4–9 camps, 90–140
  trees sparse-near/denser-far). Keep; this is the template the rest generalizes. Group E may align its
  source to worldgen lakes; the camp/tree-ring *rules* stay.
- **Filler scatter**: sparse hammocks/picnics in open grass, road/water-avoiding (`noBuild`). The only
  random placement, only for low-weight (`weight 0.4–0.6`) texture.

### D-N — Cluster ownership + per-chunk build (stays D-A compliant)
A cluster has a center; the **chunk containing that center owns + builds the whole cluster**
(chunk-keyed, spills into neighbors — exactly how the legacy camp village already worked,
`chunks.js:1845`). This is still a per-chunk *sampler* (D-A), not a heart lifecycle manager: per chunk,
`placeChunkProps` enumerates the relevant hearts (`heartsInBounds` widened by the max POI reach so a
major's road-courts aren't missed), calls the **memoized** `festivalPlan(heart)`, and keeps only POIs
whose center is in this chunk; plus camp villages / lakeshore camps whose center is in this chunk. The
memoization keeps it cheap (plan computed once per heart, not per chunk). District scatter still
**re-derives from worldgen math, never a registry lookup** of the possibly-unloaded anchor (R2/D-C).

### D-O — Spawn at a major heart (Gary's call: "relocate to nearest major heart")
At boot, `nearestMajorHeart(0,0)` → relocate Zerble just outside that heart's **entrance arch**, facing
the **main stage** (drive-in arrival). The arch + stage + string lights come free from that heart's
`festivalPlan` (it's a `core×major` anchor). Force-place the **guaranteed intro jugs near the new spawn**
(keep the 25–60 m seeded ring; Gary: "more jugs"). Keep a **spawn-clearance rule** so no large collider
lands within N m of the spawn point — this replaces the legacy spawn-corridor hack (`chunks.js:572`,
which only existed because the dice could stamp a deck at spawn). Worldgen layout itself is untouched;
spawn is a game-side query (`main.js`/`world.js`). The legacy `(0,0)` pinned-stage special-case is v2-irrelevant.

### D-P — Determinism + the must-not-regress invariants
- Fresh `SALT.poiLayout = 0x4D41_0B` (and `0x4D41_0C` jitter); **quantize any trig result** (bearings
  along roads) before a threshold compare — `sin/cos/atan2` aren't bit-identical across engines
  (footgun #4). Hearts' `x,z` and road vertices are already quantized; the danger is our own intermediate
  trig. Memoize `festivalPlan` gated on `(seed, epoch)`; bound the map.
- The POI layer does **not** touch the `queryPoint` tuple → self-test golden `63c8dea2` stays. Add a
  POI **window-invariance** sanity check (a cluster seeded off a heart outside the scan window would be a
  determinism bug, exactly the class T2/T4 catch).
- **Invariants the history shows were hard-won — must not regress:** (a) nothing spawns in water
  (`noBuild`/`isPointInLake`, lakes pass 2 `0743028`); (b) Zerble never spawns inside/in-front-of a
  structure (spawn-clearance, the `993ba32` fix); (c) stages face out / not back-deck-at-spawn (yaw-aware
  `buildStage`, the named "stages-on-roads" fix); (d) stage music attaches once at build, panner-driven
  (`440f6a7`); (e) every new pooled material tagged `userData.shared` (footgun #6, the `_forestPathMat`
  storm); (f) salt independence — no reorder of existing draws (footgun #4); (g) people don't shove a
  parked Zerble (`806a689`).

### D-Q — Perf
`festivalPlan` memoized per heart (computed once, filtered per chunk) keeps the per-chunk sampler cheap;
the build cost is the allocation spike when a heart-center or village chunk loads (12–20 campsites, a
truck ring) — accept per the existing R11 model (rare per frame, ~1 heart per ≥440 m), split across
frames only if `chunkGenStats` shows it. Re-measure the per-chunk placement cost **headlessly in node**
(the browser HUD is hidden-tab throttle-inflated — Group C lesson) against the 8 ms R7 gate. Hold the
shadow-caster budget; the camp-village + lakeshore-ring tree counts are the lever (R3, re-budget with
Group F).

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
