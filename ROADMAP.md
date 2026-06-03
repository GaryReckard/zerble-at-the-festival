# Roadmap

What's queued up next, plus a parking lot of "we talked about it, haven't done it yet." Items move to [CHANGELOG.md](CHANGELOG.md) when they ship.

---

## Music

### Section system *(medium effort, biggest payoff)*

Each music generator gets named sections — `intro / groove / build / break / outro` — each with its own pattern bank and tempo. A meta-scheduler picks the next section probabilistically, with musical transitions: a snare fill into a new section, a tempo ramp into a breakdown. Voices come in and out (just kick for a bar, then horns enter). Different sources can be in different sections at the same time — no global lockstep.

This is the "real" answer to "less repetitive" — the cheap-wins variation pass (multiple variants, rest probability, gain LFO) addresses surface-level repetition, but doesn't give the music a sense of arc.

### Real songform *(big effort, smaller marginal payoff)*

Markov/motif-based phrase generation so the melody actually develops instead of looping. Per-source "songs" — 2–3 minute arcs with intro → verse → chorus → bridge → outro, then a new song picked from the bank. Key changes between songs.

### Smaller music polish

- **Dynamics-aware breath** — couple the rest-probability to the LFO so quiet phases drop more notes and loud phases pack in more accents.
- **Tempo wobble** — slow drift (±3 BPM over 32 bars) so the groove isn't perfectly metronomic. Tricky because `beat` is captured in envelope math; a clean implementation requires factoring tempo into a function.
- **Shuffled variant order** — currently rotates 0→1→2→0→1→2. Picking the next variant from a weighted shuffle (avoiding immediate repeats) would feel less mechanical.
- **Stage-music presets that drift** — even within a single source, the lead can occasionally swap timbre (triangle → sine → square) at section boundaries.

### MIDI player follow-ups

The MIDI player (M key) ships with a single shared PolySynth(FMSynth) for all tracks of a parsed MIDI. Worth exploring:

- **Per-channel instruments.** Map MIDI channels to distinct synths (or `Tone.Sampler` with a soundfont) so drums sound like drums and a bass sounds like a bass instead of all-FMSynth-everything. Drives the timbre toward "playable instrument" instead of "synth interpretation."
- **General MIDI program map.** Honor program-change messages in the MIDI file — e.g. program 0 = acoustic grand → sampler, program 32 = acoustic bass → bass synth, channel 10 = drums → drum kit sampler. Big jump in playback fidelity for arranged MIDIs.
- **Per-track muting in the debug overlay.** Toggle individual MIDI tracks on/off for live remixing during a trip.
- **Pre-render reverb impulse for blast-mode swell.** `Tone.Reverb.decay` is fixed at construction; swelling decay during a trip currently leans on wet ramp. A second `Reverb` with a long decay routed in parallel would let us crossfade for a true "cathedral opens" effect.
- **Granular synthesis chain for peak moments.** At the climax, route the synth through a granular/glitch effect (Tone has nothing native — would need a custom `AudioWorklet`) for that "reality fracturing" feel. Significant scope — punt unless someone wants to chase the high.

---

## Trip / wook

- **Accept methods we considered but didn't ship.** Currently tap-to-toast or press [Y]. Other options on the table:
  - **Tap-the-wook** — raycast a tap on the canvas; if it hits a wook (or its proximity zone) during `awaiting_confirm`, accept. More diegetic.
  - **Dedicated ACCEPT button** — fourth touch button that appears only during `awaiting_confirm`. Most discoverable but adds permanent UI for a rare interaction.
- **Trip narration polish.** The TRIP_NARRATIVE_TEXTS array in `main.js` could rotate by trip-elapsed-time so early-trip text differs from late-trip text. Right now it's uniform random.

---

## Audio polish

- **Nature-bus volume slider.** Birdsong / crickets / frogs route through `natureBus` (its own trip chain) but there's no user fader yet — it sits at a fixed internal level and only Master controls it. Add a 5th slider (or fold under SFX) + persist `zerble.vol.nature`, mirroring the existing master/music/sfx/midi controls.
- **Night owl / nightjar call.** A rare low hoot during deep night (`nightness > 0.85`) when the songbirds have roosted — fills the "everything went quiet" gap between the dusk chorus and the crickets. One more entry in the bird-song bank, fired on a slow timer rather than from a perched bird.
- **Directional crickets/frogs.** Currently both are non-positional ambient beds (fixed stereo spread, level-gated by proximity). Could pan them toward the actual nearest forest / lake-edge direction for a stronger "the pond is over *there*" cue.
- **Music cross-fade between stages.** Currently when Zerble enters a new stage's audible range, the spatial music handle abruptly swaps — feels like changing radio stations. Cross-fade the two PannerNodes' gains over ~1.5s so the new stage's music swells in as the old one fades. Already have per-stage `attachStageMusic` handles.
- **`Sound.setVolume(0)` proper-mute API.** The localStorage clamp (≥0.05) is a safety net against an accidentally-dragged slider; a real "fully mute" path should bypass the clamp so intentional muting works.
- **Output-routing detection.** If iOS sound is still broken after the v2 unlock, log whether the audio is routed to a ghost Bluetooth device. Surface in `Sound.diagnostics()`.
- **`?sounddebug=1` discoverability.** The mobile audio debug toast only shows when the URL param is set. Consider gating it on a debug build flag rather than a query string, so it never accidentally appears in production.

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
