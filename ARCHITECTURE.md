# Architecture

How Zerble at the Festival fits together. Aimed at someone who has cloned the repo and wants to understand the moving parts before editing anything.

> For the **per-capability contract** ("what does subsystem X guarantee"), see the
> canonical specs in [`openspec/specs/`](openspec/specs/README.md) — 20 capabilities in
> Requirement/Scenario form, traced to code. This file is the prose walkthrough; those
> are the contract.

For local setup and verification, use [DEBUGGING.md](DEBUGGING.md); for the
full reference map, use the [documentation index](docs/README.md).

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
  people/                   Registered populations, stable lifetimes, activity claims and queries
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
                    ├─ InfoCapturePass        (scene draw/triangle counters)
                    ├─ UnrealBloomPass        (PERF.bloom can disable)
                    ├─ Trip.pass              (custom ShaderPass — no-op at intensity 0)
                    ├─ FXAAPass               (mid/low tiers)
                    └─ OutputPass
```

- `ACESFilmicToneMapping`, exposure `1.05`, sRGB output.
- Pixel ratio capped at `PERF.pixelRatioCap`.
- Before `HUD.onStart` arms the mode planks, `preparePostprocessing.js` awaits
  compilation of the eight bloom materials and the Trip material, then draws
  them once offscreen into the live composer buffers. Compilation uses the
  composer target so its output color space and tone-mapping program keys match
  later draws. Renderer target/clear state and pass policy are restored, the
  temporary geometry is disposed, and the live passes retain their materials.
  A failure warns and permits ordinary lazy compilation. This loading step
  precedes the synchronous iOS audio gesture callback and the main frame loop.
  Device reports record its status, material count and duration in
  `session.postprocessPreparation`.
- Shadows + shadow type are profile-gated.
- The bloom pass makes its own half-resolution target from the composer's
  physical dimensions. `renderSizing.js` resizes renderer, composer, bloom,
  FXAA, and camera together when the viewport or adaptive pixel ratio changes.
- Shadow Off gates the sun's `castShadow` state. `timeOfDay.js` applies this
  policy alongside its night gate, including after new meshes stream in.

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

The isolated `terrain-sandbox.html` proof uses `terrainSurface.js` for a fixed
world-space one-meter triangle lattice and `terrainDriving.js` for opt-in
slope-aware movement. `Zerble.surfaceSampler` defaults to null; only this proof
enables it, leaving the live movement and world sampler unchanged. Four wheel
samples establish chassis pitch/roll, bounded suspension settles each wheel,
and cart-local seat/nozzle transforms include the tilt. `terrainSandbox.js`
owns the course meshes, controls, fixed-step replay and camera clearance checks.
It does not stream or place festival content. [Verification](verification/terrain/2026-10-24-driving-proof.md).

The flat ground is one player-following mesh in `world.js`. It moves in 40m
world-aligned steps, which are multiples of its 10m vertex spacing, so the
procedural vertex-color patches remain fixed under roads and props. A single
seamless 512px grass texture adds fine variation; its UV offset tracks the same
world coordinates. The texture repeats every 128m, while separately hashed
96m and 35m vertex-color fields vary across the whole world, breaking up any
visible repetition without additional ground meshes or draw calls. The ground
mesh uses 140 segments per side, down from 220 before the texture was added.

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
  - a **woodland drum circle** — stone firepit, log benches, tribal figures (dancers, drummers, firekeeper).
- Forest entries register edge colliders (gap on the path side) so Zerble physically cannot drive through the trees.

### 3. Lakes (`lakes.js`)

- Independent of the chunk grid. Lakes live on a **320m macrocell grid**.
- Body radius 70–100m (large) or 25–40m (small), placed deterministically within the macrocell.
- Load when within `LOAD_RADIUS` of the player, unload past `LOAD_RADIUS_UNLOAD` — so they don't pop in/out at chunk boundaries.
- Their unload hysteresis can retain lake groups out to 1,500m, while fog is fully opaque by 520m. The gameplay camera's `PERF.cameraFar = 1040` drops that invisible tail but remains beyond every recentered backdrop (sky 900m, stars 850m, worst-case mountain geometry ~1,012m).
- Register colliders (radial wall) **without** a `chunkKey`, so chunk unload doesn't tear them down.
- Lakes own: canoes, beaches, lakeside campsites. Chunks consult the registry to avoid placing paths or decorations on water.

### Shared tree and bird rendering

`src/models/tree.js` separates deterministic tree descriptors from their rendered
shape. Four shared unit geometries provide clustered broadleaf crowns, irregular
pine skirts, tapered trunks and forked trunks; standalone previews and the six
forest instance buckets consume those same buffers. Crown and perch coordinates
remain descriptor data, independent of visual detail. Tree hammocks calculate each
facing bark contact at its world attachment height using the descriptor taper and
the supporting tree's ground height.

`src/models/bird.js` owns cached species anatomy, baked vertex colors and the wing
pose helpers used by both previews and `src/birds.js`. Each species uses body,
left-wing and right-wing instance batches, with positive transforms and a baked
mirrored right wing. The controller follows terrain-relative cruise heights and
registry perch/crown data, while tier population caps and the 15-batch ceiling
bound rendering cost. Shared buffers and materials survive chunk disposal.
[Measured costs and verification](verification/wildlife/2026-10-25/README.md)
record the added triangle cost separately from draw counts and device performance.

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
- **`festival.js`** — the **per-heart POI plan**: a single-pass priority **zone slotter** places the stage (at the heart, facing the driest road gap), then vendor aisles, food courts off side roads, a rear-biased drum circle, potties + a welfare-station bubble vendor, and a major-hub arch — each omitted if its oriented extent can't clear the already-placed zones. Major hubs attempt one court; a separate deterministic gate lets 75% of minor hubs attempt one, before the usual fit checks. Output is **descriptors** (`{kind, x, z, yaw, scale, clusterSeed, …}`), pure data. Where two dense hubs' fronts meet, a **cross-hub seam grammar** classifies the clash by integer hub-priority and resolves it identically for both hubs with no communication: `merged_court` (food+food → one court), `shared_street` (vendor rows fuse/trim), `yield` (a drum cedes to a neighbour stage), `soft_buffer` (loud meets quiet → dress with a shrub hedge, don't delete). Camp villages live on a separate coarse grid (the "back of the festival"). `welcomeFoodCourt()` selects one surviving court from the spawn hub and nearby hubs for a guaranteed Sugar Shack roll; it does not alter the POI plan, and the builder still rejects unsafe Shack locations.
- **`placement.js`** — the per-chunk **filter**: selects the clusters whose *center* falls in this chunk (cluster-center ownership — the owning chunk builds the whole cluster, which may spill into neighbours), so a cluster can't appear/vanish based on which overlapping chunk asks (window-invariance).

**How `chunks.js` consumes it.** When the flag is on, `_generateWorldgen(ctx)` runs instead of the v1 theme path: `placeWorldgenRoads` (ribbon meshes) → `placeWorldgenProps` (dispatch each descriptor through `buildWorldgenKind` → `buildStage`/`buildFoodCourtAt`/`buildVendorRowAt`/`buildWorldgenDrumCircle` + `buildDrumAccessPath`/`buildCampVillageAt`/`buildBubbleVendorAt`/`buildPottyBankAt`/`buildEntranceArchAt`) → `placeWoodlandCamping` (density-fitted households and road access) → `scatterWorldgenTrees` (density-driven woods with a thicket gradient + posted hammocks + shrub undergrowth) → heart-influence-weighted `spawnAmbientCrowd` → `scatterBubbleJugs` → `scatterWorldgenCampsites` (outskirts camps) → `placeSeamHedges` (the soft_buffer shrub dressing). The build half derives all model variation from each descriptor's `clusterSeed`, never `ctx.rng`, so descriptor-count changes never desync a chunk's other consumers (R19).

**Woodland camping.** `src/woodlandCamping.js` derives bounded, seed/epoch-cached households from substantial woodland in the density field. It rejects road, lake and planned-venue conflicts and supplies compact sleeping-only pitches plus access corridors. Only the road approach is rendered; internal walking gaps reserve tree clearance while retaining grass. Every chunk queries that same plan for tree/undergrowth clearance, including before its host chunk loads. The host-center owner builds the whole household and its paths; resident NPCs, registry entries, geometry and animation hooks share that owner for teardown. Independent salted streams preserve the existing chunk RNG. The preview calls the real builder and tree scatter rather than drawing an approximation.

**Camp ensembles.** `campJamActivity.js` owns bounded two-to-four-person evening sessions through the existing Crowd update. Jobs claim actual hearth-side seats or clear standing locations, fetch at registered tent doors, play together and return instruments; interruption or registry unloading releases claims and models. `campInstruments.js` pools the five instrument families, while `campMusic.js` supplies a deterministic score and bounded timer-free Web Audio voices. Sound adopts pending ensembles through its existing context and music bus, then ticks them with listener updates.

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
mutated — `bin/test-far-field` hashes them pre/post), and owns at most eight
draws: seven fixed-capacity `InstancedMesh` pools (gabled stage/marquee roofs,
closed marquee rear walls, stage/truss surfaces, open four-triangle vendor and
camp roof peaks, warm night markers, colored stage
beacons, and coarse forest masses — detail-0 icosa domes sampled from the
`treeDensity` field on a per-tier world-anchored grid, never the exact
far-tree scatter; per-instance color, unlit `MeshBasicMaterial` in the game,
fog-aware, with whole-batch linear-color dimming tied to `nightness` so pale
canvas does not stay bright after sunset,
no shadows, frustum culling deliberately off since the layer rings the
player) plus one preallocated road-ribbon underlay at y=0.03 (opaque,
`depthWrite:true`, slightly narrower than the real y=0.06 road so the
authoritative ribbon always covers it) — and it registers **nothing**: no
registry entries, colliders, crowds, audio, lights, pickups.
The stage, marquee, and vendor roof definitions come from
`src/festivalShapes.js`, which their real model builders also use. Vendor-row
candidate coordinates come from `vendorRowSlots` in `worldgen/placement.js`.
The stage pool includes the raised deck and colored backdrop, and the main
stage beacon clears the roof ridge. The extra marquee wall batch costs one
draw when visible, while the open peak geometry lowers the full-pool triangle
total despite larger roof capacities.
Camp pitches and forest trees still have separate proxy placement rules, so
their near/far identity remains an open visual task.

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
captures. The hub viewer's proxy-only and real-only modes hide the opposing
hub layer, and its toggle preserves the camera. Real-only hides the entire
far-field group, including its road underlay; proxy-only also hides lake-owned
scenery and water because there is no lake proxy to compare. The viewer can compare the
shipping unlit dimmer with scene-lit Lambert surfaces at Noon and Midnight;
the latter is an experiment and the game remains unlit. The unlit palette is
visually tuned, so GPU and phone comparisons still need fresh captures. See
DEBUGGING.md. Tier knobs (radius, density, pool caps, cold-step
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
- **Collision system** in `main.js` queries `registry.collidersNear()` around the cart, then appends moving obstacles and nearby NPCs.

`rebuildSpatialIndex()` synchronizes live positions, footprint classes and
collider membership once per frame. It retains unchanged spatial cells rather
than clearing and reinserting stationary props. Each resident entry has a small
indexed-position record, removed with the entry. Movers crossing an 8m cell
boundary are removed from their indexed cell and inserted in their new cell;
ordered cell buckets preserve the candidate order of a full rebuild. The
largest query pads and the ordered oversized-footprint list still refresh from
live values each frame. A moved entry removed before frame sync uses its
indexed position for cleanup, preventing stale colliders. Same-pass worldgen
queries still see every add/remove immediately.

---

## Collision model

The pure resolver lives in `src/collisionContacts.js`, while main composes registry-first
candidates and registered people providers. The first selected contact invokes its
lifetime-validated callback at the existing scoring barrier. Candidate order is:

```
allColliders = [
  ...nearbyRegistryColliders,         // radius-padded spatial query
  ...orderedPeopleProviders,         // parade, band, children, wooks
  ...eligibleAdultProvider,           // 6m broadphase reject
]
```

For each collider closer than `c.radius + zerble.radius`:

- Compute **approach speed** as the dot of Zerble's velocity with the contact normal.
- If `approachSpeed > APPROACH_DAMAGE_THRESHOLD` (1.2 m/s) → **damaging hit**. Apply knockback to Zerble, panic the NPC, deduct smiles, play kind-specific SFX, show toast.
- Else → **silent overlap-resolve.** Project Zerble out of the radius, bleed off the small approach speed. No score change.

This is what lets you brush against people at a crawl without losing smiles, while still getting punished for driving full speed into a crowd.

`passive` colliders are visible to the registry but skipped here — they're proximity triggers, not physical objects.

Live hula and frisbee participation uses Crowd-owned people and their existing
colliders. `people/hulaActivity.js` owns hoops and attractor reservations, while
`people/frisbeeActivity.js` owns open-ground pair sessions and discs. The frisbee
disc follows a held, flying and landed state machine, and the catcher moves only
through a current claim. Crowd's `writeActivityArmPose(claim, action, amount, dt)`
and `readActivityHand(claim, out)` lend the original body’s shoulder/elbow pose and
hand origin only while its claim and ordinary visible binding remain valid. Pose
revocation restores ordinary arms synchronously. The shared instanced arm geometry
also supports dancers, with matching vertex-normal and sun-depth deformation and
rest-space appearance attributes. The depth material is owned and disposed by Crowd.
`personMotion.js` shares the original throw/catch targets and hula motion formulas;
hula's accepted activity phase drives both its body and offset hoop pivot.
The older standalone performer controllers remain available
for their existing characterization and sandbox paths.

---

## One-wheel riders (`oneWheels.js`)

A bounded, world-owned encounter system follows existing road polylines without
consuming layout RNG. `oneWheelMotion.js` owns a fixed-step route follower with
gradual yielding, per-step clearance, blocked-route reversal and gathering
stops; `oneWheels.js` supplies water, registry and pedestrian queries. At most
two riders are resident, while distance and scene disposal remove their moving
registry entries and owned LED materials. These roaming actors intentionally
have no chunk key, so a host chunk unloading cannot orphan an active rider.
The main loop advances them before synchronizing the registry spatial index.
Their body colliders participate in normal people-hit scoring and consequences.
`models/oneWheelRider.js` pools baked geometry and exposes wheel, lean, head/arm
and day/night LED animation independently from the route controller.

## Crowd (`crowd.js`)

A pool of stateful NPCs spawned by chunks.

- **Personality:** `curiosity`, `skittishness`, `energy`, `social`, `talkativeness` — random per NPC.
- **States:** `idle → walking → watching → approaching → fleeing → smiling → riding/boarding`. A transient **cheer** (driven by `cheerNear`, fired on a stage song-end) adds a jump, arms-up pose, and smile for about five seconds. Rare photographers use a short `photographer_notice → photographer_pose → watching` branch, which faces Zerble, raises the pooled camera, optionally crouches, and fires one 120ms mesh flash.
- **Steering:** seek target + repel from registry footprints + neighbor separation + path attraction.
- **Smile mechanic:** eye contact with Zerble plus bubble proximity raises an internal happiness counter. On threshold → emit a smile pickup, record Zerble's at-smile position. The same NPC won't smile again until Zerble has driven `SMILE_RESET_DIST` away (prevents parking-near-crowd farming) **and** a cooldown elapses.
- **Healing Arts visits:** `healingArtsActivity.js` temporarily claims available crowd members; the tent supplies yoga rigs, while dancers retain their ordinary Crowd body and appearance. At dusk, the class leaves at staggered intervals and regular visitors walk in to dance; dawn releases dancers. Tent unload releases every claim, while the normal distance sweep still owns eventual NPC despawning. `chunks.js` owns the tent update list and nighttime music handle.
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

## Festival Run layer (`runMode.js`, `runState.js`, `scoring.js`, `leaderboard.js`)

The stakes mode, layered over the sandbox without touching it (festival-run-stakes,
2026-08). Four modules plus a per-frame block in `main.js`; Just Cruisin' is
invariant *by construction* — every stakes knob reads one config object rather
than scattering mode checks.

- **`runMode.js`** — the config gate. Two frozen mode configs (Cruisin' answers
  "free / keep everything / never die" at every day; Festival reads the day-ramp
  table: vendor smile-price, jug keep-fraction, frown multiplier, vibe
  warn/eject). Also owns the **jug scarcity filter**: `jugKeptAt(x, z)` is a
  position-hashed keep/drop over already-generated jug placements (fresh salt,
  monotone — a harder day's jugs are a strict subset). `chunks.js` consults it
  strictly AFTER all `ctx.rng()` draws for the jug complete, so seeded worldgen
  streams and draw-count parity are untouched (the determinism tripwire).
  DOM-free; `bin/test-run-mode` + `bin/test-jug-filter`.
- **`runState.js`** — the run machines: run clock, day counter (ticks on
  time-of-day cycle crossings, resume-safe via `prevT`), the 45s sputter grace
  state machine, the decaying vibe meter (warn fires once per climb), death
  causes (`ran_dry` / `vibed_out`), and the once-per-run rescue flag.
  Pure logic, no DOM/three; `bin/test-run-state`.
- **`scoring.js`** — the single score writer (every mutation flows through it):
  chain combo with a rolling window (×2/×3/×4), star-power pin, the Lurleen ×2
  doubler, and the **high-water mark** the leaderboard records — spending smiles
  on refills digs a hole but never erases your best. `bin/test-scoring`.
- **`main.js` run layer** — one gated block per frame: day-crossing toasts +
  ramp re-application, vibe decay, sputter transitions (boost dies + 35% limp
  via `zerble.sputtering`, HUD countdown, chug loop), and the death/rescue
  dispatch. Damaging PEOPLE hits route through ONE gate (`hit.damaging &&
  !isGod()`): combo break, vibe strike, Lurleen scare-off, struck-NPC frown.
  There is a single HUD toast slot — stakes beats (heartbreak, whistle)
  suppress the generic collision quip so a same-frame overwrite can't hide
  them. Deaths lock controls, write the local board, raise the score screen.
- **`leaderboard.js`** — two halves. Local: top-10 in `localStorage`
  (corrupt-JSON tolerant). Global: the fire-and-forget client for the
  Cloudflare Worker board — signed run token, ~60s + milestone heartbeats, a
  final submit at death, and a `pagehide` beacon that sends a BEAT (never an
  end — mobile app-switching fires pagehide, and closing the run server-side
  would freeze a player who merely backgrounded). Every network path is
  timeboxed and error-swallowed; the whole half is hard-disabled until the
  deployed URL is set in the file (`PROD_BOARD_URL`), with a localhost-gated
  `zerble-board-url` localStorage override for dev drills. The Worker itself
  lives at **`workers/leaderboard/`** — deliberately outside the game's
  importmaps and perf surface; its deploy runbook (KV + secrets, Gary-only)
  is in `workers/leaderboard/README.md` + `wrangler.toml`, and
  `bin/test-leaderboard-worker` drives it in plain node with a mock KV.
- **Resume**: the settings "Apply & restart" snapshot carries mode + serialized
  run + scoring state, restored before stakes config so a mid-run reload drops
  you back into the same day with the same vibe meter.

Debug surface: `__dbg.runInfo()/runDay()/vibe()/strike()/sputterLeft()` — see
DEBUGGING.md "Festival Run drills."

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
- `Input.steeringDirection(speed)` selects the steering response for the active steering axis. Keyboard retains throttle-intent steering; nonzero touch steering follows signed travel speed, fading through zero below 1.5 m/s. Zerble uses the legacy response for scripted inputs without that method. Touch axes have independent 0.12 deadzones after radial clamping, so a sideways thumb wobble cannot apply throttle.
- Body class `.is-touch` on detection reveals the touch overlay.
- iOS pinch + double-tap zooming are killed at the document level.

---

## Camera (`camera.js`)

Three modes, cycled with `V` or the Cam button:

1. **Chase** — fixed offset behind Zerble, smooth follow. Arrow keys add **persistent** yaw/pitch offsets (no auto-snap-back).
2. **First-person** — eye level, follows heading.
3. **Top-down** — Zerble faces toward screen-up by default; its independent orbit is zoomable via `↑`/`↓` or mouse wheel and does not change the chase camera bearing.

---

## Models (`src/models/`)

Each file exports one or more `buildX(...)` functions that return a `THREE.Group` anchored at `(0, 0, 0)`. Callers position and rotate the group themselves.

Animated bits (firepit flicker, tiki flame, tapestry sway, tribal-figure motion) attach an updater closure or expose an `anim` object on the returned group. A central per-frame updater in `main.js` walks the animatables lists owned by chunks (`forestAnimatables`), lakes (`lakeAnimatables`), and drum circles (`forestDrumCircles`).

Notable model files:

- **`zerble.js`** + **`lurleen.js`** — full character carts. Stay in `src/` (not `models/`) because they carry physics + state, not just geometry.
- **`leafDrumCircle.js`** + **`tribalFigures.js`** — the centerpiece of the forest drum-circle theme.
- **`campsite.js`** — five shelter families, private sleeping borders, canopy kitchens, lanterns, supported twinkle strands and animated evening tent interiors. Pure `campPlanning.js` supplies archetype recipes and irregular host/satellite neighborhoods; compact pitches share a host's hearth and kitchen, and roomier variants preserve more ground. `models/campChair.js` supplies four pooled chair styles and actual seat heights/offsets. Native-space collider, seat and tent-door metadata feeds `campRegistry.js`, which checks real prop and access clearance before registration. Household reservation envelopes may overlap where the shared ground is empty; actual solids and door/chair approaches cannot. Child entries retain chunk/lake ownership. Crowd NPCs reserve seats, rest by day, gather in the evening and hide inside tents overnight, releasing claims on waking, interruption or unloading. `updateCampsiteProps` accepts the day fraction for staggered fire ignition, late-night extinction and tent lights-out; ambient lanterns still follow the global nightness contract.
- **`puppet.js`** — also exports `buildSimpleNPC` used as the base humanoid for band members, kids, and crowd NPCs.
- **`paradeLanterns.js`** builds the six named paper-and-rib lanterns. `puppet.js` assembles carriers and moving support poles, and advances deterministic child poses without changing root transforms. `PuppetParade` owns travel/scatter and eight carrier-centered collision circles, including the dragon's three-person team. Lantern surfaces use opaque emissive materials and a shared 64px paper texture, with no additional lights or render passes.

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

Visibility interruptions clear the observation window; hidden ticks do not
advance quality decisions or measured foreground time. Guided Low captures can
select `perfQuality=sustained`, which removes only the p95 downgrade trigger;
ordinary Auto thresholds and recovery requirements remain unchanged.

After gameplay starts, automatic transitions emit `quality_downgrade` or
`quality_recovery` with the trigger and named settings. A single pending outcome
reports the fresh 90-frame window after five seconds, or marks it interrupted or
superseded. These observations establish association, not causation. Cumulative
per-game-start quality summaries report measured active/degraded seconds and
transition counts; repeated visibility-driven `session_end` snapshots must not
be summed. A random `quality_run_id` identifies each game start for grouping those snapshots and joining outcomes. Title-card and manual transitions do not emit automatic events.


---

## HUD (`hud.js`, `styles.css`)

Vanilla DOM, no framework.

- Compact status rail with current smiles, a de-emphasized best persisted to `localStorage` as `zerble-best-smiles`, bubble juice, the live day/night dial, and a conditional Lurleen-following heart. Score increases restart a warm CSS pulse, while the first saved-best increase in a session fires one bounded DOM confetti burst. Reduced motion suppresses the moving confetti and holds the score cue to a static color change.
- Toast strip — short status messages with a fade timer.
- Hit flash — red vignette pulse on damage.
- Title card — full-screen overlay before start. Its static HTML keeps Start and Settings disabled while an inline bubble-pressure loader runs independently of the slow module graph; `HUD.onStart` installs the trusted-gesture handler, marks the loader ready, restores the Start/Resume label, and only then enables the controls. The ready loader holds for 1.1 seconds, then fades and collapses out of the title layout.

---

## Festival Passport (`playerStats.js`, `passportMenu.js`)

The pure stats store owns versioned `zerble.passport` persistence, visit counters, all-time totals, stage identities and six permanent stamps. It imports BubbleProgress's existing lifetime raw-smile count once; BubbleProgress continues owning bubble unlocks. Main owns one eligibility predicate and brackets the actual cart update for planar travel, feeds raw smile collections, successful `Bubbles.emittedCount` increments, damaging collisions and boardings, and observes repeated stage proximity callbacks. Stage keys include the world seed and rounded coordinates, never registry object identities.

The DOM menu provides This visit / All time tabs, an inert background, focus containment/restoration, and keyboard/touch access. Opening it pauses the gameplay tick while rendering continues; both transitions clear keyboard and touch gestures. Intro, hidden-tab, capture-lock and game-over observations are excluded. Relocation invalidates exploration records and new stage discoveries for the rest of that visit, but later actual driving and other counters still count. Settings restart preserves the original entrance and absolute visit state independently of run-mode restoration, flushing telemetry before capture. Ordinary reload starts a fresh visit. Local totals flush every ten active seconds, on stamps and on hide; storage failure leaves in-memory play working.

[Measurement contracts, GA4 setup and preview](docs/passport.md). The DOM-only [preview](passport-preview.html?case=populated&mute=1) uses injected memory and no analytics or WebGL.

## Analytics (`analytics.js`)

Thin `gtag` wrapper. Events:

- `game_start`
- `first_honk`
- `smile_milestone` (10, 25, 50, 100, 250, 500, 1000, 2500)
- `personal_best`
- `collision` (by kind)
- `view_toggle` (mode)
- `passport_progress` (incremental counters every 60 active seconds, on hide, settings restart and run end; current/max distance remain gauges)
- `passport_stamp` (new permanent stamp, once locally; includes a per-visit join key)
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


### Nut Wagon encounters

`src/nutWagon.js` owns one global, non-chunk-bound wagon, using the existing S123 model and road polylines from the nearest festival heart. `src/nutWagonRoute.js` owns pure route sampling, dense clearance-run selection and tuning. A dedicated session-seeded RNG keeps encounter rolls out of worldgen's RNG streams. The controller ticks before registry reindexing and crowd AI, so colliders and seat transforms are current for both consumers. Three live registry circles cover the vehicle and platform; road candidates reject water and hard obstacles. The actor stays on its selected road run, pauses near gatherings, backs in reverse gear at its ends and recycles only when distant and outside the camera view.

Wagon slots identify their owning vehicle. Crowd boarding/riding dispatches through that owner's `worldSeatPosition`, heading and stopped state; Zerble's passenger count, empty-juice rule and boarding-score callback remain specific to Zerble. Nine slots include the permanent driver and eight guests: two cargo, two roof, two rear seat, one passenger and one standing platform. Tall cartoon NPCs use the open roof bench or platform. On despawn, the wagon releases all claimed riders, removes registry entries, detaches the spatial dub handle and removes its root without disposing pooled model resources. Its music registry position and panner position both move with the vehicle. See `verification/nut-wagon/GAMEPLAY.md` for parameters and measured checks.

`src/monks.js` owns four-to-six member handles, shared destinations and loose
offsets, while `src/people/groupParticipation.js` is the population-internal
boundary for membership, movement proposals, avatar publication and collective
seat reservations. Crowd retains lifetime, ordinary walking/avoidance/smiles and
amenity state; the party never receives mutable crowd records. Its lower-priority
intent cannot overwrite an exclusive activity. Public group bindings consume a
reused display pose and restore the same monk avatar after activity release.
The party still ticks before individuals, waits for a busy amenity user, preserves
its independent salted stream, and requests collective distance removal through
Crowd. Boarding reserves every seat or none, validates reservation incarnations
on arrival/release, and cancels on timeout or vehicle motion. Person removal also
releases its avatar and membership, including after runtime dispatch has stopped.



### Debug command grammar

`debugCommands.js` supplies a DOM-free allowlisted grammar, validation, command help and contextual completion. `debug.js` adapts it to the existing simulation, crowd, Sound, camera and registry APIs; the prompt owns keyboard history and combobox/listbox rendering. `main.js` supplies the existing chase-camera controller alongside the other debug hooks. Arguments are validated before mutations, count/frame helpers are bounded, and inspection distinguishes actual camp claims from visual occupancy. Scene draw/triangle inspection reads `renderer.__sceneInfo` before falling back to raw renderer information.


### People ownership and composition

`src/people/workshop.js` drives existing production controllers in the mixed people
sandbox, preserving the adult/collection/child barrier and Healing Arts' previous
sample order while exposing explicit claim/publication teardown. It does not own
an independent clock, render loop or replacement person simulation. The sandbox
retains scene/GPU ownership. `src/people/frameTrace.js` records bounded copied state
at the existing real-game barriers only when explicitly enabled on localhost;
recording does not introduce a new scheduling owner. Routine contracts and saved
Low/Mid captures characterized the original paths before migration. Final ownership,
trace, render and browser evidence is recorded in
[acceptance](openspec/changes/people-npc-architecture/acceptance.md). See the
[implementation checklist](openspec/changes/people-npc-architecture/tasks.md) and
[verification scope](verification/people/2026-10-26/README.md).


`src/people/runtime.js` registers specialized populations, optional capabilities and
explicit dependency slots, while `personHandle.js` gives each interactive lifetime a
registration token and lifetime generation. `activityClaims.js` orders tentative
preparation, revocation, owned release and population-controlled resume. Crowd owns
the raw-record resolver; published person views expose reads into caller scratch.
Explicit and distance removal share a borrower-first core, with stable traversal
through reentrant peer removal. The public pose/binding facade validates current
claims and dirties only affected instance batches. All population/activity migrations are accounted for in the
[coverage acceptance](openspec/changes/people-npc-architecture/acceptance.md); these
modules own no scheduler and do not erase specialized movement or storage policies.

Healing Arts trajectories now live in `src/people/healingArtsMotion.js`. An activity
owns its cache, consumes the prior sample, then samples at the same near/night
transition gate even when display updates are skipped. The model consumes cached
position/heading and keeps appearance caches on its own visual records. Standalone
previews sample outside the model, and authored yoga positions retain bootstrap
Float32 rounding. The activity now uses public handles, claim-checked poses and bindings; tentative
slot reservations and exit/cooldown metadata have explicit release ownership. Chunk
unload returns borrowed people before disposing the rig's resources.

`src/people/children.js` independently owns child meshes, identity and gameplay,
registers the existing post-collection slot and honk/query/collision capabilities,
and preserves identity during distant relocation. It releases owned resources only
after execution and lifetime reads stop. Its bubble/chase/separation/smile rules are
unchanged. `people/placement.js` shares the existing bounded lake-aware placement.

`src/people/placeVisit.js` is an executable extension example over public operations
and place/resource adapters. It is used by verification rather than automatically
changing any live venue's eligibility. See the
[extension guide](openspec/changes/people-npc-architecture/extension-guide.md) and
[browser proof](verification/people/extension.html) for two storage/resource types
and visible versus borrowed bindings. The guide distinguishes current live
eligibility from deliberately adding compatible activities for another family.


`src/people/wooks.js` owns the wook population, including its registered roaming
update, parked-honk capability, lifetime/query/collider publication and cleanup.
The main loop passes copied positions into the existing Trip barrier using reused
caller vectors; the controller retains its approach/passive damage and recycle rules.
`src/people/sceneResources.js` releases only a caller-owned subtree's non-shared
resources, after that population has stopped execution and released its lifetimes.
It does not own person state, registry claims or audio.


`src/people/puppetParade.js` owns carrier identities and formation motion, while
`src/people/brassBand.js` owns musician identities, formation intent and its spatial
music handle. Display lanterns and the band's instruments do not become independent
interactive people. `formationRoute.js` holds the unchanged loop placement/sampling
math. The registered formation slot remains immediately before children, and optional
per-capability order preserves interaction sequences independently of constructor and
update order. Provider ordering is data in registration, not role logic in the runtime.
Band disposal cancels audio before releasing owned graphics; cancelled pre-gesture
stage descriptors are removed from Sound's pending queue as well as its handle registry.


`src/people/seatReservations.js` is the common vehicle resource adapter for ordinary
passengers, groups and permanent drivers. Acquisition validates person lifetime,
vehicle/slot identity, occupancy and explicit permanent-seat eligibility before
publishing any part of a multi-person reservation. Tokens remain releasable during
owner teardown, but stale tokens cannot clear later occupants. The population keeps
its existing boarding/riding movement kernel and protected-state precedence, with
resource validity checked before pose writes; the seat adapter owns no actor loop.
Vehicles recruit through public nearby views and boarding commands, release their
passengers through the population owner, and retain their own physics and models.
Diagnostic seating uses that same boundary and avoids people with active claims.


Hammock and picnic visits now live in `src/people/hammockActivity.js` and
`src/people/picnicActivity.js`. Each activity retains handles, its own reservation
metadata, a reused movement snapshot/proposal and explicit resource identity checks.
They read public motion views and submit specialized claim-checked approach/rest
profiles; Crowd alone resolves records and commits the existing instance poses.
Picnic display keeps a numeric seat height rather than an activity-owned seat object
on the population record. World entries/slots remain place-owned, and old release
callbacks cannot clear another reservation.

These two inline activities execute at their original per-person barriers after the
accepted-frame prelude. They do not add a second population traversal. Existing
cooldown/bob/timer advancement and the legacy second dwell-timer decrement remain
unchanged, with 800-frame characterizations for each activity. General external
activities such as Healing Arts retain their separate phase and do not enter this
inline set. Ordinary acquisition can preserve current velocity explicitly; each
activity still chooses only its own permitted pose phases. Typed finish commands
release resources before final publication while retaining timeout paths that did
not publish until the next frame. Place replacement is detected before movement.

Bathroom errands now live in `people/pottyActivity.js`: selection and motion use
copied public profiles, while unit occupancy validates the person lifetime, claim
and concrete registry/resource identity. Crowd retains inline timing and instanced
hidden/seated display. The unit's numeric `occupantId` is diagnostic, never authority.

Market visits now live in `people/marketActivity.js`, owning salted behavior RNG,
retry cooldown, frontage reservations and copied motion. A tent's customer field
contains only copied display state. The activity holds the lifetime-checked claim,
and Crowd preserves the pre-camp movement/publication barrier and bag instancing.

Camp seating and sleeping now live in `people/campActivity.js`; camp music remains
in `campJamActivity.js` and now uses public person queries, copied motion and typed
instrument bindings. Both reserve world-owned chairs through `people/campResources.js`,
which validates the full person/claim, exact entry and current slot membership.
Music can borrow an eligible seated camper through an ordered claim handoff; an
old camp release cannot free the musician's replacement reservation. The population
keeps only numeric camp height, stage/hidden hints and the claim-bound instrument
representation, retaining the original session-before-party and per-person barriers.
Physical exit preflight runs before hit revocation so trapped sitters retain their
claims. Sound/model cleanup completes even if a sound stop reports an error.

The photographer remains a role on a population-owned person, with no separate
interactive identity. `photographer.js` owns its salted behavior kernel and reused
pose-profile sampling; Crowd owns profile storage and camera/flash instancing.
Public role commands use lifetime handles and protect existing activity/group/seat
authority. Display inspection reads copied role fields rather than a mutable NPC.


### Queries, vehicles and display participation

Nearby consumers use copied views and caller scratch through `forEachPersonNear`,
with explicit population and candidate filters. Each owner retains its storage and
locality rules; no flattened global person array or per-frame handle allocation is
required. Lost-smile effects track a handle and retain their last valid copied
position when its lifetime ends. One-wheel riders publish query identities while
the registry remains their sole collider publisher. Lurleen's read-only facet keeps
her physics and relationship ownership intact.

`PlaceDisplay` lends stage/cook update routes without creating interactive people.
Vendor keepers remain tent-owned displays, and birds remain outside the people
domain. World or vehicle resources own their slots, occupancy, transforms and
lifetime; an activity borrows a person with a validated current claim, while a
role or group retains that person's existing lifetime. These distinctions avoid
turning every humanoid mesh into an autonomous NPC.

### Temporary activities and cart reactions

Hula selects eligible ungrouped adults near supported registered attractors; frisbee
selects eligible pairs on open, dry ground. Both retain the Crowd lifetime, ordinary
render and collider. Their sessions own props and reservations and use validated
claims for every movement write. Crowd tests the same steering corridor before an
interruptible external claim can skip its update, and revokes that claim before
reacting. Honks use the existing Crowd dispatch. A pending session keeps its own
reservation, waits for the cart to clear, revalidates people and resources, then
acquires fresh claims; invalidation or timeout cancels it. A frisbee interruption
stops both claims and settles its disc before either player can pursue it.

Healing Arts dancing retains the original body, with its place rig suppressed, and
reacquires its reserved slot only after a safe return. Yoga and physically constrained
riders or potty occupants retain their own protected handling. Ordinary stage-front
sway remains Crowd behavior. The fixture and evidence are documented in
[temporary activity verification](verification/people/temporary-activities.md).

### Frame dependencies and accepted clocks

Main remains the composition root and calls named slots only at their existing
barriers: vehicles and spatial sync, adults, pickup collection/scoring, formations,
children, roaming families, birds/Trip, relationship, place performers, Healing Arts,
lighting/cooks, world streaming, star-love, contacts and final rendering. The complete
[slot map](openspec/changes/people-npc-architecture/dependency-slots.md) records these
interleavings. Honk/cheer/collision capability order is independent of constructor
order. A newly registered family declares support rather than acquiring unrelated
adult behavior through a central type switch.

Actor animation and stored social deadlines advance from accepted gameplay delta;
a skipped frame does not accrue a wall-clock catch-up. Profiling, streaming budgets
and Web Audio retain their own appropriate clocks, and independent global nightness
polling remains intact. Claim-checked late binding/seat restoration publishes only
the affected body before rendering. Removal invalidates authority, releases borrowers,
detaches external publications, then disposes only exclusively owned resources,
attempting every cleanup even when an audio or GPU release reports an error.

The [extension guide](openspec/changes/people-npc-architecture/extension-guide.md)
shows one behavior across different population and place layouts, documents current
eligibility, and explains deliberate connections to stages, porta-potties, food
trucks, Healing Arts and the nut wagon. `bin/test-people-boundaries` protects these
dependency directions with negative fixtures as part of the routine suite.
