# Deliberation Summary

## Context

- **Task:** Refine additive generative hoop choreography while preserving classic hooping, then decide whether the plan can proceed to implementation.
- **Personas Consulted:** Architect, Maverick, Adversary and Mediator.
- **Date:** 2026-10-29.
- **Mode:** Tier 3 synthesis; no Round 2; all three independent positions received.
- **Inputs:** [shared briefing](briefing.md), [Architect](council-architect.md), [Maverick](council-maverick.md), [Adversary](council-adversary.md), and the parent proposal/design/specification/tasks.

## Synthesized Plan

The design should use a bounded score compiler for each activity session, then sample that score without making random decisions while rendering. The existing sessions last 18 through 25 accepted performance seconds, making a whole-session entrance, motif, development, flourish and resolution a natural unit (src/people/hulaActivity.js:33; src/people/hulaSession.js:44-47). Repeated encounters provide ongoing variation; preserving a deliberate ending is more valuable than introducing online composition prematurely.

Keep the full planned vocabulary and later multiple-hoop/partner work. The first production proof must establish a recognizable returning motif and exact hand contact before that expansion. The following four Change Groups contain 18 synthesis tasks; they refine the implementation checklist rather than replacing its individual task IDs.

### Change Group 1: Production workshop and publication contract

**Scope:** Establish the smallest real-path inspection surface and exact sampling/ownership contracts before general choreography or live style selection.

**Estimated Effort:** Medium foundation work; the first integration and coordinate proof is the largest uncertainty. This is an ordering estimate, not a measured schedule.

**Tasks:**

1. Build the deep-linkable muted workshop with existing Crowd/HulaActivity ownership, classic comparison, seed/profile selection and pause/step/seek. Include the minimum opt-in flow-pose adapter in this milestone so it can exercise real arms; keep live-game classic selection unchanged. The current ownership and roaming registration are the boundaries to preserve (src/people/hulaActivity.js:12-35).
2. Specify a complete discriminated sample with session generation, sample version, style, active hoop count, body fields and both arm fields. Reset every optional field/count when copying into caller scratch; never retain Crowd's reused scratch object or infer style from property presence (src/crowd.js:1608-1610; src/personMotion.js:64-66).
3. Specify and test the publication transaction: resolve accepted-time boundaries, cache the complete new sample, call claim-checked person publication, then display hoops from that same version. Apply the rule at entry, interruption, reacquisition, completion and slot reuse, including zero-delta writes. writeActivityPose synchronously publishes the person (src/crowd.js:2331-2341), so refreshing the cache afterward is too late.
4. Prove both-hand forward kinematics and use one pure presentation-transform contract, or a claim-validated copied presentation transform, for arms and hoop contacts. Do not expose mutable Crowd internals. Set numerical contact/continuity tolerances in the test fixture before acceptance, cover heading/scale/lean/terrain and preserve normal/depth articulation parity (src/personMotion.js:58-62,100-115; src/crowd.js:1628-1634,1730-1737,448-475).
5. Define an activity-owned envelope reservation store with token identity, bounded capacity, conservative hoop-sweep geometry and release on cancellation/disposal. World and people queries remain read-only, and bystanders are not physically excluded by these reservations. Existing reservation code protects a slot/venue identity, not the surrounding space (src/people/hulaActivity.js:25-31,66).

### Change Group 2: Composed performances and complete vocabulary

**Scope:** Compile validated movement sentences, integrate the additive flow style and expand the same contract through the complete requested scope.

**Estimated Effort:** Largest implementation group, delivered as separately verifiable single-hoop, multiple-hoop and partner slices.

**Tasks:**

1. Compile bounded finite scores from validated phrase families, legal parameter ranges, motif/history/profile weighting and a safe fallback. Record the maximum segments, candidate attempts, hoop states and retained replay events as explicit constants before implementation acceptance. Seed from an injected activity root seed, a fresh composition salt, stable slot identity and session generation. Record these inputs; do not derive replay promises from registry insertion IDs or private Crowd indices. Preserve worldgen/classic draws, while acknowledging that changed flow admission can change future participation (src/people/hulaActivity.js:60-70; Architect, Structural Risks; Maverick, Alternative Approach).
2. Author the first complete hand-orbit → isolation → hand-transfer → overhead/answer phrase using the existing hoop presentation, then implement body-orbit entrances, supported rolls and planned flight/catch. Validate the complete score's reach/contact/swept envelope before admission. Use stable hoop roots, separate plane orientation from spin, and match release/catch position, orientation and velocity. Existing hoop geometry/material and nightness behavior remain the baseline (src/models/hulaHooper.js:26-58; src/people/hulaActivity.js:58).
3. Integrate optional flow sessions with independent active-participation and score-epoch clocks. Preserve classic elapsed behavior exactly. A fresh flow entrance after interruption consumes the remaining active-performance budget; resetting the score never resets total participation. Retain the current approach/wait timeout semantics, hide props on revocation and invalidate contacts before subsequent publication. Separate pure score replay from live encounter replay, recording environmental decisions that cause admission, cancellation or restart; seeking never rewinds real claims/cooldowns (src/people/hulaSession.js:19-24,29-59; Adversary, Vulnerabilities Found).
4. Add validated two-hoop counterpoint and a distinct paired-session coordinator. Count both participants against the existing eight-person activity capacity and enforce a separate explicit bounded hoop capacity. A partner session must not bolt a second claim onto an active solo session. Stage both participant/corridor reservations, acquire without replacing unrelated claims, revalidate both current incarnations before becoming active and roll back all partial acquisitions. Reuse frisbee's guarded release pattern, but do not assume it provides transactional or non-stealing acquisition (src/people/frisbeeSession.js:9-36,52-62; src/people/activityClaims.js:10-39,59-66).

