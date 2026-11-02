## Context

[Full design/reference](../../../docs/backlog/landscape-and-travel.md) and [fresh Astra critique](../../../docs/backlog/landscape-and-travel-astra-review.md) establish intent. Current terrain is enabled by default, uses exact 10-meter triangles and zero-height destination pads. Existing Vite check/build pass before this change, including concurrent experimental Rapier fixtures. The working checkout contains unrelated physics/boot changes; preserve them and do not switch branches or commit them.

## Goals / Non-Goals

**Goals:** recognizable natural landforms; natural power-limited climbs; reachable Mountain Top shelves and sheltered drum clearing; complete finite streams/bridges; bounded deterministic plans; meaningful cheap diagnostics and tests; seamless production ownership and support.

**Non-Goals:** the Barn building/interiors, first-aid model, global erosion/drainage simulation, arbitrary indoor navigation, rigid-body replacement of arcade driving, near-spawn guarantees, or production rollout before evidence.

## Decisions

### Execution dependency map

Baseline -> pure support/solid contracts -> bounded authored geometry proof -> full-width route/relocation proof -> complete district with real builders -> deterministic district admission -> stream/crossing integration -> all-consumer migration -> tier/device rollout.

A tiny functional bridge participates in the geometry proof before broad consumer migration. The complete watercourse/district generation follows later. Each step produces executable behavior, not a second throwaway implementation.

### Proposed modules and contracts

- `src/landscape/support.js`: renderer-independent support selection. Terrain is the fallback; deck descriptors carry stable IDs, horizontal bounds, sample height/normal, and explicit terrain approach gates. Queries carry current support ID/elevation. Transfer between terrain and deck requires an approach and a compatible height; underneath actors remain underneath. Footprint sampling cannot silently switch layers. Use caller-owned output/scratch for steady-state queries.
- `src/landscape/fixture.js`: bounded authored two-shelf/bank/side-road/stream/bridge geometry descriptors for the engineering proof. Own deterministic immutable data and the exact triangulated terrain query. It is a fixture of the contracts, not the procedural generator or proof of a populated mountain.
- `src/landscape/geometry.js` if needed: geometry data without Three.js, shared by render/contact/physics adapters. Start with regular local triangulation; measure before adding adaptive tessellation.
- `src/landscape/routes.js`: full-width corridor, join/turn envelope and endpoint validation; finite search over declared alternatives. Reports rejection reason, not an unlimited retry loop.
- `src/worldgen/landscape.js`: independent bounded candidate identities/landforms/ports; never calls final terrain or runtime registry. `districtPlan(id)` owns shelves, local route, banks and clearing; region queries only select canonical plans.
- Surface runtime adapter: binds support state to the cart and other movers, validates all position corrections and publishes vertically meaningful solid bounds. Keep the registry X/Z broadphase and ordered contact behavior; vertical narrow-phase eligibility uses actual intervals, not blanket different-ID exemptions.

Descriptors must state coordinates, immutable owner ID/version, influence bounds, protected foundations, activity-ground limits, approach ports and disposal/pinning requirements. Water is separate from ground support. Optional metadata must not change default legacy behavior until the runtime adapter is deliberately enabled.

### First concrete experiment

Reuse `terrain-sandbox.html?surface=landscape&mute=1` and the real Zerble controller, rather than create a new render loop/page. Provide explicit jumps to the lower meadow, steep bank, upper meadow, descending clearing, bridge deck and underneath. Render terrain and deck separately; inspect terrain-vs-support identity, check ray hits against the selected surface, and retain Noon/Midnight/wireframe controls. Existing course/world modes stay unchanged.

Proof bounds remain small; reference photo establishes visual intent, not measured geography. Initially use a regular one-meter local mesh in the bounded fixture. This settles support/refinement architecture without globally increasing world resolution. Water and deck can be simple geometry during the contact proof, with art completeness in the populated district/crossing task.

### Fixed decisions versus experiment outcomes

Fixed: deterministic complete owners; level structural foundations separate from gently sloped occupancy; route before occupied admission; shared geometry; explicit layer transitions; no unintended production layout change.

Experiments settle numerical grades, transition/gate tolerances, road width/turn clearance, acceptable detour/recognition rates and device budgets. Record results once in evidence.md, then update downstream contracts/tasks. Do not repeatedly rediscover settled choices.

