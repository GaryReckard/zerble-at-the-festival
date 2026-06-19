# Council — Architect (Round 1): perf-pass-4

**Persona:** The Architect (structural integrity, module boundaries,
ARCHITECTURE.md adherence, registry/lifecycle, render-pipeline shape).
**Verdict:** Proceed with mitigations.

---

## Priority Sequence

My ordering optimizes for *measurement-before-mutation* and *blast-radius
ascending* — ship the diagnostic and the low-coupling wins first, gate the
high-coupling structural change (C1) on a proven determinism harness, and
treat the render-pipeline writers (F1) as a single-owner refactor before any
per-frame gating logic lands.

1. **B0 (measure first).** Nothing downstream can be judged "worth it" until
   `draws=1` is fixed. It's also the lowest structural risk: a pass-through
   `Pass` that reads `renderer.info.render` and forwards the read-buffer is
   additive and reversible. Ship it, confirm the HUD reads realistic per-tier
   numbers, *then* let its numbers gate Tier-2. This is the load-bearing
   dependency for task 8.1 and for both Open Questions.

2. **D3 (pooling, isolated).** Smallest blast radius of the live fixes. The
   `activePassengersRef` literal (crowd.js:605) is a closure allocated
   per-NPC-per-frame; hoisting it touches one call site and its consumer.
   No lifecycle, no determinism, no render-pipeline coupling. Ship early to
   bank a clean win and de-risk the crowd file before D-tier LOD work.

3. **F2 (shadow cadence) — but only after wiring it to a single owner.** Low
   structural risk *in isolation*, but it has a real interaction with
   AdaptiveQuality (see Risk F2 below). Sequence it before F1 because it's
   runtime-only and orthogonal to the bloom writers.

4. **F1 (bloom predicate) as a refactor, not a feature.** The structural work
   here is collapsing three writers to one resolved predicate. Land the
   AdaptiveQuality flag-setter refactor (task 4.1) as its own step and verify
   parity *before* adding `brightInFrame()` gating (task 4.2). Don't ship the
   new behavior on top of an un-refactored ownership model.

5. **A4 then A1 (reveal slicer is the floor, prewarm is the optimization).**
   A4 is the correctness guarantee (≤1 program/frame for *any* variant); A1
   only reduces what A4 must slice. Build A4 first so the system is correct
   even if A1 covers nothing, then layer A1 on top. This matches the design's
   own framing and keeps the title-tap/iOS-audio path change minimal.

6. **C1 (structural — gate hard).** Highest blast radius in the plan. Do not
   write C1 code until (a) the deliberation settles the shape and (b) the
   determinism gate harness (task 6.5) exists and passes on the *current*
   synchronous build (baseline capture). C1 is the one item that can
   regenerate every existing chunk differently if the rng draw order shifts.

7. **E1 (curtain) last among shipped items.** It depends on A4's reveal pump
   (it raises the pump rate) and on the bloom ownership being settled (F1), so
   it can't be correct before those land. It's also the only item that's
   cosmetic-masking rather than a real fix — ship it to host *residual* cost,
   not as a substitute for A1/A4/C1 actually working.

8. **Tier-2 — gate on B0, default to PARK.** Treat the whole perceptual-lod
   spec as a menu B0 unlocks, not a commitment. Of the five, only the
   static-decor geometry merge and crowd LOD have a precedent
   (vendor-booth merge; the `_maxIdx` draw-count trim already in crowd.js).
   Fog-as-far-cull and the atmosphere fakes are new surface area; park unless
   B0 proves the cost is real on low/mid.

---

## Position: C1-a (full coroutine) vs C1-b (phased deferral)

**I back C1-b (phased deferral), and more strongly than the design states —
with one structural caveat that the design under-specifies.**

The deciding fact is in `_generateWorldgen` (chunks.js:477-501) and
`spawnAmbientCrowd` (chunks.js:2945-2974): **the heavy scatter and crowd
spawn read from the same `ctx.rng` instance AND from the registry that the
structure pass just populated.** `spawnAmbientCrowd` calls
`registry.byChunk(ctx.key)` (chunks.js:2950) to find attractors, then draws
`ctx.rng()` repeatedly to place NPCs around them. So the deferred work is
*causally coupled* to the structure pass having already run and registered its
attractors — not merely sequenced after it.

Why this favors C1-b:

