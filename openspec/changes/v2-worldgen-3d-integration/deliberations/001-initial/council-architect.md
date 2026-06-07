## The Architect's Position

I read the change artifacts (proposal, design D-A..D-J, both spec deltas, tasks)
and the load-bearing source: `src/worldgen/index.js` (the contract), `roads.js`,
`water.js`, `roles.js`, `hearts.js`; the consumers `src/chunks.js`, `src/lakes.js`,
`src/world.js`, `src/forests.js`; and both importmap `mods`/`models` arrays.

My lens: structural soundness, ARCHITECTURE.md adherence, module boundaries,
registry/lifecycle ownership, and render-pipeline shape. I am NOT scoring perf
math or gameplay feel except where they expose a structural fault.

### Priority Sequence

1. **Scaffolding first (Task 3), and split it.** Land `USE_WORLDGEN_V2`, the
   importmap additions in BOTH html files, and the `placement.js` skeleton as a
   *no-op-on-old-path* change that boots clean with the flag both on and off.
   The importmap addition is the single cheapest, highest-leverage structural
   step — and right now **zero** `src/worldgen/*` modules are in either `mods`
   array (`index.html:87-89`, `sandbox.html:177-179`). Until they are, the dev
   cache-buster won't decorate them and every later iteration on worldgen edits
   silently won't reload locally (no-build rule, footgun #1). Do this before any
   content work so the rest of the apply loop is trustworthy.

2. **Roads (Task 4) before lakes/forests/props.** Roads are the structural
   keystone for two reasons. (a) The chunk-clipped ribbon is the *first* place
   the new "chunk = sampler" shape (D-A) meets the render pipeline, and the
   seam-determinism claim (D-D) has to be proven on the real game path, not just
   asserted. (b) `noBuild` is *derived from* road proximity (`index.js:72`:
   `noBuild = inLake || onRiver || road.onRoad`), so every later placement
   decision (props, trees, crowd) depends on roads being correctly sampled
   first. Get roads right and the "stages-on-roads" structural fix falls out of
   honoring `noBuild`; get them wrong and every downstream gate is built on sand.

3. **Lakes (Task 5) next — smallest blast radius, validates the read-pattern.**
   D-E is a pure placement-source swap: `LakeManager` keeps its mesh, sealed
   colliders, beaches, `WATER_MAT.userData.shared`, distance lifecycle, and the
   no-chunkKey contract (`lakes.js:259-265`). It's the lowest-risk way to prove
   "a manager reads worldgen and owns its own lifecycle" before forests/props
   lean on the same idea. See the structural caveat below about the two lake
   coordinate systems and the two `outlineRAt` implementations.

4. **Forests (Task 6).** Per-chunk `treeDensity` scatter, chunk-keyed, reusing
   `models/tree.js` pooled geo/mats. This is a clean substitution into the
   existing chunk teardown path; the structural watch-item is the `forests.js`
   import cycle (below) and the LEAF drum-circle re-homing.

5. **Themes/props (Task 7) — heart anchors + scatter.** This is where D-C
   (anchor ownership) lives and where the most subtle lifecycle question sits.

6. **Crowd (Task 8), then determinism + perf gate (Task 9).**

7. **Verify/review/docs (Tasks 10-11),** with the ARCHITECTURE.md world-streaming
   section rewrite as a hard gate — the current doc describes `pickTheme` +
   `THEME_BUILDERS` + the 5x5 forest system, all of which this change retires
   behind a flag; leaving the doc stale is a structural-drift footgun for the
   next agent.

I agree with the migration plan's phase ordering in design.md (roads → lakes →
forests → props → crowd). My one structural amendment is to treat the importmap
+ flag as a *distinct, mergeable, boots-clean* commit BEFORE the road work, not
folded into it.

### Structural Risks Identified

**1. D-A (per-chunk sampler, not a HeartManager) is structurally sound — and is
the right call.** A `HeartManager` modeled on `LakeManager` would be the
*wrong* boundary: a major district is ~1000m (12+ chunks per design.md D-A), and
`LakeManager` already demonstrates the cost of a parallel macrocell manager —
it has to maintain its own load/unload radii (`lakes.js:34-35`), its own
disposal walk (`lakes.js:662-686`), its own animatables sweep, AND a no-chunkKey
registry discipline so its colliders survive chunk unload. Adding a *second*
such manager for hearts would double that surface and create a third lifecycle
owner that has to stay consistent with the chunk grid it overlaps. The sampler
reuses the proven streaming engine (1-chunk/frame budget, `chunks.js:291-326`;
chunkKey teardown, `chunks.js:339-401`) and keeps the chunk as the single unit
of work. **Verdict on D-A: structurally correct, no objection.** The risk it
introduces is purely *per-chunk cost* (queryRegion + queryPoint sampling inside
the 8ms `SLOW_THRESHOLD_MS` budget, `chunks.js:261`) — that is a Profiler
question, not a boundary question. I only flag the structural shape: the sampler
must stay a *pure read* of worldgen and must not start caching mutable
heart-state on the chunk side, or it quietly becomes the manager D-A rejected.

