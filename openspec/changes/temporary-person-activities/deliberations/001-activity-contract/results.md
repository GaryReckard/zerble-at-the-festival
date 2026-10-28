# Deliberation Summary

## Context
- **Task**: Plan temporary hula, paired frisbee, and dance activities for existing people, including urgent cart reactions and validated resumption.
- **Personas Consulted**: Architect, Adversary, Pragmatist, and Mediator
- **Date**: 2026-10-27
- **Mode**: Synthesis. The three positions were written independently; the mediator identified the tensions below.

## Synthesized Plan

### Change Group 1: Characterization and the hula verification surface
**Scope**: Establish the existing behavior and a production-backed path through the first complete cycle, without changing the completed people architecture.
**Estimated Effort**: 1–2 focused sittings.
**Tasks**:
1. Characterize current adult danger and honk behavior, including reverse travel, parked honks, star power, blocked exits, potty occupants, and riders. Record hula and frisbee ownership, appearance, seeded placement, collision and disc behavior, plus the existing render and scoring barriers ([adversary](council-adversary.md), [pragmatist](council-pragmatist.md), [dependency slots](../../../people-npc-architecture/dependency-slots.md)).
2. Extend the existing production-backed people fixture to expose an eligible Crowd-owned person, an actual hula venue and reservation, full cart driving state, and the published body and collider. It must exercise the real controllers and frame order, rather than a substitute simulation ([pragmatist](council-pragmatist.md)).
3. Specify explicit adult and venue eligibility, finite interruption and cancellation policies, and the conditions for a safe return. Keep other populations excluded unless their existing contracts explicitly support participation ([architect](council-architect.md), [extension guide](../../../people-npc-architecture/extension-guide.md)).

### Change Group 2: Implement and prove activities in sequence
**Scope**: First ship the complete hula cycle, then apply its proven handoff to paired frisbee and eligible dancing.
**Estimated Effort**: 4–7 focused sittings, subject to what the characterization reveals.
**Tasks**:
1. Implement a narrowly scoped handoff at the existing claim boundary. Crowd retains person lifetime, personality, ordinary movement and collider, while the activity owns its prop and reservation. Before the existing steering and honk reaction moves a participant, invalidate activity pose and binding writes, including later writes in the same frame. Preserve protected or blocked states rather than forcing a flee ([architect](council-architect.md), [adversary](council-adversary.md)).
2. Treat a revoked claim as permanently invalid. Keep any pending session and reservation under separately defined ownership, or release and reacquire the reservation; in either case validate person incarnation, venue, resources and safety before obtaining a fresh claim. Cancel and return to ordinary behavior when validation fails or the bounded wait expires. Exercise failed preparation, reentrant removal and repeated interruptions ([activity claims](../../../../../src/people/activityClaims.js), [architect](council-architect.md)).
3. Migrate hula participation from the specialized owner to eligible existing adults, retaining the hooper experience without a second person or collider. Prefer the original appearance binding with an activity-owned hoop; if a replacement rig is necessary, expose and verify the complete appearance rather than copying only shirt and skin. Prove ordinary person → hula → charging or honking cart → dodge → safe resume → finish and walk away before proceeding ([architect](council-architect.md), [adversary](council-adversary.md)).
4. Convert frisbee to a session owning two borrowed participants and one disc. Acquire both participants and resources atomically or roll back; on either participant's danger or invalidation, stop throws and catcher pursuit, resolve held, flying and landed disc states safely, and coordinate validated restart or cancellation for both ([pragmatist](council-pragmatist.md), [frisbee owner](../../../../../src/people/frisbees.js)).
5. Apply the same handoff to eligible Healing Arts dancing, preserving its place ownership, existing independent nightness and sampling slot. Retain ordinary stage-front sway as ordinary behavior unless a reservation is actually needed ([architect](council-architect.md), [dependency slots](../../../people-npc-architecture/dependency-slots.md)).

### Change Group 3: Quality gates
**Scope**: Verify each slice against production behavior and lifecycle boundaries before treating it as shippable.
**Estimated Effort**: 2–3 focused sittings across implementation.
**Tasks**:
1. Add meaningful production-backed tests for trajectory and honk reactions, rejected stale writes, identity and full appearance continuity, one visible body and collider, safe departure and resumption, and cancellation on person, venue, partner or resource invalidation. Test repeated interrupts, acquisition rollback, disc states, and two unload cycles ([adversary](council-adversary.md), [pragmatist](council-pragmatist.md)).
2. Run the relevant existing ownership tests and `npm run check`, then verify the fixture and the real game through the title-card gesture, world boot, cart charge and honk, collision, scoring, streaming and console inspection. Preserve frame barriers and distinguish a muted boot from a physical iOS audio-unlock check ([AGENTS.md](../../../../../AGENTS.md), [adversary](council-adversary.md)).
3. Inspect appearance at noon and midnight, and check the budget panel and relevant Low and Mid tiers for rendering changes. Keep low, mid and high within the stated 80/150k, 200/400k and 400/1.2M draw/triangle guides; record measured baselines and avoid unneeded shadow casters ([AGENTS.md](../../../../../AGENTS.md), [pragmatist](council-pragmatist.md)).
4. Inspect process ownership before starting browser or server resources, reuse a suitable server where appropriate, and close only resources owned by this work. Follow the local browser cleanup override and avoid the known unsafe layout snapshot capture ([local override](../../../../../AGENTS.override.md)).

