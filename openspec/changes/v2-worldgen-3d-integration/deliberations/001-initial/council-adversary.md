# Council — The Adversary (Adversarial Architect)

**Change:** `v2-worldgen-3d-integration` — wire `src/worldgen/` into the live 3D game
**Round:** 1 (independent position)
**Lens:** what breaks — determinism, Safari module-freeze, iOS audio, sandbox-pass-but-game-crash, lifecycle disposal, boot order.

---

## Position Summary

The plan is unusually tripwire-aware — the proposal and design already cite footguns #2, #4,
#5 by number and the contract header in `src/worldgen/index.js:11-13` enforces the
append-only rule. That's good hygiene. But "aware of the tripwire" is not "safe across the
tripwire," and I found four places where the plan's own decisions quietly *create* the bug
they claim to dodge. The biggest is structural: **the road junction-merge (D-I / Task 1.1)
changes what roads look like but the self-test (T4/T5) and the placement gates
(`noBuild`/`onRoad`/`facing`) read the *un-merged* first-pass polylines** — so the harness
that's supposed to gate this change is blind to the exact thing the change adds, and the
3D world's "no structures on roads" promise can silently desync from the rendered roads.

The boot path is friendlier than feared: `buildWorld(scene, crowd)` runs at module-eval
(`src/main.js:232`), NOT inside the start gesture, and the seed is resolved at module-eval
(`src/main.js:63` IIFE) before that. So the iOS-audio async-hop risk is LOW *as written* —
but only as long as the plan doesn't move seed routing or any worldgen warm-up into the
start handler. I flag the trap so it stays closed.

---

## Priority Sequence (order of operations)

I'd reorder the migration plan so the *determinism harness covers the new road geometry
before any 3D code consumes it*, and so the cheapest crash-surface (boot) is proven first.

1. **Extend the self-test to the merged network FIRST, before merging (Task 1.1).**
   Add the merge-aware T4'/T5' (see V1) so the harness has teeth on the thing being added.
   A merge pass that passes the *old* T4 is meaningless — T4 reads raw `arterial(A,B)`.
2. **Junction-merge in 2D + record the new golden** (Task 1.2/1.3). Re-run the golden in
   **Node AND a browser** here, not at Task 9.2 — the merge adds `atan2`/bearing-cluster
   math, the single most cross-engine-fragile new code in the change.
3. **Scaffolding + flag + importmap-in-BOTH-html + boot smoke test** (Task 3). Prove the
   game boots with the flag ON and a *stubbed* placement that places nothing, so the
   `_generate → placement` call chain is exercised empty before it does work. This isolates
   "the wiring is sound" from "the placement is correct" — the `{group,...}` vs `Group`
   crash class hides in the wiring.
4. **Roads (Task 4)** — but pin down the single road-source-of-truth question (V1) before
   wiring `nearestRoad` into `noBuild`.
5. **Lakes (Task 5)** — verify the worldgen-outline → ShapeGeometry → collider winding
   contract (V4) in the *game*, not just the map sandbox. This is the highest
   collider-correctness risk.
6. **Forests (Task 6)** — perf-gate at `?perf=low` the moment the scatter lands (V6).
7. **Themes/props (Task 7)** — resolve the role/rank vocabulary collision (V3) before
   writing the placement table.
8. **Crowd (Task 8)** — verify no NaN-feed into the spawn path on an all-outskirts cell (V7).
9. **Determinism + cross-engine + perf gate (Task 9)**, **verify/review (Task 10)**,
   **docs (Task 11)**.

The migration plan's phase order is fine; my changes are: pull the merge-aware self-test
*ahead* of the merge, pull the cross-engine golden *up* to the merge step, and insert an
empty-placement boot smoke test in scaffolding.

---

### Vulnerabilities Found

