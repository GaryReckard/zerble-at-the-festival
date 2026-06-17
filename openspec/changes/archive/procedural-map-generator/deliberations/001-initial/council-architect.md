# Council Deliberation — Architect

Change: `procedural-map-generator` · Deliberation: `001-initial` · Persona: Architect (Structural Integrity Guardian)

## The Architect's Order of Operations

### Priority Sequence

My lens is structural soundness and "will this survive contact with the 3D
chunk lifecycle." The plan's own ordering (scaffold → hearts → sandbox shell →
roads → lakes → density → roles → rivers → verify) is mostly right, but I'd
re-sequence two things and front-load one decision that the current tasks.md
leaves implicit until §7.

1. **Lock the output data-tuple contract BEFORE writing any layer (move ahead
   of Task 1.1).** Right now `queryPoint` is scaffolded in 1.1 and the tuple is
   only fully assembled in 7.2. That is backwards for a change whose entire
   stated purpose (D1, proposal "single source of truth") is the *shape of the
   data the future 3D port will consume*. The single biggest way this 2D detour
   fails is if the tuple is missing a field the 3D port needs and the 2D layers
   get written against the wrong shape — then "perfect it in 2D" produces
   something that gets rewritten in 3D anyway. Write the tuple spec first (see
   my Data-Tuple Contract section), then scaffold `queryPoint` to return it with
   stubbed values. Every layer fills in fields of a contract that already exists.

2. **Determinism harness (Task 1.3) is correctly early — keep it, and make it
   the gate it claims to be.** It mirrors the byte-identical self-test the
   perf-pass-4 spatial grid shipped with (design.md Risks). Good. But add the
   *boundary-agreement* check (currently buried in 9.1) to the §1.3 helper from
   day one, because edge/pair-seeding (D4) is the thing most likely to be subtly
   wrong, and you want the assertion firing the moment roads land in §4, not at
   §9 after four layers are built on a cracked foundation.

3. **Hearts (§2) before the sandbox shell (§3) — agree, with one caveat.** The
   make-or-break knob (D9) is heart distribution, and you can't tune it without
   the viewer. But hearts need `nearestHeart(seed,x,z)` over a *bounded
   neighborhood* (Task 2.3), and the bound is the same structural question as
   the road proximity-graph radius (D6). Decide the neighborhood-search radius
   convention ONCE, in §2, and reuse it in §4. Two different "how far do I look"
   constants in two files is how the eventual integration becomes two contracts
   instead of one.

