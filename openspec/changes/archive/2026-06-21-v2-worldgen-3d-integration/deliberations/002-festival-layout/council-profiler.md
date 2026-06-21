# Council — Profiler (Round 1, 002-festival-layout)

## Profiler's Position

The festival-layout redesign trades *spatial* random scatter for *structured*
clusters. From the runtime-cost lens, that trade is mostly **cost-neutral at
steady state** (the same prop kinds get built; they just cluster instead of
spreading) but it concentrates **allocation cost** — the thing that was already
the worst offender. A 12–20-site camp village and a truck ring already exist in
the legacy builders (`buildCampVillage` `chunks.js:1849`, `buildFoodCourtAt`
`chunks.js:1036`); the redesign re-anchors them but does not change their mesh
budget. So the new risk is not "this adds a lot of draws" — it's that the
redesign (a) adds a new per-chunk CPU layer (`festivalPlan` per heart) that the
draws/tris HUD cannot see, and (b) **stacks** villages + lakeshore rings +
forest scatter in the same regions, where R3 and R9 already warned the budgets
collide. The Group C lesson is load-bearing here: **measure headlessly in node**,
not in the browser HUD — a hidden-tab-throttled `performance.now()` inflates
per-chunk timings and would either hide a real 8 ms breach or invent a phantom
one.

### Priority Sequence

1. **Establish the headless measurement harness FIRST (before any cluster
   build code).** Group C proved the browser HUD's `performance.now()` is
   hidden-tab-throttle-inflated. Wrap `placeChunkProps` + `festivalPlan` in a
   node-runnable timer (the `chunkGenStats` shape already exists at
   `chunks.js:253`, `SLOW_THRESHOLD_MS = 8` at `chunks.js:264`). Without a
   trustworthy number, every later perf claim is a guess. This is D2.8's
   "re-measure headlessly vs the 8 ms gate" — pull it forward as the gate, not
   the closing step.
2. **Build + memoize `festivalPlan(heart)` (D2.1) and verify the memo actually
   fires.** The whole R7 story depends on the plan being computed *once per
   heart*, not once per chunk. A major district touches ~12×12 = up to ~169
   chunks (1000 m / 80 m, both axes); if the memo misses, that heart's plan is
   recomputed up to ~169× during a session. Add a memo-hit counter to the
   headless harness and assert hit-rate ≈ (chunks_in_district − 1)/chunks.
3. **Port the cluster catalog (D2.3) and camp village (D2.4) with the legacy
   counts UNCHANGED.** Do not re-tune counts in this change — the legacy numbers
   (3–5 trucks, 12–20 sites, 90–140 lake-ring trees) are the proven budget. Re-
   anchoring must not also re-balloon.
4. **Re-budget forests AFTER lakes + villages land (R3 + R9 together, defer to
   Group F).** The forest tree cap is the single lever; do not touch it until
   you can drive through a dense-forest + lakeshore-ring + village region and
   read `chunkGenStats` at `?perf=low`/`mid`. This is F1/F5 and must stay there.
