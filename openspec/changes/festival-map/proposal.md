## Why

Players need to recognize and revisit places in the infinite festival, and future passenger missions need a common destination display. Build the reviewed discovery-based map without interrupting driving.

## What Changes

- Add a persistent minimap with a smooth translucent expanded view, centered zoom, continued driving, and mobile controls above the map.
- Persist discovered terrain and actual landmarks per world; reveal mission pins without revealing terrain.
- Show nearby live friends and pickups; select existing destinations and show directional boundary pins scaled by distance.
- Add a saved minimap preference and migrate music from M to a separate action without breaking its touch button.
- Add a lightweight harness, meaningful regression tests, and bounded rendering/generation/persistence diagnostics.

## Capabilities

### New Capabilities

- `festival-map`: discovery, persistence, geographic rendering, live markers, objective pins, centered navigation and lifecycle.

### Modified Capabilities

None. Existing HUD remains in place; the new capability defines the map controls and music migration explicitly.

## Impact

Player-visible HUD/input/settings additions require CHANGELOG and controls documentation. Sources: new src/festivalMap modules, main.js, input.js, settings.js, CSS, harness entry, package checks. No new runtime dependency. Touches module boot and live world observation; never mutates generator data, RNG, 3D ownership, materials, or audio initialization. Current AGENTS.md Vite rules supersede historical no-build OpenSpec context.

## Scope Check

Searched existing input/touch, settings, Passport overlay, registry indexing, worldgen region queries, and map-sandbox rendering. Reuse map generator truth but retain the developer map sandbox independently. Passport pauses gameplay, so its modal behavior is excluded from the live map. Include both keyboard and touch music action migration. Registry IDs are runtime-only; geographic identity is separate. No new model or Three.js render pass is introduced. Mission assignment/routing and arbitrary waypoint creation remain outside scope.
