# Guided iPad autopilot and world attribution, November 7

**TL/DR:** Implemented and ready for the next physical-iPad capture. The fixed
road controller completed all four checkpoints through normal cart physics in
the reserved-Mac functional pilot, and a separate native STOP TEST smoke check
produced an invalid interrupted report and a stopped cart. These establish the
desktop integration and capture plumbing, not an iPad route pass or an FPS gain.

## Implementation and contracts

`bin/playtest-perf drive --autopilot --world-detail --tier auto --port 8770`
builds the production bundle and prepares the token-protected device link.
The only required device interaction is a real ready Just Cruisin' tap, followed
by keeping Safari foregrounded. No USB/WebDriver connection is needed.

The route uses the existing `road-follow-v2` guidance and four ordered segments,
seed 2404796662, start (-230.3, -691.8), heading 2.3580, a ten-metre corridor and
a ninety-second drive limit. It parks for twenty seconds of settling and
twenty-five seconds of baseline, drives until the fourth checkpoint or failure,
then parks for twenty seconds of recovery before exporting. Normal collisions,
damage, terrain and physics remain active. There are no in-route teleports,
invulnerability, obstacle removal or position corrections. Input ownership
suppresses manual steering/camera controls and releases at completion/stop;
settings/HUD changes, foreground loss, runtime errors, wrong seed/start/mode,
route departure, wreck or timeout invalidate the capture. STOP TEST is available
throughout. Resume placement is ignored only for this explicit diagnostic mode.

Time of day stays at .3, initial camera is the normal chase camera, and child
construction uses the existing private diagnostic RNG stream. Global randomness
is not replaced. The route is repeatable work, not bit-identical full-world
simulation: actor timing, frame schedules and Auto quality can still differ.
Use a dedicated origin/port for local test progress. Outbound game analytics and
global leaderboard endpoints are suppressed in this opt-in mode.

World-detail timing partitions `updateWorld` into landscape, lakes, chunks,
physical preparation, lighting, vendors, far-field, backdrop, ground and sun.
Ground samples/colors/publication, normals and bounds are separately nested
inside ground; do not add those to the top-level partition. Counters reset each
frame, event snapshots copy their values, and a bounded twenty-four-event
reservoir retains the largest world stalls even when the chronological event
ring evicts early frames. Per-window section maxima are independent maxima, not
a single matched frame or additive total. Clock reads and capture bookkeeping
perturb timing, and elapsed time inside an interval can include collection or
scheduling. Ordinary play and ordinary lab captures do not enable these extra
clock reads without `perfCapture=1&perfWorld=1`.

Sources: `src/deviceAutopilot.js`, `src/worldTimings.js`, `src/world.js`,
`src/perfTelemetry.js`, `src/debug.js`, `src/main.js` and the guided launcher/server.
The [device procedure](../../../docs/performance-playtests.md#fixed-route-device-autopilot-and-world-attribution)
documents the supported command and limits.

## Verification

| Check | Evidence and result |
| --- | --- |
| Full project checks | [check.log](check.log), successful `npm run check`. An initial run caught a passport-pause ordering regression, which was corrected by keeping the modal's early return ahead of controller advancement; the full rerun passed. |
| Production build | [build.log](build.log), successful `npm run build`; standard large-bundle warnings retained. |
| Focused controller tests | `bin/test-device-autopilot` exercises the actual guidance output, ordered route, corridor/timeout/wreck/emergency failures, immutable snapshots and input release. |
| Focused timing tests | `bin/test-world-timings` checks disjoint partitions, nested ground costs, reset/read accounting, immutable snapshots, window reset and preservation of an early largest spike past ring eviction. |
| Guided lifecycle/server tests | Updated `bin/test-device-capture-flow` exercises early route completion, timeout invalidation and foreground-loss stop through the actual production phase functions. `bin/test-perf-server` checks opt-in flags, fixed fixture URL and rejection of wrong route seed/scenario. Existing telemetry/report tests pass. |
| Native ready-title full-game route | [route-result.json](route-result.json), [raw report](route-capture.json), [reporter output](route-report.txt). Valid, four checkpoints, about 641.3 metres, 44.8-second drive, 111-second active capture, zero errors, maximum corridor deviation 5.48 metres. No synchronous audio-start chain change; muted Mac capture does not verify audible iOS unlock. |
| Native STOP TEST | [stop-result.json](stop-result.json), [raw report](stop-capture.json), [reporter output](stop-report.txt). Expected invalid interruption with `user-stop`, no completed route, and cart speed at most .1 m/s after stopping. |
| Process lifecycle | [cleanup.json](cleanup.json), [route ownership](route-ownership.json), [stop ownership](stop-ownership.json). Both accepted-supervisor runs closed successfully; independent exact-PID checks found all 38 recorded owned identities gone and no lab lease. Existing browser/server sessions were preserved. |

The [source snapshot](source-manifest.json) identifies application
`7c5a6bd933f86db327d4c78d3b662fd938438f4af203c29c06ac11e5a1f861a1`.
[Served build identity](served-build.json) verifies the LAN game index against the
built output and the same source bytes as the tested snapshot. Build-path source
maps can differ, so both build digests are retained. The [quiet grant](grant.json)
was for roughly three minutes of foreground functional verification, not an
isolated benchmark. Personal media/browser sessions remained untouched.

The task-local [pilot runner](pilot.py) reuses the accepted independent process
supervisor with a diagnostic HTTP adapter that durably saves the guided schema.
The [worker](pilot-worker.mjs) uses a native title click and records the actual
route/report outcome. This is not an accepted ordinary lab comparison and does
not replace overhead/calibration/holdout or real-device acceptance.

## Diagnostic lead, not a device finding

The largest Mac pilot world event was 459.2 ms, with 458.6 ms recorded in the
far-field section during settling (`route-capture.json:worldUpdateTimings.worstFrames[0]`).
This demonstrates useful section attribution. It does not show that the older
iPad's earlier stalls have the same cause, identify an inner far-field function,
or justify changing scenery without the next device evidence.

## Handoff and remaining acceptance

The fresh private QR points to a dedicated LAN server with autopilot and world
detail enabled. The task server is intentionally left running for Gary's next
iPad capture, with exact ownership in ignored local session metadata. A bounded
fifteen-minute task-owned keep-awake prevents idle system sleep for the handoff;
stop both after the capture saves. No private capture token is committed here.

On the iPad, close the previous game tab, scan the new QR and tap Just Cruisin'.
Do not steer, switch cameras/settings or background Safari. FELT LAG is available;
STOP TEST invalidates the run safely. Wait for SAVED and report any interruption.
The exact model name remains outstanding; iPadOS 18.7.8 / Safari 18.7.5 were
identified during the earlier connection probe. Actual iPad completion and
world-section attribution remain unverified until this next run is saved.

Do not compare the new autopilot/instrumented route directly against the earlier
human-driven baseline as an equal-work optimization trial. Its purpose is to
locate the measured device stall and establish a repeatable future workload.
