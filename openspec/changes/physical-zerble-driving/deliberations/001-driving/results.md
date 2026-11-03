# Deliberation Summary

## Context
- **Task:** Physical Zerble driving, airborne ridge/cliff motion, surface-specific handling, coherent engine sound, passable shallow water, terminal submersion and an impact damage meter. Repair gameplay is deferred at the user's request.
- **Personas Consulted:** Architect and Profiler, followed by Mediator.
- **Date:** 2026-11-02
- **Mode:** Tier 3 synthesis; no Round 2.
- **Partial failure:** Adversary failed due model capacity and produced no position file. The council partial-failure rule permits proceeding with one missing position. Its communicated run-ending and lake-barrier findings were checked directly against `src/runState.js:155-159`, `src/main.js:2002-2034` and `src/physics/staticResidency.js:6-10`; they are not counted as a completed persona review.
- **Policy precedence:** Current `AGENTS.md:91-94` establishes Vite/npm and import-discovered modules. Historical no-build/importmap instructions in council/schema context do not override it. Other determinism, Three shim, synchronous iOS audio, shared-resource/lake ownership and verification constraints remain binding.

## Synthesized Plan

### Change Group 1: Contracts and bounded proof
**Scope:** Establish authoritative state and verification before changing live movement.
**Estimated Effort:** Small foundation slice, with source-contract changes and a bounded physics course.
**Tasks:**
1. Define one player snapshot containing solved position/quaternion, vector velocity, signed longitudinal speed, wheel contacts, support identity, engine effort, water immersion and terminal state. Keep presentation interpolation out of simulation input (`council-architect.md`, Priority Sequence 1).
2. Add explicit delta modifications for the existing carts requirements, including arcade integration, ground-pinned Y and hit-response immunity. Those active requirements contradict the proposed motion/damage contract and cannot be dismissed as historical (`openspec/specs/carts/spec.md:15-59`).
3. Build course/replay acceptance for flat launch/coast/boost, crest departure, abrupt and sideways falls, rough landings, each surface, bridge versus bed, shallow/deep water, damage deduplication, reset and teardown. Compare 30/60/120 Hz presentation schedules against one shared fixed-step simulation.

### Change Group 2: Physical vehicle and collision ownership
**Scope:** Replace the kinematic player with one chassis and four wheel rays inside the existing world.
**Estimated Effort:** Largest implementation slice; ownership reversal and collision readiness are the critical path.
**Tasks:**
1. Add adapter-owned, generation-checked vehicle handles, control/read/remove operations and resource counts; remove the controller before its chassis and on disposal (`council-architect.md`, Priority Sequence 2).
2. Preserve the existing 60 Hz clock initially and run vehicle forces immediately before each world step. Use interpolation for presentation; only change solver frequency after measured 60 Hz failures justify the shared-world cost (`src/physics/fixedStep.js:3-26`; `council-profiler.md`, Priority Sequence 1).
3. Give the player bounded terrain/static reservations before optional prop admission, retain old support until replacements are ready, and gate every next-step swept chassis extent. Keep existing caps/deadline accounting explicit; physical flight is loss of contact, while missing collision geometry is a readiness stall (`src/physics/liveWorld.js:27-38`; `council-profiler.md`, Priority Sequence 2; `council-architect.md`, Structural Risks).
4. Reverse movement authority coherently: solve and publish before stats/map/audio/people consumers, bypass terrain snapping and legacy cart corrections, and sample cached local surface candidates at actual wheel contact. Share lake bed truth with terrain rendering/collision, preserve stream cuts/deck slabs and pedestrian dry-route policy. Exclude invisible lake-edge proxies from player solidity and wheel support without erasing NPC/owner semantics (`src/main.js:1260-1280,1795-1799`; `src/physics/staticResidency.js:6-10`; `council-architect.md`, Structural Risks).

### Change Group 3: Consequences and quality gates
**Scope:** Integrate gameplay consumers and prove behavior through production paths.
**Estimated Effort:** Substantial integration and tuning slice after physical ownership is working.
**Tasks:**
1. Feed a bounded damage meter from meaningful impact episodes and hard landings, deduplicating persistent/compound contacts. Preserve the future bounded restoration API without implementing repairs. Monitor force-event overflow and prove parked contact does not add damage (`council-profiler.md`, Performance Risks; `../../specs/physical-driving/spec.md`, Vehicle damage).
2. Add an exactly-once mode-neutral terminal wrapper for submersion/damage, with Festival-only score recording/submission. Make both score-screen actions handle either mode. Existing `RunState.endRun()` requires an active Festival run and `endFestivalRun()` unconditionally records a Festival score (`src/runState.js:155-159`; `src/main.js:2002-2040`).
3. Publish throttle/load/contact/immersion engine state, full passenger transforms and grounded boarding/exit eligibility. Maintain a stable camera policy during tumble, and verify reset/rescue/ghost transitions without phantom impulses (`council-architect.md`, Structural Risks; `src/crowd.js:1680-1691,2107-2108`).
4. Run required checks/build, verify the bounded course and real ready title-plank gesture/game boot, then exercise Low/Mid at Noon/Midnight with console, render counters and owned-process cleanup. Record player blocked duration, vehicle step time, preparation cost, contacts/events and residency separately. Desktop evidence does not establish physical-device handling, audio or performance (`AGENTS.md:64-78`; `council-profiler.md`, Priority Sequence 4-5).

