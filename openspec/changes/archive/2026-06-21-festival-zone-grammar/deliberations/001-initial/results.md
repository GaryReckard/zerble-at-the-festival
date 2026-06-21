# Deliberation Summary — festival-zone-grammar

## Context
-   **Task**: Resolve the procedural festival "jumbled mess" by replacing
    scatter-then-`resolveOverlaps` (points + scalar clear-radii that the oriented
    builders exceed) with a pure `layout(rng,env)→records[]` / `buildMesh(records)`
    split, true oriented extents, and priority zone-slotting on the front axis —
    driving every error-severity linter rule to 0 across the 10 baseline seeds
    while the POI determinism golden moves exactly once. `DEFAULT_WORLDGEN_V2`
    stays flag-OFF.
-   **Personas Consulted**: Adversary, Architect, Auditor, Profiler, Pragmatist
    + Mediator
-   **Mode**: Synthesis (no Round 2 — tensions surfaced by the Mediator)
-   **Date**: 2026-06-13

All five personas returned **Proceed with mitigations**. No persona blocked. The
plan is unusually well-armored (the harness already shipped the gate: snapshot
diff + per-cluster draw-count canary + linter + baseline). The synthesis below
folds their mitigations into a re-sequenced task order and a risk register.

---

## Convergence Points

All five personas independently agreed on the following — treat these as settled:

1.  **Group 0 (reproduce the baseline) is a hard precondition, and the documented
    path is stale.** The "before" must reproduce bit-for-bit or every EMPTY-diff
    claim downstream is unfalsifiable. Adversary, Auditor, and Pragmatist all hit
    the path issue: the baseline + snapshots live at **repo-root
    `verification/baseline.md` + `verification/snapshots/baseline/*.json`**, NOT
    under `openspec/changes/worldgen-layout-harness/verification/`. Auditor and
    Pragmatist confirmed the artifacts exist and reproduce (Auditor: all 10
    snapshots carry `drawCounts`; Pragmatist: seed 1234 = 10 err/8 warn, seed 42 =
    4 err/1 warn live). Adversary, searching only `openspec/`, concluded they were
    missing — which is itself proof the stale path will mislead a future agent.

2.  **Crowd pre-roll (D2/group 2) must land BEFORE the builder extraction it
    gates** — or at minimum before any builder whose `layout` half pre-rolls crowd
    params. Four personas (Adversary, Architect, Auditor, Pragmatist) said this
    explicitly; Profiler supplied the mechanism. `crowd.spawn` draws a *variable,
    tier-dependent* count of `rng()` from the cluster stream and early-returns with
    **zero draws** when the pool (`PERF.crowdMax` = 180/320/500) is exhausted
    (`crowd.js:339`). Until that draw is hoisted into layout records, every
    snapshot is only valid at the pinned tier and the canary sees different
    per-cluster counts at low vs high.

3.  **The POI golden moves exactly ONCE**, at the slotting commit (group 4),
    re-recorded with node==browser re-verify; the queryPoint golden stays frozen;
    every other commit is EMPTY-diff-gated. Unanimous. Auditor graded it PASS.

4.  **Spur roads + drum access paths as cosmetic path records (NOT arterials in
    `roads.js`) is the correct seam.** Architect endorsed it strongly against the
    queryPoint contract; Adversary verified `queryPoint` is driven by `roads.js`
    and `festival.js` only reads it, so records that never flow into `roads.js`
    leave the road golden untouched.

5.  **Registry-clearance backstop (D5) belongs in the `buildMesh` (impure) half,
    never in the pure `layout` half.** Unanimous. The leaf rule (`src/worldgen/*`
    must not import chunks/registry/lakes/models) depends on it.

6.  **`?perf=mid` must be added to verification.** Profiler flagged that task 7.1
    names only low+high, but mid is where `crowdMax` jumps to 320 AND shadows turn
    on — the tier most sensitive to the crowd change.

7.  **Boot the real game (sandbox-pass ≠ game-pass) is a gate after every
    `chunks.js`-touching commit, not only at the end.** Adversary made this the
    sharpest: the layout/mesh split gives every builder TWO entry shapes
    (records → mesh), exactly the camp-chair signature that crashed world-gen.

---

## Key Tensions Surfaced & Resolved

