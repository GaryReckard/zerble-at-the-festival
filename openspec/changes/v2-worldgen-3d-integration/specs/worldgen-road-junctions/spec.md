## ADDED Requirements

### Requirement: Redundant approaches converging on a heart merge into a shared trunk
A deterministic 2nd pass over the road network SHALL detect roads that converge on a heart and
overlap on their final approach, and merge their overlapping tails into a single shared trunk into
that heart, with the contributing roads forking off it — eliminating the redundant near-parallel
"lens" of two roads arriving at the same destination.

#### Scenario: Two roads arriving at a heart from the same bearing are merged
- **WHEN** two arterials end at heart B and approach it within a small bearing cluster (their
  final segments run within a corridor of each other)
- **THEN** the pass replaces their overlapping tails with one shared trunk into B and forks the
  two roads to a junction upstream
- **AND** the result reads as a single road into B, not two parallel/crossing roads

#### Scenario: Distinct approaches are left alone
- **WHEN** two arterials reach heart B from clearly different bearings (they do not overlap on the
  approach)
- **THEN** both are kept as separate roads (no spurious merge)

### Requirement: The junction pass is deterministic, window-bounded, and non-recursive
The pass SHALL be a pure function of a heart's window-bounded incoming-edge set, symmetric (the
same merge is derived regardless of which endpoint or query order is used), and SHALL NOT recurse
into edge-existence resolution (it reads the first-pass polylines, it does not feed back). The
worldgen self-test road window-invariance (T4) and negative-control (T5) SHALL remain green.

#### Scenario: Same merge from any query window or order
- **WHEN** the network around heart B is queried at the derived road window and at window+1, or
  from B vs from a neighbor
- **THEN** the merged geometry into B is identical
- **AND** `runSelfTest()` T4 and T5 remain pass

### Requirement: The junction-merge is tuned in the 2D sandbox before the 3D consumes it
The junction-merge SHALL be visible and tunable in `map-sandbox.html` (the merged trunks/forks
render distinctly enough to evaluate "looks natural"), and the 3D road renderer SHALL consume the
merged network rather than the raw per-edge arterials.

#### Scenario: The lens is gone in the sandbox
- **WHEN** the map sandbox is centered on a lake-straddling pair that previously showed the
  redundant two-roads-into-one-heart lens (e.g. seed 1234)
- **THEN** the redundant approach is merged into a single trunk and the lens no longer appears
