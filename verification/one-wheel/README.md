# One-wheel rider verification

Recorded on October 22, 2026 on Gary's Mac using the Codex in-app browser.
These checks establish local behavior and rendering, not phone performance.

## Implementation and ownership

Astra built the [rider model](../../src/models/oneWheelRider.js) from Gary's
[board](../../docs/backlog/one-wheel/board-reference.png) and
[night rider](../../docs/backlog/one-wheel/rider-reference.png) references.
It has a helmet, sideways stance, bent knees, two footpads around one broad
tire, a fender, grip detail, sling bag and white/red night LEDs. Eight meshes
use shared baked geometry and three bounded outfit variants, while each rider
owns its two LED materials. Only the main body casts shadows. Tire rotation
tracks distance; acceleration and turns drive bounded leaning and balancing.

[OneWheels](../../src/oneWheels.js) is a world-owned encounter manager with a
two-rider cap. Its private hash/salt gates an encounter in 22% of visited 160m
cells before road availability, distance, camera visibility and pedestrian
checks. This is a candidate gate, not a promised realized encounter rate.
Existing road polylines are split into dry, obstacle-free runs. The full board
envelope probes water rather than checking its center alone.

[OneWheelMotion](../../src/oneWheelMotion.js) advances at fixed 1/60-second
steps, with a 3m/s cruising cap, smooth braking for pedestrians and Zerble,
short motion prediction for crossings, and per-step hard clearance checks.
Riders turn at corners, pause and reverse at endpoints, turn back after a
three-second static blockage, and pause seven seconds near gatherings after
traveling at least 24m. A hit pauses the rider for recovery, while the
[main collision path](../../src/main.js) applies normal people-hit combo and
Festival Run consequences.

Moving registry positions are synchronized before crowd steering and collision.
Distance beyond 210m or scene disposal removes the rider and its registry entry,
releases owned LED materials, and retains shared geometry/material pools.
A persisted pagehide preserves the manager for back/forward navigation.

## Reproduce

- `sandbox.html?entity=one_wheel&mute=1`: isolated model, wheel/lean animation and time-of-day controls. Append `baseline=1` for the same scene with the model hidden.
- `sandbox.html?entity=one_wheel_route&mute=1`: live route controller with a crossing pedestrian. The status line counts yielding and resumption; the preview owns and tears down its moving collider.
- `/?seed=1234&onewheel=1&perf=low&mute=1` or `perf=high`: localhost-only forced encounter and following camera. Wait for the ready title card, then click a mode plank.
- Normal games omit `onewheel=1` and use the seeded encounter gate. The debug Teleport picker includes **One-wheel rider (active)**; `__dbg.oneWheels()` inspects status and `__dbg.summonOneWheel()` requests a safe road encounter.

Sandbox selector changes preserve mute, tier and seed URL flags.

## Automated checks

`npm run check` passed, including the new
[behavior/lifecycle test](../../bin/test-one-wheel) and
[model test](../../bin/test-one-wheel-model). [Full output](check.txt).

The behavior test exercises 30/60/120fps equivalence, corner/endpoint handling,
stationary and crossing pedestrians, cart yielding, resumption, smooth braking,
water/solid blockage recovery and gathering pauses. Manager tests use the
actual class with rendering/storage stubs to verify full-envelope shoreline
rejection, live collider positions, distant removal, shared-pool retention,
owned-material disposal and idempotent teardown. Five actual worldgen seeds
produce repeatable safe road encounters. Collision classification, hit recovery,
BFCache preservation, update order and sandbox flag retention have regressions.

The model test runs the shipped updater with rendering writes stubbed: signed
wheel travel, stopped/reverse behavior, frame partitioning, bounded lean and
settling, explicit-time animation, invalid dt and independent LED state.
Geometry and appearance were inspected in the browser rather than inferred
from these stubs.

Astra's review found BFCache disposal, abrupt yielding and missing people-hit
classification. All three were fixed and tested; the final read-only review
reported no blocking findings. The live-game boot also caught a duplicate
local name in the new debug stats, which was renamed before final smoke tests.

## Browser observations

The route preview recorded two yield events and two resumptions, with no
console warnings/errors. Switching back to the isolated model returned its
render counters to 10 draws / 3,732 triangles / 10 geometries / 3 textures.
[Saved crossing state](crossing-stats.txt).

| Isolated view | Draws | Triangles | Geometries | Textures |
| --- | ---: | ---: | ---: | ---: |
| Model hidden, Low Noon | 2 | 48 | 3 | 3 |
| Rider, Low Noon and Midnight | 10 | 3,732 | 10 | 3 |
| Rider, High Noon and Midnight | 10 | 3,732 | 10 | 3 |

The measured model delta is eight draws, 3,684 triangles and seven geometry
buffers. Construction was separately observed at 5.1ms on a fresh High preview
and 0.3ms on a repeated same-page construction after pools were warm. These are
single local CPU construction observations and sandbox render counters, not
steady-state GPU timings or device FPS predictions. The live world's total
HUD budgets remain above their guide values; these checks do not certify the
whole game's device performance.

Both live game checks used actual mode-plank clicks: Low Just Cruisin' and High
Festival Run, with a real registered rider visible on a generated road. The
Noon and Midnight checks exercised normal lighting and the moving actor loop.
After the debug-name fix, no new console warning/error appeared; the browser
log retained the earlier syntax error across reloads, so it was identified by
its old script version and timestamp rather than counted as a new failure.
[Low stats](game-low-stats.txt), [Low night stats](game-low-night-stats.txt),
[High stats](game-high-stats.txt).

| Capture | Purpose |
| --- | --- |
| [Low Noon](noon-low.jpg), [High Noon](noon-high.jpg) | Board, stance and helmet |
| [Low Midnight](midnight-low.jpg), [High Midnight](midnight-high.jpg) | Restrained LEDs and night appearance |
| [Crossing preview](crossing.jpg) | Route and pedestrian verification surface |
| [Live Noon Low](game-noon-low.jpg) | Real road encounter |
| [Live Midnight Low](game-midnight-low.jpg), [Live Midnight High](game-midnight-high.jpg) | Actual night integration |

All verification launches used `mute=1`, and the session output stayed muted.
Selector changes now retain that flag as well as tier and seed parameters.
The collision sound button was exercised through the new sound mapping without claiming an audible
mix or physical iOS audio unlock test. Test tabs were closed. No standalone
browser was launched, and the pre-existing server on port 8765 was reused;
no task-owned server remained to stop.
