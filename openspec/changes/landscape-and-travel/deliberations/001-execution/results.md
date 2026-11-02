# Deliberation Summary

## Context

- **Task**: Review landscape-and-travel execution ordering, bounded first-proof implementation and concrete feature closure gates.
- **Personas Consulted**: Architect, Adversary, Profiler + Mediator
- **Date**: 2026-11-01
- **Mode**: Synthesis; all three completed positions recommend proceeding with mitigations.

TL/DR: Proceed with the pure support contract after recording explicit transition and failure semantics, then build the bounded authored proof through the existing sandbox with its smallest necessary cart adapter. Preserve the complete feature tasks and their later acceptance gates, while correcting the dropped-prop dependency so those gates can actually close.

**Closure status:** The orchestrator incorporated the first-slice contract, binding ownership, numeric geometry ceilings, selected-layer rays, actual controller-rate inputs and narrow prop-adapter ordering while synthesis was underway (`../../design.md:62–72`; `../../tasks.md:26–28,73`). These planning corrections are satisfied; their implementation and measured acceptance remain pending. No further product decision or production/device prerequisite blocks the first proof.

References to `tasks.md`, `design.md` and `evidence.md` mean the files in this change. Position references are local to this deliberation. The four Change Groups below organize execution; their numbers do not replace the nine implementation groups in `../../tasks.md`.

Current `AGENTS.md:93–119` and `.claude/rules/no-build.md:15–27` override the stale no-build/importmap passages in OpenSpec configuration and council templates. Use Vite and ordinary imports. All other applicable tripwires remain: independent new RNG streams, shim-mediated Three.js policy, synchronous gesture audio, lake ownership, shared-resource safety, instance flags, deliberate shadows and actual game boot (`AGENTS.md:93–119`; `council-adversary.md:25–31`).

## Synthesized Plan

### Change Group 1: Baseline and blocking first-slice corrections

**Scope**: Complete implementation Tasks 1.1 (integration baseline) and 1.2 (first-proof semantics), and make the later proof ownership/dependencies explicit before coding depends on them.
**Estimated Effort**: One focused sitting, including the baseline commands; estimates are planning judgments rather than measured delivery times.
**Tasks**:
1. Record the current terrain/collision/physics/boot boundaries and successful baseline check/build, preserve concurrent edits, and capture existing sandbox counters and construction timing under declared viewport, camera, tier and time-of-day conditions. Counter capture is required before fixture comparison, but need not delay independent pure contracts (`council-architect.md:5,27`; `council-profiler.md:7,32`).
2. **Blocking before support implementation:** Specify immutable sampling of a selected layer, a separate transition proposal, and commit only when the mover pose is accepted. Define footprint behavior across a declared terrain/deck approach, initial terrain acquisition, invalid/deleted occupied support, retained legal pose and explicit reset/reacquisition. A blocked occupied deck cannot silently fall back to terrain at the same X/Z (`council-architect.md:13–15`; `council-adversary.md:15`).
3. **Blocking before authored integration:** Assign the minimal opt-in support-state binding and necessary cart/controller hooks to implementation Task 3.2 (landscape sandbox integration), including explicit file ownership. Retain whole-footprint travel enforcement and live contact publication under implementation Group 4 (authoritative travel), and preserve Gary's grounding/suspension corrections (`council-architect.md:13`; `council-adversary.md:17`).
4. Preserve the incorporated downstream correction: implementation Task 7.4 (functional stream crossing) uses a narrow representative-prop surface/solid adapter dependent on the pure contracts and authored geometry, while Task 8.4 (physical-prop surface adapter) retains full production ownership/migration. Verify the narrow adapter against actual shared crossing geometry rather than a separate plane, and leave the crossing gate unchecked until it passes (`council-adversary.md:23`; `../../design.md:72`; `../../tasks.md:73`).

### Change Group 2: Pure contracts and bounded authored cart proof