- **C1-b's natural seam is already there.** `_generateWorldgen` is a linear
  sequence of named sub-stages (roads → props → trees → crowd → jugs →
  campsites → hedges). The phase boundary "structure (roads/props that define
  collision) synchronous; scatter (trees/crowd/campsites) deferred" maps onto
  existing function calls. The deferred closure captures the *same* `ctx`
  (same `ctx.rng`, same `ctx.key`, same `ctx.group`) and runs the *same calls
  in the same order* — only later. rng draw order is preserved by
  construction, not by careful refactoring.

- **C1-a multiplies the determinism surface.** A full generator that yields
  between every inline `registry.add` (there are 30+ in chunks.js) makes every
  resumption point a place where an interleaving bug can shift a draw. The
  design calls this "determinism-delicate"; I'd call it determinism-hostile.
  The blast radius is the entire worldgen builder set, and the failure mode is
  silent (a re-rolled chunk looks fine — it's just *different* from what a
  player saw yesterday). Per CLAUDE.md tripwire #4, that's the exact class of
  change to avoid.

- **C1-b honors the registry/lifecycle contract more cleanly.** Deferred work
  keys to `chunkKey`; `_unload → disposeChunkByKey` (chunks.js:367-373)
  already drops everything tagged with the key. Cancelling a queued-but-unrun
  closure is "delete the closure from the queue by key" — the structure that
  did land unloads through the existing path. C1-a's half-yielded generator
  leaves a chunk in an *intermediate* registry state that the existing unload
  path was never designed to reason about.

**The caveat the design must absorb (this is my one hard mitigation for C1):**
the spec (frame-budget) says *"the chunk is not added to the scene, and
registers no collidable footprint, until its build is complete."* C1-b as
written contradicts this — its whole point is to add the **structure**
(roads/ground/large collidable props) synchronously and **immediately** so the
chunk is coherent, deferring only non-collidable scatter. Those two statements
can't both hold. The resolution I want on record: **the collidable structure
is exactly the synchronous phase, and the deferred phase must contain ONLY
non-collidable decor + crowd.** If any deferred item registers a collider, a
player can drive into a footprint that isn't there yet (or out of one that's
about to appear). So the phase split is not arbitrary — it's defined by
*"does this entry register a `collider`?"*. The spec scenario should be
reworded to "no *deferred* entry registers a collidable footprint; all
colliders land in the synchronous structure phase." This needs to be a written
constraint in design.md before task 6.3, because the current builder dispatch
(`buildWorldgenKind`, chunks.js:1304-1322) interleaves collidable stages
(stages, vendor rows, camp villages — all register colliders) that the design
loosely lumps under "structure" with scatter. Someone has to audit which
`buildWorldgenKind` cases register colliders and pin them all to the
synchronous phase.

---

## Structural Risks Identified

- **[C1 / spec contradiction] "No collidable footprint until complete" vs.
  "structure synchronous, scatter deferred."** The frame-budget spec and the
  C1-b design describe incompatible behaviors. Impact: either the spec is a
  lie (colliders DO appear before the chunk finishes, under C1-b) or C1-b is
  mis-described. Mitigation: redefine the phase boundary as
  *collider-registering = synchronous, decor/crowd = deferred*, audit every
  `buildWorldgenKind` case (chunks.js:1304-1322) for collider registration,
  and reword the spec scenario accordingly. Without this, a player can collide
  with the absence (or future presence) of a stage/vendor footprint mid-stream.

- **[C1 / rng coupling] Deferred crowd spawn depends on registry state from
  the structure pass.** `spawnAmbientCrowd` reads `registry.byChunk(ctx.key)`
  (chunks.js:2950) before drawing `ctx.rng()`. Impact: the deferral is only
  determinism-safe if (a) the structure pass has fully registered its
  attractors before the deferred crowd closure runs, AND (b) no *other*
  chunk's deferred work interleaves a `registry.add` to this key in between.
  Mitigation: the determinism gate (task 6.5) must diff a chunk built with
  *neighboring chunks also mid-deferral* — not just one chunk in isolation —
  because `registry.byChunk(ctx.key)` is key-scoped but the queue is global.
  Single-chunk byte-identity is necessary but not sufficient.

