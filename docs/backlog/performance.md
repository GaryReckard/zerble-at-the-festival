# Performance backlog and evidence

[Documentation index](../README.md) · [Roadmap](../../ROADMAP.md)

This record preserves dated investigations and design decisions. Shipped slices
are context, and unchecked or parked work is not a new implementation request.
Verify source anchors against the current code before resuming. Commands assume
the repository root.

## Performance

### Perf pass 4 — steady-state + stall reduction *(planned 2026-06-19; OpenSpec change `perf-pass-4`)*

Full plan, design, specs, and a Tier-3 debate deliberation live in
[openspec/changes/perf-pass-4](../../openspec/changes/perf-pass-4/README.md); the idea
bank + critic ranking that fed it is in [.claude/perf-brainstorm.md](../../.claude/perf-brainstorm.md).
Attacks two measured symptoms (137–343 ms shader-compile stalls on hub entry;
30–60 ms chunk-gen hitches) + a measurement gap. Sliced for delivery:

- **Slice 1 — SHIPPED 2026-06-19** (see CHANGELOG): **B0** true draw/tri measurement under post-processing + `progDelta`; **D3** crowd per-frame allocation pooling.
- **Slice 2 — F1 shipped; the rest was cut or deferred.** Dynamic bloom gating now resolves through one predicate over player settings, AdaptiveQuality, brightness, and Star Power. The capture found no material shadow-driven stall, so F2 amortized shadow maps were cut. World-material shader reveal and asynchronous prewarm remain deferred until a capture identifies the relevant world programs. The October 22 bloom/Trip first-use preparation now ships separately: the tagged iPhone stall aligned with bloom enabling, and the isolated pass reproduced its eight-program jump. See the [post-process follow-up](../../verification/performance/2026-10-22/render-stall/README.md).
- **Slice 3 — PAUSED 2026-07-15, with the deferral seam re-scoped by measurement.** The fixed one-chunk limit is now a tier-aware 3/4/5ms streaming wall, and `__dbg.chunkStages()` provides debug-only per-stage attribution. The collider audit pins nine of ten worldgen cluster builders to the synchronous structure phase (`camp_village` is the only wholly collider-free case). A fixed low-tier travel profile showed the old safe whole-stage queue would move only ~6–8ms while structural props + collidable-tree planning kept ~230ms synchronous; tree instanced-mesh materialization was only ~0.4ms, and vendor rows dominated prop time at ~57–71ms for three rows. If resumed, the remaining **C1-b** work must split a measured hot builder into synchronous collider planning plus deferred visuals, starting with vendor-row descriptor/build separation or a proven tree-planning cut, then cancel by chunk key and pass the byte-identical multi-chunk registry determinism gate. Two unhelpful tree micro-optimizations were measured and removed rather than shipped.
- **E1** "arriving at the festival" bloom curtain — gated on whether Slice 2 leaves a residual stall worth masking.
- **Draw-call reduction (the real steady-state lever, per the round-trip-1 capture).** B0 revealed draws = median ~3,750 / max 9,232 vs a 400 budget — draw count is the ceiling. **Slice 4 SHIPPED 2026-06-21 (see CHANGELOG):** forest-tree per-chunk instancing — trees were ~half the dense-hub draws (a `drawCensus` finding), now ~344 per-tree draws/chunk → ~5–6 `InstancedMesh`es. **Deliberation 002 separately found geometry-merge is only a ~2–4% cut** (food-court/camp-village are mostly already pooled/instanced; merge helps only the unique-geometry food-truck + sugar-shack). The 2026-07-15 real-GPU gate rejected those broad model merges because renderer draws increased on every tier, while retaining the independently proven Sugar Shack sign-shell and food-truck window cuts (21 draws). Fog-as-far-cull also shipped at a backdrop-safe 1040m, removing roughly 350 fog-hidden retained-lake draws in its 1.2km travel gate. Remaining attack on the residual overage: (1) **LOD / cross-cluster instancing of the non-tree repeated clusters** (the same tents/trucks repeated across hubs, prime candidates beyond ~60m); (2) **billboard-impostor far field** (perf-brainstorm E2/E4); (3) an **honest look at whether the 400-draw high-tier budget is realistic for v2 worldgen** once trees are instanced, or whether the budget should move. Follow-up if a dense-low tri capture pushes past ~110–120k: a detail-0 icosa LOD (20 tris vs 80) for the instanced crowns.
- **Tier-2 secondary (gated behind B0 numbers):** the cut-on-evaluation atmosphere fakes (billboard light shafts, faked lake reflections, adaptive sparkle) + crowd LOD.

