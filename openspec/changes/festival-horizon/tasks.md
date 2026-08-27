## 1. Contract and experiment wiring

- [x] 1.1 Export one pure half-open owner-cell helper from
  `src/worldgen/placement.js` and add a narrow `ChunkManager.isLoaded(cx, cz)`
  completion predicate meaning "fully built" (required cluster props exist), so
  `farField.js` never touches the mutable `loaded` map, the private chunk-key
  format, or a re-derived `Math.floor` cell rule.
- [ ] 1.2 Add focused `bin/test-far-field` coverage for deterministic descriptor
  selection, descriptor-input immutability (pre/post hashes or deep-frozen
  fixtures), owner-cell fixtures at positive/negative/edge/corner boundaries,
  fixed-capacity nearest selection, boundary-only rebuilds, rapid-teleport
  supersession of versioned pending snapshots, the `?worldgen=0&farField=1`
  zero-allocation no-op, reduced-motion handoff, bounds enclosure after a second
  distant rewrite, and disposal idempotence, all before integration.
- [x] 1.3 Add tier-owned horizon radius, density, pool capacities, and
  rebuild-budget controls in `src/perf.js`; resolve effective enablement as
  `farFieldRequested && USE_WORLDGEN_V2` with the initial default off; make the
  disabled (or legacy-forced) path a zero-allocation no-op with no GPU resources,
  shader programs, or planning work.
- [x] 1.4 Add `src/farField.js` to the cache-buster `mods` lists in the three full
  pages, `index.html`, `sandbox.html`, and `hub-sandbox.html` (`map-sandbox.html`
  is worldgen-only and takes no render module); run `bin/check-importmaps`.
- [x] 1.5 Capture fixed-pose disabled baselines via real `?perf=low|mid|high`
  reloads and cold-benchmark representative dense seeds before building geometry;
  pin per-tier instance, road vertex/index, upload-byte, and submitted-triangle
  caps (provisional marginal caps: +5k triangles low, +10k mid/high). If a
  flag-off baseline already exceeds a tier's absolute HUD budget, record it and
  re-key that tier's promotion gate per task 5.5.

## 2. Bounded semantic renderer

- [ ] 2.1 Implement FarField-owned fixed-capacity `InstancedMesh` pools for stage
  canopies, truss beams, vendor/tent peaks, warm markers, and colored beacons using
  shared code-native geometry, per-instance color, no lights, no shadows, and an
  idempotent owner-only `dispose()`; recompute affected bounding volumes after
  every committed rewrite (or deliberately disable per-batch frustum culling);
  land road, canopies, and peaks first and add trusses and night markers only
  while measured caps stay green.
- [ ] 2.2 Implement the one-draw preallocated road ribbon buffer from copied
  `queryRegion` polylines, narrower than the authoritative loaded road at an
  explicit elevation constant strictly between ground y=0 and the real road
  y=0.06 (nominally 0.03), opaque `depthWrite: true`, materials created at
  construction time (never module evaluation), with deterministic
  clipping/capacity behavior and no registry side effects.
- [ ] 2.3 Implement deterministic heart/plan selection on 80m player-cell changes,
  discovering incrementally by coarse cell (never one monolithic full-radius
  `queryRegion`), copying descriptors into immutable FarField-owned compact
  records without mutating memoized worldgen arrays, using actual stage/vendor
  descriptors and stable integer palette mapping without consuming RNG calls;
  retain the nearest candidates on overflow and expose counts.
- [ ] 2.4 Implement shared Noon-to-Midnight material behavior that hides night
  marker batches by day and introduces no per-marker animation, transparent sorting,
  context lights, bloom writer, or per-frame allocation.

## 3. Chunk handoff and world lifecycle

- [ ] 3.1 Wire one FarField instance into `world.js` after the authoritative lake
  and chunk managers, passing the narrow `isLoaded` completion predicate and time
  of day; defer all planning to the first enabled update (no work at module
  evaluation) and snap initial proxy ownership without an envelope, leaving the
  title/start and synchronous iOS audio path untouched.