- **[C1 / lifecycle] Cancellation must drop the queued closure AND any partial
  group nodes without orphaning.** The structure phase calls `scene.add(group)`
  and `this.loaded.set(key, …)` (chunks.js:403-404). If a chunk's deferred work
  is queued but the chunk leaves the ring, `_unload → disposeChunkByKey` runs
  on the *partial* group. Impact: clean, as long as the queue entry is also
  purged in the same `_unload` (otherwise a re-entered chunk double-generates,
  or a stale closure runs against a disposed group). Mitigation: `_unload` must
  delete the by-key deferred queue entry; add this to the disposeChunkByKey
  sweep (it already "sweeps every by-key side-list" per chunks.js:368-371 —
  the deferred queue becomes one more such side-list, which is the *right*
  structural home for it).

- **[F2 / AdaptiveQuality co-ownership] Two systems will write
  `shadowMap.needsUpdate` / `autoUpdate` without a single owner.**
  AQ's `_setShadowsOn(false)` sets `renderer.shadowMap.needsUpdate = true`
  (adaptiveQuality.js:233) to force one clean empty-map render after the
  castShadow-walk; `_setShadowsOn(true)` flips casters back on
  (adaptiveQuality.js:211-220) and expects the *next* render to repopulate.
  Once F2 sets `autoUpdate = false`, the "next render repopulates" assumption
  on the AQ raise path breaks — the map won't refresh until F2's cadence
  ticks, so shadows can stay blank for up to `SHADOW_UPDATE_EVERY` frames after
  a quality *raise*. Impact: a visible shadow flicker on AQ level changes.
  Mitigation: F2 must own `autoUpdate`/`needsUpdate` as the single writer, and
  AQ's shadow toggle should request a one-shot `needsUpdate = true` *through*
  F2 (or F2 must force `needsUpdate` on the frame after any AQ shadow
  transition). Document this as a single-owner contract, same shape as the F1
  bloom resolution.

- **[F1 / writer ownership] Three writers to `bloomPass.enabled` is a
  boundary violation already in the codebase; F1 must not become a fourth
  un-coordinated one.** Today: boot (main.js:147) and AQ
  (adaptiveQuality.js:171). The design's resolution (AQ sets a flag, one place
  computes `PERF.bloom && aq.bloomAllowed && brightInFrame()`) is correct and
  is the *right* structural fix. Risk is half-doing it: if F1 ships the
  per-frame `brightInFrame()` write while AQ still writes `bloomPass.enabled`
  directly, they fight every frame. Mitigation: land task 4.1 (AQ →
  flag-setter) and verify bloom parity *before* task 4.2 adds gating. Sequence
  is load-bearing, not cosmetic.

