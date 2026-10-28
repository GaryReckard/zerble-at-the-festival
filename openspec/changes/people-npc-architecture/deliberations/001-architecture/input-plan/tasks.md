# People and NPC refactor implementation checklist

Planning and deliberation are the current authorized deliverable. Every checkbox
below is future implementation work and intentionally remains unchecked. Completion
of the planning deliverable does not mean the refactor has shipped.

For every runtime slice: run relevant behavioral checks, `npm run check`, and
`bin/check-importmaps`, then smoke-test the real game through a ready title-card
gesture with a clean console. Record evidence and stop owned browser/server resources.
New modules belong in all five HTML importmaps per current AGENTS.md. Preserve RNG
draw order, independent nightness polling, shared pools, and iOS audio unlock.

## 1. Characterization and verification foundation

- [ ] 1.1 Inventory every person, group, activity, renderer, vehicle dependency, spatial provider, audio handle, and lifetime owner; capture the actual frame/candidate order.
- [ ] 1.2 Build executable baseline scenarios for adult/child smiles, reactions, collision selection, boarding, activity cancellation, and pooled-slot reuse using real behavior methods with controlled inputs.
- [ ] 1.3 Add a mixed-population workshop using production constructors and scoped query services; extend existing Healing Arts, campsite, camp-jam, and photographer fixtures instead of duplicating their logic.
- [ ] 1.4 Measure comparable Low/Mid baselines for update cost, steady allocations, spawn cost, draws, triangles, programs, and owned-resource counts; record seed, location, population, time, samples, and device limitations.

## 2. Runtime, identity, and lifetime contracts

- [ ] 2.1 Implement validated controller registration, declared capabilities, reusable diagnostics, explicit schedule slots, and execution-owner assertions; test duplicate keys and double ticking.
- [ ] 2.2 Adapt current calls at their existing positions, including nested party/activity updates, and remove each replaced call so ordering and RNG draws remain equivalent.
- [ ] 2.3 Introduce stable controller/slot/generation handles over existing records and define child relocation identity; test stale commands and releases after pool reuse.
- [ ] 2.4 Implement idempotent controller/person removal with explicit ownership of claims, bindings, spatial facets, and audio handles; verify repeated cleanup and shared-resource survival.
- [ ] 2.5 Expose common inspection and population counts through runtime providers so the debug interface reaches every registered controller.

## 3. Focused populations and public person access

- [ ] 3.1 Extract child population behavior into a focused controller with person views and production fixture while preserving gaggle size, chase, dodge, smile, recycling, grounding, and collider behavior.
- [ ] 3.2 Extract wook behavior and lifecycle with equivalent scatter, collision, and special-mode interaction behavior.
- [ ] 3.3 Extract puppet-parade and brass-band formation controllers with unchanged route/recycle policy and explicit audio cleanup.
- [ ] 3.4 Extract hooper and frisbee-pair controllers with explicit place/pair ownership and unchanged animation and collision behavior.
- [ ] 3.5 Add callback-based nearby-person providers over existing storage, avoiding per-frame wrapper allocation; preserve consumer-specific filters.
- [ ] 3.6 Migrate all obstacle-module imports and remove the old collection after verifying sandbox and full-game consumers; leave no competing implementation.

## 4. Crowd, activities, groups, and render boundaries

- [ ] 4.1 Extract a crowd render facade over existing instance pools and public pose/binding commands; preserve pool caps, batch shape, shadows, and dirty uploads.
- [ ] 4.2 Introduce generation-safe activity claims and explicit movement/render authority with existing interruption eligibility; prove stale release cannot cancel a later activity.
- [ ] 4.3 Adapt boarding and vehicle-seat reservations, including group acquisition rollback and valid exit behavior, while retaining rider despawn exemptions.
- [ ] 4.4 Adapt hammock and picnic activity claims, release paths, and resource invalidation checks.
- [ ] 4.5 Adapt bathroom and market activities with explicit completion/interruption cleanup and unchanged approach/exit behavior.
- [ ] 4.6 Adapt camp seating/sleeping and camp music, retaining resource identity checks, session timing, and owned instrument/audio cleanup.
- [ ] 4.7 Adapt Healing Arts borrowed identity and articulated rig binding; remove private renderer calls and verify arrival, dusk, dawn, interruption, and tent unload.
- [ ] 4.8 Adapt monk-party intent and avatar binding through public APIs; preserve one crowd identity and one movement update per member and remove private crowd writes.
- [ ] 4.9 Isolate photographer behavior/pose boundary while preserving its salted profile, random stream, pooled flash, and protected-state eligibility.

## 5. Interactions, spatial publication, and shared rules

- [ ] 5.1 Route honks, cheers, selected hits, and star/love reactions through declared capabilities with stable order and unchanged per-controller eligibility.
- [ ] 5.2 Replace manual collision arrays with ordered providers; preserve registry-first ordering, all exclusions/classification, and prevent double publication of registered movers.
- [ ] 5.3 Extract shared smile eligibility/reset transitions with separate gain profiles and baseline equivalence tests for adults and children.
- [ ] 5.4 Migrate existing shared steering consumers without rebalancing; extract further common helpers only where equivalent production consumers justify them.
- [ ] 5.5 Introduce explicit simulation time for extracted actor animation independently from structural moves, verifying phase continuity and recording intentional differences; retain independent world-nightness reads.

## 6. Place/vehicle adapters and final scheduling

- [ ] 6.1 Adapt place-owned stage performers and cooks to explicit display/lifetime participation without creating duplicate interactive people or transferring chunk ownership.
- [ ] 6.2 Adapt one-wheel rider person/query facets and nut-wagon seat/controller dependencies while preserving vehicle motion, collision publication, and original query filters.
- [ ] 6.3 Integrate Lurleen's relevant runtime/interaction participation while retaining her separate cart physics and relationship state; keep birds under ambient ownership.
- [ ] 6.4 Consolidate verified schedule dependencies into named phases, proving seat-transform/index/intent/movement/collision/render order and removing transitional slots.
- [ ] 6.5 Remove remaining per-character orchestration branches and cross-controller private writes; document every intentionally retained adapter and its singular authority.

## 7. Acceptance, documentation, and extension proof

- [ ] 7.1 Run the full contract suite across each controller: one execution owner, stale identity rejection, activity handoff, interruption, collision equivalence, removal, and repeated teardown.
- [ ] 7.2 Verify mixed-population sandbox and existing activity fixtures at Noon/Midnight, then real-game Low/Mid title-card boot, driving collisions, boarding, streaming/unload/revisit, and clean console.
- [ ] 7.3 Compare update/spawn/allocation and rendering measurements to the recorded baseline; investigate unexplained regressions and distinguish desktop evidence from physical-device acceptance.
- [ ] 7.4 Prove the extension recipe by adding a test-only registered population fixture without character-specific main-loop, collision, honk, debug, or cleanup branches.
- [ ] 7.5 Update ARCHITECTURE, DEBUGGING, the applicable capability specs, extension guidance, verification record, dated CHANGELOG, and ROADMAP; run document/link and import checks and refresh the change README.
- [ ] 7.6 Verify browser/server cleanup and no remaining owned resource registrations, remove obsolete compatibility paths, and record final acceptance limits before declaring the refactor implemented.
