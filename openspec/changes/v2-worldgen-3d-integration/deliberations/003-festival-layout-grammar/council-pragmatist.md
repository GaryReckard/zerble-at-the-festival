# The Pragmatist's Position — Festival layout grammar (hub redesign)

> Round 1. Written in isolation. No Anticipated Tensions section.
> Domain lens: fastest path to a single hub Gary can drive into and judge —
> "does this read as a festival now?" — without cutting a safety corner.

## The single most important framing

**The expensive infrastructure already exists.** Three things I verified on disk
before forming an opinion, because they change the entire effort calculus:

1. **The whole build half is already `(x,z,yaw)`-parameterized and wired.**
   `buildWorldgenKind` (`chunks.js:1096`) is a dispatch table; every builder
   the spec touches already exists and already takes world position + yaw:
   `buildStage(ctx,x,z,isMain,yaw)` (`chunks.js:2089`, +Z = audience front,
   `stage.group.rotation.y = yaw`), `buildVendorRowAt(ctx,x,z,yaw)`
   (`chunks.js:1162`, +Z aligned to road tangent), `buildFoodCourtAt(ctx,x,z)`
   (`chunks.js:1193`, already has the inter-truck overlap guard the D2.3 surgery
   added), `buildEntranceArchAt` (`chunks.js:1114`), `buildBubbleVendorAt`
   (`chunks.js:1132`), `buildPottyBankAt` (`chunks.js:1151`),
   `buildDrumCircleAt` (`chunks.js:1810`), `buildCampVillageAt`
   (`chunks.js:1259`). Sugar shacks are ALREADY court-only (the solo-shack bug is
   already fixed). Each builder already takes its cluster-local `mulberry32(clusterSeed)`
   rng (`chunks.js:1097`) — R19 is already enforced.

2. **The harness CG1 from deliberation 002 already landed.** The map-sandbox
   `festival` POI overlay exists and is on by default (`map-sandbox.html:88,270-273`),
   drawing every `festivalPlan(heart)` cluster in 2D. The POI golden +
   window-invariance + major-window checks are in `selftest.js` (`:53,75,123,140`).
   `nearestMajorHeart` exists (`hearts.js:118`). The spawn block in `main.js:217-245`
   already reads `nearestMajorHeart(0,0)` → `festivalPlan` → spawns Zerble outside
   the arch facing the stage, rings intro jugs (`setSpawnPoint`), and dodges
   worldgen water with `lakeAt`. `approachRoadsOf` (`roads.js:84`) already returns
   exactly the inputs `F` needs: `{ neighbor, oriented (heart-first), bearing, lenQ }`.

3. **The arch banner (A2) is already `THREE.DoubleSide`** (`entranceArch.js:37`).
   If "FESTIVAL" reads mirrored from behind it's a texture-flip on a back copy, not
   a model rebuild — minutes, not a task.

**So this redesign is NOT a `festival.js` rebuild + a build-half rebuild + a
harness build. It is, almost entirely, a rewrite of ONE pure function —
`_computePlan` (`festival.js:172`) — plus ONE new no-tree-rect mechanism that
`scatterWorldgenTrees` honors (A4), plus deleting the per-hub arch.** That is a
force multiplier: the keystone (`F`) re-aims eight builders that already work, and
I can watch every re-aim land in the 2D overlay in seconds before booting the game
once. Effort here is small and the verification is cheap — exactly the shape that
should ship as one tight slice and get judged.

## Critical Path

The longest real dependency chain — and the smallest slice that lets Gary judge
"does this read as a festival now":

```
  computeFrontAxis F (§3, NEW, pure)              ← the keystone; everything aims off it
        │
        ├─ stage yaw = +F            (re-aim, buildStage already takes yaw)
        ├─ dancefloor rect along +F  (NEW data: an oriented no-tree rect descriptor)
        ├─ drag = roads[0] (already sorted longest-first, festival.js:180)
        │     ├─ vendor rows on the drag, out past dancefloor  (re-aim buildVendorRowAt)
        │     └─ food court on the drag, out past dancefloor    (re-aim buildFoodCourtAt)
        ├─ drum circle in treed pocket BACK/side (treedDistrictSpot exists, festival.js:136)
        ├─ bubble vendor (already guaranteed, festival.js:241)
        └─ porta-banks at margins (addPotty exists, festival.js:184 — re-aim away from F+ring)
        │
   overlap guard pass (§5, NEW, pure ~15 lines)   ← the safety net
        │
   scatterWorldgenTrees honors dancefloor rects (A4, the one cross-module edit)
        │
   delete per-hub arch from _computePlan; spawn arch already lives in main.js:217
        │
   BOOT one hub at ?worldgen=1, judge.            ← THE CHECKPOINT
```

