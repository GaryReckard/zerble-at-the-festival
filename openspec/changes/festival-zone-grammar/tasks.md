# Tasks — festival-zone-grammar

> The layout fix. Gated by the `worldgen-layout-harness` instrument (snapshot
> diff + draw-count canary + linter) and Gary's in-game judgment.
>
> **REVISED after deliberation 001-initial** (`deliberations/001-initial/results.md`,
> 5 personas + Mediator, all "Proceed with mitigations").
>
> **RE-SCOPED 2026-06-13 (Q1 answered → D13 — LEAN PATH).** Gary chose the planner-only
> critical path. **Groups 1 (crowd pre-roll) + 2 (8-builder layout/mesh extraction) are
> DEFERRED** to a follow-up change ("Festival worldgen v2" on ROADMAP) — NOT dropped.
> The 0.5 spike proved they're off the critical path to zero-error (the POI golden hashes
> the PLAN; the builders only render it; crowd draws live in the builder). So THIS change
> is groups **3 → 8**: true oriented extents → zone-slotting planner (the single golden
> move) → arch relocation → registry backstop → burndown → verify/judge.
>
> **Golden discipline (lean path):** the BUILDER goldens never move (no extraction here).
> The POI golden moves exactly ONCE, in group 4. The queryPoint (road/water) golden stays
> frozen throughout. `/smart-review` after group 6 and before close.

## 0. Preconditions — make the gate real

- [x] 0.1 **Fix the gate-artifact path**: the baseline + snapshots live at
      **repo-root** `verification/baseline.md` + `verification/snapshots/baseline/*.json`
      (commit `ecbd9af`), NOT `openspec/changes/worldgen-layout-harness/verification/`.
      Correct every cite (proposal/design/this file).
      done = paths point at the real files. (Risk: stale path → gate looks missing.)
      *(done 2026-06-13 — only session-log.md:70 grouped baseline.md under the
      harness folder; fixed. proposal/tasks already cite repo-root.)*
- [x] 0.2 Reproduce the baseline **bit-for-bit**: `bin/lint
      verification/snapshots/baseline/<seed>.json` matches the recorded 106 error /
      92 warn. **STOP if it does not reproduce** — the measuring stick is broken.
      *(done 2026-06-13 — REPRODUCES. Worst-offender penetrations match baseline.md
      exactly: 1234 tent×truck 7.5m, 0xf7ef2a3c 5.8m, 42 campsite×truck 6.4m. The
      per-seed total delta is explained: baseline.md's per-seed table counts the
      original 8 rules; arch-placement/drum-in-trees (harness 4.7) are in the
      appended block — so seed 42 = 3 original + 2 arch = 5. No STOP.)*
- [x] 0.3 Pin the capture protocol: `?worldgen=1&perf=high`, crowd on, no driving —
      the same the baseline used, so before/after compare. *(pinned — matches baseline.md header.)*

## 0.5 Extraction-scope spike (NEW — Pragmatist "Slice 0"; ships nothing)

- [x] 0.5.1 Map each ERROR rule (`water-clear` 58, `overlap` 48, `arch-placement`
      21, `drum-in-trees` 8) → the minimum builder/planner change that zeroes it,
      reviewed against the reproduced `bin/lint` counts. (arch-placement is
      planner-only — needs no extraction; overlap/drum need extents+slotting;
      water needs slotting+backstop.)
      done = a per-rule → minimum-change map recorded in session-log.
      *(done 2026-06-13 — code-grounded. ALL rules are PLANNER placement: arch =
      main.js buildSpawnArch @ archDist=15*scale inside the dancefloor (main.js:240,283)
      → relocate to road threshold; overlap = resolveOverlaps separates by SCALAR
      `a.footprint+b.footprint+MARGIN` (festival.js:331,339) → oriented-extent slotting;
      drum/water/booth/dancefloor/potty all set by `_computePlan`/`nudgeOff`/`perpOff`
      (festival.js:356-454). The builders only RENDER descriptors — they need no change
      to fix the rules. See session-log SPIKE entry.)*
