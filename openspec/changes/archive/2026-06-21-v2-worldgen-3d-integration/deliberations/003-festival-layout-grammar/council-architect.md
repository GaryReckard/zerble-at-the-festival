## The Architect's Position

> Round-1 position on the Festival Layout Grammar spec
> (`festival-layout-grammar.md`), through the structural-integrity lens:
> module boundaries, the front-axis `F` abstraction, cluster ownership across
> chunk seams, the overlap guard's architectural home, and registry/lifecycle
> soundness.

### Priority Sequence

The spec's own §9 build order is close to right, but it under-weights one
structural prerequisite (the dancefloor exposure mechanism) and buries one
boundary decision (where `F` lives) inside step 1. My re-prioritized order:

1. **Front-axis `F` as a pure, memoized field of the plan — built and unit-checked
   FIRST, but designed as a *typed return shape*, not a loose local.** `F`,
   `dancefloorRect`, and the per-cluster footprint circles are new pure data that
   `festival.js` computes. Decide the contract now: does `festivalPlan(heart)` keep
   returning a flat descriptor array, or does it return `{ axis, rects, descriptors }`?
   I argue for a flat array PLUS a sibling pure export `festivalClearings(heart)`
   (or a `kind:'dancefloor_clear'` descriptor with no model) so the tree layer can
   consume clearings without importing the plan's internals. This is the keystone
   for step 3 and must be settled before any placement rule is written. (§3, D-L.)

2. **The dancefloor-clearing EXPOSURE path — designed before the per-entity rules,
   because it is the only genuinely NEW cross-module data flow in this spec.** A4
   ("`scatterWorldgenTrees` must skip trees inside the dancefloor") is a cross-CHUNK
   dependency, not a within-chunk one (see Structural Risks, §1). Solve the plumbing
   (how a rect computed by a stage's owning heart reaches a *neighbor* chunk's tree
   scatter) before you write the rules that produce the rects, or you will build the
   rects into a place the tree layer can't see and discover it only when you boot the
   game and find trees in the dancefloor.

3. **Re-anchor stage → drum → court → row → bubble → porta to `F` + the §4 rules,
   reusing the existing descriptor/`clusterSeed`/`anchor` contract verbatim.** The
   descriptor shape (`desc()`, `festival.js:87`), the cluster-local rng
   (`buildWorldgenKind`, `chunks.js:1097`), and the ownership filter (`placement.js`)
   are all sound and must NOT change shape. This step rewrites only the *body* of
   `_computePlan` — the WHERE — leaving the plumbing on either side untouched.

4. **The overlap guard as a final pure pass inside `_computePlan`, operating on the
   `footprint` field that already exists** (`KIND_FOOTPRINT`, `festival.js:63`). It
   is a layout-layer concern, not a build-layer one (see §3). It complements — does
   not replace — the existing `closestBuilding` cluster guard in `placeWorldgenProps`
   (`chunks.js:1082`), which stays as the cross-chunk-load-order insurance.

5. **Arch relocation: delete the per-hub `arch` descriptor (festival.js:199-207),
   move it to a spawn-only build, and FIX the `main.js` spawn block that currently
   reads `plan.find(p => p.kind === 'arch')`** (`main.js:221`). This is a coupled
   change — removing the descriptor breaks spawn unless both land together (see §4).

6. **Park to a follow-up: picnic tables (new `models/picnicTable.js` — full
   sandbox-checklist cost), tent-stage catalog variety, hammock trunk-pair post-pass,
   lone field trees.** These are additive texture (D-M "filler scatter"); none of them
   change the layout grammar or its boundaries. They earn their own sandbox entries
   and importmap rows and should not ride the structural rewrite.

### Structural Risks Identified

