# Deliberation Summary — Festival Layout Redesign (D2)

## Context

-   **Task**: Stress-test, *before building*, the redesign of the v2-worldgen
    festival **placement layer** from per-chunk random scatter (Group D's
    `10 random slots × per-role probability`) to **structured, feature-anchored
    clusters** (design.md "Festival Layout Redesign", D-K..D-Q; provisional tasks
    D2.1–D2.8). The mesh-build layer already shipped in Group D and boots clean;
    the redesign teaches the placement layer *where* to call those builders by
    introducing a new pure POI sub-layer (`src/worldgen/festival.js`), three
    additive worldgen exports, cluster ownership rules, and spawn-at-a-major-heart.
-   **Personas Consulted**: Architect, Adversary, Profiler, Anthropologist,
    Pragmatist + Mediator. (All five returned; none failed.)
-   **Mode**: **Synthesis** (no Round 2). The personas wrote in isolation and did
    NOT name tensions; surfacing and resolving them is the Mediator's job below.
-   **Date**: 2026-06-07.
-   **Verdicts in**: 5/5 **Proceed with mitigations** — zero Blocks. One
    *conditional* element: the Adversary's recommendation is "Proceed with
    mitigations" overall but it **blocks the cluster-build tasks (D2.3/D2.4)**
    until the determinism harness grows a POI-layer golden + window-invariance
    check. That conditional block is resolved as a binding apply-gate, not an
    overall Block (see Conflicts Resolved, row B).

---

## Synthesized Plan (Change Groups — foldable into tasks.md D2.1–D2.8)

