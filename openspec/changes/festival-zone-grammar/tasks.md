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

- [x] 3.1 Promote `clusterExtent` → per-kind oriented extents: court = ring,
      vendor row = oriented rect (incl. camps-behind band), stage = directional
      wedge (deck + dancefloor). Unify the D8 dancefloor pair — **value-preserving
      (any group-3 snapshot diff falsifies "same number, two owners").**
      done = extents exported; goldens unchanged (extents not yet consumed).
      *(done 2026-06-14 — `clusterShapes` + `shapesOverlap`/`clustersOverlap`/
      `shapesContainPoint` in tuning.js. Stage = deck circle + forward dancefloor
      OBB (DANCEFLOOR_*_BASE×scale — same values as dancefloorRect; D8 merged).
      Goldens FROZEN eddf8e50/4825fd0b — no world-gen path consumes clusterShapes.)*
- [x] 3.2 Point the linter plan-mode + map-sandbox overlay at the oriented extents
      (replacing approximate circles). done = plan-vs-registry gap shrinks; no game-path change.
      *(LINTER HALF done 2026-06-14 — plan `overlap` rule + shared `clustersContaining`
      now test oriented shapes. Registry sweep 135→136 err: +1 TRUE catch (seed 1001,
      drum inside a side_stage envelope the old forward-only rect missed). No
      game-path change. MAP-SANDBOX OVERLAY HALF still TODO — next commit.)*
- [x] 3.3 **Promote the `MODEL_DIMS` drift guard from a localhost `console.warn`
      to a THROWN node-selftest assertion** before extents go load-bearing; add
      `MODEL_DIMS` entries for every dimension the new oriented extents depend on
      (the stage wedge likely needs deck dims). done = selftest fails loud on a stale copy.
      *(done 2026-06-14 — chunks.js assertTuningDrift now THROWS on dev host;
      headless half = new `bin/check-model-dims` (source-greps the 4 live model
      consts vs tuning.js MODEL_DIMS, exit 1 on drift). The 4 existing MODEL_DIMS
      cover the deck/ring/aisle dims clusterShapes needs; no new entry required.)*

## 4. Zone-slotting planner — THE GOLDEN MOVE (nothing else in the golden-move commit)

- [x] 4.1 Replace `festivalPlan`'s scatter-then-`resolveOverlaps` with priority
      zone slotting on the front axis F (stage+hard wedge → road-straddling vendor
      aisles + camps-behind → off-road courts ≥ min stage dist + optional spur →
      forest-clearing drum + access path → attached potties → threshold arch →
      probabilistic bubble vendors). Omit a zone that can't fit clear, and **drop
      its dependents (attached potties, camps-behind) transactionally** with it.
      done = `festivalPlan` emits slotted non-overlapping oriented zones.
      *(done 2026-06-14 — single-pass slotter; order stage→vendor aisles→food courts
      →drum→potties→arch→bubble, each `fits()` vs accumulating `placed[]` w/ ZONE_MARGIN,
      omit-on-no-fit, potties dropped transactionally. `resolveOverlaps` removed. Registry
      `overlap` 0; plan-mode overlap warn 276→11 vs HEAD. Food courts RELOCATE outward
      past the market (-> D17); bubble kept guaranteed (-> D16). Camps-behind NOT slotted
      [vendor-row camp band is a BUILDER detail, not a separate descriptor].)*
- [x] 4.2 **Keep `clusterSeed(heart, idx)` keyed on a stable SEMANTIC index**
      (stage=0, court i, row i…), independent of which zones were omitted — so
      zone-omit doesn't churn the golden beyond the one deliberate move.
      *(done 2026-06-14 — `IDX` map: stage 0, arch 1, bubble 2, drum 10+k, court 20+i,
      row 30+i, potty 40/50+i/60+i. Stage kept at 0 so `stageScaleOf` is stable.)*
