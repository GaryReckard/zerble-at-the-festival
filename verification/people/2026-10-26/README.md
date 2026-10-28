# People verification foundation, 2026-10-26

This is characterization before the ownership migration, not acceptance of the
completed refactor. The workshop uses production controllers; the traces were
saved from the full game after a ready Just Cruisin' mode click in the in-app
browser, with muted audio, seed 1977 and stationary player controls.

## Saved real-game traces

| Capture | Accepted frames | Simulation seconds | Nonempty pickup snapshots | Positive score-collection frames |
| --- | ---: | ---: | ---: | ---: |
| [Low pickup trace](low-pickup-frame-trace.json.gz) | 600 | 10.057 | 968 | 9 |
| [Mid pickup trace](mid-pickup-frame-trace.json.gz) | 600 | 11.643 | 1045 | 13 |
| [Initial Low startup trace](low-frame-trace.json.gz) | 120 | 2.020 | 0 | 0 |

The two pickup captures used `peopleTrace=1&peopleTraceFrames=600` and the
**Trace: add two smile pickups** control before the recording filled. The initial
startup capture has no positive pickup evidence. All three pass:

```sh
node bin/test-people-frame-trace verification/people/2026-10-26/low-frame-trace.json.gz
node bin/test-people-frame-trace verification/people/2026-10-26/low-pickup-frame-trace.json.gz
node bin/test-people-frame-trace verification/people/2026-10-26/mid-pickup-frame-trace.json.gz
```

The oracle checks actual update order, age advancement across adult emission and
collection, unchanged pickup ages across child emission, positive collection's
scoring route, collision-candidate publication before selected results, and final
render submission. Production hooks retain existing interleaving with non-person
systems; no runtime-controller migration is claimed.

The initial pickup captures have zero positive collision results, active star-love
frames and chunk-disposal events. The later scenario captures below cover those
branches. Natural boarding/disembarking, repeated unload/revisit, hidden-frame
behavior and physical-device audio unlock remain migration acceptance checks.
Their instrumented, background IAB timing is not a comparable performance baseline.
No physical-device or frame-budget claim follows from these files.

## Workshop and routine contracts

`/sandbox.html?entity=people_workshop&seed=1977&mute=1` constructed 41 Crowd adults,
including four monks and 20 Healing Arts visitors, plus one real child gaggle.
Observed legacy-random child counts varied between five and eight. Default game
child construction is unchanged; the preview explicitly requests one gaggle.

The browser demonstrated pause followed by exactly one step (2319 → 2320), Noon
and Midnight displays, Healing Arts unload reducing owned registry entries from
40 to 29, and workshop disposal reducing adults/monks/visitors/owned entries to zero.
Switching to the child fixture and back constructed a fresh mixed owner with
40 entries; the captured workshop console had no errors. These are lifecycle and
visual checks, not performance baselines. The outer sandbox releases GPU objects
when switching fixtures; the dispose button first releases behavior and registry
ownership and hides the root.

`node bin/test-people-workshop` tests the production driver with recording
boundaries and the actual HealingArtsActivity, checking adult/collection/child
order, previous-sample handoff, pause/step, accepted delta, reentrant/repeated
teardown, and preservation of an unrelated registry entry. Its constructor test
executes the real KidGaggle constructor with scene stubs, verifying default versus
explicit eight-gaggle records and all 304 controller RNG draws in the fixture.
`node bin/test-people-frame-trace` checks bounded copying, report isolation, inert
completed recording, local sink acknowledgement/rejection and request abort cleanup.
Both are mandatory in `npm run check`; nested modules are mapped on all five pages.

## Capture lifecycle

The initial browser download operation took approximately 54 minutes to return,
then its owned game tab was closed. The workflow now uses the existing loopback
capture sink with a five-second request abort, and the Low/Mid save controls both
reported success. No standalone headless WebGL session was launched. Each owned
IAB tab is closed after use, and the task-owned no-cache server is stopped at the
end of the run. No unrelated browser processes are killed.


## Positive scenario traces

The Low seed-1977 game used the ready mode gesture and named trace buttons, with
120 accepted frames per scenario. Every scenario passes the same frame oracle,
which additionally requires positive results for its named branch:

- [Moving contact](low-contact-frame-trace.json.gz): one damaging production person hit.
- [Star love](low-star-frame-trace.json.gz): all 120 frames active, with contacts bypassed.
- [Streaming](low-stream-frame-trace.json.gz): nine ordered, completed chunk disposals after a 1,800m relocation.
- [Seats](low-seats-frame-trace.json.gz): real riding people linked to owned cart slots, captured before/after the existing seat-fill diagnostic and after adult/late updates.

