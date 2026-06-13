# Design — festival-zone-grammar

> Implementation approach for the layout fix. Builds directly on
> `worldgen-layout-harness`: its `FESTIVAL_TUNING` module, `clusterExtent`
> analytic helpers, linter (the executable spec), hub viewer + map overlay
> (iteration surfaces), and `verification/baseline.md` (the measuring stick).
> Carries forward the deferred extraction design (harness design **D-C′**).

## Context

`festival.js` plans a hub by scattering cluster *points* with scalar
`KIND_FOOTPRINT` clear-radii, then `resolveOverlaps` nudges centers apart by the
sum of those radii. The `chunks.js` builders then construct *oriented shapes*
that exceed the radii (a "16 m" food court spans ~20 m+ of truck ring; a "12 m"
vendor row is an ~18–20 m rectangle with camps behind), so clusters that the
planner thinks are clear actually interpenetrate. Three secondary gaps compound
it: the dancefloor rect only repels trees (POIs ignore it), builders place
sub-components blind (no registry clearance), and there is no cross-hub
stage-spacing rule. The harness made all of this *measurable* (linter +
baseline) and *visible* (hub viewer, overlay) without changing placement; this
change changes placement.

## Goals / Non-Goals

**Goals:**
- Drive every error-severity linter rule to **0** across the 10 baseline seeds
  (`overlap`, `water-clear`, `drum-in-trees`, `arch-placement`, plus
  `truck-off-road`), and the warns (`booth-on-road`, `dancefloor-clear`,
  `potty-attached`) to 0 or a recorded justification.
- The festival **reads as intentionally arranged** in Gary's in-game 3D judgment
  (hub viewer + playtest markers), not just numerically.
- Hand the planner **true extents** and a clean **layout/mesh builder split** so
  future layout work is data-driven and headlessly testable.

**Non-Goals:**
- The `DEFAULT_WORLDGEN_V2` flip — a **separate, later** step (Gary-sequenced
  into the v2 HANDOFF: H.2 → harness → this → H.3/F.5 + I + flip).
- Per-truck cosmetic customization within a court (future; brief §"Sugar Shack").
- Changing the worldgen *feature* layer (hearts/roads/lakes/forests) — only the
  festival POI layer that rides on it. The queryPoint golden stays frozen.
- Touching the linter's rules (this change is graded *by* them).

## Decisions

### D1 — Extraction first, behaviour-preserving, one builder per commit
Split each worldgen builder into `layout(rng, env) → records[]` (pure) and
`buildMesh(records) → group`. This lands **before** any placement change, under
the harness gate: each commit's normalized snapshot diff (incl. the draw-count
canary) MUST be EMPTY. Rationale: the harness deliberation proved the extraction
is the repo's riskiest refactor class; doing it behaviour-preserving first means
the *only* commit that moves the golden is the deliberate grammar one, so a diff
failure localizes to exactly one builder. Alternative (extract + re-place in one
commit) rejected: a non-empty diff couldn't be attributed.

### D2 — Crowd pre-rolled params kill the tier-dependence
`crowd.spawn` currently draws from the cluster rng with a `PERF.crowdMax`-sized
pool and a zero-draw early return when full, so built layouts differ by tier
(harness R2). The layout half pre-rolls the crowd's params (count + per-NPC
seeds) into records; `buildMesh` consumes them without drawing. This both
enables the extraction and removes the tier-dependence, so the baseline (pinned
`perf=high`) and the shipped low/mid worlds finally agree.

