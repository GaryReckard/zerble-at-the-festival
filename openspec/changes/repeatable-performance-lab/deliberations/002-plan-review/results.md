# Deliberation Summary

## Context

- **Task**: Review the completed `repeatable-performance-lab` plan before implementation, using Tier 3 synthesis mode with no Round 2.
- **Personas Consulted**: Anthropologist, Pragmatist, Auditor, and Mediator.
- **Date**: 2026-11-03
- **Recommendation**: Proceed with mitigations. Retain the scope and acceptance contract, and refine the delivery dependencies before implementation.

**TL/DR:** The plan provides a coherent first milestone, but its first parked capture needs the exclusive-input protection currently scheduled with driving. Clarify safe first-launch supervision, move the existing integration checks ahead of measurements, and require workflow records with each shipped slice. These refinements preserve the three deliveries: collection capability, trusted parked comparison, then streaming and final handoff (`design.md:87`).

Planning paths and task references below are relative to `openspec/changes/repeatable-performance-lab/`; source, rules and shared-document paths are repository-relative. Persona citations are relative to this deliberation directory. Effort estimates are planning judgments rather than measured implementation costs.

## Synthesized Plan

### Change Group 1: Foundation and prerequisites

**Scope**: Make the ordering explicit and establish safe browser ownership before the first launch.

**Estimated Effort**: Small planning refinement, followed by a medium feasibility and supervision slice whose outcome cannot be assumed.

**Tasks**:
1. Amend Task 2.1 (opt-in central-loop integration) to include neutral exclusive ownership of driving, camera, zoom, touch deltas and edge actions, emergency abort, held/edge restoration, and settings/HUD mutation invalidation. Require its no-mixing and restoration tests before Task 2.5 (first acknowledged parked capture); narrow Task 4.1 (exclusive logical input adapter) to extending the same owner with driving commands. Align the migration paragraph with this dependency. The contract already requires all channels during either scenario (`tasks.md:10`, `tasks.md:14`, `tasks.md:27`; `design.md:31`, `design.md:87`; `specs/performance-lab/spec.md:21`).
2. Annotate Task 1.2 (hardware-browser feasibility) with a prerequisite for surviving, bounded ownership from Task 1.4 (independent supervisor), allowing a minimal supervisor bootstrap before the feasibility launch. This does not require finishing every later failure test first, but the first launch must already have independent closure authority, bounded commands and exact owned-resource checks (`tasks.md:4`, `tasks.md:6`; `design.md:29`; `AGENTS.override.md:17`).
3. Make Task 5.3 (build and tier integration checks) an explicit prerequisite of timed overhead, calibration and candidate runs for each changed build, with the relevant ordinary-launch and diagnostic boot checks included before the first collection slice is accepted. Add a delivery note requiring same-commit CHANGELOG and corresponding ROADMAP updates for each usable slice, retaining Task 6.2 (comprehensive documentation) for the final pass (`tasks.md:21`, `tasks.md:37`, `tasks.md:43`; `AGENTS.md:138`).
4. Implement the minimum envelopes, one immutable current-compatible build and one supervised hardware-GPU browser backend. Preserve the checkout, user profile and existing server, then prove blocked-page and actual control-worker termination cleanup before expanding coverage. Use current Vite imports/builds, preserving the Three shim, synchronous gesture audio, RNG streams and resource ownership (`tasks.md:3`, `tasks.md:4`, `tasks.md:5`, `tasks.md:6`; `AGENTS.md:90`, `AGENTS.md:94`, `AGENTS.md:97`, `AGENTS.md:100`, `AGENTS.md:102`, `AGENTS.md:105`; `.claude/rules/no-build.md:16`).

### Change Group 2: Core implementation through the three delivery slices

**Scope**: Retain the smallest collection path, then script-owned parked comparison, then controller-driven streaming. Each slice is independently deliverable only after its applicable Group 3 gates; the group numbers do not postpone prerequisites.

**Estimated Effort**: Large overall, with collection, analysis and driving separated into bounded deliveries; avoid a calendar promise until browser feasibility is proven.

**Tasks**:
1. Build the thin active parked collector through the existing central tick, isolated test state and early publication suppression. Add exact bounded frame export with one destructive-counter owner, explicit overflow failure, atomic persistence and final-hash acknowledgement; retain legacy manual capture semantics (`tasks.md:10`, `tasks.md:11`, `tasks.md:12`, `tasks.md:13`; `design.md:17`, `design.md:31`, `design.md:45`).
2. Deliver collection capability only after a successful acknowledged parked capture, an interrupted capture and the foundation cleanup evidence. Do not attach a performance verdict to this slice (`tasks.md:14`; `design.md:87`).
3. Implement shared parsing, deterministic offline analysis, frozen comparison policy, four explicit verdicts and readable reports. Keep semantic work separate from rendering cost outcomes and preserve incomplete, divergent and unfavorable runs (`tasks.md:18`, `tasks.md:19`, `tasks.md:20`; `design.md:37`, `design.md:67`).
4. Extend the same input owner with streaming-drive commands and owner-sourced load/unload observations, wall/accepted/physics clocks, support waits, checkpoints and discarded time. Validate open-loop stability, using the already allowed versioned normal-input waypoint policy and recalibration if needed, with no corrective teleports (`tasks.md:28`, `tasks.md:29`, `tasks.md:30`; `design.md:39`).

