---
change: people-npc-architecture
status: complete
current_task: "Complete: 40/40 implementation and acceptance tasks; available for review, no commit or archive"
blocked_by: null
open_questions: 0
started: 2026-10-25
last_updated: 2026-10-27
ref: null
---

# Session Log: People and NPC architecture

## Key Decisions

- D1 (planning-only authorization): Gary requested brainstorming, critical
  evaluation, a documented refactor plan, and real deliberation. Runtime changes
  need a later instruction. Freeze is a diagnostic symptom, not the project goal.
- D2 (preserve behavior during structural migration): evaluate common ownership
  and integration without assuming all characters need the same AI or renderer.
- D3 (bounded ownership proof): Adopt the mediated Healing Arts-first, children-second
  sequence, explicit authority transitions, activity-owned motion sampling, and
  permanent integration slots where non-person gameplay barriers require them.
- D4 (updated scheduled authorization): The 2026-10-26 wakeup instructions now
  permit implementation once planning is complete and retain wakeups until that
  implementation is complete. This supersedes the original planning-only boundary
  for subsequent work; the current closeout still changes documents only.

## Assumptions

| Assumption | Confidence | Status | Resolution |
| --- | --- | --- | --- |
| Existing population and behavior differences should survive a structural refactor | High | Planning default | Intentional changes need separate evidence and review. |

## Dangling Threads

None requiring Gary's answer for planning.

## Work Log

### 2026-10-25 -- Architecture planning scope

**Event:** decision

**What:** Created the people/NPC planning change after a broad code scope check.
The wakeup `npc-architecture-planning-follow-up` runs every five hours while the
requested planning remains unfinished and must be stopped when it is delivered.
The wakeup does not authorize implementation.

**Refs:** [brainstorm](brainstorm.md), [critical evaluation](critical-evaluation.md),
D1 (planning-only authorization).

### 2026-10-25 -- Independent reviews and requested Astra pass

**Event:** phase-change

**What:** Brainstorming, critical evaluation, proposal, draft design, delta specs,
and future implementation tasks are written. Five independent council positions
are complete under `deliberations/001-architecture/`; mediator synthesis is underway.
Gary additionally requested an Astra sub-agent review, which is underway in
`astra-review.md`. Reconcile both reviews into the final plan, write the README,
validate documents, and stop the planning heartbeat before reporting completion.
The session status remains `not_started` because implementation has not begun.

**Refs:** [council briefing](deliberations/001-architecture/briefing.md).

### 2026-10-26 -- Planning closeout and scheduled continuation

**Event:** phase-change

**What:** The five-person council, mediator synthesis, and independent Astra review
are complete; their corrections are incorporated in the final design, specs, and
39-task implementation checklist. Strict validation, document links/source ranges,
generated status, and whitespace checks passed. The optional second Astra review
could not run because of an account usage limit; its original completed review is
fully retained and no second endorsement is claimed. Implementation remains not
started. The updated wakeup permits implementation after this closeout, so keep it
active, resume with Task 1.1 (coverage and ownership ledger), and stop it only after
the newly authorized implementation is actually complete.

**Refs:** [planning verification](planning-verification.md),
[review resolutions](review-resolution.md), D4 (updated scheduled authorization).


### 2026-10-26 -- Implementation begins and the wakeup becomes explicit

**Event:** phase-change

**What:** Gary asked why implementation had not followed the 02:32 EDT wakeup and
confirmed that the next five-hour wakeup must continue implementation. The earlier
planning closeout was not an implementation blocker. The automation now explicitly
uses the live checklist to continue the first unfinished task and does not reopen
planning or wait for another instruction. Completed the ownership coverage ledger
and nested-module importmap foundation, including checker regression tests wired
into the normal check command. The 2D map now declares all source URLs without
importing those modules. Baseline and post-change full checks passed; the real Low
game booted through a ready mode click, and the map rendered seed 1977 without
console errors. The in-app tab was closed and the owned no-cache server stopped.

**Refs:** Task 1.1 (coverage and ownership ledger), Task 1.2 (nested-module verification),
[foundation verification](implementation-verification.md). Resume with Task 1.3
(production workshop and routine contracts); the behavioral migration is not complete.


### 2026-10-26 -- Production characterization and bounded capture persistence

**Event:** discovery

**What:** The production workshop and routine contracts are implemented. The first
browser-download capture call stalled for approximately 54 minutes before returning;
its owned tab was closed as soon as control returned. Replaced the download path
with the existing loopback capture sink and a tested five-second abort/cleanup
contract. Low and Mid each saved 600 real frames successfully through that path.
Both contain pickup aging and positive scoring, but neither exercises a positive
hit, active star-love or chunk unload, so the complete trace task remains open.
Do not redo planning or mistake the trace instrumentation for a timing benchmark.

**Refs:** [implementation verification](implementation-verification.md),
[trace artifacts](../../../verification/people/2026-10-26/README.md).
Resume Task 1.4 (complete behavioral traces), then Task 1.5 (comparable performance
baselines), before Task 2.1 (registered controller directory). The five-hour wakeup
remains active, and there has been no commit, push or deployment.


### 2026-10-26 -- Positive traces and measured migration baselines

**Event:** phase-change

**What:** Gary made completion of the entire change the active goal and requested
usage-reset recovery; the five-hour wakeup now explicitly preserves that goal and
uses minute 35 to follow the reported reset. Verification foundation is complete:
real positive contact/star/stream/seat traces supplement the pickup captures, and
Low/Mid baseline windows record CPU, operation, scene and resource measurements
with quality, camera, time, physical dimensions, visibility and population metadata.
The parked-contact fixture initially produced no hit because production deliberately
skips soft people while parked; the corrected fixture approaches a real adult and
captures a damaging result without changing collision policy. Seat inspection now
uses slot-array ownership because legacy cart slots omit a vehicle reference.
These setup findings are not runtime behavior changes. Begin the registered directory
and identity/claim seams needed for Healing Arts; final migration acceptance remains
separate from baseline capture. See the dated evidence for comparison limits.

