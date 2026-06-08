# The Profiler's Position — Festival Layout Grammar (deliberation 003)

> Domain: runtime cost on the target device, especially low/mid tiers.
> Lens: draws/tris vs per-tier budget, allocation stall vs steady-state FPS,
> the per-chunk SAMPLER cost against the 8 ms R7 gate.

This redesign is, perf-wise, almost entirely an **allocation-time** story, not a
steady-state one. The arrangement changes (front axis, sectoring, overlap guard)
don't add per-frame work — they run at chunk-gen. The two levers that DO move the
budget are (a) the **per-chunk tree-scatter loop** the dancefloor clearing now has
to touch, and (b) the **draw/tri rebalance** as trees relocate out of the clearing.
Steady-state draws/tris are mostly conserved; the squeeze is the 8 ms R7 gate and
the low-tier draw budget.

## Priority Sequence

1. **Front-axis `F` + §3 scoring lands as a value memoized PER HUB on the plan,
   computed once inside `_computePlan` (festival.js:172) — not per chunk, not
   per tree.** It is the cheapest place to put the trig and the only place that
   keeps the per-chunk sampler honest. `festivalPlan(heart)` is already memoized
   on `(seed,epoch)` (festival.js:153-170), so `F` and the clearing rects ride
   that cache for free.
2. **Re-anchor the §4 placement rules + the §5 overlap guard against `F`.**
   Accept the allocation spike (rare per frame — ~1 hub per ≥440 m, D-Q); do NOT
   pre-split the build across frames until `chunkGenStats` actually shows a
   breach. Premature frame-splitting adds complexity the budget panel hasn't
   asked for (performance.md "Don't optimize before you've measured").
3. **Dancefloor-clearing rects: expose them as a small precomputed list on the
   plan; hand THAT to `scatterWorldgenTrees` (chunks.js:988).** The tree loop
   tests each candidate against a handful of oriented rects via cheap point-in-
   rect math — never a `festivalPlan()` call or a `queryPoint()` call per tree.
4. **Re-budget tree counts AFTER the clearing lands**, because the clearing
   relocates trees, it does not net-delete them (see §"Dancefloor clearing").
   Hold the R3 `MAX_WORLDGEN_TREES = 80` cap (chunks.js:979).