### Far-field festival depth / semantic LOD *(SHIPPED, default-on; fidelity correction queued 2026-10-08)*

The first slice shipped on the `festival-horizon` change (2026-08-27), was
promoted to **on by default** on 2026-08-28 after Gary's real-device sign-off
(`?farField=0` remains the A/B control), and the coarse-forest-masses
follow-up plus the low-tier 520m radius extension and demand-measured cap
raise landed the same day (see CHANGELOG). Shipped behavior + budgets live in
ARCHITECTURE.md "Far-field horizon" and
`openspec/changes/festival-horizon/verification/gates-flag-on.md`. What
remains parked here:

* **Finish near/far identity before tuning the transition.** Astra's
  [initial far-field review](../../.codex/reviews/002-far-field-fidelity/review-summary.md)
  and [building follow-up](../../.codex/reviews/003-far-field-post-fixes/review-summary.md)
  identify building surfaces, tree/camp placement, vendor acceptance, handoff,
  and lighting mismatches. The building pass now shares stage, marquee, and
  vendor roof dimensions and colors, includes the closed marquee rear gable,
  stage decks and backdrops, and clears the main-stage beacon above its roof.
  Larger peak pools retain the sampled visible roofs even at player-cell
  corners within the existing triangle budgets. The fixed-camera viewer hides
  the whole far-field group in real-only mode and lake-owned content in
  proxy-only mode; proxy-only therefore cannot evaluate water fidelity.
  Remaining: match campsite placement and forest trees to authoritative
  near-world positions without changing worldgen RNG or live-registry
  exclusions, and apply the real vendor builder's water, road, and registry
  rejection rules to proxies. The real camp builder interleaves pitch placement
  with model RNG draws, and forest placement filters through the live registry;
  the reviews record the required equivalence checks. Then tune the ready-gated
  near/far overlap and lighting at Noon and Midnight. The first unlit-color
  correction now darkens pale canvas, forest masses, and road underlays across
  the day/night cycle; verify it on the phone and in moving handoffs before
  calling lighting parity done. The viewer's scene-lit Lambert option is
  comparison tooling; the game stays unlit until visual and device evidence
  supports a switch. Other pool overflows are still visible
  and require visual prioritization. Capture fixed-camera comparisons and a
  fresh GPU benchmark before calling the visual gate done.

* **Later refinements considered and parked:** baked multi-angle billboard
  atlases (asset-baking workflow + texture memory + alpha sorting), far-field
  crowds / NPC flipbook impostors, per-booth silhouettes, and any fog or
  camera-distance expansion. Lakes stay authoritative (they already stream
  farther than chunks) unless a measured visual gap proves they need a proxy.

This picked up perf-brainstorm **E2** (distant tent/stage skyline) and **E5**
(dithered LOD swap), reframed as a world-depth feature with a hard perf
ceiling rather than an automatic perf win.

- **Recalibrate the per-tier draw/tri HUD budgets for v2 worldgen.** *(flagged 2026-06-21)* The backtick panel's tri budgets (low 150k / mid 400k / high 1.2M) predate v2 and now cry wolf: a 2026-06-21 capture showed **626k tris on `?perf=low`** and **1.57M on `?perf=mid`** — both ~4× "over budget" — yet mid ran a smooth **54fps**, so triangles are NOT the bottleneck. The markers should be re-based from a few v2 captures so a real regression is legible instead of drowned in a permanent red. (Draws/tris are adaptive-independent, so HUD readings are trustworthy as-is; only fps is defended by AdaptiveQuality.) Budgets live in [perf.js](../../src/perf.js) / the HUD in [debug.js](../../src/debug.js).

