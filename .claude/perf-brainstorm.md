# Performance brainstorm — Zerble at the Festival

Authored 2026-06-19. A wide creative brainstorm (three parallel idea-generators:
GPU/render-pipeline, CPU/streaming/crowd, perceptual/"fake-it") followed by a
critic pass that ranks and prunes. **Nothing here is committed or on ROADMAP
yet** — this is the idea bank + triage. Promote the survivors to ROADMAP
separately.

## The bottlenecks we're actually aiming at

From the 2026-06-19 instrumented capture (driving ~1500m through fresh
territory), in priority order:

1. **Shader-compile stalls (A)** — single frames of **137–343ms** that line up
   *exactly* with three.js `prog` (program count) jumping. New materials hit
   first-render and block on GL compile/link as you enter a new hub. `prog`
   grew 50→95 over the run. **This is the worst-felt symptom.**
2. **Chunk-gen hitches (B)** — frequent **30–60ms** frames; `cgSlow` (chunks
   exceeding the 8ms build threshold) climbed 21→49; `cgWorst` 289ms early.
   Allocation cost during streaming.
3. **Steady-state FPS (C)** — 40–58 fps, frame avg 17–25ms. **Where this time
   goes is currently unmeasured** (see D).
4. **Measurement gap (D)** — `draws`/`tris` read `1` under the EffectComposer
   post-processing chain, so draw-call cost is invisible. Several batching
   decisions below are blind until this is fixed.

Already-fixed, do **not** re-propose: the spatial-grid broadphase grind
(`forEachNear`) and the oversized-footprint query inflation — `avoidMs`/`sepMs`
are now ~0.1–0.3ms combined ([[perf-unresponsive-trace-diagnosis]]).

---

# Part 1 — The idea bank (divergent, unfiltered)

Grouped by theme. ID prefix denotes origin lens (G=GPU, P=CPU/streaming,
K=perceptual). Overlapping ideas merged with all sources noted.

## A. Shader-compile stall killers

- **A1 — Boot-time shader prewarm via `renderer.compileAsync()`** *(G1, K3)*.
  During the title-card gesture, build one hidden instance of every known
  material/geometry combo into an off-screen scene and `compileAsync` it
  (uses `KHR_parallel_shader_compile` where available). Front-loads the
  cold-cache compile into dead title-screen time. *Effort M.* Flags: must go
  through `threeShim` so warmed programs match the real tier-aware materials;
  do NOT `await` between the gesture and `Sound.init()` (iOS audio footgun).
- **A2 — Predictive prewarm one hub ahead** *(G2, K2)*. When the streamer is
  about to generate a hub, `compileAsync` its material set a few seconds early
  using heading/velocity, spreading compile over calm frames. *Effort M.*
- **A3 — Collapse the material-variant explosion** *(G3)*. Audit for accidental
  program-key divergence (map vs no-map, `vertexColors`, `flatShading`, `fog`,
  `emissiveMap` presence). Drive color through `vertexColors`/`setColorAt` on a
  *shared* material instead of N `.color` clones. Fewer total programs → fewer
  *and* cheaper stalls. `__dbg.dumpPrograms()` already exists for the audit.
  *Effort M.*
- **A4 — Time-slice the program reveal (≤1 new program/frame)** *(G7)*. Add a
  finished chunk's meshes with `visible=false`, then flip ≤1 not-yet-rendered
  material visible per frame so only one GL link happens per frame. Turns one
  300ms wall into ~45 frames of +5–7ms. *Effort M.* Decor pops in over ~1s
  (acceptable while moving).
- **A5 — Persistent crowd instancing that survives chunk unload** *(G16)*.
  Make the crowd's InstancedMeshes module-persistent (`userData.shared`) so
  revisiting a hub never re-triggers their first-render compile. *Effort M.*
- **A6 — 1×1 scissor prewarm** *(G18)*. Force a not-yet-seen material's link by
  rendering it into a 1px scissor region during calm frames. *Effort M.*
  (Fragile cousin of A1 — same "warm the wrong program" trap.)

## B. Draw-call / batching / geometry

- **B0 — Fix draw/tri measurement under post-processing** *(G4)*. Snapshot
  `renderer.info.render.calls/triangles` immediately after the RenderPass
  (before bloom/trip/fxaa/output) with `info.autoReset=false`, surface the real
  number in the backtick HUD. *Effort S.* **Prerequisite for the rest of B.**
