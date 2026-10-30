---
change: physical-festival
status: not_started
current_task: null
blocked_by: null
open_questions: 0
started: 2026-10-29
last_updated: 2026-10-29
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
