# Architecture

How Zerble at Festival fits together. Aimed at someone who has cloned the repo and wants to understand the moving parts before editing anything.

> For the **per-capability contract** ("what does subsystem X guarantee"), see the
> canonical specs in [`openspec/specs/`](openspec/specs/README.md) — 20 capabilities in
> Requirement/Scenario form, traced to code. This file is the prose walkthrough; those
> are the contract.

---

## Top-level shape

- **No build step.** The game runs from source. `index.html` constructs an [importmap](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap) at boot and loads `src/main.js` as an ES module. Three.js is pulled from `unpkg` through that same importmap.
- **Dev cache-buster.** On local hostnames (`localhost`, `127.0.0.1`, `*.local`, RFC1918, `claude-preview`, `happycog`) the importmap appends `?v=<Date.now()>` to every module URL, so edits show up on reload even when the preview proxy strips cache headers. Production loads modules unsuffixed so three.js can cache cleanly.
- **Dev server.** `python3 .claude/serve_nocache.py 8765` — a `http.server` subclass that sends `Cache-Control: no-store` on every response. Use it instead of `python3 -m http.server` so ES module bodies don't get cached by the heuristic cache.
- **Analytics.** GA4 (`G-CY1FNMY8H8`) loads inline in `index.html`. Every gameplay event flows through [analytics.js](src/analytics.js), which no-ops gracefully if `gtag` is missing.

---

## File layout

```
index.html                  Boot + importmap + title card + HUD scaffolding
styles.css                  HUD, title card, touch overlay
sandbox.html                Standalone scene viewer (not part of the game)
.claude/serve_nocache.py    Dev static server with no-cache headers
src/
  main.js                   Game bootstrap + main loop + collisions
  world.js                  Sky, lights, ground, fog, chunk + lake managers
  timeOfDay.js              Day/night cycle, nightness curve
  chunks.js                 80m procedural festival chunks
  forests.js                3x3-chunk forest blocks
  lakes.js                  Macrocell lake bodies
  mountains.js              Blue Ridge backdrop
  registry.js               Central world-entity registry
  zerble.js                 The player cart — geometry + arcade physics
  lurleen.js                Zerble's love interest — a second cart
  bubbles.js                InstancedMesh bubble particle system
  smiles.js                 Smile pickup orbs
  crowd.js                  NPC pool, AI, state machine
  obstacles.js              Puppet parade, brass band, kids, wooks, hoopers, frisbee pairs
  camera.js                 Chase / first-person / top-down camera
  input.js                  Keyboard + touch input blend
  touch.js                  Virtual thumbstick + camera drag
  hud.js                    DOM HUD bindings (score, toast, hit flash)
  sound.js                  Web Audio synthesis — engine, SFX, music
  trip.js                   Custom post-process shader pass
  debug.js                  Dev overlay + console helpers
  perf.js                   Device tier detection (low/mid/high)
  rng.js                    Seeded mulberry32 + (cx,cz) hash
  analytics.js              GA4 wrapper
  models/                   Pure THREE.Group builders (geometry)
    canoe.js  campsite.js  bandMember.js  entranceArch.js
    foodTruck.js  hammock.js  heart.js  kid.js
    leafBanner.js  leafDrumCircle.js  parasolMarshal.js
    performer.js  puppet.js  shrub.js  stage.js  tent.js  tentStage.js
    tree.js  tribalFigures.js  wook.js
  worldgen/                 Render-agnostic infinite-layout generator (v2; flag-gated)
    index.js                queryPoint/queryRegion — the data contract (no THREE/DOM)
    constants.js  tuning.js  Named tunables (CONFIG / FESTIVAL_TUNING)
    hearts.js                Rank-weighted festival anchors on a macrocell grid
    roads.js                 Pair-seeded arterial meanders between hearts
    water.js                 Lobed deterministic lakes (point-in-polygon)
    density.js               treeDensity field (woods, lake-ring, heart-core gap-fill)
    roles.js                 role tier + off-road road-facing anchor
    festival.js              Per-heart POI plan + cross-hub seam grammar
    placement.js             Per-chunk cluster-center ownership filter
    selftest.js  lint.js     Determinism goldens + layout linter
```

---

## Render pipeline

`main.js` builds:

