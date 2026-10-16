# Wook model refresh

The supplied photograph guides the oversized dreadlock silhouette, brown headband,
sleepy expression, beard and striped Baja hoodie. The model also has drawstrings,
a pouch pocket, cropped trousers, sandals and a few hair beads. It remains a
stylized festival character facing negative Z, with its animated group at child 0.

## Verification, 2026-10-15

- [Real Three.js checks](check.html) passed for all five variants in the in-app browser: finite vertices and animated transforms, shared geometry/material tags, identical resources across repeated builds, deterministic phases, supplied RNG consumption, bounds and controller-transform ownership.
- Each variant has 4 meshes, 7,984 triangles and 2 shadow casters, with a height of 2.62–2.64 m. Templates are bounded to five variants.
- The sandbox HUD reported 123 draws / 3,824 triangles before the edit and 6 draws / 8,032 triangles afterward. These are isolated scene counts, not whole-game FPS measurements; the old model is randomized.
- [Noon](noon.png), [Midnight](midnight.png) and [Low-tier noon](low.png) were visually checked. The midnight character stays dark without emissive clothing or added lights.
- The [low-tier main game](game-low.png) displayed its title card and booted through the start button into an advancing world, with juice consumption and smiles. Captured console warnings/errors were empty, as were the sandbox's.
- `node --check src/models/wook.js`, `bin/check-importmaps` and `git diff --check` passed.

## Reproduce

Use the existing no-cache server, then open `/sandbox.html?entity=wook&mute=1`.
The default camera now faces the character. Use the Noon/Midnight controls and
add `&perf=low` for the lower tier. Open `/verification/wook/check.html` for the
actual-builder checks; no automated browser process is required.

The existing server was reused. Verification tabs were closed, and no standalone
browser or development-server process was launched for this task.