### Bounded route and district admission

Regional graph supplies fixed ports. A district proposes a finite ordered set of local forms/approaches. Validate the complete cart footprint and supported width, actual slow-speed turn sweep, endpoint joins and final graded surface. On failure use the next declared alternative, then omit the occupied district with a diagnostic reason. Never publish unreachable destinations or chase infinite connected pad components. Surveys report measured component coverage with their halo/resolution, not global infinite-world connectivity.

### Water ownership

First release uses complete bounded source-to-receiver stream systems. A receiver owns a compatible water level; unrelated zero-level lakes need not connect. A future cross-region river requires shared edge ports and levels before interiors are generated. Final foundations cannot violate accepted channel/road envelopes. No cosmetic ribbon over uncut ground is counted as a stream.

### Migration and scope containment

Keep current live layout as baseline while contracts and proof are developed. Introduce a deliberate generation version/opt-in only after real district integration. Never re-salt/reorder existing RNG incidentally. Audit every terrain consumer and physically simulated prop; default fallback remains until both shared geometry and interaction eligibility pass. Preserve current lake/forest/chunk ownership, shared pools and instance flags. No start-gesture/audio changes.

### Execution discipline

Each numbered task below owns concrete modules, depends on earlier named deliverables, and has a pass condition and failure action. Run focused tests per edit; run full check/build at completed runtime groups. Integrate into the real game and inspect ready mode-plank boot before claiming production acceptance. Keep new experimental modules outside the game's initial import graph until enabled deliberately. No mass refactor of grounded consumers during the proof.

### Session/model guidance

Continue in this session while context is intact. The execution files provide a recovery boundary for any later session. Use high reasoning for architecture/cross-system debugging and ordinary effort for closed, focused edits; escalate independent review on evidence, not model switching as a ritual. Official reasoning guidance: https://developers.openai.com/api/docs/guides/reasoning . Exact model/effort superiority is not benchmarked for this repository.

### Council closure: first-proof semantics

The immutable support service exposes selected-layer sampling separately from transition proposals. `createSupportBinding` owns one mover's accepted surface and exposes a bound sampling function for center/wheel/suspension probes. `terrainDriving` only asks its optional binding for a proposal, commits it after the movement is accepted, and otherwise leaves state unchanged. Sampling, ray checks, and interpolated presentation never commit a transition. The initial adapter belongs to Group 3, in `src/landscape/support.js`, `src/terrainDriving.js` and the sandbox; broad live publication stays Group 4.

A new mover explicitly acquires terrain or a validated named support. Unknown/deleted occupied support returns `valid:false`, `traversable:false` and a reason; it never silently reacquires ground. The runtime retains the accepted pose and exposes reset/reacquisition. A closed deck edge likewise blocks. During approach straddling the selected surface has a defined extrapolation only inside its approach margin, and every footprint sample must agree within the fixture contact tolerance before transfer. Each binding has independent state and restores it after verification.

First fixture geometry ceiling: existing course bounds x[-60,60], z[-420,35], one-meter lattice, at most 55,781 allocated terrain vertices (55,176 unique) / 109,200 terrain triangles, six terrain strips, one deck batch (2 triangles), one water batch (2 triangles). Existing cart/flags/signs remain their own baseline; no terrain shadows or globally refined ground. Actual total draws/triangles, generation/upload time and counters will be recorded; these ceilings are local guardrails, not phone performance claims. Build an ordinary authored-course comparison with the same viewport/tier and record feature deltas.

Ray verification chooses the mesh for the declared layer, never the first top-down hit among overlapping terrain/deck meshes. Restore selected support and actual solved pose after probing. Rate tests call real cart updates with dt=1/30,1/60,1/120; fixed-120Hz presentation tests remain separate.

The first crossing gate includes a small surface/solid adapter for a representative dropped prop, dependent only on Groups 2 and 3. Full production physics ownership/migration remains Task 8.4 (physical-prop integration). This avoids making Group 7 acceptance depend on a later Group 8 task.

## Risks / Trade-offs