### Tension 1 — Sequencing: crowd pre-roll (group 2) vs. builder extraction (group 1)
**Positions.** `tasks.md` orders extraction (group 1, incl. `buildStage` at 1.4)
*before* crowd (group 2, at 2.1). Adversary: as written, 1.4 "diff EMPTY incl.
canary" and 2.1 "tier-dependence gone" are **mutually exclusive in that order** —
`buildStage` contains a `crowd.spawn` call (`chunks.js:2466`) whose variable draw
count rides the cluster stream. Architect, Auditor, Pragmatist concur.
Profiler adds the load-bearing nuance.

**Resolution (RESOLVED — REORDER).** Land crowd pre-roll **first**, before group 1.
This is a tripwire-grade resolution (determinism is non-negotiable): you cannot
EMPTY-diff-gate a builder that contains a variable-draw `crowd.spawn` while that
spawn still feeds the cluster stream. **BUT** apply Profiler's distinction as a
hard constraint on the fix: make the *layout/record stream* tier-independent
WITHOUT making the *realized NPC population* tier-independent. The records may
carry the full high-tier roster; `crowd.spawn` must still honor `free.length===0`
and drop the surplus at low/mid, because `PERF.crowdMax` is a steady-state
per-frame CPU guard (`_updateNpc` runs every NPC every frame), not a draw guard.
Task 2.1's "IDENTICAL normalized layout" means the **plan/record layout, not the
live crowd population**. → Tasks reordered: old group 2 becomes new Group 1.

### Tension 2 — Is the full 8-builder extraction needed before any layout win? (Pragmatist's spike)
**Positions.** Pragmatist alone argues the largest, riskiest block (groups 1–2,
~8 behaviour-preserving builder splits) ships *zero* visible change and *zero*
burndown progress, all upfront. Reproduced lint counts + harness D-C′ ("the
planner needs true extents on day one, which the **analytic** helpers provide
*without* per-record data") suggest the four error rules (`water-clear` 58,
`overlap` 48, `arch-placement` 21, `drum-in-trees` 8) are drivable to zero by
**analytic extents (D3) + slotting (D4) + backstop (D5)** — with the full
per-record extraction strictly required only for crowd tier-stability (D2) and for
the *warns*. The other four personas implicitly assume the full extraction
proceeds as written.

**Resolution (RESOLVED — ADOPT the Slice 0 spike, scoped).** Insert a ~1-day
extraction-scope triage spike BEFORE the bulk extraction. This does not violate
any tripwire and directly serves "verifiability over speed" + "perceivable impact
over effort" (resolution hierarchy 3 + 4): it front-loads the Gary-visible win and
avoids speculatively grinding the repo's riskiest refactor class. Deliverable: a
table mapping each error rule → the minimum builder/planner change that zeroes it.
**Guardrail:** the spike does NOT license skipping crowd pre-roll (Tension 1 —
still strictly required before the golden move) or skipping the extraction of any
builder that *contains a crowd spawn or feeds a consumed record*. Builders whose
only payoff is a *warn* (`booth-on-road`, `dancefloor-clear`, `potty-attached`)
may be deferred to a cleanup slice after the error rules hit zero. → New Group 0.5.

### Tension 3 — Draw-count canary key weakness + missing triangle assertion
**Positions.** Auditor: the canary key `kind@roundedX,roundedZ`
(`chunks.js:1226`) **collides** for two same-kind clusters that quantize to the
same rounded meter — far more likely once *slotting packs zones tightly* — and
silently under-reports. Profiler (independently): the canary must also assert
**triangle count**, because a `pickParams`/`buildMesh` split can re-create a
geometry with a drifted segment default (e.g. `CylinderGeometry(r,r,h,8)` losing
its `8`) — positions identical, tris balloon, the position-only diff passes.
Auditor adds a third: the canary tallies per-cluster *totals*, so a same-count
intra-cluster reorder passes the canary yet could shift a downstream model variant.

