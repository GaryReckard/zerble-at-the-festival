# Offline cache review, November 6

This is the root agent's code and evidence review, not an independent sub-agent
review or revised-source browser acceptance. Gary authorized offline work and
explicitly deferred browser testing.

## Reviewed invariants

- **Bulk ground updates bypass the support cache.** The production world uses
  140 segments per side, or 19,881 vertices, and resamples on 40-metre snapped
  moves (`src/world.js:30`, `src/world.js:31`, `src/world.js:182`, `src/world.js:211`). The revised
  height-only function reads the original vertices and interpolation without
  touching cell records (`src/worldgen/terrain.js:227`). The
  [production-ground regression](../../../bin/test-terrain-ground-recenter)
  compares real positions, normals, colors, UVs, bounds, dirty flags and raycasts
  through the actual resampling function, while checking support-cache retention.
- **Cell/plane records have bounded lifetimes.** The ring reuses its existing
  slot after 4,096 insertions and resets both plane-readiness flags before reuse
  (`src/worldgen/terrain.js:179`). Seed/epoch invalidation clears both the map and
  ring (`src/worldgen/terrain.js:30`). Keys and Map entries can still allocate;
  this is not a zero-allocation claim. The focused regression crosses capacity,
  revisits cells and changes seed/generation/tuning epochs.
- **Caller output cannot observe recycled plane values.** Primitive values are
  copied before assigning caller-owned output (`src/worldgen/terrain.js:212`).
  The reentrant output-setter fixture evicts more than a full ring, and its
  replacement plane has a different grade, so a late pooled read would be
  observable (`bin/test-terrain-cell-cache:67`). Literal signed-zero inputs are
  now covered for each tested seed/generation (`bin/test-terrain-cell-cache:35`).
- **Offline timing evidence preserves its limits.** All twelve
  [production-ground runs](production-ground-benchmark.json), including the
  slower revised run, remain saved. All final geometry hashes agree. The
  [CPU/GC attribution](production-ground-attribution.json) is a separate
  instrumented observation and does not explain that earlier outlier or
  establish browser frame delivery.
- **Future qualification preserves attempts and the resource owner.** The
  [prepared controller](qualify-revision.py) uses unique attempt directories,
  saves its executed source and selected manifest, checks each cleanup receipt
  and stops on failure. Browser deadlines remain with the previously accepted
  supervisor rather than an outer process timeout killing that owner
  (`qualify-revision.py:30`). This wrapper is syntax-checked but has not been
  exercised with a browser; that remains part of the next reserved window.

## Scope of the conclusion

No additional runtime correctness defect was found in this offline review.
The new geometry check strengthens the concrete cache-churn failure case, while
the latest focused sampler regression passes 50,262 exact sample records plus
height-only comparisons. The prior failed driving trial remains rejected.

The revision must still pass its own ordinary/diagnostic tier qualification and
fresh calibrated driving comparison. The first variant's successful parked
comparison cannot establish acceptance for a different revised build. No browser
was launched, no capture threshold was changed, and nothing was deployed during
this offline work.
