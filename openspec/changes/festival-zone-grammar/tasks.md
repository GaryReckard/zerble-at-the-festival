# Tasks — festival-zone-grammar

> The layout fix. Gated by the `worldgen-layout-harness` instrument (snapshot
> diff + draw-count canary + linter) and Gary's in-game judgment. **Extraction
> (groups 1–2) is behaviour-preserving and golden-frozen — full gate ritual per
> commit, one builder per commit.** The golden moves exactly ONCE, in group 4.
> Run a `/deliberate` before group 3 (done as the deliberation artifact); a
> `/smart-review` after group 4 and before close.

## 0. Preconditions

- [ ] 0.1 Re-read the durable inputs (DRAFTING-BRIEF, harness design D-C′,
      baseline.md, ROADMAP "Festival layout", session-log D1–D8). Confirm the
      harness is on `main`/branch HEAD and `bin/lint` + the baseline snapshots
      reproduce the recorded counts (the "before" must be reproducible).
      done = `bin/lint verification/snapshots/baseline/<seed>.json` matches baseline.md.
- [ ] 0.2 Announce a tuning-freeze window is NOT needed (this change OWNS the
      tuning) but pin the capture protocol: `?worldgen=1&perf=high`, crowd on,
      no driving — the same the baseline used, so before/after compare.

## 1. Builder layout/mesh extraction — pure `layout(rng,env)` (D1, golden-frozen)

> One builder per commit. Each: split into `layout(rng, env) → records[]` +
> `buildMesh(records)`; capture; snapshot diff EMPTY (incl. draw canary); both
> goldens unchanged; boot both flags. Order easy→hard so the pattern settles.

- [ ] 1.1 `buildVendorRowAt` → layout/mesh split. Records carry booth + camper
      positions/yaw/cosmetic params. done = snapshot diff EMPTY, goldens held.
- [ ] 1.2 `buildFoodCourtAt` → split (truck ring + shack + torches as records).
      done = diff EMPTY, goldens held.
- [ ] 1.3 `buildCampVillageAt` → split (tent grid records). done = diff EMPTY.
- [ ] 1.4 `buildStage` → split. **Transcribe `Math.random()` cosmetic sites
      as-is** (D-C′ trap — do NOT fold into the seeded stream). Keep the first
      `ctx.rng()` scale draw in place. done = diff EMPTY incl. canary, goldens held.
- [ ] 1.5 Potty-bank + drum-circle + bubble-vendor builders → split.
      done = diff EMPTY across the 3 canonical seeds.
- [ ] 1.6 Model-builder param splits where a mesh builder draws rng mid-loop
      (`buildTent`, `buildCampChair`, etc., per D-C′): `pickParams(rng)` pure /
      `buildXMesh(params)`. done = diff EMPTY; document which builders needed it.

## 2. Crowd pre-rolled params + injected env (D2/D-C′, golden-frozen)

- [ ] 2.1 `crowd.spawn` consumes pre-rolled params from the cluster layout
      records instead of drawing from the cluster rng with a tier-sized pool.
      done = same seed/hub captured at `?perf=low` and `?perf=high` yields an
      IDENTICAL normalized layout (tier-dependence gone — harness R2 closed).
- [ ] 2.2 Widen the dry-run env to `{ waterAt, blockedAt }`; confirm no
      `src/worldgen/*` imports chunks/registry/lakes/models (dependency rule).
      done = grep clean; `bin/lint` + node selftest still run.

## 3. True oriented extents (D3, golden-frozen — extents are read-only until group 4)

- [ ] 3.1 Promote `clusterExtent` → per-kind oriented extents: court = ring
      circle, vendor row = oriented rect (incl. camps-behind band), stage =
      directional wedge (deck + dancefloor). Unify the planner dancefloor with
      `buildStage`'s internal one (merge the D8 pair). done = extents exported;
      goldens unchanged (extents not yet consumed by placement).
- [ ] 3.2 Point the linter's plan-mode + the map-sandbox overlay at the new
      oriented extents (replacing approximate circles). done = plan-vs-registry
      gap shrinks; overlay shows oriented shapes; no game-path change.

