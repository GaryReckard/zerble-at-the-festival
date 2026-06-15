---
change: festival-zone-grammar
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: "SEAM GRAMMAR LANDED (D24/D25) + COLD STALL RESOLVED (D26). 4B.0/4B.1/4B.2/4B.3a/4B.3b/4B.3c/4B.5/4B.6 DONE. festivalPlan = seam-blind base + cross-hub suppressions (merge/yield/trim); band-aids removed; POI golden MOVED 49ec28fc→c1920e52, queryPoint FROZEN eddf8e50; game boots clean. soft_buffer DEFERRED to 4B.7. PERF: per-cell arterialsNear cache (roads.js) cut nearestRoad 15.3× / cold plan 10.6× → cold stall ~13s→~1-2s, bin/lint >40s→~10s/seed (golden-preserving, both frozen). Group 6 burndown UNBLOCKED. Frame-spread now nice-to-have not prereq. NEXT: 4B.4 (emergent MAJOR-hub arrival, D9/D22 — feel-gated/golden-moving) → 4B.7 (soft_buffer geometry fast-follow) → Group 6 full 10-seed burndown → 7.3 Gary playtest (HUMAN GATE). queryPoint eddf8e50 / POI c1920e52."
blocked_by: ""
open_questions: 0
started: 2026-06-13
last_updated: 2026-06-15
ref: "ROADMAP 'Festival layout'; gated by worldgen-layout-harness baseline (now MET)"
---

# Session Log: festival-zone-grammar

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter + Key Decisions + the
> latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 — Extraction first, behaviour-preserving, one builder per commit (golden-frozen),
  THEN the grammar (golden moves once).** Carries forward harness D-C′/D6. The only commit
  that moves the POI golden is the deliberate group-4 slotting commit; every extraction
  commit is snapshot-EMPTY-gated so a diff failure localizes to one builder.
- **D2 — Crowd pre-rolled params close the tier-dependence (harness R2).** The extraction
  pre-rolls crowd count + per-NPC seeds into layout records so `crowd.spawn` stops drawing
  from the cluster rng with a tier-sized pool; baseline (perf=high) and shipped low/mid then agree.
