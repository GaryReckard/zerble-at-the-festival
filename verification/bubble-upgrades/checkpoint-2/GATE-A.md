# Gate A: Heart look review

The Heart renderer and emitter are ready for a visual decision. The Heart uses an owned extruded geometry and a transparent rim shader. It faces the camera while keeping screen-up, wobbles gently, and emits a pooled colored droplet burst. The pink silhouette reads strongly at Midnight and is quieter against the Noon grass. No special type is connected to a game unlock yet; that belongs to Checkpoint 3 after this gate.

## Review images

| View | Low, Noon | Low, Midnight | High, Noon | High, Midnight |
| --- | --- | --- | --- | --- |
| Eleven-type lineup | [image](heart-lineup-low-noon.png) | [image](heart-lineup-low-midnight.png) | [image](heart-lineup-high-noon.png) | [image](heart-lineup-high-midnight.png) |
| Heart stream, chase distance | [image](heart-stream-low-noon-chase.png) | [image](heart-stream-low-midnight-chase.png) | [image](heart-stream-high-noon-chase.png) | [image](heart-stream-high-midnight-chase.png) |
| Heart stream, close distance | [image](heart-stream-low-noon-close.png) | [image](heart-stream-low-midnight-close.png) | [image](heart-stream-high-noon-close.png) | [image](heart-stream-high-midnight-close.png) |

The larger [single Heart at Noon](heart-single-low-noon.png) and [single Heart at Midnight](heart-single-low-midnight.png) show the shell beside an ordinary bubble. The [Heart pop](heart-single-low-pop.png) shows the colored droplets immediately after clicking “Pop Heart.” The static Heart stays in the sandbox as a shape reference while that burst plays.

## Reproduce in the entity sandbox

- Full lineup: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&perf=low&mute=1` (change `perf=low` to `perf=high`).
- Focused Heart and “Pop Heart” button: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&focus=heart&perf=low&mute=1`.
- Live Heart stream, forced type and “Unlock burst” button: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=heart&perf=low&mute=1` (change `perf=low` to `perf=high`).

Use the Noon and Midnight buttons, then Close and Chase distance. The captures were made from cold page loads with `mute=1`. The sandbox page reported no console errors on Low or High, including the shader. The main game also reached its title screen on Low with no page console errors after the new module import.

## Technical evidence and limits

- `npm run check` passed on 2026-10-15; [full output](npm-run-check.txt) includes the unchanged bubble pop and visibility checks, special emission and pool checks, kid spacing checks, and the four-page importmap check.
- The isolated stream screenshots showed roughly 7–8 draws at chase distance, with the exact triangle count varying as bubbles came and went. This is a sandbox observation, not a full-game performance measurement.
- The visual decision is pending Gary's approval. The full lineup intentionally fits eleven types in one row, so the focused and stream images are the useful Heart detail views.
