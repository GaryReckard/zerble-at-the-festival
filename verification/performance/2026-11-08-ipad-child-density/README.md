# Physical-iPad route baseline and reduced child cohort, November 8

**TL/DR:** The saved iPad run completed its whole route before any screen lock.
The largest retained driving world interval is far-field work, while a separate
capture-only fixture reduces children from 50 to 23 without changing adult
policy. No physical-iPad reduced-cohort result or optimization gain is established.

## Saved physical-device run

[Raw baseline](baseline-capture.json), [report](baseline-report.txt),
[derived checks](baseline-analysis.json) and [SHA-256](baseline-sha256.txt)
preserve the report exactly as received. The prior server's
[source snapshot](baseline-snapshot.json) and [served build](baseline-served-build.json)
identify the application used, including existing uncommitted work.

The report is `valid: true`, with all four ordered checkpoints, 641.39 metres,
a 47.85-second drive, 114.3 active seconds, a maximum corridor deviation of
5.41 metres, no runtime errors and no visibility changes. This establishes
completion before any later device lock; it cannot establish whether the device
locked afterward. Prior native discovery identified iPadOS 18.7.8 and Safari
18.7.5; the device's hardware model remains unknown. Its desktop-style MacIntel
platform string does not make this a Mac capture.

The rolling FPS sample medians are 29 parked, 25 driving and 26 afterward.
These are descriptive, not calibrated verdicts. Auto changed quality and render
resolution during comparison phases, ending on Low at pixel-50. There are 25
ordinary generated chunks. The largest retained driving world interval is
424 ms, including 423 ms in `farField`; the next is 323 ms entirely in that
section. The settling interval reaches 1421 ms in far-field. Elapsed intervals
include collection and scheduling, and the rendering interval is CPU-side work.

The existing `ffCold` counter never exceeds 3 ms in the sampled report. That
counter covers planning steps, not `_applySnapshot`, as defined in
`src/farField.js` and serialized by `src/debug.js`. Therefore the next diagnostic
must distinguish snapshot expansion, instance/road publication and handoffs;
calling all of this expensive planning would overstate what was measured.

## Reduced fixture

`bin/playtest-perf drive --autopilot --world-detail --child-cohort half-v1 --tier auto --port 8770`
prepares the reduced link. Full and half links can share a server/build and differ
only by `perfKids=full-v1` versus `perfKids=half-v1`. Other route, seed, time,
quality and adult policies stay the same. Export metadata records the cohort,
child count and export-time adult count. Normal gameplay retains eight groups.

The fixture constructs all eight original groups, then removes groups 1, 3, 5
and 7 before batching. It consumes the same constructor/model random draws and
support placement, retaining the exact initial rigs and state of groups 0, 2, 4
and 6. Excluded handles are revoked, matching colliders removed, and owned
resources released while shared pools remain intact. This intentionally does
not measure a startup construction saving. Runtime interactions and Auto quality
can still diverge as a consequence of the smaller population.

`bin/test-child-cohort` checks real model rigs in independent cold processes,
remaining positions/colors/state, next random draw, live handles, collider/scene
counts and diagnostic-only URL gating. The production serializer regression
checks both default and reduced cohort metadata. The default kid pooling golden
comparison remains unchanged. An initial test exposed an added child user-data
field; group membership was moved into a constructor-local WeakMap so the
ordinary child-state contract remains identical. A second full check exposed
missing new constants in the serializer's VM fixture, which was corrected.

## Offline lead for the next optimization

[CPU probe](far-field-probe.mjs) and [raw output](far-field-probe.json) execute
the real Low far-field composition with terrain at three route anchors under
Node, with method wrappers and bounded planner completion. Nested call timings
are not additive. This is CPU attribution with no GPU, actual iPad or game
frame-scheduling claim, and the first cold Node world differs from game boot.

The [terrain subtraction](far-field-subtraction.json), paired with the
[flat-ground raw output](far-field-flat-probe.json), changes only the probe's
terrain-enabled switch in separate cold processes. Every committed descriptor
hash matches. Snapshot application takes approximately 1603, 188 and 125 ms
with terrain, versus 7, 3 and 2 ms with flat ground. This intentionally changes
road draping and vertical placement and is not an optimization candidate.
Neither probe installs the running game's landscape clearance policy, and the
first cold Node world differs from game boot; these timings must not be
presented as Safari frame costs or added to measured device intervals.

The results support investigating how distant geometry conforms to terrain,
including expansion and road draping, before changing the planner scheduler.
The next experiment should split that real-device interval, then test bounded
reuse or deferred work while retaining identical geometry and collider truth.
There is no production far-field change in this task.

## Next physical-device steps

Temporarily disable iPad Auto-Lock, close the previous game tab, open the reduced
QR/link and tap the ready Just Cruisin' plank once. Keep Safari visible, do not
steer, and wait for SAVED. Restore the prior Auto-Lock setting after testing.
Use a fresh full-cohort run on the same new build and alternating repeats before
claiming a population benefit; the older valid baseline remains attribution
context, not an identical-build comparison input.

## Verification status

The full `npm run check` and production build pass in [checks](checks.json),
[check log](check.log) and [build log](build.log). Prior failed checks remain in
[child-state failure](check-initial-failure.log) and
[serializer-fixture failure](check-serializer-fixture-failure.log).

The [native reduced-route result](half-desktop-result.json) and
[raw desktop capture](half-desktop-capture.json) confirm 23 children, all four
checkpoints, 641.21 metres, zero errors and a valid completion. This is a
functional Mac integration result, not physical-iPad timing evidence. The
[ordinary Low startup](ordinary-smoke-result.json) passed through the real ready
title gesture on the same source. [Source manifest](candidate-source-manifest.json),
[served build](candidate-served-build.json) and [cleanup](cleanup.json) identify
the prepared fixture and independently verified process teardown. The dedicated
LAN capture server remains available for the next iPad run. No task keep-awake
process was started.

Reproduce this diagnostic's saved-run derivations with `python3 analyze.py`
from this directory. Running it twice produces byte-identical analysis files.
Its validity assertions and matching-descriptor checks are not a calibrated
performance verdict. The physical-iPad reduced-cohort capture remains pending Gary's
next run. Existing user browser sessions and the pre-existing Vite server are
outside this task's ownership. The completed baseline's owned Python capture
server was stopped and its exact PID verified absent in
[cleanup](baseline-server-stop.json).