`F` is the force multiplier: it is the ONE new computation, it is pure and
unit-checkable headlessly, and every downstream placement is a re-aim of a builder
that already works. Get `F` right and eight collisions resolve at once. Get the
overlap guard in as insurance and "row through stage" is structurally impossible.

**The whole critical path is in the pure layer + one tree edit.** Nothing on it
needs new models, new pools, new audio, or new crowd states. That is why the first
shippable slice is small.

## Priority Sequence

1. **`computeFrontAxis(heart, roads, lake)` — the keystone (§3), pure, in
   `festival.js`.** Widest-dry-gap bisector between road outward bearings; water
   penalty by walking `core + dancefloorDepth` along the candidate and testing
   `queryPoint(...).noBuild`/`inLake`/`nearestLake`; **quantize the chosen bearing
   to a fixed grid index before any downstream compare** (footgun #4 / R20 — this
   is the new trig-fork surface and the most determinism-load-bearing line in the
   whole change). 0-road fallback: 16-bearing sample, tie → lowest quantized index.
   Verify FIRST in the map-sandbox overlay and the headless self-test, before a
   single mesh moves. This is one function and it gates everything.

2. **Re-aim the existing placement rules in `_computePlan` to `F` + the drag (§4).**
   Stage yaw → `+F`. Drag = `roads[0]` (already sorted longest-first). Vendor rows
   + food court walk OUT past `core + dancefloorDepth` on the drag, perp-offset off
   the corridor (the `walkOriented`/`perpOff` helpers at `festival.js:94,110`
   already do this). Drum circle stays `treedDistrictSpot` but constrained to
   BACK/side of `F`. Porta-banks at margins (re-aim `addPotty`). These are edits to
   an existing function consuming existing helpers — no new code surface. Watch each
   in the 2D overlay.

3. **Add the dancefloor-clearing rect as plan data + teach `scatterWorldgenTrees`
   to honor it (A4).** This is the one genuinely cross-module piece: a stage emits
   an oriented no-tree rect (origin, +F direction, depth ≈ 3 stage-lengths, width ≈
   stage-width + margin); `placeWorldgenProps`/`placeChunkProps` must expose those
   rects to `scatterWorldgenTrees(ctx)` (`chunks.js:988`), which adds one
   point-in-oriented-rect test next to its existing `pointNearWorldgenRoad` skip
   (`:1001`). Cheap test, but it's the only edit that crosses the pure/build seam,
   so it carries the most integration risk — boot the game after this one.

4. **Add the §5 overlap guard pass** at the end of `_computePlan` — each cluster
   carries its footprint radius (already in `KIND_FOOTPRINT`, `festival.js:63`);
   push a later cluster outward along its ray until clear, drop if it can't.
   ~15 pure lines. This is the belt-and-suspenders that makes the sectoring robust
   even when two rules aim at the same ground.

5. **Delete the per-hub arch** (`festival.js:199-207`). The spawn arch already
   lives in `main.js:217-245` and works. This is a deletion, and it also removes a
   per-hub `idx++` rng draw — which **moves the POI golden** (expected, flag-off
   per §7). Re-record the golden on node AND a browser engine in the same commit.

6. **THE CHECKPOINT — boot ONE hub at `?worldgen=1`, judge.** Per the mandatory
   smoke test (CLAUDE.md "ALWAYS boot the main game"): title card → start → drive
   in through the spawn arch → confirm the stage reads off to the side (Gary's §6
   call), the dancefloor is clear in front of it, no chairs in water, no row through
   the stage, no court with a road/porta inside it. Screenshot noon + midnight, on
   `?perf=low` and default tier. **This is the "ship this first, judge it, then
   continue" gate.** If Gary says "yes, this reads as a festival now," everything
   below is fast-follow. If not, iterate on `F` scoring + the §5 guard — both pure,
   both eyeball-able in the overlay, both cheap.

### Layout-grammar items (MUST land with the rebuild) vs fast-follows (PARK)

The grammar's job is **arrangement**: which way the hub faces and how its existing
pieces relate. An item belongs in the rebuild ONLY if the hub can't read as a
coherent festival without it. Everything else is decoration on a hub that already
reads right, and should wait for the checkpoint.