- **Verify the first-use bloom/Trip fix on iPhone, then isolate any remaining render stall.** The October 22 [follow-up](../../verification/performance/2026-10-22/render-stall/README.md) found that bloom enabled in the same sample as the felt 1,053ms gap and reproduced exactly eight new programs in an isolated first bloom draw. The loader now prepares the eight bloom materials and Trip before enabling Start; real-game checks on all tiers confirm one retained program variant per effect material. Rerun the Low Sustained route through first dusk and the first Trip on the phone, checking `session.postprocessPreparation`, felt lag and render work. Desktop probe results establish avoided first-use work, not an on-device latency guarantee. Remaining world-material, shadow-transition and new-chunk stalls need separate attribution rather than generic scene prewarm.

- **Resolve Low Auto versus Sustained on a moving phone.** The October 22 [paired guided drives](../../verification/performance/2026-10-22/guided-quality-comparison.md) held Low tier and seed: Auto spent the drive at `pixel-50` with median 57 reported FPS and wall p95 38ms, while Sustained ran mostly at 1.09–1.25 DPR with median 58 FPS and wall p95 21ms. Gary perceived no consistent difference, but felt and tagged the one-second stall in Sustained. The routes diverged and a 2.7-second phone lock interrupted Sustained's early parked phase, so this is not a shipping gate for changing the p95 trigger. Retain normal Auto and the sustained-average/severe-hitch protection. A reverse-order comparable-route pair without a visibility interruption would test repeatability after the render stall is understood; Baseline remains the control. Desktop shadow-transition and first-Trip spikes and fancy-bubble draw cost remain independent follow-ups.

