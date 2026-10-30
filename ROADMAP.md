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

The four-to-six monk party and all eight guest places are implemented, including the standing platform. [Group behavior and checks](verification/nut-wagon/MONKS.md). The wagon now has a dedicated reggae arrangement. Shared-destination group ride quests remain in the passenger-quest backlog.

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

---

## World generation (procedural map)

Worldgen v2 is the shipped default. See [the architecture](ARCHITECTURE.md#4-worldgen-v2--the-procedural-map-generator-srcworldgen)
for the current generator and its live 3D integration. Pending ideas:

- **Rivers + bridges.** Cut from the 2D prototype on determinism grounds
  (river-around-heart avoidance can depend on a heart outside the local window →
  could violate "never through a heart core"); the contract fields
  (`onRiver`/`bridge`) already exist as stubs. Needs a river×heart window-invariance
  gate before it lands. The payoff (driving over a bridge) is a 3D thing.
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

### Section transitions *(polish on shipped songform)*

Real songform shipped 2026-06-03 — each melodic stage plays finite songs with
named sections (intro/verse/chorus/bridge/outro, or intro/build/drop/break for
dance), per-song tempo + key changes, voices coming in/out by section, and a
crowd cheer between songs. The 2026-10-14 performance pass added recurring
motifs, alternate answers, section dynamics, jam/brass transition fills, dance
sixteenth-note arpeggios and a complete triplet clave grid. Musician poses,
instruments, stage equipment and performer washes also shipped; see
[verification](verification/festival-performance/README.md).

Remaining extensions are a probabilistic section-order scheduler and tempo
ramps within songs. The current order remains genre-specific, with per-song
tempo changes and a gentle tempo drift.

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

- **Touch overlay during title card.** Currently hidden behind the title's `backdrop-filter`. After Start, the overlay reveals — that's fine, but a brief "tap-and-go" hint after Start might help new touch players find the thumbstick.

---

## Gameplay verbs

- **Bubble Upgrades rollout:** finish the pending visual gate, crowd charm,
  leaderboard headroom and final performance/docs checks in the
  [feature plan](BUBBLE-UPGRADES-PLAN.md).
- **Passenger quests:** rider destinations, shared monk-party quests and the
  urgent porta-potty variant.
- **Festival activities:** daily-seed challenge, boost/hop tricks, food-truck
  purchase-and-dining behavior and vendor power-ups.
- **Physical festival:** implement the [documented plan](openspec/changes/physical-festival/README.md)
  for chair/occupant physics and recovery, the existing cooler, transferable drinks,
  route-aware damageable signs and bounded aftermath. The standalone engine fixture
  and opt-in live chairs, articulated coolers and occupied-seat falls/recovery are implemented;
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

---

## World

- **Lantern parade device playtest.** Gary approved the full six-subject replacement for commit on 2026-10-12. Physical-phone timing and repeatable cross-mode collision/SFX playtests remain unmeasured; see the [saved renders and verification limits](verification/puppet-parade/README.md). The original direction and handoff are in [PUPPET-PARADE-PLAN.md](PUPPET-PARADE-PLAN.md).
- **Bubble inhabitants.** Once in a while a bubble drifts past with a tiny waving figure inside it (silhouette billboard, ~0.1m). Rare enough to read as an Easter egg. One mesh, low spawn rate, despawn with parent bubble.
- **Bird polish follow-ups.** Birds shipped (see CHANGELOG 2026-06-01). Parked refinements: a quick wing-flutter SFX on startle; biasing flocks to spawn around stages/food (attractor-aware) rather than uniformly; and a "bird poops on the cart" easter egg.
- **Real lake reflections via `Reflector`.** An earlier procedural "twinkly stars" shader patch on the water surface looked like fake sparkles fading in/out — not reflection physics. Removed in favor of plain water for now. A proper Reflector (`three/examples/jsm/objects/Reflector`) would render the scene from the mirrored camera into a texture and sample it from the water surface — actual mirror of sky + stars + moon + nearby objects. Cost is roughly a second scene render whenever the player can see a lake; would gate to high tier only, and possibly half-res target + nightness-driven wet/dry mix so it only matters when reflections matter.

---

## Performance

- **Validate the October 22 changes on the phone.** Repeat first dusk and first
  Trip with post-process preparation enabled, then compare driving frame delivery
  after the registry optimization. Desktop probes establish avoided shader work
  and lower index-maintenance cost, not a phone latency or FPS guarantee.
  [Shader evidence](verification/performance/2026-10-22/render-stall/README.md) ·
  [Registry evidence](verification/performance/2026-10-22/index-maintenance/README.md).
- **Keep Auto as the shipping quality policy.** The guided Auto/Sustained pair
  did not establish a policy change; repeat a comparable route in reverse order
  after isolating the stall. Confirm production ingestion of the new quality
  telemetry. [Device comparison](verification/performance/2026-10-22/guided-quality-comparison.md) ·
  [GA configuration](verification/performance/2026-10-21/GA-SETUP.md).
- **Continue measured streaming and draw-cost work.** Remaining candidates include
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
