# Focused handling pass, November 2, 2026

## Recommendation

Play-test the grounded force-controller candidate. Ordinary surfaces now share a predictable steering response, while grass still limits speed, steep banks lose traction, water resists movement, and the chassis remains physical. Gary subsequently accepted this handling pass and requested committing the complete implementation.

The [controller](../../../src/physics/playerVehicle.js) now applies bounded forward/lateral impulses and a yaw torque pair around the chassis centre of mass. Native wheel rays retain suspension, but their lateral stiffness is negligible so wheel friction cannot oppose the yaw controller. No grounded pose or velocity is assigned. The 2.1 rad/s commanded yaw follows the previous arcade cart, with force-limited response and no stationary pivot. Road targets return to 18 m/s normally and 27.9 m/s with boost, replacing the handoff’s provisional 36 m/s boost target.

Traction fades on steep support and with missing wheel contacts; water reduces lateral/yaw assistance and retains the engine cutoff. The finite force budget allows uphill acceleration to remain slower and steep-bank rollback to remain possible. Downhill momentum is not clamped. Throttle release has a minimum decay rate on every surface, so asphalt no longer coasts roughly twice as long as grass.

## Before and after

The [same replay](../../../bin/test-player-handling) ran against the handoff controller before editing and against the final controller. It covers 24 combinations: grass/asphalt, flat/30% uphill/30% downhill, normal/boost, and left/right. Each run settles, launches for one second, reaches cruise, engages boost if selected, sustains steering for 1.5 seconds, countersteers for half a second, releases throttle, reverses and brakes. Values below use positive steering; both signs pass.

| Flat metric | Grass before | Grass after | Asphalt before | Asphalt after |
| --- | ---: | ---: | ---: | ---: |
| Speed after 1 s launch, m/s | 11.49 | 14.49 | 13.84 | 16.49 |
| Normal full-turn yaw, rad | 1.08 | 2.72 | 2.43 | 2.72 |
| Boosted full-turn yaw, rad | 1.42 | 2.72 | 2.93 | 2.72 |
| Normal top speed, m/s | 15.26 | 15.06 | 17.73 | 17.64 |
| Boosted top speed, m/s | 31.06 | 23.35 | 35.72 | 27.35 |
| Fraction of speed retained after 1 s release | 0.32 | 0.32 | 0.64 | 0.37 |

On the 30% uphill replay, one-second launch speed improved from 7.34 to 11.94 m/s on grass and from 7.93 to 12.90 m/s on asphalt. All uphill/downhill turn combinations now produce about 2.60 radians of world-Y rotation, versus 2.72 on flat ground; the yaw target follows the sloped support normal. Every tested sustained turn retains four contacts. Countersteering reverses yaw within half a second, reverse reaches at least 5 m/s within two seconds, and braking leaves less than 0.15 m/s after one second. Grade replays include the same two-second unbraked settling period in both versions, so launch readings include any initial rollback.

Raw evidence: [before](handling-before.json), [after](handling-after.json). Assertions compare surface/boost response and practical control outcomes rather than requiring the provisional doubling of boost speed.

## Verification and limitations

- `npm run check` and `npm run build` passed; the build retains its large-chunk warning. The two vehicle suites passed again after adding disabled-controller and airborne-yaw assertions.
- [Vehicle regressions](../../../bin/test-player-vehicle) preserve continuous cliff falls, 30/60/120 Hz equivalence, uphill/steep-bank behavior, reverse steering, shallow-water resistance, reset semantics and exact teardown. Recovery now starts explicitly overturned on ample support: the former test depended on a particular coast/bounce trajectory remaining inside a finite landing slab, which changed with the release tune.
- [Live regressions](../../../bin/test-player-driving-live) passed support-frontier pause/resume, tree damage, no repeated damage while pushing or parked, water cutoff/submersion, Star Power re-entry and teardown. The tree replay registered one damage episode; ordinary flat driving registered none.
- The in-app browser reused the existing server on port 8765. The Low-tier surface-course replay completed with four contacts, zero damage and no console errors. The real game was started by clicking the ready Just Cruisin’ plank, reached support-ready gameplay with four contacts, and returned no console errors. [Noon capture](handling-game-noon.png) and [Midnight capture](handling-game-midnight.png) record the running game. The temporary tab was closed; no standalone browser or server remained from this pass.
- Browser checks establish integration, not a measured keyboard replay or subjective feel. No new phone, audio or device-performance acceptance is claimed. The approximate 750 kg m² yaw inertia is specific to this chassis; changing its mass distribution should rerun these comparisons.

## Gary’s short play-test

Open `http://127.0.0.1:8765/player-driving.html?mute=1&perf=low&fixture=surfaces`. Accelerate, release, alternate left/right, then repeat while boosting. Compare asphalt and grass, then select Ridge and cliff to check an uphill launch, crest departure and landing. Repeat briefly in the real game. Judge whether steering now feels immediate and predictable, whether release stops feel natural, and whether boost feels useful at the restored speed. The earlier seeded lake approach is not a dry-handling benchmark.

Gary accepted the handling pass; [the feature tasks](../../../openspec/changes/physical-zerble-driving/tasks.md) record completion, while [the roadmap](../../../ROADMAP.md) retains physical-device and rendering-baseline follow-ups.