- **B1 — `BatchedMesh` for per-hub static decor** *(G5)*. r160's BatchedMesh
  renders many *different* geometries under one material in one draw call
  (with per-object frustum culling). Fold static shadow-agnostic decor into one
  BatchedMesh per material at hub completion. *Effort L.* Young API; fixed
  pre-allocated buffers; disposal discipline.
- **B2 — Merge static chunk geometry at completion** *(G6, P11)*. `mergeGeometries`
  all static same-material meshes into one buffer per chunk, dispose originals.
  Lower-tech than B1, **already ROADMAP-parked**. Do the merge on a later idle
  frame (P11) so it never lands in the spawn hitch. *Effort M.* Respect
  `userData.shared`; whole-chunk culls as one AABB (fine at 80m).
- **B3 — Cross-chunk forest InstancedMesh consolidation** *(G10)*. One
  persistent InstancedMesh per tree-type spanning the whole loaded forest,
  add/remove instances via matrix writes instead of a new mesh per 3×3 block.
  *Effort M.* `instanceMatrix.needsUpdate` on every edit; align lifecycle with
  the forest unloader.
- **B4 — Texture atlas for festival props** *(G14)*. Combine signage/banner/
  decal textures into one atlas, remap UVs at build time → fewer binds, more
  batch eligibility, fewer programs (texture presence is a program key).
  *Effort L.* No-build: atlas must be a checked-in PNG or baked in-browser.

## C. Chunk-gen streaming

- **C1 — Time-slice `_generate` into a coroutine** *(P1)*. Convert to a
  generator that `yield`s after each sub-stage (roads, props, trees, crowd,
  campsites); the ChunkManager drives it with a per-frame **ms budget** (~4ms),
  resuming next frame. A 49ms chunk becomes ~6 frames of 8ms. Determinism
  preserved (rng draw *order* unchanged, only *when*). *Effort M.* Track an
  in-progress set so a half-built chunk isn't unloaded/double-generated or
  registering partial colliders. **Most direct fix for B.**
- **C2 — Budget chunk-gen by measured time, not count** *(P2)*. Replace the
  fixed 1-chunk/frame with "keep generating while under ms budget; don't *start*
  a chunk if the frame's already over." *Effort S.* Pairs with C1 (alone it
  can't preempt a single expensive chunk).
- **C3 — Predictive prefetch along the travel vector** *(P3)*. Pre-generate the
  next 1–2 chunks on quiet frames using velocity, so corner-crossing bursts
  amortize. *Effort M.* Same chunks/seeds → determinism-safe.
- **C4 — Round-robin crowd spawn out of the chunk build** *(P13, K17)*. Spawn a
  chunk's ambient crowd (up to 16 NPCs) over the next ~0.5s instead of inside
  `_generate`; geometry appears immediately, crowd trickles in. *Effort S–M.*
  Cancel queued spawns if the chunk unloads first.
- **C5 — Cache generated chunk *plans* on revisit (LRU)** *(P14)*. Keep the
  lightweight layout (not THREE objects) in an LRU keyed by `cx,cz`; on revisit
  skip worldgen queries and rebuild meshes straight from the plan. *Effort M*
  (needs a plan/build split). Deterministic → cache == regenerate.
- **C6 — Chunk *data planning* in a pure-JS Web Worker** *(P6)*. Run the
  worldgen query/layout math (no `import 'three'`) in a `type:"module"` worker,
  return a transferable typed-array plan; main thread instantiates meshes.
  *Effort L.* **Hard constraint:** import maps don't resolve bare specifiers in
  workers, so the worker's import graph must be three-free (or use a Blob/
  importmap shim). Determinism load-bearing across the thread boundary.
- **C7 — Geometry build in a worker, transfer attribute buffers** *(G17)*.
  Build `BufferGeometry` attribute arrays in a worker, transfer as ArrayBuffers,
  main thread just uploads. *Effort L.* Same worker/no-build/determinism caveats
  as C6, plus byte-identical output requirement.

## D. Crowd CPU (steady-state)

