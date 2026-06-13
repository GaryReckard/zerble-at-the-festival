# builder-layout-extraction

> The substrate the grammar plans on (design D-C′, handed forward from
> `worldgen-layout-harness` deliberation 001). The extraction is
> behaviour-preserving by itself; the POI golden moves only when the grammar
> (sibling capability) changes placement. Gated by the harness instrument:
> snapshot diff + per-cluster draw-count canary + node==browser re-verify.

## ADDED Requirements

### Requirement: Pure layout / mesh split per builder
Each `chunks.js` worldgen builder SHALL split into a pure
`layout(rng, env) → records[]` half (sub-component positions, radii, yaw, and
cosmetic params — no three.js) and a `buildMesh(records) → group` half. Records
SHALL carry every value the planner and linter need to reason about true extent
without constructing geometry.

#### Scenario: Layout is computable without rendering
- **WHEN** `layout(rng, env)` is called for a cluster in node (no three.js)
- **THEN** it returns the full set of sub-component records (positions + radii +
  yaw) the builder would have placed, and `buildMesh(records)` reproduces the
  same geometry the pre-split builder did

#### Scenario: One builder per commit, diff localizes
- **WHEN** a single builder is split and the world is captured
- **THEN** the normalized layout-snapshot diff vs the pre-change baseline is
  EMPTY (including the per-cluster draw-count canary) for that commit

### Requirement: Crowd pre-rolled params (tier-independent layout)
The crowd spawn SHALL receive **pre-rolled params** from the cluster layout
rather than drawing from the cluster rng with a tier-sized pool at build time.
This SHALL make built layouts **independent of perf tier** (today they are not —
`crowd.spawn` draws from the stream and early-returns on pool exhaustion).

#### Scenario: Same layout at every tier
- **WHEN** the same seed/hub is captured at `?perf=low` and `?perf=high` after
  the change
- **THEN** the normalized sub-component layout is identical across tiers (the
  tier-dependence noted in harness D6 / R2 is gone)

### Requirement: Injected world env, no upward imports
The dry-run env SHALL be `{ waterAt, blockedAt }` injected by the caller. The
worldgen layer SHALL NOT import `src/chunks.js`, `src/registry.js`,
`src/lakes.js`, or `src/models/*` (the dependency-direction rule).

#### Scenario: Worldgen stays a leaf
- **WHEN** the worldgen module graph is inspected after the change
- **THEN** no `src/worldgen/*` file imports chunks/registry/lakes/models; water
  and blocked-point lookups arrive via the injected `env`

### Requirement: Non-seeded randomness transcribed as-is
`Math.random()` sites that are intentionally outside the deterministic stream
(e.g. `buildStage` cosmetic jitter) SHALL be transcribed as `Math.random()` in
the mesh half, never folded into the seeded `rng()` stream (doing so would
inject draws and move the golden unintentionally).

#### Scenario: Cosmetic jitter doesn't perturb determinism
- **WHEN** a builder with `Math.random()` cosmetic sites is split
- **THEN** the seeded layout records are unchanged by the split (the golden moves
  only for deliberate grammar changes, not for the extraction)

### Requirement: Registry-clearance backstop restored
The mesh half SHALL restore per-sub-component `registry.closestBuilding()`
clearance checks with bounded retry/skip (main's theme builders had this; v2
dropped it) as the **graceful-degradation backstop** even after zones land.

#### Scenario: A blind clip is caught at build time
- **WHEN** a sub-component would be placed atop an existing registry entry
- **THEN** the builder retries within a bounded loop and skips placement if no
  clear spot is found, rather than placing it overlapping

### Requirement: Deliberate single golden move
The change SHALL move the POI determinism golden **exactly once**, at the point
the grammar changes placement, re-record it, and **re-verify node==browser**
(the queryPoint golden stays frozen unless a road/water input changes). Every
other commit SHALL keep both goldens unchanged.

#### Scenario: The golden move is controlled and verified
- **WHEN** the grammar-placement commit lands
- **THEN** the POI golden is re-recorded with the old→new hash logged in the
  session-log, node and browser agree on the new hash, and the queryPoint golden
  is unchanged
