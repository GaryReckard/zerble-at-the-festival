## The Adversary's Position

I ran the plan against the engine reality at file:line. The instancing *idea* is
sound and the disposal path is (surprisingly) already correct. What breaks is the
**descriptor refactor** the plan hangs everything on: it sits directly on top of
two load-bearing tripwires (determinism + sandbox return-shape) and the proposed
gate test (`bin/test-registry-grid`) is **structurally incapable** of catching the
exact regression it's being cited to guard against.

### Priority Sequence

1. **Freeze the rng call-order as an explicit, asserted invariant BEFORE touching
   any builder.** Add a real foliage-determinism gate (see Vuln 1) — without it,
   no slice ships.
2. **Decouple the descriptor refactor from the visual refactor.** Make builders
   emit descriptors *and keep returning a Group* (or keep the build* functions
   intact and add new `describe*` functions), so the sandbox's direct
   `buildTallPine()/buildOak()/buildBirch()/buildTree()` calls never break.
3. Only then swap the per-tree mesh for per-chunk InstancedMeshes, with unit geos
   `userData.shared` and a verified instance-buffer free on unload.

### Vulnerabilities Found

#### Vuln 1 — The rng call-order trap is real, and the cited gate test cannot catch it. — Severity: Critical

The exact rng() sequence today, IN ORDER, per builder:

- **`buildForestTree`** (tree.js:148): `r = rng()` → branches into one of:
- **`buildTallPine`** (tree.js:156): `rng()` trunkH(160) → `rng()` trunkR(161) →
  `rng()` greenIdx(174) → `rng()` tiers(176) → `rng()` baseR(178). **5 draws.**
- **`buildOak`** (tree.js:196): `rng()` trunkH(200) → `rng()` trunkR(201) →
  `rng()` greenIdx(211) → `rng()` mainR(213) → `rng()` bumpCount(221) → then
  **per bump** `rng()` br(223), `rng()` ang(224), `rng()` y-jitter(229). Variable
  count: `5 + 3*bumpCount`.
- **`buildBirch`** (tree.js:240): `rng()` trunkH(244) → `rng()` trunkR(245) →
  `rng()` greenIdx(255) → `rng()` crownCount(259) → then **per crown** `rng()`
  cr(263), `rng()` x-jitter(267), `rng()` z-jitter(269). Variable: `4 + 3*crownCount`.

Then the CALLER draws once more: `tree.rotation.y = rng()` (forests.js:913,
chunks.js:1063). So the per-tree stream is `[buildForestTree internals] +
[rotation]`, and the **next tree in the scatter loop inherits the advanced
stream** (forests.js:852 single `rng` for the whole chunk). This is a single
shared sequence — any reorder shifts *every subsequent tree in that chunk and
every chunk after*.

The invariant the plan needs is therefore stricter than "same number of draws":
it is **"each builder consumes rng() in the identical order AND the identical
count, including the variable-length bump/crown loops, and the caller's rotation
draw stays last."** A descriptor refactor is exactly where this silently breaks:

- Emitting `colorHex` before `scale` in the descriptor literal tempts you to draw
  `greenIdx` before `trunkH/trunkR` — today greenIdx is drawn 3rd
  (tree.js:174/211/255), AFTER both trunk draws. Reorder → whole forest shifts.
- Hoisting the bump/crown loop's `rng()` draws out of the per-bump loop to
  "precompute the descriptor list" changes interleaving and breaks it.
- A natural "compute scale once at the top" refactor moves `mainR`/`baseR` ahead
  of `greenIdx`.