### D3 — True extents = oriented shapes, one source with the builder
Promote the harness's approximate `clusterExtent` into **per-kind oriented
extents**: food court = ring radius (circle); vendor row = oriented rectangle
(half-length × lateral, including camps-behind); stage = directional wedge
(deck + front dancefloor). The planner's overlap/road/water/dancefloor tests run
against these shapes. They derive from the same `FESTIVAL_TUNING` constants the
builder reads, so plan extent == built extent by construction (the harness drift
guard already asserts `MODEL_DIMS` sync). The "two owners, do NOT merge" pairs
(planner dancefloor vs `buildStage`'s 9 m; legacy twins) **merge here**.

### D4 — Zone slotting replaces scatter-then-relax
Per hub, place zones in **priority order** on the front axis F (already computed
by `computeFrontAxis`):
1. **Stage** at the hub core, front wedge F **hard-reserved** against all later
   placement.
2. **Vendor aisles** along the approach road(s): booths mirrored both sides
   facing the aisle, **camp band auto-reserved behind** each side.
3. **Food courts** off-road, ≥ `COURT_MIN_STAGE_DIST` from the stage, with an
   optional **mini spur** (a short path record to the court center) when no road
   already touches it.
4. **Drum circle** placed in a forest pocket (via `env.treeDensity`/`blockedAt`)
   with a cleared **access path** to its center.
5. **Potties** attached to the nearest parent zone's edge, facing it.
6. **Arch** on the spawn road as a threshold, ≥ `ARCH_MIN_STAGE_DIST` ahead.
7. **Bubble vendors** probability-gated into leftover clear slots.

Each placement tests its oriented extent against already-placed zones, roads,
water, and the front wedge; a zone that can't fit is **omitted** (graceful
degradation) rather than nudged into a clip. Rationale: zones owning their
interior is main's "one theme per chunk" mutual-exclusion, re-applied at hub
scale (brief §"what made main feel ordered"). Alternative (shape-aware
`resolveOverlaps` keeping scatter) rejected: relaxation still permits clipping
under density; slotting+omit guarantees clearance.

### D5 — Registry-clearance backstop in the mesh half
Restore per-sub-component `registry.closestBuilding()` checks with bounded retry
/ skip (main's exemplar: camp spacing). Even after zones land, this catches
cross-cluster blind spots (e.g. a camp band behind one vendor row reaching into
a neighbour). It runs in `buildMesh` (which legitimately sees the live
registry), never in the pure `layout` half.

### D6 — The single, deliberate golden move
The POI golden moves exactly once — the commit that switches `festivalPlan` from
scatter to slotting. Re-record it, log old→new in the session-log, re-verify
node==browser (the harness's accepted V8-fork caveat applies to the *node-vs-old*
poi hash, not node-vs-browser-same-build). The queryPoint golden stays frozen
(no road/water input changes). All extraction commits (D1) keep both frozen.

## Risks / Trade-offs

- **[Determinism — the world regenerates]** → by design; flag stays off, the
  golden moves once and is re-recorded + re-verified, every pre-grammar commit
  is snapshot-EMPTY-gated, and the flip is deferred. No mid-game player is on v2.
- **[Extraction perturbs draw order invisibly]** → the per-cluster draw-count
  canary (built for exactly this) gates every extraction commit; a changed count
  with identical positions still fails the gate.
- **[Zone-omit makes sparse hubs feel empty]** → tune priority + extents so omit
  is rare; the hub viewer + gallery surface it across seeds before shipping.
- **[Spur roads are a new worldgen output]** → keep them *cosmetic path records*
  emitted by the planner (not new arterials in `roads.js`), so they don't touch
  the road-existence queryPoint golden.
- **[Perf budget]** → slotting adds no geometry; verify the backtick panel at
  `?perf=low` and `?perf=mid` anyway (zone-omit can only *reduce* draws).
- **[Disposal / `userData.shared`]** → the layout/mesh split must preserve every
  pooled-resource tag; the mesh half is where tagging lives.

## Migration Plan

`?worldgen=1` regenerates: existing v2 seeds build a different (correct) festival
after the grammar commit. This is acceptable because v2 is flag-off in
production and no save persists world state. `?worldgen=0` (the shipped game) is
untouched except shared imports. The golden move is the migration's only
irreversible step; it is gated, logged, and re-verified. If a snapshot diff is
non-empty on an *extraction* commit, that commit does not land — there is no
"accept the drift" path until the deliberate grammar commit.

## Open Questions

- **Spawn-on-road vs face-the-stage** — round-2 left this as a tradeoff. Lean:
  spawn on the road *with the stage ahead through the arch* (both, via the front
  axis), resolve concretely during D4. (-> deliberation.)
- **`booth-on-road` as warn vs error** — baseline's largest rule (74). If
  straddling legitimately puts booths near the road edge, is the rule's
  threshold right, or does it need a "straddle is allowed, on-surface is not"
  refinement? (A linter-rule bug is fixable here per harness scope; confirm in
  deliberation.)
- **How many builders actually need the full layout/mesh split** vs. just a
  records-emitting wrapper — scope per-builder during D1.
