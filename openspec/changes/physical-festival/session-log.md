---
change: physical-festival
status: in_progress
current_task: "Live seated/ordinary-person falls integrated; incident attribution, broader props and phone acceptance pending"
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

- **D13 (empty objects are not a smile penalty):** Gary answered Q2 (Empty-object scoring) with “No smile penalty for empty objects.” Empty contacts retain physical resistance and sound, while person incidents and explicit occupied-furniture behavior remain separate. This supersedes the initial numeric-baseline policy for empty props.

- **D14 (cooler enrollment after positive chair feedback):** Gary said the work was “looking good to me so far,” asked for more smashable objects, specifically coolers, and reaffirmed people falling. Proceed with closed-cooler integration as the next object while retaining the uncompleted phone gate and occupied-person scope. This is early positive motion feedback, not approval of every feel/device scenario.

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

### October 30: clear stand-up recovery

The fixture now completes a fall, bounded local path search, slide/rise with gradual leg unbending, and release back to ordinary person control. Real-engine tests include second impact, blocked/changed routes, despawn and a thin-wall negative case. Planning runs four path samples per accepted step rather than a whole candidate in one frame. Live occupied-chair admission, shared-budget accounting and production terrain support remain next; no broad acceptance box changed. See [proof](../../../verification/physical-festival/2026-10-30-stand-recovery/README.md).

### October 30: first composed visible sitter fall

The supported/falling controller now publishes the existing Crowd instance through a real-engine tipped-chair fixture. Its continuity regression caught a stale collider world transform after setPose; load reads now compose current body and local transforms. Both tiers settle with one release and no added draws. Final chair/body overlap remains visible, so safe stand-up planning is required before acceptance or live rollout. See [proof](../../../verification/physical-festival/2026-10-30-seat-reaction/README.md).

### October 30: settled support overlap

A real tilted-seat release can leave the body and chair overlapping after landing. The contact exclusion must survive until shape queries prove clearance; a timer would reintroduce depenetration energy. Added reserved pair filtering and a negative-control regression. Live recovery still needs a clear standing target; no occupied-reaction acceptance checkbox changed. See [evidence](../../../verification/physical-festival/2026-10-30-support-contacts.md).

### 2026-10-30 -- Changing seated mass must preserve point motion

**Event:** discovery

**What:** Rapier linear velocity belongs to the center of mass, so adding or removing an off-center seat load cannot simply retain that vector. Added bounded per-seat mass sensors with no contacts and recomputed the center velocity to retain the supporting body's existing point motion. Real-engine loveseat tests prove independent loads, continuous remaining-seat velocity, and mass/linear-momentum continuity when one load becomes a free body. This advances Task 5.2 (Supported load and bracing), but does not enable occupied chairs or accept the bracing controller.

**Refs:** [Supported-load proof and remaining work](../../../verification/physical-festival/2026-10-30-supported-loads.md); `bin/test-physics-supported-loads`.

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


### 2026-10-30 -- Bounded preparation and retained chair bindings

**Event:** decision

**What:** Added shared terrain-tile residency with transactional replacement, explicit capacities/retries and a caller-provided deadline rather than a second streaming budget. Added an admission ledger that reserves mandatory sitter/cup releases before optional allocations, with generation-checked cleanup. Retained campsite chair semantic slots and part-to-instance bindings; the physics playground now uses those bindings for real solver motion. Matrix tests preserve all four styles, shared materials, original transforms and palette draws, then test transformed parents, bounds, visibility, dirty ranges and late callbacks after disposal. These are implementation primitives and fixture proofs; live activation, registry publication and owner adoption remain unconnected, so the broader tasks remain unchecked.

**Refs:** `src/physics/terrainResidency.js`; `src/physics/admissionBudget.js`; `src/propRendering.js`; `bin/test-prop-rendering`; `bin/test-physics-terrain-residency`; `bin/test-physics-admission`.


### 2026-10-30 -- Canonical placement and independent chair rendering

**Event:** discovery

**What:** Campsite registration now exports stable physical chair descriptors with the captured batched world pose and actual seat claims. Registry enrollment preserves canonical generation geometry while publishing moved live geometry and transferring chunk ownership. Integration testing caught missing neighborhood/forest-owner metadata in the generation copies; retaining those values preserves existing placement exemptions, including after owner transfer. An independent capped instance pool survives source-batch disposal. World streaming exposes one optional preparation callback against its existing absolute deadline; exhausted frames skip it and preparation reduces the horizon remainder. Production activation, origin-regeneration suppression, occupied support, contact policy and device acceptance remain unfinished.

**Refs:** `src/campRegistry.js`; `src/registry.js`; `src/physics/activePropRendering.js`; `bin/test-registry-physical`; `bin/test-chunk-deadline`; [checkpoint verification](../../../verification/physical-festival/2026-10-30-ownership/README.md).


### 2026-10-30 -- Empty-chair adoption transaction

**Event:** discovery