4. **Sandbox shell (§3) — register it in the no-build importmap list up front,
   not as an afterthought.** This is a brand-new page (`map-sandbox.html`) with
   its own cache-buster array. The footgun (CLAUDE.md #1) is real and the plan
   already calls it out (Task 3.1), but I'd verify the hot-reload works with a
   trivial edit before building any layer on top of it — a silently-stale module
   during heart tuning would waste the most expensive iteration loop in the change.

5. **Roads (§4), lakes (§5), density (§6), roles (§7) — agree with plan order.**
   The dependency direction (roles reads hearts+roads+water+density; density
   reads hearts+water+roads; roads route around water) is a clean DAG and matches
   D10. One structural note: §5 (lakes) currently lands *after* §4 (roads), but
   D10 and the proposal both say "water before roads" so roads can route around
   water. The tasks.md order (roads §4, lakes §5) contradicts the design's
   pipeline order (hearts → water → roads). Resolve this — see Module
   Decomposition. I'd build lakes before road *routing* even if the road *graph*
   (which hearts connect) is sketched first.

6. **Rivers + bridges (§8) last — strongly agree.** Highest coupling, hardest
   determinism (pair-seeded meanders that must avoid heart cores AND produce
   bridge markers at road intersections). Keeping the skeleton shippable without
   them (design Risks) is the right call. This is also the cleanest scope-cut
   line if effort runs long (see Tensions with Maverick/Pragmatist).

7. **Verification (§9) and docs (§10) — agree.** Add one item: a `src/worldgen/`
   header/README documenting the tuple contract and the determinism invariant
   (Task 10.3 covers this) — but it must document the contract from §1, so it's
   really a finalization of step 1 above, not net-new work.

## Structural Risks Identified

- **Tuple-shape lock-in deferred to §7 (highest structural risk).** The change's
  thesis is "build the data model once, consume it from 2D + 3D + map view"
  (D1/D11, proposal lines 19–21). But the data model (the `queryPoint` tuple) is
  only finalized in Task 7.2, after hearts/roads/lakes/density are already built.
  If the tuple omits a field the 3D port needs, the 2D layers were authored
  against an incomplete contract and the "single source of truth" claim is
  violated on first contact with the renderer. **Impact:** the 2D detour produces
  something that must be partially rewritten for 3D — exactly the outcome D1 says
  it's avoiding. Mitigation in my Data-Tuple Contract section.

- **The 2D model will omit data the 3D port structurally requires.** Canvas-2D
  (D2) only needs position + flat shape to draw. The 3D chunk pipeline needs more,
  and the briefing explicitly asks me to flag this: **heights** (terrain is
  currently flat — `rng.js:82 terrainHeight() returns 0` — so this may be a
  non-issue *today*, but a generator claiming to be the future source of truth
  should at least reserve a `groundY`/elevation field or explicitly document
  "flat world, no elevation layer"); **collider radii** (lakes seal their
  perimeter with `SPHERE_R=2.2` spheres, forests use per-tree `radius:1.3`
  colliders — the generator says nothing about collider geometry); **facing/
  orientation** (roles must anchor *off* a road and *face* it per Task 7.1 and the
  proposal's "stages-on-roads" fix — facing is a first-class output, not a
  rendering detail, and it must be in the tuple); and **lifecycle ownership**
  (chunkKey-vs-no-chunkKey). **Impact:** if facing and footprint/collider radius
  aren't in the data tuple, the 3D port re-derives them ad hoc per-theme-builder
  and the "stages face the road" structural guarantee evaporates at integration.

- **chunkKey lifecycle is entirely absent from the data model, and that is the
  trap lakes already taught this codebase.** CLAUDE.md tripwire #5 and `lakes.js`
  (no chunkKey, lines 404–409 register `lake` with no `chunkKey`) vs `forests.js`
  (chunkKey on every entry, e.g. line 304, 868–879) encode a hard rule: macrocell
  features that outlive a single chunk MUST omit chunkKey or they vanish mid-game.
  This generator produces *macrocell-scale* features (hearts spanning 2×2 blocks,
  arterials spanning many chunks, rivers spanning lakes). When the 3D port
  registers these, **most of them must NOT carry a chunkKey** — they're
  lake-class, not chunk-class. The generator should label each emitted feature
  with its intended lifecycle owner so the future port doesn't have to re-reason
  it. **Impact:** get this wrong at integration and arterials/hearts flicker out
  when a host chunk unloads — the exact bug the lake chunkKey-omission exists to
  prevent. This is the single most important structural carry-forward and the 2D
  sandbox literally cannot surface it (no chunks unload in Canvas 2D), so it must
  be designed in now, on paper.

- **tasks.md §4/§5 ordering contradicts D10's pipeline order.** D10 and the
  proposal say hearts → **water** → roads (roads route around water). tasks.md
  does §4 roads → §5 lakes. **Impact:** if roads are implemented before a
  `lakeAt()` query exists, road routing can't avoid water and §5 forces a
  retrofit of §4. Low-severity (it's a task-ordering slip, not a design flaw) but
  it's a real internal inconsistency the council should fix in tasks.md.

- **Two seeding schemes risk (the determinism carry-forward).** The plan correctly
  says reuse `hash2`/`worldHash`/`mulberry32` (Task 1.2, proposal line 91–93). But
  Task 1.2 hedges "(or a `worldgen/hash.js`)". A separate `worldgen/hash.js` that
  *re-implements* edge/pair hashing instead of *composing* the existing primitives
  would fork the seeding contract — the exact thing the proposal says it's
  avoiding (line 91: "the eventual integration inherits one seeding contract
  rather than a second, divergent one"). **Impact:** if `worldgen/hash.js` grows
  its own mixing constants, the 3D integration has two determinism regimes to keep
  in sync forever. Structural mandate: new helpers (`cellHash`, `edgeHash`,
  `pairHash`) must be thin wrappers built ON `hash2`/`worldHash`, ideally added TO
  `rng.js` (which already hosts `chunkRng`, the same pattern). See Absorbed Auditor
  Concerns.

- **`worldHash` mixes the SESSION_SEED globally — a hidden coupling for the 2D
  sandbox.** `rng.js:55-60 worldHash` folds the module-global `SESSION_SEED` into
  every hash. The 2D sandbox's seed input (spec: "Seed control with deterministic
  re-roll") must drive that same `setSessionSeed()` path, NOT a private seed
  argument threaded through `queryPoint`. If the sandbox invents its own seed
  parameter, the generator's determinism diverges from how the live game seeds
  (CLAUDE.md #4: don't fork the seeding scheme). **Impact:** sandbox-tuned maps
  won't reproduce identically in the 3D game under the same `?seed`. The cleanest
  contract: `queryPoint(seed, x, z)` internally calls `setSessionSeed(seed)` once
  per render pass, or the sandbox sets it before querying. Decide and document.

## The Data-Tuple Contract (the load-bearing recommendation)

This is the thing the council should nail down before implementation, because the
2D model is otherwise authored against a shape that the 3D port will have to
amend. The point-query spec (spec.md "Point-query API") lists six fields:
nearest-heart+rank, role tier, road state+tier, river/bridge state, tree density,
lake state. That is sufficient to *draw a 2D map*. It is NOT sufficient to *build
the 3D world* the proposal promises this generator will feed. Recommended tuple:

```
queryPoint(seed, x, z) -> {
  // --- already in spec ---
  heart:   { id, rank, x, z, distance, angle } | null,  // nearest heart + geometry to it
  role:    'core' | 'district' | 'outskirts',
  road:    { onRoad: bool, tier: 'arterial'|'collector'|'footpath'|null,
             // ADD: direction of the road at this point (radians) — needed so
             // roles can FACE the road; without it the "stages face the road"
             // fix (Task 7.1) has no data to act on.
             facing: number|null },
  water:   { inLake: bool, onRiver: bool, bridge: bool },
  density: number,                                       // 0..1 tree-density field

  // --- ADD for 3D-port survival (structural carry-forward) ---
  noBuild: bool,            // composite: inLake || onRiver || onRoad-corridor.
                            // The single query the 3D placer asks before
                            // dropping anything. Mirrors lakes' isPointInLake +
                            // rivers' no-build corridor as ONE answer.
  footprint: number,        // suggested clear-radius for whatever anchors here,
                            // so the registry footprint isn't re-guessed per theme.
  // groundY: number,       // RESERVE or explicitly document "flat: always 0"
                            // (rng.js terrainHeight() returns 0 today). Reserving
                            // the field now is free; retrofitting it later is not.
}
```

And, separately from the per-point query, a **feature-enumeration** result for
region queries (`queryRegion`) — because the 3D port doesn't place features by
sampling points, it places them by iterating the features in a bounded area
(exactly how `lakes.js` and `forests.js` iterate macrocells). Each emitted
feature should carry the lifecycle hint:

```
queryRegion(seed, bounds) -> {
  hearts:   [{ id, rank, x, z, domainRadius, lifecycle:'persistent' }],
  roads:    [{ tier, polyline:[{x,z}...], lifecycle:'persistent' }],
  lakes:    [{ x, z, outline|radius, lifecycle:'persistent' }],   // mirror lakes.js
  rivers:   [{ polyline, corridorWidth, lifecycle:'persistent' }],
  bridges:  [{ x, z, roadTier, lifecycle:'persistent' }],
  // density/role are fields, not features — they stay point-query-only.
}
```

The `lifecycle` tag is the chunkKey-vs-no-chunkKey decision made *once, in data*,
instead of re-litigated per registration site in the future port. Hearts, roads,
lakes, rivers, bridges are all macrocell-scale and almost certainly all
`persistent` (no chunkKey, like lakes). Per-location *props* derived from `role`
would be the chunk-class entries (chunkKey-tagged). Encoding this distinction in
the generator's output is the cleanest way to guarantee the integration is one
contract, not two. **Critically: D2 (Canvas 2D) is the forcing function that
keeps the tuple honest — "if the sandbox can draw it from data alone, the data
model is complete" (design.md line 48). Extend that test: the tuple is complete
when the sandbox can draw it AND the fields above exist for the 3D port. Drawing
doesn't exercise footprint/facing/lifecycle, so those need a deliberate spec
review, not just "does the map look right."**

If the council accepts only one recommendation from me, it's this: **add facing,
noBuild, footprint, and a per-feature lifecycle tag to the contract now, and
reserve groundY.** Those four are the fields the 2D model will silently omit and
the 3D port will silently need.

## Module Decomposition Review

The proposed split (`hearts.js`, `roads.js`, `water.js`, `density.js`,
`roles.js`, `index.js`) is sound and the dependency direction is a clean DAG.
Assessment:

- **Boundaries are right.** Each layer is a pure function of (seed, coordinate)
  reading only earlier layers. This mirrors `forests.js`'s pure-hash style
  (`getForestAt` is "pure-hash deterministic — no per-frame manager, no
  loaded-state", forests.js:15-16) far more than `lakes.js`'s stateful
  `LakeManager`. Good — the generator should be the *forests* model of statelessness,
  not the *lakes* model of a load/unload manager. The manager (load/unload by
  distance) belongs to the FUTURE 3D port, not this module. Keep `src/worldgen/`
  manager-free.

- **Dependency direction — one correction.** `roads.js` must depend on `water.js`
  (route around lakes/rivers) AND on `hearts.js` (connect hearts). `density.js`
  depends on hearts + water + roads. `roles.js` depends on hearts + roads (+ water
  for noBuild). So the import DAG is:
  `hearts → water → roads → density → roles → index`. tasks.md building roads
  (§4) before lakes (§5) inverts the `roads→water` edge. **Fix:** implement
  `water.js` lakes (§5.1) before `roads.js` routing (§4.1-4.2), even if the road
  *connection graph* (which hearts pair up, §4.1's proximity graph) is prototyped
  first against hearts only. The graph doesn't need water; the *meander routing*
  does.

- **`queryPoint` composition.** `index.js` should compose by calling each layer
  in DAG order and assembling the tuple — NOT by having layers call each other
  laterally (that reintroduces order-dependence risk and hidden coupling). Each
  layer exports a pure `xAt(seed,x,z)` that takes whatever earlier-layer results
  it needs as *arguments passed by index.js*, not as imports it reaches for
  itself. This keeps the layers individually testable (the determinism self-test
  can hit one layer in isolation) and makes the DAG explicit in one file. This is
  the same shape as `chunks.js` calling `getForestAt()` then `getLakeAt()` then
  `pickTheme()` — a composing caller, not peer-to-peer reach-through.

- **One missing module: `constants.js` (or a constants block in index.js).** D9
  names the tunable constants (heart cell size, rank weights, jitter, domain
  radii, road-neighborhood radius) as the make-or-break surface. Scatter them
  across five files and tuning becomes archaeology. The existing models keep
  per-file constants (LAKE_CELL, FOREST_BLOCK) but those are single-knob systems;
  this generator's whole *point* is coordinated multi-knob tuning by eye. A single
  named-constants surface (imported by every layer) makes the D9 tuning loop —
  and the session-log capture of chosen values (Task 3.4) — coherent. Recommend
  adding it.

- **`worldgen/hash.js` vs adding to `rng.js`.** Prefer adding `cellHash`,
  `edgeHash`, `pairHash` to `rng.js` next to `chunkRng` (rng.js:73). They're the
  same family of helper, `rng.js` is already the determinism home, and a separate
  `worldgen/hash.js` risks drifting into its own constants. If they go in
  `worldgen/hash.js` anyway, they MUST be `import { hash2, worldHash } from
  '../rng.js'` wrappers with zero new mixing constants. Either way, ONE seeding
  contract (proposal line 91).

## Parallel-to-Existing-Macrocell-Systems Review

The briefing asks whether this should reuse/share lakes' and forests'
conventions so integration is one contract. My assessment: **share the
*conventions*, deliberately DON'T share the *code* in this change, and design the
generator so the future port can REPLACE both lakes' and forests' placement logic
rather than run alongside it.**

- **Macrocell + jitter + bounded-neighborhood query is already the house
  pattern.** Lakes: `LAKE_CELL=320`, one jittered lake per cell, `worldHash(mcx*17+91,
  mcz*13+31)` seed (lakes.js:32, 101). Forests: `FOREST_BLOCK=5` chunks (=400m),
  jittered content, `worldHash(centerCx*73+13, centerCz*91+37)` (forests.js:54,
  98). Both query a bounded neighborhood (`pointInForest` checks the 3×3
  neighborhood, forests.js:262-270; `chunkInLake` scans registry footprints). The
  generator's hearts (coarse macrocell, jittered, rank-rolled) and its
  `nearestHeart`/proximity-graph (bounded neighborhood) are the *same shape*.
  Reuse the *seed-construction idiom* (`worldHash(mc*primeA+offA, mc*primeB+offB)`)
  so the eventual port's determinism is recognizably the same family. **But use
  fresh salt offsets** (CLAUDE.md #4) — do NOT reuse lakes' `*17+91` / forests'
  `*73+13` literals, or the generator's hearts will spatially correlate with
  existing lakes/forests in a way that's hard to debug.

- **The generator's eventual job is to OWN what lakes.js and forests.js currently
  own independently.** Today lakes and forests each roll their own placement and
  *coordinate by registry consultation at generation time* (forests calls
  `chunkInLake` to avoid dropping a forest on a lake, forests.js:109,119). That's
  two systems negotiating at runtime. The generator's promise (D1, one source of
  truth) is that water and forests come out of ONE coherent layered pass — density
  field replaces discrete forest blocks (D8), lakes are a water-layer feature. So
  the integration is not "generator + lakes + forests running in parallel" — it's
  "generator's water/density layers REPLACE lakes.js placement + forests.js
  placement, the v2 worldgen" (proposal line 76-78, migration plan line 137-138).
  **This is correct and the proposal states it.** The structural risk is only if
  someone later wires the generator in *additively* (a fourth system) instead of
  *replacing* — then you'd have the generator's rivers AND lakes.js's lakes both
  trying to own water. The migration plan should explicitly say "the v2 port
  retires lakes.js/forests.js placement," and Task 10.2 (ROADMAP the follow-ups)
  should phrase the follow-up as a *replacement*, not an *addition*.

- **One contract, confirmed achievable.** Because both existing systems already
  use `worldHash`+`mulberry32` and register into the same `registry` with the
  same entry shape (kind/position/footprint/collider/attractor/chunkKey,
  registry.js:25-33), a generator that reuses `rng.js` and emits feature data
  that maps 1:1 onto that registry entry shape WILL integrate as one contract.
  My Data-Tuple Contract's `lifecycle` tag is precisely the field that lets the
  port translate a generator feature into a registry entry with the correct
  chunkKey decision. Lakes register with no chunkKey + an `outline` field
  (lakes.js:404-409) and seal a collider ring (placeSealedColliders); the
  generator's lake feature should carry the same `outline` so the port reuses
  lakes.js's perimeter-sealing logic verbatim. **Recommend the lake feature shape
  in `queryRegion` match lakes.js's registered shape (position + outline) exactly**
  — that's the cleanest possible integration seam.

## Absorbed Auditor Concerns (no-build / hygiene / seeding)

Per the briefing (Profiler + Auditor deselected; I absorb module-boundary/hygiene):

- **No-build importmap registration (CLAUDE.md #1, .claude/rules/no-build.md).**
  `map-sandbox.html` is a NEW page with its OWN cache-buster array — it is NOT
  `index.html`'s `mods`/`models` arrays (index.html:87-90) nor `sandbox.html`'s
  (sandbox.html:177-180). Task 3.1 correctly scopes registration to "this page's
  cache-buster list." The footgun the rule warns about (update one, forget the
  other) is *less* acute here because the new worldgen modules are loaded ONLY by
  `map-sandbox.html` in this change — they don't need to be in index.html/
  sandbox.html arrays yet (nothing else imports them). **But flag for the future
  port:** when the generator IS wired into the live game, every `src/worldgen/*`
  module must be added to BOTH `index.html` AND `sandbox.html` arrays. Note this
  in Task 10.2/10.3 so the port doesn't trip the most common variant of footgun #1.

- **`map-sandbox.html` must include the same importmap `<script type="importmap">`
  three.js... actually NO — D2 says Canvas 2D, no three.js.** Verify the new page
  does NOT import `'three'` at all (spec: "without requiring... three.js"). The
  worldgen modules must not `import * as THREE` (spec: "Render-agnostic output...
  SHALL NOT import three"). This is cleanly enforceable: a Task 9.3 check that the
  module imports with no `three`/DOM. Keep that check. It's also the structural
  proof that the data-only boundary (D1) is real, not aspirational — if a worldgen
  module ever needs `THREE.Vector3`, use plain `{x,z}` objects instead (the
  generator deals in 2D coordinates; Vector3 is a renderer type). Lakes/forests
  use `new THREE.Vector3(...)` at *registration* time (lakes.js:404), but that's
  the PORT's job, not the generator's. Keep Vector3 out of `src/worldgen/`.

- **Seeding reuse, not fork (CLAUDE.md #4).** Covered above — `cellHash`/`edgeHash`/
  `pairHash` as thin wrappers on `hash2`/`worldHash`, ideally in `rng.js`. The
  `SESSION_SEED` global coupling (rng.js:17,55) means the sandbox's seed input must
  route through `setSessionSeed()` (rng.js:21) — the same door the live game uses
  (main.js sets it from `?seed=`). Do not add a parallel seed parameter. One
  determinism regime.

- **CHANGELOG hygiene (Task 10.1).** The new dev-workflow surface
  (`map-sandbox.html`) is exactly the kind of dev-workflow change that
  .claude/rules/changelog-and-roadmap.md requires a CHANGELOG entry for ("a new
  sandbox entity, the dev server"). Task 10.1 covers it. Good. ROADMAP follow-ups
  (Task 10.2) should be phrased as the three explicit follow-up changes the
  proposal names: v2-worldgen wire-in (replacement), in-game map view, rivers-in-3D.

- **Determinism self-test as a shipped artifact, not throwaway.** Task 1.3's
  helper and the §9 acceptance checks should live in the repo (a
  `worldgen/_selftest.js` or a sandbox button per Task 3.3), not be a one-time
  manual check — because the FUTURE port will re-run them after wiring in, and the
  v2-worldgen change is the one that actually trips footgun #4 (regenerates
  existing worlds). A persisted, re-runnable byte-identical assertion is the
  guardrail that the integration change will lean on. This mirrors how the
  perf-pass-4 spatial grid shipped with its byte-identical verification (design.md
  Risks line 127-128). Keep it as code.

## Anticipated Tensions

- **Tension with Maverick (will push to cut scope):** Maverick will likely argue
  to cut rivers/bridges (§8) entirely from this change — and on pure
  build-the-skeleton grounds I partly agree (rivers are the highest-coupling,
  highest-determinism-risk layer, design.md Risks). BUT I diverge on *how* to cut:
  cutting rivers from the 2D prototype is fine; cutting the river-shaped FIELDS
  from the data tuple is NOT. The tuple must still carry `onRiver`/`bridge`/
  `noBuild` (even if always-false stubs) so the contract the 3D port consumes is
  stable whether or not rivers are implemented in this pass. Cut the layer, keep
  the contract slot. Where Maverick says "delete the river concept," I say "stub
  the river fields, defer the river *implementation*." Open Question Q4 in
  design.md frames this exactly right; my position is "in scope as stubs, last to
  implement, first to drop if time runs out — but the tuple field stays."

- **Tension with Pragmatist (will push critical-path):** Pragmatist will want to
  ship the heart+road skeleton ASAP and treat density/roles/rivers as nice-to-have.
  I largely agree the heart distribution (D9) is the critical path — it's the
  make-or-break knob and everything downstream orients to it. Where I'll push back:
  Pragmatist may want to skip my step-1 (lock the tuple contract first) as
  "premature formalization — just build hearts and see." I'll argue the opposite:
  for a change whose ENTIRE deliverable is "a data model the 3D port reuses," the
  contract IS the critical path, and skipping it to "just build hearts" is how the
  2D detour produces a model that gets rewritten. The contract spec is ~an hour of
  thinking, not a sprint; it's cheap insurance against the change failing its own
  stated purpose (D1). On the perf-of-the-generator concern Pragmatist absorbs: I
  agree it's a sandbox-rendering concern, not a generator concern (design.md Risks
  line 130-131) — the bounded-neighborhood point query is cheap; tile-cache the
  zoomed-out draw.

- **Tension with Adversary (will hammer determinism):** Strong alignment here, not
  tension — Adversary's determinism scrutiny is exactly the structural guarantee I
  care about. The one place I'd extend Adversary's likely attack: they'll hammer
  edge/pair-seeding (D4) and float non-associativity at seams. I'll add that the
  *quieter* determinism risk is the `SESSION_SEED` global coupling (rng.js:55) —
  if the sandbox threads its own seed instead of calling `setSessionSeed`, the
  generator is byte-identical with itself but DIVERGENT from the live game under
  the same `?seed`, and that divergence won't show up in the §9 self-test (which
  only checks the generator against itself). The boundary-agreement check must
  assert against the SAME seeding path the game uses, or it proves the wrong
  invariant. Adversary should add "does the sandbox seed route through
  setSessionSeed" to their determinism attack surface.

- **No tension with the Mediator's eventual synthesis on the scope boundary.** I
  endorse "generator + 2D sandbox only, 3D deferred" (proposal Scope Check) as the
  right boundary — IF the tuple contract is locked first. The 2D detour is only a
  risk of "building something that doesn't survive 3D contact" (briefing tension
  #6) if the data model is authored render-first instead of contract-first. Fix
  the ordering (my step 1) and the scope boundary is sound.

## Verdict

- **Verdict**: **Proceed with mitigations**
- **Key Concern**: The data-tuple/feature-output contract — the actual deliverable
  of this change — is finalized too late (Task 7.2) and, as specified, omits the
  fields the FUTURE 3D port structurally needs: **facing** (the "stages face the
  road" fix has no data to act on without it), **noBuild/footprint**, **a
  per-feature `lifecycle` tag encoding the chunkKey-vs-no-chunkKey decision lakes
  taught this codebase the hard way**, and a reserved **groundY**. The 2D Canvas
  model (D2) is the right forcing function for completeness *of what gets drawn*,
  but drawing never exercises facing/footprint/lifecycle, so those need a
  deliberate contract review now, not a "does the map look right" check later.
- **Recommendation**: The architecture is fundamentally sound — pure render-agnostic
  layers, a clean DAG, correct reuse of the `rng.js` determinism contract, and a
  scope boundary I endorse. Three mitigations make it solid: (1) **lock the
  data-tuple + queryRegion feature contract BEFORE building layers** (move ahead of
  Task 1.1), including facing/noBuild/footprint/lifecycle/reserved-groundY; (2) **fix
  the tasks.md §4/§5 ordering** so water precedes road routing per D10; (3) **keep
  `cellHash`/`edgeHash`/`pairHash` as thin wrappers on `hash2`/`worldHash` (prefer
  adding to `rng.js`), and route the sandbox seed through `setSessionSeed` so there
  is exactly one determinism regime shared with the live game.** With these, the 2D
  detour produces a contract that survives 3D integration as one seam, not two —
  which is the whole point of the change.
