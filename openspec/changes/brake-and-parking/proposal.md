## Why

Reverse is ambiguous when stopping for a passenger, and ordinary hills need a
physical brake hold. Gary approved dedicated braking and parking after planning
commit `65f1b0c` was pushed.

## What Changes

- **BREAKING:** Space brakes, E honks; touch Brake replaces Slow. Keep Shift
  boost, Ctrl keyboard precision, B/H specific horns and W/S forward/reverse.
- R and a separate touch Park toggle latch finite physical braking near a
  supported stop. Fresh throttle releases parking after neutral qualification.
- Show persistent parking status and reject moving/airborne parking requests.
- Keep legacy driving and diagnostic input coherent; add native physics and
  input/lifecycle tests plus real-game verification.

## Capabilities

### New Capabilities
- `vehicle-braking`: contact-limited service braking and fresh-throttle parking.

### Modified Capabilities
- `input-controls`: brake/honk/park bindings and touch controls.

## Impact

Input, touch, main-loop drive adaptation, HUD, physical/legacy driving, driving
fixture, docs and checks. No new dependencies, geometry, RNG, world ownership,
material/render policy, audio initialization or asynchronous boot changes.
Player-visible behavior requires CHANGELOG and ROADMAP updates.

## Scope Check

Searched input.js/touch.js, main.js, zerble.js, terrainDriving.js,
physics/playerVehicle.js and playerDrivingSandbox.js. Include live physical and
legacy paths; keep authored terrain-sandbox R reset local to that fixture.
Update touch fixtures/preview markup using the same controls and honk edges.
Do not implement on-foot play or passenger vignettes in this change.
