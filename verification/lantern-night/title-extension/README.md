# Extended title scene and original bubble plume

November 15, 2026. Gary requested extended sky, mountains, festival and foreground art, keeping Zerble and the gate intact and retaining parallax. He also requested the earlier bubble sizes, paths and timing, rising behind Zerble.

## Artwork and registration

The built-in `image_gen` tool generated four scenery extensions and corrected the foreground's initial pale alpha haze. [Exact prompt set](prompts.md). The shipped files are sibling assets, so the original artwork remains available:

- [Sky extension](../../../assets/title-screen/layer-sky-extended.webp)
- [Mountain extension](../../../assets/title-screen/layer-mountains-extended.webp)
- [Festival extension](../../../assets/title-screen/layer-festival-extended.webp)
- [Foreground extension](../../../assets/title-screen/layer-foreground-extended.webp)

The generator returned 1672×941 images with a broader field of scenery, rather than the requested larger pixel canvas. Each is drawn at 150% of its original layer's rectangle, with a masked central opening. The original four images still supply the central composition. The foreground replaces the upper canopy as a coherent whole, while its original lower core supplies Zerble; the original festival core supplies the gate. Feathered joins avoid a rectangular seam between old and new scenery. Generated versions of the vehicle/gate are excluded by the masks rather than trusted as replacements.

[Asset provenance](assets.json) records every original file's SHA-256 and equality with Git HEAD, each generated source filename, shipped dimensions/bytes and exact preservation of generated alpha during WebP export. The four added images total **1,851,774 bytes** (about 1.8 MiB), using `cwebp -q 95 -alpha_q 100 -m 6`; original artwork files are unchanged. Masks are in [extension-mask.svg](../../../assets/title-screen/extension-mask.svg) and [foreground-extension-mask.svg](../../../assets/title-screen/foreground-extension-mask.svg).

## Framing and movement

[titleScene.js](../../../src/titleScene.js) initializes the production title and renderer-free menu fixture. The 1280×720 composition can show scenery outside its original bounds, with a 20px motion allowance. Adaptive uniform scale and centering keep the original gate/vehicle area visible on taller tablets and very wide displays. A tablet-width logo cap also prevents overlap with hanging navigation.

Each original/extension pair shares one animated parent, so independently timed sky, mountain, festival and foreground movement cannot separate an extension from its original. The parent stacking order is sky 0, mountains 1, festival 2, bubble plume 3, foreground 4, readability shading 5. Bubbles therefore remain behind both the original vehicle and the foreground's surrounding scenery.

The bubble setup and `title-puff` keyframes restore Git HEAD's pre-Lantern Night values: two passes of 12 sprites, widths 14–34 design pixels, durations 7.5–13 seconds, deterministic horizontal/vertical jitter, half-period staggering and the curved path from (0,0) through (-120,-200) to (-122,-560). Neither setup consumes gameplay randomness. Both system and game Reduced motion stop title animations and hide decorative bubbles. Hidden title animations pause after starting the game.

## Verification

[test-title-scene](../../../bin/test-title-scene) checks 16:9, 16:10, 4:3, 21:9, 32:9, portrait-tablet and phone-landscape framing against painting/subject bounds, original sprite sizes/stagger, resize behavior and cleanup. It is included in `npm run check`.

The [gallery](gallery.html) contains the final browser captures. [Browser observations](browser-observations.json) record loaded assets, actual layer transforms/stacking and observed subject bounds. [Full checks](check.log) and [production build](build.log) record final command results. Full-width ultrawide screenshots use 1920×810 and 1920×540 because the capture surface cropped higher-resolution viewport captures; the 3840×1080 DOM subject bounds remain recorded separately. Final screenshot dimensions are in [screenshots.json](screenshots.json). Live game captures use `mute=1`, start through the ready Just Cruisin' button, and include Noon/Midnight. The real-game [startup/animation/console observation](live-game.json) confirms all eight images loaded, 24 sprites below the foreground, hidden title/bubble animations paused after start, and no observed console errors. The Reduced motion switch hid every bubble and disabled all four layer animations, then was restored. The renderer-free fixture uses the same title initializer as production; it is visual evidence, not a replacement for the real-game smoke test.

## Reproduce and limits

With the already-running Vite server, open `/menu-preview.html?mute=1` for inexpensive title inspection or `/?mute=1` for the real title and game. Compare 1280×720, 1440×900, 1440×1080, 2560×1080, 3840×1080, 1024×1366 and 844×390. Use Settings → Accessibility → Reduced motion, then restore its initial value. Start normally and inspect the hidden title's animation play state.

Desktop browser viewport coverage does not establish physical iPad/Safari GPU performance or audio behavior. Eight decoded image layers have a theoretical RGBA pixel payload of about 48 MiB, roughly 24 MiB more than the original four images, before browser-specific caching/compositing overhead. This is an asset-memory estimate, not a measured device budget. Original world rendering, gameplay and the synchronous audio-unlock callback are unchanged. Task-owned browser tabs are closed after verification; Gary's requested development server remains running.
