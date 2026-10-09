# Low Baseline Capture and Timing Investigation

## Summary

The completed iPhone parked pair is now recorded below. Low Baseline retained four times the render-target pixels with no observed frame-delivery disadvantage: both policies reported median 58 FPS, no parked gaps over 50 ms, and nearly identical rates of gaps above 33 ms. This supports correcting unnecessary governor degradation for this scene, not disabling all adaptive protection or promoting the phone to High.

The iPhone governor can downgrade on p95 frame gaps above 33 ms despite an average near 17 ms and roughly 58 reported game ticks per second. The captures repeatedly show that condition. They do not establish whether Safari scheduling, presentation cadence, asynchronous GPU work, or another unmeasured source caused those gaps. The new Low Auto versus Low Baseline capture isolates the governor decision without changing tiers. No High-tier viability claim follows from these results.

On Mac, the bubble material transition coincides with approximately 49% fewer scene draws at unchanged resolution and scene population. The two large later render spikes align with a shadow-state/program change and first Trip activation, respectively. Those are useful hypotheses for isolated tests, not measured shader-compile durations.

## Paired iPhone Test

1. Put the phone and Mac on the same Wi-Fi, choose a fixed portrait or landscape orientation, and keep Safari foregrounded. Keep Low Power Mode, settings, camera, and device temperature comparable. Start Low Auto:

```sh
bin/playtest-perf parked --tier low --quality auto --seed 3948869160
```

2. Scan the QR, choose Just Cruisin', and tap the title-card button. Do not move the camera or change settings. The cart is parked automatically for 20 seconds of settling and 40 seconds of comparison. Tap FELT LAG when needed. After SAVED, stop only this launcher with Control-C and close its game tab. Note sharpness, stutters, warmth, and Low Power Mode.

3. Let the phone return to a comparable temperature, then start Low Baseline:

```sh
bin/playtest-perf parked --tier low --quality baseline --seed 3948869160
```

4. Repeat the same foreground capture. After SAVED, stop this launcher with Control-C and close its tab. A reverse-order repeat helps distinguish policy from warming over time.

The launcher leaves existing servers alone. Baseline requires explicit Low and locks rung zero before the first rendered frame, including title-card frames. It stays locked until reload, including after Trip completion; ordinary play is unchanged. Both explicit Low policies use cheap bubbles even if Detailed bubbles was saved On, and the preference itself is not overwritten. Do not change other settings between captures. Use `--desktop` only for an intentional desktop run, not as an iPhone substitute.

`session.qualityPolicyRequested`, `qualityPolicy`, `qualityPolicyApplied`, `qualityLockedFromFirstFrame`, `governorEnabled`, `basePixelRatio`, and `tierPolicy` record what ran. The existing sample fields retain actual canvas/target dimensions and material state. The reader labels old reports as unrecorded rather than inventing policy metadata. Baseline changes governor decisions only; Low crowd/forest density, shadow capability, chunk radius, and bubble capacity remain the same. Actual baseline DPR is `min(devicePixelRatio, 1.25)`, not always 1.25 on desktop.

Compare `frame.wallP95`, `wallP99`, `over33`, `over50`, `workP95`, `workMax`, `renderMax`, physical dimensions, and subjective experience. A median of one-second p95 values is not a pooled p95. Do not call a baseline run successful just because synchronous work is short: higher resolution still needs device evidence for frame delivery and sustained heat.

## Completed Parked Pair

Gary completed the pair on October 9. Auto is `.claude/captures/device-mv1amvdh-4hap55.json` (captured 18:24:12Z), and Baseline is `.claude/captures/device-mv1aqnkd-y7o24c.json` (18:27:08Z). Both have `reason=complete`, zero errors, zero visibility events, and no FELT LAG taps. No tap is not a subjective smoothness verdict.

