# Astra handoff: make Zerble feel good to drive

> Follow-up: the requested focused pass is implemented. Read [the results and play-test](../../../verification/driving/2026-11-02/handling-pass.md); the baseline and proposed work below are historical context. Gary’s handling acceptance remains open.

## TL;DR

The physical-driving feature is implemented and passes its mechanical checks, but Gary has **not accepted the handling**. Preserve physical falls, surface/water effects and crash consequences while recovering the immediate, playful control of the old cart. Start with the controller and the short replays below. Further blanket increases to boost or grip are not an established solution.

## Gary's feedback and the desired outcome

- Initial reports: weak acceleration, boost mostly changed engine sound, difficult steering, visible forward stepping and camera bob, plus a contact shadow floating with the cart.
- After the first adjustment: acceleration/steering were “a wee bit better, but not yet good”; boosted steering was weaker and boost still felt insufficient.
- Latest: it “still doesn't feel right,” possibly because of changing inclines and the familiar old response being consistent everywhere. Gary wants to get there and specifically wants an efficient Astra pass because of token cost.
- The newest boost/grip patch below is a candidate, not a feel sign-off. Do not interpret green tests as player acceptance.

## Current workspace and scope

At handoff preparation: repository `/Users/garyreckard/Sites/zerble-at-the-festival`, branch `main`, base HEAD `fdaecb1`; the entire feature is uncommitted, including several new files. Run `git status` before changing anything. Preserve the existing work. No Astra agent has been launched.

Implemented: dynamic Rapier chassis and four wheel rays; fixed 60 Hz integration; terrain/scenery residency; surface profiles; creek/lake beds, drag and submersion endings; incident-based damage; engine demand; tilted passengers; game and course integration. The scope now is **handling feel**, not reimplementing water, damage, scenery or the renderer.

## Read these first, in order

| File | Why |
| --- | --- |
| `src/physics/playerVehicle.js` | Entire player controller, about 190 lines. `beforeStep` owns drive, grip, braking and water; `afterStep` owns feedback/recovery; render interpolation is temporary. |
| `src/terrainDriving.js:6` | Previous grounded terrain controller, especially heading response at line 16 and traction/propulsion at lines 21–47. |
| `src/zerble.js:14` and `src/zerble.js:1290` | Familiar flat arcade constants and legacy update. Old forward speed 18 m/s, boost 27.9, acceleration 18 m/s² and commanded yaw up to 2.1 rad/s; the current physical cart skips this drive path. |
| `bin/test-player-handling` | Compact real-Rapier comparison: cruise, boost pickup, sustained full left/right turns, opposite steering and wheel stability on grass/asphalt. |
| `bin/test-player-vehicle` | Inclines, reverse, water, continuous falls, cadence, resets and teardown. |

Only read the integration owners if needed: `src/physics/liveWorld.js:224` advances the shared clock; `src/main.js:1268` drives it before gameplay; `src/main.js:1887` and `:1923` bracket temporary render interpolation; `src/drivingSurface.js` samples contact surfaces. The adapter owns native Rapier resources; `src/physics/rapierAdapter.js:311` writes wheel controls and `:741` applies impulses. Surface changes come from actual wheel contacts, not only cart-centre coordinates.

## Reproduction and evidence

Reuse the existing server at `http://127.0.0.1:8765`; do not start another browser/server unnecessarily.

- `player-driving.html?mute=1&perf=low&fixture=surfaces`: same real cart, flat strips. WASD, Shift boost. Reset and pause are visible controls. `fixture=ridge` checks ramps/cliff; `fixture=creek` checks water.
- `/?mute=1&perf=low&physics=1&seed=1977`: normal game. Click the ready Just Cruisin' plank. The panel shows speed, contacts, surface, immersion and whether collision preparation has blocked simulation.
- Gary's exact earlier location: `/?mute=1&perf=low&physics=1&seed=1977&x=-1050&z=-1442&heading=0&tod=0.3`. **Straight ahead enters a lake**; a recent test reached 1.30 m immersion after three seconds. Do not use this as the only dry-handling benchmark. See [desktop verification](../../../verification/driving/2026-11-02/README.md).