### Change Group 4: Documentation and delivery
**Scope:** Preserve the implementation/acceptance trail and user-visible behavior.
**Estimated Effort:** Small final documentation slice.
**Tasks:**
1. Update architecture/debug guides, capability deltas, changelog and roadmap together; describe actual controller, water, damage and mode behavior, with evidence links.
2. Record measured desktop results and outstanding physical-device/player tuning explicitly. Refresh the change README/task state and keep deferred repair gameplay separate from unfinished required acceptance.

## Final Recommendation
Proceed with mitigations. Use the installed Rapier vehicle controller in the existing world, retain the shared 60 Hz clock until evidence justifies changing it, and make player collision residency plus publication ordering prerequisites for live rollout. Accept the bounded single-chassis architecture for implementation; do not treat handling, landing stability or device performance as proven by the engine API or an isolated falling-body probe.

## Convergence Points
- Both completed positions require one physical motion authority, adapter-owned teardown and player-priority bounded support.
- Both distinguish actual wheel-contact loss from unavailable streamed geometry and preserve bridge/bed ownership.
- Both require real-game verification and measured acceptance, rather than treating course success as integration proof.
- Neither recommends new lights, shadows, post-processing or a second physics world.

## Conflicts Resolved
The completed positions contain no opposing verdicts or contradictory architectures. The rows below resolve concrete coverage/order tensions rather than inventing disagreements.

| Conflict | Architect Position | Profiler Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Broad state/publication refactor versus bounded CPU integration | Reverse authority before consumers and replace direct corrections coherently | Preserve clock/deadline and avoid multiplied surface queries | Establish the snapshot contract first, then solve/publish within the existing 60 Hz owner; cache surface candidates outside substeps | Correctness and frame delivery can be satisfied together |
| Airborne support coverage versus reservation growth | Include a bounded projected landing corridor and preserve old support | Avoid allocating an entire ballistic trajectory; gate next-step swept extent | Use bounded lookahead with per-step readiness checks and retained committed tiles | Prevents unsupported simulation without unbounded terrain preparation |
| Existing normative cart contract versus new dynamic behavior | Add explicit deltas for active requirements | No conflicting spec position | Update the existing carts capability alongside the new physical-driving capability | Active SHALL clauses must match intended behavior |
| High visual impact versus GPU cost | Full vehicle/passenger transform behavior and actual bed/deck support | Reuse cart/water meshes and DOM meter, target zero ordinary render delta | Reuse existing visuals, modify shared terrain bed data and measure any necessary geometry change | The feature's principal cost is CPU/ownership; a graphics overhaul is unnecessary |

## Risk Register
| Risk | Severity | Mitigation | Owner |
| --- | --- | --- | --- |
| Two movement authorities or consumers observing unsolved pose | Critical | Bypass grounding/correction and publish authoritative solve before gameplay readers; test resets and interpolation | Architect |
| Player steps beyond prepared collision support | Critical | Player-priority reservations, bounded swept readiness, retained committed tiles and blocked-time diagnostics | Architect / Profiler |
| Cruisin endings fail or submit Festival scores | Critical | Exactly-once mode-neutral terminal wrapper and mode-specific reporting tests | Architect; independently verified by Mediator |
| Invisible lake barrier remains in physics | High | Exclude lake-edge proxies from player-solid/support policy while preserving other owner/NPC contracts | Architect; independently verified by Mediator |
| Conservative scenery cylinders become inappropriate landing surfaces | High | Audit trees, structures and rails; explicitly classify wheel-support eligibility | Architect |
| Per-wheel regional road queries or doubled shared solver cost | High | Cached bounded surface candidates and initial 60 Hz stepping; measure preparation separately | Profiler |
| Resting/compound contacts repeatedly fill damage meter or event queue | High | Episode-based deduplication, meaningful thresholds and overflow assertions | Profiler |
| Bridge, lake bed or passenger pose diverges from visuals | High | Shared bed data, real ray support identity, full transform inheritance and boarding eligibility tests | Architect |
| Desktop-only evidence is mistaken for mobile acceptance | Medium | Keep physical-device/player tuning open with recorded evidence scope | Profiler |

## Verdicts Summary
| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | Authoritative solve, collision reservations and downstream publication form one ownership boundary | Proceed with mitigations |
| Profiler | Mandatory player collision residency must remain bounded and avoid unnecessary repeated CPU work | Proceed with mitigations |

**Mediator verdict:** Proceed with the four Change Groups above. The missing adversary position is a documented review limitation, not evidence of adversarial clearance.
