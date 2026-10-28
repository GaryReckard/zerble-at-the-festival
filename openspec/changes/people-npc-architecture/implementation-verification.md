# Implementation verification

Started: 2026-10-26. Entries below preserve the per-slice chronology. The final
[acceptance record](acceptance.md) supersedes historical “next” checkpoints and
separately accounts for the completed implementation, measured costs and limits.

## Changes and evidence

- Task 1.1 (coverage and ownership ledger): [coverage-ledger.md](coverage-ledger.md)
  records current population/place/vehicle owners, movement/render writers, activities,
  resources, frame and collision barriers, external person holders, and cleanup seams,
  with source references. It deliberately separates inventory from executable acceptance.
- Task 1.2 (nested-module verification): `bin/check-importmaps` now recursively
  discovers `.js` source modules, normalizes model-relative declarations correctly,
  and validates missing/stale mappings for all five pages. The map's URL declarations
  are complete while its executed import graph remains worldgen-only.
- `node bin/test-importmaps` passed: 30 page/module omission cases, 25 stale mappings,
  nested discovery, model/root namespace distinction, commented-out mappings, absent
  pages/arrays, and source additions after an earlier check. Fixtures clean up their
  own created paths. The test is part of `npm run check`.
- `node bin/check-importmaps` passed with 121 source modules across five pages.
- The full `npm run check` completed with exit 0 before and after the changes.
  The post-change output is in `/tmp/zerble-npc-foundation-check.log` for this local run.

## Browser verification and cleanup

Used the in-app browser, not standalone headless WebGL, against a task-owned loopback
no-cache server on port 8765:

- `/?mute=1&perf=low&seed=1977` displayed ready mode controls; clicking Just Cruisin'
  entered gameplay, updated the juice/day HUD, and produced no captured console errors.
- `/map-sandbox.html?mute=1&seed=1977` displayed its 2D canvas and controls, seed 1977,
  22 hearts, and 12 lakes, with no captured console errors.
- The owned tab was explicitly closed, the server session exited after interruption,
  and `lsof -nP -iTCP:8765 -sTCP:LISTEN` found no remaining listener.

These checks do not establish physical-device audio unlock, comparable performance,
or the unimplemented mixed workshop and people authority contracts. No source
controller, movement, RNG, renderer, score, or activity behavior changed in this slice.

## Initial continuation checkpoint

After the first slice, Task 1.3 (production workshop and routine contracts) was next. The five-hour automation
remains active and explicitly resumes the first unfinished task from the live checklist.
No commit, push, or deployment was performed.


## Production workshop and partial frame characterization

Task 1.3 (production workshop and routine contracts) is complete. The new mixed
sandbox uses production Crowd, KidGaggle, MonkParty, HealingArtsActivity, campsite
and photographer routines. Pause/step, honk, photo, activity unload and full owner
cleanup are inspectable. Constructor default-draw equivalence and real activity
previous-sample reads have executable contracts in the routine suite. See
[the workshop record and saved captures](../../../verification/people/2026-10-26/README.md)
for concrete observed populations, lifecycle checks, trace counts and limits.

Task 1.4 (complete behavioral traces) has working bounded instrumentation and
saved Low/Mid 600-frame game captures. Both pass the real-capture oracle with
nonempty pickup snapshots and positive scoring. Positive hits, star-love,
streaming/unload and seat transitions still need explicit scenarios and evidence;
the checkbox remains open. Task 1.5 (comparable performance baselines) is also open.
The trace deliberately includes no timing benchmark and cannot substitute for it.
The main-game Low and Mid runs entered through ready title controls; the Mid
capture and earlier Low/workshop runs had no captured console errors.

The initial browser-download path stalled approximately 54 minutes before returning.
Its tab was closed, and saves now use the existing local capture sink with tested
five-second abort/cleanup instead. Both later saves reported success. No standalone
headless browser or GPU worker was started by this run. The final full `npm run check` completed with exit 0; local output is
`/tmp/zerble-people-foundation-final-check.log`. All three saved artifacts also
passed the strengthened capture oracle, including exactly one scoring call for
positive same-frame collection and ordered candidate/result publication. Strict
OpenSpec validation and `git diff --check` passed. All owned IAB tabs were closed,
the no-cache server exited with status 0 after interruption, and a direct
`lsof -nP -iTCP:8765 -sTCP:LISTEN` check found no remaining listener.

Resume Task 1.4 (complete behavioral traces), then measure Task 1.5 (comparable
performance baselines) before implementing the controller directory. Continue under
the active five-hour implementation wakeup; no new planning approval is required.


## Runtime, identity, claim and publication seams