Both reports identify iPhone Safari, viewport 430x775, native DPR 3, seed 3948869160, and matching `session.tierPolicy`: Low, crowd cap 180, forest density multiplier 0.7, shadows off, chunk load/unload radius 1/2, and 200 cheap bubbles. The parked samples all retain position `(300,-641)`, speed zero, NPC count 113, registry count 2466, collider count 2347, and generated chunks 9. Bloom, sun shadows, Trip, and star power remain off. No new chunks were generated during either capture.

Auto's first observed rungs are samples `[0]` baseline, `[2]` pixel-87, `[5]` no-bloom, `[8]` pixel-75, and `[11]` pixel-50, at t=0, 2, 5.1, 8.1, and 11.1 seconds. Baseline stays at rung zero for all 61 samples; its report confirms `qualityLockedFromFirstFrame=true` and `governorEnabled=false`.

The comparison uses Auto `samples[21..61]` and Baseline `samples[21..60]`, selecting `phase=parked`. Percentiles below are medians of captured window percentiles, not pooled percentiles; gap counts are summed across windows.

| Parked metric | Low Auto | Low Baseline |
|---|---:|---:|
| Actual DPR | 0.625 | 1.25 |
| Scene target | 268.75 x 484.375 | 537.5 x 968.75 |
| Median reported FPS | 58 | 58 |
| Median window frame-gap p95 | 38 ms | 37 ms |
| Median window frame-gap p99 | 45 ms | 45 ms |
| Worst frame gap | 47 ms | 47 ms |
| Gaps above 33 ms | 146 / 2,333 (6.26%) | 140 / 2,308 (6.07%) |
| Gaps above 50 ms | 0 | 0 |
| Median window work p95 | 6 ms | 6 ms |
| Worst synchronous frame work | 16 ms | 10 ms |
| Worst synchronous render work | 14 ms | 7 ms |
| Median scene draws | 1,249 | 1,253 |

The baseline target has exactly four times Auto's pixel area, yet the measured delivery distributions are essentially unchanged. These observations support the conclusion that Auto's resolution reductions did not produce a measurable delivery benefit in this parked test. They strengthen the earlier concern about p95-only pressure, but still do not identify Safari scheduling versus presentation or asynchronous GPU behavior as the cause.

Do not interpret the lower Baseline maximum work as a speedup. The scene is animated and not frame-identical: Auto's parked `geo` varies from 1266 to 1572 and `tex` from 25 to 27, whereas Baseline's `geo` varies from 1406 to 1420 and `tex` stays 25. Reported registry/NPC/chunk counts match, but those renderer-resource differences remain a confounder. Auto was run first, and heat, perceived clarity, and Low Power Mode are not captured fields.

Recommendation: retain the current shipping safety policy until a moving comparison, but use this result to target governor logic rather than switching tiers. The next device comparison is the same `drive --tier low --quality auto|baseline --seed 3948869160` pair on a comparable route. Its purpose is to check whether retaining resolution stays acceptable during streaming and movement; the parked result does not establish that. Before selecting a governor correction, compare clarity, smoothness, and warmth reported by Gary, and keep sustained-average and severe-hitch protection distinct from the p95-only behavior under investigation. No production governor thresholds were changed by this analysis.

## Capture Sources

All array indexes below are zero-based JSON paths. Source files are ignored local captures under `.claude/captures/`, also named in [guided-playtests.md](guided-playtests.md).

| Label | File | Samples | Duration |
|---|---|---:|---:|
| Mac Drive | `device-mv18we55-i4xp32.json` | 158 | 157 s |
| Phone Drive | `device-mv190ygp-05705n.json` | 158 | 156 s |
| Mac Trip | `device-mv195625-vjh7m1.json` | 121 | 120 s |
| Phone Trip | `device-mv19asuu-6d3e08.json` | 120 | 117.7 s |

