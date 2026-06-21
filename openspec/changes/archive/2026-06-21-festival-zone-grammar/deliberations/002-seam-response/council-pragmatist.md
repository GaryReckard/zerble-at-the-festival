# Council — The Pragmatist (Force Multiplier)

> Round 1, isolated. Lens: critical path, fastest *safe* delivery order, ship-now
> vs park-on-ROADMAP, reuse of the existing harness + pools. Cite-or-cut.

## TL;DR

The four seam responses are **not equal effort and not equally proven**, and
4B.3 as written (`tasks.md:247`) bundles them into one task that ends in the
SECOND golden move (4B.5). That bundling is the single biggest delivery risk
here — not because the work is hard, but because **every plan-emitting change
re-moves the golden, so the natural instinct to "land merge, verify, then land
trim" costs a golden re-record per slice.** The force multiplier is to decide,
up front, that **4B.3 is ONE golden move covering all responses that are
plan-validated today**, and to deliberately *under-scope* what goes into it.

Recommended slice order inside the single golden move, easiest+highest-confidence
first:

1. **yield** (drum vs stage) — nearly the existing `stageDeckClips` behavior
   already validated; reframed as plan-side omit. (`festival.js:233`, `chunks.js:1201`)
2. **merge** (food+food) — already classified `merged_court` and validated
   against Gary's real playtest pins (seed 1139472710). (`tasks.md:240-246`)
3. **trim** (vendor-row along road axis) — more involved (oriented trim + <3-booth
   skip), but plan-only and high-value for "the street just continues."
4. **soft_buffer** — needs NEW geometry/records (trees/hammock/shade/potty/path)
   and a new `buildWorldgenKind` case + 4-html importmap. **This is the one
   over-built-for-now risk; recommend PARKING the geometry to a slice 2 and
   shipping buffer as a *bare separation* (yield-the-quiet-zone) inside the
   golden move.**

`soft_buffer` is the only response that touches the mesh layer, the pools, and
perf budgets. Everything else is pure planner emission. Keep them apart.

## Critical Path

(BEFORE Priority Sequence — this is the dependency chain that gates everything.)

The longest dependency chain is **not** "build four responses." It is:

```
classifySeamsNear (DONE, 4B.2 — festival.js:355)
   └─> RESPONSE emission inside festivalPlan / a reconciliation pass   ← the real work
         └─> the SECOND golden move (re-record POI golden + node==browser)  ← 4B.5
               └─> remove neighbourCourtHere + stageDeckClips band-aids    ← 4B.3 done-criterion
                     └─> burndown (6.1) + Gary playtest (7.3)
```

Three things sit on the critical path and one does NOT:

- **ON PATH — the emission site (architecture).** Whatever response we emit, it
  must change what `festivalPlan(heart)` returns (the POI golden hashes the
  plan, `tasks.md:64`), and it must be **order-independent for BOTH hubs of a
  seam with no communication** (briefing Q2). `classifySeamsNear` already proves
  the *read* is order-independent (337 shared pairs agree on keeper+hash across
  shifted windows; 32 shared seams agree on type — `tasks.md:230,245`). The
  unsolved part is making the *write* (the trim/merge/omit) land identically in
  hub A's plan and hub B's plan. This is the keystone; nothing ships until it's
  decided.

- **ON PATH — the golden move (4B.5).** It can only move ONCE here
  (`briefing.md:87`). So all plan-changing responses must be batched into one
  commit, re-recorded together. Staging them = N golden re-records (see below).

- **ON PATH — removing the band-aids.** 4B.3's done-criterion *is* the removal
  of `neighbourCourtHere` + `stageDeckClips` (`tasks.md:252`). But removal is
  only safe AFTER the planner equivalent is proven to cover the same pins.
  `merge` must cover what `neighbourCourtHere` covered; `yield` must cover what
  `stageDeckClips` covered. This is the regression gate (briefing Q5).

