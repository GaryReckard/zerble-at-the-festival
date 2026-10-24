# Rolling country: playable driving proof

October 24, 2026. This implements the bounded driving experiment from the
[terrain proposal](2026-10-24-proposal.md), not its subsequent festival rollout.

## Play

With the existing no-cache server running, open
[the driving course](http://127.0.0.1:8765/terrain-sandbox.html?mute=1).
The entity sandbox also links to it. Start a server if needed with
`python3 .claude/serve_nocache.py 8765` from the repository root.

WASD/arrows drive; Space brakes, Shift boosts, and R resets the selected stretch.
The on-screen buttons accept pointer/touch input. Release throttle to coast and
brake to park. The section picker places the cart on the level run-up, ascent,
crest, descent, sideways slope or plateau. Chase, High and Orbit views,
Noon/Midnight and wireframe are inspection controls. The optional **Enable engine sound** button reuses the game’s engine and
boost revs; sound remains off until that tap. **Boost ↑** combines throttle and
boost for two-thumb phone driving.
Use **Run repeatable drive** for a 28-second ascent, downhill coast, final climb
and stop on the plateau. Source: `src/terrainSandbox.js:110`,
`src/terrainDriving.js:45`, and `terrain-sandbox.html`.

## Implemented scope

- A fixed 120 × 455 meter fixture has a 13-meter ridge, 14% cross-slope and
  10-meter level plateau. Broad smooth transitions intentionally exaggerate the
  experiment: the main ascent peaks near 19.5%, descent near 22.9%, and plateau
  approach near 27.3%. These are proof values, not accepted festival tuning.
  Source: `src/terrainSurface.js:4` and `src/terrainSurface.js:14`.
- Six independently constructed strips share a one-meter world-space lattice
  at their 80-meter boundaries. Triangle interpolation supplies contact heights
  and normals, so physics does not sample a different analytic hill from the
  rendered triangles. Source: `src/terrainSurface.js:21` and
  `src/terrainSandbox.js:23`.
- The actual `Zerble.update()` selects the new movement only when a sampler is
  explicitly attached. Motor force tapers at cruise, gravity acts along the
  forward tangent, a separate coasting limit permits downhill speed, and brakes
  and parking hold keep a stopped cart supported. The center must stay within
  the fixture's three-meter inset and cannot enter a sample above 55% grade.
  Source: `src/zerble.js:92`, `src/zerble.js:1293`,
  `src/terrainDriving.js:6`, and `src/terrainSurface.js:33`.
- Four contacts establish chassis pitch/roll, and each wheel has bounded
  ±0.3-meter suspension travel. Terrain-enabled seat and nozzle positions use
  the full cart transform. This remains grounded arcade driving without jumps
  or a rigid-body solver. Source: `src/zerble.js:1091`,
  `src/zerble.js:1242`, and `src/zerble.js:1343`.
- The sandbox camera checks intermediate terrain along both its desired and
  smoothed sight lines. Closing/navigating the page cancels its animation frame
  and disposes owned resources; a restored cached document reloads rather than
  reusing disposed resources. Source: `src/terrainSandbox.js:150` and
  `src/terrainSandbox.js:248`.

The fixture has no seed-dependent plans, live chunk recentering, worldgen
mutations, water, crowds or venue placement. Its sampler has no RNG dependency.
The live festival does not attach `surfaceSampler`; this is an opt-in test
surface, not a terrain rollout. See the [architecture](../../ARCHITECTURE.md)
and [remaining acceptance](../../ROADMAP.md#terrain-proof-acceptance).

## Verification

`node bin/test-terrain` passed independently interpolated mesh triangles,
unit normals, query-order independence, negative-coordinate and strip-seam
samples, fixture grades, ascent/descent response, downhill coasting, braking,
parking hold, reverse, boundary rejection and 30/60/120 Hz movement agreement.
The recorded fixture replay stopped at Z = −369.9883321867996 meters at all three
cadences, with zero speed. The 20-second constant-slope motor probes returned
17.4246 m/s on level ground, 16.0389 m/s uphill at 15%, and 26.7795 m/s downhill
at 15%. These are controlled model tests, not measured real-vehicle behavior.
Source: [test script](../../bin/test-terrain).

`npm run check` passed with exit code 0, including the new terrain tests and
existing game checks. [Saved output](2026-10-24-check.log). The replay and interpolation regressions also passed independently
([targeted output](2026-10-24-terrain-tests.log)), and
`bin/check-importmaps` passed for all five pages. `git diff --check` passed.

In the Codex in-app browser, **Check wheel contacts** passed on Low, Mid and
High: 96 downward wheel rays across six destinations and four headings, zero
misses, and both mesh height error and nominal contact residual displayed as
0.0000 cm. This is rounded diagnostic output, not a claim of mathematically
zero floating-point error. The button uses Three.js raycasts against the actual
meshes, independent of the sampler's interpolation. Source:
`src/terrainSandbox.js:171` and the captures below. The final expanded check
also exercised 528 off-route support poses, including transition and strip
boundary locations, and passed with maximum nominal contact residual of
0.0121 cm. [Final expanded check](2026-10-24-final-contacts.jpg).

The actual-cart replay reached the level plateau, stopped at 10.0-meter
chassis elevation, and displayed 0.00 cm residual. Orbit view and pause worked
at that destination. [Plateau capture](2026-10-24-plateau.jpg).

| In-app browser capture | Draws | Triangles | Fixture/cart construction |
| --- | ---: | ---: | ---: |
| Low, ascent, [Noon](2026-10-24-low-noon.jpg) / [Midnight](2026-10-24-low-midnight.jpg) | 248 | 139,241 | 35 ms |
| Mid, crest, [Noon](2026-10-24-mid-noon.jpg) / [Midnight](2026-10-24-mid-midnight.jpg) | 246 | 126,039 | 24 ms |
| High, cross-slope, [Noon](2026-10-24-high-noon.jpg) / [Midnight](2026-10-24-high-midnight.jpg) | 242 | 87,635 | 25 ms |

Counts differ with view/frustum and tier. Construction timing covers the course
meshes and cart, not complete page startup, shader compilation or steady-state
frame time. The detailed existing cart makes this proof exceed the provisional
Low/Mid draw budgets; these captures establish rendering, not performance
acceptance. No new shadow casters are enabled (`src/terrainSandbox.js:44`).
Browser warning/error inspection returned no entries during these checks.

A real title-card **Just Cruisin'** click booted the existing game and its
warning/error inspection returned no entries. This checks the default flat
path and module wiring, not iOS audio unlock or terrain integration into the
festival. The existing port-8765 server was reused; no standalone browser or
new server process was started, and temporary game-test tabs were closed. The driving-course tab was retained
as the playable deliverable after Gary began using it.

## Uphill jitter follow-up

Gary reported visible uphill spurts during the first playtest. The original
sandbox rendered whole 120 Hz simulation steps directly. The revised
presentation layer captures previous/current solved poses, interpolates chassis
position/orientation and wheel travel/rotation for the actual render time, then
restores the authoritative physics pose before the next simulation step. The
camera follows the interpolated pose and heading. Pause and tab visibility
preserve the interpolation remainder. Source: `src/terrainSandbox.js:47`.

The targeted regression executes these actual presentation helpers with stubbed
rendering primitives. At constant 17 m/s and a 60 Hz display cadence varying by
±1 ms, the former whole-step presentation showed maximum apparent speed error
of 8.4972 m/s, whereas interpolation reduced it below 1e−7 m/s. It also checks
wheel continuity and that rendering cannot overwrite the next physics step.
This isolates quantization jitter; it is not a measured browser FPS result or
proof against unrelated GPU/CPU stalls. Source: [test and numeric output](2026-10-24-terrain-tests.log).

The revised actual-cart browser replay completed at the level plateau with
zero speed, 10.0-meter elevation, and no warning/error entries. Gary subsequently confirmed smooth driving and reported that the proof plays
well on mobile on October 24. This is human playtest acceptance of the proof,
not a measured phone frame-time or battery result.

## Limits and next decision

The contact diagnostic treats each tire as a nominal radius below its center.
It does not model individual tread lugs, a deformed contact patch, tire camber
or full suspension dynamics (`src/zerble.js:1242`). The authored fixture has
neither lateral sliding nor airborne motion (`src/terrainDriving.js:6`).
The camera's finite segment samples are a practical check for these broad
hills, not a collision guarantee for future sharp terrain
(`src/terrainSandbox.js:150`).

The useful next decision is whether the hill-driving feel is worth carrying
into the festival, and how much grade and downhill momentum Gary wants.
Measured real-phone performance, a flat-versus-terrain frame-time
baseline, loaded passengers/emitter behavior, a whole graded hub, water and
streaming remain unverified. Those are subsequent gates in the original
[proposal](2026-10-24-proposal.md#proposed-acceptance-tests), not implied passes
from this small driving course.

## Phone, boost and sound follow-up

The terrain motor still tapers acceleration toward its powered speed, unlike
the live game’s constant acceleration and clamp. Both use 18 m/s normal and
27.9 m/s boost targets, but the proof approaches those targets gradually and
retains downhill coasting. See `src/terrainDriving.js` and the driving constants
in `src/zerble.js`. The regression in `bin/test-terrain` verifies boost raises
level-ground speed by over 40% and Shift alone does not supply throttle.

The sound button calls the existing `Sound.init()` synchronously in its click
handler and passes speed/boost to `Sound.setEngineSpeed()`. Session mute is
restored on page hiding and teardown without changing saved volume settings.
The in-app browser enabled sound, completed the replay, returned to mute, and
reported no warnings/errors. Physical-iPhone audio unlock and perceived sound
remain device checks. Source: `src/terrainSandbox.js`, `src/sound.js:879`.

For Gary’s requested iPhone playtest, a separate LAN server was started on port
8766 and intentionally left running. The existing loopback server was preserved.
The terrain HTML is now an explicit public game asset in the LAN allowlist,
covered by `bin/test-perf-server`; private project paths remain excluded.
[Phone URL](http://192.168.1.160:8766/terrain-sandbox.html?mute=1),
[QR code](iphone-qr.png). This address requires the same Wi-Fi and may change
when the Mac’s network address changes. The LAN URL loaded successfully in
the in-app browser.