**Scope**: Implement existing Groups 2 (support/solid contracts) and 3 (authored engineering proof), retaining the live generation baseline and existing sandbox modes.
**Estimated Effort**: Several focused sittings; the pure contract can ship independently before the geometry proof.
**Tasks**:
1. Implement renderer-independent validated immutable support descriptors, bounded queries, caller-owned scratch/output and independent mover state, together with solid vertical-interval eligibility that does not exempt different support IDs. Test repeat-query immutability, transition entry/exit, closed edges, incompatible elevation, invalid inputs, independent movers, rejected proposals and permuted wheel probe order. Keep descriptor construction/validation out of repeated sampling, while validating finite query inputs (`council-architect.md:6,15`; `council-adversary.md:15`; `council-profiler.md:8,18`).
2. **Blocking before mesh construction:** Record concrete X/Z bounds, local segment counts, terrain/deck/water triangle ceilings and intended render batches in Task 3.1 (authored geometry) or Task 1.2 (proof defaults). Compare the replacement delta against the declared baseline; a one-meter W-by-H-cell terrain alone costs 2WH triangles before decks/water. Do not infer available headroom or device FPS from that arithmetic (`council-profiler.md:17,25–28,32`).
3. Build the two shelves, bank, side ascent, descending clearing and cut stream/bridge from one exact local geometry source consumed by mesh and support sampling. Extend `surface=landscape` through the existing terrain sandbox and real cart, with deterministic deck/underneath jump points and selected-support diagnostics, while preserving course/world modes and the game import boundary. Do not add another render loop, globally refine terrain, migrate every consumer or claim this unpopulated fixture is a complete district (`council-architect.md:7,21`; `council-adversary.md:9,31`; `council-profiler.md:9,25`; `../../tasks.md:24–31`).
4. **Blocking before authored proof acceptance:** Make ray checks select the expected surface's actual mesh, independently test deck and terrain at overlapping X/Z, and restore support state with saved cart state. Invoke the real controller with complete finite inputs at 1/30, 1/60 and 1/120; the existing 1/120 loop does not establish those rate cases. Keep exhaustive rays behind the verification control, and label the first bank result as its actual center/transition proof rather than full-footprint barrier acceptance (`council-adversary.md:17–19`; `council-profiler.md:9`).

### Change Group 3: Quality gates and complete production progression

**Scope**: Accept the first slice, then execute all remaining feature groups through explicit downstream gates; these gates do not block the initial pure contract.
**Estimated Effort**: One first-proof verification sitting followed by staged integration across implementation Groups 4–9; production/device duration remains evidence-dependent.
**Tasks**:
1. Close Task 3.4 (proof verification) with Noon/Midnight and Low/Mid captures, draw/triangle and construction comparisons, focused regressions, full check/build, and a real ready-title-gesture boot followed by console inspection. Report baseline overruns separately from this change's delta; Low 80 draws/150k triangles, Mid 200/400k and High 400/1.2M remain the budget guides. Preserve bounded browser commands, teardown and cleanup; muted boot evidence does not verify audible iOS unlock (`council-profiler.md:26–28,36`; `council-adversary.md:29`; `AGENTS.md:56–89`; `../../tasks.md:29`).
2. Complete implementation Group 4 (authoritative travel) before occupied admission: full-width corridors/joins/swept turns, every relocation/collision correction, recoverable barriers and interrupted-frame regressions. Exercise real registry publication through candidate projection to the resolver so vertical metadata survives, absent metadata retains legacy behavior, below-deck contacts are excluded, spanning solids hit and ordered first-hit behavior remains unchanged (`council-architect.md:8,19`; `council-adversary.md:31`; `../../tasks.md:33–42`).
3. Complete implementation Group 5 (populated district) through real camp/drum and activity builders, with a canonical owner and separately pinned support dependencies. Stage side effects or keep an explicit release ledger because registry mutations are not transactional; inject partial-build failure and prove no scene/registry/audio/animation residue after retry. Verify opposite-direction revisit, occupied support release, resource disposal and bounded residency. Measure largest indivisible planning/build step, first upload/render and retained resources before replication; split preparation when necessary while keeping publication complete and collision truth synchronous (`council-architect.md:17`; `council-adversary.md:21`; `council-profiler.md:19–21,34`; `../../tasks.md:44–54`).
4. Complete implementation Groups 6 (bounded procedural admission) and 7 (water systems): record the acyclic raw-candidate → accepted grading → final shared geometry dependency, independent salts/versioned expectations and finite admission controls before expansion. Retain complete source-to-receiver stream ownership, compatible water levels, cut channels and feasible bridge approaches; close representative dropped-prop acceptance through the narrow shared-surface adapter before calling the crossing complete (`council-architect.md:21`; `council-adversary.md:23,27`; `../../tasks.md:56–75`).
5. Complete implementation Groups 8 (consumer migration/performance) and 9 (release): retain the full world/streaming/far-field/map, vehicle, people/activity and physical-prop audits, fixed-condition cold/warm moving/parked measurements, intentional version rollout and progression compatibility. Leave physical iPhone/iPad frame delivery and unprompted player-recognition/route-choice acceptance unchecked until observed. The plain sandbox renderer cannot establish production composer or phone cost (`council-architect.md:9`; `council-profiler.md:11,27–28,36`; `../../tasks.md:77–94`; `../../design.md:86–92`).

