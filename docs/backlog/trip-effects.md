# Trip effects backlog

[Documentation index](../README.md) · [Roadmap](../../ROADMAP.md)

This record preserves dated investigations and design decisions. Shipped slices
are context, and unchecked or parked work is not a new implementation request.
Verify source anchors against the current code before resuming. Commands assume
the repository root.

### Tier contract for new trip effects *(decided 2026-09-01)*

Gary's call, and it settles the scope question the backlog below kept deferring:
**the new effects are a high/mid luxury, and `low` must never be worse than it
is today.** Low keeps the eight in-shader effects it already has, at their
current cost. A new in-shader effect may be enabled on low only once a
frame-time A/B on `?perf=low` shows it does not regress; the feedback-buffer
effects (#5, #6) default OFF on low regardless. This is why the whole backlog
splits cleanly at the in-shader / feedback-buffer fork.

### Phase 0 harness — SHIPPED 2026-09-01 *(see CHANGELOG)*

The prerequisite for everything below, because the backlog is six curve-tuning
jobs and there was no cheap way to look at a curve. `__dbg.tripScrub(p)` + the
T-menu scrub slider hold the trip at any progress; `Trip._peak(p, width)` +
exported `PEAK_CENTER`/`PEAK_WIDTH` give every peak-gated effect (visual and
audio) one shared climax; `__dbg.perfPhase` / `perfPhaseSummary` / `tripAB()`
turn a capture into labelled windows, which the trip needs because
`InfoCapturePass` records draws/tris *before* the trip pass and so the HUD
budgets cannot see it. Full surface in [DEBUGGING.md](../../DEBUGGING.md).

**Resolved 2026-09-02.** Frame stats read null under `bin/verify-headless`
(SwiftShader, ~2-5 fps) because `AdaptiveQuality` needs 90 frames before it
publishes, and the software rasterizer never gets there in a usable window.
Gary confirmed `__debug.perfSnapshot().fAvg` = **16.7** on a real GPU after 30s
parked, so frame-time capture is sound and only the headless harness is blind to
it. Practical consequence: **frame-time A/Bs must be run in a real browser, not
under `verify-headless`.**

### New trip visual effects — design backlog *(designed 2026-06-07)*

Six new psychedelic effects to layer onto the existing trip post-process. The
current effect is one stateless fragment shader (`src/trip.js`) reading only the
current frame (`tDiffuse`) plus `time` + 8 effect intensities, sitting in the
chain `RenderPass → UnrealBloomPass → Trip.pass → (FXAA) → OutputPass`
([main.js:116-143](../../src/main.js#L116)), gated free when idle
(`pass.enabled = envelope > 0.001`, [trip.js:583](../../src/trip.js#L583)). Bloom runs
*before* Trip, so by the time pixels reach the trip shader the bright stuff
(sun, stage lights, emissive, bulbs) is already glowing — "highlight detection"
is half-done for free; a luminance threshold in-shader finishes it. No
`readPixels`/CPU readback anywhere — it would tank perf; all detection is
in-shader.

#### The architecture fork: in-shader vs. feedback-buffer

Every effect below is one of two kinds, and which kind it is determines the
whole cost/wiring story:

- **In-shader** (melt, beat-throb, palette cycle, datamosh) — just more GLSL in
  the existing `Trip.pass`. No new render target, no new pass, no importmap
  change, rides the existing envelope gating. Cheap. A few ALU ops (+ at most
  one extra dependent texture tap).
- **Feedback-buffer** (tracers, droste) — needs *memory of past frames*: a
  persistent `WebGLRenderTarget` (or ping-pong pair) that survives across
  frames. That's a real architectural add, a new pass in the composer chain,
  and it's where the perf + gating + iOS gotchas live. Build these second; they
  can **share one buffer**.

#### Shared wiring — in-shader effects

Adding an effect key to `EFFECT_KEYS` ([trip.js:145](../../src/trip.js#L145))
auto-wires most of the plumbing: uniform creation (init loop,
[trip.js:216](../../src/trip.js#L216)), the static-mode push
(`_pushConfigToUniforms`, [trip.js:337](../../src/trip.js#L337)), the dynamic-mode
push ([trip.js:435](../../src/trip.js#L435)), and the debug panel's live-value mirror
([debug.js:1143](../../src/debug.js#L1143)). The full checklist per new in-shader
effect:

1. `uniform float <name>;` in the fragment shader + the GLSL block that uses it
   ([trip.js:34-140](../../src/trip.js#L34)).
2. Add `<name>` to `EFFECT_KEYS`.
3. Add a default to `config` ([trip.js:154](../../src/trip.js#L154)).
4. Add it to the three presets (microdose / standard / full,
   [trip.js:315-330](../../src/trip.js#L315)).
5. Add a personality curve in `_writeDynamicCurves`
   ([trip.js:364](../../src/trip.js#L364)) — see sequencing model below.
6. Add an `effectDefs` entry in `buildTripPanel` ([debug.js:1057](../../src/debug.js#L1057)) →
   the T-menu slider appears automatically.

#### Shared wiring — feedback-buffer effects

These do **not** go through `EFFECT_KEYS` (they're separate passes, not uniforms
on `Trip.pass`), so they need their own knob plumbing. Per buffer effect:

1. New pass inserted in the composer chain. Placement matters: **after Bloom**
   (so highlights are pre-bloomed). Before vs. after `Trip.pass` is a real
   choice — *before* = the Trip shader warps/melts the trails (goo that drips);
   *after* = clean trails of the already-warped image. Document which when built.
   Keep FXAA + OutputPass last.
2. Use an `UnsignedByte` RGBA target (not half-float) for iOS safety — decay
   precision is fine at 8-bit.
3. **Gate `enabled` off at envelope 0**, same as `Trip.pass`
   ([trip.js:583](../../src/trip.js#L583)) — rule #4 in
   [performance.md](../../.claude/rules/performance.md), each pass is a full-screen
   render+sample.
4. **Clear the accumulation target on trip start** (`Trip.trigger` /
   `acceptOffer` / `triggerDynamic`). The non-obvious bug: gate a feedback pass
   off for 3 minutes, flip it back on, and the first frame blends against
   wherever you were *last* trip — a ghost of the previous session. Clear on
   start kills it.
5. **Per-tier default.** On `?perf=low` (FXAA, pixelRatioCap 1.25,
   [perf.js:38](../../src/perf.js#L38)) default these OFF or capped — they're the one
   category that adds steady full-screen work *while active*. This is the
   CPU/GPU cost the backtick HUD draw-budget won't fully show; verify on low/mid.
6. Its own T-menu slider(s) + a master enable/disable toggle (Gary: "tone it
   down or disable entirely if it's not working, performance wise").
7. New module file → add to BOTH `index.html` and `sandbox.html` importmap
   arrays (footgun: forgetting one, [no-build.md](../../.claude/rules/no-build.md)).

#### The sequencing model — every effect gets a personality curve

Gary's requirement: "interesting sequencing, like we have for the other
effects, in how they vary in intensity during a trip and around the peak." The
trip **already has a defined peak**: `progress ≈ 1/3`. The MIDI player
crescendos everything there via a Gaussian `peakBell`
(`Math.exp(-Math.pow((p - 1/3) / 0.18, 2))`,
[midiPlayer.js:747-749](../../src/midiPlayer.js#L747)), and the visual posterize
spikes at the same `p = 1/3` ([trip.js:430](../../src/trip.js#L430)). At the peak:
vibrato is widest, tempo bottoms out, the long-reverb cathedral opens, granular
mix ramps in. **The new visuals should lock to this same peak** so picture and
sound climax together.

**Recommendation: add a shared `Trip._peak(p)` helper** mirroring the MIDI
player's bell (centered `1/3`, width `0.18`), so every peak-gated effect
references one curve and we can re-center the whole trip's climax by editing one
number. Then build each curve from the existing toolkit of shapes already proven
in `_writeDynamicCurves`:

- **Sum-of-sines** with unique freqs+phases → smooth pseudo-random "breathing"
  (lens/vignette/brightness, [trip.js:407-423](../../src/trip.js#L407)).
- **Burst-gate** = summed high-power cosines (`pow(…, 5)` + `pow(…, 7)`) → sits
  near 0 most of the time, opens at irregular intervals; the template for any
  *intermittent* effect (chromatic-aberration bursts,
  [trip.js:397-404](../../src/trip.js#L397)). This is exactly the shape for "only
  shows up now and then during the trip."
- **Gaussian peak spike / bell** → crescendo at `p = 1/3` (posterize spike;
  `peakBell`). The template for "max at peak."
- **easeInOutCubic ramps** → in over first third, out over last (uvRipple,
  [trip.js:373-378](../../src/trip.js#L373)).

Both ends of every curve must hit 0 at `p = 0` and `p = 1` (and at any segment
seam) — see the CA burst comment about avoiding discontinuities
([trip.js:393-400](../../src/trip.js#L393)) — or the effect pops on at fade-in / off
at come-down instead of breathing in.

---

#### The effects (recommended build order — effort:impact ascending)

**1. Melt — "the walls are melting." — SHIPPED 2026-09-02** *(see CHANGELOG)*
Built as variant (b), smooth 1D value noise, because the cheaper per-pixel hash
of variant (a) reads as vertical tearing rather than melting. Ships masked off on
`low` per the tier contract above. **Open follow-up: run the low-tier frame-time
A/B** (real browser, `?perf=low`, `__dbg.tripMask(false)` then `__dbg.tripAB()`)
and unmask it on low if it costs nothing. Original design notes below.

*In-shader. Lowest effort, most on-theme — build first.* Sibling to the existing `uvRipple` / `lensDistortion`
UV warps ([trip.js:70-83](../../src/trip.js#L70)): sample `tDiffuse` with a UV that
**sags downward**, the sag growing as the trip deepens and varying per-column via
noise, so the image droops like wet paint at different rates across its width.

- *Sketch:* `float drip = hash(uv.x * 23.0); uv.y += meltStr * (0.04 + 0.10*drip) * (0.5 + 0.5*sin(time*0.3 + drip*6.0)) * smoothstep(0.0, 1.0, uv.y);` (more sag lower in frame).
- *Variants, rising effort:* (a) vertical drip, above — cheapest, reads
  literally as melting. (b) Domain-warp / "breathing walls" — warp UVs with 2-3
  octaves of inline value noise (~10 lines GLSL) for an organic liquid feel,
  still single-pass. (c) Melt-with-smear — combine with the tracer buffer (#5)
  so dripped pixels leave a goo streak; only once that buffer exists.
- *Sequencing:* drip amount should **accumulate** with `p` (melts more as the
  trip goes on, like the world is slowly liquefying) with a peak-bell bump at
  `p=1/3`, then recede over the come-down. The per-column phase keeps it alive
  the whole time; the magnitude is what crescendos.
- *On-theme:* the narration toast already says "the trees seem to be breathing"
  ([main.js](../../src/main.js)) — this makes it literal.

**2. Beat-synced throb — pulse the world to the bass.** *In-shader. Loves it.
Highest synergy with what's already built.* A gentle scale/zoom + brightness
pulse driven by the music's amplitude, so the whole frame breathes on the beat
("you can taste the bass" — already in the narration bank).

- *Beat source (the one new dependency):* there's no universal beat clock today.
  The MIDI stages run on `Tone.Transport` (bpm known, [midiPlayer.js:618-620](../../src/midiPlayer.js#L618))
  but the procedural music bus (jam/brass/drum in `sound.js`) doesn't. **The
  robust, universal source is an `AnalyserNode` tapping the music bus** →
  smoothed RMS/amplitude envelope per frame, exposed as e.g.
  `Sound.getMusicLevel()` (RMS math already exists for analysis at
  [sound.js:944-948](../../src/sound.js#L948)), fed into `Trip` as a `beat` scalar
  each frame from the tick body alongside the existing
  `setMusicTrip`/`setSfxTrip` calls ([main.js:617-630](../../src/main.js#L617)).
  Alternative for MIDI-only stages: derive beat phase from `transport`. Document
  which ships; the analyser route works everywhere.
- *Sequencing:* the *depth* of the throb rides the trip — subtle early, deepest
  at the `p=1/3` peak (where the music tempo bottoms out, so the throbs get
  slow and heavy), easing back on come-down. The *rate* is the music, not a
  scripted curve.
- *Critical constraint:* keep it **gentle** — Gary cut the kaleidoscope because
  "you can't drive like that." A throb that zooms too hard is the same problem.
  Cap the scale delta low (a few %); this is a pulse you *feel*, not one that
  makes the cart hard to steer. Slider should let it go big for fun but default
  conservative.

**3. Palette cycling — shifting gradient color mapping.** *In-shader.* Map scene
luminance through a moving color gradient (demoscene-style color cycling) —
cheaper and more controllable than the existing per-pixel `hueShift`, and a
different *flavor* of color trip (whole-image palette remap vs. per-pixel hue
rotate). Bright→one end of a ramp, dark→the other, ramp scrolls over `time`.

- *Sketch:* `float l = luma(col); col = mix(col, palette(fract(l + time*speed)), paletteAmt*intensity);` where `palette()` is a small cosine-gradient (Inigo Quilez `a + b*cos(6.28*(c*t+d))`, 4 consts, no texture).
- *Sequencing:* amount breathes via sum-of-sines through the middle, ramps in
  over the first quarter / out over the last (like CA). The *scroll speed* can
  nudge up at the peak so colors race at climax. Pairs naturally with melt
  (melting + color-cycling walls).

**4. Datamosh / block glitch — intermittent compression-artifact stutter.**
*In-shader. "Sounds awesome."* Quantize UV into blocks and offset each block by
noise → the image tears into shifting rectangular chunks, like a corrupted video
codec. Occasional, not constant.

- *Sketch:* `vec2 blk = floor(uv * blocks) / blocks; vec2 jitter = (hash2(blk + floor(time*6.0)) - 0.5) * glitchAmt; col = texture2D(tDiffuse, uv + jitter * stepMask);` — optionally also shift color channels per block for a chroma-tear.
- *Sequencing:* this is the textbook **burst-gate** effect — use the summed
  high-power-cosine gate ([trip.js:397-404](../../src/trip.js#L397)) so it sits at 0
  most of the time and rips open for a second or two at irregular intervals,
  with a higher chance / harder tear near the `p=1/3` peak. Should feel like the
  reality glitches *occasionally*, not a permanent filter.

**5. Tracers / afterimage — highlight streaks.** *Feedback-buffer. "Worth the
effort." Build the buffer here; #6 reuses it.* Keep an accumulation texture,
decay it each frame, blend current (bright) pixels in, composite over the live
frame → bright stuff leaves trails.

- *Cheapest path:* three ships **`AfterimagePass`** at our pinned 0.160.0
  (`three/addons/postprocessing/AfterimagePass.js`, importmap at
  [index.html:101-102](../../index.html#L101)) — it *is* the feedback-trail pass, one
  `damp` uniform, internally ping-pongs two targets. Drop it in after Bloom,
  drive `damp` from the trip, gate `enabled`. ~15 lines, no custom shader.
- *Tradeoff — it smears everything, not just highlights.* During a trip that
  reads as "the world has trails," which is probably what we want. For
  highlight-*only* tracers (world stays sharp, only the lights streak), fork its
  tiny shader to `max(current, prev*decay)` against a luma threshold instead of
  `mix(current, prev, damp)`. Small.
- *Directional streaks (upgrade):* trails that follow motion. Global-direction
  smear is easy — we have `zerbleSpeed`; pass a screen-space travel vector and
  offset the trail sample by it. *Per-pixel* velocity (proper motion vectors per
  object) is a big lift in no-build three.js — **park that**, don't chase it.
- *Config:* knob for `damp`/decay + highlight threshold + a hard enable toggle
  (perf escape hatch). Default OFF on low tier.
- *Sequencing:* trail length (`damp`) short/subtle early, longest at the peak,
  receding on come-down. Gotchas: stale-buffer clear-on-start (#4 in
  feedback-buffer wiring), per-tier gating.

**6. Droste / infinite-tunnel zoom — falling into the screen.** *Feedback-buffer
— reuses #5's buffer. "Sounds cool too."* Feed the previous frame back slightly
**zoomed** (and optionally rotated) and blend with the current frame → an
infinite recursive tunnel, the classic "falling in" trip visual.

- *Sketch:* sample the history buffer at `(uv - 0.5) * (1.0 - zoomPerFrame) + 0.5` and blend; the recursion does the tunnel for free. A tiny per-frame rotation makes it spiral.
- *Gary's explicit constraints:* (a) **intermittent** — only kicks in now and
  then during a trip, not constant → drive its envelope with the **burst-gate**
  shape (#4's technique). (b) **max at peak** → multiply the burst by
  `_peak(p)` so the deepest tunnels happen at `p=1/3`. (c) **needs a slider** to
  play with zoom-per-frame + intermittency + rotation.
- *Safety:* feedback zoom can strobe / flash hard if overdriven — **clamp**
  zoom-per-frame and blend amount; this is a photosensitivity risk, keep the
  ceiling sane even on the slider. Shares the stale-buffer clear + per-tier
  gating with #5.

---

#### Captured but not greenlit this pass

- **Voronoi / stained-glass facets** *(Gary's original idea #4 — kept here so we
  don't lose it; not re-flagged in the build-pass curation, so it sits below the
  six above).* "Lines connecting edges → multi-faceted cells → effect within
  cells" = a Voronoi shader (not literal Delaunay edge-linking, which isn't
  GPU-friendly). In-shader, no buffer. Scatter animated feature points on a hash
  grid, find nearest per pixel (3×3 neighbor-cell loop); cell boundaries =
  "leading" lines, sample `tDiffuse` at each cell *center* so each facet is one
  flat color (shattered-mirror / low-poly look), optionally hue-shift per cell
  by its id, drift feature points slowly to breathe. *Cost:* the 3×3 loop (~9
  distance evals/pixel) is the heaviest per-pixel of any idea here but still
  cheap vs. bloom and gated to trip-only; coarsen the grid or gate off on low.
  *Lighter cousin:* a Sobel **edge-glow outline** (4-8 neighbor taps, no Voronoi
  loop) if we only want glowing outlines (Tron/comic) rather than filled facets.

#### Tried and cut

- **Kaleidoscope mirror** (fold UV into N rotational wedges). Built and rejected
  — "it's too much, you can't drive like that." The rotational symmetry destroys
  the sense of forward direction. Don't re-propose. *Lesson for #2 (throb):* any
  effect that disorients steering is out, however cool in a screenshot — keep
  motion legible.

### Accept + narration polish *(parked)*

- **Accept methods we considered but didn't ship.** Currently tap-to-toast or press [Y]. Other options on the table:
  - **Tap-the-wook** — raycast a tap on the canvas; if it hits a wook (or its proximity zone) during `awaiting_confirm`, accept. More diegetic.
  - **Dedicated ACCEPT button** — fourth touch button that appears only during `awaiting_confirm`. Most discoverable but adds permanent UI for a rare interaction.
- **Trip narration polish.** The TRIP_NARRATIVE_TEXTS array in `main.js` could rotate by trip-elapsed-time so early-trip text differs from late-trip text. Right now it's uniform random.
