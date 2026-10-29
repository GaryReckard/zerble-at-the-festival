# Deliberation Summary

## Context

- **Task:** Implement the confirmed discovery-based festival minimap and live expanded view.
- **Personas Consulted:** Architect, Profiler, Adversary, and Mediator.
- **Date:** 2026-10-29.
- **Mode:** Tier 3 synthesis; all three independent positions were received, with no Round 2.
- **Authority:** Current `AGENTS.md` Vite instructions supersede historical no-build/importmap instructions. Gary’s confirmed live-driving, centered/no-pan, discovery, and nearby-only decisions remain unchanged.

## Synthesized Plan

### Change Group 1: Harness and world-identity contracts

**Scope:** Testable data foundations and optional service startup.
**Estimated Effort:** One focused foundation slice, with measurements determining tile sizing.
**Tasks:**
1. Build the lightweight harness first and add it to the Vite page list. Exercise production relative-base worker loading as well as development loading. Use plain map metadata without scene-object retention.
2. Initialize the worker with the canonical numeric session seed, world mode, durable layout/schema version, relevant configuration, and a request-generation token. Reject incompatible results. Keep runtime invalidation epochs separate from durable compatibility versions. In legacy v1 mode, disable the unsupported v2 geographic background explicitly and namespace any retained observations separately.
3. Establish bounded discovery-block residency and atomic persistence union/reset contracts before rendering. Fence delayed reads/writes and disposal callbacks, test concurrent tabs, and load only needed spatial blocks. Same-seed restores do not alter the existing fresh-random-seed behavior of ordinary new loads. Define explicit storage-failure behavior rather than promising unlimited session-only history in bounded RAM.
4. Prove a bounded cold tile and instrument worker duration, response size, pending work, main-thread commit/raster time, retained caches, backing pixels, and persistence backlog. Worker construction/import/error/messageerror/timeout failures must degrade the optional geography service without blocking boot/audio or falling back to main-thread generation.

### Change Group 2: Bounded map and live-game integration

**Scope:** Geographic rendering, visibility, navigation, and preserved driving.
**Estimated Effort:** Two implementation slices: geography/model followed by input/view integration.
**Tasks:**
1. Choose tile sizes/zoom buckets so the complete visible working set plus movement margin fits the cache budget. Bound query extent, samples/features/bytes, unsent desired tiles, one active request, stale-result handling, and result rasterization. Stop admissions when UI rendering is hidden/suspended; consider worker recycling only if measured long-run generator caches require it.
2. Draw cached geography with a separate discovery mask. Keep woodland sampling coarse and bounded. Update the cart/selected-pin overlay each rendered frame and less-critical markers at a capped cadence. Avoid canvas backing reallocations throughout CSS expansion and zoom animation.
3. Remember actual discovered static landmarks as plain stable metadata, with namespace/owning cluster/descriptor/child discriminators or another tested deterministic geographic identity. Runtime registry IDs are temporary links. Observe nearby Lurleen, Nutwagon, jugs, and star from current owners; remove stale live markers/tracking, and keep explicit objective pins independent of loaded chunks and geographic disclosure.
4. Integrate one central tick/reveal lifecycle with compact, expanded, hidden, suspended, and disposed states. Expanded remains live and centered with zoom only. Preserve held driving touches and keys; map pinch uses only map-owned touches. Separate map/music actions including touch music, and suppress gameplay Space activation from focused map buttons. Hidden rendering does not stop accepted-gameplay discovery.

### Change Group 3: Correctness and measured quality gates

**Scope:** Regression coverage, browser integration, and performance evidence.
**Estimated Effort:** One verification slice plus representative-device acceptance.
**Tasks:**
1. Test negative-cell boundaries, segment reveal/teleport discontinuities, same-seed restoration, world/epoch changes, delayed storage results, reset-during-flush, concurrent unions, quota failure, and bounded residency. Test unknown-area objective pins without terrain, stable unloaded landmarks, missing selected actors, and distance-scaled boundary bearings.
2. Exercise held throttle through open/zoom/select/close/cancel/orientation changes, separate touch music, keyboard focus, reduced motion, resize, repeated transitions, visibility suspension, and BFCache restoration. Run `npm run check`, `npm run build`, and the real title-card/start/console path on Low/Medium/High; capture Noon and Midnight and inspect scene draw/triangle counters for unexpected changes.
3. Compare identical seed/location/tier baselines against compact, expanded, hidden, reveal/cache rebuild, maximum zoom-out, and rapid zoom reversal. Report worker work, main-thread commit/draw/persistence, total frame distributions, cache/queue counts, and hardware separately. Provisional gates are map-owned steady main-thread work below 1 ms p95, bounded commit/raster units below 4 ms, no map-originated tasks above 50 ms, and no sustained fixed-area cache/backlog growth. These require actual measurement and are not universal or already achieved device claims.