5. **Measure headlessly in node** against the 8 ms R7 gate at low/mid tree-mul
   equivalents BEFORE declaring done (D-Q: "the browser HUD is hidden-tab
   throttle-inflated — Group C lesson"). Park nothing else until that gate is
   green.

## Per-chunk SAMPLER cost (the 8 ms R7 gate)

The real per-chunk hot path is **NOT** `festivalPlan` (memoized) — it is the
**O(N) registry scan inside the tree loop**. `scatterWorldgenTrees`
(chunks.js:988-1024) runs up to `target * 4` attempts (`target` ≤ 80, so up to
**320 iterations**), and each surviving candidate calls
`registry.closestBuilding(...)` (chunks.js:1007), which is a **full linear scan
over `this.entries.values()`** (registry.js:146 — no spatial-grid acceleration on
this path). On a hub-center chunk the registry already holds every stage / tent /
truck / camp entry from this and neighboring loaded chunks, so each tree attempt
is O(entries). This loop is the existing dominant per-chunk cost; it is what the
8 ms gate is mostly measuring.

**The clearing test must NOT inflate this loop.** The grammar says
`scatterWorldgenTrees` "must skip trees inside the dancefloor rect" (§4, A4). The
correct shape:

- The clearing rects come from the hub plan, already computed and memoized.
  `scatterWorldgenTrees` fetches them ONCE at the top of the function (the hubs in
  the widened AABB are already enumerated by the placement sampler — reuse that
  list, don't re-enumerate).
- Per candidate, test against each rect with **oriented point-in-rect** math:
  translate to rect center, rotate by `-F` bearing (precompute `sin/cos` of the
  quantized bearing ONCE per rect, store on the rect), compare against half-
  extents. That's ~6 mults + 2 compares per (candidate, rect) pair. With ≤2–3
  rects per nearby hub and 1–2 hubs in range, this is **single-digit
  microseconds per candidate** — negligible next to the O(N) `closestBuilding`
  call already in the loop.

**The failure mode to block:** a naive implementation that calls
`festivalPlan(nearestHeart(...))` or `queryPoint(x,z)` **inside** the per-attempt
loop. `treeDensity(x,z)` is already called per attempt (chunks.js:998) and itself
runs `lakeAt` + `organic` (≈6 `vnoise` octaves, density.js:30-36) +
`nearestHeart` (memoized). Adding a second worldgen query per attempt would
roughly double the per-tree field cost across 320 attempts — that's the kind of
thing that quietly pushes a treed hub-center chunk over 8 ms on a mid laptop.
This is the same per-attempt-query trap R7 already called out
(chunks.js:1027 — "no per-attempt worldgen query (R7)").

**Overlap guard (§5) cost:** the guard is per-CLUSTER, not per-point — at most
~10–14 clusters per hub (stage, arch, 1–2 courts, 1–2 rows, drum, bubble, portas,
camps). An O(k²) all-pairs footprint check across k≈14 clusters is ~100 distance
tests, sub-microsecond. It rides the memoized plan, runs once per hub, costs
nothing measurable. No concern here — the guard is cheap; the tree loop is the
cost.

## Allocation spikes (hub-center / camp chunk)

This is the one place a stall can show, and the spec piles MORE onto the
single-chunk worst case:

- **Camp village** (chunks.js:1259) already builds **12–20 campsites** in one
  shot, each `placeSingleCampsite` a multi-mesh group. The grammar's D1/D2/D3
  says "tent count ≈ crowd count (~1.5×)" and "small camp tucked behind each
  vendor tent" — that ADDS camp instances per hub on top of the village.
- A hub-center chunk now potentially co-locates: **stage + 1–2 food courts
  (truck ring + sugar shacks + picnic tables) + 1–2 vendor rows (10–14 tents) +
  drum circle (full leaf circle: fire/dancers/drummers/benches) + the denser
  dancefloor-grounds (chairs + blanket clumps) + camps** — all in the chunk
  containing the hub center.
- This is precisely the prior council's **R24** (forest × lakeshore-ring ×
  village × drum-circle stacking — my Key Concern in deliberation 002,
  results.md:451). R24 is NOT closed; the grammar's lakeshore-camp and
  per-vendor-camp rules make the worst-case chunk DENSER, not lighter.

**Mitigation stance:** the *anchor* (stage) is one per ≥440 m, so a full
hub-center chunk is rare per frame — accept the spike per D-Q / R11, but
**instrument it**. The 1-chunk/frame budget (`BUDGET_PER_FRAME = 1`,
chunks.js:292) already spreads adjacent chunk loads; the risk is the SINGLE chunk
that holds the hub center exceeding 8 ms by itself, which the per-frame budget
cannot split. If the headless gate shows that one chunk > 8 ms at low tier, the
fix is to **defer the drum circle and camp village within the anchor chunk to the
next 1–2 frames** (a sub-chunk build queue), not to thin the content. Park that
queue until the gate proves it's needed.

**New picnic tables (`models/picnicTable.js`, C2):** new geometry/material. It
MUST pool (`userData.shared = true`, perf-pooling.md) — a per-court fresh
geometry/material would (a) add allocation cost per court chunk and (b) risk a
shader-recompile storm if mis-disposed on chunk unload (the
`!userData.shared` dispose walk at chunks.js:347-351 is the guard). One pooled
table geometry + a small color-bucket of materials, same pattern as
`SUPPLY_CAN_GEO` / the campsite `matFor` cache.

## Dancefloor clearing — net draw/tri effect

This is the subtle one, and the briefing flags it correctly. Clearing a rect in
FRONT of the stage **removes trees from that rect** — locally that drops draws
and tris where the camera most often points (good: a clean sightline to the
stage costs less than a wall of `buildForestTree` trunks). BUT:

- `scatterWorldgenTrees` is a **rejection-sampling loop to a TARGET count**
  (`placed.length < target`, chunks.js:995). Trees rejected by the clearing rect
  are **re-rolled elsewhere in the same chunk** until `target` is hit or attempts
  run out. So the cleared trees mostly **relocate to the back/sides** (which the
  grammar wants — "woods nestle the back/sides", §4) rather than disappear. **Net
  tris/chunk are roughly CONSERVED**, just redistributed off the front axis.
- Two real perf effects, both small and both *good*: (1) if the clearing is large
  enough that the loop **runs out of attempts** before hitting `target`, that
  chunk ends with fewer trees — a net tri *reduction* on heavily-cleared hub
  chunks; (2) fewer trees in front of the stage means fewer draws in the typical
  forward view frustum, helping the steady-state draw count where it's most
  visible.
- **The thing to watch:** the clearing rect competes with the road-dodge
  (`pointNearWorldgenRoad`, chunks.js:1001) and the building-guard for the same
  finite attempt budget (`target * 4`). On a hub-center chunk that ALSO has a
  road through it AND a dense clearing, the loop can spend most of its 320
  attempts getting rejected, finding few valid spots. That's not a stall (it's
  bounded) but it IS wasted CPU inside the 8 ms window. If the headless gate
  shows it, bump the attempt multiplier modestly (4 → 6) for chunks that own a
  clearing, rather than uncapping it.

