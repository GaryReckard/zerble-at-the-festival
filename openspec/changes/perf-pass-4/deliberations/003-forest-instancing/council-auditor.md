# Council — The Auditor (mechanical sweeps)

**Change:** perf-pass-4 / 003-forest-instancing
**Role:** Code Quality & Mechanical Verification
**Date:** 2026-06-20
**Verdict:** **SHIP WITH MITIGATIONS** — the lifecycle plumbing the plan needs already
exists and is correct; the failure modes are all in *what new module-level resources get
tagged* and *how the all-or-nothing instanced castShadow maps onto today's selective
casting*. None are blockers if the checklist below is honored.

---

## Quality Deficiencies Found

- **Shared-tag omission risk on the new unit geos** — `src/models/tree.js:32-54`: the
  plan adds module-level `IcosahedronGeometry(1,1)`, `ConeGeometry(1,1,8)`, and a unit
  trunk cylinder. If any of these ships untagged, the FIRST forest-chunk unload disposes
  it (`disposeChunkByKey` walks geo and disposes when `!userData.shared`,
  chunks.js:556) and every other resident forest chunk recompiles. — **Severity: High**

- **castShadow is per-mesh, but today's casting is per-tier-mesh** — tree.js:185
  (`cone.castShadow = (i === 0)`), tree.js:217 (oak main crown casts, bumps at :222-232
  do not), tree.js:271 (only lowest birch puff casts). An `InstancedMesh` casts as ONE
  unit — you cannot cast "instance 0's lowest cone but not its upper tiers" within a
  single instanced mesh. The plan's "~3 InstancedMeshes per chunk" (crowns / cones /
  trunks) does NOT preserve this discipline unless the bucket boundary IS the
  cast/no-cast boundary. — **Severity: High** (perf-budget tripwire #9; shadow caster
  count is audited).

- **Plan undercounts the bucket dimensions** — descriptors carry `colorHex` (7 FOREST_
  GREENS at tree.js:26) AND a cast/no-cast flag AND geo type. "~3 InstancedMeshes per
  chunk" is optimistic. Realistic minimum is geo-type × shadow-flag; color is solvable
  with `instanceColor` (one extra vertex attribute, no extra draw). Pin the exact bucket
  count before implementing or the draw-reduction estimate is unverifiable. — **Severity:
  Medium**

- **Sandbox cases bypass the new instanced path entirely** — sandbox.html:1806-1840
  call `buildTallPine/buildOak/buildBirch/buildForestTree` and `scene.add(g)` a Group.
  If those exports become descriptor emitters, the four sandbox cases break at module
  load. — **Severity: Medium** (this is exactly the sandbox-pass/game-fail class the
  rules warn about, inverted: here the sandbox would fail at refactor time).

---

## Mechanical Assertions

