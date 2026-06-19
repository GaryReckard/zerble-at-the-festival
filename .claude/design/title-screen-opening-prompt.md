# Claude Design brief — new opening / title sequence

A copy-paste prompt for **Claude Design** to mock up a brand-new opening
sequence for *Zerble at the Festival* — replacing the current translucent
blurred title panel that floats over the live 3D scene (with the HUD bleeding
through behind it) with a self-contained, retro-console-style multi-screen
opening.

> **Attach `assets/zerble.png`** (the hero character) when sending the prompt.

---

## The prompt

```
I'm building a no-build browser video game called "Zerble at the Festival"
(subtitle: "A Bubble Adventure"). I want you to design a brand-new OPENING
SEQUENCE — the boot/title experience a player sees before gameplay starts.

Go wide and be creative. I'm giving you the world, the palette, and the
constraints, but the look and the number/flow of screens are yours to invent.
Surprise me.

== WHAT THE GAME IS ==
You drive Zerble — a smiling, mustachioed golf cart — through an endless,
procedurally-generated music festival. You trail bubbles past dancing crowds,
drum circles, food trucks, brass bands, and giant puppet parades. The crowd
sees your glowing eyes and your bubbles, and they smile — and the smiles fly
to you like tiny suns. There's a full day->night cycle (dawn, noon, dusk,
midnight), autumn forests, lakes, mountains on the horizon, tiki torches and
stage lights after dark. Somewhere out there is Lurleen, a shy second cart
with pink lips and raffia hair and a basket of flowers; get close and the air
fills with hearts.

Vibe: warm festival evening, indie-game-made-with-love, a little psychedelic,
big-hearted and silly. NOT gritty, NOT corporate.

Tagline (keep it, it's calibrated): "Bring the bubbles, collect the smiles"

== THE HERO CHARACTER (see attached image) ==
Zerble is a chunky red four-wheeled cart with a pink/magenta canopy roof, a
GIANT curly purple handlebar mustache, big blue googly eyes, fat black tires,
and a trail of little bubbles. Bold black outlines, sticker/cartoon art style.
He should be the star of the title screen. Feel free to reinterpret him as a
sprite/pixel-art version if the aesthetic calls for it, but keep him
recognizable: red body, pink roof, purple mustache, googly eyes, bubbles.

== THE BRIEF ==
I want an opening like an old-school NES/SNES cartridge game — think a
multi-screen boot sequence, not a single static menu. Something with the
ceremony of a classic console game: maybe a publisher/logo flash, an animated
title reveal, an attract-mode or story intro, a blinking "PRESS START" prompt
— whatever sequence you think gives it that hit of nostalgia. BUT the final
polish bar is modern: it should feel like the opening of a high-quality,
lovingly-made game, not a cheap pastiche. Retro structure, premium finish.

It should feel UNIQUE — not a generic "insert coin" template. Lean into
Zerble's specific world: bubbles, festival lights, mustache, smiles, the
warm-night palette.

== WHAT I'M REPLACING (the thing I dislike) ==
Right now the title is a translucent, blurred panel floating over the live 3D
game scene, with the gameplay HUD faintly visible behind it. It looks
unfinished and it leaks the game's UI. The new opening must stand entirely on
its own — fully opaque, self-contained, no dependence on anything rendered
behind it. It's a proper front door, not a frosted overlay.

== PALETTE & TYPE (from the live game — use as your starting point) ==
- Deep purple-black background / ink:  #1c1330  and  #1a1430
- Cream "paper":  #fff6e6
- Warm gold:  #ffd28a
- Hot pink:  #ff6f9c
- Festival purple:  #b285ff
- Leaf green:  #6fcf6a
- Bubble-juice cyan:  #43c9f0 -> #9af1ff -> #aef0ff
- The current title wordmark uses a gold->hot-pink->purple gradient
  (135deg, #ffd28a -> #ff6f9c -> #b285ff). You can keep that energy or evolve it.
- Current body font is Trebuchet MS; for this retro brief a chunky
  pixel/arcade display face (e.g. a Google-Fonts pixel font) is probably right
  for headers, but that's your call.

== DELIVERABLE ==
Build it as a self-contained, interactive HTML/CSS prototype I can open in a
browser and click through (the real game is plain ES modules + CSS, no build
step, no framework — so vanilla HTML/CSS/JS, with web fonts from a CDN, is
ideal; it needs to be able to drop into the actual game later). Make the screen
transitions and the "press start" interaction actually work so I can feel the
flow. Include a short note on the concept and why you made the choices you did.

Show me a couple of directions if you have them. Have fun with it.
```

---

## Notes for implementation (not part of the prompt)

These are for us when we wire the result into the real game — context Claude
Design doesn't need.

1. **Keep a hidden rendered-scene path for perf tuning.** The current opening
   is coupled to the live scene (it's a blur over the running game). Decoupling
   the new opaque title from the 3D canvas is a small free perf win — while the
   title is up we don't need the world rendering at full tilt. We can preserve
   the old blurred-scene reveal behind a URL flag / debug toggle purely for
   performance work, hidden from players.

2. **There's an existing 2D->3D hand-off to preserve or replace.**
   `index.html` (~line 209) hands the title card off to a 2D `zerble.png`
   cutout lined up over the real 3D model, cross-dissolves to the actual cart,
   then the camera orbits into chase view. Nice "2D-to-3D" reveal moment.
   Decide whether the new multi-screen opening *ends* on that same hand-off
   (continuity into gameplay) or replaces it. Left out of the prompt to avoid
   over-constraining the design; add it as an explicit ending beat if we want
   Claude Design to design toward that transition.

3. **iOS audio gesture.** Whatever becomes the final "start" interaction must
   keep `Sound.init()` firing synchronously inside the user gesture — see
   CLAUDE.md tripwire #3. The retro "PRESS START" beat is a natural home for it.
```