5. **Only frame-split anchor / village builds IF the headless number shows a
   breach.** Do not pre-optimize (the perf rule: "Don't try to optimize before
   you've measured"). The escape hatch (split the village build across N frames)
   is real but adds complexity to the chunk lifecycle — earn it with a number.

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| ---- | ---- | -------- | ----------------- |
| **`festivalPlan` recomputed per chunk** if the (seed,epoch) memo misses or the map is bounded too small and evicts an in-view heart. A major district spans ~169 chunks; a miss turns one plan-build into up to ~169. | SteadyState (CPU, invisible to draws/tris HUD) | High | Memo miss during normal driving across a major district; surfaces only in `chunkGenStats`/node timing, never in the HUD. |
| **Heart-scan width vs missed-cluster trade (R7).** Each chunk must enumerate hearts whose road-courts (up to ~120 m out) land in it. `heartsInBounds` already pads ±1 HEART_CELL (440 m, `hearts.js:85-88`) — wide enough. The cost is calling `festivalPlan` for every padded heart, then filtering. | SteadyState (CPU) | Medium | Per-chunk `placeChunkProps` over a region with several nearby hearts; padded window returns ~9–25 hearts, each needing a (memoized) plan lookup + bounds filter. |
| **Camp-village + truck-ring allocation spike (R11).** 12–20 `buildCampsite` (each multi-mesh) + 3–5 trucks/shack in one `_generate`, plus the village `attempts < target*16` rejection loop (`chunks.js:1870`) and `registry.closestBuilding` per attempt. Built in the single 1-chunk/frame budget. | Allocation (frame stall on boost into the owning chunk) | Medium | The one chunk that owns a village/court center loads while the player is boosting (~28 m/s); rare (~1 heart per ≥440 m, ~1 village per district) but real. |
| **Forest × lakeshore-ring × village stacking (R3 + R9).** D-F drops the legacy `FOREST_TREE_TARGET_DENSITY = 0.022` hard cap (`forests.js:770`). `LAKE_RING_BAND = 70` + bigger worldgen lakes (`LAKE_CELL = 1050` vs old 320) boost `treeDensity` to 0.62 around every shore (`density.js:54`). A village now *prefers* lakeshore bands (D-M) — so the densest forest cells, the lake tree ring (90–140 trees, `lakes.js:492`), and a 12–20-site village can all land in the same neighborhood. | Both (alloc spike + steady-state draws/tris/shadow casters) | High | Driving at boost through a high-`treeDensity` cell that is also a lakeshore band that also hosts a village; HUD may read green while `chunkGenStats` blows past 8 ms (the F1/F5 gate). |
| **Reflexive `castShadow` on re-anchored clusters.** Clustering makes large structures (stages, trucks, shacks) appear in tighter groups — more casters in one frustum. The audit holds at 56 (CLAUDE.md #9); a re-anchor that copies legacy `castShadow=true` onto small detail (tent poles, chair parts, string-bulb posts) walks the count back. | Shadow (steady-state) | Medium | Several clustered structures in view at once at `?perf=mid`/`high` (shadows on); low tier is safe (shadows off). |
| **Sugar-shack pooled-material dispose** if a re-anchored shack drops its `userData.shared` tag. `SHACK_MATS`/`STRING_BULB_GEO`/`SUPPLY_CAN_GEO` are pooled (CLAUDE.md #6); the court now owns the *only* shacks (D-M), so a mis-tag storms shader recompiles on every court-chunk unload. | Allocation (recompile storm, ~200 ms periodic stalls) | Medium | A court chunk unloads (player drives ≥ UNLOAD_RADIUS away) after a shack was built with an untagged shared material. |

### Budget Estimate

- **Draw delta**: **≈ 0 net per loaded region.** Clustering relocates the same
  prop kinds (trucks, campsites, vendors, stages) the D scatter already placed;
  it does not add new structure types. The legacy counts are carried unchanged
  (D-M). The one place draws *rise locally* is the owning chunk of a village
  (12–20 campsites × ~several meshes each) or a court — but that chunk's draws
  were always going to exist somewhere; the change concentrates them. **Closest
  tier after: low (80 draws).** A village-owning chunk plus its neighbors in the
  3×3 low-tier load ring is the squeeze; this is exactly why R3's ~80-tree cap
  must hold — trees, not festival structures, are what put low over budget.
- **Triangle delta**: **≈ 0 net steady-state**, same reasoning. The lever is the
  forest tree count (R3/R9): each forest tree is ~5 meshes (`forests.js:771`),
  so an uncapped `density≈1.0` cell can scatter ≫80 trees → tris balloon. **Hold
  the 0.022 cap (or the count-equivalent clamp F1 specifies). Closest tier:
  low/mid (150k / 400k tris).**
- **Cost type**: **Both, but the *new* cost is CPU-allocation, not draws.**
  (1) Steady-state CPU: per-chunk `festivalPlan` enumeration (must stay memoized,
  invisible to the draws/tris/heap HUD — measure in node). (2) Allocation stall:
  village + court built in one `_generate`. Draws/tris are essentially inherited
  from the existing world, not added by this redesign.
- **Low/mid-tier verdict**: **Needs the headless gate + the R3 forest cap held.**
  The redesign itself is draw-neutral and **Safe** on draws/tris *provided* the
  forest cap survives Group F and the `festivalPlan` memo fires. Without the
  headless measurement (Group C lesson) the 8 ms R7 gate cannot be trusted, and
  without the F1 cap the lakeshore-ring + village + dense-forest stack (R9) is
  **At risk** on low/mid.

### Notes on the open questions (my domain)

- **Q4 (heart-scan width vs R7 8 ms gate):** Each chunk does NOT need a hand-
  tuned wide scan. `heartsInBounds(minX,minZ,maxX,maxZ)` already pads ±1
  HEART_CELL = ±440 m (`hearts.js:85-88`), which dwarfs the max POI reach
  (~120 m for a road-court per D-M). So the chunk's own AABB passed to
  `heartsInBounds` is sufficient to catch any cluster whose center is in it —
  the padding is the answer, no new widening constant required. The cost is NOT
  the scan width; it is calling `festivalPlan` for each of the ~9–25 hearts the
  padded window returns and filtering POIs to the chunk. Memoization makes each
  of those a map lookup after the first heart-build, so the per-chunk sampler
  stays cheap **iff the memo holds** (priority #2). The 8 ms gate is met by the
  memo, not by narrowing the scan.
- **Q3 (allocation spike + forest interaction):** The single-chunk village +
  court spike is real but bounded and rare (R11, ~1 per ≥440 m). Accept it as
  existing behavior; frame-split only on a measured breach. The *worse*
  interaction is R3+R9: the redesign's preference for lakeshore village bands
  (D-M) deliberately co-locates the three heaviest tree/structure sources. That
  must be re-budgeted *after* lakes land (F1/F5), driving through the stacked
  region at boost on `?perf=low`/`mid`, reading `chunkGenStats` — not the HUD.

### Verdict

- **Verdict**: **Proceed with mitigations.**
- **Key Concern**: The two costs the draws/tris/heap HUD cannot see, both
  inherited from the prior register and sharpened by this redesign: (1) the
  per-chunk `festivalPlan` CPU layer pushing `chunkGenStats` past the 8 ms R7
  gate if the (seed,epoch) memo misses across a ~169-chunk major district; and
  (2) the deliberate lakeshore-village co-location (D-M) stacking
  village + lake tree ring (90–140) + uncapped forest scatter (R3/R9) in one
  region. Both are invisible in the HUD and **must be measured headlessly in
  node** (Group C lesson), not in a throttled browser tab.
- **Recommendation**: Proceed, but (a) build the headless `chunkGenStats`-style
  measurement harness as the *first* step and treat >8 ms as the binding gate;
  (b) verify the `festivalPlan` memo hit-rate before trusting the per-chunk cost;
  (c) carry the legacy cluster counts unchanged — re-anchor, don't re-balloon;
  (d) keep the forest re-budget (R3/R9) in Group F, after lakes, with a
  drive-through `?perf=low`/`mid` check; (e) frame-split anchor/village builds
  ONLY on a measured breach, never pre-emptively; (f) hold the 56-caster shadow
  budget and re-confirm every re-anchored shack keeps `userData.shared`.