Fast commands, each roughly a second locally:

```sh
node bin/test-player-handling
node bin/test-player-vehicle
node bin/test-player-driving-live
```

Before the newest patch, a 1.5-second full-steering replay measured grass yaw 0.877 radians normally and only 0.468 with boost; asphalt was 1.648 versus 0.995. This reproduced the boosted-understeer complaint. Merely increasing wheel motor force to 1.9 times normal also lifted the front wheels in the same fixture and eliminated grass steering. That experiment was replaced, not left active.

Current candidate measurements, same replay:

| Surface | Cruise / boosted top (m/s) | Full-turn yaw, normal / boost (rad over 1.5 s) |
| --- | --- | --- |
| Grass | 15.26 / 31.06 | 1.08 / 1.42 |
| Asphalt | 17.73 / 35.72 | 2.43 / 2.93 |

Both steering signs and countersteering pass, with four-wheel support in the flat fixture. [Rendered boosted turn](../../../verification/driving/2026-11-02/boost-turn-low.png) shows the actual course. These figures establish response and stability, not enjoyment, and the tests' thresholds are provisional.

## What the last patch does

`playerVehicle.js:61` still reduces wheel steering angle with speed. `:64` now increases tire grip with speed, bounded at 3.5 times each surface's profile. `:78` raises boost's dry cap from 27.9 to 36 before surface scaling. `:92` adds 90% extra propulsion through the chassis centre while grounded, avoiding the front-wheel lift from applying all extra torque through the tires. Normal speed/acceleration remain as before. Boost is disabled for reverse, slow mode and sputtering. Water engine cutoff and contact gating remain in force.

Previous fixes already in place: rendering interpolates between solver poses and restores the authoritative position; the course smooths both camera position and aim; the chassis-attached fallback shadow hides while airborne. A visual hitch can also be a support-frontier pause, so inspect the panel before attributing all unevenness to handling. See `liveWorld.js:234`.

## The decision worth spending Astra tokens on

Assess whether the current wheel-force model can give consistent, legible player control, or whether a grounded force-based target-speed/target-yaw assist would provide a better arcade baseline. That is a design hypothesis to test, not a prescribed rewrite. Define which control qualities should stay predictable across terrain, then let grades, available grip and water modify those qualities in readable ways. Preserve physical launch, gravity, collisions and landings; do not regain familiarity by snapping the cart back onto sampled terrain or writing a second competing pose.

Compare launch, throttle release, reverse/braking, sustained turn and quick left/right correction on flat grass, asphalt, a moderate uphill/downhill and boost. One coherent candidate with a before/after replay and a short recommendation is more useful than a large menu of speculative constants. Stage browser checks after the numeric replay is useful, and ask Gary to judge the resulting feel.

## Verification and constraints

`npm run check` and `npm run build` passed on the current candidate; a targeted vehicle rerun also passed after adding boosted uphill coverage. A normal Just Cruisin' title-click smoke test and course turn check cover integration. No iPhone/iPad or subjective audio acceptance is claimed. Low-tier rendering exceeds displayed budgets in existing captures; no clean baseline was available to attribute that excess to this feature.

Keep fixed-step determinism, one physics authority, no propulsion in the air, safe collision residency, contact-based damage, bridge layer selection, water cutoff, passenger transforms and owned-resource teardown. Tests should challenge the candidate's behavior rather than freeze arbitrary tuning values. See project `AGENTS.md` for full checks and browser lifecycle constraints. No headless process farm, no council or broad repository audit is needed for this focused pass.

## Ready-to-use prompt

> Read `openspec/changes/physical-zerble-driving/astra-handoff.md`, then the five files in its read-first table, using only the indicated sections of the large `zerble.js` file. Gary has not accepted the driving feel despite passing physics tests. Evaluate and implement one coherent arcade-handling improvement that preserves physical hills/falls, surface/water effects and damage. Use the existing comparisons to establish a baseline; investigate additional files only when a measured problem points there. Keep the response focused on the handling decision, before/after evidence, and the play-test Gary should perform. Preserve all existing uncommitted work. Do not treat the newest boost/grip tuning or its numeric thresholds as accepted design.