- **Astra audit follow-through, 2026-10-08.** The render-resolution mismatch,
  empty transmissive bubble pass, all-entry lake queries, shadow Off policy drift,
  and repeated road-neighbor enumeration have code fixes and regression checks.
  The measurements and remaining acceptance gates are in
  [.claude/rules/performance.md](../../.claude/rules/performance.md#2026-10-08-audit-current-work-order).
  The managers now share one admission deadline; a single synchronous chunk
  can still exceed it. The next structural task is to split a measured hot chunk builder while
  keeping collision registration synchronous and deterministic. Device captures
  should establish the residual stalls before changing hidden-tab/audio
  schedulers or adding another far-field cache.

### Build tooling and remaining performance opportunities

Gary approved Vite on October 29, 2026 to reduce agent bookkeeping and catch
module wiring failures before browser verification. The build migration and
GitHub Actions workflow are documented in [the toolchain guide](../toolchain.md).
This decision does not establish a device loading or FPS improvement; workers
and compression still need their own measured justification.

- **Web Workers, evidence-gated** — the 2026-10-08 module-worker probe imported
  pure worldgen code and produced byte-identical region data without a bundler.
  A worker remains conditional on measuring transfer, cancellation, and
  asynchronous commit costs while keeping collision truth synchronous. Worker
  code that imports browser-only or `three` modules may still need separate
  module resolution or a build step.
- **Texture / mesh compression** — KTX2/Basis + Draco/meshopt: smaller GPU upload, lower memory (helps the iOS ≤2048 cap + mobile), faster boot. Makes texture-atlasing worthwhile.


- **Crowd InstancedMesh churn.** When NPCs change state, their per-instance matrix flag has to flip. Worth profiling on low-end devices to see if writes per frame are an issue.
- **Forest tree count on low tier — confirm the multiplier on a real device.** The tier-gated thin-out shipped (2026-06-02): `PERF.forestTreeDensityMul` cuts the low-tier forest target to **0.7** (~30% fewer trees, the bigger crowns fill the gaps). What's still open is the original deferral — the 0.7 was picked from the estimate, not a real low-end-device feel-test. Drive a forest on an actual integrated-GPU phone and confirm 0.7 is the right trade (looser if it still chugs, tighter if the woods read sparse).
- **Geometry merging / instancing follow-ups.** P1 shipped 2026-06-16: vendor booths collapse static decor to two vertex-color meshes (−36% meshes on a dense hub). The 2026-07-15 real-GPU gate rejected broad food-truck + Sugar Shack model merges because renderer draws rose by 72/358/364 on low/mid/high and the merged lifecycle stopped advancing after court 3, so production remains unmerged. The independently proven Sugar Shack sign-shell and food-truck window cuts remain, while camp villages were deliberately skipped because their repeated props are already pooled/instanced and their animatable references make a blind merge high-risk. Remaining **P3** work is per-row instancing of shopkeeper NPCs + transparent jars and LOD on distant clusters, since a dense forward view is still ~3–4k meshes in frustum.
- **Material pooling in `buildPuppet`.** Most of this shipped: `foodTruck.js` has `_SHARED_MATS` + a color-keyed `matFor` cache, and `puppet.js`'s hot path `buildSimpleNPC` (every band member, kid, wook, handler) pools both materials and geometry. The one holdout is `buildPuppet` itself — the giant parade creature still allocates ~12 fresh `MeshStandardMaterial`s per build. Low frequency (puppets spawn rarely, not per-chunk), so the allocation cost is rarely paid; backport the `matFor` pattern only if a parade spawn ever shows a stall.
- **Variant-bucketed InstancedMesh for camp chairs.** 8 meshes per chair × multiple chairs per campsite. Use `setColorAt()` for the fabric color variation; instance legs/seat/back/arms across all chairs in a campsite. *Note:* this **fights** the "hittable physics props — knock the chairs over" gameplay idea above (a tumbling chair has to break out of the instanced batch). Pick one direction per prop before building either.
- **Texture mipmap audit.** Confirm `generateMipmaps = true` on the larger canvas textures so distant draws sample cheap LOD levels.
- **Light layers for the Sugar Shack work spots.** Currently every standard material in range pays the per-fragment SpotLight cost. Putting the lights on a layer that only the banner is on would cut that to ~3 affected meshes.

## June unresponsive-page diagnosis (historical)

The record below predates the October registry and bounded post-process
preparation changes. Its rejected unbounded scene prewarm is a different
proposal from preparing the known bloom/Trip passes. Current behavior is in
[ARCHITECTURE.md](../../ARCHITECTURE.md), and current phone acceptance is in the
[roadmap](../../ROADMAP.md#performance).

- **Game goes unresponsive during play — perf-fix plan (council-resolved).** *(diagnosed 2026-06-17)*
  Browser "page unresponsive" alerts, pinned by three Chrome traces + a 160 s
  perf-log to two root causes. Full evidence:
  **[.claude/perf-unresponsive-diagnosis.md](../../.claude/perf-unresponsive-diagnosis.md)**;
  Tier-3 debate council that resolved the fix plan:
  [.claude/deliberations/001-perf-unresponsive-fixes/results.md](../../.claude/deliberations/001-perf-unresponsive-fixes/results.md).
  **Slice 1A — SHIPPED 2026-06-17** (`84569fb`): `renderer.debug.checkShaderErrors
  = false` bare-flip, debug-gated — kills the synchronous `getProgramInfoLog`
  per-link stall that is ~88 % of every freeze. (See CHANGELOG.)
  **Slice 1B — SHIPPED 2026-06-17** (the corrected, LIVE-grid version): grid-
  accelerated `registry.closestBuilding` (was a full O(n) scan over all entries,
  ~21 chunk-gen call sites) — the real growing root-cause-2 grind. The naive
  council "drop-in" would have broken determinism (the grid is rebuilt once/frame
  and `add()` didn't maintain it, but `closestBuilding` runs *during* gen against
  same-pass buildings → a naive port returns a subset → overlapping buildings →
  different world), so the shipped fix makes the grid LIVE: incremental `add`/
  `remove` + a new `SpatialGrid.remove`, `_maxFp` superset pad on the query.
  Gated on a new node fuzz proof (`bin/test-registry-grid`: grid == linear scan
  over 36k randomized queries incl removals) + worldgen self-test parity + clean
  game boot. (The browser `layout-snapshot` self-diff remains a manual
  belt-and-suspenders confirmation — headless agent-browser can't load the
  snapshot page in Codespaces.) See CHANGELOG + the diagnosis doc.
  **Still open:**
  - ~~**The program-count *leak* (`prog` 54→691, monotonic).**~~ **RESOLVED
    2026-06-17.** Root-caused with the new `__dbg.dumpPrograms` finder: the climb
    is the opt-in `PERF.contextLights` culler toggling `light.visible`, which
    changes `NUM_*_LIGHTS` (baked into the program cache key) → a recompile per
    nearby-light tally, cached forever. Confirmed live with the opt-in feature on
    (13→220 `physical` programs). NOTE: stage beams + drum-circle fires register
    *unconditionally* (no `PERF.contextLights` gate), so the **shipped default
    churns too** under sustained driving — the earlier "default is clean" read was
    a teleport-tour sample and unreliable headless measurement, not trustworthy.
    Fixed for both paths: `contextLights.js` now uses a fixed 6+6 light pool
    (constant scene light count → zero recompiles); the default game carries the
    constant pool once a stage/drum is in range. It is **not** the color-keyed
    material pools (color is a uniform → shared program). See CHANGELOG.
  - **`forEachNear` steady-state remnant (2a/2b), measure-gated.** Only if Slice 1's
    re-capture still shows it hot: audit `_maxFp`/`_maxCol` query-radius inflation,
    then stagger per-NPC separation (deterministic `(idx+frame)%N`, split from the
    load-bearing hard-overlap push at `crowd.js:1010`).
  - **Parked:** the disposal "fix" (exonerated — dispose-safety honored everywhere)
    and `compileAsync` pre-warm (wrong tool for an unbounded keyspace).
  Verify off the perf-log recorder + a DevTools trace (not the draw/tri HUD —
  green and never the bottleneck), at `?perf=low` AND `?perf=high`.

## August far-field ideas (historical)

These earlier visual ideas need reconciliation with the later near/far
fidelity work above before implementation.

### Far-field horizon — follow-ups *(2026-08-31)*

The fidelity pass (see CHANGELOG) fixed the forest gate, the stage shapes and the
vendor-row density. Still parked:

- **Distance blur / depth of field.** Gary asked whether distant things could soften
  (2026-08-31). Costed but not built: three's `BokehPass` re-renders the whole scene
  with a depth override material, which doubles draw calls and is a non-starter at
  ~5,000 draws. The affordable shape is a custom pass reading a `depthTexture` off the
  existing render target plus a separable blur — **two extra full-screen passes**, near
  free on high, questionable on mid, wrong on low. If it ships it wants a `PERF.dof`
  tier gate and the same `pass.enabled = false` discipline the Trip pass already
  follows. Worth a high-tier-only prototype for a look before committing.
- **Handoff still snaps at the chunk ring, not by distance.** A proxy hides when its
  owner cell reports loaded, so on a fast boost into new territory the swap can land
  well inside the fog rather than out at the edge of it.
- ~~**Camp villages get no proxy at all.**~~ SHIPPED 2026-08-31 (see CHANGELOG) —
  villages expand to scattered tent peaks in the real ±CAMP_RADIUS square plus a
  campfire marker, reusing the `peak` pool so they cost no extra draw call. **Drum
  circles still have none**: `copyHeartRecords` promotes only stages, vendor rows and
  (now) villages, so a drum circle is invisible until its chunk builds. It's a plan
  descriptor already, so it's the same shape of change — a low ring of benches around
  a warm firepit marker would read well at distance.
