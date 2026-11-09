# Registry ownership feasibility probe

TL/DR: The isolated ownership prototype preserves the current ordered broadphase and passes 16,948 ordered candidate/geometry comparisons. It provides a feasible correctness surface for eliminating the all-resident discovery scan, conditional on proving static ownership in production. The timed Node experiment saves approximately 0.134 ms per frame with three movers, but adds approximately 0.140 ms when all 2,937 entries use explicit publication. The current recommendation is to retain the ownership design as feasible and decline to select it as the worthwhile live-game optimization without stronger route evidence, because its measured absolute saving is small and production static ownership remains unproved.

## What was built and verified

`registry-probe.mjs` imports the real `Registry` through the existing Node Three shim, and `OwnedScaffold` inherits the unchanged grids, queries, immediate add/remove operations, physical publication and canonical-generation behavior (`registry-probe.mjs:2-10`, `:25-60`). Its barrier invokes the **actual current reconciliation kernel** with a receiver facade whose entry iterator contains only declared movers, then combines dynamic results with cached static maximum radii and ID-ordered oversized entries (`registry-probe.mjs:52-59`). This facade is disposable measurement scaffolding, not a proposed production API.

The ordinary publication scaffold changes live entry geometry immediately but updates grid membership and exact pads at the existing barrier. That matches current ordinary direct mutation, including after-barrier writers whose membership changes must wait until the next barrier. Physical publication remains the real immediate API, so it can update cells before the next barrier. Add/remove remain immediately visible; removing the largest radius retains the same conservative pre-barrier pad, which shrinks to the same exact maximum at the next barrier (`registry-probe.mjs:28`, `:45-59`, `:80-99`; `src/registry.js:89-145`, `:197-239`, `:305-350`).

The saved correctness result is in `registry-probe-results.json`. It checks raw callback order, positions, footprints, collider geometry, oversized-list order and both radius pads, rather than merely comparing sorted hit sets (`registry-probe.mjs:69-77`). It includes 600 ordinary position/class/collider publications, repeated 15.9/16 threshold crossings, maximum removal, moving before removal, eight unload/revisit cycles, default direct-mutation fallback, stale ordinary tokens, 80 immediate physical publications, canonical/live queries and owner adoption followed by teardown (`registry-probe.mjs:79-106`). Existing `test-registry-maintenance` and `test-registry-physical` were read as contract references; no full project checks, browser sessions or servers were launched for this probe.

The actual parked snapshot rehydrates 2,937 entries. This controlled fixture treats its three `nut_wagon` records as movers and the other 2,934 as static, which changes the barrier discovery count from 2,937 to three under that **assumed** classification (`registry-probe-results.json`, `registry-probe.mjs:102-106`). A snapshot has no write history and cannot establish those 2,934 records are immutable throughout gameplay. All entries default to the legacy mover set unless explicitly certified static; that default preserves unknown direct writers and provides no discovery savings until ownership is established (`registry-probe.mjs:28-35`, `:92-94`).

A negative fixture deliberately mutates a certified-static position without publication and confirms that parity breaks (`registry-probe.mjs:100-101`). This is the central limitation: the prototype can preserve known mutation streams but cannot prove that every production writer declares its mutations. A production migration must inventory writers and run a debug shadow audit at the existing barrier before enabling static certification broadly. The verified writer/timing inventory is in `registry-source-map.md`, particularly the OneWheel, Nut Wagon and after-barrier Hooper examples.

## Costs and measurement method

The optional `--bench` mode ran once after the parent confirmed that browser captures and the support timing experiment were complete, with no other browser or benchmark active. It alternates baseline/candidate order over seven trials, with 200 warmup and 2,500 measured frames per trial, for three, 48 and all 2,937 movers. Three is the snapshot's `nut_wagon` count; 48 and 2,937 are sensitivity fixtures, not live population claims. It records reconciliation alone, mutation/publication plus reconciliation, admission including identical snapshot cloning, whole-registry teardown, and 2,000 paired footprint/collider query calls with a checksum guard (`registry-probe.mjs:112-148`). The saved JSON includes all raw trials and source/snapshot/probe SHA-256 hashes, Node version, architecture and capture time (`registry-probe.mjs:108-110`).

The prototype pays for one mover Map plus one static record per certified-static entry, generation-token records, radius-count Maps, and a cached static oversized array. Static admission updates these caches, while promotion/removal updates radius counts and sorts the small mover Map; removing a last maximum walks distinct radius keys. Every barrier allocates a receiver facade and a merged/sorted oversized array. Ordinary publication adds token checks and an assignment. All of those costs belong in the comparison, and none can be inferred away from the reduced scan count (`registry-probe.mjs:15-60`). The scaffold currently prioritizes reusing the exact production kernel and preserving order; it makes no memory-footprint or zero-allocation claim.

The completed timed command was:

```sh
node verification/performance/2026-11-07-structural-options/registry-probe.mjs --bench --write
```

The correctness-only command does not start a browser or time a workload, although it overwrites the results JSON if `--write` is supplied:

```sh
node verification/performance/2026-11-07-structural-options/registry-probe.mjs --write
```

## Timed results and order effects

The complete raw trials are in `registry-probe-results.json`; `registry-probe-summary.json` records totals, per-frame values, paired differences and the baseline-first/candidate-first groups. Negative deltas mean the prototype costs less. All medians below are across seven trials, each with 2,500 measured barriers/frames.

| Movers | Maintenance baseline/candidate total ms | Maintenance delta ms/frame | Mutation + maintenance baseline/candidate total ms | Mutation + maintenance baseline/candidate ms/frame | Delta ms/frame |
| --- | --- | --- | --- | --- | --- |
| 3 | 335.749 / 1.183 | -0.133826 | 336.592 / 1.313 | 0.134637 / 0.000525 | -0.134112 |
| 48 | 336.715 / 6.240 | -0.132190 | 337.919 / 13.760 | 0.135168 / 0.005504 | -0.129663 |
| 2,937 | 339.028 / 341.099 | +0.000829 | 444.966 / 794.989 | 0.177987 / 0.317996 | +0.140009 |

This preserves the unfavorable case: when no entries can be certified static, the full discovery scan remains and explicit publication makes the scaffold slower. The candidate checks tokens and applies assignments on every ordinary publication, so the all-mover result includes that cost rather than subtracting it (`registry-probe.mjs:45-48`, `:127-134`). Default legacy callers that do not publish still remain discoverable; the all-publishing case is a sensitivity bound on this particular scaffold, not a claim that compatibility requires every legacy caller to publish.

| Movers | Admission baseline/candidate ms | Whole-registry teardown baseline/candidate ms | Query batch baseline/candidate ms | Publications per trial including warmup | Static radius-key visits during teardown |
| --- | --- | --- | --- | --- | --- |
| 3 | 5.321 / 5.772 | 0.987 / 2.552 | 2.981 / 2.576 | 8,100 | 1,757 |
| 48 | 4.955 / 5.567 | 0.911 / 1.798 | 2.939 / 2.754 | 129,600 | 724 |
| 2,937 | 5.165 / 5.295 | 1.015 / 1.246 | 2.525 / 2.541 | 7,929,900 | 0 |

Admission includes snapshot cloning and all initial cache population on the candidate. Teardown includes histogram updates, last-maximum rescans and temporary mover promotion/removal, so those costs are present rather than deferred to an unmeasured event handler. A static mutation's first promotion shares that bookkeeping, but no separate isolated first-promotion timer was collected; correctness exercises promotion, while timing exercises its aggregate-removal work during teardown (`registry-probe.mjs:29-50`, `:123-140`). No standalone bytes/heap/GC measurement was collected.

Each query batch contains 2,000 footprint calls and 2,000 collider calls, and all paired checksum assertions passed. The query methods and grids are unchanged, so the small noisy query timing differences are retained as observed workload cost, not attributed to a new query algorithm (`registry-probe.mjs:135-143`). Ordered geometry parity is established by the separate correctness oracle rather than by the weaker timed checksum.

The baseline ran first in trials 0, 2, 4 and 6, while the alternative ran first in trials 1, 3 and 5. Median **paired** mutation-plus-maintenance deltas were respectively -0.135281 / -0.133671 ms per frame for three movers, -0.129368 / -0.130771 for 48 movers and +0.138873 / +0.138877 for all 2,937 movers. Both order groups therefore preserve the direction of each complete-frame result. Maintenance alone in the all-mover case has paired total deltas of +2.482 ms for baseline-first versus -3.087 ms for candidate-first, which changes sign and is too small/noisy to call a reconciliation win. Every raw trial remains saved, including the query and teardown outliers (`registry-probe-summary.json`, `registry-probe-results.json`).

## Decision boundary

This is a **no-go for selecting the registry redesign from present performance evidence**, while the controlled correctness result supports its technical feasibility. Saving approximately 0.13 ms in this Node workload does not establish a material live-game frame-tail improvement, and no production static census has been proved. It does show that admitting/removing static entries carries additional event cost and that blanket explicit publication can reverse the steady-state result (`registry-probe-summary.json`).

The parent reported that the fresh High parked profile has much lower registry attribution than the driving profile despite 2,937 parked entries. That observation is consistent with state/workload-sensitive attribution rather than a constant per-frame scan cost; this report does not convert either sampled attribution into elapsed savings. A static rehydration also cannot establish live driving residency, mover ratio, browser allocation/GC behavior, device gain or FPS improvement (`registry-source-map.md`, `high-route-attribution.json`, `high-parked-all-functions.json`, and the parent's capture analysis).

If later route evidence justifies revisiting this candidate, retain a single shared ordered footprint grid and collider grid, prove writer ownership using a shadow audit, preserve fallback and the existing publication barrier, then compare elapsed real-route costs. The present evidence supports selecting another structural target if it offers a larger measured opportunity, rather than implementing this redesign solely because its controlled relative speedup looks large.