- **The dancefloor-clearing exposure is a cross-CHUNK data dependency the spec
  treats as within-chunk — this is the single biggest structural hazard.** In
  `chunks.js:512-514` the order per chunk is `placeWorldgenRoads` → `placeWorldgenProps`
  → `scatterWorldgenTrees`. That ordering only protects trees against clusters whose
  *center is in the same chunk*. But a stage is chunk-keyed at the chunk containing
  its center and its dancefloor extends `~3 stage-lengths` (≈27 m at scale 1) in `+F`
  — easily across an 80 m chunk boundary into a NEIGHBOR chunk. That neighbor chunk
  runs its own `scatterWorldgenTrees` with no knowledge of the stage. `scatterWorldgenTrees`
  today consults only `ctx.region.roads` (`chunks.js:1001`) and `registry.closestBuilding`
  (`chunks.js:1007`), and `forest_tree` is explicitly in `TREE_GUARD_SKIP` / clusters
  are in `CLUSTER_GUARD_SKIP` — so the registry guard is deliberately blind here, AND
  chunk load order is non-deterministic (the neighbor may scatter trees *before* the
  stage's chunk builds). **Failure mode:** trees grow inside a dancefloor owned by an
  adjacent chunk; A4 is silently violated; it passes in the sandbox (one model, no
  neighbors) and fails in the game. **Mitigation:** the dancefloor rects must be a
  pure query of `(x,z)` — `scatterWorldgenTrees` must call something like
  `festivalClearings`/`dancefloorRectsNear(chunkAABB)` keyed off the OWNING HEART,
  exactly as `placeChunkProps` enumerates owning hearts by expanding the AABB by
  `MAX_POI_REACH` (`placement.js:38`). It must NOT read the registry (load-order
  dependent) and must NOT read a flag set during this chunk's `placeWorldgenProps`
  (only set for in-chunk stages). This is a new, load-bearing pure export and it is
  the work item §2 in my Priority Sequence.

- **Where `F` lives — boundary risk if it leaks into `models/` or `chunks.js`.**
  `F` is a worldgen layout abstraction; it belongs entirely inside `festival.js` as a
  pure computation, consumed only as already-resolved `yaw`/`x`/`z`/`rect` fields in
  the descriptor. The stage model (`buildStageModel`, via `chunks.js:2098`) already
  takes a `yaw` and rotates the group (`chunks.js:2106`); the model's local `+Z` is
  the front (`chunks.js:2100`). That contract is correct and must hold: `festival.js`
  resolves `F` → a stage `yaw`, and the model stays ignorant of `F`. **The risk is
  the dancefloor rect** — it is computed from `F` and stage scale, but `festival.js`
  does NOT know the stage's runtime `scale` (it's rolled in `buildStage` from
  `ctx.rng`, `chunks.js:2094-2096`). If the spec wants the clearing sized to the
  actual deck, that scale must move into the plan (deterministic, off `clusterSeed`)
  so the rect and the model agree. **Either** make `festival.js` own the stage scale
  (cleanest — both layout and clearing derive from one seeded value) **or** size the
  dancefloor off a fixed nominal stage footprint independent of per-instance scale
  (looser but keeps the boundary clean). I lean toward moving stage scale into the
  plan: it makes the clearing/model/footprint all derive from `clusterSeed`, and it
  is the determinism-correct home anyway.

- **`festival.js` staying a pure SAMPLER vs. drifting into a heart lifecycle manager
  (D-A).** The spec does not propose a `HeartManager`, which is correct. The grammar
  rewrite is contained inside `_computePlan` and stays pure DATA — good. The drift
  risk is subtle: the overlap guard (§5) and the front-axis ray-walk both call
  `queryPoint` repeatedly. That's already the established pattern (`nudgeOff`,
  `treedDistrictSpot`) and is fine because `festivalPlan` is memoized per heart and
  the per-chunk filter only SELECTS. The line not to cross: nothing in `festival.js`
  may key off the querying CHUNK, hold mutable cross-heart state, or read the registry.
  As long as `F` and the overlap guard are pure functions of `(heart, roads, lakes)`
  seeded only off the heart (window-invariance, D-P, R18), D-A holds. **Flag for the
  implementer:** the overlap guard must resolve overlaps deterministically and
  symmetrically — its result cannot depend on cluster *enumeration order across
  hearts*, only within a single heart's plan, or a cluster's final position becomes
  window-dependent.

- **Cluster ownership across chunk boundaries is sound TODAY and the grammar must not
  break it.** The current contract (`placement.js:29-43`): a cluster is owned by the
  chunk containing its *center* (half-open AABB test, `placement.js:31`), spills into
  neighbors, and `MAX_POI_REACH` (480 m, `festival.js:58`) bounds how far a center
  sits from its heart so the owning chunk always enumerates the heart. The grammar
  changes WHERE centers land but not how far — **provided** the new front-axis-relative
  placements stay within `MAX_POI_REACH`. The food court "ring radius" being made
  "generous" (§4, A7) and vendor rows pushed "out past the dancefloor" (`core + 20..70`,
  §4) are the watch items: a major's `core` is 350 m, drum band is 130 m
  (`festival.js:57-58`), so `MAX_POI_REACH` is already at the drum's limit. If any
  new placement (a court ring edge, a far vendor row) pushes a cluster CENTER past
  480 m from the heart, `placement.js` will silently drop it (R16, BINDING). **The
  spec must assert every new placement keeps the cluster CENTER ≤ `MAX_POI_REACH`,
  or bump `MAX_POI_REACH` and re-verify the `placement.js:36` reach math AND the
  `≤ 440 m` heartsInBounds-pad assumption from R16.** This is the most likely "hole
  in the festival" regression.

- **The overlap guard belongs in the layout layer, not the build layer — and it
  must not fight the existing `closestBuilding` guard.** §5 describes a footprint-radius
  push-out/drop pass. Architecturally this is a `_computePlan` concern: it operates on
  descriptors that already carry `footprint` (`festival.js:88`), it's pure, it's
  deterministic, and it's seeded off the heart — so it composes with the plan memo and
  window-invariance for free. Putting it in `chunks.js` would (a) re-introduce a
  cross-chunk-load-order dependency (a neighbor's cluster may not be in the registry
  yet) and (b) duplicate the `CLUSTER_GUARD_SKIP` logic (`chunks.js:1063`). The
  existing `closestBuilding` guard in `placeWorldgenProps` (`chunks.js:1082-1085`)
  stays as a SECOND, complementary net for the genuinely cross-chunk-load-order case
  (a stage from a neighbor chunk that wasn't in this heart's own plan) — it should NOT
  be deleted just because the layout-layer guard exists. Two guards, two scopes:
  intra-heart layout overlap (pure, in `festival.js`) and inter-heart/load-order
  stacking (registry, in `chunks.js`). The spec should name both explicitly so the
  implementer doesn't collapse them.

