---
change: physical-festival
status: in_progress
current_task: "2.4 (Admission and residency), with production fixture/frame integration still incomplete"
blocked_by: null
open_questions: 0
started: 2026-10-29
last_updated: 2026-10-30
ref: "ROADMAP.md: Gameplay verbs / Physical props"
---

# Physical festival session log

## Key Decisions

- **D1 (planning-only handoff):** Gary requested meticulous documentation and an efficient implementation sequence, not runtime implementation. All implementation checkboxes start unchecked.
- **D2 (shared-branch work):** Gary explicitly permits continuing on `codex/generative-hoop-dancers` alongside the other agent. Preserve unrelated edits; avoid changing branch or committing other work.
- **D3 (contact-driven variety):** Use geometry, speed, balance and surrounding contacts to create variation. Authored animation contributes intent and readability, especially bracing and recovery.
- **D4 (engine evaluation):** Evaluate Rapier first behind a narrow adapter. Dependency choice, numeric budgets and physical tuning remain experiment outcomes, not verified facts.
- **D5 (cooler next):** Gary identifies the newly added cooler as the next distinct physical object after chair interactions. Preserve its polished silhouette and pooled resources.
- **D6 (useful damageable signs):** Gary wants signs at selected intersections pointing toward points of interest; signs may flatten or fall and need not recover. Route truth and damage state are separate contracts.
- **D7 (cups and existing drinks):** Gary wants cups at some chairs/cooler holders and sometimes in NPC hands. Source inspection found ambient handheld drinks already implemented; extend that path rather than add a competing visual system.
- **D8 (complete encounter in stages):** The target is an occupied-chair incident with recovery; first establish empty-chair feel and lifecycle, then people, then production integration and broader props. Social cleanup is explicit later work.

- **D9 (distance-reset default):** Gary approved resetting arrangements once sufficiently far away, unobserved and safely detached from relevant live dependencies. This replaces the proposed retained visit-history store. Followed chairs/carried cups remain live, while lasting progress and reward eligibility retain their own policies.

- **D10 (clean-branch implementation deferral):** Gary explicitly clarified that the current work finishes delegation planning only. Finish the hula-hoop work before beginning physics implementation on a verified clean branch. No implementation workers or branch changes are authorized by the research handoff.
- **D11 (research disposition):** Retain Rapier-first evaluation and the existing ownership/reset architecture. Use the external reports to sharpen failure tests; their performance numbers and incompatible lifecycle recommendations are not accepted evidence. Correct the no-build premise supplied in our own research prompt.

- **D12 (implementation authorized):** On October 30 Gary confirmed clean main and authorized branching and implementation. Created `codex/physical-festival` from `17102a1`, which contains the completed hoop work and physics planning. This supersedes D10 (clean-branch implementation deferral). Real-device and feel gates still require their stated evidence.

## Assumptions

| Assumption | Confidence | Status | Resolution |
| --- | --- | --- | --- |
| Physical humor should remain warm, recoverable and expressive | High, from the discussion and game premise | Proposed default | Validate through the fixture with Gary |
| No numeric change to smiles or strikes is authorized merely by planning | High | Preserve baseline until the tuning gate | Record any selected changes before rollout |
| Remember displaced arrangements after leaving | Superseded | Gary approved distance reset | Retain only live-neighborhood/adopted state; see D9 (distance-reset default) |
| Existing NPC drink participation should remain at its baseline initially | High | Reuse baseline | Change appearance distribution only deliberately |
| Signs use verified local routes; uncertain candidates are omitted | High | Proposed contract | Route and built-clearance tests |

## Dangling Threads

No unanswered question is blocking planning. Numeric tuning, measured capacity and animation/art acceptance are scheduled implementation gates in [tasks.md](tasks.md), not implied approvals or forgotten questions.

## Work Log

### 2026-10-29 -- Existing implementation changes the starting point

**Event:** discovery

**What:** Camp chairs are already batched and campsite child props already collide; stage chairs still lack hard colliders. NPC appearance already selects occasional drinks and Crowd renders them in packed slots. The cooler has real holder recesses, but its material-grouped lid mesh includes body-mounted details, and its camp collider currently references the canopy group. These facts replace the older backlog's intangible-chair/no-build assumptions.

**Refs:** [Evidence ledger](evidence.md); [proposal](proposal.md); [design](design.md).

### 2026-10-29 -- Shared checkout authorized

**Event:** decision

**What:** Gary approved completing these documents on the hula-hoop branch alongside the other agent. Runtime and unrelated planning files remain outside this task's ownership. The active cooler edits changed during the survey, so implementation must recheck source rather than treat line anchors as immutable.

**Refs:** D2 (shared-branch work); [evidence freshness](evidence.md).

### 2026-10-29 -- Council contracts integrated

**Event:** decision

**What:** A real Tier 3 synthesis with Architect, Adversary, Profiler and Mediator returned Proceed with mitigations. The plan now specifies the late contact/publication schedule, canonical generation clearance separate from live motion, prepared reaction-owned seat adoption, bounded suppression state, mandatory body/collider/render/event release reserves, shared work admission, controlled device comparisons and sign evidence independent of render residency. All implementation tasks remain unchecked.

**Refs:** [Council synthesis](deliberations/001-plan/results.md); [design](design.md); [tasks](tasks.md); [verification](verification.md).

### 2026-10-29 -- Planning handoff validated

**Event:** phase-change

