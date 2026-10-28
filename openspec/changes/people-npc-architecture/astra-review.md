# Independent Astra review of the people/NPC architecture plan

Status: Independent review complete, 2026-10-25. Planning review only; runtime implementation is not authorized. No council position files were consulted.

The plan citations below refer to the pre-council draft, also preserved under `deliberations/001-architecture/input-plan/`. Runtime citations refer to the working tree inspected for this review. Findings are design issues, not claims that unimplemented code already contains bugs.

## Verdict

**TL/DR:** Approve the architectural direction after tightening the authority contracts and changing the migration order. The strongest improvement is preserving one person identity while activities and renderers change, with population-specific implementations behind explicit participation contracts. The weak point is that “thin runtime” currently describes a substantial collection of new protocols without proving their hardest interactions. Removing branches from `main.js` is useful, but it is not sufficient evidence that adding an activity or character role becomes easier.

I would implement one complete ownership slice before the broad population extraction: an ordinary crowd member enters Healing Arts, receives a different rig, leaves or is interrupted, survives place unload, and later has its pool slot reused. That exercises the proposed architecture more effectively than moving every obstacle class first. Keep children as the second consumer because their independently owned population and movement expose adult-specific assumptions.

## Verified context

The source supports the central diagnosis. Crowd schedules camp jobs and parties, advances individual behavior, and uploads render batches in one method (`src/crowd.js:910-988`). Monk parties allocate crowd identities and directly alter their group, traits, targets, and avatars (`src/monks.js:39-49`), while Healing Arts borrows the same identities and moves them independently (`src/healingArtsActivity.js:21-26`, `src/healingArtsActivity.js:59-76`). Main explicitly enumerates honk recipients and collision providers (`src/main.js:1050-1059`, `src/main.js:1523-1538`). These are concrete ownership and extension concerns, independently of the freeze symptom.

Several proposed constraints are especially well chosen:

- Keeping population storage behind adapters preserves adult instancing and child models without forcing a common storage format (`design.md:85-102`; current uploads at `src/crowd.js:953-988` and child storage at `src/obstacles.js:413-445`).
- Keeping the world registry separate from person lifetime respects the actual distance-based crowd sweep and existing mover publication (`src/crowd.js:808-821`, `src/oneWheels.js:70-71`).
- Preserving consumer-specific query eligibility is necessary: one-wheel clearance, yielding, and gathering currently use different crowd queries (`src/oneWheels.js:73-86`).
- Avoiding a new AI selection algorithm is appropriate because extraction already touches a large precedence chain (`src/crowd.js:1029-1113`; `critical-evaluation.md:31`).

## Findings and proposed corrections

### 1. P1: Specify the activity handoff contract before migrating activities

**Observed:** The design names `tryBegin`, `tick`, and `end`, generation-safe claims, and one movement authority, but does not specify the acquisition failure semantics, authorized write surface, or ordering between cancellation and replacement (`design.md:132-150`). Current activities do considerably more than supply destinations: Healing Arts writes position and yaw directly, camp music performs its own collision-aware movement, and riding locks people to vehicle transforms (`src/healingArtsActivity.js:59-76`, `src/campJamActivity.js:121-143`, `src/crowd.js:1953-1962`). Crowd also has an ordered activity-selection and protected-state chain (`src/crowd.js:1029-1101`).

**Design judgment:** “Intent,” “movement controller,” and “activity authority” permit incompatible implementations unless the contract says who commits transforms. A generic `setState` or `mutatePerson` facade would merely make existing private writes public, while forcing all activities through one new mover would introduce a movement rewrite that the plan expressly avoids.

**Correction:** Define a small concrete transition protocol. The population owner validates the person and requested handoff, the resource owner validates its reservation token, acquisition either succeeds completely or rolls back its own tentative work, and the outgoing claim becomes unable to write before the incoming claim begins. The current claim selects the authorized movement implementation; preserve the existing activity-specific algorithms through that seam. Separate group membership from its lower-priority movement proposal, and document who handles resume after an activity. Claim validation must protect movement writes as well as releases.

**Acceptance implication:** Add scenarios for failed acquisition preserving the existing activity, two activities attempting the same person in one frame, a stale tick after replacement, and interruption during group boarding. Record the existing eligibility/selection order explicitly before replacing the private writes. These are contract decisions, not API spelling that can be postponed under `design.md:269-270`.

### 2. P1: Handles must survive controller recreation safely, not only slot reuse