### Change Group 3: Correctness, player-readability and performance gates

**Scope:** Establish executable and visual evidence before enabling each vocabulary stage in the live activity.

**Estimated Effort:** Continuous with each implementation slice, followed by integrated verification; physical-device evidence remains a separate measurement obligation.

**Tasks:**

1. Test same-version body/hoop publication through production calls and flow → classic → inactive → flow reuse of one output buffer across people and recycled slots. Exercise zero and .05 accepted deltas, contact boundaries, immediate finish/revocation and multiple readers without state advancement (src/crowd.js:1609,2331-2341; src/people/runtime.js:44-60).
2. Test score compilation/sampling with fixed seeds, equivalent accepted-time partitions, a skipped wall-clock interval, NPC freeze, exported environmental decisions and bounded seek. Pure replay must not depend on the current festival scene. In the initial implementation, dynamic obstruction selects a recorded safe exit/cancellation rather than unrecorded stochastic recomposition (src/people/hulaActivity.js:26-31,39,62-70; ARCHITECTURE.md:885-891).
3. Test all lifecycle modes, including repeated interruption near the duration limit, venue/person loss during reacquisition, a second partner acquisition that fails or synchronously releases the first, stale handles, repeated dispose/recreate and throwing cleanup callbacks. Assert hidden props, cleared contacts, released reservations and no stale publication, with every release attempted despite individual errors (src/people/hulaSession.js:34-47,61-78; src/people/activityClaims.js:53-66; src/people/frisbeeSession.js:27-36,52-60).
4. Review fixed seeds from both the close workshop camera and the normal game camera. Require a visible held isolation, a recognizable motif return, differing profile silhouettes/pacing and quiet moments between flourishes. Capture Noon/Midnight and retain the classic comparison; transition counts are supporting diagnostics, not the creative verdict (Maverick, Priority Sequence and Impact and Simplification; openspec/council/charter.md, Project-Specific Resolution Rules).
5. Run npm run check and npm run build, then perform a real muted game boot from the ready mode plank, console inspection, interruption and travel/unload/revisit checks. Verify Low's actual Lambert path in the game as well as Mid/High; sandbox.html deliberately bypasses Lambert replacement, so its Low screenshots cannot establish that material contract (src/threeShim.js:46-49; AGENTS.md, Run and verify).
6. Measure compilation/allocation separately from steady-state sampling and matched full-game draws/triangles/CPU. Keep planner work and resource capacity bounded, avoid per-frame allocation and add no lights or shadow casters by default. Report measurement context and remaining physical-device limits instead of treating HUD colors or software rendering as device proof (AGENTS.md, Run and verify and Constraints that must survive edits).

### Change Group 4: Delivery records and final integration

**Scope:** Keep documentation, supported behavior and acceptance evidence consistent as slices become available.

**Estimated Effort:** Small per slice, with a final coherence pass.

**Tasks:**

1. Revise design/specification/tasks now to incorporate the contracts and ordered gates above, explicitly replacing online phrase-boundary composition with bounded session-score compilation. Move the minimum production adapter into the workshop milestone without enabling live flow prematurely.
2. Update CHANGELOG and trim ROADMAP when player-visible runtime slices ship; document workshop controls, replay inputs, ownership and measured limitations in the appropriate debugging/architecture/verification references (AGENTS.md, Changes and commits).
3. Synchronize and read the change README end to end, validate the OpenSpec change and links, and keep incomplete device acceptance visible. Use ordinary Vite imports and the current sandbox checklist; current AGENTS.md supersedes historical no-build/importmap prose in council/config artifacts (AGENTS.md, Constraints that must survive edits; .claude/rules/no-build.md:1-25).

## Final Recommendation

**Verdict: Proceed with mitigations.** The real deliberation requirement is satisfied by this completed synthesis and its three independent positions, but implementation may start only after the parent plan incorporates the explicit publication, clock, replay and ownership refinements. The next runtime work is the production-path workshop plus minimum flow adapter and one complete contact-valid phrase; the full vocabulary, multiple hoops and partner exchange remain planned delivery stages.

This is a design gate decision, not runtime acceptance. No new engine, worldgen, audio or general rig rewrite is justified by the evidence; revisit only if the first constrained contact proof demonstrates an actual limitation (src/personMotion.js:58-62,100-115; src/people/hulaActivity.js:12-35).

## Convergence Points