The foundation is complete and adults now use a registered main-loop slot without
moving it across collection or other systems. Named Low contact/stream traces still
pass after runtime integration; saved copies have a `runtime-low-` prefix. Real
Three/Crowd checks at `verification/people/contracts.html` pass live registration,
slot reuse, stale role/hit/pose/binding rejection, late restoration/dirty flags,
photographer pool release, lifetime invalidation before borrower callbacks,
party/rider distance exemptions, exception-safe cleanup and repeated disposal.
The routine suite also runs production removal methods against recording resource
boundaries, including the previously failing reentrant-sweep case.

Task 2.2 (replacement-safe identity and child relocation) remains open for the actual
child slice despite passing directory-level relocation/replacement contracts. The
full sampler routine suite completed with exit 0 at
`/tmp/zerble-people-sampler-check.log`; real sampler browser acceptance is still being
completed. Its immutable mathematical oracle is anchored to the baseline revision,
and 1,600 managed/unmanaged samples match positions/headings exactly. The existing
12,000-sample spacing/arrival/render checks also pass, and the actual streaming
cadence samples five times with both display enabled and skipped.


Sampler browser acceptance is complete for this slice: the Low real-crowd fixture
showed 20 yoga participants at Noon and, after the staggered Midnight transition,
0 yoga, 6 leaving, 9 arriving and 5 dancing (68 total people at that point in the
long-lived preview). Both states rendered without captured console errors. Low
and Mid seed-1977 games then entered through ready mode clicks and ran with clean
captured consoles; all owned tabs were closed. These are the sampler's visual/boot
checks, not the complete ownership acceptance or a performance comparison.
Continue Task 2.7 (Healing Arts public identity/claim/binding slice); no part of the
old raw activity ownership path is claimed migrated yet.


## Healing Arts public ownership acceptance

Task 2.7 (Healing Arts public ownership) is complete. The activity accepts only
public person operations and retains handles and claim-owned rig reservations.
`bin/test-healing-arts-ownership` passes 3,600 exact legacy movement/state/cooldown,
role and hidden-binding frames with the existing prior-sample cadence, followed by
failed reservation rollback, stale generation/release, person-first teardown,
replacement owner, unload/revisit and exit-finalize-resume order checks. Restricted
protocol input makes a private Crowd dependency fail at runtime. Existing movement,
sampler/display-skipping, camp and publication tests pass, and the chunk unload test
asserts borrower/audio release before GPU traversal and scene detachment.

The full routine suite passed with exit 0 in `/tmp/zerble-people-public-check.log`.
Real Three/Crowd ownership contracts passed on Low. The mixed Low workshop showed
41 adults, 6 children, 4 monks and 20 Healing Arts participants at Noon, transitioned
to Midnight, accepted honk/photo, then released all Healing Arts participants while
preserving 41 adults and reducing owned registry entries from 40 to 29. Full disposal
reported zero people/jobs and zero owned/total entries. Low and Mid game boots both
used ready mode clicks and produced no captured console errors. All owned browser
tabs were closed. The task-owned no-cache server remains in use for the next slice.
No physical-device audio/performance acceptance is implied.

Current recovery checkpoint: implement Task 2.8 (children independent ownership),
then close Task 2.2 (identity foundation) after actual relocation preserves identity
and controller/runtime replacement rejects stale child commands. Preserve the
existing algorithms/RNG and collection/collision barriers. The final cross-population
and cross-place extension proof and before/after visual remain required later tasks.


## Children and initial extension acceptance