**Verdict on the clearing's budget impact: net-neutral to slightly favorable on
tris, favorable on forward-view draws, with a bounded CPU cost in the scatter
loop.** No tri-budget concern. The trig-correctness of the rect (oriented by the
quantized `F` bearing) is a determinism issue, not a perf one — but if it's wrong
the clearing lands in the wrong place and the relocation math is moot.

## Front-axis trig cost (per-chunk vs memoized-per-hub)

**Compute `F` exactly once per hub, store it on the memoized plan.** The §3
scoring walks the road bearings, finds angular gaps, bisects, and ray-walks a few
candidates scoring against water (`nearestLake` / `queryPoint` along the
bisector). That's maybe a few dozen `queryPoint` calls for the 0-road N=16
sampling case (§3 step 4) — **trivial once per hub**, **catastrophic if it leaks
into the per-chunk or per-tree path**.

- `festivalPlan(heart)` is memoized on `(seed,epoch)` (festival.js:153-170) and
  capped at 4000 entries (festival.js:163). `F` and the clearing rects live on
  that cached plan object. A chunk that re-enumerates the same hub pays ZERO trig
  — it reads the cached `F`.
- **Determinism crossover (not my domain, but it gates the perf shape):** the §3
  bearing MUST be quantized before any threshold compare (CLAUDE.md footgun #4,
  R20). The clearing-rect `sin/cos` I want precomputed must be derived from the
  **quantized** bearing, or two engines compute different rects → different
  relocation → different tri distribution per engine. That's a determinism bug
  that happens to manifest as a perf-shape difference. Quantize `F` once, derive
  everything (yaw, rect orientation, precomputed `sin/cos`) from the quantized
  value.

No per-chunk trig if `F` is memoized correctly. The only per-chunk trig is the
oriented point-in-rect test, and that uses the rect's precomputed (cached)
`sin/cos`.

## Where + how to measure (the gates)

Per D-Q and the Group C lesson, **the browser backtick HUD is throttle-inflated
in a hidden/background tab and is NOT the gate for chunk-gen cost.** Measure
chunk-gen cost **headlessly in node**:

1. **Headless chunk-gen microbenchmark (the binding gate).** Drive
   `_generate(cx,cz)` (or the worldgen path `_generateWorldgen`, chunks.js:506)
   over a fixed seed across a corridor that crosses a major hub center, a camp
   village, and a lakeshore cell. Record `chunkGenStats.lastMs` /
   `chunkGenStats.slowest` (chunks.js:251-262; `SLOW_THRESHOLD_MS = 8`,
   chunks.js:262). **Gate: no single chunk > 8 ms** at the low-tier tree
   multiplier. Run it at `forestTreeDensityMul = 0.7` (low) AND `1.0` (mid/high)
   (perf.js:66/82/97), since low *reduces* tree count but low-tier devices are
   the squeeze on the budget, not the gen time.
2. **Worst-case targeted gate (R24).** Don't just average a corridor — force the
   stacked chunk: a hub center that is ALSO lakeshore (lake-ring trees) AND
   carries a camp village AND a drum circle. That's the R24 single-chunk spike.
   Assert it under 8 ms; if it isn't, that's where the sub-chunk defer queue
   earns its place.
3. **Draw/tri budget check in the FOREGROUND game** (not headless — draws/tris
   are GPU/renderer.info, accurate only with a real visible context). Boot
   `?worldgen=1` at a hub, open the backtick HUD, read draws/tris against the
   per-tier markers. **Low tier is the binding one: 80 draws / 150k tris.** A
   hub-center view (stage + courts + rows + relocated back-woods + camps) is the
   densest single frame in the game; if low blows 80 draws here, instancing the
   vendor-row tents / camp tents is the lever (performance.md audit step 5 —
   "same geometry repeats per cluster"), NOT thinning content.
4. **`?perf=low` and `?perf=mid` both** — never sign off on high alone
   (performance.md "Don't ship a perf change without checking low/mid").
