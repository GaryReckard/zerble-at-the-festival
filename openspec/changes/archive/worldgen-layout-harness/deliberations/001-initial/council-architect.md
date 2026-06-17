# Council — The Architect (worldgen-layout-harness, round 001-initial)

## Architect's Position

### Priority Sequence

1. **Close the `env` contract hole in D-C before any extraction commit** — builders
   consult the live registry mid-rng-loop, not just water; the "pure layout function"
   signature as specced cannot reproduce camp villages (Finding 1).
2. **Specify the hub viewer's cleanup contract as "everything the chunk unloader
   does, by synthetic chunkKey"** — registry is the easy third of the problem; the
   module-level side stores are the part the design doesn't name (Finding 3).
3. **Correct the importmap count to FOUR files and add map-sandbox.html to the rule**
   — the plan's own risk register undercounts its most-tripped footgun (Finding 2).
4. Land groups 1–3 as written (instrument → hoist → extraction, one builder per
   commit); the structure is sound once 1–3 above are folded in.
5. Keep `buildHubPreview` in chunks.js for this change; extract the dispatch module
   in `festival-zone-grammar`, not here (Finding 4).

### Structural Risks Identified

- **Registry-conditioned rng draws break the layouts.js purity contract**: the
  camp-village extraction either needs a second injected predicate or must be
  descoped; as specced it cannot be both pure and draw-order-identical.
- **The hub viewer's "throwaway registry scope" has no mechanism in registry.js**:
  the singleton + chunkKey contract *can* support it, but only if the design names
  the full cleanup walk (registry + forests side-stores + contextLights), otherwise
  rebuild-in-place leaks across re-rolls.
- **Importmap drift**: the maintenance rule is documented as three files but the
  change actually creates a four-file surface; map-sandbox.html's own `wg` list is
  a required consumer of the new modules and is absent from proposal/tasks.
- **Silent staleness of derived constants in tuning.js**: "imports nothing" forces
  duplication of model-derived arrangement values with only a comment guarding them.
- **Dependency direction**: any future import from `src/worldgen/layouts.js` or
  `lint.js` back into `chunks.js` (or any `src/models/*`) kills node-importability
  and the whole render-agnostic contract; the rule must be stated, not assumed.

## Verdict

**Proceed with mitigations** (Findings 1–3 are blocking-if-unaddressed; 4–8 are
recommendations). Detail below.

## Findings

### 1. [HIGH] `layouts.js` purity contract has a hole: builders draw rng conditioned on the LIVE registry, and D-C only injects water

**Evidence:**
- `chunks.js:1405` — inside `buildCampVillageAt`'s placement loop:
  `if (registry.closestBuilding(new THREE.Vector3(px, 0, pz), 4, CLUSTER_GUARD_SKIP)) continue;`
  The `continue` happens *after* two rng draws (px, pz at `chunks.js:1403`) and
  *before* the size draw (`chunks.js:1409`) — so the draw *sequence* is conditioned
  on live registry state.
- `chunks.js:1145–1148` — the cluster-level guard in `placeWorldgenProps` also
  queries `registry.closestBuilding` to drop whole clusters.
- design.md D-C scope explicitly includes "camps" in the extraction list, and the
  `layout-dry-run` spec's headless scenario names only "a descriptor, a seeded rng,
  and a `waterAt` predicate."

**Impact:** A `layoutCampVillage(desc, rng, env)` with only `env.waterAt` cannot
reproduce the original draw sequence — the registry query is part of the
conditionality D-C itself says must be preserved. Either the extraction silently
changes the built world (snapshot diff catches it, commit blocked, and you're stuck
with no designed way forward), or the implementer quietly imports `registry` into
`layouts.js` — which destroys node-importability (registry.js imports `three`,
registry.js:5) and the README contract (src/worldgen/README.md: "no `three`, no
DOM").

**Recommendation:** Widen the injected environment to `env = { waterAt, blockedAt }`.
The game passes a registry-backed `blockedAt` closure (bit-identical behavior, same
pattern D-C already uses for water); headless consumers pass a permissive stub. The
`layout-dry-run` spec's "Layout runs headless" scenario and D-C's text must name both
predicates. Additionally: because `blockedAt` depends on chunk-generation order, the
headless camp-village layout is *approximate* by construction — the linter should
treat camp-village records the way D-C already treats shoreline divergence
(informational), and the registry-audit mode (D-D) is the authoritative checker for
camps. One more consequence: the D-A snapshot procedure must pin the boot procedure
(boot, no driving, fixed teleports if any) since registry state is path-dependent —
worth one sentence in tasks.md group-2/3 preamble.

### 2. [MEDIUM-HIGH] The importmap rule spans FOUR html files, not three — and map-sandbox.html is the missed one

**Evidence:**
- `map-sandbox.html:26–28` already carries its own importmap list (`const wg = ['rng',
  'worldgen/constants', … 'worldgen/placement']`).
- Tasks 5.1 and 5.4 have map-sandbox import `layouts.js` records and `lint.js`
  violation counts — so `worldgen/tuning`, `worldgen/layouts`, `worldgen/lint` MUST
  be added to that list or edits won't hot-reload (the exact footgun no-build.md
  documents).
