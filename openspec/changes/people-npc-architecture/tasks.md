# People and NPC refactor implementation checklist

Planning, council deliberation, and independent Astra review are complete. Every
checkbox below records implementation work and evidence. The verification foundation
is being implemented under Gary's 2026-10-26 authorization; check tasks only when
their work and evidence actually exist.

The four groups follow the [council synthesis](deliberations/001-architecture/results.md).
Its larger migration tasks are split here into focused slices. Finish the Healing
Arts ownership slice and then children before rolling the contract out broadly.

For every runtime slice: add characterization before changing its production path;
run relevant tests, `npm run check`, and `bin/check-importmaps`; smoke-test the real
game through a ready title-card gesture with a clean console; document the actual
evidence and stop owned browser/server resources. Update CHANGELOG/ROADMAP in the
same commit for observable gameplay, performance, or developer-workflow changes,
with the existing internal-only/documentation-only exceptions. Final documentation
is reconciliation. Preserve RNG draws, shared resources, independent nightness,
instance uploads, and synchronous iOS audio unlock. New nested modules require
checker coverage and all five HTML importmaps before their first extraction.

## 1. Verification and ownership foundation

- [x] 1.1 Record every population, activity, party, vehicle/place dependency, lifetime/removal-policy owner, movement writer, renderer, query provider, audio handle, and external raw-person holder in a coverage ledger.
- [x] 1.2 Extend importmap discovery and stale-entry checking for nested people modules; reconcile map-page coverage with the five-page rule and add negative omission fixtures for every required page before adding source modules.
- [x] 1.3 Add a mixed-population workshop using production constructors and existing photographer, Healing Arts, campsite, camp-jam, and monk fixtures; wire mandatory non-browser contracts into the routine check command.
- [x] 1.4 Capture complete frame/collision/event traces including bubbles, vehicles/seats, spatial sync, adult emission, pickup aging/collection/coalescing/scoring, child emission, late activities, streaming/unload, star-love, contacts, and render publication.
- [x] 1.5 Measure comparable Low/Mid baselines with seed, camera, time, population/claims, effective adaptive quality, physical dimensions, foreground/warmup state, timing distributions, spawn/recycle cost, candidate/matrix operation counts, scene counters, and owned resources.

## 2. Two early ownership proofs and complete migration

The runtime, identity/claim primitives and production Crowd facade are in place.
Task 2.2 (replacement-safe identity and child relocation) remains open until the
real child relocation proof in Task 2.8 (child population slice); its directory,
slot-reuse, runtime/controller replacement and stale-command contracts already pass.
Continue with the Healing Arts sampler and complete ownership slice before children.

- [x] 2.1 Implement the minimal registered controller directory, validated capabilities, stable provider lists, diagnostics, and explicit legacy schedule slots with one execution owner and no autonomous timer/RAF/visibility loop.
- [x] 2.2 Add runtime-issued registration owner tokens plus pooled-slot generations, including safe full-runtime/controller replacement and identity-preserving child relocation; test stale ticks/commands/hits/releases.
- [x] 2.3 Implement claim preparation/commit/revocation and claim-checked movement/binding writes; preserve old activity on acquisition failure, reject reentrant transitions, retain existing precedence/movement algorithms, and define resume behavior.
- [x] 2.4 Converge both crowd removal paths on ordered owner-aware cleanup; test borrower release before disposal, person/place/controller-first removal, attempted reacquisition, collective group requests, and repeated teardown.
- [x] 2.5 Add only the public crowd pose/binding facade needed for Healing Arts, retaining instancing, accessory ranges, packed counts, targeted dirty writes, and a valid final publication barrier without a second population preparation pass.
- [x] 2.6 Extract Healing Arts trajectory/constraint computation from the model into an activity-owned sampler/cache, preserving bootstrap, prior-sample reads, activity-before-sampling order, and legacy near/night-transition sampling cadence independently of render execution.
- [x] 2.7 Complete the Healing Arts vertical slice through public identity/claim/binding operations, removing private renderer writes; verify adoption, entering dancer, dusk/dawn, cooldowns, interruption, unload/revisit, stale references, pool reuse, skipped display, and display resumption.
- [x] 2.8 Complete children as the second vertical slice with independent controller/storage, supported capabilities, inspection, collisions/queries, relocation, grounding, and cleanup; retain gaggle/chase/dodge/smile policies and exact frame barriers.
- [x] 2.9 Prove early extension with a fixture population, an activity for an existing eligible person, and a role/render variation. Demonstrate one behavior implementation borrowing eligible people from two population/storage types and using two distinct place/resource adapters, with explicit capabilities and entry/reservation/exit policy. Forbid raw-record dependencies and central role switches while permitting explicit local selector/catalog entries.
- [x] 2.10 Extract wook behavior into a focused controller with equivalent scatter, collisions, special-mode interactions, lifecycle, and a production-backed fixture.
- [x] 2.11 Extract puppet-parade and brass-band formation controllers in separate reviewable slices, retaining route/recycle rules, collisions, supported reactions, and owned audio cleanup.
- [x] 2.12 Extract hooper and frisbee-pair controllers in separate slices with explicit place/pair authority and unchanged movement, animation, collision, and removal policies.
- [x] 2.13 Migrate monk group intent/avatar binding through public commands, preserving crowd identities, all-or-none boarding, distance-sweep exemptions, collective removal requests, partial-spawn rollback, and one movement writer per member.
- [x] 2.14 Migrate boarding and vehicle-seat reservations, preserving rider exemptions, reservation ownership, safe cancellation, and disembark behavior.
- [x] 2.15 Migrate hammock and picnic activities in separate slices, preserving approach, occupancy, protected states, resource invalidation, and exit policies.
- [x] 2.16 Migrate bathroom and market activities in separate slices, preserving selection order, approaches, interruption, completion, and resource release.
- [x] 2.17 Migrate camp seating/sleeping and camp music in separate slices, retaining world-resource identity checks, time rules, instrument ownership, and bounded audio cleanup.
- [x] 2.18 Isolate photographer role/pose behavior, preserving its salted stream, eligibility/protected states, camera/flash pools, and current timing.
- [x] 2.19 Complete ordered interaction and collision providers, retaining registry-first candidate order, existing kind/damage/score policies and exclusions, single publication of registered movers, pooled wrappers, and selected-hit callbacks.
- [x] 2.20 Complete nearby-person APIs over existing storage with caller filters/locality and scratch reuse; migrate external holders including live-target lost smiles with last-valid-position fallback after removal.
- [x] 2.21 Extract equivalent smile eligibility/reset transitions with separate adult/child gains, retain shared steering, and require equivalence evidence before sharing additional helpers.
- [x] 2.22 Adapt place-owned performers/cooks without allocating interactive identities merely for display; preserve place lifetime, distance gates, and model-only animation ownership.
- [x] 2.23 Adapt one-wheel person/query facets, wagon seat dependencies, and relevant Lurleen participation in separate slices while retaining vehicle physics, existing consumer filters, registry publication, and ambient bird ownership.
- [x] 2.24 Migrate actor animation clocks separately from structural moves, converting stored deadlines/comparisons together; verify accepted-delta advancement, skipped frames, visible/hidden/visible transitions, and no catch-up.
- [x] 2.25 Replace anonymous legacy routes with documented dependency slots, merging only equivalence-proven calls; retain necessary permanent interleaving with non-person systems and remove duplicate/private authority and obsolete obstacle exports.