### Change Group 4: Functional polish and durable records

**Scope:** Clear controls and honest acceptance state.
**Estimated Effort:** One documentation/tuning pass after functional verification.
**Tasks:**
1. Tune readable fog, icons, pin distance scaling, translucency, compact placement, label density, and independently capped Canvas resolution across tiers. Keep detection ranges and useful information equal. Preserve visible mobile driving controls and accessible map controls.
2. Update player help for M map/J music, saved compact visibility, discovery-reset and storage status, and same-festival persistence semantics. Record shipped behavior in CHANGELOG/ROADMAP and architecture/debugging references; leave unmeasured device acceptance explicitly pending rather than marking it passed from a harness.

## Final Recommendation

**Proceed with mitigations.** The plan’s separation of geography, exploration, live objects, and objectives is appropriate, and it requires no change to seeded generation, Three.js resources, or synchronous audio initialization. Incorporate these contracts into design/tasks before their dependent integration stages, then begin harness-first work; no additional product approval is needed for the confirmed behavior or recorded initial defaults.

---

## Convergence Points

- All three reviewers favor a pure-data worker with exact world identity and no synchronous fallback into the gameplay thread.
- A cache budget must bound the whole visible working set and underlying work, not merely an individual request or map-owned container.
- Actual world observations, durable geographic identities, and explicit mission exceptions have separate ownership.
- Live map browsing must preserve driving, touch ownership, and existing audio startup.
- Harness correctness, a real game boot, and device measurements establish different kinds of evidence.

## Conflicts Resolved

No reviewers gave opposing verdicts. The conflicts are between design promises and implementation constraints that their positions jointly expose.

| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Fixed cache versus expanded coverage | Profiler requires the visible working set to fit the cache | Architect requires centered useful coverage and bounded services | Choose bounded zoom buckets/tile sizes before view integration and retain a movement margin | Prevents repeated eviction/regeneration while preserving confirmed zoom behavior |
| Suspended UI versus continuing simulation | Architect separates lifecycle states | Adversary notes hidden gameplay ticks still move the player | Discovery follows accepted game ticks; only rendering/query admissions suspend | UI visibility cannot silently erase the driven path |
| Bounded memory versus session-only fallback | Architect requires bounded local residency | Adversary rejects silent eviction of unsaved discoveries | Specify degraded-storage retention limits and status explicitly, and gate acceptance on them | Unlimited durable history cannot be promised when storage is unavailable and RAM is capped |
| Worker isolation versus overall performance | Architect supports worker separation | Profiler requires bounds on cloning/raster/compositing and duplicated caches | Measure worker and gameplay-thread cost separately with payload/cache/admission caps | Off-thread work remains CPU and memory work |
| Persistent exploration versus fresh random worlds | Architect and Adversary flag existing seed behavior | The design promises cross-session same-seed persistence | Retain per-world history without changing world-resume policy; explain and test the same-seed path | Avoids an incidental gameplay-policy change |

## Risk Register

| Risk | Severity | Mitigation | Owner |
| --- | --- | --- | --- |
| Wrong seed/config/world-mode geography | High | Exact numeric handshake, durable namespace, stale-result fencing, legacy policy | Architect / Adversary |
| Optional worker failure blocks game startup | High | Isolated constructor/error/messageerror/timeout handling and no sync fallback | Adversary |
| Visible working set exceeds cache or response budget | High | Zoom-aware tile bounds, payload limits, desired-set admission, separate commit metrics | Profiler |
| Expanded input steals driving or touch music | High | Explicit action/touch ownership and held-input interaction tests | Adversary |
| Reset/late-load/concurrent writes corrupt discovery | High | Atomic unions, reset epochs, stale completion guards, race fixtures | Architect / Adversary |
| Storage failure silently loses unsaved exploration | High | Explicit bounded degraded-mode retention/status policy and failure tests | Adversary |
| Canvas compositing and worker caches consume headroom | Medium | Pixel cap, no blur, bounded queues, long-run cache and real-device measurements | Profiler |
| BFCache restoration duplicates or loses map behavior | Medium | Suspension versus final disposal, central tick integration and restore tests | Architect / Adversary |
| Planned POIs or runtime IDs produce fictional destinations | Medium | Actual built observations with deterministic plain identities | Architect |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | Worker, persistence and scene must agree on world identity without scene ownership | Proceed with mitigations |
| Profiler | Worker isolation alone does not bound visible tiles, response processing, or sustained CPU | Proceed with mitigations |
| Adversary | Optional map work must not control game boot, audio, input, or world truth | Proceed with mitigations |

## Evidence

This synthesis incorporates the verified citations in [Architect](council-architect.md), [Profiler](council-profiler.md), and [Adversary](council-adversary.md), together with the change [design](../../design.md), [tasks](../../tasks.md), and [capability requirements](../../specs/festival-map/spec.md). It is a planning verdict, not runtime acceptance.
