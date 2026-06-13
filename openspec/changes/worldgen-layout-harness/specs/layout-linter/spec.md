# layout-linter

> Revised after deliberation 001-initial: registry mode (built truth) is the
> PRIMARY context; plan mode is the fast headless sweep. The dry-run-records
> context from the first draft moved to `festival-zone-grammar` with the
> extraction.

## ADDED Requirements

### Requirement: Quality-invariant linter with two partitioned modes
The system SHALL provide `src/worldgen/lint.js`, runnable headless under node
(`bin/lint` wrapper) and importable in the browser, with rules as data
(`{id, severity, mode, check}`, stable ids) covering at minimum: sub-component
overlap (with an allowed-pairs table), dancefloor clearance,
vendor-booths-straddle-and-face-road, truck-off-road, potty-attached-to-parent,
stage-vs-stage minimum distance, spawn-arrival composition, and
nothing-on-water. Rules SHALL be partitioned into **plan mode** (headless,
multi-seed: `festivalPlan` + tuning analytic extents + road/water queries;
envelope-based rules labeled approximate) and **registry mode** (primary:
`dumpRegistry` payloads / snapshot files at sub-component granularity). Where
the modes disagree, registry mode SHALL be authoritative.

#### Scenario: Headless plan-mode sweep
- **WHEN** `bin/lint --seeds 10` runs with no captured snapshots
- **THEN** plan-mode rules evaluate across all hubs of 10 seeds in seconds and
  envelope-based findings are labeled approximate

#### Scenario: Registry mode audits built truth
- **WHEN** a `verification/snapshots/<seed>.json` capture (pinned tier) is
  passed to registry mode
- **THEN** all rules evaluate against actual registered footprints, and the
  output is marked authoritative

### Requirement: Drum-circle and spawn-arch placement rules
The linter SHALL include a `drum-in-trees` rule (error) and an `arch-placement`
rule (error), added after the baseline from Gary's 2026-06-12 playtest. The
`drum-in-trees` rule SHALL fire when the large LEAF drum circle is not in a
treed pocket (registry: `forest_tree` count within `DRUM_TREE_RADIUS` below
`DRUM_TREE_MIN`; plan: `treeDensity` below `DRUM_TREE_MIN_DENSITY`) OR when its
center lies inside another cluster's envelope (food-court ring / vendor-row rect
/ stage+dancefloor, the last via the directional dancefloor rect). The
`arch-placement` rule (registry-only — the spawn arch is not a plan descriptor)
SHALL fire when the spawn arch is not over a road, OR sits inside a dancefloor
rect, OR is closer than `ARCH_MIN_STAGE_DIST` to the stage. All thresholds SHALL
live in `FESTIVAL_TUNING` and SHALL be value-neutral for world generation (no
build path reads them). These rules RECORD, they do not gate (guardrail #1).

#### Scenario: Drum circle dumped in the open or inside a court
- **WHEN** a built drum circle has too few trees nearby or its center falls in a
  food-court / vendor-row / stage envelope
- **THEN** `drum-in-trees` fires with the offending cluster kind and the eyes
  pipeline links

#### Scenario: Spawn arch buried in the dancefloor
- **WHEN** the spawn arch is off-road, inside a dancefloor clearing, or within
  `ARCH_MIN_STAGE_DIST` of the stage
- **THEN** `arch-placement` fires (RECORD-not-fix; the grammar change re-places it)

### Requirement: Violations carry the full eyes pipeline
Every violation SHALL emit `{rule, severity, seed, x, z, kinds, msg}` plus a
map-sandbox 2D deep-link, a hub-sandbox 3D link (`?at=x,z` form), and a
paste-ready `__dbg.teleport(x, z)` snippet. `__dbg.gotoHub(n)` SHALL print the
current hub's violations once the linter lands.

#### Scenario: From violation to 3D eyes in one step
- **WHEN** a violation is reported
- **THEN** opening its hub-sandbox link shows the offending hub in 3D, and the
  teleport snippet reproduces the spot in the running game

### Requirement: Known-bad acceptance case
The linter's registry mode SHALL be verified against seed `0xf7ef2a3c`
(playtest round 2's trucks-clipping-vendor-rows seed): the `overlap` rule MUST
fire there before the linter is considered working.

#### Scenario: The linter catches the bug Gary already found
- **WHEN** a registry capture of seed `0xf7ef2a3c` at the pinned tier is linted
- **THEN** at least one `overlap` violation reports a truck×vendor-booth pair

### Requirement: Baseline recording, not gating (pre-grammar)
This change SHALL record the pre-grammar baseline from REGISTRY mode at the
pinned tier across ≥10 seeds in `verification/baseline.md`, in a Gary-legible
format (per rule: severity | total | worst seed | 2D link | 3D link, plus 2–3
hub-viewer screenshots of worst offenders), with plan-mode counts recorded
alongside so the headless-vs-built gap is itself tracked. Placement behavior
SHALL NOT be changed to reduce counts; rule false-positives are the only
fixable lint findings in this change.

#### Scenario: Baseline captured
- **WHEN** the linter first runs mechanically green across the seed set
- **THEN** the per-rule registry-mode counts (and plan-mode counts alongside)
  are committed as the measuring stick for `festival-zone-grammar`