**Resolution (RESOLVED — HARDEN the canary in Group 1, before relying on it).**
Both fixes land together as the first sub-task of the extraction group, BEFORE any
builder is split: (a) make the canary key unique-per-cluster (include
`clusterSeed` or `role`/`rank`); (b) have the canary assert triangle count as well
as draws + positions. For Auditor's third (same-count intra-cluster reorder), the
R19 design bounds the blast radius to *within* one cluster (model variation rides
`clusterSeed`, not `ctx.rng`), so the residual is acceptable — but record the
explicit rule: **intra-cluster draw ORDER is held by per-commit code review, not
the canary.** → New Task in Group 2 (front of extraction).

### Tension 4 — Drum access path / spur records are unprotected by any error-severity rule
**Positions.** Adversary: the lint `overlap` rule excludes `SCENERY_KINDS`, which
already contains `'path_node'` (`lint.js:295`). Spur/access records emitted as a
`path_node`-family kind are invisible to `overlap` — so a drum access path the
planner *believes* is drivable can clip a tent and nothing flags it. The D4.4
"wide enough to drive in" claim is **unverified by any error-severity rule**.
Architect (independently): the drivability guarantee must come from the planner
reserving the path corridor in its own oriented-extent overlap test (no zone slots
onto the path) + the mesh-half backstop — make that reservation **explicit** in
the slotting algorithm "or the drivable access path becomes a path with a tent in
it." Adversary's open question: do path records carry colliders (then they ARE
layout and need an extent check) or not (then nothing guarantees drivability)?

**Resolution (RESOLVED — EXPLICIT corridor reservation + decide collider status).**
Make the drum access path / spur corridor an explicit **slotting reservation**: a
pure oriented-extent the zone-fit test treats as occupied, so no zone slots onto
it. Decide explicitly (and record in session-log): path records do **not** carry
colliders (they are cosmetic ground ribbons), and the drivability guarantee comes
from (1) the planner's corridor reservation in the extent overlap test + (2) the
mesh-half registry backstop. If a future need makes them carry colliders, they
become layout and require their own extent check + an error-severity clearance
rule. → New sub-task in Group 5 (slotting).

### Tension 5 — MODEL_DIMS drift guard is a localhost `console.warn`, not enforced
**Positions.** Architect: D3 claims "plan extent == built extent by construction"
because both read `FESTIVAL_TUNING`, but the actual sync guard `assertTuningDrift`
(`chunks.js:1183-1203`) is one-shot, localhost-gated, and only `console.warn`s on
four `MODEL_DIMS` copies. When oriented extents go **load-bearing** (consumed by
*placement* in group 4, not just the linter overlay), a stale `MODEL_DIMS` copy no
longer produces a cosmetically-off overlay — it produces a hub that **clips in the
running game while the linter (reading the same stale copy) reports clean.** The
guard's failure mode upgrades from "lint inaccuracy" to "shipped clip the gate
can't see." No other persona caught this.

**Resolution (RESOLVED — PROMOTE to a thrown node-selftest assertion).** When an
extent moves from advisory (linter) to load-bearing (slotting), promote the
corresponding `MODEL_DIMS` drift check from `console.warn` to a **thrown assertion
in the node linter's selftest** (node has no localhost gate to dodge), and add a
`MODEL_DIMS` entry for every model dimension a new oriented extent depends on (the
stage wedge will likely need deck dimensions not currently copied). → New sub-task
in Group 4 (extents), gating Group 5.

### Tension 6 — buildStage is the single hardest commit; buildCampVillageAt's layout half is only partially pure
**Positions.** Adversary, Auditor, Pragmatist all flag `buildStage` as the trap
commit: it **interleaves** `Math.random()` cosmetic jitter (`chunks.js:2463-2464`,
must stay `Math.random()` per D-C′) with `ctx.crowd.spawn` (`:2466`, variable
draws) and `ctx.rng()` clump count (`:2489`) in the same loop. Pragmatist budgets
it at **3–5× the vendor row**. Separately, Pragmatist: `buildCampVillageAt`
(`:1509`) has `registry.closestBuilding` INSIDE the draw loop — its layout half
"stays approximate by construction," so a pure `layout(rng,env)→records` for camps
is **not fully achievable**; anyone expecting a clean pure function will burn time
fighting an unwinnable abstraction.