**Observed:** The proposed handle is `{ controllerKey, slot, generation }`, with generation incremented on slot reuse (`design.md:87-90`). Registration requires unique keys, while controller disposal and repeated teardown are in scope (`design.md:62-83`, `specs/people-runtime/spec.md:83-92`). The stated identity scenario covers only reuse inside one population lifetime (`specs/people-runtime/spec.md:23-26`).

**Design judgment:** A controller can be disposed and recreated with the same key and initial slot generations. If that is allowed, an old handle can resolve to a different person even though the advertised slot-reuse test passes. This is a hole in the proposed contract, not an observed runtime defect.

**Correction:** Include a runtime-issued owner incarnation in identity, or keep generation allocation in a runtime namespace that never resets when a controller is replaced. An opaque owner token is sufficient; no persistent-ID system is needed. Specify whether full runtime replacement also invalidates its handles and reservation tokens.

**Acceptance implication:** Retain a handle and activity token, dispose the controller, register a replacement under the same readable key, and create a person in the same slot. Every old command, tick, hit callback, and release must fail to affect the replacement. Add this beside the current pooled-slot scenario.

### 3. P1: Resolve Healing Arts' render-to-simulation dependency explicitly

**Observed:** The plan requires render adapters to consume final pose and treats movement as controller-owned (`design.md:48-52`, `design.md:156-162`). However, Healing Arts' model computes dance positions, resolves person/pole overlap, and publishes `currentX/currentZ` (`src/models/healingArts.js:193-237`, `src/models/healingArts.js:262-267`). Its activity copies those model outputs into the authoritative crowd position (`src/healingArtsActivity.js:124-126`). The chunk updater calls the activity before updating the model, so the activity currently observes the preceding model sample (`src/chunks.js:68-74`). Task 4.7 (Healing Arts identity and rig adaptation) mentions private render calls and handoff tests but does not identify this reverse ownership dependency (`tasks.md:45`).

**Design judgment:** Replacing `_writeMatrices` with a public render command will not achieve the stated boundary here. A renderer still determines gameplay position, and culling its update changes when that position is sampled. This is the best concrete test of whether the proposed separation is real.

**Correction:** Extract the existing participant trajectory/constraint calculation as activity-owned logic or a pure sampler invoked by the activity, then pass its resulting pose to both the person record and rig. Preserve the current algorithm. Decide explicitly whether to preserve the prior-sample timing during the structural slice or correct it in a separately characterized behavior change. Include this extraction in the plan rather than leaving it implicit in a rig adapter.

**Acceptance implication:** Run the same Healing Arts scenario without rendering or with render updates skipped. Person position and claim transitions must remain valid; the visible rig must agree when rendering resumes. Include dusk/dawn transitions, an entering dancer, and unload during a borrowed rig. Record any intentional one-frame timing change.

### 4. P2: Make schedule consolidation evidence-driven and include external consumers

**Observed:** The target phase list groups decisions/movement, then collisions, then rendering/effects (`design.md:112-124`), and Task 6.4 (final schedule consolidation) requires removing transitional slots (`tasks.md:62`). Today adult movement can spawn smiles, then `smiles.update` collects them, and children update and spawn smiles afterward (`src/crowd.js:1576`, `src/main.js:1196-1221`, `src/obstacles.js:664`). World streaming and star-love reactions also occur later, before collisions (`src/main.js:1492-1508`). The initial plan correctly warns against moving everything to one call, but the final acceptance still assumes consolidation will be appropriate.

**Design judgment:** Ordering is a contract with systems outside the people runtime. An execution-count test can pass while same-frame collection, visible pose, resource invalidation, or RNG interleaving changes. Renaming the final slots does not eliminate those dependencies.

**Correction:** Make the final schedule a small explicit ordered list at the real integration points, with named dependencies on smile collection, streaming, spatial-index publication, and contact resolution. Allow multiple permanent people-runtime entry points when behavior requires them. Consolidate only where the trace proves equivalence; do not require a scheduler framework or runtime dependency solver to achieve this.

**Acceptance implication:** Compare observable event order as well as controller counts: smile spawn/collect frames, boarding and disembarking, actor removal during streaming, star activation before collisions, and final pose publication. Retaining a documented integration slot should not fail completion merely because the initial draft calls it transitional.

### 5. P2: Prove activity and role extension, not only population registration

**Observed:** The proposed completion proof adds a test-only registered population and checks that main gains no character-specific branches (`tasks.md:70`, `design.md:253-257`). The inventory also promises extensibility for activities, parties, photographers, and substituted avatars (`design.md:187-196`). Current monk and camp-jam integrations depend on detailed Crowd state, shared seat occupancy, and private helpers (`src/monks.js:39-49`, `src/monks.js:57-83`, `src/campJamActivity.js:85-112`). The migration moves all obstacle controllers before extracting these ownership seams (`design.md:226-235`).