> Caveat the critic will press: the capture does **not** prove crowd CPU is a
> steady-state problem. Broadphase is already cheap; per-frame crowd self-time
> beyond sep/avoid is unmeasured. Treat this whole section as **measurement-gated**.

- **D1 — Crowd LOD: distance-tiered update frequency** *(P4)*. NPCs >40m run
  the full state machine every 3rd–4th frame (round-robin by index), with
  position extrapolation between. Near NPCs full-rate. Could cut crowd CPU
  50–70%. *Effort M.* Keep separation grid honest; smile/eye-contact only fire
  inside ~22m anyway.
- **D2 — Freeze offscreen / behind-camera NPCs** *(P10, K12)*. NPCs behind the
  chase cam and beyond near-range get parked (no state machine, no separation),
  woken on camera turn. Could freeze 30–50% of residents. *Effort M.* Exempt
  active NPCs (fleeing, riding) to avoid freeze-then-teleport.
- **D3 — Pool per-frame crowd allocations** *(P8)*. Concrete cited target: the
  `activePassengersRef` closure object allocated ~330×/frame (crowd.js:604-606),
  plus per-call `Vector3`/`Color`/array literals. Hoist to scratch. *Effort S–M,
  pure win.* Cuts GC churn.
- **D4 — Early-out the `stage_front` dancefloor scan for distant NPCs** *(P5)*.
  Every NPC currently loops all `stage_front` attractors computing `hypot`
  (crowd.js ~644); guard so only NPCs near a stage run it. *Effort S, zero
  behavior change.*
- **D5 — Shared animation-phase "clock buckets"** *(K8)*. ~6–8 precomputed phase
  clocks instead of per-NPC phase; assign each NPC a bucket. Collapses per-NPC
  animation math to ~8 evals; randomize assignment to avoid visible waves.
  *Effort M.* Thematically fine (crowd grooves to the same beat).
- **D6 — SoA typed-array crowd state** *(P7)*. Move hot per-frame fields into
  parallel `Float32Array`/`Uint8Array`s for cache locality + less GC. *Effort L,
  high blast radius* across a 2175-line file. Unlocks D8.