- [x] 0.5.2 Confirm the split set: crowd pre-roll (mandatory), every builder that
      contains a crowd spawn or feeds a consumed record (mandatory), warn-only
      builders (deferrable to a cleanup slice). done = the group-2 builder list is
      scoped before grinding the extraction.
      *(done 2026-06-13 — FINDING: the full per-record builder extraction (group 2)
      is NOT on the critical path to zero-error. The POI golden hashes the PLAN
      (descriptors), not the build; crowd draws live in the BUILDER, so they don't
      touch the POI golden. Critical path = planner slotting + oriented extents +
      arch relocation + registry backstop, with ONE golden move at the slotting
      commit. Crowd pre-roll (group 1) + full extraction (group 2) are valuable but
      DEFERRABLE — recommend a re-scope decision before grinding them. -> Open Q for Gary.)*

## 1. Crowd pre-roll + injected env — ⛔ DEFERRED to follow-up (D13 / Q1)

> **DEFERRED to the "Festival worldgen v2" follow-up change (ROADMAP).** Off the
> critical path to zero-error (0.5 spike): crowd draws live in the builder, not the plan,
> so they don't touch the POI golden this change moves. The crowd tier-dependence (A4)
> rides along to the follow-up. Tasks kept here for the follow-up to inherit verbatim.
>
> `crowd.spawn` (`crowd.js:338`) + 4 call sites (`chunks.js:1698,1706,2466,2723`).

- [ ] 1.1 `crowd.spawn` consumes **pre-rolled params** (count + per-NPC **scalar**
      seeds — NOT pre-built Vector3/Color, avoid hub-spawn GC) from layout records
      instead of drawing from the cluster rng with a tier-sized pool.
- [ ] 1.2 **Tier constraint (Profiler):** the *layout/record stream* is
      tier-independent; the *realized NPC population* stays capped by
      `PERF.crowdMax` (180/320/500) — `crowd.spawn` still honors `free.length===0`
      and drops the surplus at low/mid.
      done = same seed/hub at `?perf=low` and `?perf=high` → IDENTICAL normalized
      **layout** (the plan, not the live crowd) AND live NPC count still capped at low.
- [ ] 1.3 Widen the dry-run env to `{ waterAt, blockedAt }`; grep-confirm no
      `src/worldgen/*` imports chunks/registry/lakes/models (leaf rule).
      done = grep clean; `bin/lint` + node selftest still run.
- [ ] 1.4 **D2 is player-visible** (shipped low/mid worlds change to agree with
      high) — its commit gets its OWN CHANGELOG `Fixed` entry, not the
      silent-refactor exemption.

## 2. Builder layout/mesh extraction — ⛔ DEFERRED to follow-up (D13 / Q1)