- [ ] 3.2 Implement actual-completion handoff through the exported owner-cell
  helper and `isLoaded` predicate (keyed to "required cluster props exist," not
  to chunk generation currently being synchronous), a proxy-only opaque Bayer
  dither with stable shader cache key, 0.3s active-envelope updates,
  reduced-motion state read live at handoff time (after `A11y.init()`) with
  immediate swaps, and clean reappearance after chunk unload.
- [ ] 3.3 Schedule all rebuild work under the single world-owned streaming
  deadline (full chunks consume first and FarField receives only the remainder;
  there is no second 3/4/5ms wall); stage descriptor planning incrementally by
  coarse cell while retaining the prior complete snapshot; version pending jobs
  by requesting player cell so rapid teleports supersede stale snapshots; apply
  replacements atomically; measure the largest indivisible cold step separately.

## 4. Sandbox and debug surfaces

- [ ] 4.1 Extend `hub-sandbox.html` with an isolated festival-horizon mode using
  the real FarField implementation, proxy-only/real-only/handoff controls, simulated
  distance/ownership, tier and time-of-day controls, and visible draw/triangle,
  instance, overflow, rebuild, geometry, texture, and program statistics;
  invalidate and rebuild the far-field snapshot on the same worldgen tuning-epoch
  bump that rebuilds the hub; note that sandbox tier controls preview composition
  only (real tier/shader paths verify via `?perf=` reloads).
- [ ] 4.2 Extend local `window.__dbg` with read-only horizon stats plus deterministic
  rebuild and handoff forcing controls suitable for fixed-seed A/B screenshots and
  long-travel lifecycle captures; document them in `DEBUGGING.md`.
- [ ] 4.3 Complete `bin/test-far-field` with registry/worldgen off-on identity,
  fixed-pool resource plateaus over repeated coarse-cell travel, shader/material
  invariants, and the no-builder/no-light/no-shadow contract.

## 5. Acceptance gates and promotion decision

- [ ] 5.1 Run `npm run check`, `npm run lint:layout`, focused far-field tests,
  `git diff --check`, importmap checks, and static syntax checks for every touched
  module and HTML inline script.
- [ ] 5.2 Capture fixed-seed off/on and proxy/handoff views at Noon and Midnight
  on low, mid, and high; confirm the horizon reads as populated, proxy composition
  is not misleading, roads align, and the handoff has no pop or z-fighting.
- [ ] 5.3 Verify the real title/start flow, gameplay boot, mobile viewport, reduced
  motion, all three tiers, and clean browser console through the full game because
  `world.js` and chunk lifecycle do not run in isolation.
- [ ] 5.4 Run a long-travel and unload A/B capture; prove at most 12 added scene
  draws, marginal triangle deltas within the pinned per-tier caps, rebuild timing
  within the shared world-owned deadline or correctly sliced, stable geometry,
  texture, heap, and shader-program counts, unchanged registry/RNG truth, and no
  meaningful worst-frame or chunk-generation regression; watch the capture for
  periodic cold-recompute spikes from the worldgen plan cache's full-clear
  threshold, which the wider horizon query reaches sooner.
- [ ] 5.5 Resolve the promotion gate baseline-first: where task 1.5 recorded a
  flag-off baseline already over a tier's absolute HUD budget, that tier's gate
  is marginal delta plus no-regression plus explicit Gary sign-off (recorded in
  the session log); otherwise the absolute tier budgets stand. If every hard gate
  passes, enable the horizon by default while retaining `?farField=0` as the
  one-variable control and rerun 5.1-5.4; otherwise keep the default off, record
  the failed gate, and leave the ROADMAP item parked.

## 6. Documentation and change hygiene

- [ ] 6.1 Update `README.md`, `ARCHITECTURE.md`, `DEBUGGING.md`, and the relevant
  performance/pooling documentation with the shipped behavior, ownership model,
  inspection flow, and measured budgets.
- [ ] 6.2 Add the dated player-visible CHANGELOG entry and remove or narrow the
  completed ROADMAP bullet according to the promotion decision, preserving the
  deferred real-iPhone Wook Trip capture.
- [ ] 6.3 Refresh this change README and session status, verify no local server or
  task-created browser process remains, and audit exact task-created browser/GPU
  PIDs before handing off the uncommitted branch.
