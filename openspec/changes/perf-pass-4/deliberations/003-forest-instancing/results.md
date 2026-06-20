# Deliberation Summary

## Context
-   **Task**: Stress-test the option-(b) draw lever — instance forest + chunk
    trees to cut draw calls — via the briefing plan: refactor
    `buildForestTree`/`buildTree` to emit instance descriptors, accumulate them
    per chunk, and build a small set of per-chunk `InstancedMesh`es (unit icosa
    crowns, unit cones, unit trunk) with `instanceColor`/green-bucket variation.
    The census names trees as the dominant draw mass (`IcosahedronGeometry·240v`
    2,637 draws + `ConeGeometry·35v` 2,120 draws). Design only; no code written.
-   **Personas Consulted**: Architect, Profiler, Adversary, Auditor, Pragmatist
    + Mediator. Mode: **debate** (both rounds complete; no persona failed).
-   **Date**: 2026-06-20

---

## HEADLINE OUTCOME (read this first)

**The debate CONVERGED. Verdict: Proceed with mitigations (unanimous).** The
instancing lever is the single biggest item in the draw census and instancing is
exactly the prescribed fix (audit-order step 5). Two of the briefing's named
risks **dissolved on inspection** — disposal already handles InstancedMesh
(`chunks.js:563` `obj.dispose()` inside the `isMesh` guard, header contract at
`chunks.js:552`), and birds read the registry, not the tree `Object3D`
(`birds.js:157-169`). What survived debate are three resolved tensions that
reshape the slice plan:

- **T1 (the crux):** the existing `bin/layout-snapshot` determinism gate is
  **provably blind** to the visual descriptor stream. `__dbg.dumpRegistry`
  (`main.js:1505-1515`) emits exactly nine fields — `kind, x, z, footprint,
  colliderR, damage, attractorR, attractorW, chunkKey` — and **drops scale,
  colorHex, species, crown, and perches**. A same-count rng *reorder* changes a
  tree's species/size/shade at a fixed (x,z), produces a **byte-identical**
  snapshot, and silently regenerates every forest's look (and moves every forest
  bird perch) with all gates green. **Mitigation: a new agent-static
  `bin/test-forest-determinism` golden-hash gate over the real descriptor
  stream.** Run BOTH gates — neither subsumes the other.