**Refs:** [foundation evidence](../../../verification/people/2026-10-26/README.md).


### 2026-10-26 -- Requested visual closeout

**Event:** decision

**What:** Gary requested a visual at the end showing how the various NPCs were
connected before and how the completed implementation organizes them. Added
Task 4.5 (before-and-after architecture visual) as an acceptance deliverable,
using the existing baseline coverage ledger for the before view and verified
final source for the after view. This is part of the full goal, not optional follow-up.


### 2026-10-26 -- Registered adults and ordered production lifetime cleanup

**Event:** discovery

**What:** Adults now use a registered once-per-accepted-frame slot and honk capability.
Crowd spawn creates stable owner/generation handles, and explicit/distance removal
share claim-first cleanup with scoped pool release and targeted dirty publication.
The new claim-checked pose/binding facade passes real Three/Crowd contracts. A
production-method test exposed reentrant removal during the distance sweep: a
borrower removing a previously visited peer could resurrect that peer and skip a
later person. The sweep now defers array mutation and compacts once, and the failing
case passes without a new per-person frame allocation. Exact-source-text guards in
photographer/camping tests were replaced with actual hiding/honk execution checks.
The full routine suite passed after these corrections and sampler extraction.

**Refs:** `bin/test-crowd-ownership`, `bin/test-activity-claims`,
`bin/test-person-handles`, `bin/test-people-runtime`,
`verification/people/contracts.html`, and dated evidence. Child integration is
still needed to close Task 2.2 (replacement-safe identity and child relocation).
The sampler's frozen pre-refactor oracle is retained under dated verification;
1,600 exact samples and near/night/display-skipped cadence checks pass. Finish its
real-game/browser acceptance before marking Task 2.6 complete, then migrate Healing
Arts onto the new public contracts. No commit, push or deployment is authorized.


### 2026-10-26 -- Cross-population and cross-place behavior is the success criterion

**Event:** decision

**What:** Gary clarified that future behavior must connect different eligible NPC
families to stages, porta-potties, food trucks, Healing Arts, the nut wagon and other
places through a coherent structure. Strengthened the early extension proof to use
one behavior across two storage/population types and two resource adapters, and
made the final guide, venue matrix and before/after visual explain those extension
points. This reinforces the accepted architecture; it does not introduce automatic
new gameplay eligibility or a central role/venue switch. Continue the current
Healing Arts slice and then children before broad migration.


### 2026-10-26 -- Healing Arts public ownership and extension acceptance

**Event:** decision and verified discovery

**What:** Healing Arts now receives only the public people protocol and holds stable
handles/claims instead of Crowd records, while its sampler remains activity-owned.
Reservation rollback, person/place/owner-first release, generation reuse, and exit
metadata finalization have executable evidence. Production diagnostics, collisions,
and previews no longer route through `festivalVisit`. Borrowers release before the
place disposes rig resources. Display grounding briefly mutates records in the legacy
renderer, so targeted publication now preserves the authoritative supplied Y while
still rendering against terrain; a regression contract covers that separation.

**Why:** Gary emphasized future cross-population/cross-place behaviors, which is now
an explicit extension acceptance requirement, alongside the requested final visual.
The activity must not require private storage or a venue-specific main-loop branch.
The wakeup prompt now names these requirements and follows live checkpoints; its
five-hour rule uses minute 42 following Gary's request for after 5:41pm Eastern.

**Evidence:** `bin/test-healing-arts-ownership` compares 3,600 legacy-equivalent frames
and runs lifecycle contracts through a restricted protocol object. The full routine
suite passed at `/tmp/zerble-people-public-check.log`. Real Low ownership contracts,
Noon/Midnight workshop with scoped unload/full disposal, and Low/Mid ready-title
boots passed with no captured console errors. These are desktop checks, not physical
iOS audio/device or final whole-refactor acceptance. Continue the children proof next.


### 2026-10-26 -- Independent children and cross-place extension proofs

**Event:** phase change and verified discovery

**What:** Children now live in `src/people/children.js`, retain their own scene storage,
register update/honk/query/collider capabilities, and use stable lifetime handles.
The public nearby query uses caller scratch, relocation keeps the existing handle,
and cleanup stops execution/identity before owned GPU disposal. Constructor failure
unregisters a partial owner. A 400-frame legacy differential covers movement, smiles,
colliders and random draws; real Three model contracts and saved contact/stream game
traces pass. This closes the outstanding child relocation proof in the identity task.

A single `PlaceVisitActivity` now demonstrates two storage types, two resource adapter
formats and two binding variants. The browser proof renders actual Crowd and fixture
visitors and verifies entry/exit and binding/reservation restoration. No live population
is automatically enrolled in the example. The extension guide records the boundaries
and the requested stage/potty/food/Healing Arts/wagon direction. Its negative tests
also exposed two handoff edges: failed replacement must roll back tentative resources
before ordinary resume, and disposal of the incoming activity during outgoing cleanup
must not strand its newly returned claim. Both now have production fixes and contracts.

**Evidence:** `bin/test-children-ownership`, `bin/test-people-extension`,
`bin/test-activity-claims`, `verification/people/contracts.html`,
`verification/people/extension.html`, and the dated verification record. Full checks
passed in `/tmp/zerble-people-children-final-check.log` and
`/tmp/zerble-people-extension-final-check.log`. Low/Mid ready boots and the Low
Noon/Midnight workshop produced no captured console errors. Continue with wooks,
then formations, retaining all legacy ordering and lifecycle policies.