## 3. Continuous quality gates and final acceptance

- [x] 3.1 Run ownership contracts across every coverage row: pooled/controller/runtime replacement, failed acquisition, same-frame contention, stale movement/release, group rollback, person/place/controller-first teardown, and two unload/revisit cycles with intermediate-order assertions.
- [x] 3.2 Compare complete event/pose/collision traces, pickup ages and score/combo coalescing, boarding/disembarking, late handoffs/hits, accessory packed counts, distant slot reuse, and hidden/skipped-frame execution.
- [x] 3.3 Verify bounded query/render operations, stable hot-path lists and scratch, no new per-person-per-frame handle/view/pose allocation, no duplicate population preparation, and zero additional scene/shadow draws or triangles under equivalent conditions.
- [x] 3.4 Run routine checks and mixed/activity fixtures at Noon/Midnight, then Low/Mid ready-title-card boot, driving/collisions, boarding, streaming/unload/revisit, and console checks; record physical-device limitations and resolve unexplained regressions.
- [x] 3.5 Repeat population/activity/role extension proofs, including the cross-population and cross-place behavior proof, and reconcile an extension matrix for stages, porta-potties, food trucks, Healing Arts and the nut wagon with explicit eligibility and resource ownership. Reconcile the full coverage ledger, remove obsolete compatibility paths, and verify owned tabs, servers, sessions, and exact recorded browser/GPU/daemon PIDs are gone.

## 4. Extension guidance and audit-trail closeout

- [x] 4.1 Maintain a concise integration contract with examples for populations, existing-person activities, and role/render variations, naming intentional registration/selector changes and lightweight display-only participation. Explain how future behaviors connect compatible NPC families to stages, porta-potties, food trucks, Healing Arts and the nut wagon through person capabilities and place/resource adapters, including selection, approach, reservation, interruption, exit and unload ownership.
- [x] 4.2 Add focused dependency checks once boundaries settle, keeping the runtime independent of concrete controllers, models as display leaves, and main as composition root.
- [x] 4.3 Reconcile per-slice ARCHITECTURE, DEBUGGING, capability specs, workshop guidance, evidence, dated CHANGELOG and ROADMAP updates; preserve recorded limitations and rejected alternative rationale.
- [x] 4.4 Check document structure/links/commands, refresh generated README status, and record actual implementation acceptance separately from this completed planning deliverable.

- [x] 4.5 Deliver Gary a before-and-after architecture visual covering every NPC/person family in the coverage ledger, including their update/interaction/collision routes, lifetime and movement owners, activities/groups, rendering/binding ownership, and relevant world/vehicle dependencies. Ground the before view in the recorded pre-refactor baseline and the after view in the completed implementation, distinguish preserved specialization from changed connections, show the reusable extension points for adding behaviors across compatible NPC families and places, explain the visual in plain language, and link it from the change README and final handoff.