### Change Group 3: Quality gates at every delivery boundary

**Scope**: Apply the existing verification contract at the earliest relevant boundary, without expanding the performance matrix.

**Estimated Effort**: Medium-to-large validation effort. At the stated scenario measurement caps, forty minimum calibration/holdout/injection runs represent thirty minutes of accepted measurement before settling, boot, overhead trials or retries; this is derived from four calibration plus eight holdout plus eight injection runs per scenario (`design.md:41`, `design.md:65`, `design.md:69`).

**Tasks**:
1. For the collection gate, test all input channels, emergency abort, restoration and mutation invalidation alongside export/interruption evidence. A driving lock alone is insufficient because camera and map edges are consumed independently of neutral driving input (`src/main.js:1266`, `src/main.js:1327`, `src/main.js:1349`; `src/input.js:129`, `src/input.js:136`; `specs/performance-lab/spec.md:21`).
2. Run the already assigned checks/build and ordinary plus diagnostic ready-title boots on Low/Mid/High before timing a changed build. Inspect console, actual render settings, the synchronous audio path and production inactivity. This is the real-game harness surface; no new model sandbox entry or graphics-budget policy is needed for this scope (`tasks.md:37`; `design.md:11`, `design.md:81`).
3. Pass malformed/duplicate/partial/null/legacy-data, quantile, content-loss, lower-submission/equal-work and mixed-outcome fixtures, then pass collector-overhead verification before calibration. Retain optional attribution/GPU probes under separate identities, with unavailable data explicit (`tasks.md:20`, `tasks.md:21`; `specs/performance-lab/spec.md:73`, `specs/performance-lab/spec.md:85`).
4. For each scenario, complete unchanged-source calibration, freeze bounds, pass fresh holdouts and detect the declared comparable injected regression. Preserve insufficient-dose trials and route-invalid failures; neither threshold widening nor content reduction can rescue acceptance. Parked acceptance precedes driving, and overall acceptance requires both scenarios (`tasks.md:22`, `tasks.md:23`, `tasks.md:31`, `tasks.md:38`; `design.md:65`, `design.md:69`).
5. Complete the remaining crash, export/acknowledgement, timeout, cap, restoration and teardown failures. Preserve unrelated resources, stop further launches after cleanup failure, and save the full acceptance bundle with deterministic offline regeneration (`tasks.md:35`, `tasks.md:36`, `tasks.md:38`).

### Change Group 4: Operating handoff and delivery records

**Scope**: Keep claims understandable and give the next agent verified commands and evidence paths.

**Estimated Effort**: Small per-slice records plus a medium final skill/documentation pass.

**Tasks**:
1. Update CHANGELOG and trim only shipped ROADMAP scope in every commit delivering a usable workflow slice, with its actual acceptance state. Leave unaccepted follow-ups visible; final documentation is not a substitute for per-slice records (`AGENTS.md:138`; `.claude/rules/changelog-and-roadmap.md:8`; `design.md:87`).
2. Create the `performance-lab` skill after commands and schemas stabilize, keeping statistics, compatibility rules and verdicts in tested scripts. Retain browser-free report regeneration from saved paths (`tasks.md:42`; `design.md:73`; `specs/performance-lab/spec.md:137`).
3. Complete the existing documentation, indexes, regression integration, spec coverage and README/session synchronization. Put collection-only, parked and full acceptance limits beside reports, preserving the distinction from phone performance, subjective driving feel and Auto acceptance (`tasks.md:19`, `tasks.md:43`, `tasks.md:44`; `specs/performance-lab/spec.md:113`).

## Final Recommendation

Proceed with mitigations after recording the four planning refinements in Change Group 1, Tasks 1 through 3: early parked input ownership, supervised first launch, pre-measurement integration dependencies and per-slice commit records. Keep the two scenarios, conservative acceptance policy and staged delivery intact; browser feasibility, route stability and sensitivity remain implementation experiments with explicit failure outcomes, and this review authorizes no implementation (`design.md:3`, `design.md:91`).

---

## Convergence Points