**Design judgment:** A trivial population can pass the extension test while Crowd remains the place every new adult role or activity must modify. The riskiest abstraction would then be discovered after a broad mechanical migration. That weakens the user's central goal of a thoughtful structure for people.

**Correction:** Pull one complete adult/activity/renderer ownership slice ahead of the broad obstacle split, then exercise it with a second independent population. Extend the acceptance recipe to three operations: add a population, add an activity to an existing eligible person, and add a render/role variation without forking person lifetime. Use production behavior for the slice; a tiny test-only activity can prove the public contract without adding player-facing content.

**Acceptance implication:** The activity and role examples must work without editing unrelated activities, relying on raw Crowd records, or adding a new runtime role switch. An explicit local activity catalog or selector entry is acceptable. Require the contributor guide to identify the intended registration points and which existing module, if any, must change for each operation.

### 6. P2: State teardown ordering and borrowed-resource ownership, not just idempotence

**Observed:** The plan promises one lifecycle release path and safe shared resources (`design.md:145-150`, `specs/people-runtime/spec.md:83-92`). Current chunk disposal destroys unshared mesh resources before disposing Healing Arts activities (`src/chunks.js:572-589`), while activity release writes the ordinary person renderer (`src/healingArtsActivity.js:40-50`). Existing person cleanup also has separate distance-despawn and explicit-removal implementations (`src/crowd.js:808-868`, `src/crowd.js:2721-2751`).

**Design judgment:** Idempotence does not by itself define which system stops producing updates first or whether a render-binding release may still touch a disposed place. The new API makes that ordering more consequential because cleanup will cross more explicit boundaries.

**Correction:** Specify shutdown order: mark the owner unavailable to new claims and dispatch; invalidate or release active claims while required resources are live; detach borrowed bindings; remove owned publications; then destroy exclusively owned graphics/audio resources. Place-owned adapters must unregister participation without claiming ownership of borrowed person storage or unrelated shared models. Both crowd removal paths must converge on the same ownership-aware release implementation.

**Acceptance implication:** Test person-first removal, place-first unload, controller-first teardown, and repeated teardown in different orders. Assert that callbacks cannot reacquire a claim on an owner being removed and that no release uses an already-destroyed binding. This complements the current shared-resource and registration-count assertions.

## Scope and alternative architecture

The plan is not a full ECS, but its total scope is larger than “thin coordinator”: it adds a scheduler, identity resolver, person view, interaction dispatch, movement authority, activity claims, resource adapters, render bindings, and lifecycle coordination (`design.md:41-54`, `design.md:132-176`). That can still be the right solution, provided the runtime itself remains small and the specialized contracts live beside their owners.

My preferred bounded form is a population directory with ordered dispatch and inspection, plus stable identity and claim primitives. Crowd and the other populations retain their behavior policies; activities retain their algorithms behind explicit claim-checked access; renderers receive poses. Keep resource-specific reservations with their current owners and keep activity-selection precedence local. This implements the plan's best ideas without creating a universal actor behavior framework. The first ownership slice should demonstrate this boundary before committing every family to it.

Place-owned stage performers are a useful counterexample: their current path only animates chunk-owned display groups (`src/chunks.js:114-124`, `src/chunks.js:596-597`). The proposed display adapter is reasonable, but participation should not require a person handle, activity lifecycle, or collision view when none is needed. State that distinction explicitly alongside the required controller capabilities (`design.md:62-83`, `design.md:195`).

## Acceptance implications

Resolve the three P1 findings in the design/specification before implementation begins. Incorporate the P2 findings as explicit tasks and scenarios, with the end-to-end ownership slice preceding broad extraction. Keep the existing performance, collision-order, RNG, importmap, full-game, and process-cleanup requirements; this review does not relax them (`tasks.md:7-11`, `tasks.md:67-72`).

The freeze symptom should be handled as one policy consumer of the new runtime, with an explicit statement of whether it suppresses decision time, animation, incoming reactions, or all three. The current suppression covers Crowd and two vehicles but leaves other populations and late place activity updates active (`src/main.js:1193-1196`, `src/main.js:1219-1244`). Do not quietly classify a corrected freeze policy as behavior-preserving extraction, and do not use fixing it as proof that the ownership refactor is complete.

No runtime tests or browser measurements were performed for this planning review. Source and plan inspection establish the findings; implementation validation remains future authorized work.
