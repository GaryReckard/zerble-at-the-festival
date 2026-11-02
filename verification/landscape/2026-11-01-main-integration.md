# Landscape integration with current main, November 1

## Revisions and ownership

The landscape checkpoint is `4521b19`. Main and fetched origin/main resolve to `39e4797`, 37 commits beyond shared base `5ef3df2`; main enables live physics by default. The merge is completed on `codex/landscape-and-travel` in the managed `landscape-main-integration` worktree. Separate uncommitted startup/playground work remains in Gary's original checkout. No push, deployment or merge into main is included.

## Reported toilets in the road

The [saved player report](player-reports-2026-11-01.json) places the marker at seed 3232217193, (1497.87, 868.42). The arterial centerline is 0.0973m away and has a 9m paved width, in both landscape generations. `pottyRowClear` previously checked neighboring buildings and lakes, while welfare planning admitted a clear center without checking the complete bundle against roads. Both stages now protect full footprints, including landscape reservations and individual units in a row.

Final coordinates are rounded before admission. The seeded regression found a minimal station whose raw (837.9019459, 1410.7328865) location was clear but whose rounded (838, 1411) location overlapped a road. Checking the final descriptor closes that additional gap.

`node bin/test-potty-road-clearance` executes the production row guard against the reported road and checks seeded full welfare envelopes in both generations, every row unit, road-edge footprint clearance, mixed-width neighboring roads and landscape route reservations. `node bin/test-road-surfaces` preserves exact historical road geometry and point-query snapshots. [New POI snapshots](2026-11-01-welfare-layout-baseline.json) intentionally replace only the current plan hash; their audited changed kinds are welfare posts and dependent bubble vendors, arches or healing areas. Historical road/layout snapshot files remain unchanged.

## Lurleen on the reported ridge

The marker at (971.45, 902.1), heading 12.271, lies on wooded ridge `landscape:2:3232217193:0,0`. The bank ahead rises through approximately 0.85–1.0 grade. Her previous selected-support adapter imposed a hard 0.3 fore/aft grade limit and stopped her at the bank. Lurleen now requests force-capable support and shares `stepTerrainDrive`, with her own 16m/s AI target and existing steering/state machine. Water and closed bridge edges remain forbidden, while wagon/rider grade policies remain conservative.

`node bin/test-landscape-vehicles` runs a moving-player replay through the real marker at 30/60/120Hz without repeatedly resetting her following state. She retains following and catches up after climbing 12.08–12.89m. The real bridge and shelf-road tests also pass. Chassis pitch/crossfall and wheel clearance account for composed slope normals. The nonplanar ridge still has up to approximately 0.2m residual wheel contact error within bounded suspension travel; this is not a claim of perfect four-wheel contact across arbitrary terrain creases.

## Combined live physics

`src/physics/terrainResidency.js` retains its existing bounded tile bodies, owners and shared streaming deadline. The landscape callback adds at most one clipped bridge cuboid per tile, retaining the water/district owner until the tile releases. The budget reserves 257 fixed colliders rather than 193 when landscape support is attached, within the existing 512-collider engine capacity. Terrain is not duplicated, and no separate engine or stepping loop is created. Unpublished bridge support remains pending instead of exhausting retry attempts.

`node bin/test-landscape-physics` additionally exercises the live terrain residency with real engine bodies above and below the same bridge: the upper cooler rests on the slab, the lower cooler rests on the actual cut bed, tile bodies are shared and all owner pins release. Physical pedestrian/occupied-seat recovery uses that same elevation distinction. `applyObstacleHit` now uses the cart's swept support correction when bound, matching its existing person-hit correction. Staged district placement uses main's canonical generation queries so displaced physical furniture does not redefine procedural placement.

## Browser-found stage-seat integration failure

The first combined Chrome run booted through a ready mode plank, admitted an occupied chair and inspected the road marker at Noon/Midnight. A later populated-district teleport at night exposed `TypeError: x must be finite` in `Crowd.canReachCampSlot`. `CampActivity` correctly selected audience chairs at night, but passed the global sleeping flag as the candidate's bed flag, so selected-support validation read nonexistent doorway coordinates from a seat. The adapter-free path had hidden that mismatch. Candidate validation now uses the same seat-versus-bed decision as acquisition, and malformed endpoints are refused before querying support. `test-stage-audience` covers nighttime seat classification; `test-landscape-people` covers malformed doorway refusal. The failed owned tab was immediately closed.

The next real meadow check found static furniture with the visible admission reason `origin-unavailable`: staging entries received new live IDs during publication, but main's newly introduced physical descriptors still referenced their staging parent IDs. Publication now remaps the shared physical descriptors only after all entries transfer. `test-landscape-staging` validates each descriptor's live campsite parent and requires a real district prop to be adopted by `createLivePhysics`, followed by complete physics and district teardown. This extends the prior scene/registry-only staging check into the composed live path.

## Validation and limits

The [full combined check](main-integration-check.log) and [production build](main-integration-build.log) both exit successfully. The suite includes both landscape and main's adapter, terrain, adoption, occupied-seat, cooler and pedestrian tests. Standard package-module/build-size warnings remain; neither is introduced by this merge. Existing repeated-streaming, draw/triangle and allocation measurements retain their historical scope. Physical iPhone/iPad driving, unprompted player recognition and a deliberate default rollout remain pending. `landscape=1` remains the default; `landscape=2` explicitly selects the experimental landscape generation.

The final Low Chrome run starts through a ready mode plank and visits the admitted meadow at seed 3232217193, (671.8, -673.39). Its visible physics panel reports three active / three preparing props and 13 bodies, running with `Last admission: ready`, replacing the earlier origin-unavailable failure. Midnight remains live, with no captured warnings or errors. [Browser observations](main-integration-browser.json) distinguish this brief admission/smoke check from long-duration or phone acceptance. Owned tabs 380986967, 380986971 and 380986975 are all confirmed absent from the final inventory; no standalone/headless browser was launched.
