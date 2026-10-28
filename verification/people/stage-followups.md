# Stage audience and site follow-ups, October 28, 2026

## Requested work

- [x] Preserve torso-fixed shoulders in every arm pose.
- [x] Add solid and patterned hoop finishes with colored night glow.
- [x] Remove persistent outstretched arms from ordinary people walking near stages.
- [x] Keep hula activity people and hoops clear of a parked cart, including new recruitment and an approaching cart that stops.
- [x] Share the original Healing Arts night dance motion with dancers at every stage, retaining ordinary appearance and shoulder anchors.
- [x] Replace overlapping stage chair clumps with separated rows of one to five chairs, sampling every camp-chair style and supporting occasional NPC occupancy.
- [x] Support cross-legged NPC resting on stage picnic blankets with reservation, approach, safe exit and unload cleanup.
- [x] Reproduce and repair the black road patch at seed 3248888364, x176.19 z-674.37, heading21.407, time-of-day0.707.
- [x] Correct covered-stage soundboard orientation, add an attending sound person and a specific soundboard collision label.
- [x] Run focused/full tests, production fixtures, real-game verification, docs and owned-resource teardown.

- [x] Scatter the short chair groups with organic stage-center facing rather than long aligned rows, and verify clear dancefloor/spacing.
- [x] Let several existing people share each stage blanket with independently reserved stage-facing positions.

## Current state

Checkpoint 651c99f and articulated-motion commit 3e6d4af are committed. Later shoulder, hoop-finish and generic-dance corrections remain uncommitted and must be preserved. The full suite for those corrections passed in `/private/tmp/zerble-hoop-finishes-check.log`; native results are under `2026-10-28/`. The task-owned no-cache server was PID6051 on port8765; final cleanup is recorded in stage-audience.md. The human may have opened a gallery tab and it must not be closed as an owned test resource. See stage-audience.md for final results and cleanup.

## Verified source entry points

- `people/hulaActivity.js` recruits at the person's current position without initial cart clearance. Its safe-resume check is separate. The parked-cart correction is now implemented: HulaSession declares cartClearance=5, selection requires >6m cart distance and 2.2m between active hoopers, and Crowd revokes intersecting interruptible activity claims at zero speed while still honoring blocked exits. Focused hula tests and the parked-cart live-game completion cycle pass.
- Stage chair clumps are in `chunks.js` buildStage and buildTentStageTheme. Registry chairs now carry campSeats, with occasional existing Crowd participants using CampActivity approach, dwell and safe exits.
- Ground blankets are `chunks.js` placePicnicBlanket, registry kind `picnic`, with an attractor but no reservation slots. PicnicActivity now also selects explicitly registered picnic/tableSeats with a cross-legged pose.
- Original Healing Arts pose motion is in `models/healingArts.js` updateHealingArts, while ordinary-body dancers now use `personMotion.sampleDanceArmPose`. The shared point sampler now preserves the authored motion and retargets it to each original Crowd body.
- Tent sound desk is in `models/tentStage.js`; chunk collider is now kind `soundboard`, and the engineer uses existing place-performer ownership; the former roaming spawn remains in the audience to preserve its RNG stream.
- Road ribbon geometry is clipped to terrain triangles in `chunks.js` terrainRibbonGeometry; the dark farField road underlay was confirmed to bridge terrain creases and poke above the detailed road. Both now use drapeTerrainTriangles in worldgen/terrain.js.