### 2026-10-26 -- Wook controller and resource cleanup convergence

**Event:** phase change and implementation constraint

**What:** Wooks now own a registered roaming slot, lifetime handles, queries and
idempotent cleanup in `src/people/wooks.js`. Public copied-position queries replace
the main loop's raw-record map and reuse caller vectors. A 400-frame frozen-controller
comparison preserves exact movement/state/RNG/collider results and the actual Trip
state machine's proximity offer/accept path. Resource disposal shared by Crowd,
children and wooks is now a leaf helper, preserving shared flags and release ordering.
Low native contracts, the production wook fixture, Low/Mid ready boots and a saved
Low streaming trace pass; `npm run check` passed in `/tmp/zerble-people-wooks-check.log`.

**Next constraint:** Formation constructors precede wooks, but the legacy parked-honk
order is wooks, puppets, band. Registering every callback in constructor order would
silently reorder that interaction. Preserve per-capability provider order explicitly
while migrating the formation updates; do not reorder constructors/RNG/audio to make
it happen. The wook slot remains after children and before hoopers/frisbees.


### 2026-10-26 -- Formation ownership and independent interaction order

**Event:** phase change and verified lifecycle defect

**What:** Parade carriers and band musicians now have independent registered
controllers and stable identities. Lanterns remain display rigs without duplicate
interactive identities. Existing placement/sampling math moved to a shared leaf;
400-frame comparisons preserve each formation's route, collider, animation-call,
nightness, random and music-position outputs. Main keeps constructor order while
capability ordering explicitly retains wooks → parade → band for parked honk.
Update scheduling remains separately ordered, with the two formation updates adjacent
before the child/collection barrier. Compiled capability lists change only on
registration/removal, and inspection includes their declared order.

The audio lifecycle contract exposed 100 cancelled pre-gesture stage descriptors
remaining queued after 100 attach/detach cycles. Stop now removes pending descriptors
immediately, retaining cancellation checks for an already-drained adoption callback.
The synchronous gesture unlock chain and its existing 80ms post-unlock drain were
not changed. Real native contracts also verify pre-gesture band cancellation after
person invalidation and no duplicate carrier/lantern identities.

**Evidence:** full routine suite passed at `/tmp/zerble-people-formations-final-check.log`;
parade and band production fixtures passed Noon/Midnight, scatter, owner teardown and
console checks; Low/Mid ready-title game boots passed; the saved formation streaming
trace passes the frame/score/collision oracle. The parade preview now receives its
own sandbox clock's nightness, while gameplay still independently polls the global
clock, and preview ground follows the moving formation. All owned tabs were closed.
Continue the hooper and frisbee slices without changing their authored policies.


### 2026-10-26 -- Inactive hooper publication defect characterized

**Event:** unexpected discovery

**What:** `node bin/test-hoopers-ownership --baseline` executes the frozen pre-migration
controller and confirms eight hidden pool bodies remain in its published collider
array, and its nominally hidden Y=-1000 footprints still obstruct origin. Registry
avoidance intentionally uses X/Z, so hiding an entry below ground cannot deactivate
its footprint. This is an ownership/publication defect, not an intended character
or scoring policy. The new controller excludes inactive bodies and gives hidden
footprints radius zero, retaining their stable resource IDs and the existing frame
spatial-index barrier. Visible actor damage/classification and motion remain intact.

**Verification boundary:** The active motion/selection/RNG comparison uses identical
place-acceptance boundaries, while separate real Registry contracts prove inactive
publication and two unload/revisit cycles. Removing phantom avoidance can correctly
change acceptance where an inactive footprint previously blocked placement, so this
slice must not be described as unconditional whole-world RNG/placement equivalence.
No seeded stream is added or reseeded. Keep this explained exception in final evidence.


### 2026-10-26 -- Roaming owners and inactive hooper publication

**Event:** discovery

**What:** The hooper baseline published eight hidden bodies and positive X/Z
footprints at the origin, even though the models were unplaced. The owner now
publishes only active collision bodies and uses zero-radius inactive footprints.
This is an intentional correction, so exact movement/RNG comparison is limited to
identical place-acceptance inputs; removing phantom blockers can change which
placements succeed. The final Frisbees extraction removes the obstacle monolith,
and its sandbox pair now runs the production controller rather than copied physics.
Common person reads reset all shared fields so reused query scratch cannot carry
another population's eligibility flags. Full routine checks, real Three ownership
contracts, Noon/Midnight pair views, Low/Mid ready-title boots and the new 120-frame
stream trace pass. All owned browser tabs are closed; the server remains in use.

**Refs:** Task 2.12 (hooper and frisbee owners),
[implementation verification](implementation-verification.md),
[dated evidence](../../../verification/people/2026-10-26/README.md).


### 2026-10-26 -- Group intent separates from population authority

**Event:** phase-change

**What:** Monk groups now retain handles, cached views and intent; the population's
GroupParticipation adapter owns membership, validated movement proposals, avatar
publication and collective seat handoffs. Group intent yields to exclusive activities.
Person-first and dispatch-stopped teardown release group membership and pooled rigs,
while tentative model/pool failures roll back the entire spawn. Group arrivals carry
a reservation incarnation, preventing old callbacks from joining a new attempt.
The existing vehicle seating algorithms and amenity precedence are retained. The
next slice unifies seat resource ownership for ordinary passengers, groups and
vehicle callers rather than leaving separate occupancy authorities.

**Refs:** Task 2.13 (public monk group participation),
`bin/test-monks-ownership`, native `verification/people/contracts.html` and
[implementation evidence](implementation-verification.md).


### 2026-10-26 -- Vehicle recruitment must respect existing activity authority

**Event:** discovery

