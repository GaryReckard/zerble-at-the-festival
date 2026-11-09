# Deliberation Summary

## Context

- **Task**: Choose the next structural performance investigation from saved evidence, then define the experiments needed before selecting a production redesign.
- **Personas Consulted**: Architect, Profiler, Maverick + Mediator
- **Date**: 2026-11-07
- **Mode**: Tier 3 synthesis. All three Round 1 positions succeeded and were read; there was no Round 2.
- **Scope**: This artifact proposes experiments only. No production implementation, browser, server, test suite or benchmark was run by the mediator, consistent with [the briefing, line 44](briefing.md).

## Synthesized Plan

**TL/DR:** Test exact support reuse first, audit registry mutation ownership early, and give one eligible static family a matrix-only probe before adding batching. Choose a production path only after exact equivalence and ordinary delivered-frame comparisons pass; the current evidence permits conditional selection, including choosing no rewrite.

The first experiment is selected for its combination of measured opportunity and a narrow existing authority boundary, rather than a majority vote. Architect and Profiler prioritize support while Maverick prioritizes the registry's clearer discovery cost. Support already has a per-mover binding that can contain a reusable query context without transferring movement authority, whereas registry publication requires a complete account of mutable writers ([Architect, line 5](council-architect.md), [Profiler, line 38](council-profiler.md), [Maverick, line 38](council-maverick.md); `src/landscape/support.js:125-165`, `src/registry.js:305-333`). This resolves investigation order, not predicted savings.

### Change Group 1: Baseline identity and verification prerequisites

**Scope**: Define the experiment contract and build the smallest relevant equivalence surfaces before changing a mechanism.

**Estimated Effort**: One to two focused engineering sessions, excluding captures. This and later estimates are planning allowances, not measured durations.

**Tasks**:

1. **Freeze the exact current baseline.** The orchestrator should preserve the verified November 6 dirty terrain work and record source/build identity through the existing snapshot mechanism. Keep ordinary timing, diagnostic attribution and topology inventories separate, and declare primary parked/driving metrics, protected segments, meaningful benefit and fresh calibration/holdout rules before comparisons. Do not reuse the prior terrain experiment's 2 ms threshold automatically (`verification/performance/2026-11-07-structural-options/candidate-inventory.md:3-20`; `docs/performance-lab.md:28-44`; `verification/performance/2026-11-06-terrain-sampling/lattice-README.md:64-76`).
2. **Prepare narrowly scoped oracles and eligibility inventories.** Specify bounded support request/replay records; inventory registry position, footprint, collider/radius writers and their actual publication phases; audit one static family's transform ancestry, ownership, geometry/material identity, camera layers and render state. The registry census is an early diagnostic, not a second implementation. Reuse the current support algorithm, scan and ordinary meshes as the respective truth oracles, rather than building a generic new harness (`src/landscape/support.js:82-119`, `138-190`; `src/registry.js:305-345`; `src/people/childPresentation.js:35-54`; [Maverick, line 38](council-maverick.md)).
3. **Record protected contracts and future verification surfaces.** Preserve current clocks/barriers, RNG streams, synchronous gesture audio, Three 0.160.0 through the shim, lake independence, shared disposal and instance dirty flags. Preserve density, terrain detail, physics cadence, offscreen simulation and camera freedom. Use the current Vite/import workflow; the historical no-build/importmap text in config/protocol is superseded. No new dependency, navigation system, worker framework or entity framework is justified by this investigation (`AGENTS.md:86-114`; `ARCHITECTURE.md:973-1022`; `.claude/rules/no-build.md:3-28`; [briefing, line 31](briefing.md)).

**Exit condition**: The baseline, candidate eligibility, exact oracles and selection policy are written before a prototype is timed. This group is independently useful even if all candidates are rejected.

### Change Group 2: Sequential structural discriminators

**Scope**: Run isolated proofs against the same baseline, with one changed mechanism per experiment. These are bounded prototype tasks for the orchestrator, not approval for a production migration.

**Estimated Effort**: Two to four focused sessions for support and one eligible presentation family; allow a further one to two sessions only if registry publication advances. Failed feasibility checks should stop a branch early.

**Tasks**:

1. **Prove exact support reuse first.** Capture and replay actual pedestrian requests through the existing per-mover API, keeping mover order and accepted state unchanged. Compare every returned support field and published pose, including validity, traversability, block reason, selected surface, height, gradient/normal and heading. Cover rotated footprints, sweep/turn steps, triangle/cell boundaries, negative coordinates, grades, water, overlapping deck approaches, missing owners and replaced worlds. Start with reusable immutable query context that preserves arithmetic and sample order; skip geometric work only when a certificate proves the entire swept footprint has identical support and exclusion semantics. Report route-weighted hits, fallbacks, queries avoided, certificate/invalidation cost, cold cost, warm total cost and bounded retention. Reject any truth mismatch or a fast path whose validation/retention cost consumes its useful savings; a plane or endpoint alone is insufficient (`src/landscape/support.js:82-119`, `138-165`, `198-204`; [Profiler, line 50](council-profiler.md); [Architect, line 45](council-architect.md)).
2. **Test the simplest eligible static presentation mechanism.** If the audit finds a meaningful immutable family, compare explicit one-time world-transform publication plus invalidation against its unchanged ordinary objects. Preserve meshes, materials, layers, bounds, visibility, casters and parent-change behavior, and verify exact world matrices. This isolates redundant matrix evaluation; it does not remove projection or draw submission. Only if family-specific attribution still supports that second target should a separately isolated spatial-instance probe follow. Any batch must detach owner contributions and release only its own buffers while borrowing pools. Reject hidden transform writers, unsafe invalidation, duplicate retained traversal or higher submitted geometry/shadow work that defeats the gain ([Maverick, line 44](council-maverick.md), [Profiler, line 40](council-profiler.md); `src/people/childPresentation.js:23-25`, `69-114`).
3. **Advance explicit registry publication when the preferred paths are weak or ineligible.** Use the early writer census to decide whether a complete publication contract is practical. Keep the existing ordered grids and physical synchronization, immediate add/remove visibility and vehicle-before-spatial-before-adult barrier. First compare shadow publication with the current scan for ordered candidate queries, oversized ordering and exact pads; cover radius growth/shrink, threshold crossings, collider changes, removal before sync, removal of a maximum, owner transfer and unload/revisit. Unknown writers fail the gate. Then measure a separate scan-replacing probe, including all publication, aggregate maintenance and cleanup costs. A shadow implementation that still performs the scan cannot demonstrate runtime savings (`ARCHITECTURE.md:369-378`, `975-989`; `src/registry.js:305-350`; [Maverick, line 38](council-maverick.md); [Architect, line 47](council-architect.md)).
4. **Choose a provisional finalist without combining mechanisms.** The default order is support proof, then the eligible matrix-only competitor, then registry if neither earns advancement. If support fails and the static audit finds no useful family, move directly to registry; do not build a token rendering prototype. Compare net eligible work rather than inclusive profile totals. If multiple candidates remain credible and their delivered-frame ranking is unknown, use separate ordinary baseline-versus-candidate pilots under the frozen policy to choose which receives full captures. A passing microbenchmark selects a timing candidate, not a production winner. If all branches fail, recommend no restructuring ([Architect, lines 45-49](council-architect.md); [Profiler, lines 50-54](council-profiler.md); [Maverick, lines 38-42](council-maverick.md)).

**Exit condition**: There is one provisional finalist, a documented need for a discriminating ordinary comparison, or an explicit no-rewrite result. No combined support/registry/rendering patch should obscure causality.

### Change Group 3: Integration, budget and delivered-frame gates

**Scope**: Establish whether a feasible mechanism benefits the running game without weakening protected behavior.

**Estimated Effort**: One focused integration session plus orchestrator-owned calibrated capture windows. Capture duration depends on valid runs and current calibration.

**Tasks**:

1. **Pass the affected sandbox and real-game paths.** For any later code prototype, run `npm run check` and `npm run build`, exercise the smallest relevant surface, then smoke the real ready title, gesture start, world boot and console. Use the support replay and full game for movement/publication; use a relevant entity or hub surface for presentation and then full-game streaming. Check all three camera modes, manual camera movement, Noon/Midnight, Low/Mid startup and unload/reload. A scripted start cannot verify synchronous iOS unlock, and desktop evidence cannot close physical-device acceptance (`AGENTS.md:35-70`; `docs/performance-lab.md:9`; [Profiler, lines 52-62](council-profiler.md)).
2. **Measure budgets and lifetimes against the baseline.** Read the backtick panel and record actual scene draws/triangles, shadow submissions, buffer uploads, construction cost and retained resources separately. Keep Low 80 draws/150k triangles, Mid 200/400k and High 400/1.2M as constraints to check, while documenting baseline headroom rather than assuming the current scene fits. Support/registry target zero geometry delta; presentation has an unknown submitted-work delta until measured. Require clean owner detachment, no disposal of shared pools and correct instance dirty flags. HUD counts are not device-speed evidence (`src/debug.js:35-46`; `AGENTS.md:66-70`, `102-114`; [Profiler, lines 30-34](council-profiler.md)).
3. **Run controlled ordinary-timing comparisons for the finalist.** Use independent paired baseline/candidate runs for parked and driving Low/High, then verify Mid's shadow-bearing behavior. Preserve source/build identity, equal content and quality, acknowledged payloads, fresh calibration/holdouts and protected route segments; collect p95/p99, stalls and frame delivery without diagnostic-profile overhead. Promote another surviving candidate only if the finalist fails or a separately evidenced challenger warrants comparison. Preserve no-detectable-change and invalid outcomes rather than rescuing them with a new route or threshold (`docs/performance-lab.md:28-44`, `59-71`; [Profiler, line 54](council-profiler.md)).
4. **Apply the production decision gate and attribute remaining tails separately.** Select a restructuring only if it clears equivalence, lifecycle/budget checks and the predeclared meaningful delivered-frame objective without protected regressions. Report an operation/work improvement without delivered-frame improvement as CPU headroom, and seek an explicit headroom objective before recommending its maintenance burden. If none earns that burden, choose no rewrite. Promote cancellable construction only when exact-frame diagnostics tie stalls to a builder, and promote child solving or compact poses only with mechanism-specific evidence. Incremental ground remains low priority unless new attribution overturns its small target (`verification/performance/2026-11-06-terrain-sampling/lattice-README.md:64-84`; `verification/performance/2026-11-07-structural-options/candidate-inventory.md:29-40`; [Maverick, line 42](council-maverick.md)).

