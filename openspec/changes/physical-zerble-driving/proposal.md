## Why
Zerble follows terrain height rigidly, so new ridges cannot launch him and water remains an invisible barrier. Physical vehicle motion should make terrain, traction, engine effort and water depth meaningful while preserving forgiving controls.

## What Changes
- Dynamic Rapier chassis and four raycast wheels, continuous ground/air motion, suspension, stable landings and recovery.
- Grass, dirt, asphalt, bridge and creek driving profiles, actual three-dimensional velocities and throttle/load driven sound.
- Shared water depth and lake-bed geometry, shallow crossings, drag and terminal submersion through the existing score screen.
- Impact severity damage meter and terminal damage, with future restoration API but no repair shop.
- Bounded player collision residency, physics ownership and passenger/camera integration.
- Repeatable driving course and regression coverage before live integration.

## Capabilities
### New Capabilities
- `physical-driving`: physical player vehicle, terrain profiles, engine feedback and water consequences.
### Modified Capabilities
- `carts`: dynamic motion replaces ground-pinned vertical/arcade integration requirements while preserving input and person-immunity contracts.

## Impact
Touches player/model transforms, physics adapter/lifecycle, streaming, landscape/water, audio, run endings, crowd passengers and harness. Uses installed Rapier 0.21.0; no new dependency. Risks: boot readiness, lake ownership, bounded CPU preparation, iOS audio initialization. Keep synchronous Sound.init and existing RNG streams; no new lights or shadow casters. AGENTS.md supersedes historical importmap/no-build text in schema context: Vite is current.

## Scope Check
Checked Zerble, Lurleen, nut wagon and one-wheels. Only Zerble becomes dynamic; autonomous vehicles retain their movement owners. Lake/stream query and geometry changes remain shared truth, while pedestrians retain dry-ground admission. Existing run-end, leaderboard and passenger paths are in scope for compatibility. No vehicle damage economy, cargo ejection or new procedural RNG draws.