- **V1 — The junction-merge desyncs rendered roads from the placement gates, and the
  self-test can't see it. — Severity: Critical.**
  D-I / Task 1.1 adds a 2nd pass that merges arterials into trunks+forks, and Task 1.3 says
  "the 3D road renderer consumes the *merged* network." But `nearestRoad`
  (`src/worldgen/roads.js:232`) — which is what produces `onRoad`, `roadTier`, `facing`,
  and feeds `noBuild` in `src/worldgen/index.js:65,72` — reads `arterialsNear` →
  `arterial(A,B)` (`roads.js:207-227`), the **raw first-pass polylines**. The self-test T4
  (`src/worldgen/selftest.js:101-107`) and T5 (`:111-117`) *also* call `nearestRoad`, so
  they validate the raw network too. Net: if the 3D renderer draws merged trunks but
  `noBuild`/`facing` are computed from un-merged arterials, a stage can be placed where the
  *old* arterial ran (now empty) and a road can be *rendered* through a spot worldgen calls
  build-OK. The change's headline promise — "structurally kills stages-on-roads" — is exactly
  what desyncs, and the green self-test (Task 9.1) gives false confidence because it never
  exercises the merged geometry. **Mitigation:** decide one source of truth: either (a)
  `nearestRoad`/`roadsInBounds` BOTH consume the merged network (then T4/T5 must be re-derived
  for the merged polylines and the golden re-recorded), or (b) the 3D renderer consumes the
  RAW network and the merge is a pure cosmetic 2D-sandbox-only visualization that never
  reaches the game (contradicts Task 1.3's "3D consumes the merged network"). Pick one in
  design before Task 4. This is the one I'd block on resolving.

- **V2 — A heart-anchor chunk that crosses a lake/road can crash the longest call chain on a
  `{group,...}`-vs-`Group` return-shape mismatch. — Severity: High.**
  D-C / Task 7.1 has exactly ONE chunk (the heart-center chunk) build the anchor — main
  stage + court + arch — and it's the rarest, least-exercised path (~1 per ≥440m, design.md
  risk bullet 2). The sandbox cannot reproduce it: the heart-anchor placement only exists in
  `placement.js` + the chunk sampler, which the per-entity `sandbox.html` never runs (it
  builds models in isolation via `loadEntity()`), and `map-sandbox.html` is 2D and renders no
  models at all. So this path is **sandbox-invisible by construction** — the precise
  condition that produced the documented `buildCampChair` crash (CLAUDE.md "ALWAYS boot the
  main game"). The risk compounds because hearts "may sit lakeside or even over water"
  (`src/worldgen/hearts.js:23-26`): the anchor chunk may also be running the lake-suppression
  branch (`src/chunks.js:443-446`) and the road-clip branch in the same `_generate`.
  **Mitigation:** Task 3's empty-placement boot smoke test must *also* teleport to a known
  heart-center chunk (deterministic at a fixed seed) and boot there — add a `__dbg.teleport`
  to a heart coord to the milestone checklist, because the default spawn (0,0) is the pinned
  origin chunk (`src/chunks.js:416`) and may not be a worldgen heart at all.

- **V3 — `roleTier` words and `heart.rank` words collide; the placement table will index on
  the wrong axis. — Severity: High.**
  D-B's table reads `core+major`, `core+minor`, `district+major`, etc. But the engine has two
  *different* string enums: `roleTier(heart,dist)` returns `'core' | 'district' | 'outskirts'`
  (`src/worldgen/roles.js:8-13`, a *distance band*), and `heart.rank` returns
  `'minor' | 'major'` (`src/worldgen/hearts.js:43-44`, the heart's *size class*). The design
  bullets pair them as "`core + major`" which mixes one word from each enum — readable to a
  human, a landmine to a `switch`. A `placement.js` that switches on `roleTier === 'major'`
  (never true) or `heart.rank === 'core'` (never true) silently places nothing or always falls
  through to the default, and the bug is invisible until you notice the world is too sparse —
  no crash, no error, just a wrong world that still passes the green self-test. **Mitigation:**
  `placement.js` must key on the tuple `(roleTier, heart.rank)` explicitly with both enums
  named, and the design table should be rewritten as `core×major`, `core×minor`, `district×major`
  to make the two axes unambiguous. Cite the two source enums in the module header.

- **V4 — Lake collider winding: worldgen's CCW outline meets `lakes.js`'s reversed
  ShapeGeometry walk and inward-normal assumption — a sign flip here puts the collider ring on
  the WRONG side of the shore. — Severity: High.**
  `placeSealedColliders` (`src/lakes.js:224-265`) hard-assumes a **CCW** outline with
  "interior to the left," computing the inward normal as `(-edz, +edx)` (`:250-256`), while
  `buildLake` walks the outline **in reverse** to feed `ShapeGeometry` because of the X→
  (sx,0,sy) mapping (`:323-327`, comment "We walk the outline IN REVERSE to get CW"). That's a
  carefully-balanced pair of sign conventions that only holds for `buildLakeOutline`'s specific
  vertex order. D-E swaps the placement source to worldgen's `_computeLake` outline
  (`src/worldgen/water.js:62-78`), which builds vertices via `for i in 0..N: t = (i/N)*2π;
  ex=major*cos t, ez=minor*sin t` then rotates — a *different* winding generator. If worldgen's
  outline is CW (or rotation flips it), the inward normal points OUTWARD and the sealed-ring
  colliders land *outside* the water — the player drives straight into the lake and takes no
  damage, OR the water mesh renders inside-out (`DoubleSide` at `src/lakes.js:67` masks the
  visual, so you won't *see* the bug — only feel it as missing collision). And because lake
  colliders carry NO chunkKey (`:259-264`, footgun #5, correctly preserved), a wrong-side
  collider persists for the whole session. **Mitigation:** before Task 5, assert the worldgen
  outline winding (signed area) and either match `lakes.js`'s expectation or fix the reverse-walk
  + normal sign together (they must change as a pair). Verify by driving INTO a worldgen lake in
  the booted game with `__dbg` and confirming damage — `showColliders` overlay at the shore.

- **V5 — The module-global `_arterialCache` is gated on `(seed, epoch)` but the game never
  bumps epoch, and a stray `bumpWorldgen()` (or a shared sandbox import) would silently rebuild
  the world mid-session. — Severity: Medium.**
  `arterial()` (`src/worldgen/roads.js:182-193`), `lakeInCell` (`water.js:22-35`), and
  `heartInCell` (`hearts.js:18-36`) all clear their memo when `getSessionSeed()+':'+epoch`
  changes. In the game the seed and epoch are fixed, so the caches are write-once — fine. But
  the caches are **module-global mutable state shared across every consumer of these modules**.
  If the eventual in-game map view (parked, but the contract anticipates it) ever calls
  `bumpWorldgen()`, or if `map-sandbox.html` and the game ever co-resident in one context (they
  won't on the deploy, but an agent testing both in one tab could), the cache clears and chunks
  generated after that point re-derive identically — but any chunk already in `this.loaded`
  keeps its OLD geometry while new chunks use the same data, so it's a no-op *unless* CONFIG was
  also mutated. The real risk is narrower: the 200000/250000-entry cache-clear backstops
  (`roads.js:189`, `water.js:29`, `hearts.js:30`) silently `clear()` on a long session — that's
  a determinism-safe perf hiccup (re-derive is pure), but it's a 200k-Map allocation living for
  the whole session × three modules. **Mitigation:** confirm nothing in the 3D path calls
  `bumpWorldgen()`; treat the three caches' memory as part of the perf budget (V6); add a note
  that the game must never mutate CONFIG at runtime (only the sandbox does).

- **V6 — Per-chunk `treeDensity` scatter can blow the low-tier draw/tri budget where the old
  5x5 forest never did, and the sandbox can't catch it. — Severity: Medium.**
  D-F / Task 6.1 replaces the 5x5-block forest (one designed forest per 25 chunks) with
  per-chunk scatter where `count ∝ density × cellArea × PERF.forestTreeDensityMul`. The old
  system concentrated trees in rare designed blocks; the new one can put trees in EVERY chunk
  the player crosses, and a lakeshore-ring chunk (`density.js:41-55`, boost up to 0.62) plus
  organic mass could spike tree count per 80m cell well past what the 5x5 ever produced in a
  single chunk. Low tier budget is 80 draws / 150k tris (CLAUDE.md #10). Trees are pooled but a
  scatter without an InstancedMesh path = N draws. The map sandbox is 2D (no tris), and the
  entity sandbox shows one tree — neither surfaces the aggregate. **Mitigation:** Task 6.3's
  `?perf=low` budget check is non-negotiable AND must be done while *driving through a
  high-density + lakeshore-ring region at boost*, not parked at spawn (allocation-vs-steady-state,
  `.claude/rules/performance.md`). Cap trees-per-chunk and prefer InstancedMesh per chunk
  (`instanceMatrix.needsUpdate = true` — footgun #7).

- **V7 — An all-outskirts / empty chunk could feed a zero/empty crowd path; verify it doesn't
  NaN or stub `zerble.update`. — Severity: Low.**
  D-A samples `queryRegion` and places "only what belongs." In deep outskirts a chunk may place
  zero structures, zero attractors, and `crowdCount` scaled by heart influence → 0 (Task 8.1).
  The existing `spawnAmbientCrowd(ctx, 0)` path and the NPC road-attraction (Task 8.2) must
  tolerate an empty attractor set and an empty road set without dividing by zero or feeding
  empty input to physics. `nearestRoad` returns `dist = Infinity, dirAngle = atan2(0-0,...)`
  when no road is in window (`roads.js:232-250` with empty `arterialsNear`) — `bx,bz` stay 0,
  so `dirAngle = atan2(-qz,-qx)`, a finite but meaningless angle, and `onRoad=false`. That's
  benign for `facing` (gated by `road.dist < HEART_CELL` at `index.js:58`), but a crowd
  road-attractor that trusts `dirAngle` without checking `dist < Infinity` could push NPCs
  toward a phantom road. **Mitigation:** the crowd road-attraction must gate on a real road
  (`onRoad` or `dist < threshold`), and Task 8.3's "never path into water" check should also
  cover "never path toward a phantom road in empty outskirts."

- **V8 — iOS audio: the boot path is safe AS WRITTEN — keep it that way. — Severity: Low
  (latent).**
  `buildWorld` runs at module-eval (`src/main.js:232`), the seed IIFE runs earlier
  (`:63-79`), and `Sound.init()` runs first and synchronously inside the start handler
  (`:419-422`, with the explicit comment guarding it). So the worldgen wire-in does NOT sit
  between the tap and `Sound.init()` and the iOS-suspension footgun is NOT triggered by this
  change as scoped. The latent risk: if any phase (esp. scaffolding "confirm seed routing
  reaches worldgen," Task 3.4) is tempted to *re-resolve* the seed or warm the worldgen caches
  inside the start handler to "make the first chunk faster," that inserts work before
  `Sound.init()` and on a slow device pushes the AudioContext creation off the synchronous
  gesture frame. **Mitigation:** keep all worldgen warm-up at module-eval / inside
  `buildWorld`, never in the start handler. Flag in the tasks: "no worldgen work in the start
  gesture before Sound.init()."

- **V9 — Cross-engine `sin/cos`/`atan2` can flip a road's *existence*, not just shore wobble —
  and existence flips a collider and a `noBuild`. — Severity: Medium.**
  The design (risk bullet 6) treats cross-engine divergence as "documented; cosmetic shore
  wobble" and water.js:11-15 says the same. That's true for the lake outline (containment is
  pre-quantized integer point-in-poly, `water.js:73,81-88`). But roads add a NEW cross-engine
  surface that ISN'T just cosmetic: `_computeArterial` (`roads.js:148-173`) decides whether a
  road *exists at all* via `crossesWater(straight)` and the around-the-lake detour, using
  `atan2`/`cos`/`sin` (`heartProxy` walk `:63-67`, `arcAround` `:103-118`, the `ccw`/`dir`
  tie-break `:163-169`). A low-bit `atan2` difference at the `Math.abs(ccw - Math.PI) < 0.05`
  tie-break (`:167`) picks the opposite wrap direction on JavaScriptCore vs V8 → a different
  detour polyline → possibly `crossesWater(detour)` true on one engine and false on the other →
  **the road exists on Chrome and is null on Safari**. A road's existence drives `noBuild`
  (`index.js:72`) and the crowd attractor — so a structure placed on Chrome lands in a road
  corridor on Safari, or vice-versa. That's not cosmetic; it's a per-engine world fork at a
  collider/placement boundary. **Mitigation:** Task 9.2's cross-engine golden MUST include
  road existence (`nearestRoad(...).onRoad` and arterial-null) across the sample grid, not just
  `queryPoint` tuples — and the tie-break at `roads.js:167` should be widened or quantized so
  it can't straddle the threshold differently per engine. This is the design's own "if it flips
  a collider's existence" caveat (risk bullet 6) — I'm asserting it DOES, at the detour
  tie-break, and so the integer-orientation test it defers is required, not optional.

---

## Verdict

**Proceed with mitigations.**

The plan is well-aligned with the tripwires and the worldgen substrate is genuinely
deterministic and seed-routed through the one door (`rng.js`), with fresh non-colliding salts
(`constants.js:66-76`) — footgun #4 is respected at the substrate. The boot path doesn't touch
the iOS gesture (V8) and lakes keep their no-chunkKey lifecycle (footgun #5, `lakes.js:259-264`).

But three findings must be resolved *in design, before Task 4 wires roads into placement*:

1. **V1 (Critical)** — pick ONE road source of truth (merged vs raw) for `nearestRoad`/`noBuild`
   and re-derive the self-test for it. As written, the harness is blind to the merge and the
   "no stages on roads" promise can desync from the rendered roads. I'd **block Task 4** until
   this is decided.
2. **V3 (High)** — fix the `roleTier`/`heart.rank` vocabulary collision in `placement.js` before
   the table is written, or the world silently generates wrong.
3. **V4 (High)** — verify the worldgen lake outline winding against `lakes.js`'s CCW-inward-normal
   assumption before swapping the placement source, or colliders land on the wrong side of the
   shore (invisible behind `DoubleSide`).

V9 (cross-engine road existence) upgrades the design's deferred integer-orientation test from
optional to required. V2/V5/V6/V7 are mitigable inside the phased plan with the milestone
checklist additions above (boot at a heart-center chunk; `?perf=low` while driving a dense
forest; phantom-road gating in crowd). None of these is a reason to abandon the approach —
they're reasons to sequence the self-test ahead of the merge and to boot the *real game* at a
*worldgen heart*, not just the sandbox, at every milestone.
