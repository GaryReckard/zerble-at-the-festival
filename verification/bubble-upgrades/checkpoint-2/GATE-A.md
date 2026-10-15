# Gate A: Heart look review

The Heart renderer and emitter are ready for a visual decision. The Heart uses an owned extruded geometry and a transparent rim shader. It faces the camera while keeping screen-up, wobbles gently, and emits a pooled colored droplet burst. The pink silhouette reads strongly at Midnight and is quieter against the Noon grass. No special type is connected to a game unlock yet; that belongs to Checkpoint 3 after this gate.

Gary's first review asked for more translucent shells and for some types to carry a visible feature inside the bubble rather than relying on color alone. The revised shader lowers the core and rim alpha, then draws four inner motifs without another mesh, draw call, light, or texture. Ember contains a warm coal with drifting flecks, Firefly has a blinking green light, Sparkler carries a white-gold spark, and Lantern encloses a lit paper core. The other types remain design work for Checkpoint 4. This revision still needs Gary's visual approval.

## Review images

| View | Low, Noon | Low, Midnight | High, Noon | High, Midnight |
| --- | --- | --- | --- | --- |
| Eleven-type lineup | [image](heart-lineup-low-noon.png) | [image](heart-lineup-low-midnight.png) | [image](heart-lineup-high-noon.png) | [image](heart-lineup-high-midnight.png) |
| Heart stream, chase distance | [image](heart-stream-low-noon-chase.png) | [image](heart-stream-low-midnight-chase.png) | [image](heart-stream-high-noon-chase.png) | [image](heart-stream-high-midnight-chase.png) |
| Heart stream, close distance | [image](heart-stream-low-noon-close.png) | [image](heart-stream-low-midnight-close.png) | [image](heart-stream-high-noon-close.png) | [image](heart-stream-high-midnight-close.png) |

The larger [single Heart at Noon](heart-single-low-noon.png) and [single Heart at Midnight](heart-single-low-midnight.png) show the shell beside an ordinary bubble. The [Heart pop](heart-single-low-pop.png) shows the colored droplets immediately after clicking “Pop Heart.” The static Heart stays in the sandbox as a shape reference while that burst plays.

## Revised still previews, Low tier

| Type | Noon | Midnight |
| --- | --- | --- |
| Heart, clearer shell | [image](revision-heart-still-noon-low.png) | [image](revision-heart-still-midnight-low.png) |
| Ember, glowing coal | [image](revision-ember-still-noon-low.png) | [image](revision-ember-still-midnight-low.png) |
| Firefly, green inner light | [image](revision-firefly-still-noon-low.png) | [image](revision-firefly-still-midnight-low.png) |
| Sparkler, white-gold spark | [image](revision-sparkler-still-noon-low.png) | [image](revision-sparkler-still-midnight-low.png) |
| Lantern, lit inner core | [image](revision-lantern-still-noon-low.png) | [image](revision-lantern-still-midnight-low.png) |

High-tier checks: [Heart at Noon](revision-heart-still-noon-high.png), [Heart at Midnight](revision-heart-still-midnight-high.png), and [Firefly at Midnight](revision-firefly-still-midnight-high.png). The shader compiled without browser errors on both tiers.

The still view is a look preview at size 2.5, so it is easier to inspect the motif than the moving trail. The [full game after starting on Low](revision-game-boot-low.png) confirms the edited module loads through the main game path; specials still require the future unlock integration. In this revision the sandbox's still view submitted three draws and reported no browser errors. The full game also reported no browser errors after entering the world.

## Reproduce in the entity sandbox

- Full lineup: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&perf=low&mute=1` (change `perf=low` to `perf=high`).
- Focused Heart and “Pop Heart” button: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&focus=heart&perf=low&mute=1`.
- Live Heart stream, forced type and “Unlock burst” button: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=heart&perf=low&mute=1` (change `perf=low` to `perf=high`).
- Revised still look: `http://127.0.0.1:8765/sandbox.html?entity=bubbles_special&type=firefly&view=still&perf=low&mute=1` (replace `firefly` with `heart`, `ember`, `sparkler`, or `lantern`).

Use the Noon and Midnight buttons, then Close and Chase distance. The captures were made from cold page loads with `mute=1`. The sandbox page reported no console errors on Low or High, including the shader. The main game also reached its title screen on Low with no page console errors after the new module import.

## Technical evidence and limits

- `npm run check` passed on 2026-10-15; [full output](npm-run-check.txt) includes the unchanged bubble pop and visibility checks, special emission and pool checks, kid spacing checks, and the four-page importmap check.
- After the translucency and inner-accent revision, `npm run check` passed again; [revision output](revision-npm-run-check.txt) includes the accent catalog and instance-style assertions.
- The isolated stream screenshots showed roughly 7–8 draws at chase distance, with the exact triangle count varying as bubbles came and went. This is a sandbox observation, not a full-game performance measurement.
- The visual decision is pending Gary's approval. The full lineup intentionally fits eleven types in one row, so the focused and stream images are the useful Heart detail views.
