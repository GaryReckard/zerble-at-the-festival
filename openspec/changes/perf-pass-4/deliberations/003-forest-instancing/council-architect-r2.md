## The Architect — Round 2 (cited cross-examination)

> Domain: structural integrity, call-site ownership, rng-stream isolation,
> lifecycle/registry invariants, determinism boundary. Every claim re-verified
> against `src/` at the cited file:line on branch `procedural-map-generator`,
> 2026-06-20. R1 line numbers held exactly — no drift.

### Re-verification of the four call-sites (R1 held, line-for-line)

| # | Site | rng stream | Lifecycle owner | scale? | Verdict |
|---|------|-----------|-----------------|--------|---------|
| 1 | `forests.js:911` (v1 forest) | **isolated** `mulberry32(hash2(forest.seed+…))` `forests.js:836` | chunk (`chunkKey: ctx.key` `forests.js:925`) | no | **slice-1** |
| 2 | `chunks.js:1061` (v2 worldgen) | **isolated** `mulberry32(worldHash(…))` `chunks.js:1039` | chunk (`chunkKey: ctx.key` `chunks.js:1070`) | no | **slice-1, lead** |
| 3 | `chunks.js:1696` (v1 chunk trees) | **SHARED** `ctx.rng` `chunks.js:1696,1698` | chunk (`chunkKey` `chunks.js:1706`) | no | **defer** |
| 4 | `lakes.js:537/713` (lake island+ring) | lake-owned `rng` | **lake** (ring **omits `chunkKey`** `lakes.js:722-727`) | **yes** `lakes.js:540,716` | **EXCLUDE** |

All four `buildForestTree`/`buildTree` consumers confirmed present at the R1
lines (`grep` of `src/forests.js`, `src/chunks.js`, `src/lakes.js`). The
disposal plumbing R1 leaned on also held: `disposeChunkByKey` shared-skip at
`chunks.js:556`, `isInstancedMesh → dispose()` at `chunks.js:563` (header
contract `chunks.js:552`); the lake walk mirrors it at `lakes.js:866,874`.

---

### TENSION T3 — call-site ownership & slice scoping (the structural adjudication)

**Concession to Profiler, with a structural correction.** Profiler is right that
**`scatterWorldgenTrees` (`chunks.js:1061`) is the production-default path** —
`USE_WORLDGEN_V2` gates it at `chunks.js:391`, and the v1 path
(`chunks.js:408-460`) is the `?worldgen=0` legacy branch. My R1 already named
both forest paths as slice-1 targets and called the v2 path "the **dominant**
draw bucket and the *real* lever" (R1 Structural Risk #1.2), so we agree. The
correction to the *framing*: this is not "v1 vs v2 — pick one." Both v1-forest
(`forests.js:911`) and v2-worldgen (`chunks.js:1061`) are **structurally
identical for instancing purposes** — both run an isolated stream, both
`ctx.group.add(tree)` into a per-chunk group, both register `chunkKey: ctx.key`.
The descriptor emitter + per-chunk InstancedMesh assembly is the *same code* for
both; only the placement loop differs. So slice-1 covers **both forest paths
with one descriptor refactor**, and Profiler's "if you only touch v1 you ship
zero savings to production" is the reason **`chunks.js:1061` is the non-skippable
member of slice-1**, not a second option. Lead with it; `forests.js:911` rides
the same emitter for free.

#### (a) Is `chunks.js:1696` `scatterTrees` (shared `ctx.rng`) too dangerous for slice-1? — YES. Defer it.

This is the sharpest structural distinction in the whole change, and the code
makes it unambiguous. **Verified the v1 theme-builder dispatch
(`chunks.js:415-460`):** `ctx.rng` is a *single shared per-chunk stream*
(`mulberry32(chunkSeed)`, `chunks.js:420`) consumed in strict sequence —

```
placePaths(ctx)            chunks.js:433
THEME_BUILDERS[theme](ctx) chunks.js:442   ← stages/trucks/vendor rows draw ctx.rng
scatterTrees(ctx, density) chunks.js:447   ← buildTree(ctx.rng) chunks.js:1696
scatterPortaPotties(ctx)   chunks.js:452   ← reads the ADVANCED stream
spawnAmbientCrowd(ctx)     chunks.js:456   ← reads it further advanced
scatterBubbleJugs(ctx)     chunks.js:459   ← and again
```