- Layered support without vertical collisions produces phantom hits -> prove solids and support separately before production bridge admission.
- Post-drive collision correction crosses water or a closed support edge -> revalidate every position-changing path.
- Smaller foundations cut through coarse triangles -> exact shared local geometry and ray verification, with conservative margins.
- NPC grounding is not route access -> activity and visitor corridor checks, including offsets and boarding exits.
- Conservative admission erases all districts -> measure rejection reasons and density before widening influence bounds.
- Terrain planning invokes festival planning recursively -> raw candidates and final committed grading are distinct acyclic stages.
- Streaming drops active support -> owners pin occupied surfaces and release dependencies before disposal; verify reverse traversal/revisit.
- Geometry adds mobile cost -> bounded local refinement, separate cold vs steady-state measurement, real-device evidence.
- Old OpenSpec context is stale -> current AGENTS.md/Vite policy overrides obsolete injected importmap instructions.

## Migration Plan

The initial contract/fixture work changes development surfaces only. Existing seeds and public gameplay stay at baseline. Before an intentional generation-version rollout, update affected layout/terrain specs, append versioned expectations and replace obsolete shared-zero/±15m assertions with stronger compatible-support/forbidden-face contracts. Keep original-version fixtures testable. Rollout can be disabled without deleting saved progression; exact save compatibility policy is settled in the integration task.

## Open Questions

No unanswered product question blocks the first proof. Engineering unknowns have named experiments and failure paths in tasks.md. Physical-device acceptance requires Gary's actual device observations and remains unchecked until evidence exists.


### Authored district refinements from Gary's preview and photographs

The current proof is fixture version 4, with 240m width and the original terrain vertex/triangle ceiling retained using a 2m X / 1m Z lattice. Lower camping uses compact, irregular groups bounded by vehicle lanes; upper camping is sparse and weighted toward the treeline around a broad shared lawn. Preserve the upper-to-lower view. The upper lawn's built-in firepit is distinct from the drum circle, while the historical sculpture is reference only.

The main road runs up the right side of the camping and turns left at z=-334. Its 530m full-width route remains under the 20% admission grade. A 62.5m narrow wooded trail branches at that turn and descends eight metres to the drum clearing; it uses a separately declared 30% trail-grade ceiling, with measured maximum 26.51% grade and 11.93% crossfall. This is an intentionally steeper secondary path, rather than a relaxed grade rule for all roads. The clearing and its full seated crew are on level ground at 10m. The main cart proof drives the complete winding route in both directions, rather than continuing straight down the old open apron.

Packing performs at most 512 candidate checks per meadow, admits a complete deterministic set within stated minimum/maximum capacities, and validates actual built solids and door/seat approaches before owner publication. Camp orientations vary; protected travel space remains explicit. The current authored seed admits eleven lower pitches and seven upper pitches, including five host camps in total. These are design counts, not a reconstruction of measured property dimensions or attendance.


### Procedural family requirement

The authored Mountain Top course is one verification specimen, not a map to stamp across the infinite festival. Gary explicitly requested structural variety. Generation must select bounded validated form families and seeded parameters for meadow outlines/spacing/elevations, road bends and alignment, camp density/grouping, treelines and optional gathering places. Rotating the same terrain and recoloring tents is insufficient. A generated district's terrain, roads, supports, protected occupancy and any gathering clearing must share one immutable plan and pass the same admission rules. Add diversity/clone controls to the declared survey while preserving same-owner repeatability. Car-camping vehicle models and a mountaintop passenger request remain future roadmap items.

## Procedural planning checkpoint

Generation 2 remains map-only opt-in. Raw 1600m macrocell candidates fit complete terrain influences inside their cells, while admitted access can extend 600m beyond that influence; queries therefore use a fixed 610m admission halo. Downstream context protects the existing exact venue envelopes, camps and lake shores. Two distinct arterial anchors each have three finite connector forms, and all joins/full-width native-grid travel must pass. Canonical rejection never publishes occupancy. Actual cold context cost exceeds a frame, so an owned worker handles context/admission, rotates after bounded jobs and returns identity-checked immutable plans. A current-world opaque receipt permits model construction without re-running admission. Streaming construction remains a separate measured gate.

Version-1 deterministic fixtures and terrain remain covered, including exact restoration after an experimental run. No player statistics/passport/run storage migration or clearing occurs during map inspection; default game generation remains 1. Version-2 rollout, exploration identity and production minimap worker version propagation remain integration requirements before enabling the game experiment.

## Finite water checkpoint