**Resolution (RESOLVED — ISOLATE + SET EXPECTATIONS).** `buildStage` gets its own
isolated commit (never batched with another builder), budgeted 3–5× normal, with
an explicit before/after **draw-count table** documenting the three interleaved
streams. The crowd-pre-roll-first ordering (Tension 1) is what makes this
survivable — once the cluster stream no longer feeds `crowd.spawn`, the stage
split partitions only `Math.random()` (stays in mesh) vs `ctx.rng()` (moves to
layout). For `buildCampVillageAt`: record that its split is **partial** — the
records can't predict which tents the live registry rejects, so the
`closestBuilding` clearance stays in the mesh half (D5) and the camp layout half
is "approximate by construction." Set that expectation in the task note now. →
Task notes in Group 2.

### Tension 7 — D2 tier-fix is player-visible; CHANGELOG severity
**Positions.** Auditor: the extraction commits are behaviour-preserving (EMPTY
diff) — the genuine "internal refactor, may skip changelog" case. **But D2 (crowd
pre-roll) closes the tier-dependence**, which IS observable: shipped low/mid worlds
change to agree with high. That player-visible change is hiding inside an
"extraction" group and warrants its own CHANGELOG entry (`Fixed: crowd layout no
longer differs by perf tier`), not the silent-refactor exemption.

**Resolution (RESOLVED — D2 gets its own CHANGELOG entry).** Per
`.claude/rules/changelog-and-roadmap.md` ("when in doubt, write the entry"; perf +
mobile + dev-workflow all trigger). Task 8.1 must call out the crowd-pre-roll
commit specifically as the one extraction-group commit that is player-visible. The
golden-move commit (group 4) is the other required entry. → Refines Task 8.1.

### Tension 8 — POI hash re-verify proves cross-engine stability, not behavioural superset
**Positions.** Adversary: the golden re-record (4.2) with node==browser only
proves the *new* planner is cross-engine stable; it does NOT prove the new planner
is a superset/subset of the old behaviour. There is no automated check that the
golden move didn't *also* silently change which hubs get a drum circle vs. omit
one (the old planner had data-dependent draw counts — `treedDistrictSpot` loops up
to 12×, `nudgeOff` early-returns with 0 draws). Architect's adjacent concern:
zone-omit changes descriptor-list length, so `clusterSeed` must stay keyed on a
**stable semantic index** (stage=0, court i, row i…), independent of which earlier
zones were omitted, or the golden churns far beyond the one deliberate move.

**Resolution (RESOLVED — capture a POI inventory + freeze the seed keying).** The
4.2 re-record must capture a per-seed **POI kind inventory** (kind counts per
hub), not just the hash, so "it changed deliberately" is auditable beyond "the
hash changed." AND the slotting rewrite must keep `clusterSeed(heart, idx)` keyed
on a stable per-zone semantic index, not output-array position — the same
invariant `resolveOverlaps` was built to protect (it never touches
`clusterSeed`/`idx`). → Refines Task 4.2; new invariant note in Group 5.

### Tension 9 — Zone-omit can orphan dependents; backstop disposal-tagging survives the split
**Positions.** Adversary (Low): zone-omit graceful degradation can leave a "potty
attached to nothing" if a parent vendor row omits but its attached potty bank
doesn't drop transactionally — the `potty-attached` *warn* catches it after the
fact, but slotting should drop dependents transactionally. Adversary (Medium),
echoed by Auditor's PASS-with-watch: the layout/mesh split risks a refactor
hoisting a per-record helper that creates a NEW pooled material/geometry nobody
tags `userData.shared = true` → first chunk unload disposes it → silent shader
recompile storm (~200ms periodic stalls, NOT a crash, NOT caught by the canary).

**Resolution (RESOLVED — transactional omit + per-builder shared-tag audit).**
Slotting drops a zone's dependents (attached potties, camps-behind) transactionally
with the parent, not relying on the linter to notice the orphan. AND add an
explicit per-builder `userData.shared` audit to the extraction group: enumerate the
pooled resources each builder touches and confirm the tag stays on the `buildMesh`
side and survives the split (a tag migrating into the pure `layout` half is dead —
no three.js there — and the resource reverts to per-call alloc + dispose storm).
→ New sub-tasks in Group 2 and Group 5.

---

## Synthesized Plan — Change Groups

> These **refine the existing `../tasks.md`**. The macro-phase order (0→8) is
> mostly preserved; the load-bearing change is **promoting crowd pre-roll (old
> group 2) ahead of the builder extraction (old group 1)** and inserting a Slice-0
> scope spike. Mapping to old task numbers is noted per group.