### Change Group 4: Polish and documentation
**Scope**: Keep the delivered behavior and project contracts discoverable.
**Estimated Effort**: Half to one focused sitting.
**Tasks**:
1. Update the focused OpenSpec artifacts with the implemented authority, eligibility, interruption, disc-state and cancellation contracts, and record the actual verification results and limitations.
2. Update CHANGELOG for player-visible behavior and reconcile ROADMAP with what shipped. Preserve existing RNG draw order and use fresh salts for new randomness, honor shared-resource disposal and lake ownership, retain synchronous iOS audio initialization, use the Three.js shim for tier overrides, and update all five importmaps if a new source module is added ([AGENTS.md](../../../../../AGENTS.md), [config](../../../../config.yaml)).

## Final Recommendation
Proceed with mitigations, beginning with characterization and the production-backed hula fixture. Ship the hula cycle only once urgent reactions reliably supersede activity writes, then reuse that verified handoff for frisbee and dancing without changing the established population or frame architecture.

---

## Convergence Points
- All three personas place the existing Crowd person and the complete hula cycle before paired frisbee and dance, and require activity writes to lose authority before a cart reaction ([architect](council-architect.md), [adversary](council-adversary.md), [pragmatist](council-pragmatist.md)).
- All require production-backed verification, one body and collider, explicit eligibility, protected-state handling, resource validation, and the existing frame and scoring barriers ([architect](council-architect.md), [adversary](council-adversary.md), [pragmatist](council-pragmatist.md)).
- All agree that frisbee needs coordinated participants and explicit disc-state handling, rather than allowing catcher movement during a reaction ([architect](council-architect.md), [adversary](council-adversary.md), [pragmatist](council-pragmatist.md)).

## Conflicts Resolved
| Conflict | Persona A Position | Persona B Position | Resolution | Rationale |
| --- | --- | --- | --- | --- |
| How to preserve a resumable session after interruption | Architect recommends revoking the claim and reacquiring a fresh one, with any retained reservation separately owned and protected. | Pragmatist describes a narrow suspension protocol that may retain or release a separately validated reservation; Adversary also permits a tested temporary authority protocol. | A revoked claim is never reused. A pending session may retain a separately owned reservation or release and reacquire it, provided both paths have explicit validation, cleanup and bounded cancellation. | The current release callback cleans claim-owned resources, and stale claims cannot write; treating release as a pause would violate that contract ([activity claims](../../../../../src/people/activityClaims.js), [architect](council-architect.md), [pragmatist](council-pragmatist.md), [adversary](council-adversary.md)). This is an implementation choice within shared constraints, not a disagreement about the required outcome. |
| Appearance continuity versus existing activity rigs | Architect and Adversary prefer retaining the original body where feasible, while noting that the public view is insufficient for reconstructing the full appearance. | Pragmatist calls for migrating the existing hooper experience and verifying appearance, without prescribing a rig. | Prefer the existing binding plus owned props; permit a replacement only with a scoped complete appearance contract and verified single-body/collider transitions. | This preserves player identity and avoids assuming the existing partial view is complete ([architect](council-architect.md), [adversary](council-adversary.md), [pragmatist](council-pragmatist.md)). |
| Speed of delivery versus production schedule coverage | Pragmatist proposes two incremental slices, beginning with a hula fixture and game integration. | Adversary calls out late writes, hidden rigs and frame/scoring barriers as risks that a fixture alone could miss. | Keep the incremental slices, but require real schedule, collider and game-boot verification for each slice before it is considered complete. | The positions are complementary: speed does not override the game boot or same-frame authority gate ([pragmatist](council-pragmatist.md), [adversary](council-adversary.md)). |

## Risk Register
| Risk | Severity | Mitigation | Owner (persona that flagged it) |
| --- | --- | --- | --- |
| Late activity writes undo an urgent dodge or honk reaction. | Critical | Invalidate authority before Crowd reacts and test subsequent writes in the real frame schedule. | Adversary, Architect, Pragmatist |
| Revoked claims release resources, leaving a stale reservation or invalid resume. | High | Separate session and reservation ownership from the revoked claim, validate incarnation and resources, reacquire a fresh claim or cancel, and test reentrant cleanup. | Architect, Adversary, Pragmatist |
| Replacement rigs lose hair or clothing identity, suppress honk/collision, or create duplicate bodies. | High | Prefer the original binding; otherwise verify a complete appearance transfer and singular visible body and authoritative collider. Distinguish hidden rigs from protected occupants. | Architect, Adversary |
| A frisbee partner or venue disappears while the catcher pursues a disc. | High | Stop both participants coherently, resolve every disc state, and roll back or cancel the session on invalidation. | Adversary, Architect, Pragmatist |
| A generic reaction violates potty, vehicle or blocked-seat constraints. | High | Reuse the owner's physical eligibility and exit-clearance rules, and allow protected or deferred responses. | Adversary, Architect, Pragmatist |
| Streaming, scoring or cleanup diverges from fixture behavior. | High | Preserve frame barriers and ownership, test repeated unloads and real game boot, and honor pooled-resource disposal rules. | Architect, Adversary |
| RNG, Safari module behavior or iOS audio startup regresses during integration. | Medium | Preserve existing draws, use fresh salts, route overrides through the shim, and keep audio initialization synchronous; distinguish automated boot from a physical iOS check. | Adversary |

## Verdicts Summary
| Persona | Key Concern | Verdict |
| --- | --- | --- |
| Architect | Urgent movement must supersede activity writes while preserving identity and safe reservation ownership. | Proceed with mitigations. |
| Adversary | A later activity write or stale reservation can invalidate the interruption. | Proceed with mitigations. |
| Pragmatist | The hula handoff must be proven with a real person before extending it to pair and dance controllers. | Proceed with mitigations. |