- **Arch relocation is a coupled boundary change — descriptor deletion and the
  spawn-block read must land together.** `main.js:218-244` resolves spawn by reading
  the major heart's plan and doing `plan.find(p => p.kind === 'arch')` (`main.js:221`)
  and `plan.find(... 'main_stage'|'side_stage')` (`main.js:220`). The spec (§6)
  removes the arch from the per-hub plan and builds it once in the spawn block. If
  the descriptor is deleted (`festival.js:199-207`) without rewriting `main.js`,
  `arch` becomes `undefined`, the `if (stage && arch)` guard fails, and spawn silently
  falls back to legacy `(0,65)` — a quiet regression that boots clean (no crash) so
  the smoke test passes while the intended arrival is gone. **The arch's new home:**
  it is no longer worldgen layout data; it becomes a spawn-time game-side build in
  `main.js`/`world.js`, positioned from the spawn heart's primary approach road
  (`approachRoadsOf(heart)[0]`). That keeps it out of `festival.js` (correct — it's a
  singleton, not per-hub data) but means the arch geometry/collider lifecycle is now
  owned by the spawn block, NOT a chunk. **Decide its disposal owner:** if the arch is
  built outside the chunk system it has no `chunkKey` and never unloads (fine — it's a
  singleton at origin, like the persistent lake colliders that deliberately omit
  `chunkKey`, footgun #5). But it must NOT be registered with a chunkKey it doesn't
  belong to, or it vanishes when an unrelated chunk drops.

- **Determinism surface widened by exactly one new trig consumer — the front-axis
  bearing — and the spec already names it (§3.3, §7).** This is the right call and
  matches R20 (BINDING). The concrete requirement: the chosen `F` bearing must be
  quantized to a fixed grid (§3.3) BEFORE it is used in any threshold compare (the
  water-penalty ray test, the gap-width scoring tie-break). The §3.4 zero-road
  fallback's "ties → lowest quantized bearing index" is the correct deterministic
  tie-break. **One under-specified spot:** §3.2's "walk out the bisector; if the ray
  hits a lake or stays `noBuild`, penalize hard" — the lake-hit test must use
  quantized sample points (it calls `queryPoint`/`nearestLake` along a `sin/cos`
  bearing), or two engines could score the same candidate differently and pick a
  different `F` → a per-engine festival orientation, the exact R20 class. The bisector
  bearings derive from road outward bearings, which come from `approachRoadsOf`'s
  already-quantized road vertices, so the *input* bearings are stable; the danger is
  the *scoring ray* sample positions. Name it.

### Verdict

-   **Verdict**: **Proceed with mitigations.**
-   **Key Concern**: The dancefloor-clearing (A4) is a cross-CHUNK data dependency,
    not a within-chunk one. The spec's §9 step-3 ("clearing rects exposed →
    `scatterWorldgenTrees` honors them") hides the hard part: a stage's dancefloor
    routinely spills into a neighbor chunk, whose `scatterWorldgenTrees` cannot see
    it via the current `ctx.region`/registry path and may run before the stage's chunk
    builds. This must be solved as a NEW pure `dancefloorRectsNear(chunkAABB)` export
    keyed off owning hearts (mirroring `placement.js`'s `MAX_POI_REACH` enumeration),
    NOT a same-chunk flag — or trees grow in the dancefloor in-game while the sandbox
    says ship it.
-   **Recommendation**: The grammar is architecturally well-founded — the front-axis
    `F` is the right keystone, it lives correctly inside the pure `festival.js` layer,
    and the descriptor/`clusterSeed`/ownership plumbing on either side is sound and
    untouched. Proceed, conditioned on five mitigations, in this order: (1) design the
    cross-chunk dancefloor-rect exposure as a pure heart-keyed query before writing
    placement rules; (2) decide where stage `scale` lives so the clearing and model
    agree (move it into the plan, off `clusterSeed`); (3) assert every front-axis-relative
    cluster CENTER stays ≤ `MAX_POI_REACH` (480 m), or bump it and re-verify the
    `placement.js` reach math + R16's 440 m pad; (4) implement the overlap guard as a
    pure deterministic pass inside `_computePlan` that complements — not replaces — the
    `closestBuilding` cross-load-order guard in `chunks.js`; (5) land the arch
    descriptor deletion and the `main.js:218-244` spawn-block rewrite in the SAME slice,
    and give the spawn-built arch a clear disposal owner (singleton, no chunkKey).
    Quantize the front-axis scoring ray's sample points (R20). None of these are blockers
    — they are precisely the structural seams where a clean-looking pure rewrite leaks
    into a cross-chunk or cross-engine bug, and the spec already gestures at four of
    the five.