**What:** The old wagon recruiter could select an exclusive visitor whose ordinary
state happened to be idle, then overwrite boarding fields despite that activity's
movement claim. The public boarding boundary now rejects active claims and protected
states. This is an intentional authority correction, not a population rebalance;
the 240-frame passenger comparison covers equivalent unclaimed inputs, while a
separate actual wagon-provider test verifies visitor exclusion. Seat selection order,
tall-rider eligibility and cooldown timing are retained. Vehicle/diagnostic callers
no longer write raw person seat/state or renderer fields.

**Refs:** Task 2.14 (boarding and seat ownership), `bin/test-boarding-ownership`,
`src/people/seatReservations.js`.


### 2026-10-26 -- Gary requests a pause until 01:20 Eastern

**Event:** decision

**What:** Gary requested a pause and a 01:20am wakeup to continue implementation.
Stop implementation now. Task 2.14 is deliberately unchecked pending its final
acceptance reconciliation: shared seat reservations, public ordinary/group/driver
boarding and vehicle release are implemented. The final full suite exits 0 at
`/tmp/zerble-people-boarding-final-check.log`; focused resource/passenger/wagon
contracts and native ownership page pass. A 120-frame real Low seat trace is saved
as `verification/people/2026-10-26/boarding-low-seats-frame-trace.json.gz` and passes
the frame oracle. Low and Mid ready-title boots pass. Native wagon fixture shows
six monks riding with seven live seat claims initially, zero claims on each of two
unloads, and successful boarding/riding after each revisit. At Midnight the first
revisit shows eight claims because the previous driver returns as an ordinary guest,
which preserves the existing fallback policy. No console errors were observed.
Tabs 45–49 are closed. Stop the owned server PID 34754 before ending this pause.
On wake, reconcile this evidence into the verification report/checklist, then
continue Task 2.15 and every subsequent task without repeating planning or reviews.


### 2026-10-27 -- Rest activities retain the exact timer and publication barriers

**Event:** discovery

**What:** Hammock and picnic dwell timers were decremented both in Crowd's frame
prelude and in their dedicated state handlers. The ownership migration intentionally
preserves both decrements and the no-publication arrival/timeout cases, rather than
silently changing visit duration or frame visibility. Both activities now use public
motion snapshots and typed claim-checked profiles with reusable scratch; the
population retains their original inline barriers. Exact place/resource replacement
checks add required unload cancellation absent from the recorded methods, so
800-frame equivalence applies to unchanged valid resources and the new invalidation
paths have separate ownership proofs. Raw hammock/table place pointers no longer
live on Crowd people, while numeric render hints remain population-owned.

**Refs:** Task 2.15 (hammock and picnic activities),
`bin/test-rest-activities`, `verification/people/2026-10-26/legacy-rest-activities.js`.

### 2026-10-27 -- Bathroom occupancy is lifetime-owned, while discovery stays at arrival

**Event:** decision / discovered cleanup defect

**What:** The bathroom errand acquires exclusive person authority before walking,
while the concrete unit is acquired only at the door, preserving the surprise
branch. The resource token includes the complete person/claim incarnation; the
old numeric occupant slot is diagnostic only. Door animation remains place-owned,
and the population retains the existing inline movement/render barriers. Forced
honk/panic departure now releases the unit instead of leaving the old reservation
stranded. Five 900-frame frozen-method comparisons preserve valid-path motion,
RNG and publication behavior, with separate replacement and cleanup proofs.

**Refs:** Task 2.16 (bathroom/market activities), `bin/test-potty-ownership`,
`implementation-verification.md#bathroom-ownership-slice-october-27`. The task stays
unchecked while its market half remains. The market methods were frozen before
changing that path, and the existing vendor contract passed at this boundary.

### 2026-10-27 -- Market models hold copied presentation, not people

**Event:** decision

**What:** The market activity owns the salted RNG/cooldown and full-lifetime
frontage claim; the tent model reads only a copied state presentation. Seven
600-frame comparisons retain purchases, approach/exit, interruption and draw order.
Resource identity includes the entry's current market object, so exact resource
replacement cancels old ownership. Both bathroom and market halves now have full
suite, native rendering, production fixture and actual Low/Mid ready-title evidence.

**Refs:** Task 2.16 (bathroom/market activities), implementation-verification.md.
Next: Task 2.17 (camp seating/sleeping, then camp music); both legacy methods and
the jam controller are frozen before migration, and both existing contracts pass.

### 2026-10-27 -- Camp and music share lifetime-owned chairs

**Event:** structural decision / recovery checkpoint

**What:** `people/campActivity.js` now owns camp seating/sleeping motion and
reservation state, while the separately migrated `campJamActivity.js` retains
handles and copied motion, uses public candidate/movement/instrument binding APIs,
and shares `people/campResources.js` with camping. Crowd people retain numeric
`campY`, music-stage/hidden flags and an explicitly claim-bound instrument display,
with no camp slot or job pointers. The old release order on a hit revoked the new
claim before checking trapped-seat clearance; the physical abandonment preflight
now precedes revocation, preserving both the trapped reservation and safe exit.
Five 1,200-frame camp and four 1,400-frame music comparisons pass, as do transfer,
rollback, replacement, teardown and injected audio-stop failure proofs. Native
Three contracts pass through real playing instrument matrices and camp unload.

**Checkpoint:** Task 2.17 remains unchecked. Finish production `camp_jam` and
`campsite_activity` fixture unload/revisit/day-night acceptance and Low/Mid
ready-title boots; rerun full suite after resolving migrated fixture references.
The first full run found old instrument-stage and camp-optimization harness inputs;
both were updated to current display fields/current activity selection method, and
focused checks pass. Latest full log `/tmp/zerble-people-camp-final-check.log` stopped
at that now-fixed optimization harness. The `camp_jam` IAB tab 67 is still owned
and running; server PID 3465 remains owned. Neither resource has yet been closed.
Do not mark this task complete from the passing focused/native subset.

