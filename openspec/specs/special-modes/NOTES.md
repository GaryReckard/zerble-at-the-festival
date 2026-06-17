# Special modes — internal notes (do NOT leak to players)

These two systems are **discovery content**. Keep them out of the README, the title
card, and any player-facing copy (the project's tone rule). They're documented here for
agents only.

## The trip (Wook dose)

- **Trigger:** park the cart near a wook NPC for ~5 continuous seconds. The wook offers
  a dose (`Trip.onOffer` → a HUD prompt wired in `main.js`). Accept with **Y** / tap the
  prompt; decline by driving off.
- **What it does:** ramps in a full-screen `ShaderPass` (`trip.js`) — lens distortion,
  ripple, chromatic aberration, hue shift, saturation, posterize, brightness + vignette
  pulse — over `fadeIn`, sustains for `duration` (default ~180s), fades out. The
  envelope also swells the MIDI player's long reverb + granular (`midiPlayer.js`).
- **Debug:** the **T** menu exposes per-effect intensity sliders + a "Dynamic Trip"
  toggle (`Trip.dynamic`). The pass disables itself at envelope 0 (perf gating).
- **Do not** surface the trip in the entity sandbox — it's gated behind the hidden wook
  interaction (`sandbox-and-testing.md` "What goes in the sandbox vs. what doesn't").

## Star power

- **Trigger:** a glowing star spawns on a long cooldown out near the player; drive into
  it (`starPower.js`).
- **What it does:** a 15s buff (`DURATION`) — ghost mode (drive through obstacles),
  silvery-rainbow cart recolor (idempotent `onBeforeCompile` patch), streaming sparkles
  + rainbow tire-tracks, a beam, an ending blink, and NPCs within `LOVE_RADIUS` (25m)
  fall in love. It **stacks** the trip. A warm-gold HUD vignette shows while active
  (`HUD.setStarPower`).
- **Sandbox:** `buildStarPreview()` provides a scene/registry-free star + pillar for the
  entity sandbox (the buff envelope itself is game-only).
- **Design doc:** `.claude/star-power-design.md`.