## 4. Zone-slotting planner — THE GOLDEN MOVE (D4/D6)

- [ ] 4.1 Replace `festivalPlan`'s scatter-then-`resolveOverlaps` with priority
      zone slotting on the front axis F (stage+hard wedge → vendor aisles +
      camps-behind → off-road courts + optional spur → forest-clearing drum +
      path → attached potties → threshold arch → probabilistic bubble vendors).
      Omit a zone that can't fit clear. done = `festivalPlan` emits slotted
      non-overlapping oriented zones; iterate in the hub viewer + overlay.
- [ ] 4.2 **Move the POI golden once.** Re-record, log old→new in session-log,
      re-verify node==browser; queryPoint golden stays frozen. done = both facts
      recorded; node==browser on the new poi hash.
- [ ] 4.3 Spur roads + drum access path as **cosmetic path records** emitted by
      the planner (NOT new arterials in roads.js — keep the queryPoint golden
      frozen). Builders render them. done = spur/path render; queryPoint golden held.
- [ ] 4.4 Cross-hub `stage-spacing` constraint in slotting; `STAGE_MIN_SPACING`,
      `COURT_MIN_STAGE_DIST`, `ARCH_MIN_STAGE_DIST`, bubble-vendor probability,
      sugar-shack percentage all in `FESTIVAL_TUNING`. done = plan-mode
      `stage-spacing` = 0 across baseline seeds.

## 5. Registry-clearance backstop (D5)

- [ ] 5.1 Restore per-sub-component `registry.closestBuilding()` clearance with
      bounded retry/skip in the mesh half of each builder (main's pattern).
      done = a forced cross-cluster clip is caught + skipped, not placed overlapping.

## 6. Baseline burndown to zero

- [ ] 6.1 Lint all 10 baseline seeds in registry mode; iterate slotting/extents
      until every **error** rule = 0 (`overlap`, `water-clear`, `drum-in-trees`,
      `arch-placement`, `truck-off-road`) and warns (`booth-on-road`,
      `dancefloor-clear`, `potty-attached`) = 0 or recorded justification.
      done = `bin/lint --seed-list` + per-snapshot registry runs all green.
- [ ] 6.2 Re-confirm the 4 named worst offenders (`1234`, `0xf7ef2a3c`, `99`,
      `256`) are clean at their exact coords. done = teleport + lint each → clear.
- [ ] 6.3 Write `verification/burndown.md` — Gary-legible before/after per-rule
      table (cite harness baseline.md as "before") + 3 before/after hub-viewer
      screenshots of the worst offenders. done = table + screenshots committed.

## 7. Verify + judge

- [ ] 7.1 Boot the REAL game at seed 1234, `?worldgen=1`, **both `?perf=low` and
      `?perf=high`**: no console errors; backtick budget panel within tier
      (slotting added no draws). done = console clean + HUD screenshot both tiers.
- [ ] 7.2 Arrival check in-game: spawn is on a road, arch ahead, main stage
      beyond it (`spawn-arrival` plan rule + visual). done = screenshot.
- [ ] 7.3 Gary playtest pass with the marker hotkey: drop pins on anything that
      still reads wrong; fold coordinates back as fixes or recorded warns.
      done = markers triaged; no error-severity surprises.
- [ ] 7.4 `/smart-review` of the change (rendering/gameplay/performance/sandbox/
      docs); fold must-fix findings back into tasks. done = review-summary persisted.

## 8. Close

- [ ] 8.1 CHANGELOG entries landed per-commit (extraction = dev-workflow/internal
      where behaviour-preserving; the grammar commit = player-visible). Confirm
      coverage. done = CHANGELOG reflects the landed work.
- [ ] 8.2 ROADMAP "Festival layout" section trimmed to shipped; the deferred
      follow-ups (per-truck customization, the `DEFAULT_WORLDGEN_V2` flip as a
      separate step) kept/added. done = ROADMAP reduced to what remains.
- [ ] 8.3 Session-log close-out; README refreshed (`bin/readme-sync`); note the
      flip is the next, separate change (v2 HANDOFF order). done = readme-sync
      fresh; flip recorded as next step.