- **D3 — True extents are oriented shapes from the SAME `FESTIVAL_TUNING` constants the
  builder reads** (court=ring, vendor=rect incl. camps-behind, stage=wedge). The D8
  "two owners, do NOT merge" pairs (planner dancefloor vs buildStage's 9 m; legacy twins)
  MERGE here — world drift is expected and gated.
- **D4 — Zone slotting (priority order on front axis F), omit-if-no-fit, not
  scatter-then-relax.** Mutual exclusion by construction = main's "one theme per chunk" at
  hub scale. Relaxation rejected (permits clipping under density).
- **D5 — Spur roads + drum access path are COSMETIC PATH RECORDS from the planner, not new
  arterials in roads.js** — so the queryPoint (road-existence) golden stays frozen; only
  the POI golden moves.
- **D6 — `DEFAULT_WORLDGEN_V2` flip is a SEPARATE later change** (Gary-sequenced: H.2 →
  harness → this → H.3/F.5 + I + flip). This change ships flag-off; no mid-game player is on v2.
- **D13 — LEAN PATH (Q1 answered, Gary).** This change ships the planner-only critical
  path: true oriented extents (group 3) → zone-slotting planner with ONE deliberate POI
  golden move (group 4) → arch relocation → registry-clearance backstop (group 5) →
  burndown to zero (group 6) → verify/judge. The behaviour-preserving ~8-builder
  layout/mesh extraction (group 2) + crowd pre-roll (group 1) are **DEFERRED to a
  follow-up change**, not dropped — Gary: "want to eventually do the full scope." Parked
  on ROADMAP as "Festival worldgen v2 — builder layout/mesh extraction + crowd pre-roll."
  Rationale: the 0.5 spike proved the extraction is off the critical path to zero-error
  (POI golden hashes the plan; crowd draws live in the builder). Consequence for THIS
  change: the goldens for the *builders* never move; only the POI golden moves once, at
  the slotting commit. Crowd tier-dependence (harness R2 / A4) is **explicitly left
  open** and inherited by the follow-up. -> Q1, -> ROADMAP.

- **D14 — Group 4 slotting algorithm (pinned before the rewrite).** `_computePlan`
  replaces scatter-then-`resolveOverlaps` with a single-pass priority slotter. Determinism
  is preserved by keeping the SAME `cellRng(cx,cz,SALT.poiLayout)` stream consumed in a
  FIXED order and `clusterSeed(heart, SEMANTIC_idx)` keyed on a stable semantic index
  (stage=0, court i, row i, …) so zone-omit never re-rolls a sibling's model variation
  (R19 / task 4.2). The single POI-golden move is THIS commit and only this commit.
  Steps, each testing its `clusterShapes` extent against the accumulating `placed[]`
  (via `clustersOverlap` with a small MARGIN) + water (`lakeAt`) + roads (`queryPoint`)
  and OMITTING on no-fit (dropping dependents transactionally):
  1. **Stage** at `nudgeOff(hub center)`, yaw = π/2−F. Its deck circle + forward
     dancefloor OBB become the first `placed[]` entry AND the hard front-wedge reservation.
  2. **Vendor aisles** along `roads[0..rowN]`: descriptor stays ON the road point (the
     drivable aisle, kind=vendor_row, yaw=π/2−tangent). The oriented OBB (booth line +
     camp band, from clusterShapes) is the reservation; omit a row whose OBB overlaps an
     earlier zone. (booth-on-road → 0 because the row centers ON the road by construction
     and the OBB straddles it; the BUILDER places booths at ±offset, never on the surface.)
  3. **Food courts** off `roads[0..courtN]` at walk dist, perp off ROAD_WIDTH/2+PERP,
     `nudgeOff` water/road; REJECT if within `COURT_MIN_STAGE_DIST` of the stage or if the
     ring circle overlaps an earlier zone → try the other side, then omit. (overlap +
     truck-off-road → 0.)
  4. **Drum circle** via `treedDistrictSpot` (already forest-seeking + off-wedge); REJECT
     if its circle is inside any placed zone (drum-in-trees envelope) → re-attempt within
     the existing 12-try loop, then omit. Access path = a cosmetic path record (task 4.4).
  5. **Potties**: one per parent zone (stage/court/row), attached at the parent edge along
     the hub-outward normal, facing the parent. Dropped transactionally if the parent omitted.
  6. **Arch** (spawn hub only, or every hub — decide at 4.x): a NEW plan descriptor kind
     'arch' on `roads[0]` at a threshold ≥ `ARCH_MIN_STAGE_DIST` ahead of the stage, over
     the road, outside every dancefloor. main.js `buildSpawnArch` STOPS building its own
     (relocation = the planner now owns the arch). arch-placement → 0.
  7. **Bubble vendors**: `rng() < BUBBLE_PROB` gated (not guaranteed) into a leftover clear
     slot. New `BUBBLE_PROB` in FESTIVAL_TUNING.
  New FESTIVAL_TUNING: `STAGE_MIN_SPACING`, `COURT_MIN_STAGE_DIST`, `ARCH_MIN_STAGE_DIST`
  (exists), `BUBBLE_PROB`, `SUGAR_SHACK_PROB` (sugar-shack % of courts), `ZONE_MARGIN`.
  Verification loop per iteration: plan-mode `bin/lint` (fast) → re-record POI golden ONCE
  (log old→new) → re-capture 10 registry snapshots → registry `bin/lint` to drive errors→0.
  -> Task 4.1–4.6, spec.md (all scenarios), D4/D6.

- **D15 — Arch is PER-HUB and DECOUPLED from spawn (Group 4 implementation call).**
  The planner emits an `'arch'` descriptor on `roads[0]` (the drag), walked OUTWARD
  past the vendor market to the first point clear of every placed zone (`fits()`),
  dry, and ≥ `ARCH_MIN_STAGE_DIST` from the stage DECK EDGE (not center). `case 'arch'`
  already existed in `buildWorldgenKind`, so it builds via the normal chunk path —
  `main.js buildSpawnArch` + `chunks.js buildSpawnArch` are REMOVED (the planner owns
  the arch). CONSEQUENCES: (a) every hub now gets an entrance arch (was exactly one, at
  spawn); (b) arches stream via `chunkKey` like all festival furniture — the old single
  `'spawn_arch'` non-chunk-key persistence is gone (correct: per-hub arches aren't the
  lone persistent spawn marker any more); (c) **PLAYER-FACING — the spawn arrival no
  longer has an arch pinned in front of Zerble.** Zerble still spawns on the dancefloor
  front facing the stage; the arch is now the road gateway you drive through (arch →
  market → stage), discovered on the drag, not at the spawn. Resolves the long-standing
  "spawn-on-road vs face-the-stage" Dangling Thread by DECOUPLING them. Flag for Gary's
  7.3 playtest. -> Task 4.1, main.js, chunks.js, D14 step 6, Dangling Threads.

- **D16 — Three D14 deviations + one latent-bug fix, logged (cite-or-cut).** (a) Bubble
  vendor KEPT GUARANTEED (refuel is a core verb; probabilistic would strand players) →
  `BUBBLE_PROB` CUT. (b) `STAGE_MIN_SPACING` CUT — a single-hub planner can't enforce
  cross-hub stage spacing (that's the `stage-spacing` WARN rule's job). (c) `SUGAR_SHACK_PROB`
  CUT — sugar-shack share is a BUILDER decision (`FOOD_COURT_SHACK_PROB` already exists).
  New constants actually added: `ZONE_MARGIN`, `COURT_MIN_STAGE_DIST`, `FOOD_COURT_STEP`,
  `ARCH_DRAG_FRAC`. LATENT BUG fixed: `clusterShapes` stage deck circle now SCALES (`×scale`)
  — the dancefloor scaled but the deck didn't, so the deck circle under-estimated the real
  (scaled) deck box; surfaced because `arch-placement` measures to actual deck TILES.
  -> Task 4.6, tuning.js, D14.

- **D17 — Food courts RELOCATE outward past the vendor market.** The vendor row and the
  food court both target `roads[i]`; the court's wide truck ring (~24 m) clips the row's
  OBB on the same road, so a single-attempt slotter OMITTED every court. Fix: the court
  walks outward in `FOOD_COURT_STEP` increments (both sides each step) until its ring
  clears all placed zones — "drive the market, then reach the food." Capped at the drag
  fraction; omitted only if the road is too short/packed. -> Task 4.1, festival.js.

- **D18 — Playtest corrections (Gary, 2026-06-14, against a338ed2) — SUPERSEDES parts of
  D15/D16/D17.** Gary playtested the committed Group 4 with the `K` marker tool and found
  five issues; corrections landed in a follow-up commit:
  1. **ONE arch in the whole world, not per-hub.** D15's "every hub gets an arch" was a
     MISREAD — the design was always "exactly one arch, at the spawn hub's main stage"
     (A1). Gary: "There should only be ONE arch, and that one by the main stage." Fix:
     `festival.js` gates the `'arch'` descriptor to the spawn hub only (`spawnHubKey()`
     = `nearestMajorHeart(0,0)`, cached per seed/epoch). All other hubs: no arch.
  2. **Arch distance rule = ≥ 2 dancefloor-lengths from the stage** (Gary: "past the
     dance floor by at least one more dancefloor length"), on a road that leads to the
     stage. Replaces the old `ARCH_MIN_STAGE_DIST + deck` rule.
  3. **Arch must ALWAYS place on the spawn hub** (it anchors the spawn). Gary's seed
     1399551401 has a big stage (scale 1.40 → archMin 106 m) + short roads (cap 115 m) →
     the arch was OMITTED. Fix: `ARCH_DRAG_FRAC` 0.6→0.85 + a relaxation ladder
     (2×→1.5×→1×floor→deck+min) so the gateway always lands.
  4. **Zerble spawns just OUTSIDE the arch, facing through it at the stage** (Gary's
     spec). `main.js` reads the spawn hub's `'arch'` descriptor and positions Zerble
     `SPAWN_PAST_ARCH` (7 m) beyond it on the approach side; dancefloor-front spawn is
     now the FALLBACK when no arch fits. INTERPRETATION NOTE: "just past the arch" read
     as "just outside, facing in" (the iconic gate arrival); flag for Gary if he meant
     just-inside-facing-back.
  5. **Drum OMITTED when no treed pocket** (Gary: "Definitely omit it. Drum circles do
     NOT need to be at every hub."). `treedDistrictSpot` drops the dry fallback — returns
     null if no `treeDensity ≥ 0.25` spot in 12 tries. (~52/305 hubs keep a drum.)
  6. **Food courts on SIDE roads** (`roads[length-1-i]`), not `roads[0]` — frees the main
     drag for the market + arch AND separates the two courts so they can't spawn adjacent
     (Gary: "two food courts spawning right next to each other... 8 trucks").
  7. **Potties tuck PAST the parent's solid edge** (`par.r + POTTY_GAP`, fanned + clear-
     tested), not a fixed 9 m from center — the old offset landed potties INSIDE the food
     court's ~24 m truck ring (Gary: "a porta potty clipping inside a food truck").
  8. **Camp tents skip the road surface** (`queryPoint(px,pz).onRoad` in
     `buildCampVillageAt`) — the center was off-road but tents spread over ~30 m landed on
     it (Gary: "campsites that spawn in the middle of a roadway... on either side, but not
     on the road"). Builder-only — no golden impact.
  Consequence: the POI golden moves AGAIN (a0edfaea → 49ec28fc) — a SECOND move,
  in the playtest-fix commit. Acceptable: the branch is unmerged + flag-off (D6); these
  are direct responses to playtest feedback, not gratuitous churn. -> Task 4.x, festival.js,
  main.js, chunks.js, tuning.js.

- **D19 — World feel: DENSE & SEAMED, overlap is a FEATURE (Gary grill, 2026-06-14).**
  Root cause of every playtest clip: `HEART_CELL` 200 m vs ~190 m cluster reach (±80 m
  jitter) → adjacent hubs ALWAYS overlap, by design (`constants.js:11` flags the dense
  setting "to be re-settled during the layout-grammar redesign"). Gary's call: do NOT
  design the overlap out (rejected: spacing hubs into a discrete archipelago) and do NOT
  keep whack-a-mole patching (rejected: builder-side band-aids forever). Instead EMBRACE
  it — one continuous festival, with the overlap promoted to a designed shared place.
  This is the pivot the rest of D20–D23 hang off. -> drives the cross-hub seam grammar.

- **D20 — Seam grammar is CONTEXT-DEPENDENT (Gary grill).** Where two hubs' edge zones
  meet, the planner picks a seam TYPE by what's on each side: (a) commerce↔commerce →
  **shared market street** (one continuous frontage, booths straddle the connecting road,
  no dead-end aisles); (b) food+food → **one MERGED court** serving both hubs (not two
  adjacent); (c) loud↔quiet (stage↔camp) → **soft green buffer** (trees/hammocks/shade/
  potty/connector path absorbs the clash). Plus orientation-away (fronts/lights/arches
  point inward, never outward into a neighbour unless that edge IS a market street).
  This SUPERSEDES the builder-side band-aids — `neighbourCourtHere` (food-court omission,
  chunks.js) and `stageDeckClips` drum-yield are the blind, load-order-dependent versions
  of (b) and (c); they get promoted into this principled planner layer and removed.
  Framing = ChatGPT R3 seam-typing; geometry = Gemini OBB/SAT + R4 trimming. -> design D7.

- **D21 — Cross-hub decisions are INTEGER-ONLY (Gary grill — determinism, footgun #4).**
  No floating-point value EVER gates existence/merge/trim across the seam. Hub priority =
  integer bit-mix hash of the two cells + seed (`getHubPriority`); positions quantize to
  whole meters; "do these overlap?" compares integer squared-distance / integerized SAT
  projections; ties by `(cx,cz)` lexicographic — exactly the pattern `hearts.js` already
  uses. Rejected: float OBB/SAT + lean on node==browser re-verify (re-opens the
  road-existence-flip class the project deliberately closed). -> design D8.

- **D22 — Arrival is EMERGENT at MAJOR hubs, varied, spawn-guaranteed (Gary grill —
  REVISES D18 #1).** D18 made it "exactly ONE arch, at the spawn hub." The dense-&-seamed
  world wants legible arrivals more widely — but NOT at every hub (the 91% minors over-
  arched, D18's actual complaint). Resolution: the road→arch→stage approach is a grammar
  feature of MAJOR-rank hubs (~4% of cells), **probability-gated among majors** (not every
  major) and VARIED (arch presence/style, approach length, lakeside vs field stage) so it
  never reads formulaic. The spawn hub keeps its GUARANTEED hero composition (D18 intact
  there); spawn relocation lands the player on a major facing the core down the approach
  road — so "on a road" and "facing the stage" are the same act (resolves the round-2
  spawn-on-road vs face-the-stage tradeoff: the road IS the sightline). Gary hedged ("maybe
  not EVERY one… whatever you want") → keep the major-hub arch probability a `FESTIVAL_TUNING`
  slider and gut-check density at 7.3. -> design D7, tuning.js, main.js.

- **D23 — Sequencing: design-lock NOW, then build the seam grammar (Gary grill).** This
  session writes D19–D22 into design.md + tasks.md as plan-of-record, then implements in
  order: integer `getHubPriority` + seam-pair enumeration (pure, golden-frozen) → the
  context seam-type decision + merge/trim/buffer (replacing the band-aids) → emergent
  major-hub arrival → the SECOND deliberate golden move (re-record + node==browser verify)
  → Gary playtest (7.3). The earlier "single golden move" (D6) is now explicitly TWO
  deliberate moves: the slotter (done, 49ec28fc) and this seam grammar. RISK GATE: this
  brushes determinism + the golden + lifecycle — a `/deliberate` before the golden-move
  commit is recommended (Gary's call); the grill itself served as the design interrogation.
  -> tasks Group 4B.

- **D24 — Deliberation 002-seam-response (debate, 2026-06-15): the 4B.3 architecture gate.**
  Tier-3 `/deliberate --debate` on the seam RESPONSE (5 personas R1; R2 budget-truncated to a
  comprehensive Adversary cross-examination that adjudicated all four others; Mediator synthesized).
  **Architecture fork RESOLVED → emit-in-plan via a post-base-plan annotation pass; the POI golden
  MOVES.** Rationale: the fork is cosmetic on the safety axis (both homes stand on
  `classifySeamsNear`'s canonical-pair substrate, both order-independent for the same reason, both
  non-recursive iff the seam step runs after base-plan compute, both incur the same ~2.8s cold
  fan-out); the discriminator is "keep it non-recursive + fully hashed," and one hash covering
  plan+seam beats two hashes where the seam one can be forgotten. "Golden frozen" collides with the
  design.md:144-146 lock (builder-side-to-freeze can't be order-independent). **Architect's
  golden-frozen headline preserved as a DISSENT** (their consume-time filter is the sanctioned
  fallback IF suppression still hashes into a first-class gate); their stale-memo cleanliness
  preserved as an INVARIANT (seam-blind `_computePlan`). The risk lives in the **7 non-negotiables
  N1–N7** (folded into tasks 4B.0/4B.3a/b/c/4B.5 as done-criteria), NOT the home. Scope cuts:
  ship yield→merge→trim→bare-buffer in ONE golden move; **stage↔camp soft_buffer + buffer GEOMETRY
  DEFERRED to non-golden fast-follow 4B.7** (camps on a separate grid = a fresh two-system existence
  surface that must not ride the golden commit); seam-lite plan PARKED (determinism trap unless
  bit-identical front-zone proven); the 6 ChatGPT lint rules REJECTED for this change (out of scope,
  moves the ruler mid-burndown). Deliberation gate SATISFIED. -> deliberations/002-seam-response/results.md,
  tasks Group 4B.

- **D25 — 4B.3b/c LANDED: seamed festivalPlan + band-aids removed + 2nd golden move (2026-06-15).**
  Implemented the deliberation-002 architecture: `festivalPlan` = seam-blind `_basePlan` (memoized,
  per-heart, non-recursive — N1) + `_suppressSetForHeart` (drops descriptors targeted by cross-hub
  seam responses). merge (food+food→one court), yield (drum vs neighbour stage), trim/suppress
  (vendor rows) applied plan-side; **soft_buffer DEFERRED** (action 'buffer', not suppressed — at
  ~40/window, deleting would gut the festival; → 4B.7 dress-not-delete). Removed `neighbourCourtHere`
  + `stageDeckClips` + orphaned `_STAGE_DECK_MAX` (4B.3c). POI golden MOVED `49ec28fc → c1920e52`;
  queryPoint FROZEN `eddf8e50` (N6 inverted gate — no road/water change). Verified: merge collapses
  seed 1139472710's (3,1) court (keeper (4,1) keeps); yields fire 3-4×/seed; festivalPlan
  deterministic + order-independent (N4, 0 disagreements). Game boots clean (no JS errors).
  **PERF DEBT (D-perf):** the seamed plan warms neighbour base plans on the chunk-gen critical path
  → 13s first-chunk cold stall (steady-state fine, memoized). Mitigated `SEAM_PAIR_REACH` 420→300
  (empirical max real clip 259m → golden-preserving, ~½ the warming). The real fix (frame-spread +
  cheaper nearestRoad) is the #1 perf-pass item + a flag-flip prerequisite. -> PERF-FEEL-NOTES.md,
  CHANGELOG 2026-06-15, deliberations/002.

- **D26 — Cold stall LARGELY RESOLVED: per-cell `arterialsNear` cache (2026-06-15).** Pulled the #1
  perf-pass item forward (it had become a tooling blocker — `bin/lint` >40s/seed stalled the Group 6
  burndown). Profiled the base-plan cost (`measure before optimizing`): the bottleneck was NOT
  `arterial()` polyline computation (already cached) but `nearestRoad` re-walking the neighbourhood
  graph (`neighborsOf` + `edgeKey` Set-dedup over a (2·window+1)² cell block) on every call.
  `arterialsNear`'s output is a **pure function of the cell** the query point falls in (qx/qz only
  derive `ccx,ccz`), so hoisted it into a per-cell cache keyed `(ccx,ccz,window)`, gated `(seed,epoch)`
  like `_arterialCache` (`roads.js`). **Golden-preserving by construction** — verified bit-identical:
  queryPoint `eddf8e50`, POI `c1920e52` via `runSelfTest`. Measured (node): `nearestRoad` ±2km/50m
  grid **8051→528ms (15.3×)**; cold `festivalPlan` 79-hub window **7252→685ms (10.6×)**. Effect:
  cold first-chunk stall ~13s → ~1–2s; `bin/lint` >40s → ~10s/seed (10-seed sweep ~105s → burndown
  unblocked). Frame-spreading the residual ~1–2s is now nice-to-have, not a flag-flip prerequisite.
  Note: the targeted fix I'd *guessed* in PERF-FEEL-NOTES (region-level seam-response cache) was the
  wrong hypothesis — the win was in the road layer, one level below the seam pass. -> PERF-FEEL-NOTES.md,
  CHANGELOG 2026-06-15.

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | Every worldgen builder's rng draws can be hoisted into a pure `layout(rng,env)` with EMPTY snapshot diff (incl. conditional draws in retry loops) | Med | open | Verified per-builder by group-1 snapshot diffs |
| A2 | Spur/access paths can be cosmetic records without touching the road-existence golden | Med | open | Verified at task 4.3 (queryPoint golden held) |
| A3 | Zone-slotting + omit can hit 0 error-rules on all 10 baseline seeds without leaving hubs feeling empty | Med | open | Tuned in the hub viewer/gallery; Gary playtest (7.3) |
| A4 | Crowd pre-roll makes layout tier-independent without changing the perf=high baseline | Med | open | Verified at task 2.1 (low==high normalized layout) |

## Dangling Threads

- ~~Spawn-on-road vs face-the-stage tradeoff (round-2 open) — lean "both via front axis"; resolve in task 4.1 (-> deliberation).~~ RESOLVED by -> D15: DECOUPLED — spawn stays on the dancefloor front facing the stage; the arch is a separate per-hub road gateway. Gary to gut-check the new arrival at 7.3.
- ~~Drum treeless-fallback (feel decision for Gary, group 6).~~ RESOLVED 2026-06-14 (Gary: "Definitely omit it. Drum circles do NOT need to be at every hub") — `treedDistrictSpot` now returns null if no treed pocket; ~52/305 hubs keep a drum. -> D18.
- **DEFERRED (Gary 2026-06-14, "document them, don't fix now") — tree-through-truck.** Seed 1390463068 @ (-2129,1550): a forest tree spawns clipping a food truck. `scatterTrees` (chunks.js) avoids the chunk path strip + `closestBuilding` r=2.5, but a food-court truck's body extends past 2.5 m so a tree's trunk lands inside it. Fix = widen the tree-scatter building-guard to the truck footprint (or skip tree spots inside any food_court ring). Builder-only (no golden impact). -> ROADMAP (group 5/6 builder backstop).
- **DEFERRED (Gary 2026-06-14) — marker UI needs an unhindered-typing modal.** The `K` marker drop is fine, but the backtick-overlay markers list can't be typed into: global key listeners hijack letters (pasting with Ctrl+V fired the `V` cam-change). Gary wants: `K` drops the marker AND immediately opens a MODAL with a focused text field (listeners suppressed while open) to type the note, still appends to the localStorage list, and offers a copy-for-agent button (coords + note). Dev-workflow feature. -> ROADMAP.
- **Selftest POI-golden box sweep cost.** `runSelfTest` computes `festivalPlan` over a 6 km box (1037 hearts) × 4 seeds ≈ 7 min in node; the slotter added ~26%/hub (84→106 ms, mostly the food-court relocation `nudgeOff`/`queryPoint`). Pre-existing heavy diagnostic (HEAD was ~350 s); in-GAME cost is unchanged in character (one memoized hub at a time). The map-sandbox self-test button inherits this. Park as a perf-of-the-harness item, not a game-perf one. -> Task 6.x.
- `booth-on-road` warn threshold (baseline's largest rule, 74) — may need a "straddle allowed, on-surface not" refinement; a linter-rule bug is fixable here (-> Open Q).
- Inherited from harness adversarial review: hub-viewer acceptance is N=1 (widen to 2–3 seeds before grading against it); `arch-placement` fires ~globally (should drop to ~0 here — if not, `ARCH_MIN_STAGE_DIST` is miscalibrated, not the placement).
- **RE-BASELINE before burndown (group 6):** `verification/baseline.md`'s "106 error / 92 warn" headline UNDERCOUNTS — the real all-rules registry total is 136/92 (group-3 linter; was 135/92 pre-group-3). Re-record baseline.md against the group-3 linter so the burndown's before/after share one ruler. (-> Task 6.3)

## Work Log

### 2026-06-14 -- Group 3 (oriented extents) + a baseline-accounting discovery
**Event:** discovery
**What:** Built `clusterShapes` (oriented convex extents) + overlap/contain predicates
in tuning.js; wired the linter plan-mode `overlap` + shared `clustersContaining` to them;
promoted the MODEL_DIMS drift guard to throw (chunks.js) + added headless `bin/check-model-dims`.
Goldens FROZEN (eddf8e50/4825fd0b) — clusterShapes is linter/overlay-only. Game boots
clean at perf=low.
**DISCOVERY (matters for group 6 re-baseline):** the registry-mode `bin/lint` total over
the 10 baseline snapshots is **135 error / 92 warn** with the CURRENT (pre-group-3) linter
— NOT the "106 / 92" headline in `verification/baseline.md`. The 106 is a smaller-rule-set
accounting (baseline.md's per-seed table predates the 4.7 `arch-placement`+`drum-in-trees`
append; those errors live only in the appended block, never folded into the headline). So
the real all-rules "before" is 135/92. Group 3 then moved it to **136/92** (the one true
side_stage-envelope catch). **Consequence:** group 6's burndown must re-record baseline.md
against the group-3 linter so before/after use ONE ruler — the "106" headline is not a
valid zero-target. -> new Dangling Thread; -> Task 6.3 (burndown table) will re-state the
"before" as 136/92 (all rules, group-3 linter).
**Refs:** -> Task 3.1/3.2/3.3, tuning.js clusterShapes, lint.js, bin/check-model-dims, verification/baseline.md

### 2026-06-13 -- Q1 answered: LEAN PATH. Groups 1+2 deferred; starting group 3→4.
**Event:** decision
**What:** Gary chose the lean planner-only path ("cool with starting with this, but want
to eventually do the full scope. let's gooooooo"). So this change = groups 3→8 (extents,
slotting + single golden move, arch relocate, backstop, burndown, verify); groups 1
(crowd pre-roll) + 2 (8-builder extraction) are DEFERRED to a follow-up change and parked
on ROADMAP ("Festival worldgen v2"). The crowd tier-dependence (A4) rides along to the
follow-up. Recorded as -> D13. Next concrete action: group 3 — promote `clusterExtent`
to per-kind ORIENTED extents (court=ring, vendor=oriented rect, stage=wedge) so the
group-4 slotter has real shapes to pack instead of scalar `KIND_FOOTPRINT` radii.
**Refs:** -> Q1, -> D13, tasks.md (groups 1+2 → DEFERRED), ROADMAP

### 2026-06-13 -- Apply started: Group 0 gate validated + Group 0.5 SPIKE → extraction is deferrable
**Event:** discovery (re-scope) + question
**What:** Group 0.2 (the CRITICAL gate check) PASSES — `bin/lint` over the repo-root
baseline snapshots reproduces the recorded worst-offender penetrations exactly (1234
7.5m / 0xf7ef2a3c 5.8m / 42 6.4m). No STOP.
**Group 0.5 spike finding (code-grounded, reshapes the plan):** ALL the failing rules
are PLANNER placement decisions, not builder behaviour:
  - `arch-placement` (21): the arch is built in **main.js** `buildSpawnArch` at
    `archDist=15*scale`, deliberately INSIDE the dancefloor (main.js:240,283). Fix =
    relocate it to a road threshold. Zero builder work.
  - `overlap` (48): `resolveOverlaps` separates clusters by SCALAR
    `a.footprint+b.footprint+MARGIN` (festival.js:331,339) using `KIND_FOOTPRINT`. Fix =
    oriented-extent zone slotting in the planner.
  - `water-clear`/`drum-in-trees`/`booth-on-road`/`dancefloor-clear`/`potty-attached`:
    all set in `_computePlan`/`nudgeOff`/`perpOff` (festival.js:356-454) — planner.
  The `chunks.js` builders only RENDER the planner's descriptors, so they need no change
  to fix the rules. Crucially, **the POI golden hashes the PLAN (descriptors), not the
  build, and crowd draws live in the BUILDER** — so the crowd tier-dependence does NOT
  touch the POI golden the slotting commit moves. **Therefore the full per-record builder
  extraction (group 2) AND crowd pre-roll (group 1) are NOT on the critical path to a
  zero-error festival.** The lean critical path = planner slotting + oriented extents +
  arch relocation + registry backstop, with ONE deliberate POI-golden move. This collapses
  the riskiest, largest, most-invisible work (the ~8-builder extraction the council flagged)
  OUT of the layout fix. Raised -> Q1 for Gary: lean path now (defer extraction + crowd
  pre-roll to a follow-up) vs the full original scope. Also: the planner rewrite is the
  repo's most consequential action (moves the golden, regenerates the flag-off world) and
  the change's final gate (task 7.3) is Gary's in-game playtest — a natural human checkpoint.
**Refs:** -> Q1, -> Task 0.5.1/0.5.2, festival.js:331/356-454, main.js:240/283, deliberations/001-initial/results.md (Tension 2)

### 2026-06-13 -- Change drafted (proposal/specs/design/tasks) via /opsx:ff
**Event:** phase-change
**What:** Artifacts authored from the DRAFTING-BRIEF, the harness baseline.md (106 error /
92 warn across 10 seeds; worst clip 7.5 m), and design D-C′. Two capabilities:
`festival-zone-grammar` (the slotting planner + placement rules, graded against the
baseline) and `builder-layout-extraction` (the pure layout/mesh split + crowd pre-roll +
env injection + registry backstop). Tasks sequence extraction (golden-frozen, 1 builder/
commit) → true extents → zone slotting (the single golden move) → backstop → burndown →
verify/judge. Next: the deliberation gate (signatures fire by design — determinism, boot
order, lifecycle), then /opsx:apply.
**Refs:** -> D1..D6, proposal.md, design.md, tasks.md, ../worldgen-layout-harness/design.md (D-C′), repo-root verification/baseline.md (the measuring stick — NOT under the harness folder)

### 2026-06-13 -- Deliberation 001-initial: 5 personas, all Proceed-with-mitigations; tasks revised
**Event:** decision + phase-change
**What:** Ran `/deliberate` (Tier 3 synthesis) with Adversary + Architect + Auditor +
Profiler + Pragmatist + Mediator (determinism/world-gen/major-refactor signature). All
five returned **Proceed with mitigations**; no blocks. (Aside: the council files all wrote
fine; the FIRST mediator invocation died on a session limit with 0 tokens — re-ran the
mediator alone against the 5 intact files, nothing regenerated.) The Mediator surfaced 9
tensions; results.md carries the full synthesis + a 17-row Risk Register (4 CRITICAL).
**Folded into tasks.md:**
  - **D7 — crowd pre-roll REORDERED ahead of the builder extraction** (old group 2 → new
    group 1). `crowd.spawn` draws a VARIABLE, tier-dependent count from the cluster rng
    (color-retry loop + zero-draw early-return at pool exhaustion, crowd.js:339), so the
    extraction's EMPTY-diff gate isn't tier-stable until crowd is hoisted. Profiler's nuance
    kept: make the LAYOUT/record stream tier-independent; the REALIZED NPC population stays
    capped by PERF.crowdMax (a per-frame CPU guard, not a draw guard).
  - **D8 — CRITICAL: baseline path was stale.** The gate artifacts live at REPO-ROOT
    `verification/`, not `openspec/changes/worldgen-layout-harness/verification/`. Task 0.1
    fixes every cite; 0.2 reproduces 106/92 bit-for-bit before any edit (STOP if it doesn't).
  - **D9 — new Group 0.5 scope spike** (Pragmatist Slice 0): the full 8-builder extraction
    may not be needed before layout wins (arch-placement is planner-only; analytic
    extents+slotting+backstop may zero the 4 error rules with only crowd pre-roll strictly
    required). Maps each error rule → minimum change before grinding.
  - **D10 — canary hardening FIRST in group 2**: the `kind@roundedX,roundedZ` key collides
    for co-located same-kind clusters (the tight-slotting regime) and silently under-reports;
    include clusterSeed/role + assert TRIANGLE count (catches a lost segment-count arg).
  - **D11 — drivable corridor is an explicit slotting RESERVATION** (path_node is in the
    linter's overlap-exclusion, so a clipping path is caught by NO error rule); path records
    carry no colliders; drivability = reservation + mesh-half backstop.
  - **D12 — promote the MODEL_DIMS drift guard from localhost console.warn → thrown
    node-selftest assertion** before extents go load-bearing (else a stale copy ships an
    in-game clip the linter, reading the same stale copy, reports as clean).
  - Plus: buildStage as an isolated 3–5× commit; buildCampVillageAt's layout half partial
    by construction (closestBuilding in the draw loop); per-builder userData.shared audit;
    boot the real game both flags/both tiers after EVERY chunks.js commit; clusterSeed keyed
    on a stable semantic index so zone-omit doesn't churn the golden; ?perf=mid in verify;
    D2 crowd commit is player-visible (own CHANGELOG entry).
**Refs:** -> deliberations/001-initial/results.md, tasks.md (revised groups 0–8 + 0.5), README.md


### 2026-06-14 -- Group 4 LANDED: zone slotter + arch relocation; the single POI golden move
**Event:** phase-change + decision
**What:** Rewrote `festival.js _computePlan` as the D14 single-pass priority zone slotter
(stage → vendor aisles → food courts → drum → potties → arch → bubble), each testing its
oriented `clusterShapes` against an accumulating `placed[]` via `clustersOverlap(+ZONE_MARGIN)`
and OMITTING on no-fit (dependents drop transactionally). Removed `resolveOverlaps`. Relocated
the arch to a planner `'arch'` descriptor + deleted `buildSpawnArch` (-> D15). Decisions -> D15/D16/D17.
**RESULTS (verified):**
  - **queryPoint golden FROZEN `eddf8e50`** (road/water existence untouched — D5 held).
  - **POI golden MOVED ONCE `4825fd0b → a0edfaea`** (the one deliberate move; -> Task 4.3).
    Single-engine round-trip + all window-invariance tests pass; only the pre-existing seed-0
    "road negative control" artifact fails (present on HEAD too — not a regression).
  - **Registry-mode `bin/lint` over the live seed-1234 spawn build: `overlap` 0, `water-clear` 0,
    `arch-placement` 0.** The slotter's headline win. Plan-mode delta vs HEAD (3 seeds, ±600):
    overlap warn **276 → 11**, water-clear 15 → 12.
  - **Game boots clean** at `?worldgen=1&perf=low` (agent-browser: started, world generated, NO
    console errors; festival renders — stage, vendor market along the road, drum circle by trees).
  - Mechanical guards green: `bin/check-importmaps`, `bin/check-model-dims`.
**STILL OPEN (group 5/6, both PRE-EXISTING):** `drum-in-trees` (1 — treeless-fallback feel call,
new Dangling Thread) and `booth-on-road` (6 — vendor booths drifting onto curved roads; the group-5
builder backstop / 4.5 corridor reservation). Tasks 4.4 (cosmetic spur/access path records) + 4.5
(corridor reservation) NOT implemented — folded toward group 5.
**Refs:** -> D15/D16/D17, Task 4.1/4.2/4.3/4.6, festival.js, tuning.js, main.js, chunks.js, selftest.js (golden record)

### 2026-06-14 -- Group 4 playtest round (Gary, seed 1234/1399551401/1390463068) — 8 fixes + 2 deferred
**Event:** decision + discovery
**What:** Gary playtested committed Group 4 (a338ed2) with the `K` marker tool and filed
8 layout/UX issues. Eight FIXED this session (-> D18): one-arch-only, arch ≥2 dancefloor,
arch always-places ladder, spawn-at-arch, drum-omit-if-treeless, courts-on-side-roads,
potty-past-parent-edge, camps-off-road-surface. Verified at plan level across all 3 seeds
(exactly 1 arch each @ 104/109/93 m; 0 potty-in-court-ring; 0 overlapping court pairs) and
in-game on Gary's seed 1399551401 (clean boot, 1 arch = 2 colliders). TWO items DEFERRED
(Gary: "you don't have to fix all these now, just document them") — see Dangling Threads.
POI golden moves a0edfaea → 49ec28fc; queryPoint golden frozen eddf8e50.
**Refs:** -> D18, festival.js, main.js, chunks.js, tuning.js, Dangling Threads (deferred 2)

### 2026-06-14 -- Group 5/6/7 partial: vendor backstop, 3-seed registry burndown, 3-tier boot
**Event:** phase-change + discovery
**What:** (7.1) All 3 perf tiers boot CLEAN (no shader/TypeError; 1 arch). (5.1) Added a
`closestBuilding` backstop to `buildVendorRowAt` (builder-only, goldens frozen). (6.1/6.3)
3-seed registry sample → `verification/burndown.md`: overlap/water/arch/drum = 0 on 2/3
seeds; the baseline's 5.8–7.5 m cluster clips are GONE (lone residual = a 1.1 m grazing
tent×arch on seed 1399551401's curved approach). (7.2) spawn-POV verified + Gary's
"face straight through the arch" refinement landed (a2e36e7).
**DISCOVERY:** the tent×arch grazing can't be fixed by a builder backstop — the streaming
game builds chunks in PROXIMITY order, not `out[]` order, so a booth's chunk may build
before the arch's. Tried arch-footprint-8 + arch-first splice; neither fixed it (reverted
both — goldens stay `49ec28fc`). Real fix = model the vendor-row curve in the planner OR
widen the arch's row-clearance. Logged in burndown.md as remaining group-6 work.
**REMAINING for a true zero-error burndown:** full 10-seed registry re-capture; water-clear
lake-hearts (biggest error class, pre-existing); booth-on-road linter refinement (booths
straddle the ±7 m corridor by design — false-positive); the 1.1 m tent×arch curve case.
**Refs:** -> Task 5.1/6.1/6.3/7.1/7.2, verification/burndown.md, chunks.js (vendor backstop)

### 2026-06-14 -- Playtest round 2 (Gary, seeds 1139472710/2718382314): tree fixes shipped + cross-hub finding
**Event:** decision + discovery
**What:** Marker UX fully fixed (own commits, not part of this change's golden): `K` now opens
a focused note modal (input.js editable-target guard + preventDefault so no stray "k"), with
copy-for-agent. THREE worldgen tree bugs FIXED + verified in-game (seed 1139472710):
(1) lakeside-ring trees on roads — `lakes.js` checked only camp distance; now tests every
arterial via `roadsInBounds` (cross-heart), v2-gated, fetched once (8→0 on-road at the marker,
two were dead-center 0.1 m). (2) cross-region road blindspot in `scatterWorldgenTrees` — was
`ctx.region.roads` (own heart only) → now `roadsInBounds`. (3) trees in the drum-circle seating
ring — drum registers footprint-0 `bench_ring`; new plan-side `drumClearingsNear` (load-order-
independent, like `dancefloorRectsNear`) carves the ~8 m envelope (trees inside 8 m: →0, 31 still
in the 8–30 m pocket). Both goldens unchanged (tree scatter rides its own rng stream).

**DISCOVERY (the big one) — cross-hub cluster overlap is a DENSITY-vs-REACH design tension, not a
quick bug.** Gary's court-clipping / drum-vs-stage / row-too-close pins are all CROSS-HUB: verified
two adjacent hearts' food courts land 11 m apart (heart (2,-2) vs (3,-2)) because `HEART_CELL=200`
but clusters reach ~190 m, so a court walked out from heart A nearly touches heart B. The slotter
packs per-heart only (no cross-hub view). **Tried + REVERTED** a "yield to senior neighbours"
keep-out (strict total order major>minor>cx>cz, acyclic via a non-recursive `basePlan`): it's
(a) ~8 s per `festivalPlan` — at 200 m spacing the 2×MAX_POI_REACH box holds ~162 hearts/~81
seniors × ~80 ms base-plan (nearestRoad-dominated) — would HANG chunk gen; AND (b) wrong at this
density — nearly every minor hub has a senior cluster in reach → would omit most courts/rows,
gutting the festival. Needs a Gary design call (hub-subset gate / road-half walk cap / batched
neighbourhood solver). Vendor-row-on-curved-road (seed 2718382314) is a separate curve-aware-
planner item. Both fully written up in ROADMAP "Playtest follow-ups."

### 2026-06-14 -- DESIGN-LOCK: Gary grill resolves the cross-hub tension → DENSE & SEAMED
**Event:** decision (phase-change — playtest band-aid burndown → principled seam grammar)
**What:** Gary asked to step back from "is the per-heart slotter + builder-side omission written
in stone?" A 5-question grill (AskUserQuestion) walked the decision tree top-down and locked the
direction the band-aid fixes were dancing around. Answers → -> D19–D23:
- World feel = **DENSE & SEAMED** (embrace the 200m/190m overlap as one continuous festival;
  rejected archipelago-spacing and rejected forever-patching). -> D19
- Seams = **context-dependent grammar** (commerce↔commerce → shared street; food+food → merged
  court; loud↔quiet → soft green buffer; + orientation-away). Promotes the band-aids
  (`neighbourCourtHere`, `stageDeckClips` drum-yield) into a principled planner layer. -> D20
- Determinism = **integer-only** (hub-priority hash + quantized positions + integer distance/SAT;
  no float gates existence — the `hearts.js` pattern). -> D21
- Arrival = **emergent at MAJOR hubs, probability-gated + varied, spawn-guaranteed hero** (revises
  D18's "exactly one arch"; resolves spawn-on-road vs face-the-stage — the approach road IS the
  sightline). -> D22
- Sequencing = **lock the design now, then build it** (this session). The "single golden move" (D6)
  becomes explicitly two: slotter (done) + seam grammar. -> D23
This phase-change RE-OPENS the cross-hub work as planned architecture, not a parked tension — the
"needs a Gary design call" from the prior entry is now ANSWERED. Next concrete action: build
Group 4B step 1 (integer `getHubPriority` + seam-pair enumeration, pure + golden-frozen).
**RISK GATE:** brushes determinism + golden + lifecycle; a `/deliberate` before the golden-move
commit is recommended (Gary's call) — the grill served as the design interrogation.
**Refs:** -> D19–D23, design.md D7/D8, tasks.md Group 4B, ROADMAP "Playtest follow-ups",
research/festival-layout-chatgpt-round3-deep-research.md (seam-typing), DRAFTING-BRIEF.md.
**Refs:** -> ROADMAP cross-hub + curved-row entries, lakes.js, chunks.js, festival.js (drumClearingsNear)

### 2026-06-15 -- 4B.1 + 4B.2 built; deliberation 002 settles the 4B.3 architecture
**Event:** decision + phase-change
**What:** Built + committed the golden-FROZEN seam foundation: 4B.1 `getHubPriority`+`seamPairsNear`
(`0bc68c1`) and 4B.2 `classifySeamsNear` (`3f5cf73`) — integer-only, order-independent, validated
against Gary's playtest pins (two food-court clashes → `merged_court`). Both goldens proven frozen
by the full `runSelfTest` (`eddf8e50`/`49ec28fc`).
Then ran a Tier-3 `/deliberate --debate` on 4B.3 (the golden-MOVING response) → -> D24. **Recovery
note:** Round-2 hit a transient subagent spend-limit; only the Adversary R2 survived (it had already
cross-examined all four other personas with citations + adjudicated the fork), so the Mediator
synthesized over 5 complete R1 + the Adversary R2. The spend block cleared by the Mediator run.
Outcome folded into tasks.md: split 4B.3 → **4B.0** (map-sandbox seam overlay, Slice 0) + **4B.3a**
(dark-emit + order-independence proof) + **4B.3b** (live yield→merge→trim→bare-buffer + cost
mitigation + integer hygiene) + **4B.3c** (band-aid removal behind superset-diff); refined 4B.5
(inverted golden gate) + 4B.6; added **4B.7** (soft_buffer geometry + stage↔camp = non-golden
fast-follow). The 7 non-negotiables are the done-criteria. Next concrete action: 4B.0 (the iteration
surface) then 4B.3a (dark-emit). **Determinism caveat banked:** any stall mitigation must be
bit-identical (N7); `_computePlan` must NEVER call a neighbour's plan (N1).
**Refs:** -> D24, deliberations/002-seam-response/results.md, tasks 4B.0/4B.3a/b/c/4B.5/4B.6/4B.7,
festival.js (seam helpers), git 0bc68c1/3f5cf73.

### 2026-06-15 -- Cold stall resolved: per-cell arterialsNear cache (#1 perf item, pulled forward)
**Event:** discovery + decision
**What:** The seamed-plan cold stall had become a tooling blocker (`bin/lint` >40s/seed stalled the
Group 6 burndown), so I pulled the #1 perf-pass item forward. Measured first (per RTK protocol):
the base-plan cost was `nearestRoad`, and crucially NOT its `arterial()` polyline math (already
cached) but the per-call neighbourhood-graph re-walk (`neighborsOf`+`edgeKey` Set-dedup over a
(2·window+1)² cell block). `arterialsNear` is a pure function of the *cell* the point sits in — qx/qz
only derive `ccx,ccz` — so I cached it per cell `(ccx,ccz,window)`, gated `(seed,epoch)` like the
existing `_arterialCache`. Golden-preserving by construction; verified bit-identical (queryPoint
`eddf8e50`, POI `c1920e52`). nearestRoad grid 15.3× faster, cold 79-hub plan sweep 10.6× faster;
cold stall ~13s→~1–2s, lint >40s→~10s/seed. The selftest's one failure (`road negative control seed
0 — lacks teeth`) is PRE-EXISTING (a coverage quirk of seed 0's road geometry over the fixed sample
grid; my cache keys window=1 and window=R separately and returns identical values, proven by the
frozen golden) — not a regression. -> D26, CHANGELOG 2026-06-15, PERF-FEEL-NOTES.md.
**Refs:** roads.js (`_arterialsNearCache`), src/worldgen/selftest.js (T5), bin/lint.
