## 1. Build the inspection and regression surface first

- [ ] 1.1 Establish current map responsiveness, layout fixtures and flat-game motor/boost baseline; preserve existing map detail budgets and cancellation.
- [ ] 1.2 Add terrain fixture coverage for seed/query order, negative coordinates, tile boundaries, seed resets, descriptor/vertex cache eviction and bounded planner call counts.
- [ ] 1.3 Wire bounded map elevation/slope, pads, road grades and lake-level inspection to the shared surface; add shared-world mode and matching motor baseline to the driving harness.

## 2. Implement the canonical terrain service

- [x] 2.1 Add independently salted broad relief and seed/epoch/version-aware bounded tile/vertex caches without changing existing layout RNG or golden fixtures.
- [ ] 2.2 Derive complete gathering/camp catchments, pair-owned road approaches and whole-lake levels/collars with stable overlap ordering, shared junction anchors and finite influence bounds.
- [x] 2.3 Establish the actual ground triangle diagonal and fixed 10m lattice, implement matching sample height/normal/grade, test pad corner flatness plus one-cell margins, and bound supported grades.
- [x] 2.4 Update every consuming HTML importmap and verify cold shared-surface patch preparation does not invoke expensive festival planning per vertex.

## 3. Integrate ground, cart and camera

- [ ] 3.1 Replace moving-center ground subtraction with fixed world-space heights and exact contact interpolation; verify repeated recenter and 80m chunk crossings.
- [x] 3.2 Connect real cart movement to terrain tangent driving and four-wheel support; retain flat acceleration/boost, braking/parking/reverse and bounded tilt, including reset/teleport.
- [x] 3.3 Convert passenger/seat/nozzle/headlight and other cart-local world transforms to full chassis transforms; preserve local animation offsets.
- [ ] 3.4 Add camera-target segment terrain clearance and inspect chase, first-person, top-down, orbit and teleport behavior.

## 4. Ground all real world consumers

- [ ] 4.1 Ground cluster builder roots and world-space registry/interaction/seat anchors exactly once, including complete camp clearings, satellite pitches and all local paths/decals.
- [x] 4.2 Ground forest/scatter instance transforms and other standalone props while preserving shared resource ownership and instance update flags.
- [ ] 4.3 Translate complete lake roots/levels, islands, shores, canoes, camps and absolute animation anchors coherently; retain lake collider ownership through host unload.
- [ ] 4.4 Ground ordinary walking crowd and secondary movers/routes while preserving seated/hammock/cart states; verify boarding, disembarking and attraction approaches.
- [ ] 4.5 Ground far-field proxies and road underlays with the same anchors; audit collision height assumptions and prevent incorrect interactions across vertical separation.
- [ ] 4.6 Verify a real hub within rolling terrain with approach roads, complete camps, seated/walking people and neighboring lake through repeated build/dispose/revisit cycles.

## 5. Validate and release rolling terrain

- [ ] 5.1 Run deterministic/layout/contact fixtures and 30/60/120Hz driving replay; record grade bounds, at most 2cm mesh/contact error and at most 1cm ownership seam step.
- [ ] 5.2 Run npm check and importmap checks, then real title-gesture/mode-plank/world boot, driving and console inspection with flat fallback and terrain enabled.
- [ ] 5.3 Capture Noon/Midnight and Low/Mid/High, compare draw/triangle and parked versus streaming/allocation costs to a fresh baseline, and record mobile/iOS acceptance or its explicit unverified status.
- [ ] 5.4 Complete measured tuning and default enablement only after acceptance; update architecture/debug guides, dated CHANGELOG, ROADMAP and verification evidence, then refresh this change's memory/status and validate artifacts.

## October 25 checkpoint

The remaining unchecked entries include implemented code with outstanding portions
of their acceptance, rather than wholly unstarted work. Full `npm run check` passes;
the shared-world browser harness passes 96 wheel rays and 528 support poses with
zero misses. See [the dated evidence](../../../verification/terrain/2026-10-25-integration.md).
Keep default enablement blocked on the remaining checks. In particular, road
conformance is implemented but independent road approach grading is not.