- All three retain safe collection before comparison, and parked validation before driving and handoff (`council-anthropologist.md:5`, `council-anthropologist.md:7`; `council-pragmatist.md:35`, `council-pragmatist.md:36`, `council-pragmatist.md:37`; `council-auditor.md:7`, `council-auditor.md:8`, `council-auditor.md:9`, `council-auditor.md:10`).
- All three retain independent cleanup, overhead verification, fresh holdouts, injected sensitivity, failed attempts and the two-scenario final gate rather than lowering acceptance to make delivery easier (`council-anthropologist.md:25`; `council-pragmatist.md:23`, `council-pragmatist.md:25`; `council-auditor.md:9`, `council-auditor.md:10`).
- All three keep the operating skill around verified scripts and constrain claims to measured scope (`council-anthropologist.md:8`, `council-anthropologist.md:18`; `council-pragmatist.md:31`; `council-auditor.md:10`).

## Conflicts Resolved

| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Retain the plan unchanged versus correct parked input ordering | Anthropologist finds no experience-related plan defect and recommends retaining the plan (`council-anthropologist.md:25`). | Pragmatist and Auditor identify input ownership scheduled after parked acceptance (`council-pragmatist.md:9`; `council-auditor.md:14`). | Retain the architecture but split early neutral ownership from later route control. | The requirement already applies to both scenarios, while current source separately consumes camera/map edges; this is a concrete dependency defect, not a new feature (`specs/performance-lab/spec.md:21`; `src/main.js:1327`, `src/main.js:1349`). |
| Fast feasibility spike versus safety from the first launch | Pragmatist puts backend feasibility on the critical path (`council-pragmatist.md:7`, `council-pragmatist.md:15`). | Auditor requires supervisor protection during that spike (`council-auditor.md:7`). | Allow a minimal surviving supervisor bootstrap, then complete its explicit failure proofs before expansion. | These priorities are compatible once ordered; a feasibility label does not exempt the first launch from ownership and bounded cleanup (`design.md:29`; `AGENTS.override.md:17`). |
| Independent slice delivery versus final documentation grouping | Pragmatist recommends three independently useful slices (`council-pragmatist.md:35`, `council-pragmatist.md:36`, `council-pragmatist.md:37`). | Auditor flags CHANGELOG/ROADMAP appearing only in the final documentation task (`council-auditor.md:16`). | Add a per-slice same-commit note and retain the final comprehensive pass. | Current policy already requires records with shipped workflow changes; no additional delivery gate is invented (`AGENTS.md:138`). |

The tier integration dependency is a clarification of an existing instruction, not a newly missing test: Task 5.3 (build and tier integration checks) already says preparation precedes timed measurements (`tasks.md:37`; `council-pragmatist.md:18`). The personas offer no opposing verdict on expanding scope, so no additional disagreement is inferred.

## Risk Register

| Risk | Severity | Mitigation | Owner (persona that flagged it) |
| --- | --- | --- | --- |
| Parked conditions change through live input before the later driving task. | Medium | Move neutral all-channel ownership, mutation invalidation and restoration into the first capture slice (`tasks.md:27`; `specs/performance-lab/spec.md:21`). | Pragmatist, Auditor |
| A feasibility launch leaks owned browser/GPU resources after a blocked page or dead controller. | High | Require surviving bounded ownership from the first launch and exact cleanup proofs before expansion (`design.md:29`; `tasks.md:6`). | Auditor, Pragmatist, Anthropologist |
| Instrumentation, drift or incomplete work creates a favorable but invalid comparison. | High | Pass overhead, frozen fresh holdouts, comparable injection and route coverage; retain failures (`tasks.md:21`, `tasks.md:22`, `tasks.md:23`, `tasks.md:31`). | All three |
| Build or integration work contaminates the reserved measurement window. | Medium | Make existing checks/build/boot preparation a dependency of timed tasks; retain declared quiet-window conditions (`tasks.md:37`; `design.md:33`). | Pragmatist |
| Independently shipped workflow slices lose their delivery records. | Low | Same-commit CHANGELOG and matching shipped ROADMAP trimming, plus final documentation (`AGENTS.md:138`; `tasks.md:43`). | Auditor |
| Desktop lab acceptance is read as phone, Auto or subjective driving acceptance. | Medium | Display scope and acceptance stage with generated verdicts and handoff documentation (`specs/performance-lab/spec.md:113`; `tasks.md:44`). | Anthropologist |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Anthropologist | Desktop measurement must remain distinct from player/device acceptance (`council-anthropologist.md:24`). | Proceed |
| Pragmatist | Exclusive input is scheduled after the parked slice needs it (`council-pragmatist.md:42`). | Proceed with mitigations |
| Auditor | Parked input ordering, first-launch safety and per-slice workflow records require clarification (`council-auditor.md:44`). | Proceed with mitigations |