**What:** The chair owner now coordinates real solver bodies, registry enrollment, independent render slots and reserved capacity, rejecting occupied seats and unprepared support. Tests caught a ghost-seat hazard when retirement left the source camp alive; retired seats now remain unavailable, while successful restoration or rollback reopens them only after conflicting resources are released. Failed cleanup retains explicit diagnostics and accounted surviving resources for retry. No automatic distance choice or production activation is installed yet.

**Refs:** `src/physics/chairOwnership.js`; `bin/test-physics-chair-ownership`; [checkpoint evidence](../../../verification/physical-festival/2026-10-30-ownership/README.md).


### 2026-10-30 -- First production chair impact

**Event:** discovery

**What:** Connected empty-chair adoption and terrain/static residency to the production late contact barrier behind `physics=1`. Real browser testing exposed repeated admission churn from an undersized render bucket and staging against a chair claimed by an NPC. Increased bounded per-bucket capacity, added a bounded rejection cache, and required the selected target to be admitted before enabling the coast control. A subsequent real impact reduced smiles once; diagnostics recorded no admission rejection, overflow or support stop. Repeated origin replacement now preserves the adopted chair and prevents duplicates, including lake disposal. Full check/build and Low/Mid Noon/Midnight desktop captures passed; the staging helper also has obstruction, water and bounded-search tests. Full task contracts remain unchecked because phone performance, final frontier behavior and occupied support are unfinished.

**Refs:** [live checkpoint and phone procedure](../../../verification/physical-festival/2026-10-30-live/README.md); `bin/test-physics-live-world`; `bin/test-physics-chair-ownership`; `bin/test-physics-static-residency`.


### 2026-10-30 -- Support prediction and substep barrier

**Event:** discovery

**What:** A frame-level velocity check cannot observe an impulse from an earlier solver step within the same frame. Moved the support guard to the fixed-step boundary and explicitly discard blocked time; tests exercise a real-engine velocity change after the first step. Support requests now preserve a stable margin and include bounded forward prediction. The full check/build and a fresh real-game encounter passed. This improves the prototype but does not accept arbitrary within-step impulses, rotational bounds or the global-stop overload policy. Gary asked to play, so a separate LAN preview is intentionally running; do not rebuild its dist files or stop it during his playtest.

**Refs:** [support checkpoint](../../../verification/physical-festival/2026-10-30-frontier/README.md); `src/physics/supportWindow.js`; `bin/test-physics-runtime`.


### 2026-10-30 -- Rotation-safe support bound

**Event:** discovery

**What:** The previous support guard used the last published horizontal footprint, which can understate a chair's reach during later rotation. Admission now records a conservative sphere from the union of scaled visual and collision bounds; support planning and guards consume it while registry avoidance retains its current footprint. Four-style, 32-orientation tests, full checks, an isolated production build and real ready-button encounter passed. A new real-engine starvation test holds one launched chair without pose drift and resumes after preparation returns. Multi-object pressure and the global-stop fallback remain unaccepted. Gary's playtest build/server were preserved.

**Refs:** [rotation and starvation evidence](../../../verification/physical-festival/2026-10-30-rotation/README.md).


### 2026-10-30 -- Stage audience collision gap and render capacity

**Event:** discovery

**What:** Gary reported pass-through stage chairs. Their audience registry entries lacked both colliders and physical descriptors. Added shared registration with row/slot keys, actual batch bindings, seats and stage-front lifetime for open/tent stages, preserving audience kind and existing RNG draws. A separate nine-chair test found the per-bucket render limit admitted only six matching sling chairs despite an eight-chair service limit. The pool now fills matching buffers before adding another bounded buffer; four-style capacity, source-unload, regeneration and disposal tests pass. Full checks/build pass; browser evidence verifies stage admission/rendering, while real-engine tests prove impacts. The staging shortcut can choose a distant campsite when dense stage rows have no clear circular approach, and browser keyboard automation did not move the cart. Neither is counted as a stage-impact browser pass.

**Playtest server:** Gary's localhost failure was traced to an unrelated Python listener on 127.0.0.1:8765 alongside the owned wildcard Vite listener. Moved the preview to 8767 and verified HTTP 200 on localhost and LAN. The current user-requested preview serves `/tmp/zerble-stage-build.g6mhxQ` on 8767 (session 78833). Leave it running for Gary; port-8766 verification and browser tabs are closed.

**Refs:** [stage/capacity evidence](../../../verification/physical-festival/2026-10-30-stage/README.md).


### 2026-10-30 -- Bounded hinge API proof

**Event:** decision

**What:** Added only the revolute joint API needed by the planned lid experiment, rather than exposing the entire engine constraint API. Joint capacity defaults to zero; tokens carry world and generation identity. Real Rapier tests verify limits, anchors, latch constraints, body-removal cleanup, post-allocation rollback and repeated reuse. Full check/build and an isolated ready-button game boot passed with existing chairs and no joints allocated. This advances Task 2.1 (Engine loading proof) without accepting the cooler or bypassing the physical-device gate. Gary's stage preview remains on port 8767 from `/tmp/zerble-stage-build.g6mhxQ`, session 78833.

