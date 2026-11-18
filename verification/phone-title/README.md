# Touch title and iPhone rotation, November 18, 2026

## Report and isolation

Gary reported that rotating a fresh load of the published game into landscape
on an iPhone 14 Pro Max/iOS 26.6.1 briefly showed a cramped title, followed by
Safari's repeated-problem error. Both a Safari tab and a Home Screen launch were
affected. The title-only comparison page also crashed once, then remained stable
after reloading. Its persistent “Pressurizing the bubble tank” text is intentional:
`menu-preview.html?screen=loading&mute=1` holds that state without starting a world.

This demonstrates that the 3D game is not required to trigger the reported
failure. It does not identify the browser crash mechanism. Cold-start decoding
or compositing pressure is a hypothesis, not a confirmed Safari crash diagnosis.
No physical-device crash log was available.

## Delivered changes

- [HTML picture sources](../../index.html) select 1-pixel inline placeholders
  for the four extension images on coarse-pointer devices. The four original
  paintings remain; [touch styling](../../lantern-ui.css) removes their masks
  and background animation. The decorative plume is not allocated, and the logo
  lights are hidden on this path.
- [Original-art framing](../../src/titleScene.js) crops within the authored
  1280×720 composition without needing extended scenery. Desktop framing and its
  original 24-sprite plume remain.
- Short landscape screens use a full-width mode/name panel beneath the logo.
  Secondary actions use a native details/summary Menu with a bounded scrollable
  list. Escape dismisses the menu, and changing out of compact layout restores
  visible desktop navigation. Resize, media and key listeners are disposed.
- The local-only [fixture probe](../../src/menuPreview.js) captures actual DOM
  facts through the existing loopback capture middleware. It is not a player
  feature and performs no upload on the published site.

The old eight large sources total roughly 48 MiB of theoretical decoded RGBA
pixels, excluding the logo and browser overhead. Selecting four originals halves
that particular pixel payload to roughly 24 MiB, while removing masked moving
surfaces. These are asset-size calculations, not measured process memory or proof
that memory exhaustion caused the crash.

## Native simulator evidence

The installed runtime was iOS 27.2, not Gary's iOS 26.6.1. An existing, previously
shut-down iPhone Pro Max simulator was booted and controlled through Xcode's
Device Hub. The published comparison page eventually loaded after rotation
without reproducing the reported crash. This single observation does not
establish stability or exact-version behavior.

The revised local page was inspected in that native Safari. The
[captured DOM report](simulator-landscape.json) establishes:

- A coarse-pointer 832×376 viewport.
- Four extension sources selected inline placeholders with natural width 1.
- Four visible original images, each 1672×941, with no masks or animations.
- Zero plume sprites; a closed compact menu and an 808px-wide primary panel.
- The native Menu opened with the secondary actions visible, then closed.

Device Hub's window became unavailable during the subsequent rotation attempt,
so that attempt is **not** recorded as a passed rotation test or as a Safari
crash. The task-owned iPhone simulator was shut down. The pre-existing TV
simulator was left running and no TV controls were operated.

The Vite session also logged one module-import failure during live edits before
the successful local probe and menu observation. This was not reproduced in the
subsequent real-game check; native cold-start/error-free behavior is not claimed.

## Desktop checks and limits

The production-class tests cover original-only crop bounds in portrait and
landscape, zero touch plume allocation, menu initialization, Escape/focus return,
orientation-driven menu reset and listener cleanup. Existing desktop sprite and
framing regressions also pass.

At 568×320, both modes were simultaneously visible in the compact fixture,
secondary actions were available through its scrolling Menu, and Escape returned
focus to Menu. [Compact layout](compact.jpg) was captured in the desktop in-app
browser, which does not exercise the coarse-pointer artwork selection.

The real Low game was started through an enabled mode plank at 852×393 with the
localhost touch-layout override and session mute. The [ready title](ready-title.jpg),
[Noon game](game-noon.jpg) and [Midnight game](game-midnight.jpg) were captured;
no browser console errors were recorded. A 1080×746 desktop fixture retained
open navigation, no logo/menu intersection and its 24 plume sprites. These
checks establish integration and desktop behavior, not physical-phone stability.

`npm run check`, `npm run build`, focused title/menu tests and `git diff --check`
passed locally. Owned in-app browser tabs were closed and viewport overrides
reset. The local server is stopped when the release checks finish.

The physical iPhone crash remains an acceptance item until Gary can freshly
load the updated main page, rotate it and enter a playable mode. Neither the
newer simulator nor desktop checks can close that item.