Tasks 2.8 (children independent ownership) and 2.2 (identity foundation, including
actual child relocation) are complete, as is Task 2.9 (early extension proof).
See the [dated evidence](../../../verification/people/2026-10-26/README.md#accepted-healing-arts-children-and-extension-slices)
and [executable extension guide](extension-guide.md). The guide deliberately separates
proof from remaining live-venue migrations and does not broaden eligibility.

The latest routine suite passed with exit 0 in
`/tmp/zerble-people-extension-final-check.log`, including failure-order regression
coverage added during extension. Current recovery checkpoint: Task 2.10 (wook
controller), followed by Task 2.11 (formation controllers), keeping each production
algorithm, random stream, Trip filter and collision sequence intact. Keep the
five-hour implementation wakeup active through all final acceptance and the visual.


## Wook ownership acceptance

Task 2.10 (wook controller) is complete. `bin/test-wooks-ownership` passes 400 exact
legacy movement/state/random/collider frames, including parked scatter, approach,
passive damage and recycle. The same position queries run through the real Trip
state machine in the contract, including a positive offer and acceptance, and reused
caller vectors preserve the input values without exposing raw population records.
Low Crowd/child native contracts also pass after shared scene-resource cleanup
was extracted. The full routine suite passed with exit 0 in
`/tmp/zerble-people-wooks-check.log`, followed by the strengthened Trip contract.

The Low production wook fixture displayed five actors and one approach while parked,
zero approaches while moving, retained five query positions after distant relocation,
and reported zero actors/colliders/query positions after disposal. Noon and Midnight
controls, Low/Mid ready-title boots and console inspections produced no captured
errors. `wooks-low-stream-frame-trace.json.gz` records 120 accepted real-game frames
and passes the frame/score/collision oracle. All owned tabs were closed, with the
owned no-cache server retained for continued implementation. These are desktop
checks, not physical-device acceptance. Continue Task 2.11 (formation controllers),
preserving the distinct constructor, update and parked-honk provider orders.


## Formation ownership acceptance

Task 2.11 (parade and band formation controllers) is complete. Separate controller
modules preserve 400 frozen legacy frames each, including path/recycle transforms,
carrier/member collision ordering, RNG, independent nightness reads and spatial music
positions. Runtime contracts verify that interaction provider order can differ from
constructor/update order without rebuilding lists during dispatch. A focused audio
contract reproduces and fixes retained cancelled pre-gesture descriptors, while
preserving the existing unlock/adoption timing and cancellation during drain.

Real Three ownership contracts pass carrier identities, display-only lanterns, seven
musicians, grounded rig publication, lifetime invalidation before audio release and
one-time deferred cancellation. Low parade and band previews passed Noon/Midnight;
parade remained 190 draws/71,310 triangles in both observed states, and band remained
65 draws/17,622 triangles before disposal, then two ground draws/48 triangles with
zero members/music handles. These are fixture observations, not device measurements
or a matched performance-baseline claim. Low/Mid ready-title world boots and console
checks passed. The saved `formations-low-stream-frame-trace.json.gz` passes the
120-frame barrier/pickup/scoring/collision oracle. All owned tabs were closed.

The full routine suite passed with exit 0 at
`/tmp/zerble-people-formations-final-check.log`. The owned server remains in use.
Current checkpoint: Task 2.12 (hooper controller, then frisbee pairs), with dedicated
place/pair identity and cleanup proofs before broad movement or clock changes.
Physical-device audio/performance and whole-change acceptance remain outstanding.


## Hooper and frisbee ownership acceptance, October 26

`bin/test-hoopers-ownership` characterizes the baseline phantom hooper bodies,
then verifies 400 movement/pose/collider/RNG frames under identical placement
acceptance, actual-registry publication, two unload/revisit cycles and scoped
footprint removal. Inactive hoopers now publish no collision body and zero-radius
footprints; this intentional fix can alter place acceptance and subsequent draws,
so whole-world RNG equivalence is not claimed for that case.
`bin/test-frisbees-ownership` verifies 600 exact default five-pair frames, including
toss/land/pickup, explicit catch and ground branches, stable identities, disc
ownership, bounded production preview and stale replacement rejection.

Native Three ownership contracts pass for eight unplaced hoopers, ten real pair
players, pair-owned discs, grounded collision wrappers, lifetime invalidation and
footprint cleanup without removing an unrelated registry entry. The production
pair sandbox renders at Noon/Midnight with two identities and one disc, 35 draws
and 3,344 triangles in this Low observation; its console is clean. Earlier hooper
fixture evidence covers active/unloaded/revisited places. Low and Mid both boot
through ready title controls and continue collecting smiles without console errors.
`pairs-low-stream-frame-trace.json.gz` validates 120 real frames and all required
frame/pickup/scoring/collision barriers. This is functional desktop evidence, not a
matched performance or physical iOS audio measurement.

The full routine check exits 0 (`/tmp/zerble-people-pairs-final-check.log`), all five
importmaps cover 137 modules, and whitespace checks pass after removing trailing
space in the map module array. Owned tabs 35–38 are closed; the reused server is
still needed for the next slice. Resume Task 2.13 (public monk group participation).


## Public monk group participation acceptance, October 26

`bin/test-monks-ownership` first ran against the recorded controller before migration,
then compared 400 frames of group intent, profiles, state proposals and display poses
using identical population-side inputs and the original salted group stream. This is
a group boundary comparison, not a replacement oracle for the full Crowd steering.
Additional production-method checks cover insufficient seats, atomic contention,
stale reservation release and arrival, slot reuse, activity precedence, hidden/restored
group binding, collective distance policy, failed pool/model spawn and complete
person/owner-first cleanup after dispatch stops.

Native Three ownership contracts verify ordinary instanced bodies hidden under the
same person's monk rig, exclusive-activity hide/restore, member/rig release together,
and runtime-first teardown. The Low `monk_party` preview shows five identities,
44 draws and 14,603 triangles at Noon/Midnight; each of two clear/respawn cycles
returns to zero identities and 2 ground draws/48 triangles before restoring five.
The real `nut_wagon_monks` fixture reaches six monks riding together plus Bo (7/9),
including a fresh run after reservation-aware arrivals, with clean consoles. Low/Mid
ready-title boots continue collecting smiles without errors. Tabs 39–44 are closed.

The routine suite exits 0 at `/tmp/zerble-people-monks-final-check.log`, five-page
importmaps cover 138 modules, and whitespace checks pass. Additional focused distance
and stale-slot assertions pass after the full run. No physical audio/device claim is
made. Resume Task 2.14 (shared seat resource ownership and boarding migration); the
loopback server remains in use and nothing has been committed, pushed or deployed.


## Shared passenger and vehicle-seat acceptance, reconciled October 27

The October 26 seat migration passed before Gary's requested pause.
`bin/test-seat-reservations` proves atomic group acquisition, permanent-seat
eligibility, one person/slot owner, stale release and slot-generation rejection,
vehicle replacement, cross-adapter contention and dispatch-stopped cleanup.
`bin/test-boarding-ownership` compares 240 passenger frames against frozen methods,
covering steering, boarding, riding, disembarking, occupancy, callback counts and RNG.
Its public-command checks cover activity rejection, cooldown ownership, moving-cart
cancellation, stale release, vehicle removal and changed slot identity. The actual
wagon recruiter retains insertion order and tall/open-seat eligibility while
excluding exclusive visitors. That exclusion corrects an old authority violation;
equivalence is claimed only for identical eligible/unclaimed inputs.

Native production Crowd/Three contracts verify resource ownership, protected
boarding, vehicle cleanup, immediate pose publication and stale release. Low and
Mid boot through ready title controls with no console errors. The saved
`boarding-low-seats-frame-trace.json.gz` validates 120 real Low frames including
positive occupied seats and the existing collision/pickup/scoring barriers.
The production wagon fixture shows six monks plus Bo riding with seven seat claims
at Noon. Each of two unloads returns to zero claims, and both revisits successfully
board/ride again; Midnight first-revisit seating shows eight claims because the
former driver keeps the existing ordinary-person fallback and can board as a guest.
No geometry/performance equivalence is claimed between differing occupant counts.

The final routine suite exits 0 at `/tmp/zerble-people-boarding-final-check.log`;
all five importmaps cover 139 modules. Tabs 45–49 and the owned server were closed
for the requested pause. Physical audio/device measurements and final whole-change
acceptance remain outstanding. Task 2.14 is accepted; resume hammock and picnic
resource/activity ownership without rerunning completed planning/reviews.


## Hammock and picnic acceptance, October 27

`bin/test-rest-activities` first characterized both recorded methods, then compared
800 exact frames per migrated activity, including approach/arrival, occupied
resources, position/velocity/heading, dwell/give-up timers, random draws, final exit
and instance-publication counts. The existing population plus activity timer
decrements are intentionally retained. Focused ownership checks cover competing
claims, contention, stale poses, two changed-place/revisit cycles, person-first and
activity-first cleanup, replacement and the shorter group table-search radius.
Exact equivalence applies to valid unchanged resources; new identity-aware unload
cancellation is separately proved and not presented as old behavior.

Native production Crowd/Three contracts verify supine instance publication, exact
place removal, the same person's subsequent picnic claim, numeric seated height,
and owner-first resource cleanup. Both production activity sandboxes exercise the
actual Crowd frame path at Noon/Midnight. Low observations: hammock 18 draws/1,560
triangles with a visitor, picnic 11 draws/1,472 triangles with a diner. These are
fixture observations, not matched whole-game performance comparisons. Each fixture
completed two active unload/revisit cycles with zero claims and old occupancy on
unload, fresh claims after revisit, and explicit interruption with clean consoles.
All owned tabs 50–55 are closed.

Low/Mid ready-title boots continue collecting smiles without console errors.
`rest-low-stream-frame-trace.json.gz` validates 120 real Low streaming frames and
the required collision/pickup/scoring barriers. The full routine suite exits 0 at
`/tmp/zerble-people-rest-final-check.log`; focused comparisons and final native
contracts also pass after readable formatting and typed-reader separation. Five-page
importmaps cover 141 modules and whitespace checks pass. No physical-device audio
or matched performance claim is made. Task 2.15 is accepted; continue Task 2.16
(bathroom first, then market). Owned no-cache server PID 3465 remains in use.

## Bathroom ownership slice, October 27

Task 2.16 (bathroom and market activities) was implemented in two separate slices.
The bathroom half is extracted into `src/people/pottyActivity.js`,
which owns copied motion, the errand claim, and full-handle unit reservations.
Crowd retains the same inline state barriers and instance hiding/seated publication.
`occupantId` remains a diagnostic slot number, and no command resolves it.

- `bin/test-potty-ownership` compares five 900-frame cases against the frozen
  `legacy-potty-methods.js`: normal use, occupied/locked wait, unlocked surprise,
  unload, and collision ejection. Actor motion, timer/state, resource flags, RNG
  draw count and show/hide counts match under the same recorded door inputs.
  The surprise occupant is a separately claimed live person, rather than a fake
  numeric-slot lookup. Private finished activity caches are not an equivalence claim.
- Focused ownership proofs cover two exact-resource replacement/revisit cycles,
  stale writes/hits/slots, forced interruption, person-first and activity-first
  teardown, and inert stale ticks. A stale unit cannot eject its replacement owner.
- Native Three ownership page passes, including hidden body, actual seated
  surprise pose, collision ejection, surprised-visitor unload and stopped-dispatch
  teardown. The `potty_activity` sandbox runs the real Crowd and door/stink model.
  Noon and Midnight, active approach unload/revisit, interruption and a full
  occupied visit were observed without console errors. Unit fixture counters:
  20 draws / 1,404 triangles while the model is visible.
- Full suite `/tmp/zerble-people-bathroom-final-check.log` exited 0 before formatting;
  the focused test passed again after adapting its VM import stripping to the
  formatted module. Both explicit `?perf=low` and `?perf=mid` ready-title gesture
  boots ran without errors. Initial `tier=` smoke URLs were generic boots and
  are not tier evidence. All five importmaps contain 142 source modules.

Intentional corrections: exact entry and resource identity invalidate the visit,
including surprise; honk/panic abandonment now releases a bathroom claim, where
the recorded helper could strand a unit; an obsolete numeric occupant ID cannot
authorize ejection or surprise. Valid unchanged-resource motion and ordering remain
subject to the frozen oracle. No physical-device audio/performance claim is made.

## Market ownership slice, October 27

`people/marketActivity.js` owns each visit, isolated salted RNG, retry cooldown and
concrete frontage reservation, retaining the pre-camp per-person execution barrier.
The tent model sees a copied `{state}` presentation rather than a mutable Crowd
person. The population alone applies the typed pose and shopping-bag display.

- `bin/test-market-ownership` passes seven 600-frame comparisons against
  `legacy-market-methods.js`: buyer, nonbuyer, actual seeded stream, closing,
  unload, externally interrupted state, and lane dodge. State/timing, movement,
  target, frontage presentation, bag/purchases, publication and RNG draws match.
- Additional contracts exercise contention, two resource replacement/revisit
  cycles, stale movement/release/slot rejection, person-first and activity-first
  teardown, copied model presentation, rotated frontage and blocked access.
  The existing placement/model contract still uses its frozen behavior oracle;
  production migration equivalence is established by the new contract.
- Full `npm run check` exits 0 in `/tmp/zerble-people-market-final-check.log`;
  focused market/bathroom contracts pass after formatting. Importmaps: 143 modules
  across five pages. `git diff --check` passes.
- Fresh native Three contracts pass with no errors, including actual visit phases,
  old-claim rejection, revisit after bag/cooldown expiry inputs, and dispatch-stopped
  cleanup. The expanded production `vendor_activity` fixture showed purchases/bags
  and two active unload/revisit cycles, each returning both claims and frontages
  to zero. Noon had 42 draws / 13,496 triangles with bags; Midnight closure had
  zero claims/frontages and 44 draws / 13,520 triangles with existing night props.
  These are fixture observations, not device performance or a comparable baseline.
- Explicit `?perf=low&seed=1977` and `?perf=mid&seed=1977` ready-title gestures
  booted the full game and progressed the smile/day/juice HUD without console errors.

Resource identity now also includes the market object behind an unchanged registry
entry. A replaced presentation cannot be commandeered or released by an old visitor.
These invalidation corrections have ownership evidence separate from valid-resource
frame equivalence. No shared geometry, world RNG, frame/scoring order, global
nightness read or start-gesture audio initialization was changed.

## Camp and music ownership, October 27

Task 2.17 (camp seating/sleeping and camp music) was implemented in separate
structural slices, then verified together across the shared chair boundary:

- `people/campActivity.js` retains the existing nearest-seat/bed order, footprint
  bound, schedule/stagger, approach/obstacle math, dwell and exit policy. It owns
  copied motion and claims. `people/campResources.js` validates exact world entry,
  slot membership and person/claim lifetime, while cleanup remains possible after
  dispatch stops. Crowd keeps numeric `campY` rather than place/slot pointers.
- `campJamActivity.js` owns handles and copied snapshots instead of Crowd records,
  uses public eligible-person queries and claim-checked instrument bindings, and
  shares the chair adapter with resting. It retains pre-party session scheduling
  and the pre-camp per-person job barrier, without another population traversal.
- `bin/test-camp-ownership`: five 1,200-frame comparisons against the frozen
  `legacy-camp-methods.js` for daytime sitting, sleeping/waking, unload, obstructed
  exit and timeout. Motion, phases/timing, slot choices and publication counts match.
  Separate proofs cover two slot replacement/revisit cycles, stale commands/slots,
  removal order, activity teardown and trapped-hit preflight followed by safe exit.
- `bin/test-camp-music-ownership`: four 1,400-frame comparisons against
  `legacy-camp-jam.js` for normal completion, closing, host unload and interruption.
  Actor/job/seat/model/audio/publication state matches. Intermediate prelude phases
  are observed before inline consumption, including the one-frame `leave` phase.
  Separate tests prove two person/place removal/revisit cycles, camp-to-music
  reservation transfer, competing-claim protection, partial-ensemble rollback and
  complete cleanup after an injected sound-stop error.
- Existing camp placement/model/role harnesses were adapted to current public
  boundaries and numeric display hints. The footprint optimization still yields
  identical selection in 200 cases and 548 → 0 distant slot-coordinate reads.
  Instrument attachment checks retain 60 actual pose cases; chair contacts retain
  100 actual scaled/animated transforms.
- Native Three ownership contracts pass through a seated body, camper-to-musician
  handoff, actual pooled playing instrument matrices and unload cleanup, including
  deferred sound ownership. The held-evening production `camp_jam` fixture showed
  bass and banjo playing, then two active unload/revisit cycles with zero rest/music
  claims after unload and renewed playing on revisit. Daytime seating and six
  late-night sleepers at held t=0.93 were observed with clean consoles. Playing:
  83 draws / 16,596 triangles; Noon/late night: 74 draws / 15,654 triangles. These
  fixture counts are not comparable device-performance measurements.
- Full routine check exits 0 in `/tmp/zerble-people-camp-complete-check.log`; focused
  suites pass after formatting. All five maps contain 145 source modules.

Intentional ownership corrections include exact slot replacement cancellation and
exception-safe sound teardown. Hit handling now performs physical abandonment before
claim revocation, which is required to preserve the old trapped-seat and safe-exit
policy after migrating those reservations. Equivalent unchanged-resource behavior
is distinguished from these invalidation/error paths. Physical-device audio and
performance acceptance remains a separately recorded limitation.

Camp final integration: explicit `?perf=low&seed=1977` and `?perf=mid&seed=1977`
ready-title plank clicks entered the real game and advanced smile/day/juice HUD
without errors. The chair style/size lineup also rendered its seated bodies after
its controlled setup was moved through current claims and numeric height profiles.
Owned IAB tabs 66–70 were closed; the owned server remains active for continuation.

## Photographer role and pose, October 27

Task 2.18 (photographer role/pose) retains the existing pure salted kernel and
population-owned profile/accessory pools, adding an allocation-free role pose
sampler to `photographer.js`. Crowd composes the existing instance matrices from
that sampled profile, rather than owning its crouch and flash formulas. Promotion,
shot and preview commands accept and return full person handles, and a copied role
reader supports inspection. Main/sandbox callers no longer retain raw photographers.

- `bin/test-photographer-ownership`: 30 profiles × 1,200 exact kernel frames against
  frozen source, covering notice/pose/flash, cooldown and opportunity gates; 7,800
  state/time/crouch/flash combinations against recorded render formulas, with
  cross-actor scratch reset; valid commands preserve profile, pool and publication
  behavior. Separate tests cover competing authority, groups, riders, sleepers,
  atomic pool-exhaustion rejection and stale person/slot/controller commands.
- Native Three contracts pass for the same promoted identity, actual camera/flash
  matrices, a sampled 0.24m crouch, protected activity authority, real pool release
  and rejection after slot/controller replacement.
- Production `crowd_photographer` fixture shows the person/camera at Noon and pose
  with an opaque flash at Midnight, 12 draws / 1,416 triangles, with clean consoles.
  The camera now follows the copied public view so ordinary walking cannot leave
  the subject offscreen during inspection. Initial offscreen inspection was not
  accepted as raster evidence; the framed captures were checked afterward.
- Full `/tmp/zerble-people-photographer-check.log` exits 0; `bin/check-importmaps`
  passes at 145 modules, and `git diff --check` passes. Explicit Low/Mid ready-title
  clicks run the real game and advance the HUD with no captured errors. Owned tabs
  71–75 are closed. No new geometry, draws, lights, shadow casters or RNG stream
  were introduced by the role/pose extraction.

The forced debug command previously overwrote protected states and could promote
without an available camera slot; rejecting these cases is intentional ownership
validation, separate from valid-command equivalence. No new person/controller
lifetime was allocated for the role.


## Ordered contacts, October 27

Task 2.19 preserves registry-first publication and all seven population-provider
positions through explicit compiled capability ordering. `collisionContacts.js`
retains the resolver math and emits selected-hit callbacks; Crowd's candidates
copy position and capture a lifetime handle rather than publishing a raw person.
Wrappers/positions are stable during one lifetime, with acquisition cost separated
from steady-state reuse. One-wheel registry publication remains single-source.

`bin/test-people-collisions` compares 6,300 exact resolver inputs and 24 scoring
policy combinations against frozen source, then checks actual adult filters,
provider order, scratch reuse and stale slot callbacks. Native contracts verify
actual constructors under reversed registration, adult/child honk order and stopped
owner reactions. `npm run check` exits 0 in
`/tmp/zerble-people-collisions-check.log`. Low/Mid ready-title gesture boots and a
real Low person contact pass with clean consoles. The 120-frame
[contact capture](../../../verification/people/2026-10-26/collisions-low-contact-frame-trace.json.gz)
passes `bin/test-people-frame-trace`, including real frame/scoring barriers.
No geometry, shadow, RNG or audio-unlock change was introduced. Tabs 76–78 closed.


## Nearby people and lost targets, October 27

Task 2.20 adds ordered `PeopleRuntime.forEachPersonNear` and `readPerson`, with
explicit population/candidate filters and caller scratch, while every population
retains its existing locality and storage scan. `bin/test-people-queries` compares
63 actual Crowd queries with frozen source and covers strict radius, stable order,
early termination, nested scratch, filtered populations and removed/retired reads.
The ordinary lifecycle suite additionally compares 500 moving lost-target frames
with frozen `Smiles.update`, then checks copied last-valid-position fallback and
stale lifetime rejection. Native contracts exercise actual multi-family queries
and real Three pickup removal. The initial fixture reader-interface mismatch was
corrected before its passing run; the production caller uses `peopleView`.
Full `/tmp/zerble-people-queries-check.log` exits 0, importmaps pass at 146 modules,
and Low/Mid ready-title gesture boots progress with clean consoles. Low's contact
scenario also exercises the explicit adult-only common query. Tabs 79–81 closed.
No rendering, RNG, scoring cadence or iOS unlock change is included.


## Equivalent smile rules, October 27

Task 2.21 adds the pure `people/smilePolicy.js` eligibility/movement/reset helpers,
leaving distinct adult and child gains, frowns and emission barriers in their
population owners. `bin/test-smile-policy` compares 12,000 adult plus 12,000 child
transitions with frozen blocks, including exact thresholds, last-smile position,
reset state and event order. The existing 400-frame child and 2,016-frame bubble
query comparisons pass with the shared helpers. Full
`/tmp/zerble-people-smile-policy-check.log` exits 0; importmaps pass at 147 modules.
Real Low/Mid ready-title gesture boots collect natural smiles and progress the
HUD with clean consoles. Tabs 82–83 closed. No renderer, RNG or audio change.


## Place-owned display participation, October 27

Task 2.22 uses a lightweight `PlaceDisplay` adapter for the existing stage and
cook updaters. Separate slots preserve the intervening Healing Arts/light-show
barriers; inspection reports display counts and zero interactive population.
Place arrays/rigs and model animation remain owned and removed by the place.
`bin/test-place-displays` verifies 1,200 exact stage/cook frames against frozen
updaters, RNG draws, model callback time, unload/revisit, stopped ticks and borrowed
resource retention. Native Three adapter contracts pass. Full
`/tmp/zerble-people-place-displays-check.log` exits 0; importmaps pass at 148 modules.
Low/Mid ready-title boots progress with clean consoles and the saved
[display trace](../../../verification/people/2026-10-26/place-displays-low-frame-trace.json.gz)
validates 120 actual game frames. Tabs 84–86 closed. There are no new scene objects,
shadow casters or changed animation clocks in this adapter.


## Vehicle person facets and pedestrian queries, October 27

Task 2.23 registers OneWheels as a query-only population while its existing
controller retains physics/rig ownership and the world registry remains its only
collision publisher. Rider identities retire on removal, distant despawn or owner
teardown. Public copied adult views now include velocity and seat presence;
OneWheels and NutWagon no longer read raw adult records. Existing rider exclusions,
prediction, adult-only eligibility, wagon gathering and vehicle-specific boarding
rules remain intact. Lurleen's read-only `VehiclePersonFacet` preserves her physics,
relationship and render controller, with no implicit interaction/claim capability.
Ambient bird ownership remains independent.

`bin/test-vehicle-people-queries` compares 12,000 yielding decisions and 100 wagon
gather counts, then checks persistent facet reads, teardown and controller
replacement. Existing one-wheel frame-rate, lifecycle, shared-pool, collision and
five-seed encounter tests pass. Native real rider creation/query/removal/revisit
contracts pass without duplicate collider capabilities. The production crossing
fixture records yield/resume; wagon fixture shows actual boarded passengers.
Full `/tmp/zerble-people-vehicle-facets-check.log` exits 0; 149-module importmaps pass.
Low/Mid ready-title boots with both production encounters progress from 1/9 to
6/9 wagon occupancy, including four riding monks, with clean consoles. Tabs 87–90
closed. Physics, audio and RNG are unchanged by these facets.


## Accepted actor clocks, October 27

Task 2.24 changes actor time deliberately, separately from structural migration.
Crowd's disinterest writes and comparisons now share accepted population time;
Crowd bounce/wobble/cheer, Lurleen visuals, and four standalone model clocks consume
executed delta. Runtime accepted time supplies stage performer animation and both
Healing Arts update/sample inputs, keeping its prior-sample and distance cadence.
Profiling, stream budgets, nightness and audio clocks remain independent.

The pre-migration `bin/test-actor-clocks --baseline` records 2,400 model pose cases;
the migrated test matches those formulas at equivalent elapsed time and verifies
zero delta, skipped-hour resumption, accepted runtime time and exact disinterest
expiry. Native actual model transforms pass. Full
`/tmp/zerble-people-actor-clocks-check.log` exits 0, with the new mandatory clock test
also run standalone after its package inclusion. Mixed workshop Noon/Midnight
renders and pause 534 → single step 535 → resume pass with clean consoles. Low/Mid
ready-title boots progress cleanly. The saved
[clock trace](../../../verification/people/2026-10-26/actor-clocks-low-frame-trace.json.gz)
validates 120 actual game frames. Tabs 91–94 closed. Animation origins now start at
executed actor time, and paused actor deadlines do not expire against page wall
time; exact historical wall-time phase equality is intentionally not claimed.


## Final dependency routes, October 27

Task 2.25 replaces the remaining direct family update calls with named vehicle,
relationship, late-activity and star-love slots, retaining permanent registry,
collection/scoring, birds/Trip and lighting barriers. Cheer uses a supported
capability. Debug state queries and collision outlines now use public views and
actual ordered providers; watch invitations cannot overwrite a competing claim.
Honk/panic handoffs revoke an unknown behavior claim before changing movement,
while star love preserves competing claims. These invalid-command/authority fixes
are intentional, separate from valid-input equivalence.

Full `/tmp/zerble-people-final-routes-verified-check.log` exits 0, followed by a
passing focused runtime check after ordering the supported slot names to match
the documented main sequence. Native contracts cover current activity handoffs
and actual rider motion through one dispatched vehicle slot. A missing rider
schedule was caught by the real common inspector after earlier weak checks had
passed; those earlier route boots are not rider-motion evidence. The regression
failed before the fix, then passed, and strengthened native acceptance requires
strict position advancement. Corrected Low `/inspect people` shows the rider slot
and all registered families/place displays. Fresh corrected Low/Mid ready-title
boots progress with clean consoles. Tabs 99–101 closed.

The saved
[star trace](../../../verification/people/2026-10-26/final-routes-low-star-frame-trace.json.gz)
validates 120 collection/scoring/contact-order frames, but predates that rider fix
and proves no rider-motion claim. See [dependency slots](dependency-slots.md).


## Final acceptance and documentation reconciliation, October 27

All 17 baseline family rows and existing activity/resource owners are reconciled in
[acceptance](acceptance.md). All 20 saved real-game traces pass the current oracle.
Matched initial Low/Mid topology and bounded operation evidence pass
`node bin/check-people-render-comparison`; CPU overhead is recorded, not hidden.
The secondary renderer diagnostic has its concurrent-suite limitation recorded.
The earlier immutable export viewport mismatch is excluded from acceptance.

The public integration [guide](extension-guide.md) distinguishes live eligibility
from future adapters, including food-truck service, and the repeat native extension
proof passes exit, resource release and ordinary-binding restoration. The retired
raw-record rider-yield export now lives only in a frozen verification oracle; rider
manager and 12,000 public-query comparisons pass. The mandatory 51-source boundary
check rejects six deliberate dependency violations. Main capability specs now
include people-runtime and the focused population ownership requirement.

Gary’s [before/after visual](../../../verification/people/architecture.html)
and [source-grounded diagrams](architecture-visual.md) explain all family groups,
activity/role/vehicle/display distinctions, lifetime/movement/render ownership and
place extension points. The actual HTML preview renders readably with no console
warnings/errors. Preview tab 116 was closed, and its temporary viewport reset.
A narrow-layout check exposed an unbroken baseline hash overflowing the footer;
wrapping was corrected before final acceptance.


The final suite `/tmp/zerble-people-closeout-check.log` exits 0 after the last
production cleanup and mandatory boundary-test wiring. Strict OpenSpec validation,
all 149 modules/five importmaps, render comparison, current native contracts and
ready-title game boot pass. Native tab 117, game tab 118 and visual tabs 119/120
are closed; actual narrow check is 345px content = 345px client after scrollbar.
The temporary viewport was reset. Exact comparison PID 78060 and port 8766 are gone.
Current server PID 3465/8765 is explicitly handed to Gary's requested local play
session. No standalone browser/GPU/daemon was created and no unrelated process
was killed. No commit/push/deploy or automatic archive was performed.