- **[A1 / threeShim + boot-order] Prewarmed programs must be keyed to the
  real draw, and the warm kick must not perturb the iOS audio gesture.**
  The renderer compiles tier-define-specific programs (fog, shadow, low-tier
  Lambert swap via threeShim — main.js:127 warns low is a *different program
  set*). Impact: a warm mesh built with a raw `MeshStandardMaterial` (not
  through the threeShim-backed factory) links a program the world never draws —
  wasted compile, zero stall reduction, and on low it warms the wrong path
  entirely (task 5.4 calls this out). Mitigation: construct warm meshes through
  the same factories the world uses (registry of "known heavy variants" sourced
  from the actual model builders, not hand-rolled). Boot order: `Sound.init()`
  stays the first synchronous call in the title-tap handler (CLAUDE.md tripwire
  #3); `compileAsync` is kicked *after* it and allowed to resolve late — it must
  not be `await`ed inline in the gesture. This is correctly stated in the
  design; flag it as a review must-check, not a design gap.

- **[B0 / pass ordering] The InfoCapturePass must read at composer index 1 and
  never reset.** `renderer.info.render.calls` accumulates within a frame and
  resets on the next `renderer.render`/composer pass with `autoReset` true.
  Impact: if the capture pass is inserted after bloom/trip, it reads the
  fullscreen-pass-inflated value (the design correctly rejects
  `autoReset=false` + post-composer read). The capture must sit immediately
  after `RenderPass` (composer.addPass order, main.js:140) and snapshot before
  bloom runs. Low risk, but the *placement* is the whole correctness of B0 —
  one wrong `addPass` index and the number is still garbage. Both debug.js
  consumers (HUD ~1029, perf ~1609) must read `lastSceneInfo`, not live
  `info.render` — partial migration leaves the HUD lying while the log is
  honest (or vice versa).

- **[Tier-2 / new surface area without precedent] Fog-as-far-cull and
  atmosphere fakes are net-new subsystems masquerading as perf tweaks.**
  Geometry merge and crowd LOD reuse existing patterns (vendor-booth merge;
  the `_maxIdx` draw trim, crowd.js:620). But fog-bounded `camera.far` cull
  changes a global camera invariant (camera.far is 1500, main.js:136; fog far
  is 520, world.js:344) — pulling far in to fog distance could clip the skybox
  or distant hub silhouettes the player *can* see through thin fog. Impact:
  visible pop-out, the exact thing the spec scenario warns against.
  Mitigation: keep these PARKED behind B0 evidence; if reached, they each want
  their own sandbox/hub-viewer verification, not a "small knob" treatment.

---

## Module-Boundary / ARCHITECTURE Adherence Check

- **No new modules expected → no importmap churn.** Confirmed against the
  plan; all edits land in existing files (main.js, chunks.js, crowd.js,
  debug.js, world.js, adaptiveQuality.js, perf.js). If a Tier-2 item spins out
  a helper module (e.g. a billboard light-shaft builder under `src/models/`),
  it triggers the full new-model checklist (importmap ×4, sandbox dropdown,
  loadEntity, hit kind) — flag at that point, run `bin/check-importmaps`.

- **Render-pipeline shape preserved.** B0's capture pass is a no-draw
  pass-through; it doesn't alter the RenderPass → bloom → trip → fxaa → output
  chain, only observes it. E1's curtain rides existing bloom strength +
  tone-exposure — no new pass. F1/F2 are runtime gates on existing passes/the
  shadow map. None of this introduces a bespoke render loop or breaks the
  EffectComposer ownership in main.js. Good.

- **Determinism placement.** C1-b keeps every `rng()` draw inside the same
  `ctx.rng` instance and the same call sequence — no ad-hoc `Math.random`, no
  re-salting (CLAUDE.md tripwire #4). The `_placeSpawnJugs` path already
  models the "no `ctx.rng` so it can't shift layout" discipline
  (chunks.js:504-505) — deferred work must inherit that rigor.

- **Disposal/shared-resource contract.** Tier-2 geometry merge must tag merged
  output and skip `userData.shared` inputs (perceptual-lod spec scenario
  already states this; reuse the vendor-booth precedent). C1's partial chunks
  unload through `disposeChunkByKey`, which already honors the shared flag.

---

## Verdict

**Proceed with mitigations.**

The plan is structurally sound and respects the project's hard boundaries
(no-build, threeShim, registry/chunkKey lifecycle, determinism discipline).
B0/D3/F2/F1/A4/A1 are well-scoped and additive. My mitigations are gating
conditions, not blocks:

1. **C1 must reconcile the spec contradiction** (collidable footprint vs.
   deferred structure) by defining the phase boundary as
   *collider-registering = synchronous* and auditing `buildWorldgenKind`
   accordingly — before any C1 code is written.
2. **C1's determinism gate must test concurrent multi-chunk deferral**, not
   single-chunk isolation, because `spawnAmbientCrowd` reads global registry
   state.
3. **F2 and F1 must each be made single-owner** (shadowMap needsUpdate; bloom
   enabled) before their new gating behavior lands — refactor first, feature
   second.

With those, I back C1-b over C1-a and endorse the proposed sequencing with B0
strictly first and C1 strictly gated last among the live fixes.

## Round 2 — Reactions

-   **Re: Adversary — "the shadow ortho frustum is pinned to the cart so shadows
    render no matter how far Zerble drives ... with `shadowMap.autoUpdate = false`,
    every receiving material still samples it using the light's current (moved)
    view-projection matrix ... shadows smear/offset/drift off their casters"
    (council-adversary.md, F2 vulnerability)**: **Concede — this is correct and it
    changes my structural sequencing of F2.** I verified `world.js:139-141`: every
    frame `sun.position.x += playerPos.x`, `sun.position.z += playerPos.z`, and
    `sun.target.position.set(playerPos.x, 0, playerPos.z)` re-anchor the shadow
    camera to the cart (the comment at 130-134 says so explicitly). My Round-1 F2
    risk only addressed the *AdaptiveQuality co-ownership* of `needsUpdate`; I
    treated the cadence itself as structurally benign because I, like the design,
    implicitly assumed a slow-moving light over static casters. That assumption is
    false under motion. `autoUpdate = false` freezes the *depth-map render* but NOT
    the light's *view-projection matrix* — that matrix is recomputed every frame
    from the moved `sun.position`/`sun.target`, so receivers sample a depth texture
    rendered for an old player location through a projection aimed at the new one.
    The result is geometric drift, not mere staleness. This is a genuine structural
    fault: F2 as specified has **two writers of shadow-camera state on different
    cadences** — `world.js` moves the camera every frame, F2 re-renders the map
    every N frames. They must move on the *same* cadence or not at all.

-   **Re: Adversary — "until then F2 is Block" (council-adversary.md, Verdict)**:
    **Partially concede, with a structural framing the Adversary doesn't state.**
    F2 is not *intrinsically* blocked — it's blocked *as designed*, because the
    design omits the player-anchored frustum. There is a clean structural mitigation
    that keeps F2 alive and respects single-ownership: **bind the shadow-map refresh
    to the same event that moves the shadow camera.** `world.js` already gates its
    *ground* resample on a movement threshold (`GROUND_RESAMPLE_THRESHOLD`,
    world.js:121-127) — F2 should mirror that exact pattern: force
    `shadowMap.needsUpdate = true` on the frame the sun frustum is re-centered past
    a movement delta (or every frame the player's speed exceeds a threshold), and
    only amortize-skip while ~stationary. That makes `world.js` (which already owns
    the sun transform) the single owner of *both* the camera move and the refresh
    request — F2 becomes "skip the re-render only when the camera didn't
    meaningfully move," which is correct by construction and collapses the
    two-writer problem. So my revised position: F2 is **Proceed with a hard
    mitigation** (movement-gated refresh co-located with the sun-follow in
    `world.js`), not an unconditional Block — but it MUST NOT ship on a bare
    frame-counter cadence, which is what the design currently describes. If the
    movement-gating is rejected, then I agree it degrades to Block.

-   **Re: Profiler — "Tie `needsUpdate` to camera/sun movement, not just a frame
    counter ... the sun frustum is only 60m (mid) / 100m (high) wide, and at boost
    ~28 m/s the player traverses that in ~2-3.5s" (council-profiler.md, F2)**:
    **Agree, and it strengthens the mitigation above.** The Profiler reaches the
    same movement-gated-refresh conclusion from the frustum-width/traversal-speed
    angle that the Adversary reaches from the VP-matrix angle. Two independent
    derivations of "don't use a bare frame counter" is strong signal that the
    movement-gate is the correct structural form, not a nice-to-have. It also
    confirms my single-owner framing: the refresh trigger and the frustum width both
    live in `world.js` (sun-follow + `world.js:363`), so co-locating the refresh
    decision there is the clean boundary.

-   **Re: Profiler — "F2 amortized shadow buys nothing on low (shadows off there)"
    (council-profiler.md, risk table) and "F1 ... bloom is ON at all three tiers ...
    so unlike F2 this helps low/mid too" (council-profiler.md, Priority #5)**:
    **Concede a sequencing error in my Round-1 ordering.** I sequenced F2 before F1
    purely on coupling grounds (F2 runtime-only, F1 needs the writer refactor). The
    Profiler's tier data (`perf.js:57` low shadows off; bloom on all three tiers)
    shows F2 delivers **zero** value on the squeeze tier while F1 helps it — which
    means on a value-per-tier basis F1 outranks F2 for the tier that matters most.
    This doesn't overturn my "F1 must be a single-owner refactor before its gating
    behavior lands" constraint (that still holds), but it does mean F2's lower
    coupling shouldn't have floated it above F1 in priority. Both still gate behind
    their respective single-owner refactors; I withdraw the implication that F2 is
    the more valuable of the two.

-   **Re: Auditor — "the frame-budget spec 'registers no collidable footprint until
    complete' is satisfied at the structure boundary, and scatter is non-collidable
    ambient" (council-auditor.md, C1-b position) and Adversary — "C1-b keeps the
    structure that defines collision ... synchronous so the chunk is immediately
    coherent the moment it's registered" (council-adversary.md, C1 position)**:
    **My Round-1 finding is softened, not refuted — and that's the right outcome.**
    I flagged the spec sentence as a *contradiction* with C1-b. Both the Auditor and
    Adversary read it as *satisfiable* — but only under the exact resolution I
    demanded: that the synchronous structure phase is defined as "everything that
    registers a collider," so "no collidable footprint until complete" becomes "no
    collidable footprint until the *structure* phase completes," with the deferred
    phase carrying only non-collidable scatter. The Auditor states this as already
    true ("scatter is non-collidable ambient"); I'm less willing to grant that
    without the audit, because `buildWorldgenKind` (chunks.js:1304-1322) dispatches
    collider-registering cases (stages, vendor rows, camp villages) that the design
    loosely files under both "structure" and "scatter." So: the *spec wording* is
    salvageable (concede to Auditor/Adversary that it need not be a literal
    contradiction), but the *audit obligation* I raised stands — someone must
    enumerate which `buildWorldgenKind` cases register colliders and pin every one
    to the synchronous phase, and the spec scenario should be reworded to
    "collider-registering work is synchronous; deferred work is collider-free."
    Two personas independently treating the structure boundary as the collision
    boundary *confirms* my proposed resolution is the consensus shape; it does not
    eliminate the audit.

-   **Re: Adversary & Auditor — "crowd spawn must be the LAST deferred stage, or the
    deferred batch must be atomic per chunk" (council-adversary.md, C1 half-built
    vulnerability) and the D3 two-channel `count`/`add` semantic (council-auditor.md
    Deficiency; council-adversary.md D3)**: **Agree; both sharpen my C1 rng-coupling
    risk and add one I missed.** My Round-1 C1 risk noted `spawnAmbientCrowd` reads
    `registry.byChunk(ctx.key)` before drawing rng — the Adversary extends that
    correctly: crowd spawn injects into the *live* `this.crowd` system
    (chunks.js:456/492), not just the chunk group, so its *ordering within the
    deferred batch* is a lifecycle constraint (last, or atomic) on top of my
    determinism constraint. That's additive to my position, and I adopt it. On D3:
    I did not surface the `count`-snapshot-vs-`add`-live-counter split in Round 1
    (I treated D3 as the trivially-safe early win). The Auditor and Adversary are
    right that a naive module-scope hoist changes the boarding-throttle semantics.
    This doesn't touch *my* domain (no lifecycle/boundary/determinism dimension),
    so I defer to them on it — but I withdraw any implication that D3 is a
    zero-thought hoist.

### Revised Verdict

-   **New Verdict**: **Proceed with mitigations** (unchanged headline) — but with
    F2 reclassified from "low structural risk in isolation" to **"requires a hard
    single-owner movement-gated-refresh mitigation, co-located with the sun-follow
    in `world.js`, or it degrades to Block."** What moved me: the Adversary's
    `world.js:139-141` player-anchored-frustum finding (verified in source),
    corroborated independently by the Profiler's frustum-width/traversal-speed math.
    Together they prove F2 has a real two-writer-on-different-cadences structural
    fault that my Round-1 analysis missed entirely — I had only flagged the
    *AdaptiveQuality* co-ownership of `needsUpdate`, not the *per-frame sun-follow*
    co-ownership of the shadow camera itself. The fix is structurally clean (mirror
    the existing `GROUND_RESAMPLE_THRESHOLD` movement-gate pattern, single owner in
    `world.js`), so F2 stays in the plan — but my Round-1 sequencing that floated F2
    above F1 on "low coupling" grounds was wrong on two counts: F2 is *not* low
    coupling (it co-owns shadow-camera state with the per-frame sun-follow), and it
    delivers zero value on the low/squeeze tier where F1 helps. Revised sequencing:
    B0 → D3 → **F1 before F2** → A4 → A1 → C1 (gated). My C1 spec-contradiction
    finding is confirmed-as-salvageable: the Auditor and Adversary both adopt my
    "structure boundary = collision boundary" resolution, which means the spec
    wording can be fixed without a behavior change — but the `buildWorldgenKind`
    collider audit I demanded remains a precondition, not optional.

### Summary

My final verdict is **Proceed with mitigations**. The argument that moved me was
the Adversary's player-anchored shadow-frustum finding (`world.js:139-141`,
verified, and independently corroborated by the Profiler): it exposes a real
two-writer structural fault in F2 that my Round-1 read missed, and it both
reclassifies F2 as a hard-mitigation item and corrects my sequencing (F1 should
precede F2 — F2 is neither low-coupling nor low-tier-relevant). F2 is not
unconditionally blocked: there is a clean single-owner mitigation — gate the
shadow-map `needsUpdate` on the same movement delta that already re-centers the
sun, mirroring the `GROUND_RESAMPLE_THRESHOLD` pattern in `world.js`. On my own
Round-1 finding: the spec's "no collidable footprint until complete" is confirmed
*salvageable* (the Auditor and Adversary both adopt my structure-boundary =
collision-boundary resolution), so it need not be reworded as a contradiction —
but the obligation to audit `buildWorldgenKind` (chunks.js:1304-1322) for
collider-registering cases and pin them all to the synchronous phase stands. C1-b
over C1-a is now unanimous across all five personas.