### 2026-10-27 -- Camp acceptance reconciled

**Event:** acceptance checkpoint

**What:** Task 2.17 is accepted. The full suite exits 0 in
`/tmp/zerble-people-camp-complete-check.log`; native Three contracts pass. The
production camp fixture showed a bass/banjo ensemble playing before and after
revisit, zero claims on two active unloads, daytime seating and six sleepers at
held t=0.93, with clean consoles. The chair size/style lineup renders through valid
claims and numeric heights. Both explicit Low/Mid ready-title gesture boots ran
the real game and advanced score/day/juice without errors. Tabs 66–70 are closed;
the owned server PID 3465 remains running for continued implementation.

**Next:** Task 2.18 (photographer role/pose). The existing `photographer.js` already
owns the salted behavior kernel; preserve that stream and timing while isolating
its remaining pose/command boundary and replacing external raw-person references.
Do not redo completed council/planning/Astra review.

### 2026-10-27 -- Photographer remains a role on the same person

**Event:** decision / acceptance

**What:** Keep the existing salted photographer kernel in `photographer.js`,
where the new allocation-free pose sampler now owns crouch/flash formulas too.
Crowd retains population identity, profile storage and packed camera/flash pools.
Promotion, shot and preview commands now consume/return public person handles;
main and sandbox callers retain no raw photographer record. Forced commands reject
a competing activity, group, rider/sleeper or exhausted camera pool, preserving
movement authority rather than replacing a protected state. Valid-command profile,
pool and publication behavior matches the frozen commands. The fixture now follows
the public person view, since its old static camera lost a naturally wandering
photographer during longer inspection.

**Evidence:** Task 2.18 accepted. Thirty profiles × 1,200 kernel frames, 7,800
pose/flash boundary combinations, command ownership/slot reuse contracts, actual
native camera/flash/crouched-body matrices and Noon/Midnight fixture visuals pass.
Full `/tmp/zerble-people-photographer-check.log` exits 0; Low/Mid ready-title boots
advance the real HUD with clean consoles. All owned tabs 71–75 are closed.
Next: Task 2.19 (ordered collision providers and selected-hit callbacks), preserving
registry-first and current family/score phase order. Server PID 3465 remains owned.


### 2026-10-27 -- Collision publication uses ordered population capabilities

**Event:** decision / acceptance checkpoint

**What:** Task 2.19 is accepted. The registry still publishes first, followed by
parade, brass, children, wooks, hoopers, frisbees and adults through compiled
capability order. The extracted collision resolver preserves its first-hit math;
selected callbacks route movement, frown and occupied-bathroom reactions without
retaining mutable adult records. Adult wrappers and copied positions are reused
within one lifetime, while replacement lifetimes receive fresh callbacks, so an
old candidate cannot hit a reused slot. Physical trapped-chair preflight remains
before activity revocation. Scoring remains at its original main-frame barrier.

**Evidence:** 6,300 resolver cases and 24 scoring-policy cases match frozen source;
production provider/filter/scratch and stale-callback contracts pass. Native real
constructors preserve collision and honk order even under reverse registration.
Full `/tmp/zerble-people-collisions-check.log` exits 0. Low/Mid ready-title boots
advance the real HUD with clean consoles; Low contact emits its hit toast and a
validated 120-frame capture, saved as `collisions-low-contact-frame-trace.json.gz`.
The full run exposed source-snippet concatenation swallowing constants after an
inline comment in the unit harness; explicit newline joins fix that harness.
Tabs 76–78 are closed. Existing owned server PID 3465 was verified and reused.
Next: Task 2.20, preserving consumer eligibility while exposing copied queries and
replacing lost smiles' raw person pointer with a validated lifetime target.


### 2026-10-27 -- Public queries and lifetime-safe visual targets

**Event:** decision / acceptance checkpoint

**What:** Task 2.20 accepted. Runtime nearby queries select explicit population
keys and candidate filters, preserve compiled provider order and provider locality,
and accept caller scratch for nested queries. Crowd joins the common capability;
all seven providers support caller scratch. The contact/rider diagnostics use an
explicit adult-only selection. Lost smiles retain a handle, public reader and
copied last-valid target, never a mutable population record. Removal keeps that
last position and cannot redirect the visual toward a replacement slot. Live
motion remains exact; onFrown now publishes a handle at its original barrier.

**Evidence:** 63 exact legacy scans, boundary/order/early-stop/filter/reentrant
scratch and stale read contracts pass. Five hundred lost-target frames match
frozen motion. Native actual populations and lost-pickup removal pass; an initial
fixture passed Runtime where a public read view was required, then was corrected
to the real population view. Full `/tmp/zerble-people-queries-check.log` exits 0.
Low/Mid ready-title boots progress cleanly, and Low's public-query contact scenario
hits a person through the original route. Tabs 79–81 closed; server 3465 retained
for ongoing work. Vehicle-specific raw query consumers migrate separately in
Task 2.23, preserving their eligibility rather than broadening them here.
Next: Task 2.21, extracting shared eligibility/reset only after freezing both gain
policies; existing shared steering remains unchanged.


### 2026-10-27 -- Shared smile rules preserve distinct gains

**Event:** acceptance checkpoint

**What:** Task 2.21 accepted. `people/smilePolicy.js` shares only the equivalent
strict time/distance gate, movement-since-last-smile check and reset transition.
Adults retain directional gain, first nearby bubble, curiosity and dry-cart frowns;
children retain proximity/nearest-bubble gain and scattering policy. Honk reuses
the same reset without changing its boost/hold behavior. Steering stays unchanged.

