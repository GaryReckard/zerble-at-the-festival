# Make the festival physically responsive

> **Status:** <!--STATUS:LINE-->in progress · 1/66 tasks (1%)<!--/STATUS:LINE-->

## TL;DR

Build a small physical simulation around Zerble so chairs, their occupants, coolers, cups and signs respond to the way they are hit. Keep the cart's familiar controls, let people brace or fall and recover, and give displaced objects a coherent aftermath. Implementation began October 30 from the completed hoop baseline. A standalone Rapier playground and real-engine tests now provide the first proof; an opt-in live empty-chair encounter now runs, while full production integration and physical-device acceptance remain pending. See the [implementation evidence](../../../verification/physical-festival/README.md).

## The Problem

The festival already has chairs, a detailed cooler and occasional handheld drinks, but their appearance, collision response and use by people do not form one physical interaction. A convincing accident needs more than a tumbling model: the person must leave the seat safely, the cup must exist in one place, and the objects must survive or clean up correctly when the surrounding area unloads.

The desired range includes small saves as well as spectacular tumbles. Someone keeping their drink upright while their chair rocks onto two legs can be as memorable as a chair skidding into a cooler.

## Proposed Fix

Start with a repeatable playground that uses the game's real models and systems. Prove an empty chair's contact and lifetime, add an occupant's brace/dismount/fall/recovery, then verify the complete encounter in one real campsite. Expand through contrasting objects and explicit support/ownership rules.

| Implementation stage | What it delivers | Acceptance before proceeding |
| --- | --- | --- |
| Foundation and empty chair, task groups 1–4 | Playground, measured engine candidate, stable objects, batching, streaming and contact response | Convincing motion and lifecycle tests, including constrained capacity |
| Occupied chair and real campsite, task groups 5–6 | Bracing, falling, recovery, valid seats and integrated score/sound behavior | A complete production encounter with trace, device and visual evidence |
| Cooler, task group 7 | Heavy sliding/tipping, real holder sockets and deliberate lid articulation | Existing cooler appearance preserved; its canopy never moves with it |
| Cups, task group 8 | Existing NPC drinks become transferable hand/holder/free props | One cup identity and visual throughout drops, poses and recovery |
| Signs, task group 9 | Sparse useful arrows at verified route choices and entrances | Followable routes, readable signs and damage retained until safe distance reset |
| Aftermath and coverage, task groups 10–12 | Chair righting, drink retrieval, personality, wider enrollment and release evidence | Correct claims, bounded work and completed regression/review gates |

The full [66-task checklist](tasks.md) is the progress authority. Pure sign research can proceed separately after the baseline is established; its physical rollout still depends on the shared prop foundation.

## Progress

<!--STATUS:AUTO-->
**in progress** — 1/66 tasks complete (1%) · current: 4.2 (Separate object and person contact response), with phone and occupied-incident acceptance pending

_Last updated: 2026-10-30_

| Group | Progress |
|---|---|
| 1. Establish source baseline and the interaction playground | 1/5 |
| 2. Prove the physics dependency and update loop | 0/6 |
| 3. Establish prop identity, rendering and lifecycle | 0/7 |
| 4. Finish empty-chair contact and incident behavior | 0/5 |
| 5. Add occupied support, graduated reactions and recovery | 0/7 |
| 6. Integrate and accept one real campsite | 0/4 |
| 7. Add the cooler as the next distinct physical object | 0/6 |
| 8. Turn existing beverages into transferable cups | 0/6 |
| 9. Add route-aware damageable signs | 0/6 |
| 10. Add bounded social aftermath | 0/5 |
| 11. Expand coverage and resolve conditional extensions | 0/5 |
| 12. Rollout, documentation and review | 0/4 |
| Dependency and efficiency notes | 0/0 |
<!--/STATUS:AUTO-->

## Key Decisions

- **Use contact-driven variety.** Shape, balance, speed and surroundings create the motion, while animation adds human intent.
- **Evaluate Rapier first.** Pin and measure the candidate before treating its loading or phone cost as established.
- **Preserve one owner per object/person.** Physics bodies and render slots are temporary representations; they do not become identity.
- **Reuse what already exists.** Chairs are already batched, the cooler already has cup wells, and ordinary NPCs already sometimes carry drinks.
- **Reset abandoned arrangements at distance.** Keep nearby consequences and followed/carried objects, then regenerate original placements after safe teardown. No displacement history is saved.
- **Signs help navigation and can stay damaged.** Arrows follow validated routes to actual destinations. Automatic repair is disabled by default.
- **Reserve room for unavoidable releases.** An admitted occupied chair must be able to release its sitters and cups even when optional capacity is full.
- **Keep scenery generation independent of accidents.** Moving furniture changes live avoidance, not the canonical clearance that generates existing scenery.
- **Treat advanced expression as evidence-driven.** Articulated ragdolls, loose cooler contents, spills and extra gestures have explicit decision tasks rather than becoming hidden prerequisites.

## Risks & Watch-outs

The [council synthesis](deliberations/001-plan/results.md) recommends proceeding with mitigations, all integrated into the design, tasks and requirements. The critical contracts are frame ordering, occupied-seat transfer during unloading, reserved release capacity, bounded metadata/work, and sign validation that does not depend on which destination is currently loaded.

The proposed frame schedule puts physics at the existing late contact stage and republishes affected poses without updating people twice. Ordinary steering deliberately uses the last completed physical state. This arrangement must pass the fixture and real-game trace before acceptance.

Graphics budgets do not establish physics CPU cost. Actual device measurements select capacities and timing limits. Preserve synchronous start-gesture audio, shared resources and current Vite imports; older no-build/importmap descriptions are historical.

## Decisions to make during implementation

No unanswered question blocks starting the first task. Measured engine/loading behavior, final capacities, physical feel, any numeric scoring change and conditional expression choices are scheduled gates. They remain proposed or unmeasured until their evidence and decisions are recorded.

## Where Things Live

- [Ideas and conversation record](ideas.md): the complete ambition, explicit user requests, alternatives and extensions.
- [Implementation tasks](tasks.md): ordered work, dependencies and acceptance gates.
- [External research synthesis](research-synthesis.md): four reports evaluated against current source and primary documentation, with corrections and concrete experiments.
- [Model delegation plan](delegation.md): exact task owners, model choices, handoff rules and review responsibilities.
- [Approved distance-reset amendment](deliberations/002-distance-reset.md): what simplifies and which lifecycle safeguards remain.
- [Technical design](design.md): ownership, frame flow, rendering, support, drinks, signs and distance reset.
- [Verification plan](verification.md): repeatable scenarios, negative tests and device evidence.
- [Source evidence](evidence.md): what exists now and where to integrate.
- [Proposal](proposal.md): scope and capability changes.
- [Capability requirements](specs/): eight testable new/modified contracts.
- [Council review](deliberations/001-plan/results.md): Architect, Adversary, Profiler and Mediator findings and resolutions.
- [Session log](session-log.md) and [question ledger](questions-for-human.md): decisions, discoveries and future handoff memory.

## First implementation action

Gary authorized implementation after the hoop work landed. Task 1.1 (Baseline and compatibility) is complete, and the engine fixture is now being integrated on `codex/physical-festival-integration`, preserving the original worktree. Continue the incomplete production-fixture and engine contracts using the [model delegation plan](delegation.md); obtain physical-phone measurements before expanding content. The initial target remains a complete occupied-chair encounter; the plan reaches it through independently verifiable steps.