All four have `reason=complete`, `session.seed=3948869160`, empty `errors`, `visibilityEvents`, and `feltLag`, and `droppedFrameEvents=0`. Empty lag marks mean no taps were recorded, not proof the player felt no lag. The interrupted first phone Trip is excluded. The existing captures predate the uncommitted parked-control repair, which has been preserved; neither drive's moving parked-after phase is a stationary recovery control.

## iPhone Quality Decisions

Phone Drive first samples at each quality are `[0]` baseline at t=0, `[2]` pixel-87 at 2 s, `[5]` no-bloom at 5 s, `[8]` pixel-75 at 8.1 s, and `[10]` pixel-50 at 10.1 s. Phone Trip follows `[0]`, `[2]`, `[5]`, `[8]`, `[11]`, at 0, 2, 5, 8, and 11 s. These are first observed states, not exact transition timestamps.

Reported `pixelRatio` rounds to one decimal (`src/debug.js`, `samplePerf`). Low's actual configured sequence is 1.25, 1.09375, 1.09375, 0.9375, 0.625, from the multipliers in `src/adaptiveQuality.js` and the cap in `src/perf.js:98-105`. Thus the reported 1.3 to 0.6 is approximately a fourfold reduction in pixel area. Phone sample `[0]` canvas/target sizes are 537x968 / 537.5x968.75; the bottom rung is 268x484 / 268.75x484.375. All observed samples have `bloom=false`, so the no-bloom transition did not disable an already-running pass at the sampled boundaries.

| Capture / sample | fps | fAvg | fP95 | frame.wallP95 | frame.workMax | frame.renderMax |
|---|---:|---:|---:|---:|---:|---:|
| Phone Drive `[4]` | 58 | 17.8 | 41 | 40 | 9 | 7 |
| Phone Drive `[7]` | 57 | 17.2 | 35 | 42 | 11 | 7 |
| Phone Drive `[9]` | 55 | 17.8 | 40 | 44 | 12 | 8 |
| Phone Trip `[4]` | 58 | 17.3 | 37 | 37 | 10 | 6 |
| Phone Trip `[7]` | 56 | 17.2 | 35 | 38 | 10 | 6 |
| Phone Trip `[10]` | 58 | 17.4 | 38 | 41 | 9 | 7 |

At each listed observation, p95 exceeds the governor's 33 ms threshold and average does not exceed its 22 ms threshold; a downgrade follows. The exact decision tick and bad-run counter were not saved, so these rows cannot prove the trigger on every individual decision. `src/adaptiveQuality.js:147-214` uses raw `performance.now()` gaps, a fresh 90-frame window after transitions, and sustained `avg > 22 || p95 > 33` pressure. Healthy ticks decay the bad-run counter by one rather than always resetting it. Two consecutive gaps above 80 ms are another path.

Phone Drive samples `[46..136]` report median fps 58, median window wall-p95 37 ms, and 340/5,256 gaps above 33 ms (6.47%), but zero above 50 ms. Phone Trip `[21..119]` records 366/5,641 above 33 ms (6.49%), also zero above 50 ms. Its baseline/active/peak/after median fps is 58/58/58.5/58 and median window wall-p95 is 38/38/37/38 ms; phase maximum measured work is 10/9/9/10 ms. A minority of delayed ticks can exceed the p95 threshold while the tick count and mean still look close to 60 Hz.

The timing fields do not measure the same thing:

- `fps` counts game-tick timestamps in the preceding second, not presented frames (`src/debug.js:1133-1136`, `samplePerf`).
- `fAvg/fP95/fMax` are the governor's rolling statistics. The Trip scenario disables the governor at baseline entry (`src/debug.js`, `advanceDeviceScenario`), and disabled ticks return before sampling (`src/adaptiveQuality.js:150`). Phone Trip `[21..119]` consequently repeats 17.4/36/46; Mac Trip `[21..120]` repeats 16.7/17.5/17.8. These are frozen settling statistics, not live Trip measurements.
- `frame.wall*` measures tick-start gaps, while `work*` measures synchronous elapsed work through the tick. `renderMs` surrounds `composer.render()` and `worldMs` surrounds `updateWorld()` (`src/main.js:870-886,1355-1357,1479-1482`). None is a GPU timer query. Browser work, asynchronous GPU completion, presentation, or scheduling outside that interval remains unmeasured.