**Evidence:** 12,000 adult and 12,000 child transitions match frozen blocks,
including emitted-event order, thresholds and copied reset position. Existing
400-frame child ownership and 2,016 bubble-query differential frames pass. The
latter VM fixture required the newly imported pure helpers in its scope. Full
`/tmp/zerble-people-smile-policy-check.log` exits 0; 147-module importmaps and
Low/Mid ready-title boots with natural score growth and clean consoles pass.
Tabs 82–83 closed. Next: Task 2.22, lightweight place-owned display participation;
performers/cooks must not receive interactive person identities for rendering.


### 2026-10-27 -- Place-owned displays participate without people records

**Event:** decision / acceptance checkpoint

**What:** Task 2.22 accepted. `PlaceDisplay` registers the existing stage and cook
updaters and inspection counts at separate named dependency slots, retaining
Healing Arts and stage lighting between them. It borrows updater/count callbacks;
chunks/models retain their rigs, publication arrays, animation and disposal. The
adapter creates no interactive identity, claim, query or collider. Its teardown
stops execution without disposing place-owned resources. Existing performer time
and cook delta are unchanged here; animation clocks remain Task 2.24.

**Evidence:** 1,200 exact performer/cook frames compare frozen updaters, including
RNG, unload/revisit and custom model animation. Native Three pose/stopped-adapter
contracts pass. Full `/tmp/zerble-people-place-displays-check.log` exits 0, 148-module
importmaps pass, Low/Mid ready-title boots progress with clean consoles, and the
saved `place-displays-low-frame-trace.json.gz` validates 120 actual game frames
with original display/scoring/collision barriers. Tabs 84–86 closed. Server 3465
remains owned for continued work. Next: Task 2.23, preserving vehicle physics and
registry-only collision publication while removing raw pedestrian dependencies.


### 2026-10-27 -- Vehicle facets implemented, acceptance pending

**Event:** recovery checkpoint

**What:** Task 2.23 remains unchecked. OneWheels now registers a query-only person
owner with lifetime handles, preserving its existing physics/rendering and sole
registry collision publication. Pedestrian yield/clear/gather consumers use public
adult views (velocity and seated fields added to copied views), while wagon gather
and group-boarding queries no longer read raw people. `VehiclePersonFacet` exposes
Lurleen as a read-only person without moving physics/relationship/render authority;
no collision, boarding or claim capability is implied. Ambient birds are unchanged.
Main passes the existing runtime to OneWheels and disposes Lurleen's facet with the
existing non-BFCache rider teardown.

**Checkpoint:** Existing one-wheel lifecycle/seed/motion suite passes, as do
12,000 exact old/new yielding cases, 100 wagon gathering comparisons and persistent
facet/replacement contracts. Frozen pre-slice one-wheel/wagon sources are saved.
Full suite is running as exec session 43899 at
`/tmp/zerble-people-vehicle-facets-check.log`. New native real rider/query/removal
contracts have been added but not run; run them, then affected one-wheel/wagon
fixtures and real Low/Mid gesture boots before accepting. No owned browser tabs
remain; server PID 3465 is still owned. `PlaceDisplay` and smile tasks are accepted,
so resume this vehicle acceptance rather than repeating them.


### 2026-10-27 -- Vehicle acceptance reconciled

**Event:** acceptance checkpoint

**What:** Task 2.23 accepted. Full
`/tmp/zerble-people-vehicle-facets-check.log` exits 0, importmaps pass at 149 modules.
Native real riders retain physics/registry position through their public facet,
publish no extra collision capability, and reject removed lifetimes after route
revisit. The production crossing fixture reports a yield and resumption; the wagon
fixture renders boarded passengers with clean consoles. Low/Mid ready-title boots
with forced production encounters show wagon occupancy progressing from 1/9 through
6/9, including four riding monks, and clean consoles. Tabs 87–90 closed; server
3465 remains owned. Next: Task 2.24, actor clocks as a separately characterized
behavior change, leaving profiling, streaming budgets and Web Audio clocks intact.


### 2026-10-27 -- Actor clock migration in verification

**Event:** recovery checkpoint / explicit behavior change

**What:** Task 2.24 remains unchecked. Frozen pre-clock Crowd/Lurleen and four
model sources plus the executable `test-actor-clocks --baseline` established
2,400 equivalent-elapsed poses before edits. Kid/wook/marshal/frisbee model clocks
now accumulate supplied delta; Crowd's actor time replaces both disinterest
comparison and deadline creation, plus wobble/cheer/bounce phases. Lurleen's visual
phases consume her accepted update time. Runtime accumulates accepted gameplay
time, which now feeds stage performer display and both Healing Arts update/sample
through their existing shared argument. Profiling, stream deadlines, independent
nightness, audio and non-person stage-light time remain separate. Unused Frisbees
wall-clock local removed. This intentionally changes animation origin from page
wall time to executed actor time and prevents a skipped interval from expiring
actor deadlines or jumping phases; structural equivalence alone is not claimed.

**Checkpoint:** New clock contracts pass at equivalent elapsed time, zero delta,
skipped hour/resume and strict disinterest expiry; existing child-motion, display
and runtime checks pass. Full check is running in session 76135 at
`/tmp/zerble-people-actor-clocks-check.log`; the clock test was added to package
check after this command started and also passed standalone. Native real model
clock assertions were just added and remain to run, followed by mixed Noon/Midnight
and real Low/Mid acceptance. No owned tabs remain; server 3465 remains owned.
Task 2.23 acceptance is reconciled at 28/40; do not repeat vehicle migration.


### 2026-10-27 -- Actor clock acceptance reconciled

**Event:** acceptance checkpoint