### Change Group 0: Preconditions — make the gate real
**Scope**: Reproduce the baseline; fix the stale path.
**Estimated Effort**: < 1 day.
**Tasks** (refines old 0.1–0.2):
1.  **Fix the gate-artifact path in task 0.1**: cite the real repo-root
    `verification/baseline.md` + `verification/snapshots/baseline/*.json` (commit
    `ecbd9af`), NOT `openspec/changes/worldgen-layout-harness/verification/`. (Tension /
    Convergence 1.)
2.  Reproduce the baseline **bit-for-bit**: `bin/lint
    verification/snapshots/baseline/<seed>.json` matches the recorded 106 err /
    92 warn. If it does not reproduce, **STOP** — the measuring stick is broken.
3.  Pin the capture protocol (`?worldgen=1&perf=high`, crowd on, no driving) — old 0.2.

### Change Group 0.5: Extraction-scope spike (NEW — Pragmatist Slice 0)
**Scope**: Decide which builders are on the critical path to zero-error vs. warn-only.
**Estimated Effort**: ~1 day, ships nothing.
**Tasks** (NEW):
1.  Map each error rule (`water-clear` 58, `overlap` 48, `arch-placement` 21,
    `drum-in-trees` 8) → the minimum builder/planner change that zeroes it,
    reviewed against reproduced `bin/lint` counts.
2.  Confirm the split set: crowd pre-roll (mandatory), every builder that contains
    a crowd spawn or feeds a consumed record (mandatory), warn-only builders
    (deferrable to a cleanup slice). (Tension 2.)

### Change Group 1: Crowd pre-roll + injected env (was group 2 — REORDERED to FIRST)
**Scope**: Hoist the variable, tier-dependent `crowd.spawn` draw out of the cluster
stream into pre-rolled layout records, so the extraction's EMPTY-diff gate is
tier-stable.
**Estimated Effort**: ~1–2 days (Pragmatist: bounded, well-understood — `spawn()`
at `crowd.js:338` + 4 call sites `chunks.js:1698,1706,2466,2723`).
**Tasks** (refines old 2.1–2.2):
1.  `crowd.spawn` consumes pre-rolled params (count + per-NPC **scalar** seeds, NOT
    pre-built `Vector3`/`Color` — avoid GC pressure at hub-spawn) from layout
    records instead of drawing from the cluster rng with a tier-sized pool.
2.  **Critical constraint (Profiler)**: the *layout/record stream* is
    tier-independent; the *realized NPC population* stays capped by
    `PERF.crowdMax` (180/320/500). `crowd.spawn` still honors `free.length===0` and
    drops the surplus at low/mid. Task 2.1's "IDENTICAL normalized layout" = the
    **plan**, not the live crowd. done = same seed/hub at `?perf=low` and
    `?perf=high` yields identical normalized layout AND live NPC count still capped
    at low.
3.  Widen the dry-run env to `{waterAt, blockedAt}`; grep-confirm no
    `src/worldgen/*` imports chunks/registry/lakes/models (old 2.2).
4.  **D2 is player-visible** — its commit gets a CHANGELOG `Fixed` entry (Tension 7).

### Change Group 2: Builder layout/mesh extraction (was group 1 — now SECOND)
**Scope**: Behaviour-preserving `layout(rng,env)→records` / `buildMesh(records)`
split, one builder per commit, EMPTY-diff-gated incl. the (hardened) canary.
**Estimated Effort**: variable; `buildStage` is 3–5× the others.
**Tasks** (refines old 1.1–1.6, with new front-matter):
1.  **NEW (do FIRST, before any builder split): harden the draw-count canary.**
    (a) make the key unique-per-cluster — include `clusterSeed`/`role`/`rank`, not
    `kind@roundedX,roundedZ` (Auditor — collides under tight slotting); (b) assert
    **triangle count** as well as draws + positions (Profiler — catches geometry
    segment drift). Record that intra-cluster draw ORDER is held by per-commit code
    review. (Tension 3.)
2.  Extract easy→hard, scoped by Group 0.5: `buildVendorRowAt` → `buildFoodCourtAt`
    → `buildCampVillageAt` → `buildStage` → small builders → model param splits.
