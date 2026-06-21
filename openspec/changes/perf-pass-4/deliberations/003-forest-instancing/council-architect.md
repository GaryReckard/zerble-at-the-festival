## The Architect's Position

> Domain: structural integrity, module boundaries, registry/lifecycle soundness,
> render-pipeline shape. Verified against `src/` at the cited file:lines.

### Priority Sequence

1. **Split the model-boundary change from the instancing change.** First land
   the `buildX → emit descriptor` refactor in `tree.js` as a *pure, additive*
   API (keep the existing `buildTree`/`buildForestTree` returning Groups; add
   `treeDescriptor*()` siblings). Reason: the model's contract today is
   "return a `THREE.Group` at origin" (`tree.js:96,147`; `CLAUDE.md` Conventions,
   `ARCHITECTURE.md:53` "Pure THREE.Group builders"). Moving to "emit a
   descriptor" is a real boundary shift; do it without simultaneously rewiring
   four call sites and disposal.
2. **Enumerate ALL four `buildForestTree`/`buildTree` call sites before
   touching any.** The briefing names two; there are **four**, with three
   different lifecycle owners and three different rng streams (see Structural
   Risk #1). A descriptor refactor that converts the function signature breaks
   the un-migrated sites.
3. **Instance the two isolated-rng forest paths first** (`scatterWorldgenTrees`
   `chunks.js:1061`, `scatterForestTrees` `forests.js:911`). They own their own
   rng stream and their own `ctx.group`, so they're the clean, low-blast-radius
   slice that delivers ~all the draw win.
4. **Defer / exclude the `ctx.rng`-coupled chunk-tree path** (`scatterTrees`
   `chunks.js:1696`) and the **lake island/ring paths** (`lakes.js:537,713`)
   from slice 1. They're low-count (not draw buckets) and carry sharp
   determinism / lifecycle hazards.
5. **Gate-test determinism via the existing `bin/layout-snapshot` registry
   diff**, not a new harness. Then boot the game (sandbox-pass ≠ game-pass).

### Module Boundaries — does tree.js's job change cleanly?

**The decoupling is genuinely clean, and it's clean because the architecture
already decoupled the visual mesh from the registry.** Concrete evidence:

- The registry `tree`/`forest_tree` entries already carry **no `obj` /
  Object3D reference** (`forests.js:920-931`, `chunks.js:1065-1073`,
  `chunks.js:1701-1710`). Contrast `bubble_jug`, which stores `obj: jug`
  (`chunks.js:537`). Trees are already pure data + `perches`/`crown` arrays.
- **Birds read perch targets entirely off the registry entry, never off the
  tree mesh.** `birds.js:157-169` iterates `registry.byKind.get('forest_tree')`
  / `get('tree')` and reads `e.perches` / `e.crown`; `birds.js:321,347` re-find
  the tree via `registry.entries.has(b.perch.treeId)`. There is **zero**
  reference from the bird system to the tree `Object3D`. So instancing the
  visual mesh cannot affect birds *as long as the descriptor still produces the
  same `worldPerches()`/`worldCrown()` data* that gets written into the entry.

So tree.js's job changes from "build a Group (mesh + `userData.crown`/`perches`)"
to "emit `{type, x, y, z, scale, rotY, colorHex, crown, perches}`". This is a
**cleaner** boundary than today, not a dirtier one: today the perch/crown data
is smuggled on `mesh.userData` and a helper (`worldPerches(tree,…)`,
`tree.js:84-94`) reaches *into* the built Object3D to extract it. A descriptor
makes that data first-class instead of a side-channel on a render object. The
`worldPerches`/`worldCrown` helpers should be refactored to take the descriptor
(or its local `perches`/`crown`) directly rather than a built `tree`.

**One boundary the plan must not blur:** the InstancedMesh *assembly* (building
3 InstancedMeshes from N descriptors, baking matrices, setting
`instanceMatrix.needsUpdate`) is **placement-layer work, not model-layer work.**
It belongs in `forests.js`/`chunks.js` (the callers that own `ctx.group`), NOT
in `tree.js`. `tree.js` stays a pure emitter; it must not learn about
InstancedMesh, chunks, or disposal. Keep the unit geos (`IcosahedronGeometry(1,1)`,
`ConeGeometry(1,1,8)`, unit cylinder) module-scoped in `tree.js` and tagged
`userData.shared = true` — that's the one new module-level resource tree.js
owns, consistent with its existing `_trunkGeo`/`_foliageMats` pools
(`tree.js:32-54`).

### Lifecycle home — is per-chunk InstancedMesh correct?

**Yes for the two forest paths, and the disposal plumbing already supports it.**
Verified:

- Forest content is built into **each chunk's own `ctx.group`**, not a shared
  forest-block group. `scatterForestTrees` does `ctx.group.add(tree)`
  (`forests.js:914`); `scatterWorldgenTrees` does `ctx.group.add(tree)`
  (`chunks.js:1064`). The 3×3 forest "block" is a *placement concept*
  (`getForestAt` decides which chunk gets which trees, `forests.js:412`), but
  **ownership of the meshes is per-chunk** — each of the 9 chunks holds its own
  slice in its own group and registers its trees with **its own**
  `chunkKey: ctx.key` (`forests.js:925`, `chunks.js:1070`). So "one chunk owns
  what" is unambiguous: the chunk whose 80m cell the trunk falls in. Per-chunk
  InstancedMeshes are therefore the **natural** lifecycle home — they're built
  into a group that already loads/unloads as a unit.
- **Disposal already handles InstancedMesh correctly.** `disposeChunkByKey`
  (`chunks.js:553-565`) walks the group; the dispose branch is gated on
  `obj.isMesh` (line 555), and `InstancedMesh extends Mesh`, so it's reached.
  Line 563 `if (obj.isInstancedMesh) obj.dispose()` frees the per-chunk
  `instanceMatrix`/`instanceColor` GPU buffers, while line 556 correctly
  **skips** the shared unit geometry (`userData.shared`). This is exactly the
  pattern the briefing's risk #2 asks for, and **it already exists** — the code
  comment at `chunks.js:552` even states the contract: "InstancedMesh.dispose
  frees only its own instance buffers." **No leak**, provided: (a) the unit geos
  are `userData.shared`, (b) the per-chunk InstancedMeshes are real
  `THREE.InstancedMesh` added to `ctx.group`, (c) the per-instance color (if
  `instanceColor`) and matrix buffers are *not* shared. The lake path has the
  identical guard (`lakes.js:863-874`).

This means **the lifecycle risk the briefing flags as open (#2) is already
closed by existing infrastructure.** That's a strong signal to ship the
forest-path slice.

### Registry / determinism soundness

- **Registry entries stay byte-identical.** The plan's item 4 (entries are data,
  unchanged) is correct and load-bearing: `forest_tree`/`tree` entries keep
  `kind/position/footprint/collider/chunkKey/perches/crown`
  (`forests.js:920-931`, `chunks.js:1065-1073`, `chunks.js:1701-1710`). Because
  birds, collision, and crowd all read the registry and never the mesh, an
  unchanged registry == unchanged behavior for every downstream system. This is
  the cleanest possible decoupling and it's the crux of why this refactor is
  structurally sound.
- **Determinism gate already exists — use it, don't build a new one.**
  `bin/layout-snapshot` captures `__dbg.dumpRegistry()` which includes trees
  (`bin/layout-snapshot:35` lists "trees" explicitly). Capture a seed's forest
  registry before the change, apply, re-capture, diff. If a single tree
  position, perch, or crown moved, the rng order shifted. `bin/test-registry-grid`
  is the *wrong* gate here (it tests `closestBuilding` grid-vs-scan, not tree
  placement) — don't conflate them. The invariant to assert: **for the two
  forest paths, the descriptor emitter must call `rng()` in the exact same order
  and the same number of times as the current `buildForestTree` body**, because
  the placement loop's spacing/density rejections (`forests.js:852-904`) and the
  worldgen guards (`chunks.js:1084-1097`) consume the *same* stream right after
  each `buildForestTree(rng)`. Reorder a single `rng()` inside
  `buildTallPine`/`buildOak`/`buildBirch` and every subsequent tree in that
  chunk moves (`CLAUDE.md` tripwire #4).

### Structural Risks Identified

- **Risk — incomplete call-site map (the plan's biggest omission).** The
  briefing names `scatterForestTrees` + the chunk-tree `buildTree`. The real set
  of `buildForestTree`/`buildTree` consumers is **four sites across three files
  with three rng regimes and three lifecycle owners**:
  1. `forests.js:911` (`scatterForestTrees`) — v1 forest, isolated rng
     `mulberry32(hash2(forest.seed+…))` (`forests.js:836`), `chunkKey`, per-chunk
     group. **Slice-1 target.**
  2. `chunks.js:1061` (`scatterWorldgenTrees`) — v2 worldgen, isolated rng
     `mulberry32(worldHash(…))` (`chunks.js:1039`), `chunkKey`, per-chunk group,
     **80 trees/chunk** (`MAX_WORLDGEN_TREES`, `chunks.js:1027`). This is the
     **dominant** draw bucket and the *real* lever — and it's NOT named in the
     briefing. **Slice-1 target.**
  3. `chunks.js:1696` (`scatterTrees`) — v1 chunk trees, uses **`ctx.rng`**
     (shared with all other chunk props, `chunks.js:1696,1698`). Instancing here
     means the descriptor emitter must preserve `ctx.rng` order exactly or it
     desyncs *every other prop in the chunk*, not just trees. Higher blast
     radius, lower count (`density*18`, `chunks.js:1684`). **Defer.**
  4. `lakes.js:537,713` — lake island + lakeshore-ring trees, lake-owned group,
     **`tree.scale.set()` applied per-tree** (`lakes.js:540,716`), and the ring
     trees **deliberately omit `chunkKey`** (`lakes.js:720-723`, the documented
     "survives chunk unload" invariant, `CLAUDE.md` tripwire #5). Low count
     (0-2/island; a thin ring). **Exclude from instancing entirely** — see next
     risk.

- **Risk — lake trees carry a different lifecycle and a per-tree scale; folding
  them into per-chunk instancing would break the `chunkKey`-omission invariant.**
  Lake trees live in the **lake's** group (disposed by `lakes.js` distance
  unload, `lakes.js:863`), not a chunk group, and their colliders must outlive
  chunk churn (no `chunkKey`). If someone "unifies" all tree instancing onto the
  per-chunk InstancedMesh, lake trees would either (a) get a `chunkKey` and
  vanish mid-game when a host chunk drops, or (b) need a parallel lake-owned
  InstancedMesh anyway. They're also tiny in count and already carry a per-tree
  uniform scale the unit-geo matrix would have to absorb. **Architecturally,
  leave lake trees as per-tree Groups.** They are not a draw bucket; instancing
  them buys nothing and risks the lake collider-survival contract.

- **Risk — `worldPerches`/`worldCrown` currently take a built `tree` Object3D
  (`tree.js:84-94`).** If the refactor keeps these signatures but the forest path
  no longer builds a per-tree Group, the callers (`forests.js:929-930`,
  `chunks.js:1071-1072,1708-1709`) have nothing to pass. The helpers must be
  refactored to accept the descriptor (or its `perches`/`crown` + x/z) directly.
  This is a clean change but it's a **shared-signature** change touching all four
  sites — another reason to keep the old Group-returning path alive during
  migration so the un-migrated sites (chunk trees, lakes) keep working unchanged.

- **Risk — shadow discipline must be re-expressed at the InstancedMesh level,
  and it's lossy.** Today shadow-casting is **per-mesh and selective**: oak main
  crown casts, bumps don't (`tree.js:215-233`); only the lowest pine tier casts
  (`tree.js:185`); only the lowest birch puff casts (`tree.js:271`). An
  InstancedMesh casts shadow as **one all-or-nothing unit per geometry bucket.**
  If the plan builds "one crown-icosa InstancedMesh," it cannot say "oak mains
  cast but oak bumps don't" within a single instanced draw — the bumps and mains
  share the same unit icosa geo. The structurally honest options: (a) separate
  instanced buckets for shadow-casters vs non-casters (more draws, defeats the
  point), or (b) accept a uniform shadow policy per bucket and re-audit the
  caster count against the per-tier budget (`CLAUDE.md` #9, `.claude/rules/
  performance.md` "small detail meshes don't appear distinct in shadow anyway").
  Option (b) is defensible — a forest reads as a mass — but it **changes the
  shadow silhouette** and must be verified live by the human, not assumed.

- **Risk — sandbox/no-build hygiene is a hard gate, not a footnote.** tree.js
  exposes `buildTallPine`/`buildOak`/`buildBirch` as sandbox cases
  (`sandbox.html:284-287`, `bird_in_tree` at `sandbox.html:299`). If the sandbox
  keeps calling the Group-returning builders while the game uses descriptors, the
  sandbox verifies a **different code path** than ships — exactly the
  "sandbox-pass + game-fail" footgun (`CLAUDE.md` Run+verify). The sandbox should
  gain an *instanced-forest-patch* composite case so the actual shipping
  assembly is eyeballable. No new `src/` module is required by this change (it's
  edits to existing files), so the 4-html importmap rule (`.claude/rules/
  no-build.md`) isn't triggered — but `bin/check-importmaps` should still run
  green, and if any helper gets hoisted to a new file, all four html files must
  be updated.

### Verdict

- **Verdict**: **Proceed with mitigations.**
- **Key Concern**: The plan's call-site map is incomplete — there are **four**
  tree call sites with three rng streams and three lifecycle owners, not the two
  the briefing names. Instancing must be scoped to the **two isolated-rng forest
  paths** (`forests.js:911`, `chunks.js:1061`); the `ctx.rng`-coupled chunk-tree
  path and the `chunkKey`-omitting lake paths must be **excluded** from slice 1.
- **Recommendation**: Ship it, scoped. The decoupling is structurally *sound and
  already mostly in place* — the registry has no mesh reference, birds read the
  registry not the Object3D (`birds.js:157-169`), and the chunk/lake disposal
  walks already dispose InstancedMesh and skip shared geo (`chunks.js:553-565`,
  `lakes.js:863-874`). So the two scariest open risks in the briefing
  (disposal/leak #2, bird coupling #4) are **already closed by existing
  infrastructure** — a strong ship signal. Mitigations, in order: (1) keep
  tree.js's Group-returning builders alive and add descriptor emitters
  *additively*, so the un-migrated chunk-tree + lake sites keep working;
  (2) instance only the two forest paths; (3) keep all InstancedMesh assembly in
  the placement layer (`forests.js`/`chunks.js`), keep tree.js a pure emitter
  with `userData.shared` unit geos; (4) gate determinism with a
  `bin/layout-snapshot` registry diff (NOT `test-registry-grid`); (5) re-audit
  shadow casters at the bucket level against the per-tier budget and verify the
  silhouette live; (6) add an instanced-forest sandbox composite and boot the
  game before "done."