### Change Group 4: Evidence, polish and durable completion

**Scope**: Keep shipped behavior, outstanding gates and future sessions aligned with the complete implementation plan.
**Estimated Effort**: A short evidence/documentation pass per shipped slice and a final release pass.
**Tasks**:
1. Update design/tasks/evidence and the session handoff with concrete numerical hypotheses, measured tolerances, exact completed checkboxes and localized failure actions. Record this deliberation's corrections before code relies on them; preserve every downstream feature task rather than treating the first proof as completion (`../../tasks.md:98–103`; `council-adversary.md:11,37`; `council-profiler.md:36`).
2. Update CHANGELOG in the same commit as observable development/gameplay changes, trim only shipped ROADMAP scope, and update architecture/debug/specs/README at the appropriate integration or release boundary. Keep Barn and first aid as future work and retain the warm festival copy and hidden-mechanic constraints (`AGENTS.md:131–145`; `../../tasks.md:29,94`).

## Final Recommendation

**Proceed with mitigations.** The required planning corrections are incorporated, so start the baseline and pure contract without waiting for production ownership or device acceptance. Enforce the declared fixture size/cost limits during geometry construction and require complete-owner lifecycle/cost evidence before procedural replication; retain every remaining feature and release task as an explicit gate.

---

## Convergence Points

- All three prioritize baseline → pure contracts → existing-sandbox authored proof → authoritative travel → complete owner → procedural/consumer rollout, and all three give the same mitigated proceed verdict (`council-architect.md:5–9,25–27`; `council-adversary.md:7–11,35–37`; `council-profiler.md:7–11,40–42`).
- All favor the smallest useful first slice while preserving complete later ownership, consumer and device gates, so there is no genuine verdict conflict to manufacture (`council-architect.md:27`; `council-adversary.md:37`; `council-profiler.md:42`).
- All keep the live generation baseline intact and prefer existing verification surfaces and local shared geometry over a broad runtime rewrite (`council-architect.md:7,21,27`; `council-adversary.md:8–9,27`; `council-profiler.md:9,25`).

## Conflicts Resolved

These are actual gaps between advocated execution and the task/proof dependencies they expose, not opposing persona verdicts.

| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Start pure work promptly versus unresolved layer failure/transition semantics. | Architect supports immediate pure work but requires explicit blocked occupied-support behavior (`council-architect.md:5–6,15`). | Adversary explicitly blocks support implementation until observation/proposal/commit and straddling behavior are specified (`council-adversary.md:15`). | Resolve these local semantics in Task 1.2 (first-proof semantics), then begin pure implementation. | The timing difference is small; correctness takes precedence without requiring later production systems first. |
| Real-cart authored proof is scheduled before explicit runtime-adapter ownership. | Architect wants the smallest opt-in binding while keeping later migration separate (`council-architect.md:7,13`). | Adversary identifies Group 3's missing cart/controller ownership and the risk of overstating its center-only bank check (`council-adversary.md:17`). | Assign minimal hooks to Task 3.2 (landscape sandbox integration); retain whole-footprint enforcement under Group 4 (authoritative travel). | This repairs a real prerequisite without widening the first proof into full migration. |
| An existing harness can verify the proof only after its checks become layer/rate aware. | Architect favors one geometry source and the existing sandbox (`council-architect.md:7`). | Adversary shows top-down first-hit rays and a fixed 1/120 update cannot certify underlying terrain or three controller rates; Profiler rejects continuous exhaustive rays (`council-adversary.md:19`; `council-profiler.md:9`). | Use selected-mesh independent verification, support-state restore and actual rate-specific controller inputs behind the existing verification control. | Reuse remains valuable only when the resulting evidence proves the claimed behavior. |
| Complete/atomic publication can still cause a long indivisible streaming build. | Architect requires staging/rollback around nontransactional registry effects (`council-architect.md:17`). | Profiler warns finite admission does not bound synchronous build/upload time (`council-profiler.md:19,34`). | Measure the first owner, split preparation if needed and publish only the complete usable owner with rollback. | Publication correctness and bounded preparation are compatible; neither substitutes for the other. |
| Complete crossing acceptance asks for props before its downstream prop adapter. | Architect/Profiler retain crossings before complete consumer migration (`council-architect.md:9`; `council-profiler.md:11`). | Adversary identifies the concrete Task 7.4/8.4 dependency cycle (`council-adversary.md:23`). | Use the incorporated narrow representative-prop adapter against shared crossing geometry; retain full production migration later (`../../design.md:72`; `../../tasks.md:73`). | The feature remains complete without using a separate physics-plane fixture as production evidence. |

## Risk Register

| Risk | Severity | Mitigation | Owner (persona that flagged it) |
| --- | --- | --- | --- |
| Wheel/prospective queries mutate support, or invalid occupied support drops to terrain. | High | Explicit nonmutating observation/proposal/commit contract; blocked-result, rejected-pose and probe-order regressions before adapter work (`council-architect.md:13–15`; `council-adversary.md:15`). | Architect, Adversary |
| Harness certifies the wrong layer or wrong controller input rate. | High | Expected-mesh rays at overlapping X/Z, support-state save/restore and real 30/60/120 Hz inputs (`council-adversary.md:19`). | Adversary |
| Fixture refinement or runtime support lookup creates unbounded cost. | High | Finite fixture inventory, bounded lookup, caller-owned scratch, no repeated descriptor planning and verification-only exhaustive rays (`council-profiler.md:17–18,32`). | Profiler |
| Pure contact tests pass while live publication drops vertical metadata. | High | Test publication through adapters/resolver, legacy defaults and first-hit order before production bridge admission (`council-architect.md:19`). | Architect |
| Partial district build leaks effects, or occupied support/pools are released incorrectly. | High | Canonical owner, rollback ledger, injected failure, bidirectional revisit, pin-release and shared-resource checks before replication (`council-architect.md:17`; `council-adversary.md:21`; `council-profiler.md:20–21`). | Architect, Adversary, Profiler |
| Complete owner blocks a streaming frame despite admission limits. | High | Measure largest indivisible step/upload, split preparation and retain complete publication (`council-profiler.md:19,34`). | Profiler |
| Final terrain feeds back into candidate planning. | High | Document and test raw-candidate/accepted-grading/final-geometry direction before procedural admission (`council-architect.md:21`). | Architect |
| Prop acceptance closes against an unrelated physics plane. | Medium | Correct crossing/adapter ordering and require real shared geometry/version/owner integration (`council-adversary.md:23`). | Adversary |
| Desktop sandbox counters are treated as phone or production performance evidence. | High | Separate first-proof budgets from full-game cold/warm measurements and observed physical-device release gates (`council-profiler.md:26–28,36`; `council-adversary.md:29`). | Profiler, Adversary |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | Support selection must not mutate mover state during prospective movement, probes or presentation (`council-architect.md:26`). | Proceed with mitigations |
| Adversary | Repeated probes must neither mutate support nor certify a different occupied layer (`council-adversary.md:36`). | Proceed with mitigations |
| Profiler | Finite plans and complete owners do not bound synchronous build or replicated residency cost (`council-profiler.md:41`). | Proceed with mitigations |