- **D7 — Decouple sim tick from render rate (fixed 30Hz + interpolation)** *(P12)*.
  Run crowd at fixed 30Hz, interpolate instance matrices between ticks.
  *Effort M–L.* Watch the hidden-tab `setTimeout(16ms)` path (don't double-tick).
- **D8 — Full crowd sim in a pure-JS worker** *(P16)*. After D6, run `update()`
  in a three-free worker, double-buffered transferables, registry footprints
  mirrored incrementally. *Effort XL.* The rare worker candidate that dodges the
  bare-import trap because steering math needs no THREE.

## E. Perceptual / "fake-it" / mask

- **E1 — "Arriving at the festival" warm-bloom curtain** *(K1)*. Trigger a ~400ms
  bloom swell + warm grade + audio "whooomp" on hub entry and run the
  compile-forcing build *inside that window*. The freeze reads as an intentional
  cinematic arrival beat. *Effort M.* **Highest-leverage mask** for symptom A;
  pairs with A1/A2.
- **E2 — Billboard tent/stage skyline in the far field** *(K4, G9)*. Beyond ~2
  chunks, draw a baked camera-facing silhouette quad per distant hub (tent
  peaks, truss, string lights) instead of real geometry; swap on load. *Effort L.*
  Adds a populated glowing horizon. Night: emissive twinkle dots for free mood.
- **E3 — Far-field crowd as instanced flat cards / "murmur"** *(K5)*. Past ~40m,
  render the crowd as wobbling instanced color-cards (1 draw) rather than real
  NPCs; promote to real on approach. *Effort L.* Cards read charmingly toy-like
  (better fit than a smeary texture).
- **E4 — Octahedral / flipbook impostor NPCs in the mid field** *(K6)*. Bake each
  archetype to a multi-angle flipbook atlas; mid-distance NPCs become a single
  view-angle-sampled quad with a 2-frame walk. *Effort L.*
- **E5 — Dithered / stochastic LOD swaps** *(K9)*. Screen-door dither cross-fade
  over ~0.3s on any LOD boundary so swaps never *pop*. *Effort M.* **Enabler**
  that makes E2/E4/B-impostors safe. Tune threshold per tier.
- **E6 — Rolling warm haze ahead of travel** *(K7)*. Keep a thin directional
  haze ~1.5 chunks ahead (denser at boost); new chunks materialize inside it so
  the build hitch + pop-in happen where you can't see clearly. *Effort M.*
  Golden-hour festival haze is a feature, not a cost.
- **E7 — Reduce detail during boost, restore on slow** *(K10)*. While boosting
  (fast motion + camera shake = least scrutiny): drop shadow update rate, freeze
  far-NPC AI, widen impostor ring, maybe -10% pixel ratio; ramp back within
  ~0.4s. *Effort M.* Chunk hitches cluster during boost — directly offsets them.
- **E8 — Boost speed-lines + radial blur vignette** *(K11)*. Cheap full-screen
  pass, gated on boost envelope like the Trip pass. Motion blur is the classic
  low-fps concealer + juice. *Effort S.* Keep gentle (nausea/cheap-arcade risk).
- **E9 — Fake stage-light volumetrics with billboard cones** *(K13)*. Sell night
  light shafts with 2–3 additive textured cones swaying to music — zero shadow
  cost, no extra real lights. *Effort M.* Pure atmosphere win.
- **E10 — Let night do the hiding** *(K14)*. At high `nightness`, shrink the
  real-geometry ring and lean on impostors/emissive dots — darkness + fog
  already hide far detail. *Effort M.* Buys headroom when the night audio/light
  show is *adding* cost.
- **E11 — Pre-rendered painterly skybox per ToD** *(K15)*. Replace `mountains.js`
  horizon geometry with a few baked panorama strips cross-faded by nightness.
  *Effort M.* A painted warm horizon can look *better*; parallax loss invisible.
- **E12 — Faked lake reflections** *(K19)*. Flipped/darkened nearest-shoreline
  silhouettes + ripple normal, never a second scene render; night = stretched
  emissive smears of tiki/stage glow. *Effort M.* Firelight on a dark lake =
  peak mood for near-zero cost.
- **E13 — Adaptive sparkle budget** *(K21)*. Emissive point-sprites (string
  lights, fireflies, embers) whose *count* tracks a running fps estimate — shed
  the cheapest atmosphere first under load. *Effort M.* Adaptive quality
  disguised as ambient magic; nobody counts fireflies.
- **E14 — Crowd placeholder-card promotion** *(K17, dup C4)*. Instant cheap flat
  cards at chunk-crowd spawn, promote to real puppets a few/frame over ~1s.
  *Effort M.* Pop-in becomes "people coming into focus." Pairs with E5 dither.
- **E15 — Bubble-pop misdirection over micro-hitches** *(K16)*. On a detected
  long frame, fire a small bubble burst + chime next frame so a stutter reads as
  "Zerble did a thing." *Effort S.* Rate-limit. Psychological cover, not a fix.
- **E16 — "Catch your breath" speed clamp on hub entry** *(K20)*. Gently clamp
  Zerble's max speed ~0.5s on hub entry so any residual hitch lands during a
  slow, forgiving roll-in. *Effort S.* Risk: takes control from a player who
  wants to boost through.

## F. Post-processing / shadow / render

- **F1 — Gate the bloom pass when nothing bright is in frame** *(G15)*. Drive
  `bloomPass.enabled` off a nightness + nearest-hub-distance check (mirror the
  Trip pass's existing `enabled=false`). Saves a multi-tap fullscreen pass on
  open daytime driving. *Effort S.* Hysteresis to avoid popping. **High ROI.**
- **F2 — Amortized shadow map (update every 2nd–3rd frame)** *(K18)*. Sun crawls,
  casters are static, NPCs don't cast — reuse the last shadow map between
  updates. Cuts shadow-pass cost ~50–66% on mid/high. *Effort S–M.* Invisible.
  **High ROI, strongly aligned with the shadow-priority perf rule.**
- **F3 — Fog-as-far-cull** *(G8)*. Pull `camera.far` in to fog distance so the
  frustum drops far chunks entirely; can also shrink `UNLOAD_RADIUS`. *Effort S.*
  Tune fog to mask the seam.
- **F4 — Dynamic resolution scaling on the composer target under load** *(G13)*.
  Extend `adaptiveQuality.js` to drop the composer's internal RT resolution for a
  few frames when over budget (e.g. during a residual compile spike), ramp back.
  *Effort M.* FXAA `resolution` uniform must track the size or AA smears.
- **F5 — Depth pre-pass to cut overdraw** *(G12)*. Cheap depth-only pass, then
  color with `depthFunc:EQUAL`. *Effort L.* Often a net loss on simple scenes;
  measure with B0 first.
- **F6 — Render-on-demand when parked** *(G11)*. Skip `composer.render()` when
  nothing's dirty. *Effort —.* The festival always animates (crowd/fire/water/
  nightness), so "nothing dirty" is rare → low payoff.

---

# Part 2 — The critic pass (ranked + pruned)

Open-minded but honest. Applying the project's own rules: **measure before you
optimize** (B0/D-section gating), **allocation-cost ≠ steady-state cost**,
**no-build / determinism / threeShim / iOS** as hard gates, and **perf is
bounded by what the player can perceive**.

The two symptoms worth money are **A (shader stalls)** and **B (chunk hitches)**.
Steady-state CPU is *not yet proven* to be the FPS limiter — so crowd-CPU work is
ranked below a measurement gate, and the 17–25ms frame avg may well be GPU/fill
(post-processing) rather than JS.

## Tier 0 — Prerequisite (do this first, it's cheap and unblocks everything)

- **B0 — Fix draw/tri measurement under post-fx.** *S effort.* Right now you're
  flying blind on draws and overdraw; every batching/culling decision (B1–B4,
  F3, F5) is a guess until this lands. Also add a per-frame `prog`-delta readout
  so the shader-stall frames self-identify. This is rule #1 of performance.md.

## Tier 1 — Greenlight (high value ÷ effort, feasible now, low risk)

1. **C1 — Time-slice `_generate` into a coroutine** (+**C2** ms-budget). The
   single most direct, determinism-safe fix for the 30–60ms chunk hitches.
   Main-thread, no no-build/worker risk. This is the backbone fix for symptom B.
2. **A1 — Boot-time `compileAsync` prewarm** (+**A2** predictive one-hub-ahead).
   Front-loads the cold-cache compile into title-screen dead time and amortizes
   the rest. The principled fix for symptom A. Verify `KHR_parallel_shader_compile`
   support on target browsers; even the synchronous fallback wins by moving the
   cost off the arrival frame. Mind the threeShim match + the iOS-audio ordering.
3. **A4 — Time-slice the program reveal (≤1 link/frame).** The safety net under
   A1/A2: even unwarmed programs spread over ~45 frames instead of one wall.
   Cheap insurance, composes with the prewarm.
4. **F2 — Amortized shadow map.** *S–M, invisible,* ~50–66% off the highest
   per-frame multiplier on mid/high. Pure steady-state win with no perceptual cost.
5. **F1 — Gate the bloom pass.** *S.* Real per-frame fullscreen-pass savings on a
   large fraction of (daytime, open) frames; the gating pattern already exists.
6. **D3 — Pool the per-frame crowd allocations.** *S–M, pure win,* concrete cited
   target (the 330×/frame closure). Cuts GC churn regardless of whether crowd is
   the FPS limiter — no downside.
7. **E1 — "Arriving at the festival" bloom curtain.** *M.* The pragmatic partner
   to A1–A4: whatever compile cost leaks through, this makes it *feel* like an
   arrival beat instead of a freeze. Best vibe-fit idea in the whole bank, and it
   leans into the warm-evening identity. Ship it alongside the real fix.

## Tier 2 — Promising, but heavier or measurement-gated (queue, don't rush)

- **B2 — Merge static chunk geometry at completion** (deferred to idle, P11).
  Already ROADMAP-parked; real draw-call win. Gate behind B0 to confirm draws are
  actually the steady-state cost.
- **B1 — BatchedMesh per-hub static decor.** Higher ceiling than B2 but L effort
  and a young API; do B2 first, reach for B1 only if B0 shows draws still hot.
- **D1 + D2 — Crowd LOD (distance throttle + offscreen freeze).** Strong *if*
  measurement shows crowd CPU is the steady-state cost. Gate behind a crowd
  self-time readout (extend the existing `_perf` instrumentation). Pairs with E5.
- **E2/E3/E4 + E5 — Impostor far-field (tents, crowd, NPCs) with dithered swaps.**
  Big tri/draw win *and* a better-looking horizon, but L effort and only safe
  with the E5 dither enabler. A meaty, self-contained "festival horizon" project.
- **F3 — Fog-as-far-cull.** *S,* but verify it doesn't fight the load radius;
  cheap to try once B0 can confirm the draw drop.
- **E9 / E12 / E13 — Billboard light shafts, faked lake reflections, adaptive
  sparkle.** "Looks better *and* cheaper" atmosphere wins. Low risk, high charm;
  schedule when doing a night-mood polish pass.
- **A5 / B3 — Persistent crowd + forest instancing across unload.** Removes
  re-entry compile + per-block allocation. Medium, lifecycle-sensitive.
- **A3 — Material-variant consolidation audit.** Genuinely attacks symptom A at
  the root, but needs B0 + `dumpPrograms()` discipline first to avoid guesswork.
- **E7 — Reduce detail during boost.** Clever timing (least scrutiny = most
  headroom) and reinforces speed feel; M effort, ramp carefully.
- **C5 — Chunk-plan LRU on revisit.** Good for back-and-forth traversal; depends
  on a plan/build split, so it rides on C-section refactors.
- **F4 — Dynamic resolution under load.** Decent safety valve; FXAA-uniform
  coupling makes it fiddlier than it looks.
- **E6 / E10 / E11 / E14 — Travel haze, night-hides-detail, painterly skybox,
  crowd card-promotion.** Solid charm-positive concealers; park as a "perceptual
  polish" cluster.

## Tier 3 — Park / low ROI now (keep on the idea bank, don't schedule)

- **C4 — Round-robin crowd spawn.** A targeted slice of C1; do it *as part of* C1
  rather than separately.
- **D4 / D5 — `stage_front` early-out, phase buckets.** Real but tiny; only worth
  it if D-section measurement says crowd math is hot.
- **B4 — Texture atlasing.** Multiplicative with batching but L effort and no-build
  asset-bake friction; revisit only if B0 fingers texture binds.
- **E8 / E15 — Boost blur, bubble-pop misdirection.** Cheap juice/cover; nice-to-
  have, not perf-critical. Fold into a juice pass if at all.
- **D7 — Fixed-timestep sim decouple.** Real but M–L with interpolation
  complexity; only if crowd is proven the limiter.
- **F6 — Render-on-demand.** The world always animates, so the "idle" case barely
  exists. Mostly thermal. Low payoff.

## Eliminated — sure enough not worth trying

- **A6 — 1×1 scissor prewarm.** Strictly dominated by A1/A2 (`compileAsync` is the
  clean, supported path) while being more fragile and carrying the same
  warm-the-wrong-program trap. No reason to build the worse version.
- **D8 / D6 — Full crowd sim in a worker + the SoA refactor it requires.** XL
  effort, enormous blast radius across a 2175-line file, **for a cost that isn't
  even proven to be the bottleneck.** Classic optimize-before-measure. (Keep the
  *idea* noted — if a future capture proves crowd CPU dominates *and* D1/D2 aren't
  enough, revisit. Not now.)
- **C6 / C7 — Chunk planning/geometry in a worker.** The no-build importmap-in-
  workers limitation + load-bearing determinism across the thread boundary make
  this a high-risk way to solve a hitch that **C1 (time-slicing) solves on the main
  thread, safely, with far less surface area.** Not worth the risk delta.
- **F5 — Depth pre-pass.** Frequently a *net loss* on geometry-light scenes (extra
  full geometry pass), and this scene isn't obviously overdraw-bound. If B0 ever
  shows pathological overdraw in dense night hubs, reconsider — but don't build it
  speculatively.
- **E16 — "Catch your breath" speed clamp.** Taking throttle control from the
  player to hide a stall is a feel regression, and A1/A2/A4/E1 already cover the
  same stall without touching controls. The one idea here that trades *gameplay*
  for perf — not worth it.

---

## Recommended first slice (if Gary wants a single coherent push)

**B0 → C1+C2 → A1+A4 → F2 → F1 → D3, wrapped with E1.** That's: see the numbers,
kill the chunk hitch on the main thread, kill the shader stall the principled way
with a perceptual safety net, bank two cheap steady-state GPU wins, and clean up
GC — all within the no-build/determinism/threeShim guardrails, no workers, no
speculative big refactors. The impostor far-field (E2–E5) and BatchedMesh (B1)
are the natural *second* project once B0 tells us whether draws are the next wall.

---

# Part 3 — Re-ranking with the "no-build" constraint relaxed (2026-06-19)

Gary: "not married to no-build — fine with a build step if it opens perf doors."
So the no-build gate is no longer a hard constraint, only a *cost*. Two things
stay true and one thing changes.

**Stays true #1 — the no-build property wasn't arbitrary.** It's documented as a
deliberate design choice (CLAUDE.md, ROADMAP "out of scope", `.claude/rules/
no-build.md`): zero-friction "open index.html and it runs," static GitHub-Pages
deploy with no toolchain, no transpiler/bundler rot, instant module edits. The
cost of a build step is real: a `node_modules`, a CI build before deploy, the
threeShim/importmap dance replaced by a config. Worth reversing *knowingly*, not
by accident — but it's your call and it's a reasonable one.

**Stays true #2 — the recommended first slice does NOT need a build step.** B0,
C1+C2, A1+A4, F1, F2, D3, E1 are all pure main-thread JS. The cheapest, highest-
value wins are build-independent. A build step is an *orthogonal* strategic
decision that mainly de-risks the heavier second-tier work below. So: relaxing
no-build does **not** change what to do first.

**What changes — doors a build step opens (mostly the second engine):**

- **Web Workers become clean** (a bundler handles a worker + its `three` imports;
  no importmap-in-workers limitation). This is the big one. It promotes:
  - **C6 / C7 — chunk planning/geometry off-thread** from *Eliminated* →
    **Tier 2**. Still a higher-ceiling, higher-complexity alternative to C1 (which
    remains the simpler first fix), but the primary objection (no-build worker
    friction) is gone. Determinism across the thread boundary is the remaining
    risk to design around.
  - **D8 / D6 — full crowd sim in a worker + SoA** from *Eliminated* →
    **measurement-gated Tier 2/3**. A bundler removes one of the *two* objections
    (worker friction); the other — *crowd CPU isn't proven to be the bottleneck* —
    **still stands.** Don't build it until a crowd self-time readout says crowd
    dominates and D1/D2 aren't enough. The optimize-before-measure rule survives
    the constraint change.
- **Asset pipeline → compression** (genuinely new perf, not just convenience):
  - **KTX2 / Basis-compressed textures** — smaller GPU upload, lower memory
    (directly helps the iOS ≤2048 cap and mobile memory pressure), faster boot.
    Makes the atlas idea (**B4**) materially more attractive; B4 moves up.
  - **Draco / meshopt geometry compression** — smaller buffers, faster upload;
    helps boot and the chunk-spawn upload cost.
  - **Build-time impostor/atlas baking** — E2/E4/B4 can bake their atlases at
    build time instead of runtime, removing the in-browser-bake awkwardness that
    capped them.
- **Tooling/quality-of-life (not FPS, but real):** tree-shaken three.js (smaller
  boot bundle), minification (faster parse), TypeScript if wanted, and **dropping
  the four-importmap + threeShim CDN juggling** — a whole footgun class
  (`bin/check-importmaps`, the `THREE.X=Y` freeze trap) disappears.

**Recommended tool if you go for it: Vite.** It's the low-friction path that
*keeps the properties you actually care about* — instant HMR (preserves the
fast-edit-reload loop the sandbox depends on), first-class worker + WASM +
KTX2/Draco support, and it still emits a static site you can publish to GitHub
Pages unchanged. It would replace the `serve_nocache.py` + cache-buster + 4×
importmap machinery with config, not add a server.

**Net verdict:** A build step is worth adopting **if** the second engine
(off-thread streaming/crowd via workers, plus texture/mesh compression for
mobile) is where you want to go — it's the only way to cleanly reach those
ceilings. It is **not** a prerequisite for, and does not reorder, the Tier-1
slice. So the sequencing is: **ship the build-independent Tier-1 wins first,
measure (B0), and decide on the build step as the gateway to the worker/compression
tier** once we know whether the remaining cost is CPU-on-main-thread (workers
help) or GPU/draws (compression + batching help). Decide it on evidence, not now.