**The cited gate cannot see any of this.** `bin/test-registry-grid` (read in
full) builds **synthetic random registries** of `KINDS` and asserts the grid
`closestBuilding` broadphase agrees with a linear scan — its own header says
"determinism gate for the grid-accelerated registry.closestBuilding." It never
imports `tree.js`, never calls `buildForestTree`, never runs `scatterForestTrees`,
and asserts only on `footprint`/`position` truthiness equality. A foliage-only or
rng-reorder change leaves `kind/position/footprint/collider` **byte-identical**
(the plan's step 4 explicitly keeps registry entries as-is) — so even a
hypothetical forest-aware position diff would pass while every tree's *size,
species, and green shade* silently regenerated. The registry diff is blind to
visuals **by design**.

Worse: `perches`/`crown` ARE registry data (forests.js:929-930) and ARE derived
from the rng-driven build (trunkH, mainR, etc.). A reorder that changes which
species/size a tree gets DOES change `crown.r` and perch ring radius — so birds
land in different spots — but a *position-only* registry diff still won't flag it
unless it diffs the `crown`/`perches` payload too.

**Mitigation (mandatory):** add a new node gate — call it
`bin/test-forest-determinism` — that imports the real `tree.js` via the
node-three-shim loader (the pattern `test-registry-grid` already uses at line
`register('./node-three-shim.mjs')`), runs `buildForestTree(mulberry32(FIXED))`
N times, and snapshots a **golden hash of the full descriptor stream** (type,
trunk dims, greenIdx, every bump/crown draw, rotation). Capture the golden from
`main` BEFORE the refactor; the refactor passes iff the hash is unchanged. This
is the only thing that actually proves the invariant. Without it, "calling rng()
in the exact same order" (plan step 1) is an unverifiable promise.

#### Vuln 2 — Disposal is already correct, but ONLY by a single line; the plan must not regress it. — Severity: Medium (Low if untouched)

I checked the fear in the briefing. `disposeChunkByKey` (chunks.js:553-565) does
NOT leak instance buffers — line 563 `if (obj.isInstancedMesh) obj.dispose()`
already exists, and InstancedMesh `isMesh === true` so the block is reached. The
header comment at chunks.js:552 even spells out the contract: "InstancedMesh.
dispose frees only its own instance buffers." So with unit geos tagged
`userData.shared` (skipped at line 556) and the per-chunk InstancedMesh disposed
at 563, the instanceMatrix/instanceColor GPU buffers are freed on unload and the
shared geo survives. **The plan's disposal assumption holds — but on a knife's
edge:**

- The dispose at 563 is *inside* the `if (obj.isMesh)` guard (line 555). That's
  fine for InstancedMesh, but if the refactor ever wraps trees in a non-Mesh
  container that holds the instanced children differently, verify the traverse
  still reaches them.
- `instanceColor` is freed by `.dispose()`, but if the plan instead goes the
  "N green-bucket meshes" route (plan step 2 offers both), each bucket mesh must
  be a child of `ctx.group` so the traverse hits it. A bucket mesh added to a
  module-level cache or to `scene` directly would **leak every chunk unload** —
  the traverse only walks `chunk.group`.
- Tripwire #7: per-instance matrix writes need `instanceMatrix.needsUpdate=true`.
  Trees are static (built once per chunk), so this is set-once — fine — but the
  refactor must not forget it on the build, or the chunk renders empty/frozen.

**Mitigation:** add the 10-rebuild leak check the comment at chunks.js:550
references (task 6.3) over a forest chunk, and assert `renderer.info.memory.geometries`
returns to baseline. Static check can't prove GPU-buffer release; this is on the
human's verify list.

#### Vuln 3 — Sandbox-pass / game-crash inverted: the descriptor refactor breaks the SANDBOX, not the game. — Severity: High

This is the classic tripwire running backwards. The sandbox calls the builders
**directly and expects a `THREE.Group`**:

- `sandbox.html:1148` `buildTree(Math.random)` → `.add(g)`
- `sandbox.html:1807` `buildTallPine(Math.random)`
- `sandbox.html:1816` `buildOak(Math.random)`
- `sandbox.html:1825` `buildBirch(Math.random)`
- `sandbox.html:1834` `buildForestTree(Math.random)`
- `sandbox.html:1904` (the `bird_in_tree` case) `const tree = buildOak(Math.random);
  g.add(tree); const perches = tree.userData.perches` — it reads `userData.perches`
  **off the returned Object3D** to place perch-marker birds.

If plan step 1 changes these functions to "emit instance descriptors instead of
building/returning meshes," every one of these six sandbox cases throws
(`g.add(undefined)` / `tree.userData` is undefined) — the model-iteration surface
that this whole project's doctrine depends on
(`.claude/rules/sandbox-and-testing.md`) goes dark, and `bird_in_tree` loses its
perch-anchor visualization. The game might boot fine while the sandbox is broken
— the exact inversion of footgun "sandbox-pass + game-crash," and just as bad
because the next agent can no longer verify a tree edit.

**Mitigation (this is why I want step 2 above):** do NOT change the return type of
`buildTallPine/buildOak/buildBirch/buildForestTree/buildTree`. Either (a) keep
them returning a Group and add separate `describeForestTree()` etc. that the
scatter path uses, or (b) have the builders internally compute a descriptor and
build the Group from it, exposing the descriptor on `group.userData.descriptor`
so the instancing path can read it without losing the sandbox's Group. Option (b)
keeps a single source of truth for the rng order (one place to gate-test) AND
keeps the sandbox alive.

#### Vuln 4 — Birds are clean; do not let the refactor break the registry-as-truth contract. — Severity: Low (becomes High if violated)

I traced the bird coupling: `birds.js` reads perches/crown **only** from the
registry entry — `_findFreePerch` scans `registry.byKind.get('forest_tree')` /
`'tree'`, then `registry.entries.get(id)` and reads `e.perches` / `e.crown`
(birds.js:157-169), keyed by the registry entry id (`treeId`). Nothing in
`birds.js` touches a tree Object3D. Grep confirms `worldPerches/worldCrown` and
`userData.crown/perches` are read off a live tree ONLY inside the builders and at
the three registration sites (forests.js:929-930, chunks.js:1071-1072,
1708-1709) — all of which run at build time and store world-space data into the
registry. So instancing the *visual* mesh is invisible to birds **as long as the
registry entry still gets correct `perches`/`crown`**.

The fragility: those values are computed by `worldPerches(tree, x, z)` /
`worldCrown(tree, x, z)` (tree.js:84-94), which read `tree.userData.perches` off
the **built Group**. If the refactor stops building a Group at the scatter site
(per Vuln 3) and forgets to populate `crown`/`perches` from the descriptor, the
registry entries get `perches: []` / `crown: null` and **birds silently stop
perching in forests** — no error, no crash, just no birds in the woods. Only the
running game shows it (chunks/forests don't run in the model sandbox), and it's a
slow, ambient regression nobody screenshots.

**Mitigation:** the descriptor MUST carry `crown` + `perches` (the plan's step 1
descriptor shape lists them — good), and the registration must read them from the
descriptor, not from a now-absent Group. Add to the human verify list: boot the
game, `__dbg.start()`, fly to a forest, confirm birds land (the `bird_in_tree`
sandbox case only proves the model, not the registry wiring).

### Verdict

-   **Verdict**: Proceed with mitigations (do NOT ship as drawn).
-   **Key Concern**: Plan step 1 ("call rng() in the exact same order") is an
    unverifiable promise — `bin/test-registry-grid` cannot catch a foliage/rng
    reorder (it tests `closestBuilding`, not `buildForestTree`), and the registry
    diff is visual-blind by design. A reorder regenerates every forest for every
    mid-change player (tripwire #4). A new `bin/test-forest-determinism` golden-hash
    gate over the real builders is a hard precondition, not a nice-to-have.
-   **Recommendation**: The instancing payoff is real and the disposal path
    already frees instance buffers (chunks.js:563) — this is shippable. But gate
    it: (1) golden-hash the rng descriptor stream from `main` first; (2) keep the
    builders' Group return type so the six sandbox tree cases and `bird_in_tree`
    don't break; (3) verify the descriptor carries `crown`/`perches` so forest
    birds keep perching; (4) human confirms instance-buffer free over a
    10-rebuild forest-chunk leak check and tri-budget on `?perf=low`/`mid`. Slice
    it: descriptor-extraction + golden gate first (pure refactor, zero visual
    change, must pass byte-identical), THEN the InstancedMesh swap.
