# Deliberation Summary

## Context

-   **Task**: Stress-test, before building, the plan to wire the already-built,
    deterministic 2D `src/worldgen/` generator (hearts → arterial roads → lobed
    lakes → density forests; self-test 20/20) into the live 3D game as v2
    worldgen — a deliberate, flag-gated, world-regenerating break.
-   **Personas Consulted**: Architect, Adversary, Profiler, Pragmatist, Auditor + Mediator
-   **Mode**: Synthesis (no Round 2 — tensions surfaced by the Mediator)
-   **Date**: 2026-06-06
-   **Verdicts in**: 5/5 personas returned **Proceed with mitigations**. Zero Blocks; one *conditional block on a single task* (Adversary: block Task 4 until the road source-of-truth is decided).

---

## The Single Most Important Decision (resolve before anything else)

**The road source-of-truth question (V1 / Adversary, echoed structurally by the Architect's note #7).**

The junction-merge (D-I / Task 1) produces a *merged* road network (trunks +
forks). But every placement gate the game relies on reads the **raw first-pass
arterials**:

-   `nearestRoad` (`roads.js:232`) → `arterialsNear` → `arterial(A,B)` (`roads.js:207-227`) — **raw polylines**.
-   `nearestRoad` produces `onRoad`, `roadTier`, `facing`, and feeds `noBuild` (`index.js:65,72`).
-   The self-test T4 (`selftest.js:101-107`) and T5 (`:111-117`) also call `nearestRoad` — so **the harness validates the raw network, not the merged one.**

Task 1.3 says "the 3D road renderer consumes the *merged* network." If that ships
as written while `noBuild`/`facing` keep reading raw arterials, you get a silent
desync: a stage can land where the *old* arterial ran (now visually empty), and a
*rendered* merged road can pass through a spot worldgen still calls build-OK. The
green self-test gives false confidence because it never exercises merged geometry.

### Resolution: **Option (b) — the 3D game consumes the RAW arterial network for both rendering and gates. The junction-merge becomes a 2D-sandbox-only cosmetic visualization that never reaches the game in this change.**

Rationale, in tripwire-priority order:

1.  **Safety/correctness trumps all.** A single source of truth for "where is a
    road" is the only configuration in which `noBuild`/`facing` (placement),
    the rendered ribbon, the crowd attractor, and the self-test/golden all agree.
    Option (b) keeps them aligned with **zero new generator logic on the game
    path** — so the contract stays append-only, the self-test stays green *by
    construction*, and the golden does not move for the 3D wire-in (only the
    isolated 2D merge slice would move it, and that slice is deferred).
2.  **The Adversary's V9 (cross-engine road *existence* flip) and the Profiler's
    sampler-cost finding both get smaller, not larger,** because no merge math
    (`atan2`/bearing-cluster, the single most cross-engine-fragile new code)
    enters the per-chunk hot path or the game's determinism surface.
3.  **The Pragmatist's critical-path analysis independently lands here:** the
    junction-merge "produces zero in-game pixels," the world reads as a coherent
    place with raw per-edge arterials, and the merge is fully verifiable in
    `map-sandbox.html` alone. Deferring it isolates the *only* determinism-moving
    work into one late, separate slice.
4.  **Simplicity breaks the tie.** Option (a) — make `nearestRoad`/`roadsInBounds`
    BOTH consume the merged network — is *viable* but forces re-deriving T4/T5
    for merged polylines, re-recording the golden in Node AND browser, and
    threading the merge through the determinism + cross-engine gate, all on the
    critical path. That is strictly more risk for a cosmetic ("that road's a bit
    redundant") win.

**Consequence for delivery order:** the junction-merge (current Task 1) moves OUT
of this change and becomes a **fast-follow** (its own small change), as the
Pragmatist recommends. The append-only contract field it would eventually add
(merged roads on `queryRegion`) can ship later as an additive passthrough — the
3D consumer does not need it now.

> If Gary prefers Option (a) (merged everywhere) for visual quality reasons, that
> is a legitimate override — but it MUST then re-derive T4/T5 and re-record the
> cross-engine golden against the merged network *before* Task 4, and it pulls
> the junction-merge back onto the critical path. The council's recommendation is
> (b); flagging the lever.

---

## Synthesized Plan (Change Groups — foldable into tasks.md)

The groups below are ordered by the **resolved delivery order**. Each maps to the
existing tasks.md numbering so it folds in directly. The headline reorder: the
junction-merge (old §1) is deferred; scaffolding leads; roads come second;
placement (the crash-prone headline) comes third while context is freshest.

### Change Group A — Determinism + Source-of-Truth Decision (do first, paperwork-only)

**Scope**: Lock the road source-of-truth decision into the artifacts before any
code. No `src/` edits.
**Estimated Effort**: ~30 min (doc edits).
**Tripwire protected**: Determinism (#4) + the self-test/golden gate.
**Owner rationale**: Adversary V1 (Critical), Architect #7, Pragmatist §8.
**Tasks** (fold as a new §0 / amend §1 + §2.1):
1.  Record in `design.md` (new decision, e.g. **D-I revised**): the 3D game
    consumes the **raw arterial** network for both rendering and the
    `noBuild`/`facing`/crowd gates. `nearestRoad`/`roadsInBounds` are the single
    source of truth and are **unchanged** by this change.
2.  Move the junction-merge (old §1.1–1.4) to a **separate fast-follow change**
    (`worldgen-road-junction-merge` or similar). Strike §1 from this tasks.md;
    note the fast-follow in ROADMAP (§11.2/§11.4).
3.  Re-confirm in `design.md` that the contract tuple stays append-only and the
    self-test stays 20/20 **by construction** (the 3D wire-in only *reads* the
    unchanged contract; only per-chunk scatter jitter adds a fresh salt — D-H).

### Change Group B — Scaffolding, Flag, Importmap, Salt Reservation, Empty-Placement Boot (old §3)

**Scope**: The force-multiplier gate. Nothing player-visible lands until this is in and boots clean both ways.
**Estimated Effort**: ~2–3 hrs.
**Tripwires protected**: No-build/importmap (#1), determinism salt namespace (#4), boot integrity (sandbox-pass ≠ game-pass), iOS audio (#3, latent).
**Owner rationale**: Architect #1/#8, Auditor §1/§3/§82, Pragmatist Slice 0, Adversary V2/V8.
**Tasks** (amend §3):
1.  **(§3.2) Importmap-in-BOTH, FIRST.** Add all **8** `src/worldgen/*` modules
    (`constants, hearts, water, roads, density, roles, index, selftest`) to the
    `mods` array in BOTH `index.html` (87-89) and `sandbox.html` (177-179).
    Today **0/8** are present in either (only `map-sandbox.html` lists them).
    **Confirm the cache-buster resolves nested `worldgen/index`-style paths**
    (`map-sandbox.html` already loads them, so the resolution path exists —
    mirror its mechanism). *Auditor §1, Architect #8.*
2.  **(§3.1) Flag.** `USE_WORLDGEN_V2` resolved **once at module load** (const +
    `?worldgen=0` override), read **once per chunk**, never per-placement-point
    (per-frame branch noise). *Pragmatist §4.*
3.  **(§3.3) `placement.js` skeleton — pure + three-free.** Lives inside
    `src/worldgen/`; returns plain descriptors `{kind, localX, localZ, yaw,
    footprint, ...}` ONLY. **Must NOT import `three` or `models/*`** — the
    `buildX() → Group → position → registry.add` work stays on the `chunks.js`
    side, preserving the render-agnostic boundary that keeps the self-test and
    `map-sandbox.html` runnable. **Add `worldgen/placement` to BOTH importmaps in
    the same commit it is created.** *Architect #3, Auditor §82.*
4.  **(§3.3, new) Reserve `placement.js`'s jitter salt** as a named constant in
    the `0x4D41_xx` worldgen `SALT` namespace (`constants.js:66-76`) the day the
    module is created, with a header comment asserting non-collision with the
    existing salts (theme=1, `STYLE_SALT=0xC4FE7B2A`, `SPAWN_JUG_SALT=0x5A17B0BB`,
    `POTTY_SALT=0x9E3779B1`). *Auditor §3.*
5.  **(§3.4, hardened) Empty-placement boot smoke test.** With the flag ON and a
    *stubbed* placement that places **nothing**, prove `_generate → placement`
    runs empty without crashing — this isolates "wiring sound" from "placement
    correct" and pre-flushes the `{group,...}`-vs-`Group` crash class. Boot at
    `?worldgen=0` and confirm **byte-for-byte today's world**. **Also
    `__dbg.teleport` to a known heart-center chunk** (deterministic at a fixed
    seed) and boot there — origin (0,0) is the pinned spawn chunk
    (`chunks.js:416`) and may not be a worldgen heart, so the rarest path stays
    untested otherwise. *Adversary V2, Pragmatist Slice 0.*
6.  **(§3.4 guard) No worldgen work in the start gesture.** Keep all seed
    resolution + worldgen warm-up at module-eval / inside `buildWorld`; insert NO
    `await`/`setTimeout`/cache-warm between the title tap and `Sound.init()`. Add
    the explicit task note. *Adversary V8, Pragmatist §6.*

### Change Group C — Roads, Chunk-Clipped Raw Arterial Ribbons (old §4)

**Scope**: Biggest visible win; first proof of the D-A sampler on the real game path.
**Estimated Effort**: ~3–4 hrs.
**Tripwires protected**: Disposal-safety / `userData.shared` (#6), determinism seam (#4), per-tier budget (#10), single-branch retirement.
**Owner rationale**: Architect #2/#6/#10, Auditor §2/§44 (High), Profiler §3, Pragmatist Slice 1.
**Tasks** (amend §4):
1.  **(§4.1, hardened) Create a shared road material — D-D's premise is false
    today.** There is **no** shared road material; `placePaths` allocates a fresh
    `MeshStandardMaterial` per chunk (`chunks.js:617`), and the only module-scope
    path material `_forestPathMat` (`forests.js:330`) is **untagged**. Task 4.1
    must (a) create a module-scope `ROAD_MAT`, (b) tag it `userData.shared = true`,
    and (c) **also tag the pre-existing `_forestPathMat`** while in scope — an
    untagged shared material that gets reused across chunk-keyed meshes is one
    chunk-unload away from the recompile-storm footgun #6. *Auditor §44 (High,
    the single key concern of the Auditor).*
2.  **(§4.1) Replace `placePaths` `+`-grid** with chunk-clipped **raw** worldgen
    arterial ribbons (reuse `buildCurvedPath`); mesh is chunk-keyed (regenerates
    identically). Consume `roadsInBounds`/`nearestRoad` (raw, per Group A).
3.  **(§4.2) Single-branch retirement.** Roads are passable (no collider). The
    new road crowd-attractor must be **chunk-keyed** (sweeps on
    `registry.removeChunk`, `chunks.js:364`) and the **old `path_node`
    registration must NOT also run with v2 ON** (or NPCs get pulled to both the
    dead 80m grid and the roads). Put the v2 fork as a **single
    `if (USE_WORLDGEN_V2)` at the top of `_generate`**, not scattered across
    `placePaths`/`scatterTrees`/`spawnAmbientCrowd`. *Architect #4/#6.*
4.  **(§4.3) Budget.** Draw delta should be neutral-to-negative (today: 2 ribbons
    + 1 pad per chunk; v2: 0–1 ribbons). Verify in `map-sandbox.html` (2D
    geometry) AND the running game (3D ribbon + a screenshot **straddling a chunk
    seam** to prove D-D no-kink), at `?perf=low` and `?perf=mid`. *Profiler §3,
    Pragmatist Slice 1.*

### Change Group D — Themes/Props: placement.js Drives Anchors + Scatter (old §7, promoted to 3rd)

**Scope**: The correctness headline (stages off roads, nothing in water). Highest crash-risk group — do it while context is freshest.
**Estimated Effort**: ~5–7 hrs.
**Tripwires protected**: Boot integrity / longest call chain, determinism, single-branch retirement, per-tier budget.
**Owner rationale**: Architect #2 (Key Concern), Adversary V2/V3 (High), Profiler §6, Pragmatist Slice 2, Auditor §88.
**Tasks** (amend §7):
1.  **(§7.1, hardened) Heart-anchor ownership with explicit center-or-not input.**
    `placement.js` must take **"is this the heart-center chunk?" as an explicit
    input** (or expose the test), so a `core`-but-**not**-center chunk produces
    *scatter*, never a second anchor or a barren core ring. The D-B role→theme
    table is keyed `(roleTier, heart.rank)` and does **not** by itself distinguish
    center from non-center core — that distinction lives in D-C's ownership test
    and must be a defined branch. This is the exact boundary that yields "two main
    stages 80m apart." *Architect #2 (Key Concern).*
2.  **(§7.1, hardened) District scatter re-derives from worldgen math, never a
    registry lookup of the anchor.** The anchor is chunk-keyed (so it disposes
    with its single owner chunk — a *deliberate* divergence from the contract's
    `persistent` intent, acceptable because anchors regenerate deterministically).
    Therefore a district/vendor chunk must NOT position itself by reading the
    anchor's live registry entry (which may be unloaded → stale/missing
    reference); it must re-derive from `queryPoint`/`heart` math. *Architect #2.*
3.  **(§7.2, hardened) Fix the `roleTier`/`heart.rank` vocabulary collision
    BEFORE writing the table.** Two distinct enums: `roleTier(heart,dist)` returns
    `'core'|'district'|'outskirts'` (`roles.js:8-13`, a *distance band*);
    `heart.rank` returns `'minor'|'major'` (`hearts.js:43-44`, a *size class*).
    The design pairs them as "core + major," mixing one word from each — a landmine
    to a `switch`. `placement.js` must key on the **tuple `(roleTier, heart.rank)`**
    with both enums named (rewrite the table as `core×major`, `core×minor`,
    `district×major`, …) and cite both source enums in the module header. A
    mis-keyed switch silently places nothing and **still passes the green
    self-test** — no crash, just a wrong, too-sparse world. *Adversary V3 (High).*
4.  **(§7.2) Honor `noBuild` (off road/water) and `facing` (face nearest road),
    reading the raw road network.** Verify the new chunk-side scatter extracts the
    same model return shapes the old code does (`buildForestTree` returns a Group;
    others return `{group,...}`) — defensive about return shape from the start.
    *Auditor §88, Pragmatist §3.*
5.  **(§7.3) A/B vs `?worldgen=0`; confirm stages-on-roads is structurally gone
    and nothing is placed in water.**
6.  **(§7.4, hardened) Boot the REAL game at a heart-center chunk** (not just the
    sandbox — anchors are sandbox-invisible by construction; `sandbox.html` builds
    models in isolation, `map-sandbox.html` is 2D and renders no models). Watch
    `buildWorld → ChunkManager.update → _generate → placement` (the longest call
    chain, where the documented crash lives). `preview_console_logs` clean.
    Check the backtick budget AND `chunkGenStats.slowest` (anchor = stage + court
    + arch in one `_generate` → realistic single-frame spike) at `?perf=low`/`mid`.
    *Adversary V2, Profiler §6, Pragmatist §3.*

### Change Group E — Lakes: LakeManager Reads Worldgen (old §5)

**Scope**: Pure placement-source swap, smallest blast radius. Validates the "manager reads worldgen, owns its own lifecycle" pattern.
**Estimated Effort**: ~3–4 hrs.
**Tripwires protected**: Lakes-omit-chunkKey lifecycle (#5), collider correctness, lakes-before-chunks boot order.
**Owner rationale**: Architect #5/#9 (High structural seam), Adversary V4 (High), Profiler §5, Pragmatist §4/§5.
**Tasks** (amend §5):
1.  **(§5.1, hardened) ONE deliberate coordinate-frame conversion at the
    LakeManager↔worldgen boundary.** Worldgen lakes store **absolute world
    vertices** with point-in-polygon containment (`water.js:73-74,81-88`); the
    existing `LakeManager` stores **center-relative** vertices with angular
    `outlineRAt` interpolation (`lakes.js:183,192-206`, `isPointInLake`
    `:718-731`). The two outline formats are NOT interchangeable. Convert at the
    read boundary (or rewrite the sealed-collider walk + canoe clamp to
    point-in-poly) as a **single deliberate conversion**, not an implicit
    assumption. *Architect #5.*
2.  **(§5.1, hardened) Assert outline winding BEFORE swapping — V4 is the
    highest collider-correctness risk.** `placeSealedColliders` hard-assumes a
    **CCW** outline ("interior to the left," inward normal `(-edz,+edx)`,
    `lakes.js:250-256`), and `buildLake` walks the outline **in reverse** for
    `ShapeGeometry` (`:323-327`) — a balanced sign-convention pair tuned to
    `buildLakeOutline`'s vertex order. Worldgen's `_computeLake`
    (`water.js:62-78`) uses a *different* winding generator. If it's CW (or
    rotation flips it), the inward normal points **outward** → sealed colliders
    land *outside* the water, and `DoubleSide` (`lakes.js:67`) **masks the visual**
    so you only *feel* it as missing collision. **Compute signed area first**;
    match `lakes.js`'s expectation or fix the reverse-walk + normal sign **as a
    pair**. *Adversary V4 (High).*
3.  **(§5.2) Verify lake colliders carry NO chunkKey and survive a host-chunk
    unload** (footgun #5). Drive INTO a worldgen lake in the booted game with
    `__dbg` and confirm damage; use `showColliders` at the shore. *Architect #5,
    Adversary V4, Pragmatist §4.*
4.  **(§5.3) Boot, compare feel vs `?worldgen=0`.** Note the count/spacing shift
    (worldgen `LAKE_CELL=1050`@`LAKE_PROB=0.60` vs `lakes.js LAKE_CELL=320`@`0.45`
    — far fewer, larger lakes; the 720/1500 load/unload radii were tuned for the
    320m cell and may leave the ring empty between lakes). **Tuning is parkable**
    to a fast-follow A/B; the *swap* must ship. *Profiler §5, Pragmatist §4.*

### Change Group F — Forests: Per-Chunk treeDensity Scatter (old §6)

**Scope**: Replace the 5×5 system with density scatter, reusing `models/tree.js` pools. The single biggest perf-budget risk.
**Estimated Effort**: ~3–5 hrs.
**Tripwires protected**: Per-tier perf budget (#10), shadow-caster hold at 56, InstancedMesh `needsUpdate` (#7), single-branch retirement.
**Owner rationale**: Profiler §4 (High, Key Concern), Adversary V6, Architect #4, Auditor §88/InstancedMesh.
**Tasks** (amend §6):
1.  **(§6.1, hardened) Reproduce the old hard cap.** The 5×5 system has a built-in
    ceiling: `FOREST_TREE_TARGET_DENSITY = 0.022` → "~80 placed → ~400
    meshes/chunk … higher requires InstancedMesh" (`forests.js:765-770`). D-F's
    `count ∝ density × cellArea × PERF.forestTreeDensityMul` must **clamp to the
    proven ~80 trees/chunk ceiling** and keep `forestTreeDensityMul` in the
    formula — a `treeDensity≈1.0` cell over 6400 m² will otherwise scatter far
    more than 80. This is the loss of the only thing bounding forest tree counts
    (and therefore draws, tris, AND shadow casters). *Profiler §4 (Key Concern).*
2.  **(§6.1) Single-branch retirement.** With v2 ON, `getForestAt` /
    `buildForestChunk` (the 5×5 path, `chunks.js:408-409`) must NOT be consulted,
    or 5×5 forests co-exist with density scatter and double-place trees / fight
    over chunkKeys. Same single `if (USE_WORLDGEN_V2)` discipline. *Architect #4.*
3.  **(§6.1) If scatter introduces InstancedMesh** (add it only if the ~80 cap
    still busts low — do NOT silently rely on ROADMAP's deferred variant-bucket
    idea landing here), every matrix write needs `instanceMatrix.needsUpdate =
    true` (footgun #7). *Auditor InstancedMesh row, Profiler §4.*
4.  **(§6.2) Re-home the "drum-circle nested in dense forest" POI** as an
    `outskirts`+high-density placement; verify reachable. **Parkable** to a
    fast-follow if the autonomous run is tight — baseline scatter delivers
    forests without it. *Pragmatist Deferred.*
5.  **(§6.3, hardened) Gate on `chunkGenStats`, not just the HUD.** Test
    `?perf=low`/`?perf=mid` **while driving through a high-density + lakeshore-ring
    region at boost** (allocation-vs-steady-state), not parked at spawn. The 2D
    map-sandbox shows no tris and the entity sandbox shows one tree — neither
    surfaces the aggregate. Note the **lakeshore-ring feedback**: larger worldgen
    lakes × `LAKE_RING_BAND=70` boost `treeDensity` to 0.62 around every shore
    (`density.js:41-55`) → re-budget forests **after** lakes land. *Profiler §4,
    Adversary V6.*

### Change Group G — Crowd: Heart-Influence Weighting + Road Attraction (old §8)

**Scope**: Counts and path-attraction source only (contract unchanged). Mostly tuning; baseline must ship, tuning is parkable.
**Estimated Effort**: ~2–3 hrs.
**Tripwires protected**: No NaN-feed into physics, phantom-road safety, per-tier crowd cap.
**Owner rationale**: Adversary V7 (Low), Architect #6, Profiler §7, Pragmatist §6 Deferred.
**Tasks** (amend §8):
1.  **(§8.1) Scale ambient crowd count per chunk by sampled heart influence /
    role tier.** Don't let a core chunk spawn hundreds at once (allocation spike);
    `PERF.crowdMax` (low 180 / mid 320 / high 500) already bounds steady-state.
    *Profiler §7.*
2.  **(§8.2, hardened) Gate road attraction on a REAL road.** `nearestRoad` in
    empty outskirts returns `dist = Infinity` but a finite, **meaningless**
    `dirAngle = atan2(-qz,-qx)` (`roads.js:232-250`). Crowd road-attraction must
    gate on `onRoad` or `dist < threshold` — never trust `dirAngle` blindly, or
    NPCs get pushed toward a phantom road in deep outskirts. Keep heart attractors
    dominant. **Tuning is parkable** to a post-ship A/B; baseline 8.1 is the
    visible win. *Adversary V7, Pragmatist Deferred.*
3.  **(§8.3) Verify NPCs cluster at hearts, drift along roads, and never
    spawn/path into water OR toward a phantom outskirts road.** *Adversary V7.*

### Change Group H — Determinism + Cross-Engine + Perf Gate (old §9)

**Scope**: The closing correctness gates. Non-negotiable but does not block the visible slices from landing incrementally.
**Estimated Effort**: ~2–3 hrs.
**Tripwires protected**: Determinism (#4), cross-engine golden, per-tier budgets (#10), shadow-caster hold.
**Owner rationale**: Adversary V9 (Medium, upgraded from optional to required), Profiler §8, Pragmatist §8, Architect #7.
**Tasks** (amend §9):
1.  **(§9.1) Same-seed-same-world on the game path; self-test stays 20/20;
    contract tuple append-only.** Stays green by construction (3D wire-in only
    reads the unchanged contract; only scatter jitter adds a fresh salt).
2.  **(§9.2, hardened) Cross-engine golden MUST include road *existence*, not
    just `queryPoint` tuples.** Per V9, a low-bit `atan2` difference at the
    detour tie-break `Math.abs(ccw - Math.PI) < 0.05` (`roads.js:167`) can pick
    the opposite wrap on JavaScriptCore vs V8 → a different detour → a road that
    **exists on Chrome and is null on Safari**. Road existence drives `noBuild`
    and the crowd attractor → a per-engine world fork at a collider/placement
    boundary, **not** cosmetic shore wobble. Sample `nearestRoad(...).onRoad` +
    arterial-null across the grid in Node AND browser; **widen/quantize the
    tie-break** at `roads.js:167` so it can't straddle the threshold per-engine.
    This upgrades the design's deferred integer-orientation test from optional to
    **required**. *Adversary V9.*
3.  **(§9.3) Full per-tier budget pass** at `?perf=low`/`mid`/`high`; shadow-caster
    count not walked back (hold at 56 — forest tree count is the lever: every
    forest tree carries 1 caster on mid/high). Include `chunkGenStats` readings.
    *Profiler §8.*

### Change Group I — Verify, Review, Docs, Landing (old §10 + §11)

**Scope**: `/opsx:verify`, `/smart-review`, ARCHITECTURE rewrite, CHANGELOG/ROADMAP/HANDOFF.
**Estimated Effort**: ~2–3 hrs.
**Tripwires protected**: Documentation-drift, CHANGELOG same-commit discipline.
**Owner rationale**: Architect #1/#7 (ARCHITECTURE gate), Auditor §5, Pragmatist §8.
**Tasks** (amend §10 + §11):
1.  **(§10.1) `/opsx:verify`** against these artifacts.
2.  **(§10.2) `/smart-review`** (rendering, performance, gameplay, audio, sandbox,
    docs); fix findings. Add to tasks: **any NEW road/junction *mesh* builder
    that lands needs a `sandbox.html` entry** per the new-model checklist
    (proposal Impact flags it; tasks.md must enumerate it). `placement.js` itself
    is pure data — its verification surface is (1) `map-sandbox.html`'s
    role/`wouldHost` inspector for the *decision*, (2) the booted game for the
    *geometry*. *Auditor §62.*
3.  **(§10.3) Final boot smoke test at all tiers** (title → start → ~2.5s →
    `preview_console_logs` clean → screenshot at noon + midnight).
4.  **(§11.1) CHANGELOG** v2 headline, same commit as code. **CHANGELOG travels
    with EACH content commit, not batched** (changelog-and-roadmap.md). *Auditor
    §5, Pragmatist §8.*
5.  **(§11.2) ROADMAP**: remove "wire the generator into the live 3D world as v2
    worldgen"; **add the junction-merge fast-follow** (deferred from Group A);
    note old-path-removal follow-up.
6.  **(§11.3) ARCHITECTURE.md world-streaming rewrite as a HARD GATE.** The
    current doc describes `pickTheme` + `THEME_BUILDERS` + the 5×5 forest system,
    all retired behind the flag here. Leaving it stale is a structural-drift
    footgun for the next agent. *Architect #1/#7.*
7.  **(§11.4) Update HANDOFF + session-log**; note follow-ups (junction-merge,
    forest-POI re-home, lake/crowd tuning, old-path removal) on ROADMAP.

---

## Resolved Delivery Order

> **Junction-merge (old §1) is deferred to a fast-follow. Scaffolding leads,
> roads second, placement third.** Every slice ends bootable behind the flag and
> is a clean HANDOFF/compaction checkpoint, with its CHANGELOG entry in the same
> commit.

| # | Group | Old §  | Why here | Ends bootable? |
|---|-------|--------|----------|----------------|
| 1 | **A — Source-of-truth + determinism decision** (paperwork) | new §0 / amends §1,§2 | Resolve V1 before any code; defer junction-merge | n/a (docs) |
| 2 | **B — Scaffolding / flag / importmap / salt / empty-boot** | §3 | The force-multiplier gate; unblocks all content | ✅ both flag states |
| 3 | **C — Roads (raw arterials)** | §4 | Biggest visible win; proves D-A sampler; low collision risk | ✅ |
| 4 | **D — Themes/props (placement.js)** | §7 | Correctness headline + highest crash-risk → freshest context | ✅ |
| 5 | **E — Lakes (placement swap)** | §5 | Smallest blast radius; validates manager-reads-worldgen | ✅ |
| 6 | **F — Forests (density scatter)** | §6 | Biggest perf risk; re-budget AFTER lakes land | ✅ |
| 7 | **G — Crowd (weighting + road attraction)** | §8 | Mostly tuning; baseline ships, tuning parks | ✅ |
| 8 | **H — Determinism + cross-engine + perf gate** | §9 | Closing correctness gates | n/a (gate) |
| 9 | **I — Verify / review / docs / landing** | §10,§11 | ARCHITECTURE rewrite is a hard gate | n/a |
| — | *Fast-follow (separate change)* | old §1 | Junction-merge (2D-only), forest-POI re-home, lake/crowd tuning, old-path removal | — |

**Note on §2.1 (deliberation gate):** this council *is* §2.1 — it's complete when
this report lands; fold these Change Groups back into tasks.md.

---

## Convergence Points

-   **All 5 personas: Proceed with mitigations.** Zero Blocks. The architecture
    (D-A sampler over a HeartManager, the flag D-G, the append-only contract) is
    endorsed as sound.
-   **All 5: importmap-in-BOTH is FIRST and non-negotiable.** Today 0/8 worldgen
    modules are in `index.html`/`sandbox.html` mods arrays (Architect #8, Auditor
    §1, Profiler table, Pragmatist Slice 0).
-   **4/5 (all but Auditor, who is order-neutral): scaffold → roads → placement
    is the right spine.** The Pragmatist's reorder and the Architect's "importmap
    + flag as a distinct boots-clean commit before roads" align exactly.
-   **D-A (per-chunk sampler, NOT a HeartManager) is correct** — Architect endorses
    "without reservation"; no persona dissents. A second macrocell manager would
    duplicate the entire `LakeManager` lifecycle surface for no benefit.
-   **The boot smoke test (sandbox-pass ≠ game-pass) at every milestone** is named
    by Architect, Adversary, Profiler, Pragmatist, and Auditor independently.
-   **The flag (D-G) is the right insurance for a world-regenerating break observed
    by real players**, and it must read once-per-chunk, not per-point.

---

## Conflicts Resolved

| Conflict | Position A | Position B | Resolution | Rationale |
|----------|-----------|-----------|-----------|-----------|
| **Delivery order: where does the junction-merge sit?** | tasks.md leads with it (§1). | Pragmatist: defer to fast-follow; it produces zero in-game pixels. Adversary: it desyncs the road source-of-truth and the self-test is blind to it. | **Defer to a separate fast-follow change.** 3D game consumes RAW arterials. | The two personas converge from different lenses (critical-path vs determinism). Deferring isolates the only determinism-moving work, keeps the self-test green by construction, and lands the visible win earlier. (Verifiability + simplicity.) |
| **Road source of truth: merged vs raw?** | Task 1.3: "3D renderer consumes the *merged* network." | Adversary V1: `noBuild`/`facing`/self-test all read RAW arterials → silent desync. | **Game uses RAW for render + gates; merge is 2D-sandbox-only.** | Single source of truth is the only config where placement, render, crowd, self-test, and golden agree. Correctness trumps the cosmetic merge win. Gary-overridable to (a) merged-everywhere if he re-derives T4/T5 + golden first. |
| **placement.js home + purity** | D-B places it inside `src/worldgen/`. | Architect #3: only correct IF it stays pure + three-free. | **Inside `src/worldgen/`, returns descriptors only; no `three`/`models/*` import.** | Preserves the render-agnostic boundary that keeps the self-test + map-sandbox runnable. Architecture-adherence. |
| **Anchor lifecycle: persistent (contract) vs chunk-keyed (D-C)** | Contract stamps every feature `lifecycle:'persistent'` (lakes model, footgun #5). | D-C makes anchors chunk-keyed (disposes with owner chunk). | **Chunk-keyed anchors are acceptable** *because they regenerate deterministically* — BUT district scatter must re-derive from worldgen math, never a live registry lookup of the (possibly unloaded) anchor. | Defensible divergence; the stale-reference failure mode is closed by the re-derive rule. Correctness. |
| **roleTier vs heart.rank axis** | D-B table pairs "core + major" (mixes two enums). | Adversary V3: a `switch` on the wrong axis silently places nothing and still passes the self-test. | **Key on the tuple `(roleTier, heart.rank)` with both enums named; cite both sources in the header.** | A silent wrong-world bug invisible to the green self-test is worse than a crash. Correctness. |
| **Forest cap: trust the density formula?** | D-F: `count ∝ density × cellArea × mul`. | Profiler §4: removes the only hard cap (`FOREST_TREE_TARGET_DENSITY=0.022` → ~80/chunk); HUD won't catch the alloc cost — `chunkGenStats` will. | **Clamp to the proven ~80 trees/chunk ceiling; keep `forestTreeDensityMul`; gate on `chunkGenStats` at low/mid while driving.** | Perceivable impact (spawn stalls) within budget. The HUD is the wrong instrument; allocation cost is the real risk. |
| **Lake outline frames** | D-E: "build ShapeGeometry + colliders along the worldgen outline." | Architect #5 + Adversary V4: worldgen = absolute-vertex/point-in-poly; LakeManager = center-relative/angular + CCW-inward-normal. Not interchangeable; sign flip puts colliders on the wrong shore (masked by `DoubleSide`). | **One deliberate frame conversion at the read boundary; assert signed-area winding BEFORE swap; fix reverse-walk + normal sign as a pair; drive-in damage test.** | Collider correctness is a safety/correctness issue; the bug is invisible visually. |
| **Shared road material exists?** | D-D: "reuse the shared road material." | Auditor §44: it does NOT exist (`chunks.js:617` allocates per-chunk); `_forestPathMat` is untagged. | **Create `ROAD_MAT` + tag `userData.shared=true`; also tag `_forestPathMat` while in scope.** | One forgotten tag = the recompile-storm footgun #6. Disposal safety is a hard tripwire. |

---

## Risk Register (severity-ranked)

| # | Risk | Severity | Mitigation | Owner |
|---|------|----------|-----------|-------|
| R1 | **Road source-of-truth desync** — merged render vs raw `noBuild`/`facing`/self-test → stages where old arterials ran; rendered roads through build-OK spots; green self-test gives false confidence. | **Critical** | Game consumes RAW arterials for render + gates; defer junction-merge to a fast-follow (Group A). One source of truth. | Adversary (V1), Architect (#7) |
| R2 | **Heart-anchor chunk crash in the longest call chain** — `{group,...}` vs `Group` return-shape mismatch on the rarest, sandbox-invisible path; anchor chunk may also run lake-suppression + road-clip. | **High** | Empty-placement boot smoke test (B5) + `__dbg.teleport` to a known heart-center chunk; defensive return-shape extraction; boot the real game on every placement commit (D6). | Adversary (V2), Pragmatist (§3), Auditor (§88) |
| R3 | **Forest tree-count blowup** — D-F loses the old 0.022 hard cap; a `density≈1.0` cell scatters ≫80 trees → draws/tris/shadow-caster regression on low/mid; HUD looks green while `chunkGenStats` blows past 8 ms. | **High** | Clamp to the ~80/chunk ceiling; keep `forestTreeDensityMul`; InstancedMesh only if cap still busts low; gate on `chunkGenStats` at low/mid while driving a dense+lakeshore region at boost (F1/F5). | Profiler (§4, Key Concern) |
| R4 | **`roleTier`/`heart.rank` axis collision** — a `switch` on the wrong enum silently places nothing; wrong, too-sparse world still passes the green self-test (no crash, no error). | **High** | Key on the tuple `(roleTier, heart.rank)`, both enums named, cited in header; rewrite table as `core×major` etc. (D3). | Adversary (V3) |
| R5 | **Lake collider winding sign flip** — worldgen outline winding vs `lakes.js` CCW-inward-normal assumption; colliders land outside the water, masked by `DoubleSide` → invisible missing collision for the whole session (no chunkKey). | **High** | Assert signed-area winding before swap; one deliberate frame conversion at the boundary; fix reverse-walk + normal sign as a pair; drive-in damage test with `showColliders` (E1/E2/E3). | Adversary (V4), Architect (#5) |
| R6 | **Untagged shared road material → recompile storm** — D-D's shared material doesn't exist; `_forestPathMat` is untagged; one forgotten `userData.shared` tag = footgun #6 dispose-storm on chunk unload. | **High** | Create `ROAD_MAT`, tag `userData.shared=true`; also tag `_forestPathMat` in the same pass (C1). | Auditor (§44, Key Concern) |
| R7 | **Per-chunk sampler CPU cost in the 1-chunk/frame budget** — `queryPoint` = 2× `nearestHeart` (81-cell window) + `nearestRoad` (81×81-cell) + `lakeAt` + `nearestLake`; `arterialsNear`/`neighborsOf` window-scan + sort is NOT memoized; spawn stall on boost, invisible in draws/tris HUD. | **Medium** | Bound `queryPoint` calls per chunk; reuse `queryRegion` results (don't sample per-m²); add a `chunkGenStats`-style timer around the sampler; treat >8 ms as the gate; anchor-build frame-splitting as the escape hatch (B5, D6, H3). | Profiler (Key Concern) |
| R8 | **Cross-engine road *existence* flip** — `atan2` tie-break `Math.abs(ccw-π)<0.05` (`roads.js:167`) picks opposite wrap on JSC vs V8 → road exists on Chrome, null on Safari → per-engine `noBuild`/collider/placement fork (NOT cosmetic). | **Medium** | Cross-engine golden must include road existence (`onRoad` + arterial-null), not just `queryPoint` tuples; widen/quantize the tie-break so it can't straddle per-engine (H2). Upgrades the deferred test to required. | Adversary (V9) |
| R9 | **Lakeshore-ring feedback into forest budget** — larger worldgen lakes × `LAKE_RING_BAND=70` boost `treeDensity` to 0.62 around every shore → dense rings the old 320 m lakes didn't produce. | **Medium** | Re-budget forests AFTER lakes land, not before; included in F5's drive-through gate. | Profiler (§5) |
| R10 | **Old-path / v2-path co-run** — 5×5 forests + density scatter both place trees; old `path_node` + new road attractor both pull crowd; `THEME_BUILDERS` + placement both run. | **Medium** | A single `if (USE_WORLDGEN_V2)` at the top of `_generate`, not scattered conditionals; old paths gated off with v2 ON (C3, F2). | Architect (#4/#6) |
| R11 | **Heart-anchor single-frame spike** — stage + court + arch in one `_generate`; rare (~1 per ≥440 m) but real on boost. | **Medium** | Accept minor first-load stall (existing behavior); split anchor build across frames ONLY if `chunkGenStats` shows it — don't pre-optimize (D6, H3). | Profiler (§6), Pragmatist (§7) |
| R12 | **iOS audio async-hop (latent)** — scaffolding touches `world.js` boot order; a tempting "warm the worldgen cache in the start handler" would push `Sound.init()` off the synchronous gesture frame. | **Low (latent)** | Keep all worldgen warm-up at module-eval / inside `buildWorld`; NO `await`/`setTimeout`/cache-warm before `Sound.init()`; explicit task note; verify on a real mobile browser once (B6). | Adversary (V8), Pragmatist (§6) |
| R13 | **Phantom-road crowd attraction in empty outskirts** — `nearestRoad` returns `dist=Infinity` but a finite meaningless `dirAngle`; crowd could push NPCs toward a road that isn't there. | **Low** | Gate road attraction on `onRoad`/`dist<threshold`, never trust `dirAngle` blindly; cover in the "never path into water" check (G2/G3). | Adversary (V7) |
| R14 | **`_arterialCache`/`_cache` growth + stray `bumpWorldgen()`** — module-global caches clear at 200k/250k entries; a stray bump or co-resident sandbox could clear mid-session. | **Low** | Confirm nothing in the 3D path calls `bumpWorldgen()`; treat the three caches' memory as part of the perf budget; game must never mutate CONFIG at runtime (only the sandbox does). | Adversary (V5), Profiler (heap row) |
| R15 | **ARCHITECTURE.md drift** — doc still describes `pickTheme`/`THEME_BUILDERS`/5×5 forests, all retired behind the flag. | **Low** | ARCHITECTURE world-streaming rewrite as a hard landing gate (I6). | Architect (#1/#7) |

---

## Verdicts Summary

| Persona | Key Concern | Verdict |
|---------|-------------|---------|
| **Architect** | D-C heart-anchor ownership: `placement.js` must take "is this the heart-center chunk?" as explicit input (core-but-not-center → scatter, never a 2nd anchor/barren core); district scatter re-derives from worldgen, never a live registry lookup of a possibly-unloaded anchor. | Proceed with mitigations |
| **Adversary** | V1 (Critical): pick ONE road source of truth (merged vs raw) and re-derive the self-test for it — as written the harness is blind to the merge and "no stages on roads" can desync from rendered roads. Would block Task 4 until decided. | Proceed with mitigations (block Task 4 pending V1) |
| **Profiler** | The two costs invisible to the draws/tris/heap HUD: (1) per-chunk sampling pushing `chunkGenStats` past 8 ms (spawn stall on boost); (2) loss of the `FOREST_TREE_TARGET_DENSITY=0.022` hard cap — the only thing bounding forest tree counts (draws, tris, AND shadow casters). | Proceed with mitigations |
| **Pragmatist** | The 11-group order front-loads the no-pixels work (junction-merge) and back-loads the biggest visible win (roads) + highest crash-risk group (placement). Reorder: scaffold → roads → placement → lake/forest → crowd/perf/docs; defer junction-merge to a fast-follow. | Proceed with mitigations |
| **Auditor** | D-D's "reuse the shared road material" rests on a material that doesn't exist (`chunks.js:617` allocates per-chunk); the obvious promotion candidate `_forestPathMat` (`forests.js:330`) is module-scope but **untagged** — one forgotten tag from the chunk-unload dispose-storm (footgun #6). | Proceed with mitigations |

---

## Final Recommendation

**Proceed with mitigations.** Resolve the road source-of-truth in design FIRST
(Group A: game consumes RAW arterials, junction-merge becomes a fast-follow),
then run the resolved order: **scaffold → roads → placement → lakes → forests →
crowd → gates → docs.** The plan is unusually tripwire-aware and the architecture
is endorsed by all five personas; the risk is concentrated in six concrete,
mitigable spots (the six High/Critical rows of the Risk Register), every one of
which is closed by a specific task amendment above. Fold Change Groups A–I back
into `tasks.md` and treat the six High/Critical mitigations as binding apply-gates.

## Next Step

1.  **Gary decides the source-of-truth lever** (recommended Option (b) RAW, vs
    Option (a) merged-everywhere). Default to (b) unless he says otherwise.
2.  **Fold Groups A–I into `tasks.md`** — strike §1 (junction-merge → fast-follow),
    promote §7 (placement) ahead of §5/§6, and apply each hardened sub-task above.
3.  **Begin Group B** (scaffolding) — the force-multiplier gate that unblocks all
    content and is the cheapest HANDOFF-safe checkpoint.
