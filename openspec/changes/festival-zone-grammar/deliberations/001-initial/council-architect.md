## Architect's Position

I evaluated the plan for structural soundness from my domain: the layout/mesh
module split, the planner/builder extent contract, the zone-slotting design vs
the existing `computeFrontAxis`/`dancefloorRect`/`resolveOverlaps` machinery,
registry lifecycle/`chunkKey`, and the spur-roads-as-cosmetic-records seam.
The architecture here is unusually mature for a "fix the jumble" change: the
harness already shipped the gate (snapshot diff + draw canary + linter +
baseline), `FESTIVAL_TUNING` already centralizes the arrangement constants, and
`festival.js` is already a clean leaf (`rng.js`, `constants.js`, `tuning.js`,
sibling worldgen — no `chunks`/`registry`/`models` imports, confirmed by the
import block at `festival.js:43-51`). My verdict is therefore favorable, with a
small number of structural mitigations that protect the contracts the plan
relies on.

### Priority Sequence

I endorse the tasks.md group order (0→8) with one structural reordering and one
explicit gate. My recommended sequence:

1. **Preconditions + reproduce the baseline (group 0).** Non-negotiable. The
   "before" must be reproducible byte-for-byte or every later EMPTY-diff claim is
   meaningless. The capture protocol is already pinned (`?worldgen=1&perf=high`,
   crowd on, no driving — harness D-A).
2. **Crowd pre-rolled params FIRST, before the builder extraction (reorder 2→1).**
   tasks.md sequences extraction (group 1) before crowd (group 2). I would invert
   the *gating* relationship: today's snapshots are tier-dependent because
   `crowd.spawn` (`crowd.js:338-339`) draws from the cluster rng and early-returns
   drawing nothing when `this.free.length === 0` (the `PERF.crowdMax` pool). Until
   that draw is hoisted into the layout records, the snapshot diff for any builder
   that *contains* a crowd spawn is only valid at the pinned tier — and the
   draw-count canary will see a different per-cluster count at low vs high. The
   extraction's whole guarantee ("an EMPTY diff localizes to exactly one builder")
   is weaker while crowd draws still ride the stream. Land D2 first (or at least
   land it before any builder whose `layout` half pre-rolls crowd), so the
   extraction commits gate against a tier-stable snapshot.
3. **Builder layout/mesh extraction, easy→hard, one builder per commit (group 1).**
   `buildVendorRowAt` → `buildFoodCourtAt` → `buildCampVillageAt` → `buildStage`
   (the `Math.random()` transcription trap) → potty/drum/bubble → model-builder
   param splits. Each EMPTY-diff-gated incl. the canary. This is the riskiest
   refactor class in the repo by the harness's own assessment; the one-per-commit
   discipline is correct and must hold.
4. **True oriented extents, read-only until slotting (group 3).** Promote
   `clusterExtent` (`tuning.js:220`) into oriented shapes. Export them; do NOT
   wire them into placement yet — goldens stay frozen because nothing consumes
   them. Point the linter plan-mode + map overlay at them as a no-game-path
   change.
5. **Zone slotting — THE single golden move (group 4).** Replace
   `_computePlan`'s scatter+`resolveOverlaps` with priority slotting. Move the
   POI golden exactly once, re-record, log old→new, re-verify node==browser.
   Spur/access paths as cosmetic path records (NOT `roads.js`) so the queryPoint
   golden stays frozen.
6. **Registry-clearance backstop in the mesh half (group 5).** Restore
   per-sub-component `registry.closestBuilding()` with bounded retry/skip — and
   it MUST live in `buildMesh`, never in `layout` (see Module Boundaries below).
7. **Baseline burndown → 0, verify both tiers + both flags, judge, review
   (groups 6–7).**
8. **Close: CHANGELOG per-commit, ROADMAP trim, session-log (group 8).**

### Structural Risks Identified