5. **No new `castShadow = true`** on picnic tables, blankets, or any clearing-
   edge prop (CLAUDE.md #9, the 56-caster audit). Tables/blankets are small flat
   detail — they won't read as distinct shadows; default off.

## Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| ---- | ---- | -------- | ----------------- |
| Clearing test calls `festivalPlan`/`queryPoint` per-tree-attempt inside the 320-iteration scatter loop | SteadyState (chunk-gen)/Alloc | High | Naive A4 impl re-queries worldgen per candidate; doubles per-tree field cost; treed hub-center chunk breaches 8 ms on mid laptop |
| R24 stacking, made denser — hub-center chunk = stage+courts+rows+drum+camps+denser-dancefloor-grounds, worst case also lakeshore | Alloc (spawn stall) | High | Single chunk holds the hub center; 1-chunk/frame budget can't split it; >8 ms gen = visible stutter on boost into a hub |
| `closestBuilding` is O(N) linear (registry.js:146), called per-tree-attempt; registry grows with loaded chunks | SteadyState (chunk-gen) | Medium | Existing cost, but clearing + denser camps add registry entries → each of the 320 tree-attempt scans is over a bigger N |
| New `models/picnicTable.js` not pooled / `userData.shared` | Alloc + shader-recompile storm | Medium | Per-court fresh geo/mat; mis-disposed on chunk unload → recompile storm (~200 ms periodic stalls) |
| Low-tier DRAW budget at a hub-center view (relocated back-woods + courts + rows + camps in one frustum) | Draws | Medium | `?perf=low` hub view > 80 draws; densest single frame in the game |
| `F` bearing trig leaks into per-chunk path (not memoized on plan) | SteadyState (chunk-gen) | Medium | `F` recomputed per chunk that enumerates the hub instead of read from the `(seed,epoch)` cache |
| Scatter loop burns attempts on rejection (clearing + road + guard compete for `target*4`) | SteadyState (chunk-gen) | Low | Heavily-cleared hub chunk with a road; bounded wasted CPU, not a stall |
| Reflexive `castShadow = true` on tables/blankets/clearing-edge props | Draws (shadow pass) | Low | New props default shadows on; walks back the 115→56 caster audit |

## Budget Estimate

- **Draw delta**: Net **near-zero to slightly negative** in the forward view —
  trees relocate out of the dancefloor (fewer front-frustum draws), picnic tables
  add a handful of pooled draws per court. Closest tier after: **low (80 draws)**
  at a hub-center view is the one to verify; relocated back-woods + courts + rows
  + camps in one frame is the densest the game gets. Instancing tents is the lever
  if it breaches.
- **Triangle delta**: Net **conserved** — the clearing relocates trees within the
  same `target` count rather than deleting them; a heavily-cleared chunk may end
  *below* target (slight tri *reduction*). Picnic tables add modest tris (pooled).
  Closest tier after: **low (150k tris)** at a hub-center view; not expected to
  breach since tri count is conserved.
- **Cost type**: **Allocation stall** (the binding one — R24 stacked hub-center
  chunk vs the 8 ms R7 gate). Steady-state FPS is essentially unchanged by the
  arrangement rework; the only steady-state knob is fewer front-view tree draws
  (favorable).
- **Low/mid-tier verdict**: **Safe with mitigations.** Safe IF (a) the clearing
  test is rect-math against a precomputed plan list — no per-tree worldgen query;
  (b) `F`/rects are memoized on the `(seed,epoch)` plan; (c) picnic tables pool
  with `userData.shared`; (d) the R24 stacked-chunk case is gated headlessly at
  8 ms. **At risk** only if the dancefloor clearing is implemented with a
  per-candidate `festivalPlan`/`queryPoint` call, or if the per-vendor camps push
  the hub-center chunk over 8 ms — in which case defer the drum-circle + camp
  build within that chunk across frames (don't thin content).

### Verdict

- **Verdict**: **Proceed with mitigations**
- **Key Concern**: The dancefloor clearing must hand `scatterWorldgenTrees` a
  **precomputed, memoized list of oriented rects** tested with cheap point-in-rect
  math — it must NEVER call `festivalPlan()` or `queryPoint()` per-tree-attempt
  inside the 320-iteration scatter loop. That single implementation choice is the
  difference between a negligible cost and a treed hub-center chunk breaching the
  8 ms R7 gate on a mid-tier laptop. Secondary: R24 (the stacked hub-center chunk)
  is reopened and made denser by the per-vendor camps — gate it headlessly at
  worst case, with a deferred sub-chunk build queue as the escape hatch.
- **Recommendation**: The arrangement rework is steady-state-neutral and the
  clearing is tri-conserving (even slightly favorable in the forward view), so
  there's no budget reason to block. Proceed, but bind the work to: (1) memoize
  `F` + clearing rects on the plan; (2) rect-math tree test, no per-attempt
  worldgen query; (3) pool `picnicTable.js`; (4) a headless node gate that forces
  the R24 worst-case chunk under 8 ms at low + mid tree-mul, plus a foreground
  low-tier hub-view draw/tri read before declaring done. Hold the R3 80-tree cap
  and the shadow-caster budget throughout.
