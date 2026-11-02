# Landscape and travel implementation

Use this dependency order. Task identifiers always include their descriptive tag in prose.
The first executable slice is the contract and authored geometry proof, not public worldgen rollout.
Current Vite imports supersede stale importmap checklist instructions.

## 1. Establish the integration baseline

- [x] 1.1 Record current terrain/collision/placement/physics boundaries, scoped files and successful baseline check/build in evidence.md; preserve unrelated checkout changes.
- [x] 1.2 Record the exact first-proof support/solid semantics and finite numerical defaults in design/evidence, along with alternative/failure criteria; no unmeasured global performance claim.

## 2. Implement shared support and solid contracts

Depends on Group 1 (integration baseline). Owner: src/landscape/support.js and bin/test-landscape-support.

- [x] 2.1 Add pure validated support descriptors/query with explicit terrain fallback, current support/elevation, approach gates, blocked undeclared exits and caller-owned output.
- [x] 2.2 Add solid vertical-interval eligibility without support-ID exemptions; test terrain/deck overlap, underneath traversal, tall solids, invalid inputs and nonmutating repeat queries.
- [x] 2.3 Prove approach entry/exit in both directions, refusal at mismatched elevation/closed edges, unknown/deleted support behavior and independent simultaneous movers; retain focused regressions in npm check.

Failure action: correct the small pure contract before renderer/runtime migration. Do not add floors or general indoor pathfinding.

## 3. Build the authored landscape engineering proof

Depends on Group 2 (support/solid contracts). Owner: src/landscape/fixture.js, src/terrainSandbox.js, terrain-sandbox.html and focused fixture tests.

- [x] 3.1 Add bounded exact-triangle terrain/geometry data within the declared vertex/triangle/batch ceilings for two shelves, steep bank, side ascent, descending clearing and cut stream with bridge/approaches; verify shape/mesh/support agreement in pure tests first.
- [x] 3.2 Extend existing terrain sandbox with surface=landscape, deterministic jump points including deck/underneath, selected-support diagnostics and real Zerble integration; own the minimal opt-in binding and terrainDriving proposal/commit hooks here, retaining existing authored/world modes.
- [x] 3.3 Add independent ray/contact checks for terrain and selected deck, plus fixed-input real-cart bridge/ascent/bank tests at 30/60/120Hz; capture measurable tolerances and failures.
- [x] 3.4 Verify Noon/Midnight and Low/Mid proof behavior/counters, real title-gesture game boot/console, full check/build and cleanup. Update changelog, docs and evidence; do not call the unpopulated fixture a complete district.

Failure action: keep default gameplay unchanged, diagnose support/geometry/controller separately, and change one variable per hypothesis. A sandbox failure never justifies weakening contact checks.

## 4. Make travel authoritative

Depends on Group 3 (engineering proof). Owners: src/landscape/routes.js, terrainDriving.js, collisionContacts.js and explicit runtime adapters.

- [x] 4.1 Add finite full-width corridor, endpoint-join and swept-turn validation against final shared geometry; deterministic alternatives return structured failure reasons.
- [x] 4.2 Validate whole-footprint support for corrections, resets/teleports and boarding relocations; landscape vehicles use force-limited uphill motion and unrestricted supported descent, with boost/momentum, rollback, reverse, diagonal and interrupted-frame regressions. The original hard-grade proof is superseded by the November 1 playtest correction.
- [x] 4.3 Add opt-in vertical contact intervals through real collider publication while preserving legacy defaults and contact order; prove below-deck exclusions and spanning-solid hits.
- [x] 4.4 Verify a real cart traverses both shelves and returns through the side road/bridge using ordinary controls, with no hidden teleport or footprint shortcut; record route length, maximum grade/crossfall and turning clearance.

Failure action: reject unsupported routes and adjust bounded fixture geometry before introducing a search algorithm. Never expand retries without a measured need.

## 5. Build one complete populated mountain district

Depends on Group 4 (authoritative travel). Owners: district plan/builder adapters, chunks/camp/drum builders and integration diagnostics.

- [x] 5.1 Define complete district owner/ports/influence, foundations versus activity ground, protected water/route envelopes and atomic admission/publication/disposal.
- [x] 5.2 Build lower/upper camping meadows and short descending drum/fire clearing through real builders; audit outer props, seats, lights, audio anchors and approaches against support geometry.
- [x] 5.3 Connect participating crowd activities and visitors to feasible corridors, including dodge offsets, approach goals and seat/boarding exits; prohibit unreachable placement/wandering.
- [x] 5.4 Exercise unload/revisit from both directions, occupied-support retention, disposal/shared resources and near/far agreement; full check/build and actual game smoke.

Failure action: keep the owner unpublished on admission failure, report the reason, and fix shared planning/support data rather than relocate individual props after the fact.