**MUST land with the festival.js rebuild (they ARE the grammar):**

- **A3 (no road in front of stage)** — true by construction once `F` is the widest
  dry gap between roads. This is the whole thesis; it's not a separate task, it's
  step 1.
- **A4 (dancefloor tree-clearing)** — without it the stage faces a wall of trees
  and "faces open ground" is a lie. Step 3. The one cross-module edit.
- **A5/A6 (rows + courts on the drag, away from the stage)** — without it the
  "row through stage" disaster recurs. Re-aim, step 2.
- **A8 (porta-banks at margins, not in dancefloor/ring)** — a porta in the
  dancefloor is exactly the kind of "broken layout" playtest note. Re-aim, step 2.
- **A1/A2 (one arch at spawn; banner readable)** — A1 is a DELETION (step 5) +
  already-built spawn arch; A2 is a minutes-long texture fix on an
  already-`DoubleSide` banner. Both ride along for free; no reason to defer.
- **The §5 overlap guard** — the structural guarantee. Step 4.

**PARK until one hub reads right (fast-follows — explicitly named in the prompt):**

- **C2 — new picnic-table entity + crowd "seated at picnic table" state.** This is a
  whole NEW model (importmap×3, sandbox entry, hit kind) PLUS a new crowd state —
  the single biggest scope item in the backlog, and it changes NOTHING about
  whether the hub reads as a festival. A7 (food-court center plaza) can reserve the
  cleared space now (it's just a bigger ring radius — a number), and the tables drop
  in later. **Park C2 entirely. Nothing in the grammar is blocked by it.**
- **C1 — tree-anchored hammocks (no posts).** Requires a post-pass over
  `scatterWorldgenTrees` trunk pairs within hammock span — a new mechanism on top of
  the tree scatter, which I'm already editing for A4. Doing both at once muddies the
  "did A4 clearing land?" signal (one-variable rule). It's atmosphere, not
  arrangement. **Park to the same fast-follow as G1/F1.**
- **E2 — people-taxonomy doc.** Pure documentation; touches no placement, blocks no
  layout. Genuinely valuable but orthogonal. **Park. Do it any time; it gates
  nothing.**
- **H1 — Lurleen spawn/leash.** This is a `lurleen.js` + spawn-block concern, NOT a
  `festival.js` layout concern. It rides the same `main.js` spawn block the arch
  spawn already uses, so it's adjacent code — but it's a separate behavior with its
  own v1-logic-migration. **Park; do it as a tight standalone after the checkpoint
  (it's small and self-contained).**
- **Density re-settle** — explicitly "after one festival reads right" per the spec
  (§9.6) and the backlog (order item 8). Re-tuning density mid-rebuild destroys the
  "did the GRAMMAR work?" signal — you can't tell an arrangement win from a density
  win if you move both. Also the 23/24 self-test-teeth question must be decided
  deliberately, not as a side effect. **Park hard until after the checkpoint.**
- **B1 (tent stage variety), B2 (verify full drum circle), D1/D2/D3 (camp rules +
  tent-count-to-crowd + camps-behind-vendors), G1 (picnic blankets), C3 (tiki
  torches), F1 (lone field trees), E1 (crowd road-follow).** All atmosphere/variety
  on a hub that already reads right. Each is a clean fast-follow. **Park all of
  them.** (B2 is just a verification — do it during the checkpoint boot, it's free.)

### Reuse vs new code

**Reuses the existing harness/pools (no new code) — the bulk of the work:**

- `buildStage` yaw (`chunks.js:2089`) — already rotates the whole group to `yaw`;
  just feed it `+F` instead of `roadFacingYaw(facing)`.
- `buildVendorRowAt` (`chunks.js:1162`) — already aligns +Z to the road tangent;
  feed it the drag tangent + an out-past-dancefloor walk distance.
- `buildFoodCourtAt` (`chunks.js:1193`) — already has the inter-truck overlap guard,
  already court-only sugar shacks, already an edge bubble vendor. A7 center plaza =
  a larger ring radius (a number). No new code; tune one constant.
- The campsite tiki pools / `buildPottyBankAt` / `buildBubbleVendorAt` /
  `buildDrumCircleAt` / `buildCampVillageAt` — all exist, all take `(x,z[,yaw])`.
- `walkOriented` (`festival.js:94`), `perpOff` (`:110`), `nudgeOff` (`:117`),
  `treedDistrictSpot` (`:136`), `clusterSeed` (`:83`) — all the placement primitives
  `F` needs already exist in the pure layer.
- The map-sandbox 2D overlay + the headless self-test golden — already there. I
  verify `F` and every re-aim in the overlay before booting once.
- `approachRoadsOf` (`roads.js:84`) returns `{oriented, bearing, lenQ}` — exactly
  `F`'s inputs. No new worldgen export needed.

**Needs new code (small, contained):**

- `computeFrontAxis` — one new pure function (~30 lines) in `festival.js`.
- Dancefloor no-tree rect — new plan DATA (a rect descriptor per stage) + one
  point-in-oriented-rect test in `scatterWorldgenTrees` (~10 lines) + the plumbing
  to pass the rects from the plan to `scatterWorldgenTrees`. The only pure/build
  seam crossing — highest integration risk, smallest LOC.
- §5 overlap guard — ~15 pure lines at the tail of `_computePlan`.
- A2 banner back-face fix — a texture/flip tweak in `entranceArch.js`.

**Needs new code but PARKED (the real net-new scope, deferred):** the C2 picnic-table
model + crowd seating state, C1 tree-pair hammock pass, H1 Lurleen leash. None on the
critical path.

## Risks / Concerns (my domain — delivery & verification)

- **The A4 tree-clearing is the one cross-module integration risk, and it's the
  highest sandbox-pass-game-fail surface.** The pure layer can't see whether
  `scatterWorldgenTrees` actually honored the rect — the 2D overlay shows the rect
  but the trees are placed in `chunks.js`. The plumbing (plan rects → `ctx` →
  `scatterWorldgenTrees`) crosses the seam the CLAUDE.md doctrine warns about
  (`buildCampChair` return-shape class). **Concrete failure mode:** the rects don't
  reach `scatterWorldgenTrees` (wrong ctx field, or the rects are per-hub but trees
  are per-chunk and the chunk doesn't enumerate the owning hub), the overlay looks
  perfect, the game boots with trees in the dancefloor, and we declare done off the
  overlay. **Mitigation:** boot the game immediately after step 3 specifically to
  eyeball the cleared dancefloor — don't batch it with steps 4-5.

- **`F` scoring is a feel knob masquerading as a determinism surface.** Getting the
  water penalty weight and `dancefloorDepth` right is iteration, not correctness —
  but the quantize-before-compare on the chosen bearing IS correctness. **Failure
  mode:** an unquantized `F` bearing forks the entire hub layout (stage orientation,
  drag side, dancefloor direction) between Safari and Chrome — two players on the
  same seed see different festivals. This is R20 re-run on a NEW, more load-bearing
  surface than the prior road pick. **Mitigation:** the quantize is a one-liner, the
  golden runs on node + browser, and the map-sandbox self-test catches a fork — all
  already-built infrastructure. Don't skip the dual-engine golden re-record on step 5.

- **Don't let A7's "center plaza" pull C2 forward.** The plaza is a number (ring
  radius); the picnic tables are a whole entity + crowd state. The temptation to
  "finish the food court properly" by building the tables now is exactly the
  over-build the checkpoint exists to prevent. Reserve the space, ship, judge,
  THEN populate it.

- **Re-tuning counts/density mid-rebuild is the classic one-variable violation.**
  The backlog's "current experimental config" is uncommitted and tempting to fold in.
  Don't. Carry the tuned counts UNCHANGED (the prior council's convergence point),
  ship the arrangement change alone, and re-settle density as a separate, judgeable
  slice after the checkpoint. Otherwise Gary can't tell whether the hub reads right
  because of `F` or because of density.

- **`DEFAULT_WORLDGEN_V2` must stay flag-off through this whole change** (R23). The
  live GitHub Pages deploy is watched by real players; every WIP commit on this
  branch must NOT ship the in-progress layout. Verify the default before the first
  commit.

## Deferred / Park on ROADMAP

- **C2 (picnic-table entity + crowd seating):** Park. The hub reads as a festival
  without anyone sitting at a table. A7 reserves the plaza space now; tables drop in
  later. Nothing in the grammar is blocked.
- **C1 (tree-anchored hammocks):** Park. Atmosphere, and it stacks a second new
  mechanism on the tree scatter I'm already editing for A4 — separating them keeps
  the A4 signal clean.
- **E2 (people-taxonomy doc):** Park. Pure docs; gates no layout. Do it whenever.
- **H1 (Lurleen spawn/leash):** Park. A `lurleen.js`/spawn behavior, not a layout
  concern. Small standalone fast-follow after the checkpoint.
- **Density re-settle + the 23/24 negative-control-teeth decision:** Park hard until
  the checkpoint. Moving density now destroys the "did the grammar work?" signal.
- **B1, B2, D1/D2/D3, G1, C3, F1, E1:** Park. All variety/atmosphere on a hub that
  already reads right. (B2 verification is free during the checkpoint boot.)

What is NOT blocked by deferring any of these: a single hub that Gary can drive into
and judge for arrangement. That hub needs only `F`, the re-aims, A4, the overlap
guard, and the arch deletion — all on the critical path above.

## Incremental Delivery Plan

- **Slice 1 (ship first, JUDGE, then continue):** The grammar core —
  `computeFrontAxis` (quantized) + re-aim stage/rows/court/drum/bubble/porta to `F`
  + the drag (§4) + the A4 dancefloor clearing + the §5 overlap guard + delete the
  per-hub arch (A1) + the A2 banner fix. Re-record the POI golden on node + browser.
  **Verify:** every re-aim in the map-sandbox 2D overlay as you go; then BOOT the
  spawn hub at `?worldgen=1`, drive in through the arch, screenshot noon + midnight
  on `?perf=low` + default. This is the whole "does this read as a festival now"
  answer in one shippable, flag-off slice. **Enables:** the judgment that unblocks
  everything else. If Gary says yes, Slice 2+ are pure additions to a hub that
  already works. If no, iterate on `F` scoring + the guard — both pure, both cheap.

- **Slice 2 (ship after Slice 1 is judged good):** Variety + camps — B1 tent-stage
  in the catalog, B2 full-drum-circle confirmation, D1/D2/D3 camp rules +
  tent-count-to-crowd + camps-behind-vendors. **Depends on Slice 1:** these
  populate a hub whose arrangement is already settled; doing them first would mean
  re-checking variety against a layout that's still moving.

- **Slice 3 (atmosphere):** G1 picnic blankets near stages, C3 tiki-torch edge
  markers, F1 lone field trees, C1 tree-anchored hammocks. **Depends on Slice 1:**
  decoration on a settled hub. C1 specifically waits so it doesn't stack on the A4
  tree-scatter edit.

- **Slice 4 (new entity + seating):** C2 picnic-table model (importmap×3 + sandbox +
  hit kind) + crowd "seated at table" state, dropped into the A7 plaza space Slice 1
  reserved. **Depends on Slices 1-2:** the only genuinely net-new scope; isolated so
  it can be sandbox-verified on its own before integration.

- **Slice 5 (behavior + docs, parallelizable):** E1 crowd road-follow strengthening,
  E2 people-taxonomy doc, H1 Lurleen spawn/leash. **Independent of the layout
  slices** — can land any time after the checkpoint.

- **Closing gate (separate, deliberate):** density re-settle + the 23/24 teeth
  decision, then the queued H.2/H.3/F.5 cross-engine + per-tier + real-device checks,
  then I-landing (flip `DEFAULT_WORLDGEN_V2`, ARCHITECTURE rewrite, ROADMAP trim).
  **Depends on every slice above being judged good** — this is where the flag flips
  and real players see it.

## Verdict

- **Verdict:** **Proceed.**
- **Key Concern:** The A4 dancefloor tree-clearing is the one edit that crosses the
  pure/build seam (`festival.js` plan rects → `scatterWorldgenTrees` in `chunks.js`)
  — it's the highest sandbox-pass-game-fail risk in an otherwise pure-layer change,
  and it's the piece the 2D overlay can't fully verify. Boot the game to eyeball the
  cleared dancefloor immediately after that step, not batched with the rest.
- **Recommendation:** Proceed, because the cost calculus is unusually favorable: the
  build half, the harness, the spawn block, and the determinism golden ALL already
  exist on disk — this is a rewrite of one pure function (`_computePlan`) plus one
  cross-module tree edit plus an arch deletion, all verifiable in the 2D overlay
  before a single game boot. `F` is a true force multiplier (one new function
  re-aims eight working builders and makes A3 true by construction). Ship Slice 1
  flag-off, drive into the spawn hub, and let Gary judge "does this read as a
  festival now" — then everything else is additive on a hub that already works. Park
  C2, C1, E2, H1, and the density re-settle until after that checkpoint; folding any
  of them in now adds net-new scope or destroys the one-variable signal the
  checkpoint depends on.