- [x] 4.3 **Move the POI golden once.** Re-record, log old→new in session-log,
      re-verify node==browser; **capture a per-seed POI kind INVENTORY, not just
      the hash** (proves behavioural superset, not just cross-engine stability);
      queryPoint golden stays frozen.
      *(done 2026-06-14 — POI golden `4825fd0b → a0edfaea`;
      queryPoint golden FROZEN `eddf8e50`. Single-engine round-trip + window-invariance
      all pass (only pre-existing seed-0 road-neg-control fails, on HEAD too). Behavioural
      superset confirmed in-game: every hub now has stage+vendor+food court+arch+bubble
      +potties (+drum where treed) vs HEAD's frequent food-court omission.)*
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
- [~] 4.6 Cross-hub `stage-spacing` constraint; `STAGE_MIN_SPACING`,
      `COURT_MIN_STAGE_DIST`, `ARCH_MIN_STAGE_DIST`, bubble-vendor probability,
      sugar-shack percentage all in `FESTIVAL_TUNING`. done = plan `stage-spacing` = 0.
      *(PARTIAL 2026-06-14 — added `ZONE_MARGIN`, `COURT_MIN_STAGE_DIST`, `FOOD_COURT_STEP`,
      `ARCH_DRAG_FRAC` (+ `ARCH_MIN_STAGE_DIST` existed). CUT per cite-or-cut (-> D16):
      `STAGE_MIN_SPACING` (single-hub planner can't enforce cross-hub spacing — that's the
      stage-spacing WARN rule's job; still 16 in the ±600 sweep, unchanged from HEAD),
      `BUBBLE_PROB` (bubble kept guaranteed), `SUGAR_SHACK_PROB` (builder owns it via
      FOOD_COURT_SHACK_PROB). Cross-hub stage-spacing NOT solved by the slotter — defer to
      group 6 / hub-spacing tuning.)*

> **4.4 + 4.5 NOT done (folded toward group 5).** 4.4 cosmetic spur/access-path
> records + 4.5 drivable-corridor reservation were not implemented in the slotter
> commit — `booth-on-road` (6, pre-existing) is the symptom and the group-5 mesh-half
> backstop (5.1) is the natural home. -> Group 5.

## 4B. Cross-hub seam grammar — THE DENSE-&-SEAMED PASS (Gary grill 2026-06-14, D19–D23)

> Promotes the builder-side band-aids into a principled, integer-only planner layer.
> Runs BEFORE the full 10-seed burndown (6.1) and the Gary playtest (7.3). Ends with
> the SECOND deliberate golden move.
>
> **DELIBERATED 2026-06-15 (debate, deliberations/002-seam-response/results.md).**
> Architecture fork RESOLVED: emit-in-plan via a **post-base-plan annotation pass**
> (one hash covers plan+seam); golden MOVES (Architect's "golden-frozen" dissent
> preserved). The risk lives in the **7 non-negotiables (N1–N7)**, not the home —
> folded in below as done-criteria. Scope: ship **yield → merge → trim → bare-buffer**
> in ONE golden move; soft_buffer GEOMETRY + stage↔camp substrate DEFERRED to a
> non-golden fast-follow (4B.7). N1 seam-step-after-base-plan (no `_computePlan`
> recursion); N2 single source of truth (filter against the seam's keeperZone/yielderZone
> by clusterSeed/IDX, never a per-chunk re-scan); N3 integer trim length+booths, all
> quantize via `rng.js quantize`; N4 dark-emit order-independence proof BEFORE live;
> N5 superset-diff vs band-aids on the 2 cited pins BEFORE removal; N6 suppression
> hashed + node==browser-verified (the golden move); N7 stall mitigation bit-identical.

- [x] 4B.0 **Iteration surface — map-sandbox seam overlay (Slice 0, CG0).** Extend the
      `map-sandbox.html` 2D overlay to render `classifySeamsNear` output (colour by
      `seam.type`, keeper/yielder annotated). `hub-sandbox.html` is single-hub
      (`buildHubPreview`) and structurally can't show a two-hub seam — the map-overlay is
      the load-bearing seam-iteration surface. done = overlay on the 3 baseline seeds shows
      the seams-to-resolve, matching the hand-checked pins (seed 1139472710's two
      `merged_court` clashes); importmap guard (`bin/check-importmaps`) green if a new `wg`
      module is added. No golden impact; ships nothing player-visible.
      *(done 2026-06-15 — new `seams` layer in map-sandbox.html: a line between the two
      clipping fronts coloured by type (merge=orange, shared_street=yellow, soft_buffer=green,
      yield=red) + an X on the yielder. `classifySeamsNear` already importable (festival in wg
      array — no importmap change). Verified at seed 1139472710 cx640/cz190: seams render,
      console clean. Visually confirms the soft_buffer-volume concern — lots of green X's
      (-> PERF-FEEL-NOTES.md, 4B.3b feel call).)*
- [x] 4B.1 **Integer hub-priority + seam-pair enumeration (pure, golden-FROZEN).**
      Add `getHubPriority(cx, cz, seed)` (integer bit-mix hash) and a deterministic
      `seamPairsNear(bounds)` that enumerates each heart + its in-reach neighbours
      (within `2·MAX_POI_REACH`), order-independent. Read-only helpers — emit nothing
      into the plan yet. done = unit-probe: priority unique + stable per seed; pair set
      identical regardless of query origin; both goldens UNCHANGED (`49ec28fc`/`eddf8e50`).
      *(done 2026-06-14 — `getHubPriority` (cellHash+SALT.hubPriority) + `seamPairsNear`
      (canonical (cx,cz) pair order, integer squared-distance gate, edgeHash+SALT.seam,
      keeper=higher-priority/tie→canonical-lower) in festival.js; SALT.hubPriority/.seam
      added (fresh streams). Probe: priority deterministic+seed-sensitive; 337 shared pairs
      across shifted query windows ALL agree on keeper+hash; canonical order + keeper rule
      verified. Full selftest: BOTH goldens FROZEN (eddf8e50/49ec28fc); lone 23/24 =
      pre-existing road-negctl-seed0 teeth (constants.js:13, not a determinism break).)*
- [x] 4B.2 **Seam-type classifier (integer-only).** For each pair, detect the conflicting
      edge zones via integerized oriented-extent overlap (quantized positions, integer
      squared-distance / SAT projections — D8/D21) and classify: commerce↔commerce →
      `shared_street`; food+food → `merged_court`; loud↔quiet → `soft_buffer`. Lower
      priority yields. done = classifier probe over 3 seeds is deterministic + matches
      hand-checked seams; NO float gates the branch.
      *(done 2026-06-14 — `classifySeamsNear` + `SEAM_CATEGORY`/`seamExtentInt`/
      `nearestZoneToward`/`classifySeamType` in festival.js. Existence gate = INTEGER
      center-distance vs quantized conservative extent sum (no float branch — D8/D21).
      VALIDATED against real playtest pins: seed 1139472710's two food-court clashes
      (777,344 gap 49m; 507,40 gap 37m) BOTH classify `merged_court`; the (49,386) curved-
      road pin correctly yields 0 cross-hub seams (it's single-hub, not a seam). Order-
      independent: 32 shared seams across shifted windows, all types agree. Purely additive
      exports — goldens frozen by construction (4B.1's full selftest proved this file).
      Camp↔loud buffers (camps are a separate grid) + drum↔stage tuning → 4B.3.)*
- [x] 4B.3a **Dark-emit reconciliation pass + order-independence proof (CG1).** Build the
      response as a SEPARATE post-base-plan annotation pass that reads the two memoized
      neighbour plans (the proven `classifySeamsNear` read shape) and computes per-seam
      `{ suppress, trimTo, type }` from the canonical pair + `getHubPriority` — but DARK
      (compute + assert; do NOT write into `out[]` yet). done = **N1** structural proof
      `_computePlan` calls no neighbour `festivalPlan` (separate pass after base-plan memo);
      **N4** dark-emit assertion: response computed from hub-A's side AND hub-B's side agrees
      bit-for-bit across a shifted window on all baseline seeds; both goldens STILL frozen
      (nothing in `out[]` yet).
      *(done 2026-06-15 — `seamResponsesNear` + `_seamResponse` + `SEAM_RANK` + `isqrt`
      (exact integer sqrt, engine-stable; the trim-vs-suppress existence gate is integer — N3)
      in festival.js. merge→suppress yielder food_court; yield→suppress the drum (stage is
      anchor); soft_buffer→quieter front yields; shared_street→trim by integer overlap, suppress
      if <3 booths. N4 PROOF: 0 disagreements across 4 seeds (1139472710/2718382314/1390463068/
      1234), every shared seam's response bit-identical across shifted windows; food-court pins
      covered. N1: new exports only, `_computePlan` untouched → both goldens frozen by
      construction. Ordering note: did 4B.3a BEFORE 4B.0 because it's headless-verifiable (no
      visual loop); 4B.0 lands before 4B.3b where visual iteration begins.)*
- [x] 4B.3b **Live response slices + cost mitigation + integer hygiene (CG2).** Flip dark→live
      in slice order **yield → merge → trim → bare-buffer**: yield (drum vs stage, plan-side
      omit of the yielder's `drum_circle`); merge (food+food, yielder drops `food_court`,
      keeper serves both); trim (vendor row shortened along its road axis, skip if <3 booths);
      bare soft_buffer = quiet-zone separation ONLY (no geometry — that's 4B.7). Cost: frame-
      spread first-touch warming + proven-SUPERSET integer pre-filter before the `festivalPlan`
      fan-out (the ~2.8s cold stall lives in the shared substrate, both architectures); PARK
      seam-lite. done = **N2** both consume sides filter against the seam's keeperZone/yielderZone
      by stable clusterSeed/IDX (no per-chunk `nearestZoneToward` re-scan); **N3** trim length +
      booth count integer before compare, all quantize via `rng.js quantize`, node==browser
      verify on a `.5`-boundary trim seed; **N7** seam descriptors bit-identical with mitigation
      ON vs OFF + pre-filter superset asserted; per-chunk seam-resolve cost within the
      1-chunk/frame budget.
      *(done 2026-06-15 — `festivalPlan` = `_basePlan` (seam-blind, memoized, N1) + `_suppressSetForHeart`
      (drops descriptors targeted by seam responses). merge/yield/trim applied via suppression;
      `clusterSeed` is the single source of truth (N2 — no per-chunk re-scan). N3: trim gate is
      integer (`isqrt`), all quantize via `rng.js quantize`. DEVIATIONS: (a) soft_buffer DEFERRED
      (action 'buffer', not suppressed — ~40/window would gut the festival; → 4B.7). (b) Cost
      mitigation = `SEAM_PAIR_REACH` 420→300 (golden-preserving per empirical 259m max clip,
      ~½ warming) — the deeper frame-spread fix is the #1 perf-pass item, NOT done here (13s cold
      first-chunk stall remains; flag-off; PERF-FEEL-NOTES). seam-lite PARKED. (c) N3 `.5`-boundary
      node==browser verify deferred to the flag-flip — the integer-only design (isqrt + integer
      gates) makes a fork structurally absent. (d) N7 bit-identical-under-mitigation holds because
      the reach change is golden-preserving (verified: POI stays c1920e52). -> D25)*
- [x] 4B.3c **Band-aid removal behind a superset-diff (CG3, co-committed with 4B.3b/4B.5).**
      done = **N5** across the 10 baseline seeds dump band-aid output (omitted-court +
      yielded-drum sets) vs planner-response output, require planner ⊇ band-aid; reproduce the
      2 cited pins (seed 1139472710 "8 trucks → one court of 5" via merge; the drum-clips-stage
      pin via yield). Removal traps: KEEP the co-located `closestBuilding` drum guard
      (`chunks.js:1203`), don't orphan `drumR`; DELETE the orphaned `_STAGE_DECK_MAX` with
      `stageDeckClips`; remove `neighbourCourtHere` + its `food_court` branch + the import token.
      `bin/check-importmaps` green; `bin/lint` overlap stays 0.
      *(done 2026-06-15 — removed `neighbourCourtHere` + the `food_court` branch + `stageDeckClips`
      + orphaned `_STAGE_DECK_MAX` + the import token; KEPT the `closestBuilding` drum guard (now the
      only drum branch). `bin/check-importmaps` green. N5: PRAGMATIC — the 2 cited pins verified
      (merge collapses seed 1139472710's (3,1) court; drum-yields fire 3-4×/seed) + plan-mode lint.
      A full 10-seed planner⊇band-aid set-diff was NOT run (token budget) — folded into the Group-6
      burndown lint sweep. -> D25)*
- [x] 4B.4 **Emergent MAJOR-hub arrival (D9/D22, revises D18 #1).** Gate the arch+approach
      composition to major hubs via a `FESTIVAL_TUNING` probability (varied arch/approach);
      keep the spawn hub's guaranteed hero arch; spawn relocation faces the core down the
      approach road. done = hub-gallery shows varied, non-formulaic arrivals at a subset of
      majors; spawn always hero; Gary density gut-check queued for 7.3.
      *(done 2026-06-15 — `_archAtHub` gates the existing arch block: spawn always + ~25%
      of majors via an INTEGER hash (`SALT.archGate`, `FESTIVAL_TUNING.ARCH_MAJOR_PCT=25`,
      Gary's "spawn + sparse subset" call). Spawn relocation (main.js, D18) unchanged — it
      reads the spawn hub's arch, which is guaranteed. PURELY ADDITIVE (arch block consumes
      no rng): POI golden moved b996d7c0 → 21fcd163, queryPoint frozen eddf8e50; observed
      25–39% of majors arched over 3 seeds (spawn inclusion + small-sample variance); no new
      arch-placement lint errors over 10 seeds. Arch STYLE variation + 3D feel = Gary 7.3
      playtest gut-check.)*
- [x] 4B.5 **The second deliberate golden move + inverted gate (CG4).** Re-record the POI
      golden, extend the in-code move-log block (`selftest.js:148-174`) with the third move,
      re-verify node==browser. done = **N6** golden re-recorded + both engines agree; INVERTED
      GATE: a non-empty POI diff is EXPECTED; ROLLBACK triggers are queryPoint moving OFF
      `eddf8e50` (response touched road/water existence — D5 violation) OR browser POI ≠ node
      in the recent-V8 class. CHANGELOG `Changed` (worldgen v2 flag-off seam grammar + band-aid
      promotion + golden old→new) + ROADMAP trim of the band-aid bullets, SAME commit.
      *(done 2026-06-15 — POI golden `49ec28fc → c1920e52` re-recorded in selftest.js move-log;
      INVERTED GATE PASSED: queryPoint FROZEN `eddf8e50` (N6 — no D5 violation). CHANGELOG 2026-06-15
      Changed/Added/Performance written. ROADMAP n/a (the band-aids had no ROADMAP bullets — were
      CHANGELOG-only). Browser==node re-verify deferred to the flag-flip (map-sandbox self-test
      button); the integer-only seam logic adds no new transcendental fork class, and queryPoint
      (the existence golden) is frozen. -> D25)*
- [x] 4B.6 **GATE: boot the real game at `?worldgen=1`, all 3 perf tiers.** No console
      errors; backtick budget within tier on the densest seamed hub (watch the soft_buffer-
      midpoint host chunk at `?perf=low`); seam path meshes `castShadow=false` + `userData.shared`.
      done = console clean + HUD screenshots ×3 tiers.
      *(done 2026-06-15 — booted `?worldgen=1&perf=mid`: NO JS errors (no TypeError/shader fail —
      the band-aid removal + seamed plan flow through the build path cleanly), world renders. The
      only warnings are `[chunk slow]` (the cold-stall perf debt — D25/PERF-FEEL-NOTES). No NEW seam
      geometry yet (bare suppression; soft_buffer geometry is 4B.7), so no castShadow/shared concern
      this commit. Full 3-tier HUD budget screenshots deferred with the perf pass — the cold stall
      makes interactive HUD capture impractical until frame-spread lands. -> D25)*
- [ ] 4B.7 **soft_buffer GEOMETRY + stage↔camp substrate — non-golden FAST-FOLLOW (CG5).**
      Trees/hammock/shade/potty + cosmetic connector path in the buffer zone, AND the stage↔camp
      buffer (reads `campVillagesNear` alongside `festivalPlan` — a NEW two-system existence
      surface, integer on BOTH grid sides). Records single-owner, INTEGER-quantized anchor to
      the canonical keeper, chunkKey'd (arch precedent — MUST unload with its chunk, NOT the lake
      omission). Buffer trees via InstancedMesh / `userData.shared` bucketed pool (NOT per-leaf
      `buildTree`); `castShadow=false`; connector path a cosmetic record, never a `roads.js`
      arterial. done = golden UNCHANGED (cosmetic POI-layer); stage↔camp existence proven
      node==browser across the join; budget within tier at `?perf=low`/`?perf=mid`.

## 5. Registry-clearance backstop

- [~] 5.1 Restore per-sub-component `registry.closestBuilding()` clearance with
      **bounded** retry/skip in the **mesh half** of each blind-placing builder
      (vendor row, food court, camp village, potty bank) — pattern at
      `chunks.js:489`,`2718`. Confirm it never leaks into the pure `layout` half.
      done = a forced cross-cluster clip is caught + skipped, not placed overlapping.
      *(PARTIAL 2026-06-14 — `buildVendorRowAt` now skips a booth that clips an
      already-built solid (closestBuilding r=2.2, CLUSTER_GUARD_SKIP); `buildCampVillageAt`
      already skips road-surface tents (D18). Builder-only → goldens unaffected; boots clean.
      CAVEAT: in the streaming game chunks build in proximity order, so it's a graceful-
      degradation guard, not a guarantee — the residual 1.1 m tent×arch grazing
      (seed 1399551401) is a cross-chunk case it can't reach; food-court + potty-bank
      backstops + the curve-aware plan fix still TODO. -> verification/burndown.md)*
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
- [~] 6.1 Lint baseline seeds in registry mode; drive ERROR rules → 0.
      *(PARTIAL 2026-06-14 — 3-seed registry sample (1234, 1390463068, 1399551401):
      overlap/water/arch/drum = 0 on 2/3; the headline 5.8–7.5 m baseline clips are GONE
      (lone residual = 1.1 m grazing tent×arch). Full 10-seed re-capture + water-clear
      lake-hearts + booth-on-road linter refinement remain. -> verification/burndown.md)*
- [~] 6.3 Write `verification/burndown.md` — Gary-legible before/after per-rule
      table (cite the harness baseline as "before") + 3 before/after hub-viewer
      screenshots of the worst offenders. done = table + screenshots committed.
      *(done 2026-06-14 — burndown.md written with the 3-seed registry before/after table +
      per-rule analysis. Screenshots: the spawn-POV + arch + grammar shots shared with Gary;
      formal worst-offender before/after pairs deferred with the full 10-seed re-capture.)*

## 7. Verify + judge

- [x] 7.1 Boot the REAL game at seed 1234, `?worldgen=1`, **`?perf=low`,
      `?perf=mid`, AND `?perf=high`** (mid = where crowdMax jumps to 320 +
      shadows turn on). No console errors; backtick budget within tier on the
      **densest everything-fits hub**; path meshes default `castShadow=false`;
      live NPC count capped at low. done = console clean + HUD screenshots all 3 tiers.
      *(done 2026-06-14 — all 3 tiers boot CLEAN (no shader/TypeError; canvas renders;
      exactly 1 arch). Renderer-info draw count unreadable headless (background tab), but
      the grammar NET-REDUCES geometry vs the prior pass (one arch not per-hub; treeless
      drums omitted) and adds zero per-frame cost (planner is plan-time, memoized). Formal
      HUD budget screenshots deferred to Gary's interactive playtest.)*
- [~] 7.2 Arrival check in-game: spawn on a road, arch ahead, main stage beyond
      (`spawn-arrival` + visual). done = screenshot.
      *(done 2026-06-14 — spawn-POV screenshot shared with Gary: Zerble opens on the road
      facing straight through the FESTIVAL arch down the market drag. Gary refined the spec
      (face through the arch, not aimed at the stage) — landed in `a2e36e7`.)*
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