- All three reviewers support retaining classic hooping and adding flow through current Crowd/activity authority rather than creating replacement people ([Architect](council-architect.md), Priority Sequence; [Maverick](council-maverick.md), Priority Sequence; [Adversary](council-adversary.md), Priority Sequence).
- All require actual arm/contact proof, readable continuous movement, isolated seeded replay and guarded lifecycle behavior before expanding the vocabulary (the three Priority Sequence sections).
- All retain the promised later multiple-hoop/partner scope and require real-game evidence rather than treating an isolated model preview as sufficient (the three Verdict sections).

## Conflicts Resolved

| Conflict | Position A | Position B | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| Online composition versus finite authored structure | The original design selects at phrase boundaries; Architect accepts bounded composition state (Architect, Priority Sequence) | Maverick recommends compiling a complete existing-duration session (Maverick, Alternative Approach) | Compile finite session scores from phrase families; environmental change initially causes a recorded safe exit/restart | Keeps creativity through motif parameters while simplifying seek, admission validation and runtime work; existing sessions are already finite (src/people/hulaActivity.js:33) |
| Workshop first versus adapter later | The initial tasks put the flow adapter after workshop/pure-engine milestones | Maverick requires real production arms in the first performance proof | Include the minimum opt-in adapter in the workshop foundation and defer live style selection | Satisfies the harness-first rule without inventing a substitute dancer or delaying the contact test (src/crowd.js:1608-1610,1805) |
| Seeded replay versus live clearance branching | Original design rechecks obstruction while advancing a score | Adversary identifies scene-dependent outcomes | Export score descriptors plus environment decisions; keep pure score seek isolated from live authority | A seed cannot reconstruct registry identity and moving bystanders (src/people/hulaActivity.js:26-31,62-70) |
| Fresh restart versus bounded participation | Original design restarts the flow entrance after interruption | Adversary notes that resetting elapsed changes classic behavior or can extend sessions indefinitely | Separate score epoch from monotonic active participation; entrances count toward remaining active duration | Preserves classic semantics and bounds flow despite repeated interruptions (src/people/hulaSession.js:34-47) |
| Reuse pair pattern versus assume transactionality | Architect and Maverick recommend the frisbee pair lifecycle | Adversary shows acquisition replaces old owners | Reuse guarded cleanup, add non-stealing acquisition/revalidation and staged resource rollback | Reuse is sound only with the stronger explicit authority contract (src/people/activityClaims.js:24-29; src/people/frisbeeSession.js:27-36) |

## Risk Register

These are design obligations for unimplemented behavior, not confirmed runtime defects. No Critical risk was established; five risks are High and four are Medium.

| Risk | Severity | Mitigation | Owner |
| --- | --- | --- | --- |
| Body and hoop render different score versions because pose writes publish synchronously (src/crowd.js:2331-2341) | High | Cache complete sample before publication; verify epochs and version equality through production calls | Architect, Adversary |
| Optional flow data leaks through shared scratch into classic participants (src/crowd.js:1609; src/personMotion.js:64-66) | High | Explicit discriminator, full overwrite/reset and mixed-style reuse tests | Architect, Adversary |
| Hand targets disagree with shader/final presentation transform or exceed the rig workspace (src/personMotion.js:58-62,100-115; src/crowd.js:1730-1737) | High | Both-hand parity and numerical tolerance fixtures before authoring; shared transform boundary | Architect, Adversary |
| Partner acquisition steals unrelated authority or reentrant cleanup strands one participant (src/people/activityClaims.js:24-29,59-66) | High | Non-stealing acquisition, staged reservations, two-claim revalidation and idempotent rollback | Architect, Adversary |
| Sandbox Low passes while live Lambert shader/material path fails (src/threeShim.js:46-49) | High | Real-game Low material confirmation and compile/render check, plus Mid/High comparison | Adversary |
| Environment-dependent decisions break replay or seek mutates live authority (src/people/hulaActivity.js:26-31,62-70) | Medium | Record descriptors/environment decisions, bound storage and keep seek independent of claims/cooldowns | Adversary |
| Repeated restart extends active participation or changes classic timing (src/people/hulaSession.js:34-47) | Medium | Separate bounded participation and score epoch; entrance time consumes remaining budget | Adversary |
| Larger sweeps exceed existing placement/resource assumptions (src/people/hulaActivity.js:9,25-31,66) | Medium | Token-owned envelope store, explicit person/hoop caps, dynamic-obstruction safe exit and disposal tests | Architect, Maverick |
| Technically varied choreography reads as repetitive or incoherent from the game camera (Maverick, Impact and Simplification; charter resolution rule 3) | Medium | Whole-session motif structure and fixed-seed visual acceptance at normal viewing distance | Maverick |

## Verdicts Summary

| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | Complete same-version publication, exact transform agreement and explicit resource/pair authority | Proceed with mitigations |
| Maverick | Prove an intentional, readable performance before general composition machinery | Proceed with mitigations |
| Adversary | Synchronous publication, reusable scratch and interruption/acquisition contracts can defeat otherwise correct pure tests | Proceed with mitigations |
| Mediator | Compile finite coherent scores while making production publication, replay and ownership explicit prerequisites | Proceed with mitigations |