```
WebGLRenderer  →  EffectComposer
                    ├─ RenderPass (scene, camera)
                    ├─ UnrealBloomPass        (PERF.bloom can disable)
                    ├─ Trip.pass              (custom ShaderPass — no-op at intensity 0)
                    └─ OutputPass
```

- `ACESFilmicToneMapping`, exposure `1.05`, sRGB output.
- Pixel ratio capped at `PERF.pixelRatioCap`.
- Shadows + shadow type are profile-gated.
- The bloom pass renders at half-res (`width * 0.5`).

Resize is driven by `window.visualViewport` so the canvas tracks the iOS URL bar correctly.

---

## Main loop

```
tick()
  ├─ shouldRunFrame(dt)         ← debug.js can pause / single-step
  └─ tickBody(dt)
        ├─ Zerble physics
        ├─ Sound.setEngineSpeed / setNightness
        ├─ Input edges → honk / view toggle / Y (trip accept)
        ├─ Bubbles.update / Crowd.update / Smiles.update
        ├─ Obstacles update — puppets, band, kids, wooks
        ├─ Trip.update / Lurleen.update
        ├─ Stage performers + light show
        ├─ Campsite + drum-circle animatables
        ├─ Forest drum-circle spatial lowpass
        ├─ World.update (expand chunks/lakes)
        ├─ resolveCollision(zerble, allColliders)
        ├─ honkRing expansion
        ├─ chaseCam.update
        ├─ Sound.updateAudioListener
        └─ composer.render()
```

Backgrounded tabs use `setTimeout(tick, 16)` instead of `requestAnimationFrame`, because RAF throttles to ~0 fps when `document.hidden` — and the Claude Preview MCP runs the page hidden.

---

## World generation

> **Read this first — which path is live.** The shipped production world is
> **worldgen v2** (system 4 below; `USE_WORLDGEN_V2 = true`, `perf.js:42`, default
> since 2026-06-16). Sections 1–3 describe the **legacy v1** path — the per-chunk
> theme dice-roll, 3×3 forest blocks, and their lake placement — which now runs
> **only** under `?worldgen=0` (an escape hatch slated for removal). The *chunk +
> lake lifecycle mechanics* in 1–3 (load/unload, disposal, registry, `chunkKey`
> rules) are shared by both paths and still current; the *content-selection*
> described in 1–3 ("each chunk picks a theme", walled forests) is v1-only. When in
> doubt about what a player sees, read **system 4**.

Three independent lifecycle systems own world content. They all share one registry.

### 1. Chunks (`chunks.js`)