Contrast the two forest paths, where the stream is *born and dies inside the
scatter function* (`forests.js:836`, `chunks.js:1039`) and feeds **nothing
downstream**. The structural rule that decides the slice boundary:

> **An isolated stream's blast radius is bounded by its own loop. A shared
> stream's blast radius is every consumer that draws after it in the same
> chunk.**

If a descriptor refactor of `buildTree` adds, drops, or reorders a single
`rng()` call, it doesn't just move the *trees* — it shifts the stream feeding
**porta-potties, ambient crowd, AND bubble jugs** for that chunk and every chunk
after (`CLAUDE.md` tripwire #4). The forest paths cannot do that; their reorder
is contained to "which trees, where" within the one function. **That is why
`scatterTrees` is excluded from slice-1 and deferred to a later, separately-gated
slice** — not because the trees are few (`density*18`, `chunks.js:1684`, ~18/chunk
vs 80 for v2, so it's also a *minor* draw bucket), but because it sits on a
shared determinism stream and is the v1-legacy path players are NOT defaulted to.
Low reward, high blast radius, non-default branch — defer is correct on all three
axes. (Pragmatist's Slice-2 placement agrees; my structural reason is the shared
`ctx.rng` stream, which is the load-bearing justification, not just "it's
smaller.")

#### (b) Lakes MUST be excluded to preserve the `chunkKey`-omission / collider-survival invariant. — CONFIRMED, and it's stronger than R1 said.

Re-read `lakes.js:713-727`. The ring-tree registry entry **deliberately omits
`chunkKey`**, with the in-code rationale at `lakes.js:720-721`: *"No chunkKey so
the tree survives chunk unload (it's bound to the lake's lifecycle)."* This is
the documented `CLAUDE.md` tripwire #5 invariant — fold lake trees into a
per-chunk InstancedMesh and either (a) they inherit `chunkKey` and vanish when a
host chunk drops, or (b) you need a parallel lake-owned InstancedMesh anyway.

Two facts I under-weighted in R1, now load-bearing for the EXCLUDE verdict:

1. **Lake trees carry a per-tree uniform scale that is registry-coupled.**
   `lakes.js:540` (island) and `lakes.js:716` (ring): `s = 0.85 + rng()*0.3x`,
   `tree.scale.set(s,s,s)`. Forest/chunk trees **never** scale the Group. More
   pointedly, the ring tree's collider radius is **scale-derived**:
   `collider: { radius: 1.0 * s }` (`lakes.js:726`). So an instancing refactor of
   lake trees would have to bake `s` into the instance matrix AND keep the
   collider radius in sync with it — a coupling the forest paths simply don't
   have. This is a second, independent structural reason lake trees are not the
   same animal.

2. **Count is trivial and not a draw bucket.** 0-2 per island (`lakes.js:531`), a
   thin ring (`placed++` loop). Instancing them buys ~nothing and risks the
   lake collider-survival contract. **Architecturally: leave lake trees as
   per-tree Groups.** They are owned by the lake's distance-unload
   (`lakes.js:866-874`), not a chunk, and that ownership boundary is exactly what
   the `chunkKey` omission encodes. Slice-1 must not so much as touch
   `lakes.js`.

> **One cross-examination of myself:** the *descriptor refactor* of `tree.js`
> (if `buildForestTree`'s signature changes) WOULD reach `lakes.js:537/713`,
> because lakes import and call `buildForestTree` (`lakes.js:25`). This is the
> Adversary's Vuln 3 / Auditor's "sandbox break" running through the lake path:
> if the builder stops returning a Group, the lake call sites break too
> (`lakes.js:538` does `tree.position.set`, `:540` does `tree.scale.set`). So
> "exclude lakes from *instancing*" is necessary but not sufficient — the
> refactor must **keep `buildForestTree` returning a real Group** (R1
> mitigation 1; Adversary's "keep the return type") so the un-instanced lake +
> chunk-tree + sandbox callers keep working unchanged. The instancing reads a
> *descriptor*; the Group return stays the single source of truth. This is the
> structural seam that makes "instance two paths, leave three call-sites alone"
> actually composable.

#### (c) Does the per-chunk InstancedMesh belong in `ctx.group` for BOTH v1-forest and v2 paths, and does that compose with the 9-separate-chunk-group forest build?

**Yes to `ctx.group`; and yes, it composes — because the 3×3 forest is a
*placement* concept, not an *ownership* one.** Verified: both forest scatterers
add to the **per-chunk** group — `forests.js:914` `ctx.group.add(tree)`,
`chunks.js:1064` `ctx.group.add(tree)` — and register `chunkKey: ctx.key`
(`forests.js:925`, `chunks.js:1070`). The forest "block" (`getForestAt`,
`buildForestChunk` at `chunks.js:430`) decides *which of the 9 chunks gets which
trees*, but each of the 9 chunks holds **its own** trees in **its own** group and
unloads them with **its own** `chunkKey`. There is no shared forest-block group.

So the per-chunk InstancedMesh is the **natural** lifecycle home for both paths:
each chunk accumulates its descriptors, builds its own ~N InstancedMeshes into
its own `ctx.group`, and `disposeChunkByKey` frees them on unload via the
existing `isInstancedMesh → dispose()` branch (`chunks.js:563`). The 9-group
forest doesn't need any special handling — it's just nine independent per-chunk
instancings, one per cell. **Reject per-forest-block instancing** (Profiler and
Pragmatist both reach this; my structural reason is the cleaner one): a
per-block InstancedMesh would have to live in *some* group that outlives all 9
chunks — i.e. you'd be inventing a lake-style macrocell lifecycle for forests,
breaking the "chunk owns what falls in its 80m cell" rule that
`forests.js:925`/`chunks.js:1070` already encode. The draw delta (9 instanced
draws/block vs 3) is rounding error against the ~4,757-draw win and is already
far under every tier budget. Per-block trades a clean ownership boundary for a
non-win. Per-chunk, in `ctx.group`, for both paths.

**Structural caveat on bucket count (concession to Auditor + Profiler).** "~3
InstancedMeshes per chunk" is the wrong number to design against. The bucket
boundary is forced by *two* orthogonal axes that the per-chunk group must hold:
(i) geo type (icosa crown / cone tier / trunk cylinder), and (ii) the
**cast/no-cast shadow boundary** — because `InstancedMesh.castShadow` is one
boolean for all instances, and today's casting is selective *within a tree*
(`tree.js:185` lowest cone only, `tree.js:217` oak main but not bumps,
`tree.js:271` lowest birch puff only). To preserve the audited 56-caster
discipline (`CLAUDE.md` #9), the bucket split MUST equal the cast/no-cast split
→ ~5 InstancedMeshes/chunk (Auditor's enumeration is correct), not 3. That's
still a per-chunk-group, still disposed by the same branch, still a massive draw
cut — but the slice plan must size for ~5 buckets × per-chunk, and color rides
`instanceColor` (one extra cached program, Profiler — not 7 green-bucket meshes).
This doesn't change the ownership verdict; it changes the count the per-chunk
group carries.

---

### TENSION T1 — is the registry the right determinism boundary, or does the visual descriptor stream need its own golden hash?

**The Adversary is right, and I'm revising my R1 position. The registry snapshot
is the correct gate for the *placement* invariant but is structurally BLIND to
the *visual descriptor* invariant — and for this refactor, the visual descriptor
invariant is the one that actually breaks.**

Verified against source what the gate captures. `__dbg.dumpRegistry`
(`main.js:1505-1515`) emits exactly:
`{ kind, x, z, footprint, colliderR, damage, attractorR, attractorW, chunkKey }`.
`bin/layout-snapshot`'s `normalizeEntries` (`layout-snapshot:73-83`) projects the
**same nine fields** and its `keyOf` (`layout-snapshot:281`) diffs them. It
captures **none** of: `scale`, `colorHex`/greenIdx, **species type**, **`crown.r`**,
or **`perches[]`**.

Now apply that to the three site classes — the structural ruling:

1. **Forest paths — registry catches the POSITION reorder but NOT the
   species/size reorder.** Because the isolated stream's *next-candidate* draws
   (`forests.js:853-854`, `chunks.js:1085-1086`) come right after each tree's
   build, any change in how many `rng()` calls `buildForestTree` consumes shifts
   the *next tree's x/z* — and `x`/`z` ARE in the snapshot, so a *count* change
   surfaces. **But a pure reorder that consumes the same count in a different
   order** (Adversary's exact trap: drawing `greenIdx` before `trunkH` — today
   it's 3rd, `tree.js:174/211/255`) changes which *species/size* a tree at a
   *fixed position* gets, with **zero x/z movement**. That regenerates every
   forest's look (and `crown.r` / perch ring → birds land differently,
   forests.js:929-930) while the registry snapshot stays **byte-identical**. The
   gate is blind to it **by design** — `dumpRegistry` doesn't emit the descriptor
   fields.

2. **Lake paths — partially self-guarding, accidentally.** `colliderR = 1.0 * s`
   (`lakes.js:726`) IS in the snapshot, and `s` is rng-derived (`lakes.js:715`),
   so a reorder that changes `s` would move `colliderR` and surface. But that's a
   side-effect, not coverage — island trees (`lakes.js:537`) have **no collider
   at all** (`lakes.js:542-543`), so their reorder is fully invisible. And lakes
   are EXCLUDED from this change anyway, so this is moot for slice-1.

3. **The blind spot that matters:** `crown` and `perches` are **registry data**
   (forests.js:929-930, chunks.js:1071-1072) that birds consume
   (`birds.js` reads `e.perches`/`e.crown` off the entry, R1-confirmed), yet
   `dumpRegistry` **doesn't emit them**. So a species reorder silently moves where
   birds perch with no gate signal.

**Structural ruling (T1):** The registry is the right boundary for the
*placement* contract — "does an entry exist at (x,z) with this footprint /
collider / chunkKey" — and `bin/layout-snapshot` is the correct, existing gate
for **that**. It is the WRONG boundary for the **visual descriptor stream**
(species, scale, color, crown radius, perch ring), which is precisely what a
`buildForestTree` descriptor refactor perturbs. Those fields are intentionally
*not* registry fields — they're render-layer + bird-anchor data — so asking the
registry gate to guard them is a category error.

Therefore the descriptor stream needs **its own golden hash**, exactly as the
Adversary proposes (`bin/test-forest-determinism`). The invariant it must assert
is stricter than the registry's: **`buildForestTree(mulberry32(FIXED))` called N
times must produce a byte-identical sequence of `{type, trunkH, trunkR, greenIdx,
mainR/baseR, bumpCount/crownCount, every per-bump/crown draw, rotation}`** —
captured from `main` BEFORE the refactor, re-run after, hash unchanged. Run BOTH
gates: `layout-snapshot` for placement (positions/colliders/chunkKey), the new
golden hash for the descriptor stream. Neither subsumes the other.

**One structural feasibility finding the Adversary's proposal glosses, and the
slice plan must absorb it:** the golden-hash gate is *buildable in Codespaces*
(no WebGL) via the existing `register('./node-three-shim.mjs')` loader pattern
(`test-registry-grid:28-29`) — **but not as-drawn.** The shim
(`bin/node-three-shim.mjs`) currently stubs **only `Vector3`** (its own header
says so, line 4-5). `tree.js` touches six THREE classes at load + build time —
verified: `CylinderGeometry` + `MeshStandardMaterial` at module scope
(`tree.js:32,34`), plus `Group`, `Mesh`, `IcosahedronGeometry`, `ConeGeometry`
in the builders (`tree.js:97,98,106,123`). So **a precondition task for the gate
is: extend `node-three-shim.mjs` to stub those six** (trivial no-op
constructors — the gate hashes the rng-derived *numbers*, not geometry math).
Without that task, `import('../src/models/tree.js')` throws under node and the
gate can't run. This is a real, scoped, ~30-line precondition — name it
explicitly in the slice plan rather than discovering it at implementation time.

---

### Priority Sequence (R2, structural)

1. **Keep `buildForestTree`/`buildTallPine/Oak/Birch`/`buildTree` returning a
   real `THREE.Group`.** Add the descriptor as `group.userData.descriptor` (or a
   sibling `describe*`) — single rng-order source of truth, sandbox + lake +
   chunk-tree callers unbroken (Adversary Vuln 3, Auditor §4). Non-negotiable
   seam; everything else composes off it.
2. **Build the descriptor golden-hash gate FIRST, against `main`.** Precondition:
   extend `node-three-shim.mjs` (+6 stubs). This is the only gate that proves the
   visual-descriptor invariant the registry is blind to. No slice ships before
   the baseline hash is banked.
3. **Slice-1 = both isolated-stream forest paths, together:** `chunks.js:1061`
   (v2, production-default, lead) + `forests.js:911` (v1 forest, same emitter for
   free). Per-chunk InstancedMeshes into `ctx.group`; ~5 buckets sized to the
   cast/no-cast boundary; `instanceColor` for green; unit geos `userData.shared`,
   the InstancedMeshes NOT shared (Auditor §1-2). Gate: golden hash unchanged +
   `layout-snapshot` clean + game-boot smoke.
4. **DEFER `chunks.js:1696` `scatterTrees`** to a later, independently-gated slice
   — it draws the **shared `ctx.rng`** feeding porta-potties/crowd/jugs
   (`chunks.js:447-459`), so its reorder blast radius is the whole v1 chunk, and
   it's the non-default legacy branch with a minor draw count.
5. **EXCLUDE `lakes.js:537/713` from instancing entirely** — `chunkKey`-omission
   collider-survival invariant (`lakes.js:720-727`) + per-tree scale-coupled
   collider (`lakes.js:726`). They stay per-tree Groups on the lake's lifecycle.

### Structural Risks Identified

- **Risk — the registry gate is visual-blind by design; using it alone "proves"
  determinism it cannot see.** `dumpRegistry`/`layout-snapshot` capture only
  `kind/x/z/footprint/colliderR/damage/attractorR/attractorW/chunkKey`
  (`main.js:1505-1515`, `layout-snapshot:73-83`). A same-count rng *reorder*
  changes species/scale/`crown.r`/perches at a fixed (x,z) with a byte-identical
  snapshot — silently regenerating every forest's look and moving every bird
  perch (`CLAUDE.md` #4). Mitigation: a descriptor golden-hash gate is a hard
  precondition, not a supplement.

- **Risk — the golden-hash gate isn't buildable until `node-three-shim.mjs` is
  extended.** It stubs only `Vector3` (`node-three-shim.mjs:4-5,14`); `tree.js`
  needs six THREE classes stubbed (`tree.js:32,34,97,98,106,123`). An un-scoped
  "add a determinism test" task will stall on `import` throwing under node.

- **Risk — conflating "v1 vs v2" with the slice boundary.** The real boundary is
  **isolated-stream (instanceable) vs shared-`ctx.rng` (deferred) vs lake-owned
  (excluded)**, not legacy-vs-production. Both forest paths (one v1, one v2) are
  slice-1; the v1 *chunk-tree* path is deferred for a stream reason, not a version
  reason. Mis-drawing this leads to either touching the dangerous shared stream or
  skipping the production-default v2 path.

- **Risk — the descriptor refactor reaching `lakes.js`/sandbox if the Group
  return type changes.** `lakes.js:25,537,713` and the six sandbox cases call the
  builders and expect a Group (`.position`/`.scale`/`.userData`). Changing the
  return type breaks the EXCLUDED lake path and the primary verification surface
  at once. Mitigation: descriptor is additive on `userData`; Group return stays.

- **Risk — `~3 buckets` undersizes the per-chunk group.** The cast/no-cast shadow
  boundary forces ~5 InstancedMeshes/chunk to preserve the 56-caster audit
  (`tree.js:185,217,271`; `CLAUDE.md` #9). Sizing for 3 either over-casts (walks
  the audit back) or under-casts (forest loses ground shadow).

### Verdict

- **Verdict**: **Proceed with mitigations — scoped exactly as the slice table above.**
- **Key Concern (T3)**: The slice boundary is the **rng-stream class**, not the
  worldgen version. Instance the two **isolated-stream** forest paths
  (`chunks.js:1061` lead + `forests.js:911`) into per-chunk `ctx.group`
  InstancedMeshes; **defer** the **shared-`ctx.rng`** chunk-tree path
  (`chunks.js:1696`, blast radius = porta-potties + crowd + jugs,
  `chunks.js:447-459`); **exclude** the **`chunkKey`-omitting, scale-coupled**
  lake paths (`lakes.js:537/713`, `lakes.js:720-727`) entirely.
- **Key Concern (T1)**: The registry is the right boundary for *placement* and
  `layout-snapshot` is the right gate for it — but it is **structurally blind to
  the visual descriptor stream** (`dumpRegistry` omits scale/species/crown/perches,
  `main.js:1505-1515`), which is exactly what this refactor perturbs. The
  descriptor stream needs **its own golden hash** (Adversary, conceded), and that
  gate has an un-named precondition: extend `node-three-shim.mjs` (+6 stubs) so
  `tree.js` imports under node. Run **both** gates; neither subsumes the other.