- proposal.md "Importmap in BOTH html files (#1)", design.md risk "Importmap drift
  across THREE html files", briefing risk #2 "THREE html files" — all undercount.

**Impact:** The change's own risk register misstates the blast radius of the repo's
most-tripped footgun while tripling… quadrupling it. An agent following the tasks as
written will update index + sandbox + hub-sandbox and silently skip map-sandbox.

**Recommendation:** (a) Correct proposal/design/tasks/no-build.md to FOUR files and
add explicit "+ map-sandbox.html" to tasks 2.2, 3.1, 4.1. (b) Structural mitigation
within no-build constraints: the minimum is a **consistency checker, not a
generator** — a small node script (sibling of the snapshot normalizer, task 1.2; or
a rule inside `lint.js`'s CLI) that regex-extracts the module arrays from all four
html files and diffs them against `src/` + `src/worldgen/` contents, failing loudly.
Zero runtime change, fits this change's "instrument first" theme. The stronger fix —
hoisting the four near-identical inline injectors (index.html:87ff,
sandbox.html:177ff, map-sandbox.html:19–35) into one shared *classic* (non-module)
`<script src>` bootstrap that holds the lists once — stays within no-build (it's the
same runtime injection, just deduplicated) but touches prod loading; flag it as a
Gary-call follow-up, don't fold it into a golden-frozen change.

### 3. [MEDIUM] "Throwaway registry scope" (D-E) names a mechanism registry.js doesn't have — but the existing chunkKey contract supports it, IF the design names the full cleanup walk

**Evidence:**
- `registry.js:160–161` — `export const registry = new Registry();` module-level
  singleton; no instancing/namespace mechanism exists.
- All worldgen-path builders tag entries `chunkKey: ctx.key` (`chunks.js:1187, 1217,
  1259, 1275, 1315…`), and `registry.removeChunk(key)` (`registry.js:59–63`) drops
  them — this is exactly the precedent `buildSpawnArch` uses with its synthetic
  `'spawn_arch'` key (`chunks.js:1199–1202`).
- But builders ALSO push to module-level side stores: `forestAnimatables` /
  `forestDrumCircles` / `forestDrumMusic` (`chunks.js:1383`, `forests.js:581, 627`),
  cleaned by the chunk unloader's by-key splice at `chunks.js:388–393`; and campsite
  paths register context lights (`contextLights.js:40`).

**Impact:** A second page load gets a fresh singleton, so first render is free. The
risk is **rebuild-in-place** (D-E: "switching re-rolls in place"): without the full
by-key cleanup, every slider drag (task 6.3 rebuilds on drag!) leaks registry
entries, animatable closures, and lights — and the leaked registry entries feed back
into the build via `closestBuilding` guards (`chunks.js:1147, 1405`), so hub N+1's
*layout* silently differs from a fresh load. That's a correctness bug in the
harness, not just a leak.

**Recommendation:** No registry instancing — that's scope creep solving a problem
the chunkKey contract already solves. Instead, D-E and task 6.1 should specify:
`buildHubPreview` builds under a synthetic key (e.g. `'hub_preview'`) and its
teardown performs the same walk `_disposeChunk` does — `registry.removeChunk(key)`,
the `forestAnimatables`/`forestDrumCircles`/`forestDrumMusic` by-key splices,
contextLights deregistration, and the `userData.shared`-respecting scene dispose.
Cleanest shape: extract chunks.js's existing by-key unload walk into a small shared
helper both `_disposeChunk` and `buildHubPreview` call, so the two can't drift.
Also verify at build time that no builder calls into `Sound` synchronously
(forests.js imports Sound, forests.js:31) — the hub page never runs `Sound.init()`.

### 4. [MEDIUM] `buildHubPreview` from chunks.js: right seam for THIS change; the dispatch extraction belongs to the grammar change. Dependency direction must be stated as a rule.

**Evidence:**
- Precedent: chunks.js already exports a non-game-loop world-building entry —
  `buildSpawnArch(scene, x, z, yaw)` at `chunks.js:1199`.
- Import graph from hub-sandbox.html: → chunks.js → {forests.js ⇄ chunks.js (a
  pre-existing, tolerated cycle — `forests.js:23` imports `CHUNK_SIZE,
  buildCurvedPath` back), lakes.js, Sound, contextLights, models/*, worldgen/*}.
  No NEW cycle: the page is a leaf, and worldgen/ modules import nothing from
  `src/` proper except `rng.js` (`festival.js:43–50`).
- `perf.js:44` already guards `typeof location === 'undefined'` for headless;
  page-context module-scope reads are safe.

**Impact / Assessment:** Yes, chunks.js is 2,608 lines and the dispatch
(`buildWorldgenKind`, `chunks.js:1159` + the `*At` builders) is a coherent
extractable unit. But this change is golden-frozen with a one-builder-per-commit
discipline precisely to keep diffs small and localizable; moving ~1,000 lines into a
new `src/festivalBuilders.js` mid-change multiplies the diff surface of every gated
commit and adds a fifth importmap entry for zero behavior. The mesh halves are about
to be rewritten again by `festival-zone-grammar` — that's the natural moment to
extract, when the file is being reshaped anyway.

**Recommendation:** Keep `buildHubPreview` in chunks.js now; add the dispatch-module
extraction to the grammar change's design as an explicit early task. **State the
dependency-direction rule in design.md D-C and in layouts.js's header comment:**
`chunks.js → worldgen/` only; `worldgen/layouts.js` and `worldgen/lint.js` must
never import from `src/chunks.js`, `src/registry.js`, `src/lakes.js`, or any
`src/models/*` (all transitively import `three`). One sentence prevents the most
likely future violation (someone "just importing" `POTTY_SPACING` from
`models/portaPotty.js` into layouts.js).

### 5. [LOW-MEDIUM] tuning.js's "imports nothing" forces duplicated derived constants — add a dev-only drift assertion

**Evidence:** layouts will need `14 * FOOD_TRUCK_SCALE` (`chunks.js:1290`),
`Math.hypot(SUGAR_SHACK_WIDTH, SUGAR_SHACK_DEPTH)/2` (`chunks.js:1302`),
`POTTY_SPACING` (`chunks.js:36`) — all currently exported from `src/models/*` which
import `three` (`models/foodTruck.js`, `models/sugarShack.js`,
`models/portaPotty.js`). D-B's answer is a derived value in tuning.js "with a
comment naming the source."

**Impact:** A comment is the weakest possible guard. The day someone resizes the
food truck, the planner/linter/overlay silently lint a world that no longer exists —
exactly the plan-vs-build divergence this whole change exists to kill, reintroduced
one layer down.

**Recommendation:** In chunks.js (the render side, which legally imports both), add
a dev-only boot assertion comparing each derived tuning value against the live model
export (`console.warn` on mismatch, localhost-gated like `__dbg`). Three lines per
constant; closes the staleness gap structurally instead of socially. Fold into task
2.2.

### 6. [LOW] Linter context assembly: per-hub via `festivalPlan` is the right joint — do NOT route it through `placeChunkProps`; but measure the plan-vs-built gap it can't see

**Evidence:** `placement.js:24–48` is a per-chunk *window filter* over
`festivalPlan(heart)` — it "only SELECTS — it never seeds" (`placement.js:12–15`).
The linter's unit is the hub, not the chunk; imposing 80m windows would add
complexity and nothing else. Direct `festivalPlan` + `heartsInBounds` (for the
cross-hub `stage-spacing` rule) is correct and duplicates no logic.
However the game additionally drops descriptors the linter will still see: the lake
skip (`chunks.js:1140`, reproducible headless via `lakeAt`) and the registry guard
(`chunks.js:1145–1148`, NOT reproducible headless — see Finding 1).

**Recommendation:** lint.js's hub context should apply the same *pure* drop rules
(`waterAt` skip) so headless counts approximate the game; the registry-guard gap is
then exactly what the registry-audit mode (D-D browser mode, task 4.6) measures.
Make task 8.1's baseline record BOTH headless counts and a registry-audit count at
one seed, so the size of the headless-vs-built gap is itself a tracked number the
grammar change can watch.

### 7. [LOW] Module placement of tuning/layouts/lint in `src/worldgen/` honors the README contract — but the README must be updated to document layouts.js as the bridge

**Evidence:** src/worldgen/README.md defines the package as "data — no `three`, no
DOM," and its theme-layer table ("How food trucks / vendor rows / porta-potties are
represented") explicitly anticipates builder knowledge arriving: "the actual prop
builders already exist in the live game (`chunks.js` theme builders); the
integration change rewires them." All three new modules are render-free by
construction (D-B "imports nothing"; D-C "no three.js, no registry"; D-D "pure
module, node CLI + browser import"). This is not a contract break — it's the
package's own roadmap landing. layouts.js *is* the documented 2D→3D bridge: it owns
sub-component geometry knowledge but expresses it as data.

**Recommendation:** tasks.md updates no-build.md and sandbox-and-testing.md (task
6.4) but never touches `src/worldgen/README.md` — the package's own front door will
describe a package missing its three newest members and still claiming "they are
not (yet) features the generator emits." Add a task: update the README's module
list, the theme-layer section, and document the `env` injection contract
(waterAt + blockedAt per Finding 1) and the dependency-direction rule (Finding 4).

### 8. [INFO] The 5-capability split carves at the joints

`festival-tuning` (shared constants), `layout-dry-run` (the data substrate),
`layout-linter` (assertions over the substrate), `layout-surfaces` (rendering of the
substrate), `layout-debug-tools` (in-game instruments) — each capability has one
owner-module set and one consumer direction; the linter/overlay/viewer all sit
downstream of dry-run, which matches the dependency graph. One wrinkle, acceptable
but worth knowing: the "Live tuning surface" requirement lives in `festival-tuning`
while its host page is specced in `layout-surfaces` — a cross-capability dependency
the task ordering (6.2 before 6.3) already encodes. No re-carve needed.

## Endorsements

- **D-A (instrument before surgery)** — exactly right, and `dumpRegistry`'s shape
  (`kind, x, z, footprint, colliderR, chunkKey`) matches the registry entry contract
  (`registry.js:26–33`) read-only. The "layout snapshot ≠ golden" vocabulary
  distinction is a small thing that will prevent real confusion.
- **D-C's cluster-local rng inheritance** — the existing `buildWorldgenKind` design
  (`chunks.js:1153–1160`, cluster-local `mulberry32(d.clusterSeed)`) means the
  dry-run split inherits per-cluster rng isolation for free; a layout function's
  draws can't desync neighbors. The hardest part of this refactor was already paid
  for by R19.
- **D-E building through the real `buildWorldgenKind`** — correct, and the "new POI
  kinds render by construction" property is the genuine analog of the sandbox
  checklist with zero per-kind registration. A bespoke hub-assembly path would have
  recreated the exact sandbox-pass/game-fail class this project already paid to
  learn.
- **D-F's `topDown` via existing camLock plumbing** (no new camera, no projection
  swap) and **D-H's gallery as a map-sandbox mode** (no new page, no node-canvas) —
  both are the smallest structure that works, reusing owned seams.
- **One-builder-per-commit + no-drift-acceptance migration rule** — the right
  discipline for a golden-frozen refactor; a diff failure localizes to one builder.
- **Baseline-not-gate (D-D)** — recording violations instead of fixing them keeps
  this change honest about its scope and hands `festival-zone-grammar` a real
  measuring stick.

## Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The D-C purity contract as written cannot reproduce the
  camp-village builder — `registry.closestBuilding` inside the rng loop
  (`chunks.js:1405`) means `env` needs a `blockedAt` predicate alongside `waterAt`,
  or the extraction either fails its own snapshot gate or quietly drags
  `three`-importing modules into the render-agnostic package.
- **Recommendation**: Fold Findings 1–3 into design/specs/tasks before apply
  (env contract widened; hub-viewer cleanup specified as the shared by-key unload
  walk; importmap rule corrected to four files + a consistency check). With those,
  the structure is sound: the module placement honors the worldgen contract, the
  seams reuse existing precedents (`buildSpawnArch`, chunkKey lifecycle, camLock),
  and the capability split matches the dependency graph.