This establishes why the governor can keep dropping resolution; it does not identify the external source of the iPhone timing distribution. Low Baseline versus Auto is the smallest direct test of whether that resolution loss actually improves delivery.

## Mac Bubble Rendering and Emission

| Capture / samples | Material | Draws | Triangles | Active bubbles |
|---|---|---:|---:|---:|
| Mac Drive `[18]` | fancy | 4,642 | 1,692,968 | 385 |
| Mac Drive `[19]` | cheap | 2,366 | 875,370 | 403 |
| Mac Trip `[11]` | fancy | 4,606 | 1,718,564 | 240 |
| Mac Trip `[12]` | cheap | 2,345 | 888,032 | 263 |

Each pair holds DPR 1.5, position `(300,-641)`, registry 3026, colliders 2839, NPCs 231, generated chunks 25, and both shadow booleans true. Draws fall 49.03% and 49.09% even as active bubbles rise. Geometry and texture counts are unchanged within each pair. The following unmixed windows `[20]` and `[13]` have render maxima 7.2 ms, compared with 39 and 26.3 ms before switching.

The fancy material uses `MeshPhysicalMaterial` with transmission 0.95; cheap is Standard without transmission (`src/bubbles.js:50-88`). Switching only replaces the material reference (`:166-170`), not the particles, spawn rate, or pool. Scene counters are copied after the scene pass (`src/main.js:180-199`). Removing transmission's extra scene-rendering work is the concrete mechanism consistent with the repeatable approximately halved counts. Animation and particles keep advancing, so these sampled pairs are not a fully frozen per-pass attribution experiment.

Emission continues while parked: `SPAWN_PER_SEC=40` (`src/bubbles.js:11`) multiplied by the idle factor 0.55 gives 22 bubbles per simulation second at full juice. Movement ramps it to 40 at speed 8; blast multiplies by 2.8 and star power by 2.5 (`:150-155,186-198`). Lifetime is nominally 22 seconds (`:30`), and pool capacities are Low 200 / High 600 (`src/perf.js`). Hundreds of parked bubbles are therefore expected; the empty-pool visibility fix does not remove the cost once live bubbles exist. No emission change coincides with `setCheapMaterial`.

Mac Drive also restores fancy bubbles at `[49].t=49` and returns to cheap at `[60].t=60.1`, both at DPR 1.5. This matters when interpreting the drive, rather than assuming it remained cheap after its first drop. It is consistent with the governor's failed-raise window/backoff (`src/adaptiveQuality.js`, `_dropQuality`), although internal backoff state was not captured.

The bubble comments claiming preconstruction prevents shader compilation are stronger than the evidence. Both sampled switches have `progDelta=1`; allocating a material does not prove all later renderer variants are warmed. A net program increase alone does not identify the compiled material or its cost.

## Mac Render Spikes

| Capture / frameEvents index | wallMs | workMs | previousWorkMs | worldMs | renderMs |
|---|---:|---:|---:|---:|---:|
| Mac Drive `[15]` | 17.1 | 162.4 | 8.1 | 0.1 | 160.6 |
| Mac Drive `[16]` | 163.4 | 7.4 | 162.4 | 0.1 | 5.2 |
| Mac Trip `[11]` | 16.1 | 218.4 | 8.8 | 0.1 | 216.8 |
| Mac Trip `[12]` | 219.5 | 9.3 | 218.4 | 0.1 | 7.6 |
| Mac Trip `[13]` | 14.4 | 100.3 | 9.3 | 0 | 98.9 |
| Mac Trip `[14]` | 101 | 12.5 | 100.3 | 0.1 | 10.5 |