3.  `buildCampVillageAt`: **partial split** — `closestBuilding` stays in mesh half;
    layout half is approximate by construction. Set expectation in the task note
    (Tension 6).
4.  `buildStage`: **isolated commit, budgeted 3–5×**, with an explicit before/after
    draw-count table for the three interleaved streams (`Math.random()` stays mesh,
    `ctx.rng()` moves to layout, crowd draws already gone via Group 1). (Tension 6.)
5.  **NEW: per-builder `userData.shared` audit** — enumerate pooled
    resources per builder; confirm the tag stays on the `buildMesh` side and
    survives the split. The canary will NOT catch a disposal-time recompile storm.
    (Tension 9.)
6.  **GATE: boot the real game at both flags / both tiers after every
    `chunks.js`-touching commit** (Adversary — sandbox-pass ≠ game-pass; two-entry-
    shape split is the camp-chair signature).

### Change Group 3: True oriented extents (was group 3 — READ-ONLY) + drift guard
**Scope**: Promote `clusterExtent` → per-kind oriented shapes; extents read-only
until slotting consumes them (goldens frozen).
**Estimated Effort**: ~1–2 days (Pragmatist: analytic helpers may suffice without
full per-record data — force multiplier: makes plan-mode lint shape-accurate so
burndown iterates in seconds).
**Tasks** (refines old 3.1–3.2):
1.  Court = ring, vendor row = oriented rect (incl. camps-behind band), stage =
    directional wedge (deck + dancefloor). Unify the D8 dancefloor pair — and
    **(Auditor) the merge must be value-preserving in group 3** (any group-3 diff
    falsifies the "same number" claim).
2.  Point the linter plan-mode + map overlay at the oriented extents. No game-path change.
3.  **NEW (Architect — Tension 5): promote the `MODEL_DIMS` drift guard from
    localhost `console.warn` to a thrown node-selftest assertion** before extents go
    load-bearing in group 4; add `MODEL_DIMS` entries for every model dimension the
    new oriented extents depend on (stage wedge likely needs deck dimensions).

### Change Group 4: Zone-slotting planner — THE GOLDEN MOVE (group 4)
**Scope**: Replace scatter+`resolveOverlaps` with priority slotting; the POI golden
moves exactly once. **Nothing else in the golden-move commit.**
**Estimated Effort**: the keystone commit; iterate in the hub viewer.
**Tasks** (refines old 4.1–4.4):
1.  Priority slotting on front axis F; omit a zone that can't fit clear; **drop a
    zone's dependents (attached potties, camps-behind) transactionally** with the
    parent (Tension 9).
2.  **Keep `clusterSeed(heart, idx)` keyed on a stable semantic index** (stage=0,
    court i, row i…), independent of which zones were omitted (Architect — Tension 8).
3.  Move the POI golden once; re-record; node==browser re-verify; **capture a
    per-seed POI kind inventory, not just the hash** (Adversary — Tension 8);
    queryPoint golden stays frozen.
4.  Spur roads + drum access paths as cosmetic path records (NOT roads.js). Render
    as **ONE merged/instanced opaque ribbon per hub, `castShadow=false`, alphaTest
    not transparent** (Profiler) — not one mesh per segment. Tag pooled geometry
    `userData.shared`.
5.  **NEW (Adversary + Architect — Tension 4): make the drum access / spur corridor
    an explicit slotting reservation** (a pure oriented-extent the zone-fit test
    treats as occupied). Decide + record: path records carry NO colliders;
    drivability = corridor reservation + mesh-half backstop.
6.  Cross-hub `stage-spacing` constraint; tuning constants in `FESTIVAL_TUNING`.

### Change Group 5: Registry-clearance backstop (group 5)
**Scope**: Restore per-sub-component `registry.closestBuilding()` with bounded
retry/skip in the **mesh half** of each builder.
**Estimated Effort**: ~1 day (Profiler: within precedent — pattern already at
`chunks.js:489`, `2718`).
**Tasks** (refines old 5.1):
1.  Restore the clearance in `buildMesh` for every builder placing sub-components
    blind (vendor row, food court, camp village, potty bank); **bounded** retry (no
    spiral). Confirm it never leaks into the pure `layout` half (leaf rule).