**Refs:** [hinge adapter evidence](../../../verification/physical-festival/2026-10-30-joints/README.md); `bin/test-physics-joints`.

### 2026-10-30 -- Object and person reactions must diverge

**Event:** decision

**What:** Gary objected to Zerble reacting identically to objects and people. The simulated-chair path called the existing person-hit reverse kick. Replaced that call with mass/approach-sensitive slowdown without a position jump or immunity. This is the first part of the response separation; fixed/legacy obstacles and occupied incidents remain unfinished. Asked whether empty-object collisions should also stop costing smiles; the answer is pending and scoring remains unchanged.

**Refs:** [Response evidence](../../../verification/physical-festival/2026-10-30-prop-feedback/README.md); Q2 (Empty-object scoring) in [questions](questions-for-human.md).

### 2026-10-30 -- Fixed scenery no longer reverses the cart

**Event:** decision

**What:** Extended Gary's object/person distinction to the legacy solid path, so unadmitted chairs and fixed scenery resolve overlap and lose incoming speed without the person reverse kick. Kept person reactions, numeric consequences and the existing collision cooldown unchanged. The cooldown still suppresses all legacy contacts temporarily; separating physical solidity from that consequence gate remains unfinished rather than hidden by the new response. Q2 (Empty-object scoring) remains unanswered.

**Refs:** [Solid response evidence](../../../verification/physical-festival/2026-10-30-solid-response/README.md); Task 4.2 (Single response owner) in [tasks](tasks.md).

### 2026-10-30 -- Cooldown protects consequences, not solid scenery

**Event:** discovery

**What:** The legacy main loop skipped every collision during the person-hit immunity timer, and the physical world suppressed cart feedback using the same eligibility flag. Separated those gates: fixed scenery still resolves while person response/penalties remain suppressed; physical chairs still return non-damaging resistance. Suppressed solid contact does not renew immunity. This resolves the solidity limitation in the preceding checkpoint without answering Q2 (Empty-object scoring).

**Refs:** [Cooldown evidence](../../../verification/physical-festival/2026-10-30-cooldown/README.md); Task 4.2 (Single response owner).

### 2026-10-30 -- Empty-object scoring decision implemented

**Event:** decision

**What:** Gary selected no smile penalty for empty objects. The shared resolver now reports empty-object bumps as non-damaging, and the empty-chair physics adapter does the same. Main emits collision sound and existing bonk telemetry without smile deduction, hit flash, punitive toast or combo reset. Explicit occupied seat/porta-potty state retains the previous consequence until occupied reactions are implemented; this is not proof that an occupant was physically hit. Q2 (Empty-object scoring) is answered.

**Refs:** D13 (empty objects are not a smile penalty); [policy evidence](../../../verification/physical-festival/2026-10-30-object-policy/README.md).

### 2026-10-30 -- Closed coolers join the live prop simulation

**Event:** decision

**What:** Gary reaffirmed empty-object scoring, gave positive early chair feedback and requested coolers plus falling people. Following that requested sequence, separated the cooler from its canopy-owned collider and reused bounded prop ownership, terrain/static support, rendering and regeneration. Closed coolers now move in live campsites. The encounter helper had been rejecting valid cooler approaches by testing travel through the target into its kitchen; it now checks up to first contact. A real browser impact moved a cooler approximately 1.6 metres. Lid articulation, contents, holder drinks and occupied-person falls are not enabled by this slice.

**Refs:** D14 (cooler enrollment after positive chair feedback); [cooler evidence](../../../verification/physical-festival/2026-10-30-cooler/README.md).

## October 30: live occupied-chair checkpoint

Connected real campsite/stage sitters to physical furniture through atomic multi-person
claim preparation. Live browser driving produced a fallen sitter who recovered and
released its temporary body/load/contact resources. Fixed initial crowd-overlap escape
and preserved physical authority during nearby panic. Tests cover independent loveseat
release, source regeneration, teardown and rollback. See the
[live report](../../../verification/physical-festival/2026-10-30-live-occupants/README.md).
Next: ordinary-person physical impacts and incident ownership, followed by cooler
lids/drinks and signs. Full acceptance remains open, including the iPhone/iPad test.

## October 30: ordinary pedestrian falls

Added four bounded prewarmed ordinary-person bodies and support neighborhoods.
Actual cart collision callbacks use captured incoming speed, claim movement only
when support is resident, and restore ordinary walking after recovery. Real-engine
negative/capacity/repeat-hit tests and a real Chrome pedestrian encounter passed.
See [ordinary-person verification](../../../verification/physical-festival/2026-10-30-ordinary-people/README.md).
Next: bounded incident attribution/secondary impacts, then cooler lids and contents.
Device acceptance and graduated reactions remain open.