Each occupied landform candidate owns one finite lowland source-to-receiver system, independently of whether campsite access admission succeeds. Every source station descends to the receiver's declared level, and the water remains below the surrounding zero datum rather than borrowing an unrelated lake's level. The full water and crossing influence stays inside the reserved terrain core. Initial cross-owner ports remain absent because cross-region drainage is not implemented.

Native 10m terrain vertices cut the actual bed/banks. Water uses that same world-space grid/diagonal and is clipped against the cut triangle planes; interpolated cut coverage includes the entire native triangle rather than truncating it at an analytic bank circle. An uncontained ribbon over uncut lower ground is rejected. With 18m bank influence, both bridge endpoints and the adjoining whole-cart native triangles remain exactly level. Depth bias resolves the intentional deck/ground overlap without moving either support.

The bridge/water owner has separate shared pools, owned geometry, vertical rail contacts, complete rollback and counted pins. A bounded dynamic deck source resolves current canonical descriptors without highest-Y selection or stale-cache fallback. The physics adapter's copied fixed-triangle collider allows the same native bed and separate bridge slab to support real representative dropped props. This closes the small Group 7 proof, while Group 8 remains responsible for production manager/physics ownership and every affected actor.

## Streaming integration constraints

`createMountainDistrictBuild` consumes current worker receipts through bounded resumable model steps. Construction uses a private registry overlay, and publication transfers the same entry objects so furniture/seat references remain valid. Deferred light carriers and drum animation/music hooks activate only after full success. Cancellation must close nested generators, remove partial resources and release duplicate-owner admission. Synchronous wrappers remain available for current model/workshop callers, with exact RNG and geometry equivalence checked.

Owner `allocationMs`/stage spans describe synchronous workshop construction; actual staged CPU comes from the build job's `stats()`, which excludes time between calls. An absolute deadline prevents beginning more work after its budget expires, while single-step outliers remain measured rather than assumed impossible.

The live manager must resolve every potential district in the fixed access halo before dependent chunks can build trees/props, otherwise a connector can depend on load order. Raw terrain reservations remain upstream; completed occupied plans/path reservations remain downstream. Reserve all admitted paths before allocating dependent chunk content, and retain water/deck owners while any participating mover or prop depends on them. The existing independent default-generation path, synchronous start-gesture audio and chunk `isLoaded` completion semantics must remain intact. Near/far/minimap representations must consume the same admitted plans rather than inventing camp proxies for rejected candidates.

## November 1 player corrections: slope forces and camping density

The original hard driving-grade barrier is superseded by Gary's direct playtest feedback. `createTriangleSampler` names refusal causes, and a vehicle-only `allowSteepTerrain` binding accepts grade-limited ground while preserving water, world bounds, missing supports and closed bridge edges. Pedestrian, campsite and full-width route admission remain conservative. The landscape controller integrates longitudinal gravity, normal-load traction, bounded motor force, resistance and explicit braking at 120Hz; speed governs propulsion rather than deleting momentum. Supported downhill travel is always permitted. The chassis normal and wheel suspension use composed pitch/crossfall and plane-normal tire clearance on steep diagonal ground. Generation 1 and the earlier terrain-course controller retain their existing behavior.

Generated lower/middle meadows pack sleeping pitches at a 10.5m minimum center spacing, rather than the former 14m envelope spacing. Tent facing follows the nearby driving lane with bounded variation, and fewer large hearth camps leave more ground for sleeping pitches. All built solids, doors, seat approaches and road envelopes still pass their production checks. The upper meadow retains five sleeping pitches, up to two hosts and its open lawn. Plans remain irregular and seeded, without campsite rows or a cloned authored map.


## Physics ownership integration

The landscape manager accepts the existing caller-owned physics adapter through `attachPhysics`. It supplies finite nearby-origin native terrain meshes and separate bridge solids, preparing swept prop requirements before the caller advances its existing fixed clock. Each tracked prop retains needed district/water owners, including when asleep; ordinary disposal refuses occupancy, and explicit final shutdown removes owned support and tracked bodies without disposing the external engine. Maximum geometry, prop count, allocation slices and origin range have structured refusal paths. The separate physical-festival change retains responsibility for activating dynamic live chairs/coolers and their occupant/contact behavior, which does not yet exist in the production game.
