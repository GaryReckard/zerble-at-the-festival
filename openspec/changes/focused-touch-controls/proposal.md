## Why

The working touch controls give low-frequency actions the same weight as driving,
require a narrow initial stick target, and preserve camera offsets that compete
with right-thumb actions. Gary approved a focused layout, forgiving joystick,
compact menu and gentle driving camera return after bounded Astra review.

## What Changes

- Prioritize Brake/Honk/Boost, retain contextual Park, and move camera/music plus
  Passport/Bubbles/Settings into one paused touch menu. Preserve desktop launchers.
- Accept lower-left game-canvas touches as floating-stick starts while retaining
  the visible stick over the non-modal map and preserving finger ownership.
- Return touch-orbited chase offsets gently during sustained forward driving,
  never while stopped/parked/reversing or manipulating the camera. Preserve mouse,
  arrow, first-person, top-down, zoom, intro and debug camera ownership.
- Consolidate conflicting map/control CSS and verify actual combined layout.

## Capabilities

### New Capabilities
- `focused-touch-play`: contextual layout, paused touch-menu navigation and touch
  camera assistance.

### Modified Capabilities
- `input-controls`: expanded virtual-stick activation and gesture ownership.

## Impact

Input/touch, camera, main pause/action callbacks, menu modules, CSS, previews and
regression fixtures. No worldgen/RNG, physical vehicle changes, geometry, shaders,
resource disposal, iOS audio-unlock chain or new dependencies.

## Scope Check

Inspected touch.js/input.js/camera.js, main.js, menuUi.js and the three existing
sheet lifecycles. festival-map.css overrides button geometry and must stop doing
so. Include map preview and renderer-free controls fixture; preserve desktop and
the earlier uncommitted brake implementation. No on-foot work or unrelated
verification/site-promo changes.
