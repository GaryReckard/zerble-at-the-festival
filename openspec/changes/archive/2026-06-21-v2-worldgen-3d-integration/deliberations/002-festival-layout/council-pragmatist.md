## Pragmatist's Position

> Domain: force multipliers, critical path, ship-now vs park. Grounded in the
> design (`design.md` D-K..D-Q), the provisional `tasks.md` D2.1–D2.8 + E–I,
> and the actual Group D code already on disk.

### What's already built (the reuse reality)

The single most important fact for sequencing: **the expensive half of D2 is
already done.** I verified the Group D builders on disk:

- `buildStage(ctx, x, z, isMain, yaw)` — yaw-aware, `chunks.js:1892`
- `buildFoodCourtAt(ctx, x, z)` — truck ring, sugar-shack slot, lake-skip,
  `chunks.js:1036`
- `buildVendorAt(ctx, x, z, yaw)` — shack-or-bubble-vendor, cook-entry chunkKey,
  `chunks.js:991`
- `buildPottyBankAt(ctx, x, z, yaw)` — row-clear guard, `chunks.js:1028`
- `buildDrumCircleAt(ctx, x, z)` — fire+ring+djembe+light+music, `chunks.js:1613`
- `buildFoodTruckAt`, `placeSingleCampsite` — `chunks.js:973`, dispatched from
  `buildWorldgenKind` (`chunks.js:957`)
- `placeChunkProps(cx, cz, chunkSize, region)` already exists and already does
  the anchor-then-scatter loop, `nudgeOffNoBuild`, `claimed`/`tooClose`
  de-overlap, `roadFacingYaw`, `queryPoint`-driven `noBuild` rejection —
  `placement.js:104`.

So the meshes render, register colliders/attractors with correct `chunkKey`,
face yaw, and skip water **today**. They were built right (R2 return-shape
extraction is documented at `chunks.js:954`). **D2.3's "cluster catalog in
chunks.js build half" is ~70% a re-call of existing functions with new
(x,z,yaw) arguments, not new mesh code.** The genuinely-new mesh work in D2.3
is small and bounded: the food-court overlap guard, the vendor-row double-row
layout, the arch+string-lights-on-road placement. I confirmed `buildFoodCourtAt`
at `chunks.js:1041` has **no inter-truck arc/overlap check** — exactly as D-M
flags — so that guard is real new code, but it's ~10 lines inside an existing
function.

**The new work that carries the redesign is the DECISION layer, not the build
layer:** `festival.js` (D2.1) + the three additive worldgen exports (D2.2). That
is where the "reads as designed" win actually comes from. The builders are a
solved problem; the redesign is teaching the placement layer *where* to call
them.

I also confirmed the design's free-salt claim: `SALT` in
`constants.js:66` tops out at `placement: 0x4D41_0A`, so `0x4D41_0B`/`0x4D41_0C`
are genuinely free. No reorder needed — D2.1's salt choice is safe.

### Critical Path

The longest dependency chain to a festival that **reads as designed** is:

```
D2.2 approachRoadsOf(heart)   ─┐
D2.2 nearestMajorHeart(0,0)   ─┼─→ D2.1 festivalPlan(heart)  ─→ D2.5 placeChunkProps
D2.2 shoreBand (OPTIONAL)     ─┘        (memoized POI list)       filters plan→chunk
                                                                       │
                                                                       ↓
                                          D2.3 re-anchor builders (mostly re-call)
                                                                       │
                                                                       ↓
                                          D2.6 spawn-at-heart  ──→ THE VISIBLE WIN
```

Two of those three D2.2 exports are on the critical path; `shoreBand` is NOT —
it only feeds the *preference* for lakeshore camp villages (D2.4), and camp
villages place fine without it (district/outskirts cells). `approachRoadsOf` is
the true force multiplier: it unblocks the arch, food court, vendor row, AND
bubble vendor placement — four of the seven cluster types line a road. Build it
first and well.

`festivalPlan` (D2.1) is the keystone. Until it exists, nothing clusters.
`placeChunkProps` already exists (`placement.js:104`) — D2.5 is a *rewrite of
its anchor loop* to filter a memoized plan instead of rolling per-point dice,
not a from-scratch module. That's a meaningful de-risk: the consumption site
(`chunks.js:944`) and the `region.hearts` plumbing (`chunks.js:424`) are already
wired.