2.  Confirm the hub-viewer path (`buildHubPreview`) stays diff-faithful (shared
    `buildWorldgenKind` reaches both — correct architecture).

### Change Group 6: Baseline burndown to zero (group 6)
**Scope**: Drive every error rule → 0 across 10 seeds; per-rule sequenced
(Pragmatist: arch → overlap → drum → water → backstop, each a falling count against
the now-frozen golden).
**Tasks** (old 6.1–6.3): lint 10 seeds in registry mode; re-confirm the 4 named
worst offenders at their coords; write `verification/burndown.md` (before/after
per-rule table + 3 hub-viewer screenshots).

### Change Group 7: Verify + judge (group 7)
**Scope**: Real-game boot, arrival check, Gary playtest, smart-review.
**Tasks** (refines old 7.1–7.4):
1.  Boot the real game at seed 1234, `?worldgen=1`, **`?perf=low`, `?perf=mid`,
    AND `?perf=high`** (Profiler — 7.1 currently names only low+high). Backtick
    panel within tier, on the **densest everything-fits hub**, not an average one.
    Confirm path-record meshes default `castShadow=false`; live NPC count capped at
    low.
2.  Arrival check (arch on road, stage beyond). 3.  Gary playtest with marker
    hotkey. 4.  `/smart-review`; fold must-fix back into tasks.

### Change Group 8: Close (group 8)
**Scope**: CHANGELOG, ROADMAP, session-log.
**Tasks** (refines old 8.1–8.3):
1.  CHANGELOG per-commit; **call out the crowd-pre-roll (Group 1) commit
    specifically as the player-visible one** (Auditor — Tension 7), plus the
    golden-move commit. Behaviour-preserving extraction commits may take the
    internal/dev-workflow exemption.
2.  ROADMAP "Festival layout" trimmed; defer per-truck customization + the
    `DEFAULT_WORLDGEN_V2` flip (separate later change — flag stays OFF).
3.  Session-log close-out; `bin/readme-sync`.

---

## Risk Register