**What:** Task 2.24 accepted. Full
`/tmp/zerble-people-actor-clocks-check.log` exits 0; the subsequently added mandatory
clock test passes standalone (the next routine run will include it). Native actual
kid/wook/frisbee/marshal rigs pass accepted-delta, zero-delta and visibility checks.
The mixed workshop renders at held Noon/Midnight, holds at 534 paused frames,
steps to exactly 535, and resumes the same actors with clean consoles. Low/Mid
ready-title boots advance the HUD cleanly; the saved
`actor-clocks-low-frame-trace.json.gz` validates 120 actual game frames with original
scoring/collision/collection barriers. Tabs 91–94 closed. Server 3465 stays owned.
Next: Task 2.25, final explicit dependency routing, then whole-change acceptance
and the final documentation/architecture visual. Clock origin/paused deadlines
are an intentional separately tested change, not claimed wall-time equivalence.


### 2026-10-27 -- Final dependency routing implemented, acceptance pending

**Event:** recovery checkpoint / authority correction

**What:** Task 2.25 remains unchecked. Main now dispatches named vehicle,
relationship, late-place-activity and star-love slots, keeping wagon before
riders, the spatial rebuild, adult/collection/scoring/child ordering, birds/Trip,
Healing Arts prior-sample/light/cook interleaving and existing freeze gates.
Cheer uses a supported capability. Unused placeholder slots were removed.
Debug commands/overlays now use public population size, copied queries, validated
watch invitations and the actual ordered collider providers rather than raw adult
records or a separate incomplete collider inventory. The ordinary eligible-state
constant was renamed to describe its shared social role.

**Authority correction:** An arbitrary future behavior claim could survive a honk
or panic state write, leaving two movement writers. These interruptions now revoke
that claim after the existing physical exit preflight, while star love preserves
any competing claim. Valid unclaimed behavior and reaction barriers remain as
characterized; unknown-claim cancellation and protected diagnostic invitations
are intentional ownership corrections, not old invalid-command equivalence.
Native actual Crowd contracts pass these paths, stale invitations and a real
registered rider update. Full `/tmp/zerble-people-final-routes-check.log` exits 0,
including the new clock tests. Existing focused photographer/debug/display/rider
checks pass. The mover/static display checks now assert named route positions
rather than letting a missing old call's index -1 pass vacuously.

**Checkpoint:** Reconcile real Low star trace and Mid gesture boot before marking
Task 2.25, then continue every Phase 3 acceptance and Phase 4 docs/visual task.
Owned IAB tab 96 is running the Low star trace with production wagon/rider
encounters; save after 120 frames, validate and close it. Server 3465 stays owned.
Planning/council/Astra remain complete; do not redo them.


### 2026-10-27 -- Common inspector catches missing rider schedule

**Event:** verification failure / correction

**What:** The new real `/inspect people` path showed OneWheels with no scheduled
slot. The first source substitution had not matched `peopleRuntime.register`,
while an inadequate native assertion merely reread an unchanged valid position.
The previous full route logs and star/Mid boots therefore did not prove rider
execution and are not final acceptance. The rider constructor now explicitly
registers its vehicle updater. A focused constructor assertion failed 0-versus-1
before this fix and passes afterward; native acceptance now requires one dispatched
vehicle run AND a strictly advanced real rider position, not just a live handle.

**Checkpoint:** Task 2.25 remains unchecked. Full suite is rerunning as session
90985 to `/tmp/zerble-people-final-routes-verified-check.log`. Rerun strengthened
native contracts and actual route Low/Mid acceptance before closing the slice.
The public inspector itself worked and displayed all registered families,
place-only counts, capabilities and dependency slots; `/inspect people` and
`__dbg.people()` are now documented inspection surfaces pending final docs.
The last owned tab 98 was closed; server 3465 remains owned. No planning redo.


### 2026-10-27 -- Structural migration accepted, whole-change acceptance begins

**Event:** phase transition / acceptance checkpoint

**What:** Task 2.25 accepted after correcting and strengthening the rider route
proof. Full `/tmp/zerble-people-final-routes-verified-check.log` exits 0; the final
slot-name ordering-only edit also passes runtime contracts. Native contracts now
require exactly one vehicle dispatch and a strictly advanced actual rider position.
Real Low `/inspect people` confirms the rider `vehicles` slot, query-only collider
policy, all other families and display-only registrations, with a clean console.
Fresh corrected Low/Mid ready-title boots progress cleanly with production vehicle
encounters. Earlier star trace validates 120 frame/scoring/collection barriers,
but predates the rider schedule fix and is not used as rider-motion evidence.
Tabs 99–101 closed. Server 3465 remains owned.

**Next:** 30/40 accepted, all structural migration tasks complete. Continue Task
3.1 (whole-coverage ownership/fault/unload acceptance), then all remaining quality
and documentation tasks including Gary's final before/after architecture visual.
The dependency slots are recorded in `dependency-slots.md`. Do not stop because
structural migration has completed; Phase 3/4 checkboxes remain required.


### 2026-10-27 -- Whole-coverage fault and late-release corrections

**Event:** discovered cleanup failures / verified correction

**What:** The new mandatory `test-vehicle-cleanup` first failed because a GPU
release error stranded one rider record, then independently failed because an
audio detach error stranded the wagon root. Rider removal now retires its record
and identity before aggregating registry/root/unique-owned-resource release;
wagon cleanup consumes audio and finishes all cleanup before reporting errors.
Wagon now has an inert stopped-owner disposal path while normal encounter despawn
still permits revisit. Shared geometry/materials remain untouched.