**What:** All six OpenSpec planning artifacts are complete. Strict validation and generated README freshness passed; the local checker resolved links/Markdown anchors across 23 plan/review files and confirmed 66 unique unstarted implementation tasks. The final table-of-contents and cross-reference reading covered the front door, design, ordered tasks and council synthesis. Whitespace validation passed. This task changed documentation only; concurrent hula implementation remains owned by the other agent. No game or device test is claimed.

**Refs:** [README](README.md); [verification policy](verification.md); `openspec validate physical-festival --strict`; `bin/readme-sync physical-festival --check`; `git diff --check`.

### 2026-10-29 -- Reset simplification approved; model allocation proposed

**Event:** decision

**What:** Gary accepted distance-based reset and requested a task/model allocation. The current design, tasks, specs and verification now use temporary neighborhood state without displacement-history serialization/eviction. The original council files remain historical, with a linked amendment. The delegation map recommends Sol for most bounded implementation, Luna for narrow support, and Astra for cross-system contracts and final integration decisions; this records recommendations and does not launch implementation agents.

**Refs:** D9 (distance-reset default); [amendment](deliberations/002-distance-reset.md); [delegation plan](delegation.md).

### 2026-10-29 -- External research checked against the project

**Event:** discovery

**What:** Gary supplied four research reports. Preserved exact source copies with SHA-256 hashes and assessed consequential claims against official API/source documentation and the current checkout. The research brief had incorrectly supplied an obsolete no-build premise. The reports add useful test cases but do not demonstrate device performance; duplicate live cups, automatic retirement of support, an assumed Recast dependency, and a required skeletal migration are rejected. Strengthened four existing tasks and the verification plan without changing the 66-task scope or delegation. All implementation tasks remain unstarted, pending the completed hoop work and clean-branch gate.

**Refs:** D10 (clean-branch implementation deferral); D11 (research disposition); [research synthesis](research-synthesis.md); [source archive](research/README.md); [delegation plan](delegation.md); [verification](verification.md).


### 2026-10-30 -- First engine fixture verified

**Event:** phase-change

**What:** Implemented the standalone Rapier 0.21.0 adapter, fixed clock, provisional chair/cooler recipes and Vite interaction page. Real-engine tests cover contact, frame-rate invariants, allocation failure and teardown. Desktop development and production browser checks passed, including the real game's ready-mode click. This is partial work within the foundation groups, with only the source baseline task accepted. Controller, terrain, ownership, occupants, real-device and feel gates remain pending. The captured cold production fixture allocation was 313.6 ms and is not a warm performance result. A phone-availability question was presented to Gary; no response or device acceptance is recorded.

**Refs:** [Evidence and next steps](../../../verification/physical-festival/README.md); [source baseline](../../../verification/physical-festival/2026-10-30-baseline.md).


### 2026-10-30 -- Apple device available

**Event:** decision

**What:** Gary answered Q1 (Physical-phone availability), confirming an iPhone or iPad is available. Device model, OS, browser and measured results remain to be recorded during the playtest. This resolves availability without claiming device acceptance.

**Refs:** [Answered question](questions-for-human.md#answered).


### 2026-10-30 -- Startup side quest released

**Event:** phase-change

**What:** Gary requested merging and pushing the isolated startup recovery fix before returning to physics. Commit `094f144` is on main, GitHub Pages run `41063357506` passed, and the live game recovered from a download failure and reached a playable Just Cruisin' session. Physics remains on its original branch with uncommitted work preserved. Next physics checkpoint is completing the production fixture/controller and terrain contracts before the physical-phone acceptance run.

**Refs:** [Release evidence](../../../verification/boot-recovery/README.md); [deployment](https://github.com/GaryReckard/zerble-at-the-festival/actions/runs/41063357506).


### 2026-10-30 -- Controller and triangulated terrain proof

**Event:** discovery

**What:** Continued on `codex/physical-festival-integration` at `4aa8d47`, combining startup recovery and the photographer baseline while preserving the original worktree. Added fixed-step sampling of accepted real Zerble controller poses, isolated from interpolated presentation, and bounded exact production-terrain meshes. The real-controller regression passes at 30/60/120 Hz with flat and enabled terrain. A reduced one-ball reproduction traced a Rapier panic to a deficient test browser stub: defining `window` without `window.performance` breaks its timing import. Supplying the actual Node performance API resolves the panic; no solver workaround was introduced. The regression now runs in `npm run check` and `npm run test:physics`. Production frame barriers, ownership and physical-device acceptance remain pending.

**Refs:** `bin/test-physics-controller`; `bin/test-physics-terrain`; `src/physics/cartTrajectory.js`; [verification](../../../verification/physical-festival/README.md).


### 2026-10-30 -- Cart discontinuities and ghost clearance

**Event:** decision

**What:** Added a reusable cart proxy bridge that consumes accepted trajectories and named reset reasons. Ghost exit and discontinuous relocation disable contacts until a bounded direct-shape query establishes clearance, clearing old kinematic targets and velocities before reactivation. This avoids an explosive overlap correction without moving the chair or cart artificially. Tests cover zero-step expiry, overlap waiting, clear reentry, every named reset and resumed real solver contact. The production-controller fixture exposes ghost mode; main-game transition calls and frame-barrier wiring remain unfinished, so Task 2.5 (Cart proxy and resets) remains unchecked.

**Refs:** `src/physics/cartProxy.js`; `bin/test-physics-cart-proxy`; `bin/test-physics-controller`; `src/physics/rapierAdapter.js`.