The recorder now copies bounded adult poses/state and seat occupancy at their
barriers, in addition to pickups and candidates. It preserves no actor references.
Cart slots omit `vehicle`, so diagnostics resolve ownership by slot membership.
The source capture oracle refuses a named scenario that lacks its positive evidence.
The game console contained no captured errors. These cases characterize production
behavior and do not replace future migration equivalence and lifecycle acceptance.

## Low and Mid CPU/operation baselines

[Low baseline](low-baseline.json) and [Mid baseline](mid-baseline.json) use seed 1977,
quality level 0 with adaptation disabled, time .30 and a fixed camera at
`[-431,12,-84]`. Each warms for 120 accepted frames and measures 180 more. The GPU
reports `ANGLE Metal Renderer: Apple M4 Pro`; document visibility reports foreground
throughout. These are instrumented CPU windows in the in-app browser, not GPU time,
physical-device FPS or a performance improvement claim. Three isolated spawn/remove
probes use a private constant fixture RNG, leaving gameplay streams untouched.

| Field | Low | Mid |
| --- | ---: | ---: |
| Work milliseconds p50 / p95 / max | 6.0 / 6.6 / 9.2 | 10.3 / 11.8 / 14.8 |
| Physical canvas and scene target | 1600 × 900 | 1920 × 1080 |
| First sampled adults / children | 101 / 51 | 214 / 48 |
| First sampled scene draws / triangles | 1,148 / 411,471 | 2,235 / 1,181,712 |

Raw frames retain candidate counts, matrix writes, claims/riders/visitors, quality,
physical targets, scene programs/geometries/textures, accepted delta, work and wall
intervals. Aggregated method probes retain counts/total/max for adult and child
updates, pickup updates, distance sweeps, matrix writes and spawn/remove calls.
Nested probe costs overlap and must not be summed as independent stages. All
three spawn/remove probes succeeded in each tier and all method probes restored.

```sh
node bin/test-people-baseline verification/people/2026-10-26/low-baseline.json verification/people/2026-10-26/mid-baseline.json
```

Compare later runs **within a tier** using matching recorded dimensions, quality,
seed, camera, time, population, activity/visibility and lifecycle conditions. The
unseeded legacy child population differs between these two tier captures; they
are separate baseline profiles, not a controlled Low-versus-Mid speed comparison.
Reject unmatched runs when testing zero additional draws or operation regressions.
Existing scene budgets are not relaxed by capturing an over-budget scene. The
final refactor still needs equivalence checks and physical-device acceptance limits.


## Accepted Healing Arts, children and extension slices

`bin/test-healing-arts-ownership` compares 3,600 movement/state/cooldown, role and
binding frames against the frozen baseline activity, and exercises rollback,
interruption, reused slots, owner replacement, unload/revisit and exit ordering.
`bin/test-healing-arts-sampler` separately verifies exact motion and skipped-display
cadence. The public activity receives only a restricted protocol in its ownership
contract, with no raw-record or renderer API available.

`bin/test-children-ownership` compares 400 frames and random draws against the frozen
pre-migration child controller, including bubble chasing, smiles, honk, dodge, star,
grounding, collider copies and relocation. It also verifies constructor rollback,
shared-resource preservation and stale controller/runtime identities. The real-model
browser contracts pass relocation and identity invalidation before geometry disposal.
New `children-low-contact-frame-trace.json.gz` and
`children-low-stream-frame-trace.json.gz` contain 120 accepted real-game frames each
and pass `bin/test-people-frame-trace`, preserving score/pickup/collision barriers.

`bin/test-people-extension` exercises the same `PlaceVisitActivity` against Crowd's
production public methods and independent Map storage, two place reservation formats
and two visible-binding variants. It verifies contention, unload, interruption and
incoming-owner disposal during handoff. The real Three browser extension fixture
passes entry/exit, reservation restoration, retained identities and singular rendering.
See [the extension guide](../../../openspec/changes/people-npc-architecture/extension-guide.md).

The final full checks passed in `/tmp/zerble-people-children-final-check.log` and
`/tmp/zerble-people-extension-final-check.log`. Low/Mid ready-title main boots and
Low Noon/Midnight mixed workshop checks produced no captured console errors; disposal
reported zero people/jobs/registry entries. The later child workshop used seven
unseeded children, so its 247 day draws/90,368 triangles are not a valid performance
comparison against the earlier six-child run. No physical-device audio or whole-change
acceptance is claimed. All owned tabs were closed after these checks; the task-owned
server remains in use while implementation continues.


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