Native two-cycle wagon testing initially assumed the driver died with the wagon.
Baseline revision `9eaf2e5d...:src/nutWagon.js` proves the same Crowd person instead
returns to idle, so the test preserves that lifetime rather than changing it.
A separate actual matrix check then failed: vehicle-first release left that ordinary
body hidden until the next population frame. `releaseVehiclePassengers` now
publishes only the affected body immediately after resetting its seat/state.
Focused passenger, Crowd and fault contracts pass, and native two unload/revisit
cycles now preserve the driver identity, clear seats/root/publication, restore body
matrices before another population tick, dispose owned attachments exactly once,
and preserve the shared template.

**Checkpoint:** Task 3.1 remains unchecked until the coverage matrix and final full
check/browser reconciliation are complete. Latest earlier full ownership command
session 8813 started before the immediate body publication fix; rerun the full
current suite. Native tab 102 closed. No owned tabs remain; server 3465 stays owned.
Continue whole-change acceptance, not another planning pass.


### 2026-10-27 -- Ownership gate accepted; render comparison tightened

**Event:** acceptance / measurement checkpoint

**What:** Task 3.1 accepted at 31/40. The coverage matrix in `acceptance.md`
accounts for all 17 family rows and every activity/resource row. Full
`/tmp/zerble-people-ownership-complete-check.log` exits 0. Fresh native tab 103
passes two whole-population/runtime replacement cycles and two real wagon
unload/revisit cycles with a clean console; tab closed. New current Low/Mid
ready-title runs also pass with clean consoles and saved 180-frame workload
windows (`final-low-baseline.json`, `final-mid-baseline.json`). All 20 saved frame
trace artifacts pass the current oracle in `/tmp/zerble-people-all-traces-check.log`.

**Render gate remains open:** The manual-start workload windows differ from the
original saved captures in render/cache counters and child cohorts. Do not claim
zero regression from them. `captureRenderInventory` now records named root topology,
potential submissions, instance counts, shadow casters and unique referenced
resources, with tests. `peopleBaselineAuto=1` begins the same probe on the first
accepted gameplay frame, removing manual click delay. A reproducible non-mutating
`bin/prepare-people-render-comparison` exports immutable baseline 9eaf2e5d... with
only these probes injected, without switching or resetting the working checkout.

**Owned resources / next:** Original export `/private/tmp/zerble-people-original-77xbr0d8`
is served on 8766 by exec session 27382 (record its exact PID before cleanup),
in addition to owned current server PID 3465 on 8765. Original Low IAB tab 106 is
measuring the matched v2 protocol; save after completion, copy its capture from
that export's `.claude/captures`, then close. Compare original/current Low/Mid
inventories and workloads, resolve actual differences, and continue all Phase 3/4
work and Gary's final visual. Never confuse the old manual captures with the new
matched protocol. No commits/pushes/deployment.


### 2026-10-27 -- Matched topology and final quality gates

**Event:** measurement correction / acceptance milestone

**What:** Tasks 3.2–3.4 and 4.2 accepted, 35/40. All 20 saved real-game traces
pass. The initial fixed-cohort original Low run had a 995×949 viewport, so it was
replaced with the explicit 1280×720 comparison. Low/Mid named topology buckets
now exactly match immutable baseline 9eaf2e5d... under equal initial cohorts,
including every mesh/instance/draw/triangle/shadow count. The executable comparison
passes. CPU costs and measurement limits are recorded honestly in acceptance.md;
current windows are 6.0/6.3 ms Low and 11.3/12.6 ms Mid median/p95, with added
adult public validation cost, not a zero-cost claim. Secondary renderer-cost probes
overlap the suite and are diagnostic context, not another clean trial.

The whole suite `/tmp/zerble-people-final-acceptance-check.log` exits 0. The new
51-source boundary check passes six negative fixtures and is now mandatory. The
obsolete raw-record rider helper moved out of production into its frozen test
oracle; focused rider/query contracts still pass. Final full suite is needed after
that cleanup. Native cross-population/place/binding extension tab 115 passes enter,
exit, reservation release and original-binding restoration, with clean console.
All tabs through 115 are closed, and viewport override is reset.

**Owned resources / next:** Current server PID 3465 (8765) and original comparison
server PID 78060 (8766) are still owned. Complete guide/matrix, main specs/docs,
Gary's before/after visual, end-to-end links and final checks, then stop exact PIDs
and recurring automation only when every acceptance/documentation checkbox is done.
No standalone headless browser processes were created. No commit/push/deploy.


### 2026-10-27 -- Implementation and handoff accepted

**Event:** whole-change completion

**What:** All 40 tasks are checked, separately from the completed planning/council/
Astra exercise. The extension contract, population/venue eligibility matrices, main
capability specs, current architecture/debug guidance, changelog/roadmap and Gary's
before/after visual are reconciled. The visual shows all 17 family groupings and
explicit person/activity/place ownership, with linked baseline and current evidence.
The ordered document read-through found stale planning-only language and repaired
it; 26 documents, 816 links and 28 heading anchors pass local checks. Historical
links to the removed obstacle module now target immutable baseline source.

Final `/tmp/zerble-people-closeout-check.log` exits 0, strict change validation and
149-module/five-page importmaps pass, as do boundary and matched render acceptance.
Final native and ready-title game paths pass with clean consoles. All owned IAB
tabs through 120 are closed; the viewport is reset; no standalone browser/GPU/daemon
was created. Exact comparison PID 78060 and port 8766 are gone. Gary requested the
local game URL, so server 3465 on 8765 is handed to his play session rather than
left as an unattended test. The final acceptance record preserves measured CPU
overhead and missing physical-device evidence. No commit, push, deployment or
automatic archive. Stop the recurring implementation wakeup now.

The recurring `npc-architecture-planning-follow-up` automation is confirmed deleted,
and the persistent implementation goal is marked complete. The local game still
responds HTTP 200 on port 8765 for Gary's requested play session.