The **spawn-at-heart moment (D2.6) is the entire visible deliverable.** Gary's
flag was "confetti of single props" — the proof that the redesign worked is:
boot the game, and you arrive *outside an arch, facing a main stage, with a food
court and vendor row down the street.* Everything before D2.6 is invisible
infrastructure. D2.6 is cheap once D2.1+D2.2 land (it's a game-side query in
`main.js`/`world.js` per D-O, reusing the existing `_placeSpawnJugs`,
`chunks.js:433`) — but it must not be parked, because **without it the win is
unverifiable and unfelt.** It is the smallest, last, highest-leverage step.

### Priority Sequence

1. **D2.2 — the three additive worldgen exports first, `approachRoadsOf` +
   `nearestMajorHeart` before `shoreBand`.** Pure functions, no `three`,
   independently unit-testable headlessly, and they unblock both `festival.js`
   and spawn. Critically: D-L says these are *additive* (no reorder of existing
   draws), so the self-test golden `63c8dea2` stays green by construction — this
   is the lowest-risk, highest-unblock task. Do `shoreBand` last/optional.

2. **D2.1 — `festival.js` with `festivalPlan(heart)` memoized, gated on
   (seed, epoch).** The keystone decision layer. Land the new salts
   (`0x4D41_0B`/`0C`, confirmed free). Get one heart producing a correct POI
   list (stage center + arch/court/vendor-row/bubble-vendor on the primary road)
   before adding drum circles or villages. Verify in `map-sandbox.html` (it's
   pure data — the design's own surface, `tasks.md` I.2).

3. **D2.5 — rewire `placeChunkProps` to filter the memoized plan into the
   chunk.** Replace the per-point anchor dice (`placement.js:118-142`) with
   "enumerate hearts in POI-reach → call `festivalPlan` → keep POIs whose center
   is in this chunk." Keep the existing `claimed`/`tooClose`/`nudgeOffNoBuild`
   machinery — it's still useful for filler and for the within-cluster guard.
   This is where D-A compliance lives; treat the widened `heartsInBounds` scan
   radius as a deliberate constant (open question #4).

4. **D2.3 — re-anchor the cluster builders (mostly re-calls).** Map each POI
   descriptor `kind` to its existing builder with the plan's (x,z,yaw). The only
   genuinely-new mesh code: the food-court overlap guard (`chunks.js:1041`,
   ~10 lines), the double-row vendor layout, and arch+lights-on-road. Sugar
   shack restricted to the food-court path (delete the 0.33 shack branch in
   `buildVendorAt`, `chunks.js:992`, to kill the solo-shack bug).

5. **D2.6 — spawn at nearest major heart. THE VISIBLE WIN. Ship this as soon as
   D2.1+D2.2 can answer the query — even before villages/drum circles are
   re-anchored.** This is the slice that turns "infrastructure landed" into
   "the redesign is real, look at it." Reuse `_placeSpawnJugs`
   (`chunks.js:433`) for "more jugs."

6. **D2.4 — camp villages re-anchored + filler scatter trimmed.** The packing
   engine already exists (legacy camp village, `chunks.js:1845`); this is
   re-anchoring it to district/outskirts cells. `shoreBand` *preference* is a
   refinement, not a gate. Filler-scatter trim is a one-liner on the existing
   scatter loop.

7. **D2.7 — determinism hardening (quantize trig, POI window-invariance check).**
   Done alongside D2.1/D2.2/D2.5, not as a trailing afterthought — it's cheap to
   bake in and expensive to retrofit. But formal sign-off lands here.

8. **D2.8 — verify: boot the real game at spawn heart + a major + a minor + a
   lakeshore region, noon+midnight, ?perf=low/mid/high, headless per-chunk cost
   vs the 8 ms gate.** Non-negotiable per CLAUDE.md "ALWAYS boot the main game" —
   the anchors are sandbox-invisible.

### Critical Path (restated, one line)

`approachRoadsOf + nearestMajorHeart` → `festivalPlan` → `placeChunkProps`
filter → spawn-at-heart. Everything else (drum circles, camp villages,
shoreBand preference, filler) hangs off that spine and can land incrementally
behind it.

### Deferred / Park on ROADMAP

- **`shoreBand` lakeshore/causeway *preference* for camp villages (part of D2.4 /
  D-M):** Camp villages place correctly in district/outskirts cells without it
  (the legacy packing engine never needed shore-awareness). Defer to a
  fast-follow. What's NOT blocked: villages still clump (the actual fix for the
  confetti), still get porta-banks, still avoid roads/center. The shore
  *preference* is feel-polish on top of a working village. `tasks.md` E.4 and
  F.4 already establish "the swap ships; feel-tuning parks" as the project's
  accepted pattern here.

- **Causeway camps specifically:** a subset of the shoreBand preference. Same
  reasoning — park it. The causeway geometry interaction (camps straddling a
  road-over-water band) is the highest-novelty, lowest-leverage placement and
  the most likely to surface a no-build-in-water regression (D-P invariant a).
  Don't take that risk on the critical path.

- **Per-heart count *tuning* (major 1–2 vs minor 0–1 courts/rows/circles, the
  guaranteed-audience 22/12, the 35% shack chance):** the design ports the
  *tuned legacy numbers* (D-M) — that's exactly right, ship those as-is. Do NOT
  re-tune counts during the redesign. Feel-tuning of counts is a fast-follow A/B
  against `?worldgen=0`, parkable per the design's own Migration Plan note.
  Re-tuning mid-redesign muddies the "did clustering work?" signal with "did the
  count change feel?" — one-variable rule (CLAUDE.md Reasoning Protocol §1).

- **`drum_circle` re-home into dense-forest cell as a reachable destination
  (D2.4 overlaps with F.4):** F.4 itself is marked "parkable to a fast-follow if
  the run is tight." The drum circle reads as designed simply by being in a
  *treed off-road district cell* (D-M) — the *dense-forest nesting* refinement
  depends on Group F's tree budget landing anyway. Park the nesting; ship the
  off-road placement.

- **Cross-frame split of the anchor-chunk build spike (D-Q):** the design says
  "split across frames only if `chunkGenStats` shows it." Correct — don't
  pre-build the splitter. Measure first (D2.8), build the splitter only if the
  number is red. Pre-optimizing here violates `performance.md` "don't optimize
  before you've measured."

### Incremental Delivery Plan

Each slice boots clean behind `?worldgen=1` and does NOT block Groups E–I
(they're single-branch-gated at `chunks.js:422`, so an incomplete festival layer
still boots — empty-but-clean is the Group B contract, `chunks.js:419`).

- **Slice 1 (ship first — "the spine"):** D2.2 (`approachRoadsOf` +
  `nearestMajorHeart`, skip `shoreBand`) → D2.1 (`festivalPlan` producing
  stage + arch + one food court + vendor row + the guaranteed bubble vendor on
  the primary road) → D2.5 (filter into chunks) → **D2.6 spawn-at-heart.**
  *Enables:* arrive outside an arch facing a main stage with a court and vendor
  row down the street — **the redesign's visible proof.** *Verify:* boot at
  spawn heart, noon+midnight, console clean; confirm no solo shacks (shack now
  food-court-only). This is the "holy shit it reads as a festival" moment and it
  ships without villages, drum circles, or shore preference.

- **Slice 2 (ship after — "the back of the festival"):** D2.4 camp villages
  re-anchored to district/outskirts (no `shoreBand` yet) + drum circle in a
  treed off-road cell + porta-banks attached to each cluster + filler-scatter
  trim. *Depends on:* Slice 1's `festivalPlan`/`poisInBounds`/`campVillagesNear`
  surface. *Verify:* villages clump, potties tuck beside clusters, drum circle
  is off-road. Boot at a major + a minor heart.

- **Slice 3 (ship after — "polish + close the gates"):** `shoreBand` +
  lakeshore/causeway village *preference*; D2.7 determinism sign-off (the
  POI window-invariance check + quantize audit); D2.8 full per-tier + headless
  cost verification. *Depends on:* Slices 1–2 stable so the determinism golden
  and the cost number are measured against the real layout.

The fast-follow A/B feel-tuning (counts, shore preference strength) lands on
ROADMAP, not in this change — per the design's Migration Plan and the E.4/F.4
precedent.

### Risks (from my domain)

1. **`approachRoadsOf` is undersized in the docs relative to its leverage.** It's
   one bullet in D2.2 but it unblocks four of seven cluster types. The design
   says "compose of `neighborsOf` + `arterial` + `heartProxy`; pick the polyline
   endpoint matching `heartProxy(H)`." I confirmed those primitives exist
   (`roads.js:26,52,123,182`) — but "which polyline is the *primary* road"
   (longest/first, D-M) is a real decision that the arch/court/spawn all depend
   on. If that pick is unstable across the (seed,epoch) memo, the whole festival
   re-lays-out. **Mitigation:** make the primary-road pick deterministic and
   quantized (sort by a stable key, not raw float bearing) and unit-test it
   headlessly before D2.1 consumes it. This is the one new function I'd over-
   invest in.

2. **D2.5's "widened `heartsInBounds` scan" is an effort sinkhole with a perf
   cliff (open question #4).** A major heart's district is ~1000 m, so a chunk
   80 m on a side might own a court whose center is 100+ m away. Scan too narrow
   → clusters vanish (the exact confetti-adjacent failure). Scan too wide → the
   per-chunk sampler busts the 8 ms R7 gate. **Mitigation:** the scan radius is
   *max POI reach* (the largest center-to-cluster offset in `festivalPlan`),
   computed once as a constant — not "the district radius." Don't conflate
   "where the heart's influence reaches" with "where its built clusters sit."
   The memo (D-Q) makes the *plan* cheap; the *scan* cost is the live risk.
   Measure headlessly (D2.8) — the HUD is throttle-inflated (Group C lesson,
   D-Q).

3. **"Mostly re-calls" can hide tail work (effort reality check).** `buildStage`
   etc. exist, but the D-M deltas are real: the food-court overlap guard, the
   double-row vendor layout (current `buildVendorAt` is single, `chunks.js:991`),
   arch-on-road, deleting the solo-shack branch from `buildVendorAt`, and
   attach-potty-to-*cluster* vs the legacy attach-to-strongest-chunk-attractor
   (`pickPottyAnchor`, `chunks.js:1489` per D-M). None are large, but they're
   five small surgeries inside live, tuned functions — and each touches a
   must-not-regress invariant (D-P): stage-faces-out (c), attach-music-once (d),
   `userData.shared` (e), no-shove-parked-Zerble (g). **Mitigation:** treat D2.3
   as "five named edits + a dispatch table," each verified against its specific
   invariant, not "re-call the builders." Don't let the "70% reuse" framing make
   anyone skip the smoke test.

4. **The redesign can pass the sandbox and crash the game** — the documented
   `{group,...}` vs `Group` return-shape footgun (CLAUDE.md, design Risks). The
   builders already handle this (`chunks.js:954`), but `festival.js` POI
   descriptors flowing through a *new* `placeChunkProps` filter into
   `buildWorldgenKind` is a new path. `festival.js` is pure data and invisible in
   the entity sandbox; the only verification that catches a boot crash is D2.8's
   real-game boot at a heart-center chunk. **This is non-negotiable, not
   parkable** — sandbox-pass ≠ game-pass, and the longest call chain
   (`buildWorld → _generate → placement`) is exactly where this lands.

### Verdict

- **Verdict**: Proceed with mitigations.
- **Key Concern**: `approachRoadsOf` + the D2.5 widened-heart-scan radius are
  the two load-bearing new pieces, and both are undersized in the task list
  relative to their leverage (one unblocks four cluster types; the other gates
  both correctness and the 8 ms perf budget). Get the primary-road pick
  deterministic+quantized and the scan radius = max-POI-reach (not
  district-radius), each headlessly verified, before the rest of D2 leans on
  them.
- **Recommendation**: Proceed. This redesign is unusually low-risk for its
  visible payoff because the entire mesh-build layer (stages, courts, vendors,
  potties, drum circles, the campsite packing engine) already shipped in Group D
  and was built correctly. The genuinely-new work is a pure-data decision layer
  (`festival.js`) plus three additive, self-test-safe worldgen queries — a small,
  testable surface. Sequence it as the spine (D2.2→D2.1→D2.5→**D2.6 spawn, the
  visible win**), then back-of-festival, then polish. Park `shoreBand`/causeway
  preference, count-tuning, drum-circle dense-forest nesting, and the cross-frame
  build-splitter to fast-follows — none block the "reads as designed" deliverable.
  Hold the line on the boot-at-a-heart smoke test (D2.8); the redesign's one real
  trap is a boot crash in a code path the entity sandbox can't see.
