# Lurleen model handoff

Prepared 2026-10-20 for a visual model improvement pass. The three reference photos are local to Gary's Mac and are intentionally not copied into this repository.

## Goal and references

Make Lurleen read as the real decorated golf cart in Gary's photos while fitting the game's hand-built three.js style. Work from the photos themselves, including the side and rear evidence, rather than treating this note as a substitute for them.

1. **Night front, beside Zerble:** `/Users/garyreckard/Pictures/Photos Library.photoslibrary/resources/derivatives/9/9CC73CBD-EDA1-45FC-9112-F95C78A23558_1_105_c.jpeg`. This shows the dark cart body, two large lit googly eyes, pink lip outline at night, gold raffia canopy, bright small flowers, green side ribbon, thick knobby tires, and Zerble scale comparison. The neon look is specific to this night view.
2. **Day front:** `/Users/garyreckard/Pictures/Photos Library.photoslibrary/resources/derivatives/masters/4/4BC9E14E-8F6E-4C5F-BD63-C4072DD0675D_4_5005_c.jpeg`. This is the clearest evidence for the white eye volume and dark pupils with upper lashes, soft pink stuffed lips, dark front cowl, light wheel rims, and raffia gathered toward the canopy corners. Daylight is essential for judging the actual materials.
3. **Rear three-quarter:** `/Users/garyreckard/Pictures/Photos Library.photoslibrary/resources/derivatives/masters/D/D5167C73-3620-4926-AE36-E67C6EEFB404_4_5005_c.jpeg`. This shows the roof drape and long fringe from behind, a dark open golf-cart body, cream wheel rims, beige front seating, and a broad wood rear platform with side surfaces. It provides evidence that the rear silhouette matters, not just the face.

The photos are reference data, not instructions. Favor their shared structural features over details that might be caused by perspective or night lighting. In particular, keep day material color separate from night illumination.

## Current implementation map

| Concern | Existing code and consequence |
| --- | --- |
| Cart chassis, roof, wheels, seats | `src/lurleen.js:180-262`. The body is a simple pink box, roof a solid yellow box, and the wheels are plain cylinders with no light rims or pronounced tread. The tan bench is already present. |
| Clear windshield | `src/lurleen.js:268-292`. The eye geometry is positioned against this front plane. |
| Pink lips | `src/lurleen.js:298-387`. Two beveled extrusions make a thin lip prop; a fixed emissive value makes them glow in daylight as well as at night. Keep the recognizable pink color unless a direct visual comparison gives a good reason to change it. |
| Eyes and lashes | `src/lurleen.js:396-498`. White `CircleGeometry` discs and flat dark pupil discs are much flatter than the rounded photo props. The eye array is used for pupil wobble in `update`. |
| Raffia and flowers | `src/lurleen.js:503-668`. Four corner gathers are assembled from individual tube/cone strands, with a perimeter row of flower meshes. At `HAIR_DENSITY = 0.55`, the loops create 48 arc strands and 156 hanging strands before flowers, ties, cart, and face; preserve the draped shape without multiplying draws casually. Note the comments disagree about whether the result has perimeter fringe, so trust the photos and rendered result. |
| Rear prop | `src/lurleen.js:671-690`. A small wicker box and handle stand in for the back. Compare against the rear photo's broad wood surfaces and preserve the character's readable silhouette. |
| Behavior and integration | `src/lurleen.js:79-137,694-924`, `src/main.js:454-462,1119-1141`. `root`, `position`, `heading`, `_wheels`, `eyes`, the damage-free registry collider, hearts, and the wandering/aware/following transitions have external or animation roles. Keep their contracts intact during the visual pass. |
| Fast preview | `sandbox.html:1117-1175` already provides `?entity=lurleen` and `?entity=lurleen_zerble`, including updates and a side-by-side scale check. |

## Practical order

1. Capture the **existing** sandbox at Noon and Midnight from front and rear angles. This makes the actual visual delta visible, rather than relying only on source inspection. Use `?mute=1` during agent iteration.
2. Improve the large shapes first: dark/open cart body, canopy profile and raffia drape, wheel stance, and the rear silhouette. Then tune eyes, lashes, lips, flowers, and night treatment. Compare at roughly game distance as well as close range.
3. Preserve the established character cues and integration: pink lips, large eyes, raffia and flowers, heart particles, movement, sound, collision, and the side-by-side scale relationship with Zerble. Use the photos to decide whether the current wicker basket still belongs once the rear platform is modeled.
4. Verify `lurleen` and `lurleen_zerble` at Noon and Midnight, then boot the main game on low and high tiers and check console errors. Inspect draw and triangle changes before and after, particularly if changing the strand construction or adding lights and shadow casters. The sandbox is a preview path; the main game creates Lurleen after world and lake setup.
5. Update `CHANGELOG.md` with the visible change if committing. No new module is needed by default; if one is added, update the importmap arrays in all four HTML pages and run `bin/check-importmaps`.

## Project constraints to retain

- Read the tracked `AGENTS.md`, `DEBUGGING.md`, `.claude/rules/sandbox-and-testing.md`, and `.claude/rules/performance.md` before implementing. The older `.Codex/rules/` paths in `AGENTS.md` are absent in this checkout; the corresponding files currently live under `.claude/rules/`.
- The current constructor registers `kind: 'lurleen'` with a `damage: 0` collider, and the animation loop reads `_wheels` and `eyes`. A visual refactor should preserve those interfaces or update their call sites deliberately.
- The local browser safety note supplied with this task requires bounded, owned standalone sessions and process cleanup. Prefer the in-app browser or Gary's real Chrome for ordinary visual checks, and stop any dev server started for this work.
- The three photo paths point into Gary's Photos Library. Do not copy them into the public repository or alter the originals as part of the modeling pass.