- **[Module boundary — `registry.closestBuilding()` must not leak into the pure
  `layout` half]**: D5 / task 5.1 says the backstop "runs in `buildMesh` (which
  legitimately sees the live registry), never in the pure `layout` half." This is
  the correct call and the single most important boundary to police. `layout(rng,
  env)` is pure data; `env = {waterAt, blockedAt}` is the *only* injected world
  knowledge (briefing constraint; harness D-C′). The live `registry` is a
  `chunks.js`-owned object — pulling it into `layout` would (a) break the leaf
  rule, (b) make `layout` non-deterministic (registry state is load-order /
  path-dependent, exactly why `buildHubPreview` documents "explainable 6.3
  differences" at `chunks.js:1270-1272`), and (c) make the headless node linter
  un-runnable. **Risk:** an implementer "simplifies" by passing the registry into
  `layout` to do clearance during planning. That silently couples the leaf to a
  live mutable game object. Mitigation: keep the two clearance mechanisms
  distinct — planner-side clearance uses `env.waterAt`/`env.blockedAt` + the
  oriented-extent overlap test (pure); mesh-side clearance uses
  `registry.closestBuilding()` (impure, in `buildMesh`). The grep check in task
  2.2 ("no `src/worldgen/*` imports chunks/registry/lakes/models") should be a
  hard CI-style gate, not a one-time check.

- **[Extent contract — "one source with the builder" is asserted by a dev-only,
  localhost `console.warn`, not enforced]**: D3 claims "plan extent == built
  extent by construction" because both read `FESTIVAL_TUNING`. But the actual sync
  guard is `assertTuningDrift` (`chunks.js:1183-1203`), which is one-shot,
  localhost-gated, and only `console.warn`s on four `MODEL_DIMS` copies
  (`FOOD_TRUCK_SCALE`, `SUGAR_SHACK_W/D`, `POTTY_SPACING`). When extents become
  oriented shapes consumed by *placement* (group 4) rather than only by the
  linter overlay, a stale `MODEL_DIMS` copy no longer produces a cosmetically-off
  overlay — it produces a hub that *clips in the running game* while the linter
  (which reads the same stale copy) reports clean. The drift guard's failure mode
  upgrades from "lint inaccuracy" to "shipped clip the gate can't see."
  **Mitigation:** when an extent moves from advisory (linter) to load-bearing
  (slotting), promote the corresponding `MODEL_DIMS` drift check from
  `console.warn` to a thrown assertion in the node linter's selftest (it runs in
  node where there's no localhost gate to dodge), and add a `MODEL_DIMS` entry for
  every model dimension a new oriented extent depends on (the stage wedge will
  likely need deck dimensions not currently copied).

- **[`resolveOverlaps` deletion is correct, but its determinism contract must be
  preserved by slotting]**: `resolveOverlaps` (`festival.js:331-354`) is
  positions-only by deliberate design — it never touches `clusterSeed`/`idx`, so
  moving/dropping a cluster can't re-roll another's model variation (R19, comment
  at `:325-330`). Zone slotting replaces it, and the **omit** semantics (a zone
  that can't fit is dropped) is a *new* behavior class: dropping a zone changes
  the descriptor-list length. The existing architecture already insulates against
  this — each descriptor's `clusterSeed` comes from `clusterSeed(heart, idx)`
  (`festival.js:218-220`), keyed on a fixed `idx`, and the build half derives all
  variation from `clusterSeed` not `ctx.rng` (file header R19). **Risk:** if the
  slotting rewrite assigns `clusterSeed` by *output array position* instead of by
  the fixed semantic `idx`, then omitting one zone shifts every later zone's seed
  and the golden churns far beyond the intended single move. **Mitigation:** keep
  the `clusterSeed(heart, idx)` keying on a stable per-zone semantic index (stage
  = 0, court i, row i, …), independent of whether earlier zones were omitted —
  the same invariant `resolveOverlaps` was built to protect.

- **[Spur-roads-as-cosmetic-records is the RIGHT seam — confirmed against the
  queryPoint contract]**: I evaluated whether spur roads / drum access paths
  should be real arterials in `roads.js` vs cosmetic path records emitted by the
  planner. The plan's choice (cosmetic records, design Risk §"Spur roads") is
  structurally correct and I endorse it strongly. `queryPoint` (the road/water
  oracle, `festival.js:47` imports it; consumed at `:254`, `:260`, `:405`, `:437`,
  `:472`) feeds the frozen queryPoint golden and the heavy `nearestRoad`
  (~215µs/call, noted at `:122-123`, `:286-288`). Making a spur a real road would:
  (a) move the queryPoint golden (the plan explicitly keeps it frozen — D6,
  briefing constraint), (b) feed back into `nudgeOff`/`roadFacingYaw`/the
  `noBuild` corridor and perturb *other* clusters' placement, and (c) add
  `nearestRoad` cost. A cosmetic path record — pure planner output, rendered by a
  builder, never queried by `queryPoint` — is a clean one-way data flow with no
  feedback into the determinism oracle. **One watch-out:** the cosmetic path
  still needs to be *drivable* (the drum access path must clear blockers). Since
  it doesn't participate in `queryPoint`, the drivability guarantee has to come
  from the planner reserving the path corridor in its own oriented-extent overlap
  test (no zone slots onto the path) plus the mesh-half registry backstop — not
  from the road system. Make that reservation explicit in the slotting algorithm,
  or the "drivable access path" becomes a path with a tent in it.

- **[Registry `chunkKey` lifecycle — slotting must not change who owns
  disposal]**: Every worldgen sub-component registers with `chunkKey: ctx.key`
  (e.g. `chunks.js:1372`, `:1388`, `:1299`, `:1329`) so chunk unload drops it via
  `registry.removeChunk` (`registry.js:59-63`). The deliberate exceptions are the
  spawn arch (`chunks.js:1311-1314`, keyed `'spawn_arch'`, the lake-collider
  persistence trick, footgun #5) and lake colliders. **Risk:** if a slotted zone
  spans multiple chunks (a vendor aisle straddling a road, camps reserved behind
  it), the sub-components must each carry the `chunkKey` of *the chunk that built
  them* — which is already how it works because `placeChunkProps` filters by
  cluster-center ownership and a single `ctx.key` builds the whole cluster
  (`placeWorldgenProps`, `chunks.js:1153-1166`). The new spur/path *records* and
  the threshold arch must inherit the same discipline: if the planner now emits a
  threshold arch as a *normal* worldgen descriptor (vs the persistent spawn arch),
  it gets `chunkKey: ctx.key` and unloads with its chunk — which is correct for a
  non-spawn arch but means it can pop in/out as the player crosses chunk
  boundaries. Confirm the threshold arch on the *spawn* road is still the
  persistent `buildSpawnArch` path (`'spawn_arch'`, never unloads), and only
  *other* hubs' arches are chunk-keyed. The plan should state which arch is which.

- **[Crowd pre-roll preserves no-build + disposal tagging]**: D2 moves the crowd
  param draw into the layout records. Structurally this is sound and improves the
  architecture (kills tier-dependence, makes `buildMesh` draw-free for crowd). Two
  boundary notes: (1) the layout half stays pure — it pre-rolls *counts + per-NPC
  seeds* (integers), not `THREE`/`Crowd` objects; the actual `crowd.spawn` stays
  in the mesh half consuming those seeds. (2) No new `src/` module is implied by
  any of this (confirmed: the change edits existing files), so the
  importmap-in-four-files tripwire likely does not fire — but if group 1.6's
  model-builder `pickParams`/`buildXMesh` split ever extracts a *new file*, all
  four html files + `bin/check-importmaps` apply. The plan's Impact section
  already flags this ("no new modules expected; if any, all four html files").

- **[Open question `booth-on-road` rule change is in-scope but is a contract
  edit, not a tuning edit]**: design Open Questions flags possibly refining the
  `booth-on-road` linter rule (baseline's largest, 74) to "straddle allowed,
  on-surface not." This change is graded *by* the linter (proposal §Modified
  Capabilities: "this change is graded BY the linter, it does not alter it"), so
  changing a rule's semantics mid-change is a self-grading conflict: you'd be
  moving the goalposts you're scored against. If the rule genuinely encodes the
  wrong invariant for the new straddling design, that's legitimate — but it should
  be an explicit, logged decision (the rule's *spec* changes, re-baseline the
  affected count, note it in `burndown.md`), not a quiet threshold tweak. Treat it
  as amending the executable spec, with the same ceremony as the golden move.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: The `layout`/`buildMesh` boundary is the load-bearing wall
    of this entire change. `registry.closestBuilding()` must stay in `buildMesh`
    (impure), and the planner's clearance must use only injected
    `env={waterAt,blockedAt}` + pure oriented extents — otherwise the worldgen
    leaf rule breaks, the headless linter dies, and `layout` becomes
    load-order-dependent. Everything else (slotting, spur records, golden move) is
    well-reasoned and rides on this boundary holding.
-   **Recommendation**: The plan is architecturally sound and unusually
    well-instrumented — the harness already built the gate, `FESTIVAL_TUNING`
    already centralizes the contract, and `festival.js` is already a clean leaf.
    Proceed, with these mitigations: (1) land crowd pre-roll (D2) *before* the
    builder extraction so the EMPTY-diff gate is tier-stable; (2) keep
    `closestBuilding` strictly in `buildMesh` and enforce the worldgen no-upward-
    import rule as a hard gate; (3) when oriented extents go load-bearing in
    slotting, promote the `MODEL_DIMS` drift guard from a localhost `console.warn`
    to a thrown node-selftest assertion; (4) keep `clusterSeed(heart, idx)` keyed
    on a stable semantic index so zone-omit doesn't churn the golden beyond the
    one deliberate move; (5) make the drum access-path corridor an explicit
    reservation in the slotting overlap test, since `queryPoint` won't protect it;
    and (6) confirm which arch is the persistent `'spawn_arch'` vs a chunk-keyed
    threshold arch.