Each long-work event is followed by a long-gap event attributable to that preceding work. Do not count each pair as two independent expensive renders.

The drive spike near `(1043,-31)` lies in samples `[128]->[129]`: programs 54->81, `progDelta=27`, `sunShadow=true->false`, while `shadowPolicy=true`, quality cheap-bubs, DPR 1.5, chunks 173, registry 4515, colliders 4189, and textures 36 remain unchanged. `frame.worldMax=0.2` at `[129]` rules out a large synchronous chunk builder in that recorded window. The day/night code gates sun casting at nightness 0.7 (`src/timeOfDay.js:189`). A shadow-dependent program transition is a strong candidate for the first-use render stall, but compile/link duration and exclusive causation were not measured.

The Trip spike lies in `[46]->[47]`: `tripPass=false->true`, `tripState=idle->fading_in`, programs 56->57, chunks unchanged at 25, and draws 2280->2277. Both expensive Trip events follow `phaseEvents[2].ts=1791567732384`; their event timestamps are 1791567732793 and 1791567732909. The second 98.9 ms render still has program count 57, so net program growth alone cannot explain both stalls. First-use shader/pipeline work is plausible, while GPU synchronization, driver work, or other work inside the measured render call remains possible.

Startup was worse: Mac Drive `frameEvents[1]` records 503.4 ms render / 515.7 ms work, followed by `[2]` wall 523.4 ms with previousWork 515.7 ms. That belongs to settling, not driving, and should be treated separately rather than hidden by the settled summary.

## Next One-Variable Tests

1. Run a paired iPhone **drive** with `bin/playtest-perf drive --tier low --quality auto --seed 3948869160`, then repeat with `--quality baseline` at the same seed and on a comparable route. Record sharpness, felt stutters, and warmth after each run. Do not switch to High: High changes crowd density, shadows, chunk radius, and caps, as well as resolution. The completed parked pair does not establish High viability or Baseline's safety during streaming.
2. On Mac, hold a settled scene, camera, time, DPR 1.5, and live bubble population, then switch only fancy versus cheap material. Separate first-switch cost from warmed steady-state counts/work. This targets the two stationary approximately 49% draw reductions without altering emission.
3. On Mac, hold scene, camera, time, and quality, then toggle only effective sun shadow casting through the existing policy control. Compare the first and warmed transitions while recording render work and program counts. Do not advance the whole day/night cycle for this isolation test.
4. Activate the same parked Trip twice in one session at fixed camera, time, and quality, returning to the same initial Trip state. First use versus already used is the variable; repeat spikes would weaken a first-use-only explanation.

## Verification

The implementation preserves the existing parked-control and occupied-port changes and does not edit far-field code or documentation. `npm run check` passes, including first-install policy, pressure, ordinary-play isolation, shared Low bubble policy, paired URL, parked phase, and report-label tests. A browser smoke check verifies the pre-Start baseline lock and saved Detailed bubbles On override without overwriting the saved value. Device quality/thermal acceptance remains pending; desktop automation is not an iPhone benchmark.

The named, isolated browser session `capture-policy-astra` exercised the real title-button click and automatic save. Its baseline smoke capture is `.claude/captures/device-mv1ae50q-adfifh.json`: complete, 62 samples, zero captured errors, level zero throughout, cheap bubbles, speed zero, and explicit first-frame lock. Its desktop DPR was 1, as expected for that browser, not an emulated iPhone DPR. Auto initialized with the same saved Detailed bubbles On preference and identical tier policy but `governorEnabled=true`; its partial smoke capture `.claude/captures/device-mv1agjyo-aa07h3.json` is not a completed device comparison. Both browser console checks were clean. The named browser was closed, its daemon PID 77272 was confirmed gone, and no existing server or unrelated browser was stopped. `ZERBLE_TEST_HTTP=1 python3 bin/test-perf-server` also passed the occupied-port, LAN authorization, and upload tests.