- Grid size: **80m**. Chunk key is `${cx}_${cz}`.
- Lazy-loaded as Zerble approaches; **unloaded** once the player moves beyond `UNLOAD_RADIUS` (hysteresis vs the smaller load radius so a boundary straddle doesn't thrash). Unload goes through `disposeChunkByKey` → `registry.removeChunk(key)` (`chunks.js:343-356,540`).
- Each chunk picks a theme from `(cx, cz)` hash:
  - `main_stage` — only at `(0, 0)`. Big stage + dense audience.
  - `side_stage`, `food_plaza`, `vendor_row`, `drum_circle`, `grove`, `open_lawn`.
- Every chunk also lays down a path stripe along its primary axis. NPC AI prefers to walk near paths.
- Chunks consult `lakes.chunkInLake` / `forests.chunkInForest` and skip generation when overlapping.

### 2. Forests (`forests.js`)

- **3x3 chunk blocks** pinned to the chunk grid. The center chunk hosts the forest; the 8 neighbours form the canopy.
- Decision rule: within every 5x5 chunk block, the center offset `(2, 2)` is the only candidate. This guarantees ≥2 chunks of clear space between any two forests.
- Some forests have a path entry on one cardinal side leading to an interior clearing. Clearings may host:
  - a campsite, or
  - a **LEAF-style drum circle** — stone firepit, log benches, tribal figures (dancers, drummers, firekeeper).
- Forest entries register edge colliders (gap on the path side) so Zerble physically cannot drive through the trees.

### 3. Lakes (`lakes.js`)

- Independent of the chunk grid. Lakes live on a **320m macrocell grid**.
- Body radius 70–100m (large) or 25–40m (small), placed deterministically within the macrocell.
- Load when within `LOAD_RADIUS` of the player, unload past `LOAD_RADIUS_UNLOAD` — so they don't pop in/out at chunk boundaries.
- Their unload hysteresis can retain lake groups out to 1,500m, while fog is fully opaque by 520m. The gameplay camera's `PERF.cameraFar = 1040` drops that invisible tail but remains beyond every recentered backdrop (sky 900m, stars 850m, worst-case mountain geometry ~1,012m).
- Register colliders (radial wall) **without** a `chunkKey`, so chunk unload doesn't tear them down.
- Lakes own: canoes, beaches, lakeside campsites. Chunks consult the registry to avoid placing paths or decorations on water.

### Determinism

`rng.js` provides `hash2(x, y)` (32-bit mixing) and `mulberry32(seed)` (seeded PRNG). Every procedural decision — chunk theme, prop placement, lake position, forest contents — is hashed from grid coordinates plus a salt. The world is identical across reloads at the same coordinates.

### 4. Worldgen v2 — the procedural map generator (`src/worldgen/`)

A second, **render-agnostic** world generator that replaces the per-chunk theme dice-roll (system 1) and the 3×3 forest blocks (system 2) with one coherent festival layout. **Now the default** (`USE_WORLDGEN_V2 = true`, `perf.js:42`, landed 2026-06-16): production ships the v2 procedural festival; `?worldgen=0` forces the legacy v1 world (an escape hatch slated for removal), `?worldgen=1` forces v2. The flag is resolved once at module load and read once per chunk.

**The contract (`index.js`).** `queryPoint(x, z)` returns a plain-data tuple — `heart`, `heartInfluence`, `roleTier`, `onRoad`/`facing`, `inLake`, `noBuild`, `treeDensity`, … — with **no `three` and no DOM**. The seed is module-global (one door: `setSeed` → `rng.setSessionSeed`, the same `?seed=` uses), and the tuple is **append-only** across the 2D→3D boundary (the 3D port may add fields but must never reorder/re-salt existing draws — footgun #4). This is why the same seed reproduces the same world in the 2D map sandbox and the live 3D game.

**The layers** (each pure, memoized per `(seed, epoch)`, quantized to integer meters so determinism is engine-stable):

- **`hearts.js`** — rank-weighted festival anchors on a coarse macrocell grid. Everything downstream derives its role from the nearest heart.
- **`roads.js`** — arterials as pair-hash-seeded meanders owned end-to-end by the unordered heart pair (no per-chunk seam-kink). Edge set = symmetric union of each heart's K-nearest.
- **`water.js`** — lobed, jittered lakes; point-in-polygon containment. (Rivers are stubbed off — `onRiver`/`bridge` always false.)
- **`density.js`** — the `treeDensity` field: organic woodland, a lakeshore ring, and a heart-core gap (0 at a core, ramping back across its district).
- **`festival.js`** — the **per-heart POI plan**: a single-pass priority **zone slotter** places the stage (at the heart, facing the driest road gap), then vendor aisles, food courts off side roads, a rear-biased drum circle, potties + a welfare-station bubble vendor, and a major-hub arch — each omitted if its oriented extent can't clear the already-placed zones. Output is **descriptors** (`{kind, x, z, yaw, scale, clusterSeed, …}`), pure data. Where two dense hubs' fronts meet, a **cross-hub seam grammar** classifies the clash by integer hub-priority and resolves it identically for both hubs with no communication: `merged_court` (food+food → one court), `shared_street` (vendor rows fuse/trim), `yield` (a drum cedes to a neighbour stage), `soft_buffer` (loud meets quiet → dress with a shrub hedge, don't delete). Camp villages live on a separate coarse grid (the "back of the festival").
- **`placement.js`** — the per-chunk **filter**: selects the clusters whose *center* falls in this chunk (cluster-center ownership — the owning chunk builds the whole cluster, which may spill into neighbours), so a cluster can't appear/vanish based on which overlapping chunk asks (window-invariance).

**How `chunks.js` consumes it.** When the flag is on, `_generateWorldgen(ctx)` runs instead of the v1 theme path: `placeWorldgenRoads` (ribbon meshes) → `placeWorldgenProps` (dispatch each descriptor through `buildWorldgenKind` → `buildStage`/`buildFoodCourtAt`/`buildVendorRowAt`/`buildWorldgenDrumCircle` + `buildDrumAccessPath`/`buildCampVillageAt`/`buildBubbleVendorAt`/`buildPottyBankAt`/`buildEntranceArchAt`) → `scatterWorldgenTrees` (density-driven woods with a thicket gradient + posted hammocks + shrub undergrowth) → heart-influence-weighted `spawnAmbientCrowd` → `scatterBubbleJugs` → `scatterWorldgenCampsites` (outskirts camps) → `placeSeamHedges` (the soft_buffer shrub dressing). The build half derives all model variation from each descriptor's `clusterSeed`, never `ctx.rng`, so descriptor-count changes never desync a chunk's other consumers (R19).

**vs. v1:** no per-chunk themes and no walled forest blocks — instead, festival clusters anchored at hearts, drive-through scattered woods (dense cores pack tight enough to be impassable thickets, fringes stay drivable), and drum circles discovered down a footpath in a tree-cleared pocket.

**Determinism + iteration.** `selftest.js` freezes two golden hashes — a **queryPoint golden** (the existence layer: roads/water/hearts/density) and a **POI golden** (`festivalPlan` per heart + camp villages); the queryPoint golden must stay frozen across any layout change. `lint.js` is a rules-as-data layout linter (booth-on-road, water-clear, stage-spacing, …). Two iteration surfaces: **`map-sandbox.html`** (2D top-down of the whole layout, with a seams layer) and **`hub-sandbox.html`** (one full hub in 3D via `buildHubPreview` → the same `buildWorldgenKind` dispatch the streaming world uses — so it shows cluster-level content by construction; the streaming-only passes — tree scatter, shrub undergrowth, seam hedges — are verified in the running game).

---

## Far-field horizon (`farField.js`) — on by default

A render-only "semantic LOD" layer that fills the middle distance (from the
chunk load ring out to the 520m fog-opaque limit on every tier — low
originally stopped at 340m, but the unproxied 340–520m band read as missing
content on real devices and was extended 2026-08-28) with batched festival
silhouettes and coarse forest masses, so hubs read as destinations through
the fog instead of popping out of empty grass. **Default on since 2026-08-28**
(promotion gates + sign-off; see CHANGELOG). Effective enablement is
`farFieldRequested && USE_WORLDGEN_V2` (`?farField=0` is the one-variable
A/B control; `?worldgen=0` kills it — v2 proxies over the v1 world would
never hand off). Disabled means a two-boolean shell: no pools, no shader
programs, no planning, nothing in the scene.

**Shape.** A PEER of `ChunkManager`/`LakeManager`, owned by `world.js` —
never a wider chunk ring. It consumes the same pure worldgen descriptors the
real builders use (`heartsInBounds` → `festivalPlan`, `roadsInBounds`),
copies them into compact owned records (shared memoized arrays are never
mutated — `bin/test-far-field` hashes them pre/post), and owns exactly seven
draws: six fixed-capacity `InstancedMesh` pools (stage canopies, truss
posts/beams, vendor roof-peak strips, warm night markers, colored stage
beacons, and coarse forest masses — detail-0 icosa domes sampled from the
`treeDensity` field on a per-tier world-anchored grid, never the exact
far-tree scatter; per-instance color, unlit `MeshBasicMaterial`, fog-aware,
no shadows, frustum culling deliberately off since the layer rings the
player) plus one preallocated road-ribbon underlay at y=0.03 (opaque,
`depthWrite:true`, slightly narrower than the real y=0.06 road so the
authoritative ribbon always covers it) — and it registers **nothing**: no
registry entries, colliders, crowds, audio, lights, pickups.

**Planning.** Boundary-triggered on 80m player-cell crossings, incremental
per 240m coarse cell (never one monolithic ~1km² query), and versioned by the
requesting player cell so rapid teleports supersede stale pending snapshots
while the previous committed horizon stays visible. Planning spends only the
*remainder* of the world-owned streaming wall (`PERF.chunkBudgetMs`) after
lakes + chunks — there is no second budget. Pools keep the deterministic
nearest candidates under per-tier caps (anchored to the player-cell center,
so contents are byte-stable per cell), and palette/variation come from pure
integer hashes over descriptor identity — zero RNG draws, so worldgen goldens
cannot move.

**Handoff.** Each proxy instance carries its owning cluster's chunk cell (via
`ownerCellCoord`, the one exported owner-cell rule). When
`ChunkManager.isLoaded(cx, cz)` — the narrow "fully built" completion
predicate, the only window FarField gets into chunk lifecycle — flips true,
the whole cluster proxy dissolves over 0.3s through a per-instance Bayer
screen-door discard (`onBeforeCompile` on the batch materials, one stable
program cache key, still opaque + depth-writing, so no transparent sorting);
reduced motion (read live each frame) snaps instead. When the chunk unloads,
the proxy reappears the same way.

**Iteration surfaces.** The hub sandbox's *Far field* panel runs the real
FarField around one hub (proxy-only / real-only / simulated-distance handoff,
live stats); in the game, `__dbg.horizon()` reads live stats and
`horizon('proxy'|'real'|'live'|'replan')` forces states for fixed-seed A/B
captures. See DEBUGGING.md. Tier knobs (radius, density, pool caps, cold-step
gate) live in `perf.js` under `farField`.

---

## The Registry (`registry.js`)

A single store mapping `id → entry`. Every "thing in the world" registers itself. Entries can have:

- `kind` — `'stage' | 'tent' | 'truck' | 'tree' | 'lamppost' | 'arch' | 'puppet' | 'lake_edge' | 'firepit' | 'forest_tree' | 'drum_circle' | 'lurleen' | 'wook' | …`
- `position` — `Vector3`
- `footprint` — NPC-avoidance radius
- `collider` — optional hard collider for Zerble: `{ radius, damage }`
- `attractor` — optional crowd magnet: `{ radius, weight }`
- `chunkKey` — optional. When the chunk unloads, entries with this key are removed.

Consumers:

- **Crowd AI** queries footprints (avoidance) + attractors (points of interest).
- **Collision system** in `main.js` reads `registry.colliders()` each frame.

---

## Collision model

Centralized in `main.js#resolveCollision`. Each frame builds a list of candidate colliders:

```
allColliders = [
  ...registry.colliders(),
  ...puppets.colliders, ...band.colliders, ...kids.colliders, ...wooks.colliders,
  ...hoopers.colliders, ...frisbees.colliders,
  ...crowdNPCsWithinBroadphase,        // 6m broadphase reject
]
```

For each collider closer than `c.radius + zerble.radius`:

- Compute **approach speed** as the dot of Zerble's velocity with the contact normal.
- If `approachSpeed > APPROACH_DAMAGE_THRESHOLD` (1.2 m/s) → **damaging hit**. Apply knockback to Zerble, panic the NPC, deduct smiles, play kind-specific SFX, show toast.
- Else → **silent overlap-resolve.** Project Zerble out of the radius, bleed off the small approach speed. No score change.

This is what lets you brush against people at a crawl without losing smiles, while still getting punished for driving full speed into a crowd.

`passive` colliders are visible to the registry but skipped here — they're proximity triggers, not physical objects.

The global frisbee pairs in `obstacles.js` use a `held → flying → landed`
disc state machine. Each player's two-joint arm rig is relaxed by default. The
holder blends through an across-the-body 90-degree elbow windup and a straight
forward release during the last 720ms of the hold, while the catcher raises one
arm only as the disc comes within 3m. The held disc follows the real animated
hand joint, and every pair owns one reusable hand-position vector so the update
path does not allocate animation objects per frame.

---

## Crowd (`crowd.js`)

A pool of stateful NPCs spawned by chunks.

- **Personality:** `curiosity`, `skittishness`, `energy`, `social`, `talkativeness` — random per NPC.
- **States:** `idle → walking → watching → approaching → fleeing → smiling → riding/boarding`. A transient **cheer** (driven by `cheerNear`, fired on a stage song-end) adds a jump, arms-up pose, and smile for about five seconds. Rare photographers use a short `photographer_notice → photographer_pose → watching` branch, which faces Zerble, raises the pooled camera, optionally crouches, and fires one 120ms mesh flash.
- **Steering:** seek target + repel from registry footprints + neighbor separation + path attraction.
- **Smile mechanic:** eye contact with Zerble plus bubble proximity raises an internal happiness counter. On threshold → emit a smile pickup, record Zerble's at-smile position. The same NPC won't smile again until Zerble has driven `SMILE_RESET_DIST` away (prevents parking-near-crowd farming) **and** a cooldown elapses.
- **Hit response:** `onZerbleHit(npc, nx, nz)` panics the victim, applies knockback, and infects nearby NPCs into a brief fleeing state.
- **Photographer determinism and rendering:** `photographer.js` derives the rare role from quantized spawn position, session seed, and a dedicated salt, then keeps later cooldown rolls on the NPC's private stream. It consumes no chunk or crowd RNG calls. The camera and opaque, unlit flash use two `InstancedMesh` pools with a separately packed photographer slot range, add no lights or shadow casters, and are zeroed when a distant NPC despawns.

---

## Zerble (`zerble.js`)

Anthropomorphic golf cart. ~950 lines of geometry + physics.

- Arcade driving: throttle/brake/turn/drag/boost. `MAX_SPEED = 18 m/s`, `BOOST_MULT = 1.55`, `TURN_RATE = 2.1 rad/s`.
- Boosting above the streak threshold feeds `BoostStreaks`, a fixed eight-instance pool of cart-sized golden torus wake rings. They spawn beyond the rear bumper, remain in world space as Zerble moves away, expand, then return to zero-scale matrices. The immutable geometry is shared, while each pool owns its one material so sandbox teardown cannot invalidate a later preview. Reduced motion and the live player/quality effects gate both stop emission, and the update path creates no per-frame objects.
- Visible parts: red body, gold roof, blue seat, glowing cyan eyes, purple mustache, four wheels.
- Eye glow ramps with `nightness` and can be hand-tuned with `I` / `O`.
- World-bounded by `WORLD_BOUND = 230` so the player can't outrun the festival's "feel."
- `applyHit(pushDir)` adds an invulnerability window and a knockback impulse.

---

## Time of day (`timeOfDay.js`)

Single normalized `t ∈ [0, 1)`: `0`=dawn, `0.25`=noon, `0.5`=dusk, `0.75`=midnight. Cycle length is `CYCLE_SECONDS`.

Drives:

- Sky shader top/bottom colors
- Sun directional light (color, intensity, arc)
- Hemisphere light intensity
- Fog color
- A `nightness ∈ [0, 1]` accessor (smooth ramp, 0 at midday, 1 at midnight) consumed by:
  - Stage light shows, lampposts, tiki torches (fade in)
  - Drum-circle audio scheduler (more voices at night)
  - Crackling-fire bed (only audible after dusk)
  - Zerble's eye glow (subtle ramp)
  - Star field opacity

---

## Audio (`sound.js`)

All synthesized — no audio files shipped. ~3000 lines of Web Audio nodes.

- **Engine.** A pair of detuned sawtooth oscillators (gas-engine buzz) mixed with LPF-filtered noise (rumble). Speed scales gain + pitch + a putt-putt LFO. Boost engages a second tier with extra harmonics. At zero speed, fades to silence in ~80ms. `createEngine(ctx, dest, opts)` is profile-driven: the defaults are Zerble's wheezy gas-engine (mono, direct to `sfxBus`, fed `Sound.setEngineSpeed` with his explicit boost). **Lurleen** runs a second instance with a higher/brighter/cleaner profile (raised `pitchMul`, gentler tanh soft-clip, less noise) so her motor reads as a distinct, lighter sibling. Hers is `spatial: true` — wrapped in an `equalpower` PannerNode driven to her world position by `Sound.setLurleenEngine(speed, x, z)` (called from main.js after `lurleen.update()`), so it pans + attenuates with distance. She has no throttle, so `accelBoost` derives the rev from her *acceleration* — it growls up as she speeds to catch the player, eases off when she coasts.
- **Collisions.** Per-`kind` one-shot synth hits: drums for stages, metallic clangs for trucks/lampposts, nasal boops for kids/puppets, brass for the band, wood knocks for the arch, a "duuude" drone for wooks.
- **Honks.** Bicycle bell (struck-tine + trill envelope) or clown horn (2-phase honk + inhale fifth up).
- **Bubble juice.** The nonempty-to-empty edge in `main.js` calls one synthesized sputter made from a falling saw voice, a square-wave flutter, and a closing low-pass filter. The latch resets only after juice becomes nonempty again, so an empty tank cannot spam audio. The sound is added behind the existing synchronous `Sound.init()` title-tap chain rather than introducing another initialization path.
- **Drum circles.** A per-circle music scheduler. Voice density gates on `nightness`. A **lowpass cutoff** is set every frame from main.js based on distance from the body perimeter — drums sound wide-open from inside the circle, muffled by trees as you leave.
- **Stage music = songform.** The melodic stage genres (`jam`, `brass`, `dance`, `world`, `dub`) run through one shared engine, `runStageSong(ctx, panner, seed, genreDef)`. Each genre def supplies its voices + a per-beat synth callback; the engine owns the song lifecycle: a finite arc of named **sections** (intro→verse/build→chorus/drop→bridge/break→outro) with per-section active-voice sets and intensity, **per-song tempo + key** (re-rolled within the genre's range each song, never repeating the last key), tempo wobble, dynamics-coupled rest probability, shuffled variant selection, and lead-timbre drift. At the outro it enters a ~4.5s **cheer gap**, fires `onSongEnd`, then starts a fresh song. `drum` / `forest_drum` / `second_line` stay continuous (no songform). `chunks.js` picks each stage's genre from a seeded palette (origin 0,0 stays `jam`). Per-stage a `master` gain rides distance for ~1.5s cross-fades between stages. Bussed through `musicBus`, balanced against `sfxBus`.
- **Crowd cheer.** `Sound.onSongEnd(cb)` lets a song-end signal the world; `_emitSongEnd(x,z)` plays a positional applause/"wooo" swell (`playCrowdCheer`) and calls the registered callback → `crowd.cheerNear`. `Sound._debugEndSong()` forces it for testing.
- **MIDI player (`midiPlayer.js`).** The M-key player routes each parsed track to a synth pool by GM program/percussion (`GM_CATEGORY` → drum kit / bass / lead / pad). Effect chain: vibrato → autofilter → ping-pong delay → short reverb (+ a parallel 12s reverb) → an inline-AudioWorklet **granular** node → midiGain. The trip envelope swells the long reverb + granular at the climax. Tracks are individually mutable (`getTracks` / `setTrackMute`). Output routes into Sound's `midiGain` so Master + a MIDI fader both apply.
- **Nature bed.** Birdsong (positional, time-of-day-gated), crickets + frogs (now panned toward the nearest forest/lake), and a deep-night owl, all through `natureBus` (own trip chain, own volume fader `zerble.vol.nature`).
- **Listener.** Camera position + forward feed into the Web Audio AudioListener every frame for spatial pan.

iOS specifics: `Sound.init()` must run **synchronously inside the tap handler** so the AudioContext starts in `running` state. The visibilitychange / pageshow / pointerdown / touchstart handlers all call `Sound.resume()` to recover from iOS suspending the context.

---

## Input (`input.js`, `touch.js`)

- `input.js` tracks held keys + edge events. Exposes `Input.throttle`, `.steer`, `.boost`, `.held(key)`, `.consumePressed(key)`.
- `touch.js` installs a virtual thumbstick (left), Boost/Honk/Cam buttons (right), and drag-anywhere-else for camera orbit. It pushes axes + edge events back into `Input` so the rest of the game is input-source-agnostic.
- Body class `.is-touch` on detection reveals the touch overlay.
- iOS pinch + double-tap zooming are killed at the document level.

---

## Camera (`camera.js`)

Three modes, cycled with `V` or the Cam button:

1. **Chase** — fixed offset behind Zerble, smooth follow. Arrow keys add **persistent** yaw/pitch offsets (no auto-snap-back).
2. **First-person** — eye level, follows heading.
3. **Top-down** — zoomable via `↑`/`↓` or mouse wheel.

---

## Models (`src/models/`)

Each file exports one or more `buildX(...)` functions that return a `THREE.Group` anchored at `(0, 0, 0)`. Callers position and rotate the group themselves.

Animated bits (firepit flicker, tiki flame, tapestry sway, tribal-figure motion) attach an updater closure or expose an `anim` object on the returned group. A central per-frame updater in `main.js` walks the animatables lists owned by chunks (`forestAnimatables`), lakes (`lakeAnimatables`), and drum circles (`forestDrumCircles`).

Notable model files:

- **`zerble.js`** + **`lurleen.js`** — full character carts. Stay in `src/` (not `models/`) because they carry physics + state, not just geometry.
- **`leafDrumCircle.js`** + **`tribalFigures.js`** — the centerpiece of the forest drum-circle theme.
- **`campsite.js`** — tents, chairs, firepit, tiki torch, tapestries.
- **`puppet.js`** — also exports `buildSimpleNPC` used as the base humanoid for band members, kids, and crowd NPCs.

---

## Performance (`perf.js`)

Boot-time device sniff: touch capability, screen size, `hardwareConcurrency`, `deviceMemory`. Picks one of three profiles:

| Knob | low | mid | high |
|---|---|---|---|
| `pixelRatioCap` | 1.25 | 1.5 | 2.0 |
| `shadows` | off | on | on |
| `shadowType` | basic | basic | soft |
| `bloom` | on | on | on |
| `crowd density` | thin | medium | dense |
| `chunk draw radius` | small | medium | large |
| `chunk generation wall` | 3ms | 4ms | 5ms |
| `camera far plane` | 1040m | 1040m | 1040m |

Override at the URL: `?perf=low` (or `mid` / `high`). Or at runtime: `window.__perfProfile = 'low'; location.reload()`.

After the eager spawn ring, chunk streaming starts the closest missing chunk and
keeps starting additional chunks only while the profile's generation wall remains.
The wall prevents a second chunk from compounding an already-expensive frame; the
separate phased-deferral path is responsible for splitting one dense chunk itself.

`adaptiveQuality.js` layers a live seven-rung governor over the boot profile. It
drops quickly under sustained slow or severely hitched frames, but recovery is
intentionally slower: every transition clears the 90-frame observation window,
a downgraded rung is held for at least 30 seconds, and a recovery that fails
within 15 seconds backs off that specific boundary for two minutes, doubling to
a five-minute cap. This prevents fancy bubbles and shadows from visibly toggling
back and forth when a device sits close to a quality boundary.

---

## HUD (`hud.js`, `styles.css`)

Vanilla DOM, no framework.

- Compact status rail with current smiles, a de-emphasized best persisted to `localStorage` as `zerble-best-smiles`, bubble juice, the live day/night dial, and a conditional Lurleen-following heart. Score increases restart a warm CSS pulse, while the first saved-best increase in a session fires one bounded DOM confetti burst. Reduced motion suppresses the moving confetti and holds the score cue to a static color change.
- Toast strip — short status messages with a fade timer.
- Hit flash — red vignette pulse on damage.
- Title card — full-screen overlay before start. Its static HTML keeps Start and Settings disabled while an inline bubble-pressure loader runs independently of the slow module graph; `HUD.onStart` installs the trusted-gesture handler, marks the loader ready, restores the Start/Resume label, and only then enables the controls. The ready loader holds for 1.1 seconds, then fades and collapses out of the title layout.

---

## Analytics (`analytics.js`)

Thin `gtag` wrapper. Events:

- `game_start`
- `first_honk`
- `smile_milestone` (10, 25, 50, 100, 250, 500, 1000, 2500)
- `personal_best`
- `collision` (by kind)
- `view_toggle` (mode)
- `lurleen_found`

`try`/`catch` around every `gtag` call so analytics failures (ad blockers, offline dev) never break gameplay.

---

## Cross-system threads to be aware of

1. **`nightness` is global state read everywhere.** Renderer doesn't know about it; world systems poll `getTimeOfDay()` every frame.
2. **Registry mutations are not transactional.** Chunks add then unload by `chunkKey`. Lakes deliberately omit `chunkKey`. Don't accidentally tag lake entries with one or they'll vanish when their host chunk unloads.
3. **InstancedMesh objects** (bubbles, parts of the crowd) need `instanceMatrix.needsUpdate = true` after every frame's writes — easy to forget when refactoring.
4. **Sound must initialize inside a user gesture.** Adding any `await` / `setTimeout` between the tap and `Sound.init()` breaks iOS audio silently.
5. **Determinism depends on hash inputs.** If you add salt to a chunk RNG call, prior chunks regenerate differently — fine for greenfield, painful if a player is mid-session and chunks reload.

---

## Where to start reading

If you only read three files, read them in this order:

1. **`src/main.js`** — the whole loop, top to bottom.
2. **`src/chunks.js`** — how the world is built.
3. **`src/crowd.js`** — where the game's "feel" lives.

After that, dip into any model file when you want to see how something specific is constructed — they're all standalone, all small, all readable.