- **T2:** the bucket strategy is `instanceColor` + a cast/no-cast shadow split =
  **~5 buckets/chunk** (~69× per-chunk draw reduction, ~344→~5), shadow-correct,
  one cached program. Green-bucket meshes need ~28 buckets to stay
  shadow-faithful; the "simple 21" version over-casts and walks back the 115→56
  shadow audit (tripwire #9).
- **T3 (dispositive):** production default is **worldgen v2**
  (`DEFAULT_WORLDGEN_V2 = true`, `perf.js:42`; v2 branch returns at
  `chunks.js:405`). The live tree path is `scatterWorldgenTrees`
  (`chunks.js:1036`, `buildForestTree` at `chunks.js:1061`). The v1
  `scatterForestTrees` (`forests.js:911`) is **dead-by-default** (`?worldgen=0`
  only). **Slice-1 MUST target v2 or the capture measures zero.**

This is a real, large draw win on the dominant census bucket — proceed, scoped to
the slice table below, gated by both determinism checks.

---

## Synthesized Plan

The plan ships as **slices**, ordered by blast radius and by what the agent can
self-verify without a real GPU. **Codespaces has no WebGL — live draw/tri/visual
verification is Gary's, on his real-GPU capture.** The agent proves *correctness*
(boot-clean, golden-hash byte-identical, importmaps, no console errors); it
cannot prove *the draw number moved* or *the tri budget held on low*. The slice
boundary is the **rng-stream class** (Architect): isolated-stream forest paths =
slice-1; shared-`ctx.rng` chunk-tree path = deferred; `chunkKey`-omitting lake
paths = excluded.

### Change Group 1 (CG1): Determinism-gate precondition — extend the shim + build the golden-hash gate
**Scope**: The one load-bearing risk (T1) is a foliage-stream rng reorder that
the existing registry gate cannot see. This group builds the gate that *can*
see it, **before any builder is touched**, so the golden is captured from `main`
first. It is its own early group because the gate has an un-named precondition
(the node shim) that an "add a determinism test" task would stall on at
implementation time.
**Estimated Effort**: Small (~30-line gate + ~6 no-op shim stubs).
**Gate(s)**: agent-static only (no WebGL). **No Gary round-trip.**
**Tasks**:
1.  **Extend `bin/node-three-shim.mjs` first (precondition, Architect).** The
    shim currently stubs **only `Vector3`** (its own header, `node-three-shim.mjs:4-5`).
    `tree.js` touches **six** THREE classes at load + build time:
    `CylinderGeometry` + `MeshStandardMaterial` at module scope
    (`tree.js:32,34`), plus `Group`, `Mesh`, `IcosahedronGeometry`,
    `ConeGeometry` in the builders (`tree.js:97,98,106,123`). Add **trivial
    no-op constructors** for those six — the gate hashes the rng-derived
    *numbers*, not geometry math. Without this, `import('../src/models/tree.js')`
    throws under node and the gate cannot run.
2.  **Build `bin/test-forest-determinism` (Adversary Option A, unanimous).**
    Use the exact loader pattern `bin/test-registry-grid` already uses
    (`register('./node-three-shim.mjs')`, `test-registry-grid:28-29`), import
    the **real** `tree.js`, run `buildForestTree(mulberry32(FIXED))` (or the new
    `describeForestTree` sibling from CG2) N times, and golden-hash the **full
    descriptor stream**: `type, trunkH, trunkR, greenIdx (→ colorHex), mainR/baseR
    (→ scale), bumpCount/crownCount, every per-bump/crown/tier draw, rotation`.
    This is the only gate that asserts the strict invariant: **identical rng
    order AND count, including the variable-length bump/crown loops** (Adversary
    Vuln 1 enumerated: pine 5 draws, oak `5 + 3·bumpCount`, birch `4 + 3·crownCount`,
    + the caller's `rotation.y = rng()` last).
3.  **Capture the golden from `main` BEFORE the CG2 refactor lands.** The
    refactor passes iff the hash is unchanged. This converts the load-bearing
    check from a Gary round-trip into an agent-static gate that runs every slice.
4.  **Importmap note**: this is a `bin/` test, not a `src/` module — no importmap
    entry. Keep the descriptor emitters in `tree.js` (CG2) so no new `src/` file
    is split out and `bin/check-importmaps` stays a no-op (Auditor §5). If a
    helper *is* ever split to a new `src/` file, add it to `mods` in
    `index.html` + `sandbox.html` + `hub-sandbox.html` and re-run
    `bin/check-importmaps`.

### Change Group 2 (CG2): Additive descriptor extraction (pure refactor, byte-identical)
**Scope**: Make `tree.js` emit descriptors **without changing the builders'
return type** — three personas (Architect, Adversary, Auditor) independently
landed on additive-not-destructive, and the Pragmatist conceded it as the
*smaller and safer* diff. This is the structural seam that lets slice-1 instance
two paths while leaving three call-sites (sandbox, lakes, chunk-trees) unbroken.
No visual change ships in this group.
**Estimated Effort**: Small.
**Gate(s)**: golden-hash unchanged (CG1.3) + `node --check` + `bin/check-model-dims`
+ game-boot smoke. **No Gary round-trip** (no visual/draw change).
**Tasks**:
1.  **Keep `buildForestTree`/`buildTallPine`/`buildOak`/`buildBirch`/`buildTree`
    returning a real `THREE.Group`** (Adversary Vuln 3, Auditor §4, Architect
    mitigation 1). Add `describeForestTree(rng)` siblings (or expose the
    descriptor on `group.userData.descriptor`) as the **single rng-order source
    of truth** that the existing Group builders route through. This protects:
    -   The **six sandbox cases** — `sandbox.html:1148` `buildTree`,
        `:1807/:1816/:1825/:1834` the forest builders, `:1904` the `bird_in_tree`
        case which reads `tree.userData.perches` off the returned Group. Changing
        the return type goes dark on the primary verification surface — the
        sandbox-pass/game-crash footgun running *backwards* (Adversary Vuln 3).
    -   The **excluded lake call-sites** — `lakes.js:25,537,713` import and call
        `buildForestTree`, then do `tree.position.set` / `tree.scale.set`
        (`lakes.js:538,540,716`). A changed return type breaks the EXCLUDED path
        (Architect R2 self-cross-examination).
2.  **The descriptor MUST carry `crown` + `perches`** (Adversary Vuln 4). Birds
    read these off the **registry entry**, never the mesh
    (`birds.js:157-169`) — clean — BUT the registration must populate
    `crown`/`perches` from the descriptor (not a now-absent Group), or forest
    birds **silently stop perching** with no error, no crash. Compute
    perch/crown once in a shared helper both the Group path and the descriptor
    path call; refactor `worldPerches`/`worldCrown` (`tree.js:84-94`) to take the
    descriptor (or its `perches`/`crown` + x/z) directly.
3.  **rng order is non-negotiable** (Adversary Vuln 1, Architect T1): emit fields
    in the descriptor literal *without* reordering the draws. Do NOT draw
    `greenIdx` before `trunkH`/`trunkR` (today it's 3rd, `tree.js:174/211/255`),
    do NOT hoist the bump/crown loop draws to "precompute the list," do NOT
    "compute scale once at the top" (moves `mainR`/`baseR` ahead of `greenIdx`).
    The CG1 golden-hash gate is what proves this held.

### Change Group 3 (CG3): Instance the two isolated-stream forest paths (slice-1, the production win)
**Scope**: Build per-chunk `InstancedMesh`es from the descriptors. Slice-1 =
**both** isolated-stream forest paths via one descriptor refactor: `chunks.js:1061`
(v2 worldgen, production-default, **lead**) + `forests.js:911` (v1 forest, rides
the same shared `buildForestTree` emitter for free). The v2 path is the
**non-skippable** member — instrumenting v1 alone moves the production draw number
by zero (T3, Profiler/Pragmatist/Architect concur).
**Estimated Effort**: Medium.
**Gate(s)**: golden-hash unchanged + `bin/layout-snapshot` clean (position drift)
+ game-boot smoke (agent). **Gary round-trip**: draw census + `?perf=low/mid` tri
budget + Noon/Midnight sandbox screenshots.
**Tasks**:
1.  **Accumulate descriptors per chunk; build into `ctx.group`** for both paths.
    Both forest scatterers `ctx.group.add(tree)` (`forests.js:914`,
    `chunks.js:1064`) and register `chunkKey: ctx.key` (`forests.js:925`,
    `chunks.js:1070`). The 3×3 forest block is a **placement** concept, not an
    ownership one — each of the 9 chunks owns its own trees in its own group and
    unloads with its own `chunkKey` (Architect). Per-chunk is the natural
    lifecycle home.
2.  **~5 buckets/chunk, sized to the cast/no-cast boundary** (T2 — Auditor §3,
    Profiler R2, Architect R2 concession). `InstancedMesh.castShadow` is one
    boolean for all instances, but today's casting is selective *within a tree*.
    The bucket boundary MUST equal the existing per-mesh `castShadow` lines:
    -   `crown_caster` (icosa, `castShadow=true`): oak main crowns (`tree.js:217`)
        + lowest birch puff (`tree.js:271`).
    -   `crown_noshadow` (icosa, `castShadow=false`): oak bumps (`tree.js:222-232`,
        no cast) + upper birch puffs.
    -   `cone_caster` (cone, `castShadow=true`): lowest pine tier
        (`tree.js:185`, `i === 0`).
    -   `cone_noshadow` (cone, `castShadow=false`): upper pine tiers.
    -   `trunk` (cylinder, `castShadow=true`): all trunks cast
        (`tree.js:167,207,251`).
    **Reject "just cast the whole crown bucket"** — it over-casts oak bumps,
    upper pine tiers, and every birch puff, walking back the 115→56 shadow audit
    (tripwire #9, `.claude/rules/performance.md`).
3.  **Use `instanceColor`, not green-bucket meshes** (T2). Color folds into a
    per-instance attribute — one `MeshStandardMaterial` base, ~5 buckets total —
    vs ~28 buckets to keep green-bucketing shadow-faithful (7 `FOREST_GREENS`
    × geo × cast-state). `instanceColor` and selective shadow casting are
    **orthogonal** (Profiler R2): `castShadow` is a per-mesh boolean, the depth
    pass ignores color, so an instance-colored mesh casts as cleanly as a
    single-color one. The one cost is a single extra **cached** program
    (`USE_INSTANCING_COLOR` define), compiled once and amortized — categorically
    NOT the recompile-storm footgun. **Live-verify** `instanceColor` renders
    under the low-tier threeShim Lambert swap (tripwire #2) — Gary's check.
4.  **Module-shared unit geos; per-chunk InstancedMeshes NOT shared** (Auditor §1-2,
    Profiler, Adversary). Hoist `IcosahedronGeometry(1,1)`, `ConeGeometry(1,1,8)`,
    and the unit trunk cylinder to module scope in `tree.js` and tag each
    `userData.shared = true` (consistent with the existing `_trunkGeo`/`_foliageMats`
    pools, `tree.js:32-54`). **Do NOT tag the per-chunk InstancedMeshes
    `userData.shared`** — they must be disposed per chunk. Disposal is already
    correct: `disposeChunkByKey` (`chunks.js:553-565`) skips shared geo at
    `:556` and frees the InstancedMesh's own instance buffers via
    `if (obj.isInstancedMesh) obj.dispose()` at `:563` (header contract `:552`).
    An untagged unit geo = first forest-chunk unload disposes it and storms
    shader recompiles across the other resident forest chunks (tripwire #6,
    Auditor's verified bug class).
5.  **`instanceMatrix.needsUpdate = true` after the per-chunk fill**
    (tripwire #7; precedent `sugarShack.js`). Trees are static (built once per
    chunk), so this is set-once — but forgetting it renders the chunk
    empty/frozen. Set `instanceColor.needsUpdate = true` too.
6.  **Per-chunk granularity — reject per-forest-block** (Profiler, Pragmatist,
    Architect all concur). Per-block (240m span) would need a lake-style macrocell
    lifecycle outliving all 9 chunks, breaking the "chunk owns its 80m cell" rule,
    and its 9→3 draw saving is rounding error against the ~4,757-draw win — both
    are already far under every tier budget. Per-chunk's small bounding spheres
    keep off-screen chunks culled as units (mandatory for the low-tier tri budget,
    see Risk Register).

### Change Group 4 (CG4): Quality gates + measurement on Gary's real GPU
**Scope**: The agent-static gates the agent owns, plus the GPU-only confirmations
that are Gary's, plus docs.
**Estimated Effort**: Small (agent side); measurement is Gary's.
**Gate(s)**: see tasks. **Gary round-trip** for all draw/tri/visual items.
**Tasks**:
1.  **Agent-static gates (every slice)**: `node --check src/models/tree.js
    src/chunks.js src/forests.js`; `bin/test-forest-determinism` golden-hash
    unchanged (CG1); `bin/layout-snapshot` self-diff clean for tree *positions*
    (CG3 — positions ARE captured); `bin/check-model-dims` (unit-geo refactor must
    not change built proportions); `bin/check-importmaps` (no-op unless a new file
    is split); **clean game-boot on the DEFAULT build** (no `?worldgen` flag) —
    title → start → `preview_console_logs` clean. The
    `buildWorld → ChunkManager._generate → _generateWorldgen → scatterWorldgenTrees`
    chain is exactly the longest-call-chain boot-bug zone.
2.  **Gary — draw census (the success proof)**: default-build `__dbg.drawCensus()`
    before/after; success = the `IcosahedronGeometry·240v` + `ConeGeometry·35v`
    buckets collapse from thousands toward low hundreds pre-frustum. **Run on the
    default (v2) build — no `?worldgen=` flag.** A capture on the v1 path measures
    zero (T3).
3.  **Gary — `?perf=low` tri budget (HARD ship-gate, T2/Profiler)**: instancing
    defeats per-tree intra-chunk frustum cull, so a partially-visible chunk pulls
    in all its trees' tris. Worst case ~100k tree tris in a dense-forest frame vs
    the **150k low budget (~67%)** — tight. Mid ~216k/400k (54%), high trivial.
    Confirm `?perf=low` and `?perf=mid` stay under budget in a dense-forest frame.
    This is only meaningful AFTER the golden-hash passes (a reordered species mix
    measures a different forest, Profiler R2). Keep `forestTreeDensityMul = 0.7`
    on low (`perf.js:66`) — load-bearing for the tri budget; "draws got cheap"
    must not tempt raising low-tier density.
4.  **Gary — geometries-leak check**: drive in/out of a forest 5× (10-rebuild,
    hub-sandbox); `renderer.info.memory.geometries` returns to baseline. A
    climbing count = an untagged unit geo or a per-chunk InstancedMesh that leaked
    (not under the disposed chunk group, or wrongly tagged `shared`).
5.  **Gary — forest birds still perch**: `__dbg.start()`, fly to a forest, confirm
    birds land (Adversary Vuln 4). The `bird_in_tree` sandbox case only proves the
    model, not the registry-wiring; chunks/forests don't run in the model sandbox.
6.  **Sandbox**: keep the Group-returning builders so `forest_tree_*` +
    `bird_in_tree` (`sandbox.html:1806-1834,:1904`) still render. Add ONE
    instanced-forest-patch composite case so the *instanced* assembly — not just
    the single-tree path — is eyeballable at Noon + Midnight (sandbox doctrine:
    extend the harness before bypassing it).
7.  **CHANGELOG `### Performance` entry in the shipping commit; trim the ROADMAP
    "Performance" item** (LOD-on-trees / variant-bucketed-InstancedMesh bullet) to
    reflect what landed. If a dense-low tri capture pushes past ~110-120k, the
    parked LOD/detail-0-icosa fallback (20 tris vs 80) is the follow-up — already
    on ROADMAP; don't pre-build it.

## Final Recommendation
**Proceed with mitigations (unanimous)**, scoped to the slice table: build the
`bin/test-forest-determinism` golden-hash gate first (extend `node-three-shim.mjs`
+6 stubs as its precondition), extract descriptors **additively** (Group return
type unchanged so sandbox/lakes/chunk-trees survive), then instance the **two
isolated-stream forest paths** (v2 `scatterWorldgenTrees` lead + v1
`scatterForestTrees` free rider) into per-chunk `ctx.group` InstancedMeshes with
**~5 cast/no-cast buckets + `instanceColor`**. **Defer** the shared-`ctx.rng`
chunk-tree path (`chunks.js:1696`) and **exclude** the `chunkKey`-omitting lake
paths (`lakes.js:537/713`). Run BOTH determinism gates (layout-snapshot for
placement, golden-hash for the visual stream); the low-tier tri budget and the
draw delta are Gary's hard ship-gates on his real GPU.

---

## Convergence Points
-   **Verdict** — all five: *Proceed with mitigations.* None blocked. Direction
    held across both rounds; what changed was scope, not the go/no-go.
-   **Disposal is already correct** — `chunks.js:563` `obj.dispose()` inside the
    `isMesh` guard frees instance buffers; shared geo skipped at `:556`; header
    contract at `:552`. Briefing risk #2 dissolved (all five).
-   **Birds read the registry, not the mesh** — `birds.js:157-169`. Briefing risk
    #4 dissolved — BUT the descriptor must carry `crown`/`perches` into the
    registry or forest birds silently stop perching (Adversary).
-   **The existing registry gate is visual-blind by design** — `dumpRegistry`
    (`main.js:1505-1515`) emits 9 fields, drops scale/color/species/crown/perches
    (Adversary proved it; Architect, Pragmatist conceded). Verified by Mediator.
-   **A new agent-static golden-hash gate is mandatory** (`bin/test-forest-determinism`,
    Adversary Option A; Architect, Pragmatist, Profiler concur). Run BOTH gates.
-   **Slice-1 targets v2 `scatterWorldgenTrees`** — `DEFAULT_WORLDGEN_V2 = true`
    (`perf.js:42`), v2 returns at `chunks.js:405`; v1 is `?worldgen=0`-only.
    The `chunks.js:385` "default OFF" comment is **stale** — trust the constant.
-   **`instanceColor` + ~5 cast/no-cast buckets** — orthogonal to selective
    shadow casting; ~69× per-chunk draw reduction; keeps the 56-caster audit.
-   **Per-chunk granularity, not per-forest-block** — block needs a macrocell
    lifecycle for a rounding-error draw saving.
-   **Additive descriptor refactor, Group return type unchanged** — protects the
    six sandbox cases + the excluded lake call-sites.
-   **Module-shared unit geos tagged; per-chunk InstancedMeshes NOT tagged** —
    `userData.shared` split is the disposal contract.
-   **Defer chunk-trees (shared `ctx.rng`), exclude lakes (`chunkKey`-omission +
    scale-coupled collider)** — Architect's stream-class slice boundary.

## Conflicts Resolved
| Conflict | Position A | Position B | Resolution | Rationale |
| -------- | ---------- | ---------- | ---------- | --------- |
| **T1 — Is `bin/layout-snapshot` a sufficient determinism gate?** | Architect R1 + Pragmatist R1: yes — registry diff catches a moved tree/perch/crown | Adversary R1: no — it's visual-blind; need a golden-hash gate | **Adversary wins; both concede.** `dumpRegistry` (`main.js:1505-1515`) emits only 9 placement fields — no scale/color/crown/perches. A same-count rng *reorder* changes species/size at a fixed (x,z) → byte-identical snapshot → `--diff` prints `EMPTY`, exits 0, while the forest visually regenerates and bird perches move. The `worldgenDrawCounts` canary (`chunks.js:1304-1325`) doesn't wrap `scatterWorldgenTrees` either. **Build `bin/test-forest-determinism` (golden-hash the descriptor stream); run layout-snapshot too for placement. Neither subsumes the other.** Safety/correctness (tripwire #4) trumps "reuse the existing tool." |
| **T2 — Bucket strategy: `instanceColor` vs green-bucket meshes** | Pragmatist R1: green-bucket reusing `_foliageMats` (~21, no `instanceColor`) | Profiler R1: `instanceColor` (~3-5, one cached program) | **`instanceColor` + cast/no-cast shadow split (~5/chunk); Pragmatist concedes.** The Auditor's all-or-nothing-shadow constraint forces the bucket boundary to *include* the cast/no-cast split regardless. Green-bucketing then needs ~28 buckets to stay shadow-faithful (7 greens × geo × cast-state); the "simple 21" version over-casts and walks back the 56-caster audit (tripwire #9). `instanceColor` is orthogonal to shadow casting and collapses color to a per-instance attribute → ~5 buckets, one extra *cached* program (amortized, not the recompile-storm footgun). |
| **T3 — Which path does slice-1 target?** | Pragmatist R1: v1 `scatterForestTrees` (forests.js:911) first | Profiler R1 + Architect R1: v2 `scatterWorldgenTrees` (chunks.js:1061) is production | **v2 is the non-skippable lead; Pragmatist withdraws v1-first.** `DEFAULT_WORLDGEN_V2 = true` (`perf.js:42`); the v2 branch `return`s at `chunks.js:405`, short-circuiting v1, which is `?worldgen=0`-only. A draw census after instrumenting v1 alone shows the census buckets **unchanged** — it proves nothing. Both forest paths share `buildForestTree`, so one descriptor refactor covers both; v1 rides for free, but the **measured** capture runs on the default v2 build. Verifiability over assumption. |
| **Slice-0 "free win" (chunk-tree material pooling at `tree.js:107`)** | Pragmatist R1: ship it first, zero rng risk, real per-spawn win | Profiler R2 + Pragmatist R2: it's in `buildTree`, called only by v1 `scatterTrees` | **Withdrawn — it does not exist in production.** `buildTree` runs only in the v1 `else` branch (`chunks.js:447`). v2 builders already pool materials (`_foliageMats`/`_forestTrunkMat`/`_birchTrunkMat` shared, `tree.js:44,48,52`); the only remaining v2 per-spawn cost is **geometry**, and pooling varied-dim geometry IS instancing. So there is no zero-risk warm-up slice — the rng-sensitive geometry work is unavoidably first. (If Gary wants a warm-up, the honest one is the CG2 additive descriptor extraction, gated byte-identical — mechanical, not perf.) |
| **Slice granularity: per-chunk vs per-forest-block** | (briefing tempts per-block via the 3×3 structure) | Profiler + Pragmatist + Architect: per-chunk | **Per-chunk, unanimous.** Per-block needs a lake-style macrocell lifecycle outliving all 9 chunks, breaking the "chunk owns its 80m cell" rule (`forests.js:925`/`chunks.js:1070`); the 9→3 draw saving is rounding error and both are already under every tier budget. Per-chunk slots into the existing unload machinery with zero lifecycle change. |
| **Builder return type: descriptor-emitter vs Group** | (briefing plan step 1: emit descriptors *instead of* meshes) | Architect + Adversary + Auditor: keep Group, add `describe*` siblings | **Additive — keep the Group; Pragmatist concedes it's the smaller diff.** Changing the return type breaks six sandbox cases (`sandbox.html:1148,1807,1816,1825,1834,1904`) AND the excluded lake call-sites (`lakes.js:537,713` do `tree.position.set`/`tree.scale.set`) — the sandbox-pass/game-crash footgun running backwards. The Group return stays the single source of truth; the instancing reads a descriptor off it. |

## Risk Register
| Risk | Severity | Mitigation | Owner (persona that flagged it) |
| ---- | -------- | ---------- | ------------------------------- |
| Same-count rng **reorder** changes species/scale/crown at a fixed (x,z) → `layout-snapshot` passes green while every forest regenerates + bird perches move for mid-change players (tripwire #4) | **CRITICAL** | Build `bin/test-forest-determinism` golden-hash gate (CG1); capture golden from `main` first; run on every slice; run layout-snapshot too for position. | Adversary |
| Golden-hash gate not buildable as-drawn — `node-three-shim.mjs` stubs only `Vector3` (`:4-5`) but `tree.js` touches 6 THREE classes (`tree.js:32,34,97,98,106,123`) | High | Extend the shim with ~6 no-op constructor stubs as an explicit CG1 precondition task (Architect — name it before implementation stalls on `import` throwing). | Architect |
| Descriptor refactor changes the builder return type → breaks the 6 sandbox cases + the excluded lake call-sites (sandbox-pass/game-crash, inverted) | High | Keep `buildForestTree`/etc. returning a real Group; add `describe*` siblings / `group.userData.descriptor` (CG2.1). | Adversary / Auditor / Architect |
| Descriptor drops `crown`/`perches` from the registry → forest birds silently stop perching (no error, ambient regression nobody screenshots) | High | Descriptor MUST carry `crown`+`perches`; compute in a shared helper both paths call; Gary confirms birds land in a real forest (CG2.2, CG4.5). | Adversary |
| Untagged new unit geo → first forest-chunk unload disposes it → recompile storm across the other 8 resident forest chunks (tripwire #6) | High | Tag `IcosahedronGeometry(1,1)`/`ConeGeometry(1,1,8)`/unit trunk `userData.shared=true`; leak-check `renderer.info.memory.geometries` over 10 rebuilds (CG3.4, CG4.4). | Auditor / Adversary |
| All-or-nothing instanced `castShadow` over-casts (oak bumps, upper tiers, every birch puff) → walks back the 115→56 shadow audit (tripwire #9) | High | Bucket boundary = the cast/no-cast boundary (~5 buckets), following the existing per-mesh lines `tree.js:185,217,271`; reject "cast the whole crown bucket" (CG3.2). | Auditor / Profiler / Architect |
| Slice-1 instruments v1 `scatterForestTrees` (dead-by-default) → production draw census moves by zero | High | Slice-1 leads with v2 `scatterWorldgenTrees` (`chunks.js:1061`); measured capture on the default build, no `?worldgen=` flag (CG3, CG4.2). | Profiler / Pragmatist / Architect |
| Stale-comment trap — `chunks.js:385` "default OFF while building" contradicts `perf.js:42` `DEFAULT_WORLDGEN_V2 = true`; an implementer trusting the comment scopes to the wrong path | Medium | Trust the constant, not the comment; consider fixing the stale comment in the shipping commit. | Profiler / Pragmatist |
| Instancing defeats per-tree intra-chunk frustum cull → low-tier tris spike (~100k vs 150k budget, ~67%) when a chunk is partially visible | Medium | Per-chunk bounding spheres (mandatory, not optional); keep `forestTreeDensityMul=0.7` on low (`perf.js:66`); Gary live-measures `?perf=low/mid` as a hard ship-gate; LOD/detail-0 fallback parked on ROADMAP (CG3.6, CG4.3). | Profiler |
| Per-chunk InstancedMesh wrongly tagged `userData.shared` → its instance buffers leak across every chunk churn | Medium | Tag ONLY the unit geos shared; the per-chunk InstancedMeshes stay un-tagged and dispose via `chunks.js:563` (CG3.4). | Profiler / Auditor / Adversary |
| Missing `instanceMatrix.needsUpdate=true` after fill → chunk renders empty/frozen (tripwire #7) | Medium | Set `instanceMatrix.needsUpdate` (and `instanceColor.needsUpdate`) after every per-chunk fill (CG3.5). | Auditor |
| `instanceColor` misbehaves under the low-tier threeShim Lambert swap (tripwire #2) | Medium | Gary live-verifies the instanced path renders under Lambert on `?perf=low` (CG3.3) — agent can't check in Codespaces. | Profiler |
| Deferred `scatterTrees` (`chunks.js:1696`) instanced later without care → shared `ctx.rng` reorder desyncs porta-potties + crowd + bubble-jugs (`chunks.js:447-459`), not just trees | Medium (if touched) | Defer to a later, separately-gated slice; the golden-hash gate must cover the `ctx.rng` path separately if/when it's instanced (CG3 excludes it). | Architect |
| Auditor checklist #7 cites `bin/test-registry-grid` for tree-position determinism — wrong tool (it tests synthetic `closestBuilding`, never imports `tree.js`) | Low | Correct the reference to `bin/layout-snapshot` (position) + `bin/test-forest-determinism` (visual stream). | Pragmatist (correcting Auditor) |

## Verdicts Summary
| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Architect | Slice boundary is the **rng-stream class**, not the worldgen version: instance the two isolated-stream forest paths (`chunks.js:1061` lead + `forests.js:911`), defer the shared-`ctx.rng` chunk-tree path, exclude the `chunkKey`-omitting scale-coupled lake paths. T1: the registry gate is structurally blind to the visual stream; the golden-hash gate needs a +6-stub `node-three-shim.mjs` precondition. | Proceed with mitigations |
| Profiler | T3 (dispositive): slice-1 MUST target v2 `scatterWorldgenTrees` (`perf.js:42` default) or the capture measures zero. T2: `instanceColor` + ~5 cast/no-cast buckets (~69× per-chunk cut) beats green-bucketing once shadows force a split. The draw win is unconditional; the **low-tier tri budget** is the gate that can fail. | Proceed with mitigations |
| Adversary | T1 (proven, not asserted): `layout-snapshot`/`dumpRegistry` hash only `kind\|x\|z\|footprint\|collider...` — a foliage rng reorder passes green while the forest regenerates. `bin/test-forest-determinism` golden-hash (Option A, agent-static) is mandatory, not redundant; run both gates. Keep the Group return type (sandbox + lakes survive); descriptor must carry crown/perches (birds). | Proceed with mitigations |
| Auditor | The lifecycle plumbing already exists and is correct (`chunks.js:563`); failure modes are mechanical — untagged unit geo (dispose storm), all-or-nothing instanced shadow that over-casts the 56-caster audit, forgotten `needsUpdate`, sandbox-break from descriptor-only builders. ~5 buckets/chunk (cast/no-cast boundary), not 3. | Ship with mitigations |
| Pragmatist | Determinism is the one load-bearing risk; conceded (R2) that both existing gates are verified-blind to the foliage stream → build the tiny golden-hash gate. Withdrew the v1-first slice plan and the `tree.js:107` "free win" (both non-shipping under v2 default). Slice-1 = v2 `scatterWorldgenTrees` only; two hard Gary gates: determinism diff + `?perf=low` tri budget. | Proceed with mitigations |