The five priority sequences agree on the spine almost exactly: **additive exports
→ `festivalPlan` → per-chunk filter → spawn**. They diverge on *what must gate
that spine* (harness work) and *where the spine starts* (Pragmatist's spawn-first
slice vs Adversary's harness-first block). The resolution: the harness work the
Profiler, Adversary, and Anthropologist each independently demand is **not a
trailing D2.7/D2.8 task — it is Change Group 1, the foundation gate**, and it is
cheap enough (three small surfaces) that it does not delay the Pragmatist's
visible win. Spawn-first stays the critical path *for the build half*, gated
behind CG1.

### Change Group 1: Foundation + Harness Gates (do FIRST, before any content)

**Scope**: The three verification/determinism surfaces that every persona's plan
silently or explicitly depends on, plus the additive worldgen exports. None of
this places a mesh; all of it must be green before content flows. Folds into D2.2
+ the front half of D2.7, and **adds two new tasks (D2.0a, D2.0b)** the current
list is missing.

**Estimated Effort**: ~4–6 hrs.

**Tasks**:
1. **D2.0a (NEW) — POI-layer determinism harness, as a GATE not a closing step.**
   Extend `worldgen/selftest.js` so its golden covers the NEW surface
   (`festivalPlan`, `approachRoadsOf`, `nearestMajorHeart`, `shoreBand`), plus a
   **POI window-invariance check** (two overlapping windows must agree a cluster
   exists / does not exist). Record the golden on **both node and a browser
   engine** (the node `63c8dea2` ≠ browser `a527d31e` fork is already real). This
   is the Adversary's Key Concern and the binding gate that unblocks D2.3/D2.4.
   The existing `queryPoint` golden `63c8dea2` MUST stay 20/20 — but it is
   *additive-blind* to the new layer, so it proves nothing about POI determinism;
   the new golden is what does. (Adversary V-golden-blindness; Architect #1.)
2. **D2.0b (NEW) — `festival` POI-overlay layer in `map-sandbox.html`, FIRST.**
   The redesign's entire value is the *spatial relationship between clustered
   pieces*, and that is invisible in BOTH existing sandboxes today (`sandbox.html`
   draws one model; `map-sandbox.html` draws zero POI markers — only a `wouldHost`
   text inspector). Add a `festival` layer toggle that calls
   `festivalPlan`/`poisInBounds`/`campVillagesNear` and draws stage dots, court
   rings, vendor-row segments, drum-circle markers, and camp-village footprints in
   2D, with a scan-window-boundary toggle so window-invariance is eyeball-visible.
   This is "build the harness, then the feature." Add `festival.js` to the
   map-sandbox `wg` importmap array here. (Anthropologist Key Concern.)
3. **D2.0c (NEW) — headless `chunkGenStats` measurement harness.** The browser HUD
   `performance.now()` is hidden-tab-throttle-inflated (Group C lesson). Wrap
   `placeChunkProps` + `festivalPlan` in a node-runnable timer (the
   `chunkGenStats` shape exists at `chunks.js:253`, `SLOW_THRESHOLD_MS = 8` at
   `:264`) and add a **memo-hit counter**. Treat >8 ms as the binding R7 gate.
   (Profiler priority #1.)
4. **D2.2 — the three additive worldgen exports**, `approachRoadsOf` +
   `nearestMajorHeart` before `shoreBand` (which is optional / off the critical
   path). Pure functions, no `three`, headlessly unit-testable. `approachRoadsOf`
   is a *compose* of existing pure functions (`neighborsOf` + `arterial` +
   `heartProxy`) — assert it introduces **zero new rng draws** and reuses
   `SALT.roadPair` reads only. `nearestMajorHeart` must be a **bounded, fully
   deterministic** expanding-window scan (same window every call regardless of
   caller — see R17). The **primary-road pick must be deterministic + quantized**
   (sort by a stable integer key, not raw float bearing — see R20). Run the new
   D2.0a golden after this lands. (Architect #1, Pragmatist §1, Adversary step 1.)

### Change Group 2: The POI Decision Layer + Ownership Plumbing (the keystone)

**Scope**: `festival.js` as a pure, gated, bounded cache; the rng-regime contract;
the per-chunk filter. Folds into D2.1 + D2.5 + the determinism half of D2.7.

**Estimated Effort**: ~5–7 hrs.

**Tasks**:
1. **D2.1 — `festival.js` with `festivalPlan(heart)` memoized, gated on
   `(seed, epoch)`.** Mirror the `hearts.js:20` / `roads.js:182-189` cache pattern
   verbatim (gate string `seed + ':' + epoch`, `_cache.clear()` on gate flip,
   `size > limit` evict). Fresh `SALT.poiLayout = 0x4D41_0B` (+ `0x4D41_0C`
   jitter; both confirmed free — `constants.js:66` tops out at `0x4D41_0A`).
   **Purity assertion**: imports nothing from `three`/`models/*`; holds only
   `(seed,epoch)`-gated immutable plans — never a `Set` of "built" POIs, never a
   THREE ref, never window-relative state. `festivalPlan(heart)` takes ONLY the
   heart (no bounds, no querying-chunk cx/cz). Road-shared content uses
   `pairRng(H, nb, SALT.poiLayout)` so both endpoint hearts independently agree
   (the `arterialPolyline` trick); never `cellRng` on one endpoint for content on
   a shared street. **Each POI descriptor carries a `clusterSeed`** (already in the
   D-L schema) so the build half has a stable per-cluster rng source that does NOT
   depend on `ctx.rng` draw order (see R19). Quantize every bearing-derived
   coordinate before it becomes a stored POI coordinate or a threshold compare.
   Verify against the D2.0b overlay. (Architect #2, Pragmatist §2.)
2. **D2.1b (rng-regime contract, NEW sub-task) — pin ONE rng regime per cluster.**
   `festival.js` decides where/what/how-many from `cellRng`/`pairRng`/`clusterSeed`.
   The build half (`buildFoodCourtAt`, `buildCampVillage`, `buildStage`, etc.) may
   consume `ctx.rng` ONLY for cosmetic, **count-stable** jitter (scale, hair,
   color) — never for anything that changes how many `ctx.rng()` draws happen.
   Extend the fixed-order contract in `placement.js:13-15` to the build half, or
   the chunk desyncs the instant the descriptor list changes length. (Adversary
   step 3 / V-rng-desync — High.)
3. **D2.5 — rewire `placeChunkProps` to filter the memoized plan.** Replace the
   per-point anchor dice (`placement.js:118-142`) with "enumerate hearts within
   POI-reach → call memoized `festivalPlan` → keep POIs whose center is in this
   chunk." Keep the existing `claimed`/`tooClose`/`nudgeOffNoBuild` machinery for
   filler + within-cluster guards. **Ownership scan = a SEPARATE wider
   `heartsInBounds` enumeration sized to a named `MAX_POI_REACH` constant
   (court ≤120 m), distinct from the 80 m `queryRegion` `placeChunkProps` reads
   today** (`placement.js:117`, `chunks.js:510`). See the Architect-vs-Profiler
   resolution (Tension A) for why this is belt-and-suspenders rather than a
   contradiction. Clusters chunk-keyed to their OWNER and parented to the owner's
   `ctx.group` (exactly `buildCampVillage`, `chunks.js:1846`); `cookEntry.chunkKey`
   stamped to the OWNER (`buildFoodCourtAt:1052`, `buildVendorAt:997`). District
   scatter re-derives from worldgen math, never a registry lookup of a
   possibly-unloaded anchor (R2/D-C). (Architect Key Concern, Pragmatist §3.)

### Change Group 3: The Build Half + The Visible Win (spawn-first critical path)

**Scope**: Re-anchor the cluster builders (mostly re-calls), then ship
spawn-at-heart as the proof. Folds into D2.3 + D2.6, with D2.4 deferred to CG4.

**Estimated Effort**: ~4–6 hrs.

**Tasks**:
1. **D2.3 — re-anchor the cluster builders.** ~70% re-calls of existing functions
   with new `(x,z,yaw)` args. The five genuinely-new surgeries, each verified
   against its specific must-not-regress invariant: (a) the **food-court inter-truck
   overlap guard** (`chunks.js:1041` has none — ~10 new lines); (b) the double-row
   vendor layout (current `buildVendorAt` is single-row, `chunks.js:991`); (c)
   arch + string-lights on the primary road; (d) delete the 0.33 solo-shack branch
   in `buildVendorAt` (`chunks.js:992`) so sugar shacks exist ONLY in the court
   (kills the solo-shack bug); (e) attach-potty-to-*cluster* vs the legacy
   attach-to-strongest-chunk-attractor (`pickPottyAnchor`, `chunks.js:1489`).
   Treat as "five named edits + a dispatch table," NOT "re-call the builders" —
   each touches a D-P invariant (stages-face-out, attach-music-once,
   `userData.shared`, no-shove-parked-Zerble). Declare each new builder's return
   shape (`{group,...}` vs bare `Group` — the R2 footgun). **GATED behind CG1's
   D2.0a golden** per the Adversary block resolution. (Pragmatist §4, Architect #4.)
2. **D2.6 — spawn at nearest major heart. THE VISIBLE WIN — ship as Slice 1 as
   soon as D2.1 + D2.2 answer the query, even before villages/drum circles.**
   `nearestMajorHeart(0,0)` → relocate Zerble outside the arch facing the main
   stage; arch + stage + lights come free from that heart's plan; force extra
   intro jugs near spawn (reuse `_placeSpawnJugs`, `chunks.js:433`).
   **Spawn-clearance is a placement VETO** the owning chunk honors (don't place a
   large-collider POI within N m of spawn), NOT a post-hoc removal (removing a
   registered collider orphans its mesh + breaks `byChunk` accounting). The
   `nearestMajorHeart(0,0)` scan runs **inside `buildWorld`, never before
   `Sound.init()`** (iOS audio tripwire, R12-latent). Arch→stage spacing is a
   feel-tunable dialed in the D2.0b 2D overlay so arrival reads as *approaching*,
   not *already arrived*. Screenshot the arrival at noon AND midnight as an
   explicit before/after pair. (Pragmatist Slice 1 / §5, Anthropologist priority 3,
   Architect #5.)

### Change Group 4: Back-of-Festival + Polish

**Scope**: Camp villages, drum circle, filler trim, then the determinism sign-off
and full per-tier verification. Folds into D2.4 + the back half of D2.7 + D2.8.

**Estimated Effort**: ~4–6 hrs.

**Tasks**:
1. **D2.4 — camp villages re-anchored** to district/outskirts cells (keep the tuned
   packing engine: 12–20 sites, 50/35/15, 5.5 m spacing, 30 m envelope), drum
   circle in a treed off-road district cell, porta-banks attached to each cluster,
   filler-scatter trim. **`shoreBand` lakeshore/causeway *preference* is parked to a
   fast-follow** — villages clump correctly in district/outskirts without it (the
   legacy packing engine never needed shore-awareness). Causeway camps specifically
   parked (highest-novelty, lowest-leverage, most likely to surface a no-build-in-
   water regression). **One-line comment at the village placement site** pointing at
   the three-failed-framings history (`CHANGELOG.md:611-613`) so a future agent
   doesn't re-introduce the chunk-corner bug as an "optimization." (Pragmatist Slice
   2 + Deferred, Anthropologist mitigation 3.)
2. **D2.7 (back half) — determinism sign-off.** The quantize-before-compare audit
   names WHICH compares are quantized: **(1) the primary-road pick** in
   `approachRoadsOf` (stable integer sort key, not raw float bearing); **(2) the
   perpendicular-offset sign** for vendor-row / court placement off a road corridor;
   **(3) the `shoreBand` "within N m of shore" in-band test** (quantize the
   `hypot` intermediates or the band gate flips across a chunk seam). These three
   are the cross-engine trig fork (R8 widened) — see Tension E. POI window-invariance
   check confirmed green on the D2.0a harness. (Adversary V-trig-fork, Architect #4.)
3. **D2.8 — boot the REAL game** at the spawn heart + a major + a minor + a
   lakeshore region, noon + midnight, `?perf=low/mid/high`, zero console errors;
   confirm clusters READ as designed (no solo shacks, no random drum circles,
   villages clump, potties tuck beside clusters). Re-measure per-chunk cost
   **headlessly in node** (CG1's D2.0c harness) vs the 8 ms gate, **including the
   arrival-into-a-heart case on `?perf=low`**. Confirm `DEFAULT_WORLDGEN_V2` still
   defaults to LEGACY until this is green (R23). Frame-split the anchor/village
   build ONLY on a measured breach — never pre-emptively. (All personas; Pragmatist
   §-non-negotiable, Profiler priority 4–5.)

---

## Convergence Points

-   **The clustering RULES are sound; the thesis is correct.** All five endorse
    "port the tuned legacy rules, re-anchor off the chunk grid." The Anthropologist
    grounds it in the documented camp_village three-framings history
    (`CHANGELOG.md:611-613`) — the packing rule was always good; the chunk-corner
    anchor was the bug.
-   **`festivalPlan` is a per-chunk DATA sampler, NOT a heart lifecycle manager
    (passes D-A)** — *provided* it imports no `three`/`models`, holds only
    `(seed,epoch)`-gated immutable plans, and `chunks.js` retains build + chunk-key
    ownership + disposal. (Architect's structural read; nobody disputes it.)
-   **Additive exports keep the existing `queryPoint` golden `63c8dea2` green by
    construction** — `SALT 0x4D41_0B`/`0C` are genuinely free; no reorder needed.
    (Pragmatist confirmed on disk; Architect, Adversary concur.)
-   **The spine is `approachRoadsOf + nearestMajorHeart → festivalPlan →
    placeChunkProps filter → spawn-at-heart`.** All five sequences land on this;
    `shoreBand` is off the critical path for all of them.
-   **Boot the real game at a heart-CENTER chunk on every content commit** —
    sandbox-pass ≠ game-pass; the anchors are sandbox-invisible; the `{group,...}`
    vs `Group` return-shape footgun (R2) is live on the rarest path. Unanimous.
-   **Carry the tuned legacy counts UNCHANGED — re-anchor, don't re-balloon.**
    Re-tuning counts mid-redesign muddies the "did clustering work?" signal
    (one-variable rule). (Profiler + Pragmatist explicit; others implicit.)
-   **Measure perf headlessly in node, not the throttled browser HUD** (Group C
    lesson); the new CPU layer is invisible to the draws/tris/heap HUD.

---

## Tensions Surfaced + Resolved

### Tension A — heart-ownership scan: "named wider constant" vs "the ±440 m pad already covers it"

-   **Architect** (Key Concern): the widened ownership scan is under-specified at
    the code boundary. `placeChunkProps` reads `region.hearts`, which is the
    *narrow* 80 m `queryRegion` AABB result (`placement.js:117`, `chunks.js:510`,
    `heartsInBounds` pads only ±1 cell). A major district is 1000 m with road-courts
    100+ m out, so ownership needs a **SEPARATE wider `heartsInBounds` enumeration
    sized to a named `MAX_POI_REACH` constant**, distinct from the AABB used for
    roads/scatter. Conflating them under-scans (silent missing court) or over-scans
    (8 ms R7 breach).
-   **Profiler** (Q4 note): `heartsInBounds` **already pads ±1 HEART_CELL = ±440 m**
    (`hearts.js:85-88`), which **dwarfs** the max POI reach (~120 m for a road-court).
    So "the chunk's own AABB passed to `heartsInBounds` is sufficient … the padding
    is the answer, no new widening constant required." The cost is NOT the scan
    width — it's calling `festivalPlan` per padded heart; the memo makes that cheap.
-   **Resolution**: **These are not actually contradictory once you separate
    *width* from *plumbing* — adopt both halves.** They are reasoning about two
    different things:
    -   The **Profiler is right on the math**: `heartsInBounds`'s ±440 m pad is
        already wider than `MAX_POI_REACH` (~120 m), so the *window is not the
        problem* — no chunk that contains a cluster center will fail to enumerate
        the owning heart. The cost is the per-heart `festivalPlan` call, gated by
        the memo (CG1 D2.0c memo-hit counter must confirm the memo fires).
    -   The **Architect is right on the plumbing**: the danger is NOT the window
        width, it is that `placeChunkProps` reads the *pre-computed `region.hearts`*
        field, which was populated by the **narrow 80 m `queryRegion` AABB**, not by
        a `heartsInBounds` call with the chunk's bounds. If ownership silently reuses
        that narrow field, it under-scans regardless of how wide `heartsInBounds`
        *would* pad — because that pad never gets applied to the ownership path.
    -   **Synthesis**: ownership enumerates hearts via an **explicit
        `heartsInBounds(chunkAABB)` call** (which gives the ±440 m pad the Profiler
        relies on), NOT via the narrow pre-computed `region.hearts`. Name
        `MAX_POI_REACH` as a constant derived from the catalog (court ≤120 m) and
        **assert at build time that `MAX_POI_REACH ≤ HEART_CELL pad (440 m)`** — a
        one-line invariant that makes the Profiler's "padding is the answer" claim a
        *checked* fact rather than an assumption, and catches the day someone adds a
        cluster type that reaches past 440 m. The cost guard is the D2.0c memo-hit
        rate + the 8 ms headless gate, not a narrower window. (Folds into D2.5.)
        Owners: Architect (plumbing), Profiler (cost). Binding: R16.

### Tension B — Adversary's BLOCK on D2.3/D2.4 vs Pragmatist's "ship spawn-first, the builders exist"

-   **Adversary** (Key Concern): **Block the cluster-build tasks (D2.3/D2.4)** until
    the self-test grows a POI-layer golden + window-invariance check. The current
    golden hashes `queryPoint` tuples ONLY (`selftest.js:62`); D-P's "golden stays
    green" is *true and exactly the problem* — green proves nothing about
    `festivalPlan`/`approachRoadsOf`/`nearestMajorHeart` determinism. It is the R1
    false-confidence trap re-run one layer up.
-   **Pragmatist** (Critical Path): the expensive half is already done; D2.3 is
    ~70% re-calls. Ship **spawn-at-heart as Slice 1 fast** — it's the visible proof
    and it's cheap once D2.1+D2.2 land.
-   **Resolution**: **Both win; the block is a sequencing constraint, not a veto.**
    The Adversary's block is real and load-bearing — a non-deterministic festival
    layout means two players on the same seed see different worlds and the harness
    says "deterministic." But it does NOT conflict with spawn-first: the block is on
    *content tasks*, and the harness is **cheap** (extend `selftest.js`'s golden
    accumulation to the new functions — a closed, headless surface). So the harness
    becomes **Change Group 1 (D2.0a)**, lands *before* D2.1/D2.5 even produce a
    descriptor, and D2.3/D2.4 are explicitly gated behind it. The Pragmatist's
    spawn-first slice survives intact — it just inherits a green POI golden as a
    precondition, which costs hours, not days. **The block is upheld as a binding
    apply-gate (R18), re-sequenced so it doesn't delay the visible win.** This is
    the same shape as 001's R1 resolution (decide the source of truth FIRST, then
    proceed). Owner: Adversary. Binding: R18.

### Tension C — two rng streams colliding in one `_generate`

-   **Adversary** (step 3 / V-rng-desync, High): today the build half
    (`buildFoodCourtAt:1037`, `buildCampVillage:1854`, `buildStage:1897`) makes
    layout decisions by consuming `ctx.rng` (`mulberry32(chunkSeed)`) in a FIXED
    order. `festival.js` now decides where/what/how-many from `cellRng`. If the
    build half KEEPS pulling `ctx.rng` for those decisions → two sources for one
    layout (re-roll desync). If it STOPS but the number of `ctx.rng()` draws per
    chunk changes with descriptor-list length → every builder *after* that point
    shifts (tree scatter, a later cluster's jitter). **Pin ONE rng regime per
    cluster: `festival.js` owns layout; the build half may pull `ctx.rng` only for
    count-stable cosmetic jitter.**
-   **No persona contradicts this** — but it is a latent contradiction with the
    Pragmatist's "mostly re-calls" framing: a naive re-call that leaves the legacy
    `ctx.rng`-driven corner/count/slot picks in place is *exactly* the double-source
    desync. So it is a tension between the convenient framing and the determinism
    substrate.
-   **Resolution**: **Adopt the Adversary's contract verbatim, and make
    `clusterSeed` the enforcement mechanism.** The D-L descriptor schema already
    carries a `clusterSeed` per POI. Rule: the build half derives ALL layout
    randomness from `clusterSeed` (a stable per-cluster value computed in
    `festival.js`), and consumes `ctx.rng` ONLY for cosmetic count-stable jitter.
    This severs the build half's layout decisions from `ctx.rng` draw order
    entirely — the descriptor list can change length without shifting any
    downstream `ctx.rng` consumer, because the cluster's *internal* randomness no
    longer lives in `ctx.rng`. The fixed-order contract (`placement.js:13-15`)
    extends to the build half as: "build-half `ctx.rng` draws must be count-stable
    per chunk." Verified by the D2.0a golden (a descriptor-list-length change must
    not move the chunk's downstream tuple). Owner: Adversary. Binding: R19. Folds
    into D2.1 (clusterSeed in descriptor) + D2.1b (regime contract) + D2.3.

### Tension D — map-sandbox POI overlay FIRST vs the existing text-only `wouldHost` surface

-   **Anthropologist** (Key Concern): the redesign's value IS the spatial
    relationship between pieces, and it is **invisible in both sandboxes**.
    `map-sandbox.html` draws ZERO POI markers — only a `wouldHost` *text* inspector
    (`:323`, `:250-263`). Reading "would host: main stage · food-truck court" as
    text under your cursor is NOT the same as SEEING the court ring drawn where it
    lands. **Add a `festival` POI-overlay layer as the FIRST D2 task** ("build the
    harness, then the feature"); it is the single biggest gap in the plan.
-   **The plan's text** (tasks I.2): "`placement.js` is pure data (its surface =
    map-sandbox `wouldHost` inspector + the booted game)" — treats the text
    inspector as the verification surface.
-   **Resolution**: **The Anthropologist is right; the text inspector is
    insufficient for a *spatial* redesign.** This is directly downstream of the
    project's own doctrine ("build the harness, then the feature" — CLAUDE.md;
    `.claude/rules/sandbox-and-testing.md`: "extend the harness before bypassing
    it"). The redesign exists *because* Gary saw a spatial problem in the running
    game; verifying its fix through a per-point text readout would re-create the
    exact slow drive-and-hunt loop the doctrine condemns. The 2D overlay is also
    cheap — `festivalPlan` is pure data with a clean signature, *designed* to be
    renderable in 2D. **Add it as CG1 D2.0b, before `festival.js` is written
    against the running game**, with a scan-window-boundary toggle so
    window-invariance (Tension B's check) is eyeball-debuggable. A 3D
    `festival_heart` composite in `sandbox.html` is the Anthropologist's own
    "OPTIONAL, skip unless a vignette proves un-eyeballable in 2D" — declined for
    now (a 3D composite would re-implement the build half and risk drifting from
    the real `chunks.js` build, the `buildCampChair` sandbox-passes-game-fails
    class). Owner: Anthropologist. Binding: R21 (the overlay is a required harness,
    not optional polish).

### Tension E — the cross-engine trig fork (R8 widened): name WHICH compares get quantized

-   **Adversary** (V-trig-fork, High) + **Pragmatist** (§1) + **Architect** (#4):
    D-P says "quantize any trig result before a threshold compare" but the design
    does NOT yet say *which* compares. `approachRoadsOf` composes `arterial` →
    `arcAround` → `atan2`/`hypot` (`roads.js:103-118,163-172`); the `bearing` field
    is trig-derived. R8 already flags `Math.abs(ccw - π) < 0.05` (`roads.js:167`) as
    a JSC-vs-V8 *road-existence* flip. The browser golden `a527d31e` ≠ node
    `63c8dea2` is already real. An unquantized bearing selection = a per-engine
    festival layout (the entrance arch, food court, AND spawn orientation fork by
    engine).
-   **Resolution**: **Name the three compares explicitly in D2.7** (no persona
    disagrees; the design merely under-specifies). The quantize-before-compare audit
    MUST cover:
    1.  **The primary-road pick** in `approachRoadsOf` ("longest/first", D-M) — sort
        by a **stable integer key** (e.g. quantized length, then quantized bearing,
        then neighbor cell index as the final tiebreak), never a raw float bearing
        comparison. (Pragmatist's "over-invest in this one function.")
    2.  **The perpendicular-offset sign** for vendor-row / court placement off a road
        corridor — the sign of the offset determines which side of the street the
        cluster lands; a low-bit `atan2` flip puts it on the wrong side per engine.
    3.  **The `shoreBand` "within N m of shore" in-band test** — quantize the
        `hypot(dx,dz) < N` intermediate, or two adjacent chunks disagree on whether a
        point is in-band at the N-meter boundary and a lakeshore camp pops in/out
        across a chunk seam (same class as the R8 road-existence flip, for camps).
    The pre-existing R8 tie-break (`roads.js:167`) carries forward as-is (already
    flagged in 001). The new golden (D2.0a) records on **both node and a browser
    engine** precisely to catch this fork. Owners: Adversary, Pragmatist, Architect.
    Binding: R20.

### Tension F — drum-circle / dense-forest re-home: feel headline vs perf stacking vs park-it

-   **Anthropologist**: the lonely-drum-circle-in-the-woods is a README *headline*
    discovery moment; parking F.4 risks the between-hearts drive feeling like dead
    air — "a feel cost, not a free cut."
-   **Pragmatist**: park the dense-forest *nesting* (it depends on Group F's tree
    budget anyway); ship the drum circle in a *treed off-road district cell* (D-M)
    now — "reads as designed simply by being off-road."
-   **Profiler / Adversary**: BOTH the festival layer AND forest scatter consult
    `treeDensity`; a high-density cell could host a drum circle AND uncapped tree
    scatter (R3) AND, if lakeshore, the `LAKE_RING_BAND` boost (R9) — three systems
    on the worst-case single-chunk perf cell, which is *also* the cell most likely to
    be a destination.
-   **Resolution**: **Ship the off-road drum circle now (Pragmatist); park the
    dense-forest *nesting* refinement (Pragmatist + Profiler); record the feel cost
    as a tracked ROADMAP item, not a silent cut (Anthropologist); flag the triple-
    stack as a perf risk to re-budget in Group F (Profiler/Adversary).** The drum
    circle's "destination" feel is largely delivered by off-road placement; the
    *dense-forest nesting* is the part that (a) depends on Group F landing and (b)
    creates the R3+R9 triple-stack — so deferring it is both feel-acceptable and
    perf-prudent. The Anthropologist's objection is honored by **not parking it
    silently**: ROADMAP carries "drum-circle dense-forest nesting (feel headline —
    re-home with Group F tree budget)" so it isn't lost. Binding: none (a deferral,
    not a gate); tracked as R24 (perf stacking) for Group F.

---

## Conflicts Resolved (table)

| # | Conflict | Position A | Position B | Resolution | Rationale |
|---|----------|-----------|-----------|-----------|-----------|
| A | Heart-ownership scan width | Architect: separate wider scan sized to a named `MAX_POI_REACH` constant | Profiler: `heartsInBounds` already pads ±440 m; width is a non-problem, cost is the memo | **Both** — enumerate via an explicit `heartsInBounds(chunkAABB)` call (gets the ±440 pad), name `MAX_POI_REACH`, assert `MAX_POI_REACH ≤ 440 m`. Width is fine; the plumbing (not reusing narrow `region.hearts`) is the fix. | The two reason about different things: width (Profiler, correct) vs which field carries the scan (Architect, correct). Tripwire: determinism/correctness — under-scan silently drops a cluster. |
| B | Block D2.3/D2.4 vs ship spawn-first | Adversary: BLOCK cluster-build until POI golden + window-invariance land | Pragmatist: ship spawn-first, builders exist, harness is a closing task | **Block upheld as a binding gate, re-sequenced** — harness becomes CG1 (cheap, headless); spawn-first slice inherits a green POI golden as a precondition. | Safety/correctness trumps speed (resolution hierarchy #1). But the block costs hours not days, so it doesn't sacrifice the visible win — both win. Mirrors 001's R1 "decide first, then proceed." |
| C | rng streams colliding in one `_generate` | Adversary: pin ONE regime — `festival.js` owns layout, build half cosmetic-only | (latent) Pragmatist "mostly re-calls" leaves legacy `ctx.rng` layout picks in place | **Adopt the contract; enforce via `clusterSeed`.** Build half derives layout randomness from the descriptor's `clusterSeed`, `ctx.rng` for count-stable cosmetic jitter only. | Determinism is load-bearing (tripwire #4). A naive re-call IS the double-source desync; `clusterSeed` severs layout randomness from `ctx.rng` draw order. |
| D | map-sandbox POI overlay vs text `wouldHost` | Anthropologist: add a 2D POI-overlay layer FIRST | Plan text: `wouldHost` text inspector is the pure-data verification surface | **Add the 2D overlay as CG1 D2.0b** (required harness); text inspector insufficient for a spatial redesign. | "Build the harness, then the feature" (CLAUDE.md). The redesign is *spatial*; a text readout re-creates the slow drive-and-hunt loop the doctrine kills. Cheap — `festivalPlan` is pure data. |
| E | Which trig compares get quantized | Adversary/Pragmatist/Architect: design says "quantize" but names no compares | — (under-specification, not opposition) | **Name three**: primary-road pick (stable integer sort key), perpendicular-offset sign, `shoreBand` in-band test. Golden on node + browser. | Cross-engine fork is real (`63c8dea2` ≠ `a527d31e`); unquantized bearing = per-engine festival + spawn orientation. Tripwire #4. |
| F | Drum-circle dense-forest re-home | Anthropologist: feel headline, parking it is a cost | Pragmatist: park nesting, ship off-road now; Profiler/Adversary: triple-stack perf risk | **Ship off-road now; park nesting to Group F (perf + dependency); track the feel cost on ROADMAP, not a silent cut.** | Off-road delivers most of the "destination" feel; nesting depends on Group F and creates the R3+R9+drum triple-stack. Honor the feel objection by tracking it. |

---

## Risk Register (continues 001's R1–R15; new risks R16+)

Severity-ranked within the new set. **BINDING** rows are apply-gates: the task
does not pass until the mitigation is demonstrably in place.

| # | Risk | Severity | Mitigation | Owner | Gate? |
|---|------|----------|-----------|-------|-------|
| R16 | **Ownership under-scan / over-scan** — `placeChunkProps` reusing the narrow 80 m `region.hearts` field (not an explicit `heartsInBounds(chunkAABB)` call) silently drops a cluster whose center is in this chunk (green console, hole in the festival); an over-wide hand-tuned scan blows the 8 ms R7 gate. | **High** | Enumerate ownership via explicit `heartsInBounds(chunkAABB)` (±440 m pad ≫ reach); name `MAX_POI_REACH` (court ≤120 m); assert `MAX_POI_REACH ≤ 440 m`; cost-guard via D2.0c memo-hit rate + 8 ms headless gate. (D2.5) | Architect (Key Concern), Profiler (Q4) | **BINDING** |
| R17 | **`nearestMajorHeart` window-truncation on a 4%-rare target** — majors are ~4% (`constants.js:14`), nearest-to-origin ~1100 m+ out; an expanding-window scan can spin in a major-sparse region or, if not deterministic, resolve `nearestMajorHeart(0,0)` to a different heart at spawn than a later query → Zerble spawns pointing at nothing. The existing `heartNeighborhoodCells` window is NOT sized to guarantee a major. | **High** | Bounded expanding-window scan with a hard cap; **same window every call regardless of caller** (deterministic); headless unit test that spawn-query == later-query for the same point; documented as the re-opened "window truncation CRITICAL" class (`constants.js:49-52`). (D2.2) | Adversary (V-window) | **BINDING** |
| R18 | **POI-layer golden blindness (the R1 trap, one layer up)** — the self-test golden hashes `queryPoint` tuples only (`selftest.js:62`); "golden `63c8dea2` stays green" is guaranteed AND meaningless for proving `festivalPlan`/`approachRoadsOf`/`nearestMajorHeart`/`shoreBand` determinism. Two players, same seed, different festivals; harness says "deterministic." | **High** | Extend the golden to cover the new functions + a window-invariance check, recorded on **both node and a browser engine**; **block D2.3/D2.4 until green**. (D2.0a) | Adversary (Key Concern) | **BINDING** |
| R19 | **Build-half rng-stream desync** — build half keeps pulling `ctx.rng` for layout (double source → re-roll desync), or stops but its `ctx.rng` draw count changes with descriptor-list length → every downstream `ctx.rng` consumer (tree scatter, later cluster jitter) shifts. | **High** | Pin one regime: build half derives layout randomness from the descriptor's `clusterSeed`; `ctx.rng` only for count-stable cosmetic jitter; extend the fixed-order contract (`placement.js:13-15`) to the build half; golden catches a length-change moving the downstream tuple. (D2.1/D2.1b/D2.3) | Adversary (V-rng) | **BINDING** |
| R20 | **Cross-engine trig fork in placement-AND-comparison (R8 widened)** — unquantized `bearing`-derived compares pick a different primary road / offset sign / in-band result on Safari vs Chrome → per-engine entrance arch, food court, spawn orientation, lakeshore camp. `63c8dea2` (node) ≠ `a527d31e` (browser) is already real. | **High** | Quantize the THREE named compares: primary-road pick (stable integer sort key), perpendicular-offset sign, `shoreBand` in-band test; golden recorded on node + browser. (D2.7) | Adversary (V-trig), Pragmatist (§1), Architect (#4) | **BINDING** |
| R21 | **Festival layout invisible in both sandboxes** — `sandbox.html` draws one model, `map-sandbox.html` draws zero POI markers (text `wouldHost` only); the next agent tuning a court radius is forced into the slow drive-and-hunt loop the doctrine condemns; window-invariance bugs are asserted-not-seen. | **Medium** | Add a `festival` POI-overlay layer to `map-sandbox.html` FIRST (CG1), with a scan-window-boundary toggle; add `festival.js` to the map-sandbox `wg` importmap array. (D2.0b) | Anthropologist (Key Concern) | **BINDING** (harness-first) |
| R22 | **Heart-center anchor chunk crash (R2 worsened)** — a `core×major` center chunk builds stage + truck-ring (which can spawn a sugar shack w/ `userData.cookEntry`) + arch + lights + bubble vendor in ONE `_generate`; 8 distinct return-shape contracts flow through `buildWorldgenKind` (`chunks.js:957-969`), each a `{group,...}`-vs-`Group` footgun on the rarest, sandbox-invisible path. One `TypeError` hangs the title card. | **High** | Declare each new builder's return shape; defensive extraction at the call site; **boot the real game at a known major-heart center via `__dbg.teleport` + `preview_console_logs` on every content commit** (not just at the end). (D2.3/D2.8) | Adversary (V-crash), Pragmatist (§4), Architect (#6) | **BINDING** |
| R23 | **`USE_WORLDGEN_V2` default-ON regression exposure** — `chunks.js:416` comment says "default ON" while task I.0 says legacy ships by default until verified; a live contradiction. If v2 is the default mid-redesign, every WIP commit ships the broken layout to the live GitHub Pages deploy (watched by real players). | **Medium** | Verify `DEFAULT_WORLDGEN_V2` demonstrably defaults to LEGACY until D2.8 is green at low/mid/high; resolve the code-comment vs task-gate contradiction before the first content commit. (D2.8 gate) | Adversary (V-flag) | **BINDING** |
| R24 | **Forest × lakeshore-ring × village × drum-circle stacking (R3+R9 collision)** — the redesign's preference for lakeshore village bands (D-M) deliberately co-locates the heaviest tree/structure sources; a high-`treeDensity` lakeshore cell can host a village + lake tree ring (90–140) + uncapped forest scatter (R3) + a drum circle — the worst-case single-chunk spike, also the likeliest destination cell. | **High** | Carry legacy counts unchanged (re-anchor, don't re-balloon); re-budget forests AFTER lakes (Group F, F1/F5) with a drive-through `?perf=low/mid` headless `chunkGenStats` gate; hold the ~80-tree cap; ship drum circle off-road but park dense-forest nesting to Group F. | Profiler (Key Concern), Adversary (V-stack) | (re-budget in Group F) |
| R25 | **`festivalPlan` memo miss across a ~169-chunk major district** — a major district spans ~169 chunks (1000/80, both axes); if the memo misses or the bounded map evicts an in-view heart, one plan-build becomes up to ~169, invisible to the draws/tris HUD, surfaces only in `chunkGenStats`. | **High** | Mirror `hearts.js`/`roads.js` gated-bounded cache exactly; add a memo-hit counter to the D2.0c headless harness; assert hit-rate ≈ (chunks_in_district−1)/chunks; size the map so an in-view heart never evicts. (D2.0c/D2.1) | Profiler (Key Concern) | **BINDING** (memo-hit assertion) |
| R26 | **Spawn cluster shoving the parked player (invariant g, untested geometry)** — D-O forces a guaranteed 22-NPC audience + intro jugs at the relocated spawn; player spawns parked (`zerble.speed===0` → `isParked`) facing the stage; the `806a689` no-shove fix was tuned for mid-game parking, not a boot-time forced crowd + stage attractor at the same point. Risk: a wall of NPCs at the worst first impression, or scatter fighting the attractor forever. | **Medium** | Verify the boot-time forced-crowd + parked-player + stage-attractor interaction explicitly in D2.8 (the arrival case); tune audience scatter vs stage attractor so the arrival reads clean; screenshot noon + midnight. | Adversary (V-shove), Anthropologist (arrival) | (verify in D2.8) |
| R27 | **Spawn-clearance as post-hoc removal orphans a collider** — removing a registered collider after the fact breaks the `byChunk` sweep accounting and orphans its mesh; clearance must be a placement VETO the owning chunk honors, not a deletion. | **Medium** | Implement clearance as "don't place a large-collider POI within N m of spawn" (a `festivalPlan` filter or `placeChunkProps` reject), never "delete it after." (D2.6) | Architect (#5) | **BINDING** |
| R28 | **`festival.js` drifts into a lifecycle manager (D-A violation by the back door)** — if `festival.js` ever holds a `Set` of "built" POIs, a THREE ref, or window-relative mutable state, it stops being a pure DATA sampler and becomes the `HeartManager` D-A explicitly rejected, breaking module purity (`placement.js:4`). | **Medium** | Assert in D2.1: `festival.js` imports nothing from `three`/`models/*`, holds only `(seed,epoch)`-gated immutable plans, is re-runnable headlessly in node (the determinism harness proves this). | Architect (#1/structural) | **BINDING** |
| R29 | **Sugar-shack pooled-material dispose on court-chunk unload** — the court now owns the ONLY shacks (D-M); a re-anchored shack that drops its `userData.shared` tag storms shader recompiles (~200 ms periodic stalls) on every court-chunk unload (`SHACK_MATS`/`STRING_BULB_GEO`/`SUPPLY_CAN_GEO`, footgun #6). | **Medium** | Re-confirm every re-anchored shack keeps `userData.shared`; the chunk/lake dispose walk skips tagged resources; no new untagged module-scope pooled resource. (D2.3) | Profiler (§risk table) | (verify in D2.3) |
| R30 | **`shoreBand` quantize gap (camp in/out-of-band flip)** — `shoreBand`'s "within N m of shore" test on un-quantized `hypot` intermediates makes two adjacent chunks disagree at the N-meter boundary → a lakeshore village's preferred-placement gate flips across a chunk seam. (Subsumed into R20's third named compare; tracked separately because `shoreBand` is parked to a fast-follow.) | **Low** | Quantize the in-band test when `shoreBand` lands (it's off the critical path — D2.4 preference is parked); covered by R20's third compare. | Adversary (V-shore) | (when `shoreBand` ships) |
| R31 | **iOS audio async-hop via spawn relocation (R12 latent, re-exposed)** — D-O adds `nearestMajorHeart(0,0)` (an expanding-window scan, possibly cold-cache-expensive) to the boot path; if it lands between the title tap and `Sound.init()`, iOS ships silent. | **Low (latent)** | Run `nearestMajorHeart(0,0)` inside `buildWorld`, NEVER before `Sound.init()`; no `await`/`setTimeout`/cache-warm before the synchronous gesture; verify on a real mobile browser once. (D2.6) | Adversary (V-iOS), Pragmatist | (verify once on mobile) |

---

## Verdicts Summary

| Persona | Key Concern | Verdict |
|---------|-------------|---------|
| **Architect** | The widened heart-ownership scan (D-N) is under-specified at the code boundary — it must be a SEPARATE wider `heartsInBounds` enumeration sized to a named `MAX_POI_REACH` constant, distinct from the narrow 80 m `queryRegion`/`region.hearts` `placeChunkProps` reads today. Conflating them silently drops clusters or busts the 8 ms gate. | Proceed with mitigations |
| **Adversary** | The determinism harness is structurally blind to the entire new POI layer — its golden only hashes `queryPoint` tuples, which the redesign deliberately doesn't touch. "Golden `63c8dea2` stays green" is guaranteed AND meaningless for the festival layout. **Block D2.3/D2.4** until the self-test grows a POI-layer golden + window-invariance check, recorded on node AND a browser engine. | Proceed with mitigations (conditional block on D2.3/D2.4 → upheld as binding gate R18) |
| **Profiler** | Two costs the draws/tris/heap HUD cannot see: (1) the per-chunk `festivalPlan` CPU layer pushing `chunkGenStats` past the 8 ms R7 gate if the (seed,epoch) memo misses across a ~169-chunk major district; (2) the deliberate lakeshore-village co-location stacking village + lake tree ring + uncapped forest scatter (R3/R9). Both invisible in the HUD — measure headlessly in node. | Proceed with mitigations |
| **Anthropologist** | The redesign's entire value is the spatial relationship between clustered pieces, and that is invisible in both sandboxes (`sandbox.html` = one model; `map-sandbox.html` = no POI markers, text only). Without a 2D festival-plan overlay, the next agent is forced into the slow drive-and-hunt loop the doctrine kills. **Build that overlay FIRST.** | Proceed with mitigations |
| **Pragmatist** | `approachRoadsOf` + the D2.5 widened-heart-scan radius are the two load-bearing new pieces and both are undersized in the task list relative to their leverage (one unblocks four cluster types; the other gates both correctness and the 8 ms budget). Get the primary-road pick deterministic+quantized and scan radius = max-POI-reach (not district-radius), each headlessly verified, before the rest leans on them. | Proceed with mitigations |

---

## Final Recommendation

**Proceed with mitigations.** The thesis is correct and unanimously endorsed —
port the tuned legacy clustering rules, re-anchor off the chunk grid; the
mesh-build layer already shipped in Group D and was built correctly, so the
genuinely-new work is a small, testable pure-data decision layer plus three
additive worldgen queries. But the redesign opens **five new High-severity seams**
(R16 ownership-scan, R17 major-window-truncation, R18 POI-golden blindness, R19
build-half rng desync, R20/R22 cross-engine trig fork + anchor-chunk crash) — every
one mitigable *in design before building*. Sequence the work so **Change Group 1
(the POI-golden harness, the map-sandbox overlay, the headless cost harness, and
the additive exports) lands and goes green FIRST** — this upholds the Adversary's
block as a binding gate without sacrificing the Pragmatist's spawn-first visible
win, because the harness is hours of headless work, not days. Then run the spine:
`festivalPlan` + ownership filter → re-anchor builders → **spawn-at-heart (the
visible proof)** → back-of-festival → determinism sign-off + per-tier boot. Treat
the eleven **BINDING** rows of the Risk Register as apply-gates. Park `shoreBand`
preference, causeway camps, count-tuning, drum-circle dense-forest nesting, and the
cross-frame build-splitter to fast-follows — none block "reads as designed." Do NOT
flip `DEFAULT_WORLDGEN_V2` to true until D2.8 is green at low/mid/high — the live
deploy is watched by real players.

## Next Step

Fold these Change Groups back into `tasks.md` D2: **add D2.0a (POI-layer golden +
window-invariance, the binding block-release), D2.0b (map-sandbox `festival`
overlay, harness-first), and D2.0c (headless `chunkGenStats` + memo-hit harness) as
the new foundation tasks before D2.1**; amend D2.5 with the explicit
`heartsInBounds(chunkAABB)` + `MAX_POI_REACH ≤ 440 m` assertion; amend D2.1 with the
`clusterSeed`-drives-build-layout rng-regime contract and the `festival.js` purity
assertion; amend D2.7 to name the three quantized compares; amend D2.6 with the
spawn-clearance-as-veto + `nearestMajorHeart`-inside-`buildWorld` rules. Then open
`/opsx:apply` on the re-sequenced D2 with the eleven BINDING risk rows as gates, and
update `session-log.md` Key Decisions with the rng-regime + harness-first +
ownership-plumbing resolutions.