> **DEFERRED to the "Festival worldgen v2" follow-up change (ROADMAP).** This is the
> ~8-builder behaviour-preserving refactor the council flagged as the riskiest, largest,
> most-invisible work; the 0.5 spike proved it's NOT required to drive the error rules to
> zero (the builders only render the planner's descriptors). Delivers the D-C′ substrate.
> Tasks kept here for the follow-up to inherit verbatim.
>
> One builder per commit. Each: split into `layout(rng, env) → records[]` +
> `buildMesh(records)`; capture; snapshot diff EMPTY (incl. the hardened canary);
> both goldens unchanged; **boot the real game both flags / both tiers**.

- [ ] 2.1 **DO FIRST — harden the draw-count canary** (before any builder split):
      (a) make the key unique-per-cluster — include `clusterSeed`/`role`/`rank`,
      not `kind@roundedX,roundedZ` (collides under tight slotting); (b) assert
      **triangle count** as well as draws + positions (catches geometry segment
      drift). Note that intra-cluster draw ORDER is held by per-commit code review.
      done = canary key collision-proof + tri-count asserted; self-diff still EMPTY.
- [ ] 2.2 `buildVendorRowAt` → layout/mesh split. done = snapshot diff EMPTY, goldens held.
- [ ] 2.3 `buildFoodCourtAt` → split (truck ring + shack + torches as records). done = diff EMPTY.
- [ ] 2.4 `buildCampVillageAt` → **partial split** — `registry.closestBuilding`
      stays in the mesh half; the layout half is approximate by construction
      (D-C′ pt 3). done = diff EMPTY; the impurity is noted, not "fixed."
- [ ] 2.5 `buildStage` → **isolated commit, budgeted 3–5×**. **Transcribe
      `Math.random()` cosmetic sites as-is** (the D-C′ trap); `ctx.rng()` scale +
      clump draws move to layout; crowd draws already gone via group 1. Ship an
      explicit before/after draw-count table for the interleaved streams.
      done = diff EMPTY incl. canary, goldens held, draw-count table recorded.
- [ ] 2.6 Potty-bank + drum-circle + bubble-vendor builders → split. done = diff EMPTY ×3 seeds.
- [ ] 2.7 Model-builder param splits where a mesh builder draws rng mid-loop
      (`buildTent`, `buildCampChair`, …): `pickParams(rng)` pure / `buildXMesh(params)`.
      done = diff EMPTY; document which builders needed it.
- [ ] 2.8 **Per-builder `userData.shared` audit** — enumerate pooled resources per
      builder; confirm the tag stays on the `buildMesh` side and survives the split
      (the canary CANNOT see a disposal-time recompile storm). done = audit recorded.
- [ ] 2.9 **GATE: boot the real game at both flags / both tiers after EVERY
      `chunks.js`-touching commit** (sandbox-pass ≠ game-pass; the camp-chair
      two-entry-shape signature). done = clean console per commit.

## 3. True oriented extents + MODEL_DIMS guard promotion (golden-frozen — read-only until group 4)

- [ ] 3.1 Promote `clusterExtent` → per-kind oriented extents: court = ring,
      vendor row = oriented rect (incl. camps-behind band), stage = directional
      wedge (deck + dancefloor). Unify the D8 dancefloor pair — **value-preserving
      (any group-3 snapshot diff falsifies "same number, two owners").**
      done = extents exported; goldens unchanged (extents not yet consumed).
- [ ] 3.2 Point the linter plan-mode + map-sandbox overlay at the oriented extents
      (replacing approximate circles). done = plan-vs-registry gap shrinks; no game-path change.
- [ ] 3.3 **Promote the `MODEL_DIMS` drift guard from a localhost `console.warn`
      to a THROWN node-selftest assertion** before extents go load-bearing; add
      `MODEL_DIMS` entries for every dimension the new oriented extents depend on
      (the stage wedge likely needs deck dims). done = selftest fails loud on a stale copy.

## 4. Zone-slotting planner — THE GOLDEN MOVE (nothing else in the golden-move commit)

- [ ] 4.1 Replace `festivalPlan`'s scatter-then-`resolveOverlaps` with priority
      zone slotting on the front axis F (stage+hard wedge → road-straddling vendor
      aisles + camps-behind → off-road courts ≥ min stage dist + optional spur →
      forest-clearing drum + access path → attached potties → threshold arch →
      probabilistic bubble vendors). Omit a zone that can't fit clear, and **drop
      its dependents (attached potties, camps-behind) transactionally** with it.
      done = `festivalPlan` emits slotted non-overlapping oriented zones.
- [ ] 4.2 **Keep `clusterSeed(heart, idx)` keyed on a stable SEMANTIC index**
      (stage=0, court i, row i…), independent of which zones were omitted — so
      zone-omit doesn't churn the golden beyond the one deliberate move.
- [ ] 4.3 **Move the POI golden once.** Re-record, log old→new in session-log,
      re-verify node==browser; **capture a per-seed POI kind INVENTORY, not just
      the hash** (proves behavioural superset, not just cross-engine stability);
      queryPoint golden stays frozen.
- [ ] 4.4 Spur roads + drum access paths as **cosmetic path records** (NOT roads.js
      arterials — keep queryPoint frozen). Render as **ONE merged/instanced opaque
      ribbon per hub, `castShadow=false`, `alphaTest` not transparent** (not one
      mesh/segment); tag pooled geometry `userData.shared`. done = paths render;
      queryPoint golden held; draws don't creep.
- [ ] 4.5 **Make the drivable corridor an explicit slotting RESERVATION** (a pure
      oriented extent the zone-fit test treats as occupied) — `path_node` is in the
      linter's overlap-exclusion, so a clipping path is caught by no error rule.
      Decide + record: path records carry NO colliders; drivability = corridor
      reservation + the group-5 mesh-half backstop. done = a tent can't land in the corridor.
- [ ] 4.6 Cross-hub `stage-spacing` constraint; `STAGE_MIN_SPACING`,
      `COURT_MIN_STAGE_DIST`, `ARCH_MIN_STAGE_DIST`, bubble-vendor probability,
      sugar-shack percentage all in `FESTIVAL_TUNING`. done = plan `stage-spacing` = 0.

## 5. Registry-clearance backstop

- [ ] 5.1 Restore per-sub-component `registry.closestBuilding()` clearance with
      **bounded** retry/skip in the **mesh half** of each blind-placing builder
      (vendor row, food court, camp village, potty bank) — pattern at
      `chunks.js:489`,`2718`. Confirm it never leaks into the pure `layout` half.
      done = a forced cross-cluster clip is caught + skipped, not placed overlapping.
- [ ] 5.2 Confirm `buildHubPreview` stays diff-faithful (shared `buildWorldgenKind`
      reaches both viewer + game). done = hub-viewer acceptance re-runs clean.

## 6. Baseline burndown to zero (per-rule sequenced after the single golden move)

- [ ] 6.1 Lint all 10 baseline seeds in registry mode; iterate slotting/extents
      until every ERROR rule = 0 (`overlap`, `water-clear`, `drum-in-trees`,
      `arch-placement`, `truck-off-road`) and warns (`booth-on-road`,
      `dancefloor-clear`, `potty-attached`) = 0 or recorded justification.
      Sequence the burndown legibly: arch → overlap → drum → water → backstop,
      each a falling `bin/lint` count against the now-frozen golden.
- [ ] 6.2 Re-confirm the 4 named worst offenders (`1234`, `0xf7ef2a3c`, `99`,
      `256`) clean at their exact coords. done = teleport + lint each → clear.
- [ ] 6.3 Write `verification/burndown.md` — Gary-legible before/after per-rule
      table (cite the harness baseline as "before") + 3 before/after hub-viewer
      screenshots of the worst offenders. done = table + screenshots committed.

## 7. Verify + judge

- [ ] 7.1 Boot the REAL game at seed 1234, `?worldgen=1`, **`?perf=low`,
      `?perf=mid`, AND `?perf=high`** (mid = where crowdMax jumps to 320 +
      shadows turn on). No console errors; backtick budget within tier on the
      **densest everything-fits hub**; path meshes default `castShadow=false`;
      live NPC count capped at low. done = console clean + HUD screenshots all 3 tiers.
- [ ] 7.2 Arrival check in-game: spawn on a road, arch ahead, main stage beyond
      (`spawn-arrival` + visual). done = screenshot.
- [ ] 7.3 Gary playtest pass with the marker hotkey; fold coordinates back as
      fixes or recorded warns. done = markers triaged; no error-severity surprises.
- [ ] 7.4 `/smart-review` of the change; fold must-fix back into tasks. done = review-summary persisted.

## 8. Close

- [ ] 8.1 CHANGELOG per-commit; **call out the crowd-pre-roll (group 1) commit AND
      the golden-move commit as the player-visible ones**; behaviour-preserving
      extraction commits may take the internal/dev-workflow exemption. done = coverage confirmed.
- [ ] 8.2 ROADMAP "Festival layout" trimmed to shipped; defer per-truck
      customization + the `DEFAULT_WORLDGEN_V2` flip (separate later change — flag
      stays OFF). done = ROADMAP reduced to what remains.
- [ ] 8.3 Session-log close-out; README refreshed (`bin/readme-sync`); note the
      flip is the next, separate change (v2 HANDOFF order). done = readme-sync fresh.