| Risk | Severity | Mitigation | Owner |
| ---- | -------- | ---------- | ----- |
| Crowd's variable cluster-rng draw count makes 1.4/2.1 mutually exclusive in `tasks.md` order — silent desync | **CRITICAL** | Land crowd pre-roll FIRST (new Group 1); layout tier-independent, population still `crowdMax`-capped | Adversary, Architect, Auditor, Profiler, Pragmatist |
| Baseline path stale (`openspec/.../verification/` vs repo-root `verification/`) → future agent concludes gate missing, skips it | **CRITICAL** | Fix task 0.1 path; reproduce 106/92 bit-for-bit before any edit; STOP if it doesn't reproduce | Adversary, Auditor, Pragmatist |
| Sandbox-pass / game-crash: two-entry-shape (records→mesh) split, camp-chair signature, boot-time `TypeError` hangs title card | **CRITICAL** | Boot real game both flags/both tiers after EVERY `chunks.js`-touching commit, not just group 7 | Adversary |
| `MODEL_DIMS` drift guard is localhost `console.warn` — once extents are load-bearing, a stale copy ships a clip the linter can't see | **CRITICAL** | Promote to a thrown node-selftest assertion; add `MODEL_DIMS` entries for new oriented-extent dims | Architect |
| `registry.closestBuilding()` leaks into the pure `layout` half → breaks leaf rule, makes `layout` load-order-dependent, kills headless linter | High | Keep `closestBuilding` strictly in `buildMesh`; planner clearance uses only `env`+pure extents; grep as a hard gate (groups 1+4) | Architect, Auditor |
| `buildStage` interleaves `Math.random()` + `ctx.rng()` + crowd draws — get the partition wrong by one and a human must reason about 3 streams | High | Isolated commit, 3–5× budget, explicit before/after draw-count table; crowd-first ordering removes one stream | Adversary, Pragmatist |
| Canary key `kind@roundedX,roundedZ` collides under tight slotting → silent under-report | Medium | Harden key (include `clusterSeed`/`role`) in Group 2 before relying on it | Auditor |
| Extraction silently drifts a geometry segment count (tris balloon, positions identical, position-only diff passes) | Medium | Canary asserts triangle count too | Profiler |
| Drum access / spur path "drivable" claim unverified by any error rule; `path_node` is overlap-excluded → can clip a tent | Medium | Explicit corridor reservation in slotting; path records carry NO colliders | Adversary, Architect |
| Golden re-record proves cross-engine stability, not behavioural superset — drum-circle inventory could silently change | Medium | Capture per-seed POI kind inventory, not just the hash | Adversary |
| Spur/drum path records allocate one mesh per segment → draw creep on dense hubs at low (80-draw budget) | Medium | One merged/instanced opaque no-shadow ribbon per hub; tag pooled geo `userData.shared` | Profiler |
| Refactor hoists a per-record helper that creates an UNtagged pooled material/geo → first unload disposes it → silent ~200ms recompile-storm stalls | Medium | Per-builder `userData.shared` audit in the split (canary can't see disposal-time bugs) | Adversary, Auditor |
| Pre-rolling tier-independent params spawns tier-independent NPC counts → low tier regresses on `_updateNpc` per-frame cost | Medium | `crowd.spawn` still honors `free.length===0`; `crowdMax` stays the hard spawn cap; verify live count at `?perf=low` | Profiler |
| `clusterSeed` keyed by output-array position instead of semantic idx → zone-omit churns the golden beyond the one move | Medium | Keep `clusterSeed(heart, idx)` keyed on stable semantic index | Architect |
| D2 tier-fix (player-visible) hidden under the silent-refactor changelog exemption | Low | Its own CHANGELOG `Fixed` entry | Auditor |
| Zone-omit orphans a dependent (potty attached to an omitted parent) | Low | Drop dependents transactionally in slotting, not via the linter after the fact | Adversary |
| Verification names only low+high; mid (crowdMax 320 + shadows on) is most crowd-sensitive | Low | Add `?perf=mid` to task 7.1; screenshot the densest everything-fits hub | Profiler |
| `booth-on-road` rule refinement (a warn) is self-grading if changed mid-change (the linter grades this change) | Low | Treat as amending the executable spec with golden-move ceremony; re-baseline + log; or park it (it's a warn) | Architect, Pragmatist |

---

## Verdicts Summary

| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Adversary | Crowd's variable cluster-rng draw count makes 1.4 + 2.1 mutually exclusive in listed order; baseline not reproducible from `openspec/` | Proceed with mitigations |
| Architect | The `layout`/`buildMesh` boundary is the load-bearing wall — `closestBuilding` must stay impure in `buildMesh`, planner clearance via injected env + pure extents only | Proceed with mitigations |
| Auditor | Canary key (`kind@roundedX,roundedZ`) collides for co-located same-kind clusters and silently under-reports — the exact regime slotting creates | Proceed with mitigations |
| Profiler | Crowd pre-roll must make the *layout* tier-independent WITHOUT making the *realized NPC population* tier-independent — `crowdMax` stays the per-frame CPU guard | Proceed with mitigations |
| Pragmatist | The plan front-loads its largest, riskiest, INVISIBLE work; a 1-day spike likely shows analytic extents + slotting + backstop zero the 4 error rules with only crowd pre-roll strictly required | Proceed with mitigations |

---

## Final Recommendation

**Proceed to `/opsx:apply` with the revised task order.** All five personas
converged on Proceed-with-mitigations, the gate is real and on disk, and every
surfaced tension has a concrete, non-conflicting resolution. The two non-negotiable
re-sequencings are: **(1) crowd pre-roll moves ahead of the builder extraction**
(determinism tripwire — the EMPTY-diff gate is invalid otherwise), and **(2) insert
the Group-0.5 scope spike** so the riskiest refactor isn't done speculatively. Fix
the stale baseline path and reproduce 106/92 before touching code.

## Next Step

**Proceed to `/opsx:apply`** with the revised group order (0 → 0.5 → crowd → extraction
→ extents → golden move → backstop → burndown → verify → close). Fold these refinements
into `tasks.md` first: reorder crowd ahead of extraction, add the Group-0.5 spike, fix
the 0.1 path, harden the canary as the first extraction sub-task, promote the
`MODEL_DIMS` guard, add the corridor reservation + POI-inventory capture + `?perf=mid`,
and flag the crowd commit as player-visible in 8.1.