**2. D-C (heart-anchor ownership) is the sharpest lifecycle risk in the change.**
The scheme — "the one chunk whose cell contains `floor(heart.x/CHUNK_SIZE)`
builds the anchor, chunk-keyed" (spec `worldgen-3d-world` "owned by exactly one
chunk"; design D-C) — is *structurally clean for the common case* and correctly
resolves "a heart spans many chunks." Two real concerns:

   - **Anchor disposal vs. heart persistence mismatch.** The worldgen contract
     stamps every feature `lifecycle: 'persistent'` (`index.js:74`) and the
     header explicitly says the 3D port "must register them so they survive
     host-chunk unload" — the *lakes* model (footgun #5). But D-C does the
     opposite for anchors: it makes them **chunk-keyed**, so the main stage at a
     heart center disposes and rebuilds every time its single owner chunk crosses
     `UNLOAD_RADIUS` (`chunks.js:333`). That is *defensible* (anchors are point
     features, not spanning colliders like a lake edge ring, and they
     regenerate deterministically), but it is a deliberate divergence from the
     contract's stated `persistent` intent and must be called out as such. The
     structural test: does the anchor own any collider that another chunk's
     content positions itself against? If a district chunk places a vendor
     "in front of the stage" by reading the anchor's registry entry, and the
     anchor chunk has unloaded, the vendor chunk gets a stale/missing reference.
     **Mitigation:** anchors must be self-contained — district scatter must
     derive its placement from `queryPoint`/`heart` math, never from a live
     lookup of the anchor's registry entry. Keep the anchor's registry entries
     chunk-keyed and let everything else re-derive from worldgen.

   - **The `core` role can span multiple chunks but only ONE builds the anchor —
     what do the *other* core chunks build?** `roleTier` returns `core` for any
     point with `dist < heart.core` (`roles.js:10`), and `heart.core` is the
     domain radius (`hearts.js:52`). For a major heart, `core` can cover several
     80m chunks. D-C says only the center chunk builds the anchor; the spec
     scenario says neighboring chunks "build only scattered district props." But
     a neighbor chunk that samples `roleTier === 'core'` (not `district`) needs a
     defined behavior in `placement.js` (D-B), or it falls through the role
     table. **The role→theme table in D-B is keyed on `core+major`,
     `core+minor`, `district+*`, `outskirts` — it does not distinguish "core
     center chunk" from "core non-center chunk."** That distinction lives in
     D-C's ownership test, not the table. `placement.js` must take the
     center-or-not decision as an input (or expose it), so a core-but-not-center
     chunk produces *scatter*, not a second anchor or an empty cell. This is the
     exact class of boundary bug that produces "two main stages 80m apart" or
     "a barren core ring." Flag it as a required, explicit branch.

**3. Module boundaries — `placement.js` must stay pure and three-free, like the
rest of `src/worldgen/`.** `index.js:1-2` is emphatic: "NO `three`, NO DOM:
returns plain data only." D-B places `placement.js` *inside* `src/worldgen/`.
That is the correct home ONLY if it returns plain placement descriptors
(`{ kind, localX, localZ, yaw, footprint, ... }`) and the *chunk* (in
`chunks.js`) does the `buildX()` → `THREE.Group` → position → `registry.add`.
If `placement.js` imports `three` or any `models/*` builder, it breaks the
render-agnostic boundary that makes worldgen testable in `map-sandbox.html` and
in Node (the self-test). **Structural requirement:** `placement.js` is a pure
data mapping (heart, roleTier, rank, point, rng) → descriptor list; it must NOT
import `three` or `models/*`. The model-returns-Group / caller-positions pattern
(CLAUDE.md Conventions) stays on the `chunks.js` side. This also keeps the
self-test runnable.