- **OFF PATH — `soft_buffer` geometry.** The trees/hammock/shade/potty/path
  *record set* is genuinely new mesh work (`tasks.md:251`, a new
  `buildWorldgenKind` case, `chunks.js:1262`). NOTHING downstream is blocked by
  deferring the *cosmetic* buffer fill — the *conflict resolution* (the quiet
  zone yields / separates) can ship without a single new tree. The geometry is a
  visible polish slice, not a correctness gate.

### Why staging multiplies golden re-records (the load-bearing point)

`festivalPlan` is memoized and the POI golden hashes its output (`festival.js:511`,
`tasks.md:64`). The instant a response *changes a descriptor* the golden diff is
non-empty by design — that IS the move. If I land merge in commit A (golden
`a0edfaea → X`), then trim in commit B (golden `X → Y`), then buffer in commit C
(golden `Y → Z`), I have re-recorded + node==browser-verified the golden THREE
times, each a separate determinism gate (`briefing.md:87` says it may move ONCE).
That violates the one-move constraint and triples the riskiest verification step.

**Conclusion: 4B.3 must be ONE golden-move commit.** Stage the *development* of
the responses behind a feature flag or a dark-emit (compute the response, assert
order-independence, but don't write it into `out[]`) so each can be validated
against `classifySeamsNear` BEFORE the single commit that flips them all live.

## Priority Sequence

The build order INSIDE the single golden move, by confidence × value ÷ effort:

1. **yield (drum vs stage)** — *force multiplier, do first.* The behavior already
   exists and is validated: `stageDeckClips` (`festival.js:233`) is an
   order-independent heart-position test; the drum yields. Converting it to a
   plan-side omit (drop the `drum_circle` descriptor when the seam type is
   `yield` and this hub is the yielder) is the smallest possible diff that
   exercises the *entire* emission-site architecture end to end. Land this first
   to de-risk the architecture with the lowest-stakes response, THEN reuse the
   proven emission path for merge/trim. (classifier already returns `yield`,
   `festival.js:345`.)

2. **merge (food+food)** — *highest value, already validated.* The classifier
   already returns `merged_court` and it was checked against Gary's actual
   playtest pins: seed 1139472710's two food-court clashes both classify
   `merged_court` (`tasks.md:240-246`). Emission = the yielder drops its
   `food_court` descriptor; the keeper's court stands and serves both. This is
   the *direct, order-independent* replacement for `neighbourCourtHere`
   (`chunks.js:1173`) — and because the keeper is chosen by integer priority
   (`festival.js:288`), not load order, it FIXES the band-aid's "whichever chunk
   built first wins" non-determinism (`chunks.js:1171`).

3. **trim (vendor-row along road axis)** — *more involved, plan-only.* This is
   the one genuinely new *layout* algorithm: shorten the lower-priority vendor
   row along its road axis, skip only if the trimmed length can't seat 3 booths
   (`tasks.md:247`, design D7 `design.md:138`). Effort reality check: the row
   descriptor today is a single center+yaw (`festival.js:598`); trim needs a
   length field the builder reads (`buildVendorRowAt`, `chunks.js:1268`) — so
   trim is NOT purely planner; it needs a builder-side honoring of a new
   `length`/`booths` field. Still no new geometry, no new pool, no new kind.

4. **soft_buffer (stage ↔ camp)** — *defer the geometry, ship the separation.*
   See Deferred section. The conflict resolution (the quiet zone yields/offsets)
   ships in the golden move; the tree/hammock/shade FILL ships after as visible
   polish with no golden impact.

Each of 1–3 is a `festivalPlan` output change → all three belong in the single
4B.5 golden-move commit, validated in dark-emit first.

## Reuse — the harness + pools that eliminate planned work

- **`classifySeamsNear` is the whole front end (DONE).** 4B.3 does not need to
  re-detect anything — it consumes the existing seam list (`festival.js:355`,
  with `keeper`/`yielder`/`type`/`keeperZone`/`yielderZone` already on each seam,
  `festival.js:367-372`). The response is a *switch on `seam.type`*, nothing more.

- **`hub-sandbox.html` + `buildHubPreview` (`chunks.js:1278`) is the iteration
  surface — but it shows ONE hub.** A SEAM is a TWO-hub phenomenon. The hub
  viewer builds a single hub via `buildHubPreview`; it will NOT show a seam
  resolving between neighbours. **This is the real first task before grinding
  4B.3: confirm the seam is visible in an existing surface, and if not, build
  that surface.** The candidates: (a) the **map-sandbox overlay** already points
  at oriented extents (`tasks.md:144`) and renders multiple hubs in 2D — extend
  it to draw seam responses (cheapest, 2D, exactly the right multi-hub scope);
  (b) the running game at `?worldgen=1` (full pipeline, slow loop). Recommend the
  map-sandbox overlay as the primary seam iteration surface; cite it in the
  task's done-criterion. 4B.3's done line "hub-viewer + map-overlay show clean
  seams across 3 seeds" (`tasks.md:253`) is half-right — the **map-overlay** is
  the load-bearing half for seams; the hub-viewer can only show post-resolution
  single-hub cleanliness.

- **Buffer props: the pools already exist — no new model files.** If/when buffer
  geometry ships, it reuses `buildHammock`/`buildTreeHammock` (`hammock.js:6,84`),
  `buildCampChair`/`buildTikiTorch`/`buildEzUp` (campsite pool, `campsite.js:152,314,441`),
  `buildPottyBankAt` (already a `buildWorldgenKind` case, `chunks.js:1270`), and
  the tree scatter. So `soft_buffer` adds **zero new model files** — it composes
  existing pooled builders. That collapses its effort estimate substantially and
  is the argument for keeping it on the roadmap as a *fast follow*, not a
  blocker.

## Deferred / Park on ROADMAP

- **`soft_buffer` cosmetic geometry (trees/hammock/shade/path FILL).** Park the
  *fill* on ROADMAP as "festival seam buffer dressing." What's NOT blocked by
  deferring it: the golden move (buffer ships as a bare separation/yield of the
  quiet zone — same emission path as `yield`), the band-aid removal, the
  burndown, and the playtest. The fill is additive cosmetic records with no
  golden impact (it's POI-layer descriptors, `design.md:115`), so it can land in
  a later non-golden commit. Deferring it removes the ONLY mesh/pool/perf-budget
  surface from the riskiest commit in the change (`briefing.md:13`).

- **The connector-PATH record for buffers (and spur/access paths, 4.4/4.5).**
  Already explicitly folded toward group 5 / a mesh-half concern
  (`tasks.md:208-211`). Don't drag path geometry into 4B.3. A path is a cosmetic
  ribbon (`tasks.md:190`); it does not gate seam *correctness*. Park with the
  buffer dressing.

- **`shared_street` as a distinct continuous-frontage build.** D20 describes
  shared_street as "one continuous frontage, booths straddle the connecting
  road" (`session-log.md:155`). But `classifySeamType` only returns
  `merged_court`/`shared_street`/`yield`/`soft_buffer` (`festival.js:342-348`),
  and the *response* for commerce↔commerce in the brief is **trim**
  (`briefing.md:46`) — trim the lower-priority row, not synthesize a new fused
  street object. **Ship trim now; park "true continuous shared-street frontage"
  (a genuinely new build) on ROADMAP.** Trim already reads as "the street just
  continues" (`design.md:138`) at a fraction of the effort. Building a bespoke
  fused-frontage mesh is over-building for a problem trim already solves visually.

- **`STAGE_MIN_SPACING` cross-hub stage spacing.** Already cut + deferred to
  group 6 / hub-spacing tuning (`tasks.md:201-206`). Not a 4B.3 concern; don't
  re-open it.

## Incremental Delivery Plan

- **Slice 0 (iteration surface — do FIRST, ships nothing):** Extend the
  **map-sandbox overlay** to render `classifySeamsNear` output (color by
  `seam.type`) over the multi-hub 2D layout. Reuses the existing overlay that
  already draws oriented extents (`tasks.md:144`). Verify: open the overlay on 3
  baseline seeds, confirm the seams I'm about to resolve are visible and match
  the hand-checked pins (seed 1139472710's two `merged_court` clashes,
  `tasks.md:243`). Without this, every 4B.3 iteration is a slow `?worldgen=1`
  game boot — the exact anti-pattern the harness doctrine forbids. This is the
  "build the harness before the feature" task and it is genuinely first.

- **Slice 1 (the single golden move — ships the responses):** In ONE commit:
  emit `yield` (drop yielder's drum), `merge` (drop yielder's food_court),
  `trim` (shorten yielder's vendor row, skip <3 booths), and `soft_buffer` as a
  bare quiet-zone separation (NO new geometry). Remove `neighbourCourtHere` +
  `stageDeckClips` (`chunks.js:1173,1201`) in the SAME commit — their planner
  equivalents (merge + yield) now cover them. Re-record the POI golden ONCE
  (4B.5), node==browser verify, log old→new. Depends on Slice 0 for visual
  validation and on a dark-emit pass (compute response, assert hub-A-plan ===
  hub-B-plan agreement via the existing order-independence probe) BEFORE flipping
  it live. Verify: golden re-recorded + both engines agree; the 3 named pins
  (1139472710 courts, drum-vs-stage) resolve; `bin/lint` overlap stays 0;
  **boot `?worldgen=1` all 3 tiers, console clean** (`tasks.md:264` — mandatory,
  the camp-chair sandbox-pass-game-fail signature).

- **Slice 2 (buffer dressing — ships after, NO golden impact):** Add the
  `soft_buffer` FILL — compose `buildHammock` (`hammock.js:6`), campsite chairs/
  EzUp (`campsite.js:152,441`), tree scatter, and a `porta_bank` into the buffer
  zone, plus the cosmetic connector path. Reuses existing pools — zero new model
  files. Tag any new pooled geometry `userData.shared` (perf-pooling rule),
  `castShadow=false` on path ribbons (`tasks.md:265`). Depends on Slice 1's
  buffer-zone reservation existing in the plan. Verify: hub-viewer + map-overlay
  at noon/midnight; backtick budget within tier on the densest seamed hub
  (`tasks.md:264`); golden UNCHANGED (this is POI-layer cosmetic, must not move
  the golden again — if it does, the buffer records leaked into the hashed plan
  incorrectly).

## Verdict

**Proceed — with a hard re-scope of 4B.3.** The work is mostly *already done*
(detection + classification + the band-aids prove the behaviors); 4B.3 is a
switch on `seam.type` plus disciplined batching. The two changes I'd insist on:

1. **4B.3 is ONE golden move, not staged** — batch yield+merge+trim+bare-buffer
   into a single re-record. Develop them behind a dark-emit so each is validated
   against `classifySeamsNear`'s order-independence BEFORE the one live flip.
   Staging = multiple golden re-records, which the one-move constraint forbids
   (`briefing.md:87`).

2. **Split `soft_buffer` geometry out to a fast-follow (Slice 2)** — it's the
   only response touching mesh/pools/perf. Ship the *separation* in the golden
   move; ship the *dressing* after with zero golden impact, reusing the
   hammock/campsite pools (no new model files).

Biggest under-specified risk I own on the delivery side: **the iteration surface
for a two-hub seam does not exist yet** — `hub-sandbox.html` is single-hub
(`chunks.js:1278`). The map-sandbox overlay must be extended to show seam
responses (Slice 0) or 4B.3 iteration falls back to slow full-game boots, and
the "across 3 seeds" done-criterion (`tasks.md:253`) becomes unverifiable
cheaply. Build that surface first.
