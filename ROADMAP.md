# Roadmap

Pending work, acceptance checks, and parked ideas. Shipped behavior belongs in
[CHANGELOG.md](CHANGELOG.md); long investigations live in the linked
[design backlog](docs/README.md#plans-and-backlog). A dated observation is a
reproduction lead, not proof that the current build still has the problem.

- [Festival Run acceptance](#festival-run-acceptance-and-operations)
- [Bugs](#bugs)
- [World generation](#world-generation-procedural-map)
- [Performance and phone validation](#performance)
- [People and NPC architecture](#people-and-npc-architecture)
- [Feature plans and decisions](docs/README.md#plans-and-backlog)

---

## Physical driving acceptance

- **Dedicated brake and parking behavior.** Add an unambiguous way to stop for
  passengers without requesting reverse. The service brake should decelerate in
  either direction and hold ordinary hills through finite tire/contact forces,
  while allowing sliding when grip is insufficient and preserving airborne
  motion. Gary approved Space to brake, E to honk, Shift to boost, R to toggle
  parking and Ctrl for precision driving; replace touch Slow with Brake and offer
  a separate Park toggle. Parking releases on fresh forward/reverse throttle,
  requiring neutral first if throttle was held when parking engaged. Parking
  engages only near a supported stop, retains physical grip limits and permits
  explicit release. Implementation and hill/boarding/device verification remain.
  Gary approved implementation November 17, 2026; see
  [the braking design and source evidence](docs/backlog/ordinary-visit.md#stopping-zerble).

- **Cornhole device feel and play balance.** Desktop native and sandbox checks cover one-tire board contact, full NPC games, retrieval and vacancies. Check incidental board feel and naturally observed busy/idle balance on a physical device; the seeded example and scheduling intent do not establish actual occupancy. [Evidence](verification/cornhole/README.md).

- **Handling, water and damage on physical devices.** The physical player, surface response, damage and submersion paths have deterministic and desktop evidence in [the driving verification record](verification/driving/2026-11-02/README.md). Verify iPhone/iPad controls, iOS engine audio, frame delivery, rollover recovery and unprompted handling/terrain recognition; tune against those observations. Capture allocation spikes and compare graphics budgets against a reproducible baseline.
- **Repair Zerble.** Gary proposed a golf-cart mechanic, repair shop or restorative item for a future feature. `VehicleCondition.restore()` is the bounded integration point; no repair interaction is available yet.

## Terrain integration acceptance

The real game now enables terrain by default, with `terrain=0` as a flat fallback, with shared map/driving inspection,
grounded consumers and matching flat acceleration/boost. See the
[current evidence](verification/terrain/2026-10-25-integration.md) and
[active checklist](openspec/changes/varying-elevation/tasks.md).
Remaining acceptance includes repeated streaming/unload/revisit checks,
road-grade and collision-height audits, all camera modes, Noon/Midnight tier
comparisons and device performance acceptance. Gary's positive mobile report
covers the authored driving proof; it does not establish full-game iOS acceptance.
The new tent support-plane fix still needs visual checks across shelter families
and terrain creases.

## Generative hoop dancers

The [flow-hooper implementation](openspec/changes/generative-hoop-dancers/README.md)
retains classic hooping and adds seeded contact choreography, traveling dance
steps/turns, supported rolls, toss/catch, two-hoop patterns and a bounded partner
exchange through the existing Crowd activity system. The
[verification record](verification/hoops/README.md) separates desktop contracts,
Noon/Midnight captures, tier material/boot checks and CPU cost from physical-device
acceptance. Remaining work is physical iPhone/Safari observation. The
[combined research assessment](openspec/changes/generative-hoop-dancers/research-assessment-02.md)
informed the implemented planted steps, waist groove, moving isolation and dance
around airborne flight, with shared articulation in regular waist mode. See the
[grounded choreography evidence](verification/hoops/grounded-choreography.md). Both reports are received; video timestamps and advanced
trick variants still need direct demonstration checks before adoption.

## People and NPC architecture

The [people/NPC refactor](openspec/changes/people-npc-architecture/README.md) now
implements explicit person/activity/resource ownership, registered specialized
populations, ordered participation and accepted actor clocks. Its
[extension guide](openspec/changes/people-npc-architecture/extension-guide.md),
[before/after visual](verification/people/architecture.html) and
[acceptance/limits](openspec/changes/people-npc-architecture/acceptance.md) explain
current eligibility and measured results. The implementation is no longer a
population-migration backlog.

- Temporary-activity acceptance still needs matched whole-game performance comparisons, extended streaming playtests and physical-device observation. The articulated-arm follow-up has isolated geometry/render comparisons and Low/Mid browser evidence in [activity animations](verification/people/activity-animations.md); see [verification](verification/people/temporary-activities.md).
- Physical iPhone/Safari audio and mobile GPU acceptance remain unmeasured here;
  muted Mac runs do not substitute for device checks.
- New gameplay such as food-truck service or child participation in adult venues
  requires explicit compatibility/selection and place adapters. The refactor
  supplies and proves that integration boundary without silently enabling it.

## Nut Wagon follow-ups

The wagon now spawns on existing festival roads, cruises slowly, pauses near gatherings, boards regular NPCs, plays the existing spatial dub groove, and is ten times likelier on each encounter roll during a Trip. Gary selected rare normally / very likely during trips, regular NPCs first, and walking-pace cruising with gathering stops on 2026-10-13. [Current parameters and verification](verification/nut-wagon/GAMEPLAY.md).

The four-to-six monk party and all eight guest places are implemented, including the standing platform. [Group behavior and checks](verification/nut-wagon/MONKS.md). The wagon now has a dedicated reggae arrangement. Shared-destination group ride quests are implemented; remaining passenger-quest acceptance is listed below.

## Festival Run acceptance and operations

The Worker deployment is recorded as complete; remaining checks are:

- Calibrate the organic-smile plausibility ceiling and review KV write costs.
- Confirm end-to-end leaderboard submissions, using request IDs to diagnose failures.
- Playtest the day ramp, scoring economy, Lurleen rescue, default mode and crowd penalties.
- Verify physical-device iOS audio unlock.
- Resolve the open human questions before archiving the change.

The [acceptance and operations record](docs/backlog/festival-run.md) preserves
parameters, dated observations and unanswered decisions. Use the
[Worker guide](workers/leaderboard/README.md) for current diagnostic commands.

---

## Bugs

- **Measure remaining neighborhood-query cost before changing crowd scheduling.**
  The June unresponsive-page fixes shipped; query-radius inflation and staggered
  soft separation remain measurement-gated ideas. Preserve hard-overlap handling
  and deterministic behavior. [Original diagnosis and decisions](docs/backlog/performance.md#june-unresponsive-page-diagnosis-historical).

- **A stage tent spawned meters from a side-stage.** *(observed 2026-06-21, seed
  `2092344521` @ x:-12, z:-345)* Two festival stage POIs generated too close together
  — they're supposed to keep their distance. A procedural-placement spacing bug in
  the festival planner ([worldgen/festival.js](src/worldgen/festival.js)) or the POI
  spacing guards in [chunks.js](src/chunks.js). Repro is the seed + coords above.
  *Diagnosed 2026-11-15, not fixed:* the plan still reproduces it, with a tent stage
  at (55, -331) and a side stage at (61, -319). Their hubs sit in neighboring cells
  only 52 m apart, at (-25, -309) and (26, -320), and every hub plants a stage. The
  cross-hub seam pass leaves a stage meeting a stage unresolved on purpose
  (`_seamResponse`, "stage+stage = unresolved spacing"), and it only compares each
  hub's zone nearest the other heart, which here is not the stage. Eight seeds over a
  5 km square held 12 stage pairs closer than 40 m among 5,566 stages. A fix needs a
  dedicated stage-to-stage check that drops the yielding hub's stage and its
  dependents, and it will move the POI snapshot for the affected hubs only.

---

## World generation (procedural map)

Worldgen v2 is the shipped default. See [the architecture](ARCHITECTURE.md#4-worldgen-v2--the-procedural-map-generator-srcworldgen)
for the current generator and its live 3D integration. Pending ideas:

- **Landscape and travel acceptance.** Varied Mountain Top districts, dense lower camping and sparse upper meadows, force-limited climbs, finite streams and bridges are enabled by default, with main's live furniture/person physics integrated. Finish physical iPhone/iPad driving and frame-delivery checks, unprompted terrain recognition/route-choice playtests and resulting tuning. Construction outliers, cold teleport spikes and finite suspension travel remain measured limits. See the [execution change](openspec/changes/landscape-and-travel/README.md), [current evidence](verification/landscape/2026-11-01-main-integration.md), and [design/reference photos](docs/backlog/landscape-and-travel.md). There is no guaranteed early hill encounter.
- **Mega-heart rank** (a rare 2×2-cell super-hub with the biggest stage/court). Cut
  from this change (the multi-cell suppression is a determinism hot-spot); rank table
  is one constant to re-add.
- **Festival map acceptance.** The discovery-based minimap and expanded live map are implemented; see [the active change](openspec/changes/festival-map/README.md) and [verification](verification/festival-map/README.md). Representative-phone performance, prolonged traversal/cache recycling, and confirmed BFCache restoration remain acceptance checks; do not infer them from desktop fixtures. Future quests can supply explicit objective pins without revealing unexplored terrain.
- **Collector + footpath road tiers.** Only arterials shipped. Footpath density feel
  is an open question (sparse "midway" vs denser web).
- **Map-sandbox polish:** a player-scale drive-time / traversal probe (guards the
  "dead air" between hearts), forest-interior drum-circle clearing POIs (the "drum
  circle nested in dense forest" we liked — deferred), and tighter lakeshore-ring
  causeway tuning.

### Festival layout

The [festival layout record](docs/backlog/festival-layout.md) preserves the
original diagnosis and delivered slices. Remaining work includes the stage/camp
substrate, arch variation and arrival-density playtesting.

### Far-field horizon follow-ups

Complete the [current fidelity and phone checks](#performance) before adding
blur or new proxy types. The [performance record](docs/backlog/performance.md#august-far-field-ideas-historical)
preserves the earlier depth-of-field, handoff and drum-circle proxy ideas.

Angle-aware actual-model tree impostors and removal of floating stage diamonds
are implemented; [the verification record](verification/tree-impostors/README.md)
tracks the measured budgets and desktop checks. Remaining forest fidelity work
is exact individual near/far placement, whose current registry-dependent near
generator is separate from the density-grid horizon, plus physical-device
frame-time acceptance for atlas sampling and the larger instance pool.

For the distant ridge scenery, a discussed idea remains a few tiny warm
homestead light points around the horizon, with staggered shutoff around 11 p.m.
of the game day. Gary wants distant points rather than distinguishable windows;
this has not been implemented.

### Festival realism research

The [research backlog](docs/backlog/festival-research.md) retains validation
questions and proposed ideas. Reconcile them with shipped work before resuming.

### Festival worldgen v2 — builder layout/mesh extraction + crowd pre-roll *(deferred 2026-06-13)*

The follow-up to `festival-zone-grammar` (split out per Q1/D13). The grammar fix
ships planner-only because the 0.5 spike proved the extraction is **off the
critical path to zero-error** (the POI golden hashes the PLAN; the `chunks.js`
builders only render its descriptors; crowd draws live in the builder). What this
follow-up still delivers — valuable but not blocking: (a) the **D-C′ "dry-runnable
builders" substrate** — split each worldgen builder into a pure
`layout(rng, env) → records[]` + `buildMesh(records)`, one builder per commit,
EMPTY snapshot-diff-gated, so the linter/overlay consume *exact* extents headlessly
instead of analytic approximations; (b) **crowd pre-roll** — `crowd.spawn` draws a
variable, tier-dependent count from the cluster rng, so a hub's realized layout
differs low-vs-high (harness R2); hoisting crowd count + per-NPC scalar seeds into
the layout records makes the *record stream* tier-independent (the realized NPC pop
stays capped by `PERF.crowdMax`). The full task list lives in
`festival-zone-grammar` tasks.md groups 1+2 (kept verbatim for this follow-up to
inherit). This supersedes the older "Dry-runnable builders" bullet below.

### Layout harness follow-ups

The layout linter, hub viewer, tuning controls, registry snapshots and playtest
markers shipped in June. See [layout verification](docs/layout-verification.md)
for the current procedure. Remaining work:

- **Dry-runnable builders** — *re-deferred 2026-06-13 (Q1/D13) to "Festival
  worldgen v2" above* (the lean grammar fix didn't need it). Builders express
  sub-component layouts as pure data (descriptor in → positions/radii out, no
  three.js); feeds the overlay + linter plan-mode *exact* extents headlessly.


---

## Music

### Section order and tempo changes

The live bands vary the order of the bridge and solo and the length of the first verse. Broader section-order variation for dance, world and dub and a deliberate tempo ramp into a new section remain open. The scheduler currently varies the starting tempo between songs and adds a gentle drift within each song. [Live arrangements](src/liveStageMusic.js) and [song scheduler](src/sound.js).

---

## Trip / wook

New effects remain Mid/High additions unless a measured Low-tier comparison
proves no regression. Feedback-buffer effects default off on Low. The
[Trip design backlog](docs/backlog/trip-effects.md) retains the designs, shipped
harness history, tier contract and acceptance criteria.

## Docs

- **Multiple sizes of `assets/zerble.png`.** Currently a single PNG. A higher-res original would scale down cleaner on Retina displays — the README `<img>` is set to `width="420"` but devices pull the full resolution.

---

## Touch / UX

- **First-drive touch guidance.** After a real Start tap, consider a brief thumbstick hint for new touch players. The Lantern Night title no longer uses a backdrop filter; the existing `game-started` gate still owns touch-control visibility.

---

## Gameplay verbs

- **Bubble Upgrades rollout:** finish the pending visual gate, crowd charm,
  leaderboard headroom and final performance/docs checks in the
  [feature plan](BUBBLE-UPGRADES-PLAN.md).
- **Passenger quest acceptance.** The reviewed integration includes hailing, rider destinations, urgent porta-potty runs, mountaintop requests, monk-party rides and the Passport Ride log. Desktop checks cover live ordinary/urgent delivery, explicit Low/Mid/High boots, compact Ride log layout, keyboard controls and storage failures. Solo facility reservations, delayed completion, usable tree-hammock seats, top-center direction guidance and bounded post-delivery venue walks are implemented. Still needed: physical-phone play and top-center guidance readability, audio cues by ear, live mountaintop guidance, the urgent failure/flee sequence and live facility interruption/unload behavior, hailer readability at 30–75 m, the four quest-earned bubble looks and Gary’s judgment of reward balance and hailing frequency. Kids requesting rides, tokens and streaks stay parked. See the [change record](openspec/changes/passenger-quests/README.md) and [verification](verification/passenger-quests/README.md).
- **Festival activities:** daily-seed challenge, boost/hop tricks, food-truck
  purchase-and-dining behavior and vendor power-ups.
- **Physical festival:** implement the [documented plan](openspec/changes/physical-festival/README.md)
  for chair/occupant physics and recovery, the existing cooler, transferable drinks,
  route-aware damageable signs and bounded aftermath. The standalone engine fixture
  and default-enabled live chairs, articulated coolers and occupied-seat falls/recovery are implemented;
  ordinary pedestrians and swept prop-to-person activation are also implemented with bounded reserves.
  Real secondary fall/recovery and bounded incident provenance are verified; untouched offscreen
  residents can release slots without resetting displaced aftermath. Controlled seated exits
  retain support when blocked. Bracing uses free arms without adding geometry; cooler model lids and cup-well sockets
  are partitioned and retain independent transforms after active render adoption. Live lids reserve and clean up with their shell. Finish loose contents, hard-impact hinge tuning, broader visual acceptance, moving-person sweeps, support-boundary and coherent
  distance-reset policy, broader props and device acceptance.
  See the [first proof and remaining work](verification/physical-festival/README.md).
- **Juice tuning:** keep variety costs and drain/frown feel as explicit design decisions.

The [gameplay design backlog](docs/backlog/gameplay.md) preserves the full
mechanics, tradeoffs, dependencies and original proposals.

### First passenger vignette: a lift to a friend's set

The [ordinary-visit design record](docs/backlog/ordinary-visit.md) preserves the
broader Locke-inspired direction, feasibility assessment and exploratory brake
and on-foot participation ideas. The actionable vignette summary follows.

**Design direction, recorded November 17, 2026.** Compose an optional first-visit
experience around an ordinary passenger asking for a lift to hear a friend's band.
The player makes someone smile, notices a readable invitation, shares a short
journey, brings the passenger to a gathering and can stay for the music or continue
exploring. Aim for a satisfying five-to-ten-minute visit without a mandatory
sequence, countdown or guaranteed unlock. Ignoring the invitation must leave
ordinary play available.

Reuse the existing [passenger dialogue and tuning](src/quests/catalog.js),
[destination selection](src/quests/pick.js),
[arrival handling](src/quests/runtime.js),
[song-end/audience hooks](src/sound.js) and [Passport Ride log](docs/passport.md#ride-log).
These are integration points, not evidence that this composed experience exists.

Remaining work:

- **Choose a good invitation.** Favor one visible, ordinary stage-bound request
  for a new player's introduction when a suitable person and destination exist.
  Fall back gracefully otherwise, avoid competing introductory hails, and leave
  breathing room after delivery. Do not force boarding or redirect a player who
  chooses another activity.
- **Choose a pleasant journey.** Check usable approach and stopping space,
  terrain and obstacles rather than treating straight-line distance as travel
  difficulty. Inspect the first-drive bubble reaction and passenger readability
  at real chase-camera and phone scale. Do not silently alter seeded layouts.
- **Connect the story.** Give the request, in-ride remarks, thanks and visible
  departure a coherent authored variant, ending in a supported venue behavior.
  Let the player enjoy the existing band and audience response without promising
  a timed encore, a new crowd migration or a fabricated performance schedule.
- **Remember the visit.** Extend the bounded Ride log with a stable vignette
  identifier and a human-readable memory such as a lift to a friend's set,
  preserving existing saves and storage-failure behavior. No named recurring
  character or cross-device persistence is required.
- **Verify the whole experience.** Exercise absent/unsuitable destinations,
  ignored invitations, interrupted rides, streaming/unload and save migration in
  deterministic checks; observe the real-game journey and arrival on desktop and
  phone. With an uncoached player, check whether they notice the invitation,
  understand the trip, recognize the passenger's arrival and choose what to do
  afterward. Do not claim success from a scripted completion alone.

This section records future work, not an implementation or scheduling approval.
Keep the [current performance gate](#performance) and existing passenger/device
acceptance in force; measure any added selection work and simulation cost.

### On-foot festival participation as Gary

**Exploration direction, recorded November 17, 2026.** Gary wants the ability to
switch from driving Zerble to controlling the person, with substantial planning
before implementation. The purpose is to join the festival after arriving:
use a porta-potty, lie in a hammock, sit in a camping chair, get a cooler drink,
play cornhole or frisbee, hula hoop, dance, clap, do yoga or potentially shop.
This is an activity wishlist, not evidence that NPC behaviors are already usable
by the player or a commitment to deliver them all together.

Design explicit driving, walking and activity states, with appropriate input,
camera and interaction choices. Passenger quests cannot simply keep behaving as
though the player is driving: decide departure eligibility, passenger handling,
quest clocks and resumption, as well as Festival Run consequences. Recommend
nearby-object highlighting and a deliberate contextual action, with a short choice
when several actions are available; proximity alone should not make Gary sit,
buy, take a drink or join a game. Exact controls and UI remain undecided.

Plan safe exits/re-entry, physical parking, parked-cart persistence and streaming,
occupied/blocked objects, shared NPC/player resource ownership and cancellation.
Prove park, exit, one meaningful activity and return before expanding the roster.
Joining a stage audience to dance/clap after a delivery is the recommended first
scene, not a selected implementation requirement. See the
[on-foot design, activity wishlist and open decisions](docs/backlog/ordinary-visit.md#stepping-out-as-gary).

---

## World

- **Car-camping vehicle designs.** Develop a varied set of parked festival vehicles that can participate in car-camping arrangements, such as cars, wagons, vans and camper-style vehicles alongside tents and shelters. Gary recorded this as a future idea on November 1, 2026; the model roster, interaction and driving behavior are not decided or required by the current landscape change.
- **First-aid booth or tent.** Gary requested this as a future festival addition on
  November 1, 2026, explicitly not for current implementation. Its appearance,
  placement and any interactions remain undesigned; no healing mechanic or medical
  simulation is implied. Reconcile with existing welfare amenities when designing it.
- **Hillside Barn venue, later iteration.** A two-story building inspired by Gary's
  LEAF reference, built into a hill so each floor has direct road/ground access at
  its own elevation. Preserve layered support and access in the
  [landscape design](docs/backlog/landscape-and-travel.md#support-navigation-collisions-and-the-future-barn),
  but keep the building and its activities outside the current landscape scope.
- **Lantern parade device playtest.** Gary approved the full six-subject replacement for commit on 2026-10-12. Physical-phone timing and repeatable cross-mode collision/SFX playtests remain unmeasured; see the [saved renders and verification limits](verification/puppet-parade/README.md). The original direction and handoff are in [PUPPET-PARADE-PLAN.md](PUPPET-PARADE-PLAN.md).
- **Bubble inhabitants.** Once in a while a bubble drifts past with a tiny waving figure inside it (silhouette billboard, ~0.1m). Rare enough to read as an Easter egg. One mesh, low spawn rate, despawn with parent bubble.
- **Bird polish follow-ups.** Birds shipped (see CHANGELOG 2026-06-01). Parked refinements: a quick wing-flutter SFX on startle; biasing flocks to spawn around stages/food (attractor-aware) rather than uniformly; and a "bird poops on the cart" easter egg.
- **Real lake reflections via `Reflector`.** An earlier procedural "twinkly stars" shader patch on the water surface looked like fake sparkles fading in/out — not reflection physics. Removed in favor of plain water for now. A proper Reflector (`three/examples/jsm/objects/Reflector`) would render the scene from the mirrored camera into a texture and sample it from the water surface — actual mirror of sky + stars + moon + nearby objects. Cost is roughly a second scene render whenever the player can see a lake; would gate to high tier only, and possibly half-res target + nightness-driven wet/dry mix so it only matters when reflections matter.

---

## Performance

- **Complete capture preparation before further performance changes.** The [active iPad performance change](openspec/changes/ipad-performance-strategy/README.md) follows the [November 15 council](openspec/changes/ipad-performance-strategy/deliberations/001-next-levers/results.md): freeze production performance changes, finish the remaining census/build-freeze gates, then run Auto, locked baseline, Auto again, and horizon off on one fixed Low-tier route. Capture attribution and the [reserved-Mac descriptive overhead check](verification/performance/2026-11-15-ipad-attribution/desktop-window/README.md) are implemented, with +0.20 ms against the declared 2 ms bound and sampled publication limits frozen; a 72.9 ms far-field preparation interval still misses the unchanged 50 ms target. Choose the next lever from the resulting device evidence; future physics/population changes and default promotion remain Gary's decisions when relevant.

- **Confirm the far-field publication fix on the iPad.** The November 8 fixed-route capture attributed the largest driving world interval (424 ms) to far-field work. On November 11 that interval was traced to one unbudgeted horizon rewrite and replaced by a byte-identical publication prepared in bounded pieces; the offline probe's worst driving call fell from 61–176 ms to 3–33 ms. Rerun the fixed route and read `ffApply`, `ffApplyFrames`, the far-field world section and the time until the first horizon appears after Start, since the first publication is now spread over frames instead of blocking. A single cold festival or woodland plan is still one 15–30 ms unit on the M4; split it only if the device run shows that tail. Acceptance requires both bounded far-field intervals and continuing publication, using pre-registered thresholds plus `applySuperseded` and horizon age. The four-group child comparison stays parked unless people timings justify it. [Fix evidence](verification/performance/2026-11-11-far-field-publication/README.md) · [Route evidence](verification/performance/2026-11-08-ipad-child-density/README.md) · [Baseline](verification/performance/2026-11-07-ipad/README.md) · [Device procedure](docs/performance-playtests.md#fixed-route-device-autopilot-and-world-attribution).

- **Decide whether the horizon should stop at the fog limit.** At one Low pose more than half of the published far-field instances sat beyond the 520 m fog-opaque radius (canopies to 1,508 m), because pools under their cap keep every candidate. After the four-run session, a default-off fog-limit cull is the leading candidate, with horizon-off pricing only its upper bound. Filter after every seeded draw and before terrain grounding, then verify subset fingerprints and Noon/Midnight Low/Mid appearance; device confirmation and Gary's approval are required before a default change. Other candidates from the same review (direct rendering when bloom and Trip are off, per-tier light pools, frozen static chunk subtrees, budgeted unloads and lake builds, cheaper terrain cache keys) are recorded with their evidence status in the [performance backlog](docs/backlog/performance.md#november-11-review-unmeasured-candidates).

- **November 6 terrain evidence: no device before/after exists.** Present in every recorded November iPad capture, so a future run cannot isolate their benefit. Exact local support-plane reuse and direct ground-lattice height queries passed full checks/build, tier/route integration and both calibrated High desktop comparisons. The primary frame-delivery verdict is no detectable change; median work timers fell about 1.3 ms, with a 5.85 ms paired driving-p99 improvement as a secondary metric. Revised worst driving frames still reached 130.5 ms. Use the new attributed device session to locate remaining spikes, without claiming a retrospective before/after result. [Final evidence](verification/performance/2026-11-06-terrain-sampling/lattice-README.md).


- **November 5 optimization evidence: no device before/after exists.** Present in every recorded November iPad capture; the November 8 build already contained `65c0085`. Child resource pooling, camera-aware presentation instancing and irrelevant terrain-query rejection are implemented. Four fixed-tier desktop comparisons passed, with High festival/route median run p95 improving to 18.3/19.9 ms and no detectable primary delivered-frame change on Low. Candidate route worst frames still reached roughly 140–168 ms, so trace those remaining spikes before choosing the next streaming change. The November 5 changes are merged into main. Follow the [saved results](verification/performance/2026-11-05-optimization/README.md) and [device procedure](verification/performance/2026-11-05-optimization/ipad-acceptance.md).

- **Desktop Auto follow-up.** The [November 2 investigation](verification/performance/2026-11-02-render-load/README.md) removed detailed bubbles' duplicate scene render and distant-stage terrain sweeps after Gary reported 15 FPS on Auto. The matched High Chrome profile reduced median frame work from 86.8 to 30.9 ms with about 300 adults retained. Gary's actual Auto driving frame delivery still needs a fresh playtest; the parked profile is not a route replay or a 60 FPS acceptance result. Keep further changes tied to measured remaining costs.

- **Validate first dusk and first Trip on the phone.** Repeat those moments with
  post-process preparation enabled; the fixed driving route does not exercise them.
  The October 22 registry optimization was present in the November iPad captures,
  and no device before/after exists for it. Desktop probes establish avoided shader
  work and lower index-maintenance cost, not a phone latency or FPS guarantee.
  [Shader evidence](verification/performance/2026-10-22/render-stall/README.md) ·
  [Registry evidence](verification/performance/2026-10-22/index-maintenance/README.md).
- **Keep Auto as the shipping quality policy.** The guided Auto/Sustained pair
  did not establish a policy change. The iPad within-phase observations show
  resolution drops shortening frames; run 2 of the new four-run session supplies
  the matched locked-quality control, bracketed by Auto repeats. Confirm production ingestion of the new quality
  telemetry. [Device comparison](verification/performance/2026-10-22/guided-quality-comparison.md) ·
  [GA configuration](verification/performance/2026-10-21/GA-SETUP.md).
- **The Low HUD budget is not a device acceptance verdict.** Its 80-draw target is not a usable stop condition against the council's measured 514–1,270 draws. Preserve the budget until Gary recalibrates it, and judge the selected change using fixed-route device work and wall-time evidence rather than HUD color. [Evidence and constraint](openspec/changes/ipad-performance-strategy/deliberations/001-next-levers/results.md#change-group-5-documentation-and-spec-drift).
- **Continue measured streaming and draw-cost work after attribution.** Remaining candidates include
  splitting hot chunk builders while registering colliders synchronously, distant
  cluster instancing/LOD, and recalibrating HUD budgets from device captures.
- **Finish far-field fidelity.** Match near-world camp/tree placement and vendor
  rejection rules, then validate lighting and moving handoffs on the phone.
- **Retain the parked optimization ideas.** The [performance backlog](docs/backlog/performance.md)
  preserves slice status, measurements, rejected approaches, model pooling ideas,
  and the remaining device-performance measurement work.

---

## Out of scope (worth flagging)

- **Sample-based audio (mp3/wav).** Adding recorded audio means an asset pipeline and a CDN story. Synthesized stays the constraint for game SFX + stage music. MIDI playback uses Tone.js synthesis — no samples shipped.