**4. The `forests.js` ↔ `chunks.js` import cycle and the retirement seam.**
`forests.js:23` imports `CHUNK_SIZE` and `buildCurvedPath` FROM `chunks.js`,
while `chunks.js:24` imports a half-dozen symbols FROM `forests.js`
(`getForestAt`, `buildForestChunk`, `forestAnimatables`, etc.). This is an
existing circular dependency that works because ES module live-bindings tolerate
it. D-F replaces the 5x5 system with per-chunk scatter but the design keeps the
old code behind the flag (Non-Goals: "Removing the old `forests.js` code in THIS
change"). **Structural risk:** the flag branch in `chunks.js._generate`
(`chunks.js:408-409` `getForestAt` → `'forest'` theme) must be gated so that
with v2 ON, `getForestAt` is not consulted (or the 5x5 forests will co-exist
with the density scatter and double-place trees / fight over chunkKeys). The
import cycle itself is fine to leave; the *behavioral* fork must be a single
clean `if (USE_WORLDGEN_V2)` at the top of `_generate`, not scattered
conditionals across `placePaths`/`scatterTrees`/`spawnAmbientCrowd`. One branch
point keeps "what's in a v2 chunk?" answerable in one place — the same
reasoning that made `buildForestChunk` own everything for forest chunks
(`chunks.js:428-433`).

**5. D-E — two coordinate frames and two `outlineRAt` implementations is a
correctness seam, not just a style smell.** Worldgen lakes (`water.js`) store
the outline as **absolute world vertices** (`{x: vx, z: vz}` quantized,
`water.js:73-74`) with point-in-polygon containment (`water.js:81-88`). The
existing `LakeManager` stores the outline as **vertices relative to lake center**
(`lakes.js:183`) and does containment via `outlineRAt` angular interpolation
(`lakes.js:192-206`, `isPointInLake` at `lakes.js:718-731`). D-E says "build its
existing ShapeGeometry water + sealed-perimeter colliders along the worldgen
outline." The structural hazard: `placeSealedColliders` (`lakes.js:224-266`),
`buildLakeOutline`, `outlineRAt`, beach/camp/canoe placement, and the
`chunkInLake`/`isPointInLake` consumers (`chunks.js:443`, `chunks.js:482`) ALL
assume the center-relative frame and the angular `outlineRAt` model. Feeding a
worldgen *absolute-vertex* outline in requires either (a) converting worldgen
outlines to center-relative at the LakeManager boundary, or (b) rewriting the
sealed-collider walk + canoe clamp to the absolute/point-in-poly model. Either
is fine, but it must be a **deliberate single conversion at the read boundary**,
not an implicit assumption that the two outline formats are interchangeable.
There are also **two lake cell sizes** (worldgen `LAKE_CELL` ~1050m per the
briefing vs `lakes.js:32` `LAKE_CELL = 320`) and two density models — D-E
correctly drops the `lakes.js` 320m rng, but the LakeManager's load/unload radii
(720/1500) were tuned to 320m-cell spacing; worldgen's sparser 1050m cell may
leave the load ring empty between lakes. That's a feel/tuning item (design Risks
already flags it), but the *collider survival* test (Task 5.2, footgun #5) is
the structural gate I care about: worldgen lakes carry no chunkKey, LakeManager
registers them with no chunkKey, and they must survive a host-chunk unload.
Verify that explicitly.

**6. D-D — the seam-free claim is well-founded, but the registration shape needs
care.** The arterial is one pair-owned deterministic curve (`roads.js:123-140`,
`arterial()` memoized symmetric on the A,B pair, `roads.js:182-193`), so
clipping it per-chunk genuinely yields no kink — the structural claim holds, I
verified the curve is computed end-to-end from heart proxies, not per-chunk
halves. Two structural notes: (a) the road *mesh* is chunk-keyed (D-D) and
disposes with its chunk — fine, it regenerates identically. But (b) the road's
**crowd path-attractor** registration must be reconciled with the existing
`path_node` attractor system. Today `placePaths` registers a `path_node`
attractor at the chunk center (`chunks.js:658-664`) and crowd AI pulls NPCs to
the 80m path grid. D-D/Task 8.2 retire that grid and point crowd attraction at
worldgen roads. The structural requirement: the new road attractors must be
chunk-keyed (so they sweep on unload via `registry.removeChunk`,
`chunks.js:364`) and the old `path_node` registration must NOT also run with v2
ON (or NPCs get pulled to both the dead grid and the roads). Same single-branch
discipline as risk #4.

**7. Contract append-only discipline (footgun #4) — the junction-merge (D-I) is
the one place worldgen *logic* changes.** Everything else reads the existing
contract. D-I adds a 2nd pass over `roads.js`. The structural guard is already
correctly stated (pure, window-bounded, non-recursive, reads pass-1 polylines,
doesn't feed back; self-test T4/T5 stay green — spec `worldgen-road-junctions`).
My only addition: the merged network must be exposed through the *same*
`roadsInBounds`/`nearestRoad` API surface (or a clearly-named sibling), because
BOTH the 2D sandbox AND the 3D chunk renderer (D-I: "the 3D road renderer then
consumes the merged network") read through it. If the junction-merge is bolted
on as a separate function the 3D renderer must remember to call, the two
consumers will drift (sandbox shows merged, game shows raw, or vice versa).
Keep one canonical "give me the drawable road network" entry point. Note: the
`nearestRoad` result drives `noBuild` (`index.js:72`) — if junction-merge
changes which polylines exist, it changes `noBuild`, which changes placement,
which is a world-regenerating effect. That's acceptable (this whole change
regenerates the world) but it means the junction-merge must land and be golden'd
BEFORE props placement is tuned, exactly as the phase order has it (Task 1
before Task 7). Good.

**8. Importmap completeness (footgun #1) — concrete, verified gap.** Neither
`index.html:87-89` nor `sandbox.html:177-179` contains ANY `src/worldgen/*`
entry. The eight modules (`constants, hearts, water, roads, density, roles,
index, selftest` — `src/worldgen/`) plus the new `placement.js` must ALL be
added to the `mods` array in BOTH files, with the `worldgen/` path prefix
handled by however the cache-buster resolves nested paths (the current arrays
are flat `src/`-level names — confirm the buster supports `worldgen/index` style
entries, or the map-sandbox is already loading them via a different mechanism;
`map-sandbox.html` works today so the resolution path exists — mirror it). This
is Task 3.2 and it's non-negotiable. Forgetting `sandbox.html` (the common
variant of this footgun, per CLAUDE.md #1) would mean the per-entity sandbox
can't exercise any worldgen-driven entity.

**9. Boot-order / iOS-audio (footgun #3) is untouched by this change — good, and
keep it that way.** `world.js:41-66` runs `lakeManager.update()` BEFORE
`chunkManager.update()` so chunks see lake footprints (`world.js:58-60`), and
this happens inside `buildWorld`, which is called synchronously after
`Sound.init()` in the start gesture. D-E (LakeManager reads worldgen) must not
introduce any async (worldgen is sync, pure, seed-routed — `index.js:45`), and
the lakes-before-chunks ordering must be preserved because chunk placement now
ALSO depends on lake footprints via `noBuild`/`inLake` (`index.js:72`,
`water.js:lakeAt`). No structural objection — just: do not reorder
`buildWorld`, and do not let `placement.js` or the sampler reach for anything
async.

**10. Render-pipeline shape — the road ribbon and the heart anchor must follow
the model-returns-Group / central-ticker pattern.** Road ribbons reuse
`buildCurvedPath` (`chunks.js:671`) which returns a `THREE.Mesh` with a fresh
per-chunk material — note that material is currently allocated per `placePaths`
call (`chunks.js:617-628`), NOT shared. D-D says "reuse the dirt material,
shared" — so the v2 road renderer must hoist a shared road `MeshStandardMaterial`
tagged `userData.shared = true` (perf-pooling rule) rather than inheriting the
per-call allocation, or chunk unload disposal (`chunks.js:344-360`) is fine but
allocation cost spikes per chunk. Any animated anchor part (stage lights, beams)
must register into the existing `stageLightLenses`/`stageBeamRefs` arrays with a
`chunkKey` (`chunks.js:102-108`, swept at `chunks.js:375-380`) — the central
ticker (`updateStageLightShow`) already walks those. Don't introduce a bespoke
per-frame loop for worldgen content; attach to the existing animatable arrays.

### Verdict

-   **Verdict**: **Proceed with mitigations.**
-   **Key Concern**: D-C heart-anchor ownership — specifically that
    `placement.js` (D-B) must take the "is this the heart-center chunk?" decision
    as an explicit input so a *core-but-not-center* chunk produces scatter, never
    a second anchor or a barren core, AND that district scatter never reads a
    live registry lookup of the anchor (which may be unloaded) but always
    re-derives from worldgen. This is the boundary where "a heart spans many
    chunks" most easily produces a duplicate-anchor or stale-reference boot bug
    in the longest call chain.
-   **Recommendation**: The architecture is sound. D-A (sampler over a
    HeartManager) is the correct boundary and I endorse it without reservation —
    a second macrocell manager would duplicate the entire `LakeManager`
    lifecycle surface for no benefit. The contract is clean and append-only, the
    seam-free road claim is verified against `roads.js`, and lifecycle ownership
    is well-reasoned. Proceed, conditioned on the mitigations above, in priority
    order: (a) importmap + flag in both html files as a boots-clean first commit;
    (b) `placement.js` stays pure/three-free inside `src/worldgen/`, returning
    descriptors only; (c) a SINGLE `if (USE_WORLDGEN_V2)` branch at the top of
    `_generate` so old paths (placePaths, getForestAt, THEME_BUILDERS,
    path_node) don't co-run with v2; (d) one deliberate coordinate-frame
    conversion at the LakeManager↔worldgen-outline boundary (D-E); (e) explicit
    center-vs-non-center handling for `core` chunks (D-C); (f) ARCHITECTURE.md
    world-streaming section rewritten as a landing gate.