**Exit condition**: A production candidate has earned its recommendation, or the report clearly says that no candidate did. A desktop result remains separate from Auto, physical-iPad Safari and subjective-feel acceptance.

### Change Group 4: Evidence handoff and documentation

**Scope**: Persist the selection, limitations and only the implementation plan justified by the results.

**Estimated Effort**: One focused documentation session.

**Tasks**:

1. **Publish an auditable experiment report.** Retain source manifests, eligibility counts, oracle mismatches, abandoned probes, raw comparisons, costs and exact limitations, including unavailable GPU timings. Record the narrower CPU-headroom outcome when appropriate and preserve negative results (`docs/performance-lab.md:30-44`, `73-81`; `verification/performance/2026-11-06-terrain-sampling/lattice-README.md:64-84`).
2. **Plan the selected production change only after the gate.** Update the active change's proposal/design/tasks around the winning mechanism and its actual owner/publication contract, or record the no-rewrite decision. Do not expand this into all seven candidates, reopen existing instancing/caching as new work or infer device acceptance from fixed desktop runs ([briefing, line 5](briefing.md); `verification/performance/2026-11-07-structural-options/candidate-inventory.md:34-42`; `docs/performance-lab.md:9`).
3. **Update shipped documentation with the eventual implementation.** Any user-visible performance or workflow change needs a same-commit CHANGELOG entry under the actual date and an accurate ROADMAP adjustment; architecture and verification notes must describe the final publication/lifetime contract and outstanding device acceptance. This deliberation alone does not claim a shipped optimization (`AGENTS.md:133-141`; `docs/README.md:16-23`).

**Exit condition**: The report and implementation handoff agree about what was measured, what won and what remains unaccepted. Groups 1 and 4 can ship independently as documentation; Groups 2 and 3 are experiment stages and do not imply a release.

## Final Recommendation

Proceed with mitigations, beginning with the exact-support discriminator and early registry writer census, followed by the eligible matrix-only competitor. Current evidence selects an investigation order only; the winner must earn production planning through exact equivalence and calibrated delivered-frame evidence, and choosing no rewrite remains a valid outcome.

---

## Convergence Points

- All three recommend bounded experiments before production selection, protect festival content and ownership, and retain no rewrite as an acceptable result ([Architect, lines 43-55](council-architect.md), [Profiler, lines 48-68](council-profiler.md), [Maverick, lines 36-42](council-maverick.md)).
- All distinguish overlapping sampled attribution from actual savings and reject treating the unculled topology inventory as submitted draws ([Architect, lines 31-33](council-architect.md), [Profiler, lines 8-10](council-profiler.md), [Maverick, lines 14-20](council-maverick.md)).
- The synthesis retains existing incremental registry membership, immediate-move validation savings and child instancing as the baseline rather than proposing them as new work (`verification/performance/2026-11-07-structural-options/candidate-inventory.md:27-40`; [Architect, line 23](council-architect.md), [Profiler, lines 38-46](council-profiler.md), [Maverick, lines 18-22](council-maverick.md)).
- All require a real-game timing gate and preserve the prior terrain experiment's primary no-detectable-change verdict despite reduced work ([Architect, line 43](council-architect.md), [Profiler, line 54](council-profiler.md), [Maverick, line 40](council-maverick.md)).

## Conflicts Resolved

| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Which structural proof comes first? | Architect and Profiler place exact support first and registry behind support/static presentation ([Architect, lines 5-7](council-architect.md), [Profiler, lines 7-11](council-profiler.md)). | Maverick places explicit registry publication first for its clear cross-tier discovery cost ([Maverick, lines 7-9](council-maverick.md), [Maverick, line 38](council-maverick.md)). | Run support first, move the registry writer census into prerequisites, and advance registry directly if support fails and static eligibility is weak. | The support binding contains a proof without moving authority, while the writer census addresses Maverick's strongest concern without paying for two runtime rewrites. Unknown writers remain a correctness blocker (`src/landscape/support.js:125-165`; `src/registry.js:305-333`). |
| Which rendering mechanism deserves the first prototype? | Architect and Profiler propose one-family static islands/spatial batching, and Profiler distinguishes matrix savings from projection/submission ([Architect, line 46](council-architect.md), [Profiler, line 40](council-profiler.md)). | Maverick explicitly tests matrix publication before changing mesh submission ([Maverick, lines 44-52](council-maverick.md)). | Start matrix-only on one audited family; batch only as a separate experiment when eligible projection/submission attribution justifies it. | This isolates mechanisms and uses the simpler implementation first without assuming frozen matrices eliminate renderer traversal. Camera/shadow and detach obligations remain mandatory (`src/people/childPresentation.js:69-114`). |

For capture scheduling, Profiler permits promoting a demonstrably better static competitor while Architect reserves full captures for the discriminator’s winner. Isolated ordinary pilots can nominate a finalist when feasibility evidence cannot distinguish contenders, but final acceptance still requires calibrated captures ([Profiler, lines 52-54](council-profiler.md), [Architect, line 49](council-architect.md); `docs/performance-lab.md:36-44`).

The verdicts do not conflict: all three say **Proceed with mitigations**. The smaller ordering difference between compact child poses and cancellable construction does not affect the selected path; both remain conditional on mechanism-specific evidence ([Architect, lines 34-37](council-architect.md), [Profiler, lines 44-46](council-profiler.md), [Maverick, lines 21-24](council-maverick.md)).

## Risk Register

| Risk | Severity | Mitigation | Owner (persona that flagged it) |
| --- | --- | --- | --- |
| A region cache proves height but changes water/deck/footprint support truth. | Critical | Compare complete outputs and accepted poses, retain sample arithmetic/order, validate generations and fall back at uncertified boundaries (`src/landscape/support.js:82-119`, `138-165`). | Architect; Profiler; Maverick |
| Explicit publication misses a mutable writer, query-pad shrink or ordered candidate transition. | High | Complete the writer census, shadow exact ordered queries/aggregates, preserve immediate mutations and the current spatial barrier (`src/registry.js:305-350`; `ARCHITECTURE.md:369-378`, `975-989`). | Architect; Profiler; Maverick |
| A static flag leaves stale descendant/parent transforms. | High | Require one actually immutable family, exact matrix checks and explicit invalidation before timing ([Maverick, lines 46-51](council-maverick.md)). | Maverick |
| Batching raises submitted triangles/shadow work or takes ownership of gameplay resources. | High | Measure per-pass work and detachment; keep simulation ownership and pooled resources with their existing owners (`src/people/childPresentation.js:23-25`, `87-114`; `ARCHITECTURE.md:215-222`). | Architect; Profiler |
| Lower subsystem work produces no meaningful frame-delivery gain. | High | Use fresh ordinary paired comparisons; report headroom separately and choose no rewrite if maintenance is unjustified (`verification/performance/2026-11-06-terrain-sampling/lattice-README.md:64-84`). | Architect; Profiler; Maverick |
| Cumulative construction attribution hides a rare stall, or staging exposes partial truth. | High | Correlate exact frames before promoting construction and preserve completed-content publication ([Architect, line 17](council-architect.md), [Profiler, line 45](council-profiler.md); `verification/performance/2026-11-07-structural-options/candidate-inventory.md:18-20`, `30`). | Architect; Profiler; Maverick |
| Desktop fixed-tier evidence is generalized to Auto or physical phones. | High | State the tested platform/tier and retain separate device/Auto acceptance (`docs/performance-lab.md:9`; [Profiler, line 62](council-profiler.md)). | Profiler; Maverick |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | A faster representation must not take authority over support truth, lifecycle or frame publication order ([position, lines 53-55](council-architect.md)). | Proceed with mitigations; support first, static competitor, registry fallback. |
| Profiler | CPU reductions may fail to improve frames or may regress GPU work, while support reuse must preserve complete truth ([position, lines 66-68](council-profiler.md)). | Proceed with mitigations; support first, bounded static competitor, calibrated selection. |
| Maverick | Large attribution or cleaner ownership can still yield no player-visible improvement ([position, lines 56-58](council-maverick.md)). | Proceed with mitigations; registry first, support next, no production selection without ordinary timing. |