## 6. Add bounded procedural admission

Depends on Group 5 (complete district). Owners: src/worldgen/landscape.js and explicit versioned plan/road integration.

- [x] 6.1 Generate independently salted, structurally varied district/landform families and stable connection ports; finite complete neighbor/halo queries, bounded caches and nonrecursive conflict resolution.
- [x] 6.2 Admit only feasible routes/districts; reject with reason after finite alternatives. Add seed/window/order/negative-coordinate/cache-eviction negative controls.
- [x] 6.3 Survey declared seeds/bounds/resolution for structural variation, clone detection, density, rejection reasons, regional component coverage, detour cost and cold planning; tune only measured bottlenecks, without promising infinite-world connectivity.
- [x] 6.4 Add explicit opt-in generation version and map inspection; revise affected specs/goldens while retaining current-version deterministic fixtures and progression compatibility.

Failure action: tighten support envelopes or use an already proved alternate form before widening influence bounds. No guaranteed spawn-near district.

## 7. Complete water systems and crossings

Depends on Group 5 (complete owner/lifecycle); generation integration also depends on Group 6 (bounded admission). Owners: water/stream plan, road crossing adapters and shared geometry.

- [x] 7.1 Define finite source-to-receiver stream ownership, downhill profile and lake-level compatibility; complete owner discoverable from finite bounds; boundary ports mandatory before cross-region extension.
- [x] 7.2 Build channel/banks/water from shared local geometry with bounded refinement and seam rules; no detailed ribbon over an uncut coarse mesh.
- [x] 7.3 Select road crossings with deck clearance, supported width/turns and coherent approaches; water boundaries recognize crossing height/openings.
- [x] 7.4 Verify complete functional stream+bridge with vehicles, people and representative dropped props using the small Group 2/3 surface adapter (full production physics migration stays Task 8.4), confluences/outlets, repeated crossing/unload/revisit and near/far continuity.

Failure action: retain complete finite drainage systems; do not substitute discontinuous global-looking rivers or call false flags implemented.

## 8. Migrate all affected consumers and measure

Depends on Groups 6 and 7 (procedural districts and complete crossings). Owners are explicitly partitioned by consumer family.

- [x] 8.1 Audit world/chunks/forests/lakes/farField/map for shared geometry and version/owner truth; near/far roads/decks and water levels agree through streaming.
- [x] 8.2 Migrate Zerble/Lurleen/Nut Wagon/one-wheel riders to appropriate support and full-width feasible paths; preserve their independent encounter and controller behavior.
- [x] 8.3 Migrate crowd/activity/parade/bird/contact/seat/attractor eligibility where vertical separation or steep barriers matter; correct grounding alone is insufficient.
- [x] 8.4 Connect physical-prop colliders to the same surface geometry/version/owner through the existing physics adapter, with teardown and occupied-support retention.
- [x] 8.5 Measure cold planning, geometry allocation/uploads, moving/parked draws/tris and Low/Mid/High behavior against baseline. Fix measured regressions without broad unrelated optimization.

- [ ] 8.6 Reproduce and correct Gary's seed-3232217193 report of porta-potties occupying the road at (1497.87, 868.42); validate built clearance against the actual road geometry.
- [ ] 8.7 Reproduce and correct Lurleen stopping while following up the steep hill near (971.45, 902.1) at seed 3232217193; preserve independent controller behavior and feasible route following.

## 9. Release and preserve the handoff

Depends on Group 8 (consumer/performance acceptance).

- [x] 9.1 Complete full check/build, ready title-gesture real-game boot, camera modes, repeated streaming and noon/midnight tier captures; structural browser cleanup required.
- [ ] 9.2 Obtain physical iPhone/iPad driving, readability and frame-delivery evidence with device/browser recorded; leave this unchecked until actually observed.
- [ ] 9.3 Finish player recognition/route-choice playtest without announcing hill locations; record encounter opportunities separately; choose final tuning and rollout based on evidence.
- [ ] 9.4 Enable the new version deliberately, update current specs/architecture/debug/changelog/roadmap and evidence, refresh README and verify change artifacts; Barn and first aid stay future work.

## Execution handoff rules

- The next unchecked dependency-satisfied task is the next action. Update exact checkbox state and session current_task; prose logging only for decisions/discoveries/blockers.
- Numeric defaults in a proof are local hypotheses; acceptance derives from recorded measurements. A failed gate produces a localized fix or its stated finite fallback.
- Do not redo baseline/full-suite/browser checks after unchanged documentation; repeat after runtime groups or when a failure/new change warrants it.
- No branch switch, unrelated edits/commits, new dependencies, global navigation/erosion framework, or default-generation change during the first proof.
- If context is compacted or a new session takes over, read README -> session log -> tasks -> evidence. No repeat brainstorming is needed.