| Check | Status | Notes |
| ----- | ----- | ----- |
| Importmap in ALL html files | **PASS (no change needed)** | `bin/check-importmaps` → OK, 28 models across 4 pages; `tree` already in `models` of index/sandbox/hub-sandbox; map-sandbox uses `wg` only (correct — tree isn't worldgen). **PASS only if the refactor adds NO new module file.** If a `treeInstancing.js` helper is split out, it must be added to `mods` in index.html, sandbox.html, hub-sandbox.html (3 files) and re-run `bin/check-importmaps`. |
| Sandbox entry complete | **CONDITIONAL** | 4 cases (sandbox.html:1806-1840) + `bird_in_tree` (:1902, calls `buildOak`) consume Groups. Refactor must keep a build-a-real-Group adapter or rewrite these to render descriptors. `ENTITY_HIT_KIND` for `forest_tree*` already wired (sandbox.html:839-840) — collider is data, unchanged, so PASS there. No `ENTITY_MUSIC_STYLE` (trees are silent) — N/A. |
| userData.shared tagging | **CONDITIONAL** | Existing pools correct (tree.js:33,37,44,48,52). New unit geos MUST be tagged — list below. The per-chunk InstancedMesh must NOT be tagged (it's per-chunk, must be disposed). |
| castShadow discipline | **AT RISK** | All-or-nothing per instanced mesh collides with today's selective casting (tree.js:185,217,271). Forces a separate shadow-casting instanced bucket. |
| InstancedMesh needsUpdate | **MUST-ADD** | Every per-chunk fill needs `mesh.instanceMatrix.needsUpdate = true` after `setMatrixAt`, and `instanceColor.needsUpdate = true` if using per-instance color (footgun #7; precedent sugarShack.js:1027). |
| Determinism (fresh salt) | **PASS-AS-DRAWN** | Plan #1 mandates same rng call-order; scatter rng is forest-stable (forests.js:836), unchanged. Gate it (below). Registry data unchanged → `bin/test-registry-grid` still valid. |
| CHANGELOG/ROADMAP in commit | **MUST-DO** | Player-visible perf change → CHANGELOG `### Performance` entry same commit. ROADMAP "Performance" section parks "variant-bucketed InstancedMesh for tiki torches + chairs" and LOD-on-trees — trim/cross-ref the tree item if this lands it. |

---

## (1) Which new module-level resources MUST be tagged `userData.shared = true`

Exactly the new unit geos hoisted to module scope in `tree.js`. Concretely:

- `_crownGeoUnit = new THREE.IcosahedronGeometry(1, 1)` → **tag** (replaces per-tree
  icosa at tree.js:106, 215, 226, 264).
- `_coneGeoUnit = new THREE.ConeGeometry(1, 1, 8)` → **tag** (replaces per-tree cones at
  tree.js:123, 183).
- `_trunkGeoUnit` (unit cylinder, scaled per-instance) → **tag**, IF you introduce a new
  one. Note the existing `_trunkGeo` (tree.js:32) is already a fixed-size shared cylinder
  for chunk trees; forest trunks vary in dims (tree.js:163,203,247) so they currently
  alloc per-tree geo — a unit cylinder + per-instance scale matrix is the win, and it
  must be tagged.
- Any new shared material introduced for `instanceColor` use (a single base
  `MeshStandardMaterial` the instanced crowns share) → **tag**.

Already-shared and must STAY shared (don't regress): `_trunkMat` (37), `_forestTrunkMat`
(44), `_birchTrunkMat` (48), `_foliageMats[]` (52). With `instanceColor` driving green
variation, `_foliageMats` may collapse to one shared base mat — fine, keep it tagged.

**The bug this prevents (verified):** `disposeChunkByKey` (chunks.js:553-565) disposes
`obj.geometry` when `!obj.geometry?.userData?.shared` (line 556). An untagged unit geo
gets freed on the first of nine forest chunks to cross `UNLOAD_RADIUS`; the other eight
resident forest chunks still reference it → shader/buffer recompile storm. This is
footgun #6, and forests.js:339-352 already documents one historical instance of exactly
this (the path mat was untagged).

## (2) Is per-chunk InstancedMesh consistent with the shared/non-shared convention?

**Yes, and the plumbing already exists — no new disposal code needed.** The per-chunk
InstancedMesh is *not* shared: it's built fresh per chunk from that chunk's descriptors,
added to `ctx.group`, and must be freed on unload. The convention is satisfied because:

- chunks.js:563 — `if (obj.isInstancedMesh) obj.dispose();` — the walk already frees the
  `instanceMatrix` / `instanceColor` buffers of any non-shared InstancedMesh in the
  chunk group. The header comment (chunks.js:551-552) explicitly states this contract.
- Do **NOT** tag the per-chunk InstancedMesh `userData.shared` — that would skip its
  `.dispose()` and leak instance buffers across every chunk churn (the long-session leak
  the briefing's risk #2 asks about). The geometry it *references* is shared (skipped);
  the mesh + its instance buffers are per-chunk (disposed). That split is exactly the
  convention.

So the answer to the briefing's risk #2 is: **geo/mat shared+skipped, the InstancedMesh
itself per-chunk+disposed via the existing isInstancedMesh branch.** No leak, no new
code, *provided* the unit geos are tagged and the mesh is not. Add a line to the
`disposeChunkByKey` header noting forest trees now ride this path, and lean on task 6.3's
10-rebuild leak check (hub-sandbox) as the gate.

## (3) castShadow: all-or-nothing instanced mesh vs. today's selective casting

Today casts selectively *within a single tree*: lowest pine tier only (tree.js:185), oak
main crown but not bumps (tree.js:217 vs :222-232), lowest birch puff only (tree.js:271).
An `InstancedMesh.castShadow` is a single boolean for ALL instances. You cannot express
"cast the lowest cone, skip the upper tiers" inside one cone instanced mesh.

**This forces the bucket split to be the cast/no-cast boundary, not just geo-type.**
Minimum honest bucket set per chunk:

- `cones_caster` (lowest pine tier per tree) — `castShadow = true`
- `cones_noshadow` (upper pine tiers) — `castShadow = false`
- `crowns_caster` (oak main crown + lowest birch puff) — `castShadow = true`
- `crowns_noshadow` (oak bumps + upper birch puffs) — `castShadow = false`
- `trunks` — `castShadow = true` (every trunk casts today: tree.js:167,207,251)

That's ~5 instanced meshes/chunk, not 3. Still a massive draw cut (~5 vs ~400/chunk per
forests.js:818-822) and it *preserves the audited caster discipline* — critically, it
does NOT walk the 56→ caster budget back up (tripwire #9), because the no-shadow buckets
stay `castShadow=false`. Precedent that this is the house style: sugarShack string bulbs
instance with `castShadow=false` (sugarShack.js:1021), leafDrumCircle benches instance
the half-logs (leafDrumCircle.js:222). **Reject any "just make the whole instanced crown
cast" shortcut** — that over-casts (oak bumps, upper tiers, every birch puff) and inflates
the shadow pass the audit deliberately trimmed.

## (4) Sandbox: do the exported builders survive?

Not as-is if they become descriptor emitters. Four sandbox cases (sandbox.html:1806,
1815, 1824, 1833) plus `bird_in_tree` (:1904) call `buildTallPine/Oak/Birch/ForestTree`
and `scene.add()` a Group; `worldPerches/worldCrown` (tree.js:84-94) read
`tree.userData.perches/.crown` off that Group, and `bird_in_tree` depends on it.

**Cleanest mitigation:** keep `buildTallPine/buildOak/buildBirch/buildForestTree`
returning a real `THREE.Group` (the sandbox + bird-perch contract), and add a SEPARATE
descriptor path (`forestTreeDescriptor(type, rng)`) that the scatter loop consumes.
`worldPerches/worldCrown` then read perch/crown off the descriptor in the game path and
off the Group in the sandbox path — but since perches/crown are pure data
(tree.js:117-118,132-133,191-192,…), compute them once in a shared helper both paths
call. **Do NOT delete the Group builders** — the sandbox is the primary verification
surface (sandbox-and-testing.md) and `bird_in_tree` is load-bearing. If you go
descriptor-only, you must write descriptor-to-mesh sandbox adapters for all five cases,
which is strictly more work than keeping the Group builders.

## (5) Importmap impact

- **If no new file:** none. `bin/check-importmaps` is green now (28 models, 4 pages);
  `tree` is already listed everywhere it needs to be. The refactor lives inside the
  existing `src/models/tree.js`.
- **If a `treeInstancing.js` / `forestInstancing.js` helper is split out:** it's a `src/`
  module → add to the `mods` array in index.html, sandbox.html, hub-sandbox.html
  (NOT map-sandbox `wg` — it's not worldgen) and re-run `bin/check-importmaps` (it fails
  loudly naming the missing file). Forgetting one of the three is the #1 footgun
  (no-build.md). **Recommendation: keep it in tree.js, avoid the new-file tax.**

---

## Ship Checklist (must all be true before merge)

1. [ ] New unit geos (`IcosahedronGeometry(1,1)`, `ConeGeometry(1,1,8)`, unit trunk
   cylinder) hoisted to module scope and tagged `userData.shared = true`. Any shared
   base instanced material tagged too.
2. [ ] Per-chunk InstancedMesh(es) NOT tagged shared; rely on chunks.js:563
   `isInstancedMesh → dispose()` for buffer teardown. No new disposal code.
3. [ ] Bucket split honors the cast/no-cast boundary (≈5 instanced meshes/chunk):
   shadow-casters keep `castShadow=true`, all other buckets `castShadow=false`. No
   net increase in shadow casters vs. today's selective list.
4. [ ] `mesh.instanceMatrix.needsUpdate = true` (and `instanceColor.needsUpdate` if used)
   after every per-chunk fill.
5. [ ] `buildTallPine/buildOak/buildBirch/buildForestTree` still return a real Group OR
   all 5 sandbox cases (4 forest_tree* + `bird_in_tree`) rewritten with descriptor-to-mesh
   adapters. Perch/crown data computed in a shared helper both paths call.
6. [ ] No new `src/` file (preferred). If one is added → in `mods` of index/sandbox/
   hub-sandbox + `bin/check-importmaps` green.
7. [ ] Determinism gate: rng call-order unchanged in the descriptor emitter; run
   `bin/test-registry-grid` (forest_tree positions are registry data — a position diff
   surfaces here) and confirm a clean diff against pre-change. Plan says rng order is
   preserved — *prove it with the grid test, don't assert it*.
8. [ ] CHANGELOG `### Performance` entry in the SAME commit; ROADMAP "Performance"
   tree-LOD / variant-bucket bullet trimmed or cross-referenced.
9. [ ] hub-sandbox 10-rebuild leak check (task 6.3 path) shows no geometry/texture
   growth across rebuilds — confirms the shared/non-shared split is correct under churn.

The plan is sound and the hardest plumbing (InstancedMesh disposal) is already shipped
and correct (chunks.js:563). The only ways this ships broken are: an untagged unit geo
(dispose storm), an over-casting instanced shadow bucket (walks back the audit), a
forgotten `needsUpdate`, or a sandbox-break from descriptor-only builders. All four are
mechanical and on the checklist.
