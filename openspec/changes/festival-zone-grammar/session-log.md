---
change: festival-zone-grammar
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: "Group 4 + a PLAYTEST-FIX round landed (D18: one-arch-only at spawn hub, arch ≥2 dancefloor + always-places ladder, spawn-at-arch, drum-omit-if-treeless, courts-on-side-roads, potty-past-edge, camps-off-road). POI golden moved again a0edfaea→(selftest.js); queryPoint frozen eddf8e50; clean boot seed 1399551401. RESUME → Group 5 (builder backstop: booth-on-road + the DEFERRED tree-through-truck) + Group 6 (re-baseline vs group-3 linter, burndown to 0 across 10 seeds). DEFERRED dev-workflow: marker-UI typing modal (K opens a focused modal). Then Group 7 (3-tier boot + Gary 7.3 playtest — HUMAN GATE) + smart-review."
blocked_by: ""
open_questions: 0
started: 2026-06-13
last_updated: 2026-06-14
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
