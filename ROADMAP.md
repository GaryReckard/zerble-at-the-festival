# Roadmap

What's queued up next, plus a parking lot of "we talked about it, haven't done it yet." Items move to [CHANGELOG.md](CHANGELOG.md) when they ship.

---

## Bugs

- **Marching brass band floats ~0.85m above the ground.** *(found 2026-06-07)*
  Both the band members **and** the grand marshal float — same root cause in two
  files. The per-frame marching bob sets the figure's body group to
  `body.position.y = 0.85 + Math.abs(Math.sin(t*2))*0.08`
  ([bandMember.js:176](src/models/bandMember.js#L176) and the identical line in
  [parasolMarshal.js:139](src/models/parasolMarshal.js#L139)). But
  `buildSimpleNPC` is anchored **feet-at-zero**: `_LEG_GEO` is a 0.65-tall
  cylinder centered at y=0.32 ([puppet.js:183](src/models/puppet.js#L183),
  [puppet.js:202](src/models/puppet.js#L202)) → leg bottom ≈ 0, head at 1.65,
  hat at 2.05. So the `0.85 +` base offset lifts the entire figure (legs and
  all) ~0.85m off the deck the instant the bob animation starts. Regular crowd
  NPCs use the same model at `pos.y = 0` and sit correctly
  ([crowd.js:1187](src/crowd.js#L1187)), confirming feet belong at 0.
  - **The fix is a one-liner per file:** drop the `0.85 +` base so the bob rides
    from a feet-on-ground rest — `body.position.y = Math.abs(Math.sin(t*2))*0.08`
    (feet hop 0→0.08, a proper marching step).
  - **Bonus alignment win:** the drum / sax / drumstick meshes are parented to
    the *outer* group `g` (not `body`) at fixed heights authored for a
    body-at-rest-0 figure (drum at y=1.2, sax at 1.35 —
    [bandMember.js:100](src/models/bandMember.js#L100),
    [bandMember.js:122](src/models/bandMember.js#L122)). Today the body floats
    while those stay put, so the drummer's drum sits low relative to his torso.
    Fixing the base to 0 re-seats the body against the instruments too.
  - **Verify:** the band has sandbox entities — check `sandbox.html` band/marshal
    cases at all four ToD presets (feet on the ground plane), then boot the main
    game and confirm the marching unit walks on the deck.

---

## World generation (procedural map)

The 2D map sandbox + `src/worldgen/` generator shipped 2026-06-06 (a render-agnostic,
deterministic layout brain: hearts → roads → lobed lakes → organic gap-fill forests;
see OpenSpec `procedural-map-generator`). It is **not yet wired into the live game.**
What's queued, roughly in order:

- **Wire the generator into the live 3D world as v2 worldgen.** This **replaces**
  the per-chunk `+`-path grid in `chunks.js` and the placement in `lakes.js` /
  `forests.js` (not an additive fourth water/forest system). It's a deliberate,
  world-regenerating break (footgun #4) — themes (stages, food trucks, vendor rows,
  porta-potty banks, campsites) get placed *per-point* from the generator's role
  tier + heart rank + `facing` + `noBuild`, which structurally kills the
  stages-on-roads bug and keeps actual structures off the water. Every new
  `src/worldgen/*` module must be added to BOTH `index.html` and `sandbox.html`
  importmap arrays at wire-in. Re-run the determinism golden-hash on Safari/Firefox
  then (Math transcendental divergence is the cross-engine risk).
- **Rivers + bridges.** Cut from the 2D prototype on determinism grounds
  (river-around-heart avoidance can depend on a heart outside the local window →
  could violate "never through a heart core"); the contract fields
  (`onRiver`/`bridge`) already exist as stubs. Needs a river×heart window-invariance
  gate before it lands. The payoff (driving over a bridge) is a 3D thing.
- **Mega-heart rank** (a rare 2×2-cell super-hub with the biggest stage/court). Cut
  from this change (the multi-cell suppression is a determinism hot-spot); rank table
  is one constant to re-add.
- **In-game map view.** Consume the same generator for a high-level landmark map. The
  tuple already carries a continuous `heartInfluence` scalar so this is a read, not a
  re-derivation.
- **Collector + footpath road tiers.** Only arterials shipped. Footpath density feel
  is an open question (sparse "midway" vs denser web).
- **Map-sandbox polish:** a player-scale drive-time / traversal probe (guards the
  "dead air" between hearts), forest-interior drum-circle clearing POIs (the "drum
  circle nested in dense forest" we liked — deferred), and tighter lakeshore-ring
  causeway tuning.

### Festival layout — the plan/build contract refactor *(diagnosed 2026-06-10)*

Two playtest rounds of "jumbled mess" feedback (trucks clipping vendor rows,
random porta potties, no discernible order) trace to ONE root cause, not N bugs:
`festival.js` plans the hub as **points with scalar clear-radii**
(`KIND_FOOTPRINT`, [festival.js:196](src/worldgen/festival.js#L196)) while the
`chunks.js` builders construct **oriented shapes that exceed those radii** (a
"16m" food court really spans ~20m+ of truck ring; a "12m" vendor row is an
~18-20m rectangle with camps behind) — so `resolveOverlaps` settles clusters at
separations that guarantee clipping, the 38m dancefloor rect only repels *trees*
(POIs never read it), builders place sub-components blind (the registry-check
discipline main's theme builders had was dropped), and nothing enforces
stage-vs-stage distance across hearts. Item-by-item regression fixes can't close
this; the contract can. The fix, in order: (1) ✓ **DONE** — hoist the ~34
scattered layout constants into one `FESTIVAL_TUNING` object both planner and
builders read (round-2 item J's prerequisite); *shipped 2026-06-11/12 via
`worldgen-layout-harness` group 2 + 2.4*. (2) descriptors carry **oriented bounding
shapes derived from the same constants the builder uses**, and overlap/road/
water/dancefloor checks run against shapes, (3) replace scatter-then-relax with
**zone slotting** per hub (stage + hard-reserved front wedge on F; vendor aisles
along roads with camps auto-reserved behind; courts off-road at a min stage
distance, optional spur road to center; potties attached to a parent zone's
edge), (4) restore per-sub-component `registry` clearance in builders as the
graceful-degradation backstop. One golden-moving batch, flag-off. Full
diagnosis + design: OpenSpec `festival-zone-grammar`. **Gate now MET** — the
harness's grammar-unblock milestone (groups 1+2+4 + the baseline, task 8.1)
landed 2026-06-13: the linter + `bin/lint` + `verification/baseline.md` (106
error / 92 warn across 10 seeds) are the verification gate the grammar rewrite
is graded against. (Harness groups 5/6/7 — map-sandbox overlay, hub viewer,
playtest markers — are in-change fast-follows, not grammar blockers.)

### Layout-work agent harness — ✓ SHIPPED *(designed 2026-06-10, landed 2026-06-13)*

None of the existing surfaces verified the **built composition** (where every
arrangement bug lives) — the only detector was Gary driving around. The
`worldgen-layout-harness` change built that surface and shipped: the **layout
linter** (`src/worldgen/lint.js` + `bin/lint`, plan + registry modes, 10 rules,
the eyes-pipeline links), the **hub viewer** (`hub-sandbox.html` +
`buildHubPreview`, real builders on a flat plane, live `FESTIVAL_TUNING`
sliders), the **`FESTIVAL_TUNING` hoist** (`src/worldgen/tuning.js`), the
**`__dbg` layout verbs** (`dumpRegistry` / `gotoHub` / `topDown` /
`showFootprints`) + **`bin/layout-snapshot`**, the **map-sandbox true-extent
overlay + `?gallery=N` seed contact-sheet**, **playtest markers** (`K` /
triple-tap → localStorage), and **`verification/baseline.md`** (the number the
grammar rewrite drives down). Full record: CHANGELOG 2026-06-10…06-13 + OpenSpec
`worldgen-layout-harness`.

Genuinely-remaining follow-ups (not blockers):

- **Dry-runnable builders** *(deferred to `festival-zone-grammar` per
  worldgen-layout-harness deliberation 001 / D6 — the extraction lands under that
  change's already-moving golden)* — builders express sub-component layouts as
  pure data (descriptor in → positions/radii out, no three.js). The true-extent
  overlay already consumes captured registry snapshots; this would feed it (and
  the linter's plan mode, and the shape-aware planner) *exact* extents headlessly.
- **`bin/layout-snapshot capture` — survive headless-only boxes** *(surfaced
  2026-06-12)*: the one-command path dies when there's no GPU (SwiftShader
  saturates at `perf=high`, so `agent-browser open` times out on its load-wait).
  Teach `capture` to inject the `document.hidden` init-script (flip the game onto
  its `setTimeout(16ms)` loop, `main.js:1093`) and tolerate the open-timeout — the
  manual workaround is in DEBUGGING.md "Layout snapshots".
- **Importmap bootstrap dedupe** *(parked 2026-06-10, beyond the harness
  change — Gary call)*: the four html pages (index, sandbox, map-sandbox,
  hub-sandbox) each carry a near-identical inline cache-buster/importmap
  injector; they could collapse into one shared classic-script bootstrap. Not
  urgent — `bin/check-importmaps` fails loudly on list drift — and it touches
  prod loading, so it must not ride inside a golden-frozen change. See
  `worldgen-layout-harness` deliberations/001-initial (Q6).

---

## Music

### Section transitions *(polish on shipped songform)*

Real songform shipped 2026-06-03 — each melodic stage plays finite songs with
named sections (intro/verse/chorus/bridge/outro, or intro/build/drop/break for
dance), per-song tempo + key changes, voices coming in/out by section, and a
crowd cheer between songs. What's left from the original "section system" idea:
a **probabilistic** meta-scheduler that picks the next section instead of the
current fixed per-genre order, with **musical transitions** (a snare fill into
the chorus, a tempo ramp into a breakdown) rather than clean cross-fades, plus
**per-section** tempo changes (today tempo is per-song + a wobble). Diminishing
returns vs. what shipped — nice-to-have, not urgent.

---

## Trip / wook

### New trip visual effects — design backlog *(designed 2026-06-07)*

Six new psychedelic effects to layer onto the existing trip post-process. The
current effect is one stateless fragment shader (`src/trip.js`) reading only the
current frame (`tDiffuse`) plus `time` + 8 effect intensities, sitting in the
chain `RenderPass → UnrealBloomPass → Trip.pass → (FXAA) → OutputPass`
([main.js:116-143](src/main.js#L116)), gated free when idle
(`pass.enabled = envelope > 0.001`, [trip.js:583](src/trip.js#L583)). Bloom runs
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

Adding an effect key to `EFFECT_KEYS` ([trip.js:145](src/trip.js#L145))
auto-wires most of the plumbing: uniform creation (init loop,
[trip.js:216](src/trip.js#L216)), the static-mode push
(`_pushConfigToUniforms`, [trip.js:337](src/trip.js#L337)), the dynamic-mode
push ([trip.js:435](src/trip.js#L435)), and the debug panel's live-value mirror
([debug.js:1143](src/debug.js#L1143)). The full checklist per new in-shader
effect:

1. `uniform float <name>;` in the fragment shader + the GLSL block that uses it
   ([trip.js:34-140](src/trip.js#L34)).
2. Add `<name>` to `EFFECT_KEYS`.
3. Add a default to `config` ([trip.js:154](src/trip.js#L154)).
4. Add it to the three presets (microdose / standard / full,
   [trip.js:315-330](src/trip.js#L315)).
5. Add a personality curve in `_writeDynamicCurves`
   ([trip.js:364](src/trip.js#L364)) — see sequencing model below.
6. Add an `effectDefs` entry in `buildTripPanel` ([debug.js:1057](src/debug.js#L1057)) →
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
   ([trip.js:583](src/trip.js#L583)) — rule #4 in
   [performance.md](.claude/rules/performance.md), each pass is a full-screen
   render+sample.
4. **Clear the accumulation target on trip start** (`Trip.trigger` /
   `acceptOffer` / `triggerDynamic`). The non-obvious bug: gate a feedback pass
   off for 3 minutes, flip it back on, and the first frame blends against
   wherever you were *last* trip — a ghost of the previous session. Clear on
   start kills it.
5. **Per-tier default.** On `?perf=low` (FXAA, pixelRatioCap 1.25,
   [perf.js:38](src/perf.js#L38)) default these OFF or capped — they're the one
   category that adds steady full-screen work *while active*. This is the
   CPU/GPU cost the backtick HUD draw-budget won't fully show; verify on low/mid.
6. Its own T-menu slider(s) + a master enable/disable toggle (Gary: "tone it
   down or disable entirely if it's not working, performance wise").
7. New module file → add to BOTH `index.html` and `sandbox.html` importmap
   arrays (footgun: forgetting one, [no-build.md](.claude/rules/no-build.md)).

#### The sequencing model — every effect gets a personality curve

Gary's requirement: "interesting sequencing, like we have for the other
effects, in how they vary in intensity during a trip and around the peak." The
trip **already has a defined peak**: `progress ≈ 1/3`. The MIDI player
crescendos everything there via a Gaussian `peakBell`
(`Math.exp(-Math.pow((p - 1/3) / 0.18, 2))`,
[midiPlayer.js:747-749](src/midiPlayer.js#L747)), and the visual posterize
spikes at the same `p = 1/3` ([trip.js:430](src/trip.js#L430)). At the peak:
vibrato is widest, tempo bottoms out, the long-reverb cathedral opens, granular
mix ramps in. **The new visuals should lock to this same peak** so picture and
sound climax together.

**Recommendation: add a shared `Trip._peak(p)` helper** mirroring the MIDI
player's bell (centered `1/3`, width `0.18`), so every peak-gated effect
references one curve and we can re-center the whole trip's climax by editing one
number. Then build each curve from the existing toolkit of shapes already proven
in `_writeDynamicCurves`:

- **Sum-of-sines** with unique freqs+phases → smooth pseudo-random "breathing"
  (lens/vignette/brightness, [trip.js:407-423](src/trip.js#L407)).
- **Burst-gate** = summed high-power cosines (`pow(…, 5)` + `pow(…, 7)`) → sits
  near 0 most of the time, opens at irregular intervals; the template for any
  *intermittent* effect (chromatic-aberration bursts,
  [trip.js:397-404](src/trip.js#L397)). This is exactly the shape for "only
  shows up now and then during the trip."
- **Gaussian peak spike / bell** → crescendo at `p = 1/3` (posterize spike;
  `peakBell`). The template for "max at peak."
- **easeInOutCubic ramps** → in over first third, out over last (uvRipple,
  [trip.js:373-378](src/trip.js#L373)).

Both ends of every curve must hit 0 at `p = 0` and `p = 1` (and at any segment
seam) — see the CA burst comment about avoiding discontinuities
([trip.js:393-400](src/trip.js#L393)) — or the effect pops on at fade-in / off
at come-down instead of breathing in.

---

#### The effects (recommended build order — effort:impact ascending)

**1. Melt — "the walls are melting."** *In-shader. Lowest effort, most
on-theme — build first.* Sibling to the existing `uvRipple` / `lensDistortion`
UV warps ([trip.js:70-83](src/trip.js#L70)): sample `tDiffuse` with a UV that
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
  ([main.js](src/main.js)) — this makes it literal.

**2. Beat-synced throb — pulse the world to the bass.** *In-shader. Loves it.
Highest synergy with what's already built.* A gentle scale/zoom + brightness
pulse driven by the music's amplitude, so the whole frame breathes on the beat
("you can taste the bass" — already in the narration bank).

- *Beat source (the one new dependency):* there's no universal beat clock today.
  The MIDI stages run on `Tone.Transport` (bpm known, [midiPlayer.js:618-620](src/midiPlayer.js#L618))
  but the procedural music bus (jam/brass/drum in `sound.js`) doesn't. **The
  robust, universal source is an `AnalyserNode` tapping the music bus** →
  smoothed RMS/amplitude envelope per frame, exposed as e.g.
  `Sound.getMusicLevel()` (RMS math already exists for analysis at
  [sound.js:944-948](src/sound.js#L948)), fed into `Trip` as a `beat` scalar
  each frame from the tick body alongside the existing
  `setMusicTrip`/`setSfxTrip` calls ([main.js:617-630](src/main.js#L617)).
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
  high-power-cosine gate ([trip.js:397-404](src/trip.js#L397)) so it sits at 0
  most of the time and rips open for a second or two at irregular intervals,
  with a higher chance / harder tear near the `p=1/3` peak. Should feel like the
  reality glitches *occasionally*, not a permanent filter.

**5. Tracers / afterimage — highlight streaks.** *Feedback-buffer. "Worth the
effort." Build the buffer here; #6 reuses it.* Keep an accumulation texture,
decay it each frame, blend current (bright) pixels in, composite over the live
frame → bright stuff leaves trails.

- *Cheapest path:* three ships **`AfterimagePass`** at our pinned 0.160.0
  (`three/addons/postprocessing/AfterimagePass.js`, importmap at
  [index.html:101-102](index.html#L101)) — it *is* the feedback-trail pass, one
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

---

## Docs

- **"LEAF-style drum circle" comment in ARCHITECTURE.md.** Still mentions LEAF as an internal label even though the README is now generic-festival. Decide: scrub from architecture too, or keep as internal context for code-reading colleagues.
- **Multiple sizes of `assets/zerble.png`.** Currently a single PNG. A higher-res original would scale down cleaner on Retina displays — the README `<img>` is set to `width="420"` but devices pull the full resolution.

---

## Touch / UX

- **Touch overlay during title card.** Currently hidden behind the title's `backdrop-filter`. After Start, the overlay reveals — that's fine, but a brief "tap-and-go" hint after Start might help new touch players find the thumbstick.

---

## Gameplay verbs

- **Bubble varieties — earnable and mix-and-match.** Bubbles are Zerble's signature; unlocking new TYPES is the most direct way to amplify the core verb. Each new type is gated on a different in-game achievement, persists in `localStorage`, and shows up in a small **multi-select** UI strip (tap/click an icon to toggle it on or off). The bubble spawner picks randomly from whatever set is currently enabled — so a player who's unlocked everything can run a chaotic mix of hearts + stars + rainbows + glow + the occasional mega. Default starting set: standard only. Six variants to ship:
  - **Standard** — the base bubble. Always on, always unlocked.
  - **Heart bubbles** — unlock by catching up to Lurleen at least once. NPCs in a "love" state (currently nascent — would need a small new affect type) give double smiles; everyone else reacts normally.
  - **Star bubbles** — unlock by surviving a full wook trip (sustaining → fade-out completes). Float higher, last ~50% longer.
  - **Smile-faced bubbles** — unlock at 100 lifetime smiles. NPCs smile back automatically when hit, regardless of bubble proximity.
  - **Rainbow bubbles** — unlock with a smile combo of 30 (or whatever combo-threshold ships per the "smile combos + multiplier" idea). Pop spawns a small confetti burst + bonus smile.
  - **Glow bubbles** — unlock at full nightness during a session (or via festival pin set later). Visible from far away at night, emissive material that ramps with `nightness`.
  - **Mega-bubble** — unlock via a hidden world pickup. Rare emit (one per ~10s when enabled), 3-4× the size, pops with crowd-wide reaction (everyone within ~15m smiles + claps).
  
  Implementation sketch: extend `Bubbles` (`bubbles.js`) with a per-instance `bubbleType` attribute on the existing `InstancedMesh`. The `onBeforeCompile` shader patch reads the type to pick color/emissive/opacity. Pop behavior diverges in `_popBubble` via a small switch on type. The selector UI is a DOM strip (~6 icons) anchored to the HUD; clicking toggles a bit in a `bubbleTypesEnabled` set. `Bubbles._pickType()` does a uniform random draw from the enabled set at emit time. `localStorage` keeps `{ unlocked: ['standard', 'heart', ...], enabled: ['standard', 'rainbow'] }`.
  
  Cost: ~zero perf impact (same instance count, same draw call, one more per-instance attribute). Mostly feature work in `bubbles.js`, a new tiny DOM panel, and the per-unlock trigger plumbing across `Lurleen`, `Trip`, `Analytics.smileScore`, etc.

- **Bubble-juice meter follow-ups.** The meter shipped (see CHANGELOG 2026-06-01) — drains while bubbling, ~3× on the G blast, **stops at empty** (NPCs frown when you're dry), Zelda-style jug **stockpile** (up to 4 meters), rare floating jugs + the spacesuit bubble vendor (free refill w/ bubble-stream visual + "full" cue), top-left HUD gauge w/ reserve pips + amber/red low-empty border. Parked refinements: (1) the **"costs smiles" economy** — vendor refills are free; a smile cost (full or token) is an alternate score sink if the loop needs more stakes (note: frowns already provide a stakes layer now). (2) **Bubble-variety juice costs** — once bubble varieties ship, mega-bubbles could cost more juice and glow bubbles less. (3) **Drain + frown tuning by feel** — if either nags on a real playtest, soften them or gate behind an opt-in mode. (4) An **empty/sputter audio cue** — there's a "full" chime but no sound when you run dry; a sputter to match the red meter would close the loop.

- **Tricks via boost + hop key.** Tap Space+Shift (or a dedicated key) mid-drive for a small 0.3s hop. Air time + bubbles in-air = bonus smiles when you land near NPCs (NPC reaction: "oooh!"). Reuses Zerble's existing arcade physics — just adds a vertical impulse and a "in-air" flag. New verb, no geometry.
- **Passenger quests.** A boarding rider sometimes has a small thought-bubble icon over their head showing where they want to go (tent, stage, food trucks, beach, hammocks, drum circle, etc. — all already in the registry). Layered indicators (compass strip, icon brightness, passenger humming, toast hints like "I can smell the food trucks!") help the player navigate. Within ~25m of the destination = thumbs-up animation + smile burst. Multi-passenger logistics emerge naturally at `MAX_PASSENGERS = 4`. Full design lives in [`.claude/passenger-quests-design.md`](.claude/passenger-quests-design.md) — destinations, signaling stack, indicator layers, toast bank, failure handling, build order, and open questions.
  - **"Gotta GO!" porta-potty emergency mission.** A special, urgent passenger-quest variant: a rider boards doing the pee-pee dance (visible squirm + a sweat-drop / "!!!" icon) and needs a ride to the **nearest porta-potty**, fast. A countdown adds light stakes — make it in time for a big relief + smile burst (and maybe a grateful honk), miss it and they bail out mortified (a flustered "fleeing" exit, small smile penalty, comedic toast). The porta-potty system already shipped (model + registry `porta_potty` entries + the door/occupied/stink machinery in [portaPotty.js](src/models/portaPotty.js) + [crowd.js](src/crowd.js)), so the destination, arrival detection, door-open-on-arrival, and "occupied, try the next one" logic are mostly reusable — this is largely the passenger-quest signaling stack plus a timer and the squirm animation. Ties the new sanitation prop into the mission loop.

- **Star Power.** Rare hidden floating star, marked by a thin pillar of light visible from across the festival. Catch it and Zerble enters a 15-second buff: pure **ghost mode** (collision system bypassed entirely — phase straight through food trucks, stages, puppets, lakes, anything), polygons cycling through silvery rainbow via a shared `onBeforeCompile` shader patch, fast jaunty 160 BPM loop overrides the music bus, and every NPC within 25m falls in love and starts spawning smiles continuously. Rainbow phantom drifting through the festival. Full design in [`.claude/star-power-design.md`](.claude/star-power-design.md) — spawn rules, state machine, rainbow shader strategy, audio swap, love-magnet mechanics, ghost mode + lake-escape on buff end, edge cases (trip-vs-star priority, chunk unload), and the 7-step build order.
- **Vendor stand power-ups.** Extend `vendor_row` chunk themes with rare lemonade / pretzel / glow-stick stands. Drive by, get a 10s buff: faster bubble output, brighter eye glow, louder honk. Tiny new builders that reuse `foodTruck.js` patterns; existing food-truck attractor logic carries the trigger.

- **Hittable physics props — knock the chairs over.** Right now camp chairs are *intangible*: they're registered with a `footprint: 0.5` only (so NPCs walk around them) but **no `collider`**, so Zerble drives straight through them ([chunks.js](src/chunks.js) chair `registry.add` calls; [campsite.js](src/models/campsite.js) `buildCampChair`). The wish is to clip a chair and have it fly off, bounce, and land cockeyed. The blocker is that the whole collision model is **2D circle-overlap + radial push** — colliders are flat `{position, radius, damage, kind}` discs with no rotation or mass ([main.js](src/main.js) `resolveCollision`; [registry.js](src/registry.js) `colliders()`), and Zerble itself is kinematic arcade motion, not a rigid body (`applyHit` just flips `speed` to -2.5 and nudges position). Three tiers, in increasing cost:
  - **Tier 1 — bespoke scripted tumble, no engine (recommended).** Give chairs a real collider; on a damaging hit, detach the chair from its chunk group and hand it to a small per-frame updater that integrates linear + angular velocity under gravity with a ground bounce (restitution ~0.3–0.5), settling to a random resting orientation. The [frisbee disc already does the 3-DOF ballistic half of this](src/obstacles.js) (gravity + floor at y≈0) — extend it to a tumbling quaternion. No new dependency, stays determinism-friendly (runtime event, not chunk generation). The one real wrinkle is the chunk lifecycle: chairs carry a `chunkKey` and get dropped on chunk unload, so a mid-tumble chair must either un-tag itself + join the obstacle update loop, or settle fast enough that it doesn't matter. Needs a `chair`-hit sandbox entry per the harness doctrine.
  - **Tier 2 — a real rigid-body engine.** `cannon-es` is the no-build-friendly pick (pure-JS single ES module, CDN-able via the importmap; Rapier would drag in a WASM fetch). Chairs become box bodies, ground is a static plane, the cart is a kinematic body whose velocity drives impacts. Gets genuine "bounces off other chairs / stacks / lands upside down" and generalizes to cans, cups, signs. Costs are real: it's exactly the moving part [no-build.md](.claude/rules/no-build.md) pushes back on; bodies must be created/destroyed in lockstep with chunks or they leak; sleeping must be on so a field of settled props doesn't tax the step; and it's **CPU steady-state cost invisible to the GPU draw budget** in the backtick HUD — gate dynamic props by perf tier and cap active bodies, or `?perf=low` (mobile/integrated) will choke.
  - **Tier 3 — hybrid:** Tier-1 tumble for the common single-chair bonk, reach for Tier 2 only if debris needs to interact/stack. For a stylized game the bespoke tumble almost certainly reads "good enough" without the dependency.
  - *Tension to note:* the Performance section's "variant-bucketed InstancedMesh for camp chairs" idea **fights** per-chair dynamics — a tumbling chair has to break out of the instanced batch. Pick one direction per prop.

---

## World

- **Bubble inhabitants.** Once in a while a bubble drifts past with a tiny waving figure inside it (silhouette billboard, ~0.1m). Rare enough to read as an Easter egg. One mesh, low spawn rate, despawn with parent bubble.
- **Bird polish follow-ups.** Birds shipped (see CHANGELOG 2026-06-01). Parked refinements: tapered/swept wing geometry (current wings read a touch plank-like in flight); a quick wing-flutter SFX on startle; biasing flocks to spawn around stages/food (attractor-aware) rather than uniformly; and a "bird poops on the cart" easter egg.
- **Fireworks at midnight.** Cheap instanced point sprites + emissive ramp, gated on `nightness > 0.85`. Triggers ~once per minute. Almost every NPC stops and looks up to take notice — same "watching" state crowd already supports, just biased to face up. Hooker for the day/night cycle's climax.
- **Crowd photographer.** A specific NPC type with a camera who occasionally crouches and "takes a photo" of Zerble (small flash sprite). Pure animation + a brief emissive pop. Builds the festival-vibe story.
- **Real lake reflections via `Reflector`.** An earlier procedural "twinkly stars" shader patch on the water surface looked like fake sparkles fading in/out — not reflection physics. Removed in favor of plain water for now. A proper Reflector (`three/examples/jsm/objects/Reflector`) would render the scene from the mirrored camera into a texture and sample it from the water surface — actual mirror of sky + stars + moon + nearby objects. Cost is roughly a second scene render whenever the player can see a lake; would gate to high tier only, and possibly half-res target + nightness-driven wet/dry mix so it only matters when reflections matter.

---

## HUD / juice

- **Smile counter pulse + color shift** when score increments. Pure CSS animation on `#smiles .value` — scale bump + brief warm-tone color flash, then ease back.
- **Personal-best confetti.** When BEST gets beaten, a brief DOM confetti shower over the score panel. Pure HTML/CSS — no three.js cost. One-time trigger per session.
- **Boost streaks.** Visible trail behind Zerble at high speed — short fading emissive ring instances, ~8 in a pool, spawned at the rear during boost and fading over ~0.4s. Reads as motion without changing collision or perf budget.
- **Day/night HUD indicator.** Tiny sun/moon icon in the corner arcing across a strip showing time of day. Pure DOM/SVG, syncs to `getTimeOfDay().t`. Tells the player when the trippy night content (drum circles, stage lights, fireworks once shipped) is coming.

## Player identity

### Name entry on the title card *(medium effort)*

A text field on the title card — "What's your name?" — before the "Let's go ZERBLIN'!" button. Persist to `localStorage` so returning players keep it. Blank name = today's behavior exactly (no greeting, no name in copy). Then weave it through the world for a personal touch:

- **Festival arch greeting.** The (0,0) entrance arch banner reads "Welcome, {name}!" instead of "FESTIVAL" — same canvas-baked-texture path as the existing arch sign (chunks.js / the arch model), falling back to the default when unset.
- **Wook toast banter.** The wook offer/narration toasts drop the name in occasionally ("{name}, the bubbles are calling…"). Same idea for the other toast banks — vendor crack-wise lines, milestone toasts ("Nice one, {name} — 100 smiles!"), the out-of-juice nudge, Lurleen. Sprinkle, don't saturate.

The in-world name use is 100% client-side — no privacy implications. The *tracking* is where the line is:

**GA4 + the name — the legal bit (important):** do **not** send the raw name to GA4. Google's Analytics ToS prohibits sending PII (personally identifiable information), and a free-text name field is PII — sending it risks account suspension and is a privacy problem regardless. So:

- Track only non-PII signals: `name_entered` (boolean), `name_length` (number), and maybe a salted hash if we ever need to count distinct players — never the string itself.
- If we ever want the name for GA4 segmentation (a user property), same rule: a hash or opt-in pseudonym is the only defensible route, not the raw name.
- Worth a quiet "stays on your device, we don't send it anywhere" note by the field if we want to be upfront (it lives in `localStorage`, never leaves the browser).

## Performance

- **Crowd InstancedMesh churn.** When NPCs change state, their per-instance matrix flag has to flip. Worth profiling on low-end devices to see if writes per frame are an issue.
- **Forest tree count on low tier — confirm the multiplier on a real device.** The tier-gated thin-out shipped (2026-06-02): `PERF.forestTreeDensityMul` cuts the low-tier forest target to **0.7** (~30% fewer trees, the bigger crowns fill the gaps). What's still open is the original deferral — the 0.7 was picked from the estimate, not a real low-end-device feel-test. Drive a forest on an actual integrated-GPU phone and confirm 0.7 is the right trade (looser if it still chugs, tighter if the woods read sparse).
- **LOD on distant trees / tents.** Beyond ~60m the polygon detail is invisible; could swap to billboard or low-poly replacements. *Also more valuable since the 2x tree pass* — the larger crowns occupy more screen area at distance, so distant-tree fill is a bigger slice of the frame than before.
- **Geometry merging at chunk completion.** Once a chunk's content stops changing, `BufferGeometryUtils.mergeGeometries` could collapse it into a single mesh per material — massive draw-call reduction.
- **Material pooling in `buildPuppet`.** Most of this shipped: `foodTruck.js` has `_SHARED_MATS` + a color-keyed `matFor` cache, and `puppet.js`'s hot path `buildSimpleNPC` (every band member, kid, wook, handler) pools both materials and geometry. The one holdout is `buildPuppet` itself — the giant parade creature still allocates ~12 fresh `MeshStandardMaterial`s per build. Low frequency (puppets spawn rarely, not per-chunk), so the allocation cost is rarely paid; backport the `matFor` pattern only if a parade spawn ever shows a stall.
- **Variant-bucketed InstancedMesh for camp chairs.** 8 meshes per chair × multiple chairs per campsite. Use `setColorAt()` for the fabric color variation; instance legs/seat/back/arms across all chairs in a campsite. *Note:* this **fights** the "hittable physics props — knock the chairs over" gameplay idea above (a tumbling chair has to break out of the instanced batch). Pick one direction per prop before building either.
- **Texture mipmap audit.** Confirm `generateMipmaps = true` on the larger canvas textures so distant draws sample cheap LOD levels.
- **Light layers for the Sugar Shack work spots.** Currently every standard material in range pays the per-fragment SpotLight cost. Putting the lights on a layer that only the banner is on would cut that to ~3 affected meshes.

---

## Out of scope (worth flagging)

- **Bundler.** Tempting but adds a build step, breaks the "open index.html and it just works" property. Stay no-build until performance forces the issue.
- **Sample-based audio (mp3/wav).** Adding recorded audio means an asset pipeline and a CDN story. Synthesized stays the constraint for game SFX + stage music. MIDI playback uses Tone.js synthesis — no samples shipped.
