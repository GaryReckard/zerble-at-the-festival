## Adversary's Position

### Priority Sequence

Ordered by **blast radius if the assumption is wrong**, safe-first. The plan's
own sequence is roughly right; I re-rank the gating around the two items that can
detonate (F2 shadows, A1 boot-path) and the one that can silently corrupt every
player's world (C1).

1. **B0 first — measurement, zero blast radius.** The `InfoCapturePass` at
   composer index 1 does no draw; `renderer.info.autoReset` defaults `true` so
   each pass's `render()` resets `info.render`, which is exactly why a snapshot
   *immediately after* `RenderPass` (before bloom/trip/fxaa/output overwrite it)
   is correct. `progDelta` is nearly free — `debug.js:1613` already captures
   `info.programs.length` as `prog`; the delta is a one-line diff of a value
   already in the perf sample. Ship B0 before anything else: every other item's
   verification depends on its numbers, and it can't break the game.

2. **D3 second — pooling, contained.** Hoisting the `activePassengersRef`
   closure (`crowd.js:605`) is low-risk *if* the behavioral contract is preserved
   (see Vulnerabilities). It touches only the crowd hot loop, not boot, not
   determinism, not the render pipeline. Bank it early.

3. **F1 third — bloom gate, contained but needs the single-writer refactor.**
   Three writers to `bloomPass.enabled` (boot `main.js:147`, AQ
   `adaptiveQuality.js:171`, F1 per-frame) WILL fight unless AQ becomes a
   flag-setter and one site computes the final enabled. Visual-only regression
   risk; no boot or determinism exposure.

4. **F2 gated — amortized shadow map. This is the highest-severity item in the
   plan and the design's framing of it is wrong.** Must be blocked until the
   player-anchored shadow frustum is accounted for (see Vulnerabilities → F2).

5. **A1/A4 gated — prewarm + sliced reveal.** A4 (reveal slicer) is the safe,
   correctness-guaranteeing half and should land first. A1 (prewarm) sits in the
   iOS-audio boot path and must be proven to not introduce an async hop before
   `Sound.init()` and to construct warm meshes through `threeShim` — verify both
   before merge.

6. **C1 gated on the determinism harness — do NOT merge without a byte-identical
   registry-dump diff.** This is the only item that can corrupt every mid-game
   player's world silently. C1-b is the right shape (argued below), but the gate
   is the determinism proof, not the shape choice.

7. **E1 last — depends on A1/A4 landing first** (it raises the A4 reveal pump
   rate during the curtain). Pure polish; defer until the compile-stall is
   actually flattened or the curtain is masking nothing.

8. **Tier-2 — measurement-gated as written.** Don't pre-build. The geometry
   merge is the only Tier-2 item with a disposal tripwire; if reached it must
   reuse the vendor-booth `userData.shared` pattern, not invent a second one.

### Vulnerabilities Found

-   **[F2 — player-anchored shadow frustum, not a slow-crawling sun]**: The
    design claims F2 is safe because "the sun crawls, casters are static." That is
    false during movement. `world.js:139-141` re-sets `sun.position.x +=
    playerPos.x`, `sun.position.z += playerPos.z`, and `sun.target.position` to
    the player **every frame** — the shadow ortho frustum is pinned to the cart so
    shadows render "no matter how far Zerble drives" (the comment at
    `world.js:130-134`). With `shadowMap.autoUpdate = false`, the depth map is NOT
    re-rendered, but every receiving material still samples it using the
    light's **current** (moved) view-projection matrix. Result during a boost
    (~28 m/s, crosses a chunk every ~2.8s): the cached shadow map is positioned
    for an old player location, so shadows **smear/offset/drift off their casters**
    — far worse than "stale." This hits mid and high tiers (shadows on), is
    invisible while parked (which is exactly how it will pass a stationary
    sandbox/screenshot check), and only shows under motion — the unhappy path the
    plan's verification (Noon + Midnight screenshots) won't catch. — Severity:
    **High**.

-   **[F2 — AQ coordination + the empty-map trap is adjacent, not avoided]**: The
    design says F2 "is NOT the empty-map disable path." Correct in mechanism, but
    F2 introduces a *second* owner of shadow cadence alongside AdaptiveQuality.
    AQ's `_setShadowsOn` (adaptiveQuality.js:210-233) does the castShadow-walk and
    then sets `renderer.shadowMap.needsUpdate = true` (line 233) to flush. With
    `autoUpdate = false` globally, AQ's restore-shadows path now depends on F2's
    `needsUpdate` plumbing for the empty-render-then-repopulate to land on the
    right frame. If F2's per-N-frame `needsUpdate` and AQ's one-shot `needsUpdate`
    race or one clobbers the other's frame, you can land back in the
    frozen/empty-shadow state AQ was written to prevent. This is the same
    triple-writer failure mode the plan flagged for bloom — but the plan only
    mitigated it for bloom, not for shadows. — Severity: **Medium**.

-   **[C1 — single shared `ctx.rng` stream; deferral must resume it mid-stream]**:
    `_generateWorldgen` (chunks.js:477-501) draws from **one** `ctx.rng =
    mulberry32(chunkSeed)` in a strict, deliberately-ordered sequence: roads →
    props → trees → crowd → jugs → campsites → hedges. The order is load-bearing
    and documented — `chunks.js:497` explicitly notes jugs are "placed after the
    crowd so it shares v1's crowd-then-jugs ctx.rng ordering." For C1-b to be
    byte-identical, the deferred-scatter closure must hold the **same** mulberry32
    instance and resume drawing from it later, with no other call touching that
    stream in between. The good news: each chunk has its own per-chunk-seeded
    stream, so there is no cross-chunk contamination — a deferred chunk's rng can't
    be perturbed by a neighbor generating in the gap. The risk is *intra*-chunk:
    if "structure" is split at any boundary other than a clean stage boundary, or
    if the deferred phase re-creates `ctx.rng` instead of carrying it, the draw
    order shifts and **every existing chunk regenerates differently** for any
    player who has driven across the change. The determinism gate (task 6.5,
    registry-dump diff against a fixed seed) is non-negotiable and must be a
    merge-blocker, not a post-hoc check. — Severity: **Critical if ungated**,
    mitigated to Low by the byte-identical gate.

-   **[C1 — half-built/cancelled chunk with live crowd already spawned]**:
    `spawnAmbientCrowd(ctx, crowdCount)` (chunks.js:456/492) injects NPCs into the
    **live** `this.crowd` system, not just the chunk group. If C1-b defers crowd
    spawn and the chunk leaves the load ring before the deferred phase runs,
    cancellation must drop the *queued closure* cleanly (no spawn). But if crowd
    spawn already ran and *other* deferred work is cancelled mid-stream, you can
    orphan NPCs whose chunkKey teardown assumptions don't match a partially-built
    chunk. `_unload → disposeChunkByKey` (chunks.js:371) sweeps everything tagged
    with the key including crowd — so the safe rule is: **crowd spawn must be the
    LAST deferred stage, or the whole deferred batch must be atomic per chunk.**
    Also guard against double-generate on re-entry: a chunk that unloaded with a
    pending-but-uncancelled queue entry, then re-enters the load ring, must not run
    both the old queued closure and a fresh `_generate`. Key everything by
    `chunkKey` and clear the queue entry in `_unload`. — Severity: **High**.

-   **[A1 — iOS-silent regression if compileAsync moves before Sound.init()]**:
    `Sound.init()` is the synchronous call at `main.js:543` inside the trusted-tap
    handler; the comment at 540-542 is explicit that any await/setTimeout boundary
    before it loses gesture status and ships iOS silent. A1's
    `renderer.compileAsync()` returns a Promise. It MUST be kicked **after** line
    543 and must not be `await`ed in a way that hoists work ahead of `Sound.init()`
    or blocks `startIntroReveal()` (main.js:551). The safe shape: `Sound.init()`
    synchronous first, then fire-and-forget `compileAsync(...)` whose `.then`
    seeds the A4 seen-set later. If an implementer writes `await compileAsync`
    inside the handler before init, every iOS player goes silent — and the
    verifier can't catch it because the agent's verification machine
    (Codespaces/desktop) isn't iOS Safari. — Severity: **High** (iOS-only, and
    invisible to the available verification surface).

-   **[A1 — threeShim program-key mismatch wastes the prewarm]**: Prewarmed
    materials must be built through the same `threeShim`-backed factories the world
    uses, including the tier defines. On `?perf=low` the threeShim Lambert swap
    produces a **different** program set than mid/high Standard (task 5.4 notes
    this). If A1 prewarms Standard materials but low tier draws Lambert, the warm
    programs don't match the real draws → A1 warms nothing on low, and the 137-343ms
    stall reappears for low-tier players. A4's reveal slicer is the safety net
    here, which is why A4 must land and be verified on `?perf=low` independently —
    don't let A1's prewarm coverage be the only defense. Also: do NOT
    `THREE.X = Y` to build warm variants; go through the importmap shim. —
    Severity: **Medium**.

-   **[D3 — the closure carries behavior, not just a value]**: `crowd.js:605`
    allocates `{ count: activePassengers, add: () => activePassengers++ }`
    per-NPC. `count` snapshots the frame-local `activePassengers` at call time;
    `add` is a closure that **mutates** the frame-local counter (consumed at
    crowd.js:779 `count < MAX_PASSENGERS` and crowd.js:788 `add()`). A naive
    "hoist the object to module scope" breaks this if `add` no longer closes over
    the live `activePassengers` accumulator, or if `count` is read stale after a
    sibling NPC boards in the same frame. The pooled scratch must (a) refresh
    `count` to the current accumulator each NPC, and (b) keep `add` incrementing
    the same per-frame counter. Get this wrong and you either exceed
    MAX_PASSENGERS (over-boarding) or never board (count stuck stale) — a gameplay
    regression that's silent in a screenshot. — Severity: **Medium**.

-   **[B0 — InfoCapturePass must not perturb autoReset semantics]**: B0 relies on
    `renderer.info.autoReset = true` (default) so each pass's render resets
    `info.render`. If any task in this change (or a future one) flips
    `info.autoReset = false` to get cumulative counts, the index-1 snapshot
    becomes a *cumulative* read, not a per-scene-render read, and the HUD silently
    over-counts again — the exact blindness B0 set out to fix. The capture pass
    should assert/document that it owns the post-RenderPass read and that autoReset
    stays default. Low blast radius, but worth a guardrail comment. — Severity:
    **Low**.

-   **[Sandbox-pass ≠ game-pass for C1/F2]**: Neither `sandbox.html` nor
    `hub-sandbox.html` exercises the streaming `ChunkManager.update` budget loop or
    the per-frame `world.js:139` sun-follow — they build on a flat plane,
    stationary. So C1's time-slicing and F2's motion-shadow drift **cannot be
    verified in any sandbox**; both require the running game with the player
    actually driving across hubs (task 6.6 / task 3.x). The verification owner is
    Gary's real-GPU machine (Codespaces has no WebGL). The plan must treat
    "boot the game and drive a boost run across ≥2 hubs while watching shadows and
    cgWorst" as the acceptance test for C1+F2, not a screenshot. — Severity:
    **Medium** (process risk: these are exactly the items that pass sandbox and
    fail in motion).

### Position: C1-a vs C1-b

**Prefer C1-b (phased deferral), but the determinism gate — not the shape — is
what makes either safe.**

Both shapes can be made byte-identical: C1-a yields between the *same* calls in
the *same* order (equivalent by construction); C1-b runs the same calls later in
the same order off a carried `ctx.rng`. So determinism is not the differentiator
— **lifecycle blast radius is**, and C1-b wins there:

- C1-a turns *every* inline `registry.add` / `spawnAmbientCrowd` /
  `scatterWorldgenTrees` site inside `_generateWorldgen` into a resumable yield
  point. Each yield is a new place where a mid-build chunk can be observed
  half-populated by collision/crowd/registry queries running on intervening
  frames — colliders may exist while their visual hasn't built, or vice versa.
  That's a large surface for "footprint present before chunk is coherent."
- C1-b keeps the **structure that defines collision** (roads, ground, large
  collidable props) synchronous so the chunk is *immediately coherent* the moment
  it's registered, and only defers cosmetic/ambient scatter (trees, ambient
  props, campsites, crowd). The half-built window is bounded to "looks sparse for
  a few frames," not "has colliders without geometry."

The one hard requirement C1-b adds beyond C1-a: the deferred closure must carry
the **live `ctx.rng` instance** (resume the stream), and **crowd spawn must be
the last deferred stage or the deferred batch atomic per chunk** (it injects into
the live crowd, see the half-built vulnerability above). With those two
constraints, C1-b is lower-risk than C1-a at equal determinism.

### Verdict

-   **Verdict**: **Proceed with mitigations**.
-   **Key Concern**: **F2's amortized shadow map is built on a false premise** —
    the shadow frustum is player-anchored and re-centered every frame
    (`world.js:139-141`), so `autoUpdate = false` smears shadows during movement,
    not merely stales them. This is the highest-severity item and the plan's risk
    analysis misses it entirely.
-   **Recommendation**: Ship B0 → D3 → F1 → A4 first (contained, verifiable).
    Gate F2 behind a fix for the player-anchored frustum (e.g. force
    `needsUpdate` whenever the player moves beyond a threshold, or only amortize
    while ~stationary) and an explicit AQ-coordination rule for shadow cadence —
    until then F2 is **Block**. Gate A1 behind proof that `compileAsync` stays
    after `Sound.init()` and builds warm meshes through `threeShim`. Gate C1
    behind the byte-identical registry-dump determinism diff (task 6.5) as a
    hard merge-blocker, with crowd spawn ordered last in the deferred batch.
    Prefer C1-b. Treat "boot the game and drive a boost run" — not a stationary
    sandbox screenshot — as the acceptance test for C1 and F2.

## Round 2 — Reactions

I re-verified the load-bearing fact against ground truth before reacting:
`world.js:135-142` re-centers the shadow frustum on the player **every frame**
(`sun.position.x += playerPos.x`, `sun.position.z += playerPos.z`,
`sun.target.position.set(playerPos.x, 0, playerPos.z)`), and the frustum
half-width is `shadowD = PERF.name === 'high' ? 100 : 60` (`world.js:363`). My
Round-1 line cites drifted by a few lines (file is 15.6K, not the offsets I
quoted) but the code is exactly as I described it. The F2 premise stands on real
code, not a stale read.

### React to Profiler — "salvage F2 by tying `needsUpdate` to sun/camera movement, flip `autoUpdate=false` only after first good map"

Profiler (`council-profiler.md:57, 87-93, 191`) and the table row "F2 stale map
smears as sun crawls / NPCs move under it" reach the **same** mechanism I
flagged, and the proposed mitigation is the right *shape*. But it does **not**
fully close my BLOCK, for a reason the salvage as phrased under-specifies:

- **"Tie `needsUpdate` to sun/camera movement"** is necessary but, taken
  literally, insufficient. The thing that moves is not the *camera* and not the
  *sun arc* — it is the **player-anchored frustum origin** (`world.js:139-141`).
  During continuous driving the frustum translates *every frame* by the full
  per-frame displacement. At boost ~28 m/s that is ~0.45m/frame; the 60m
  half-width means the player crosses a frustum-width in ~2.1s (mid). So the
  honest predicate is "force `needsUpdate` whenever `playerPos` moved more than
  a small fraction of `shadowD` since the last shadow render" — and at boost
  that predicate fires **almost every frame**, which collapses F2 back toward
  `autoUpdate = true` exactly when the player is moving. F2 only banks its win
  while the cart is slow/stopped. That is a real but **much narrower** win than
  the plan implies, and it must be stated as such.

- **The smear is still there in the gap frames.** Even with a movement-keyed
  `needsUpdate`, between two forced updates the receiving materials sample the
  cached depth map through the light's *current* (already-moved) view-projection
  — so for the N frames you skip, the cart's own shadow lags its body. Profiler's
  own row rates this Medium and notes "the player drives out from under a stale
  map fast." Agreed. The mitigation bounds the smear; it does not eliminate it.
  The acceptance test must be a **boost run watched in motion**, not a stationary
  screenshot — which both Profiler and I independently land on.

- **"Flip `autoUpdate=false` only after the first good map"** — fully concede
  this half. It cleanly kills the empty-first-N-frames trap (`adaptiveQuality.js`
  AQ comment region) and is the correct ordering. Profiler is right and I adopt
  it into my F2 gate.

**My F2 position: softened from BLOCK to "Proceed, scope-capped."** The salvage
is viable *if* the design records two things in writing: (1) the win is
**mid/high, near-stationary only** — F2 buys little during sustained boost and
**nothing on low** (shadows off, `perf.js`), so it must not be sold as a
boost-smoothness fix; (2) the movement-keyed `needsUpdate` threshold is a
fraction of `shadowD`, and the acceptance test is a Gary-side boost run watching
the cart's own shadow track its body. With those, F2 is no longer a
false-premise BLOCK — it is a correctly-scoped, modest steady-state win. Without
the explicit scope cap it reverts to BLOCK, because shipping it as "smoother
shadows while driving" is the exact regression I raised.

### React to Auditor — independent confirmation of the D3 two-channel-closure trap

Auditor (`council-auditor.md:48-60`) independently reconstructs the same trap I
raised (`council-adversary.md` D3 vuln): `count` is a **by-value frame-start
snapshot** read at the boarding gate (`crowd.js:779`), while `add()` mutates a
**separate live counter** consumed at `crowd.js:788`. Two reviewers landing on
the identical semantic split from different lenses raises my confidence this is
real, not a misread — concede nothing, but the **agreement sharpens the required
mitigation** beyond what either of us said alone:

- The fix is **not** "module-scope scratch with `scratch.count = activePassengers;
  scratch.add = () => scratch.count++`." That collapses the two channels into one
  and makes the gate see live mid-frame increments, changing the boarding
  throttle. Auditor names this precisely.
- The required shape: pooled scratch whose `count` field is **set once per NPC to
  the frame-start accumulator** and whose `add` increments a **distinct** live
  counter (the one `crowd.js:589`/the per-frame accumulator already tracks), never
  `count` itself.
- The verification must be tightened from task 2.3's coarse "passenger pickup
  still works" to an explicit assertion that **`.count` does not reflect an
  in-frame `add()`** — i.e. board two NPCs in one frame and confirm the second
  sees the same `count` snapshot the first did. A screenshot cannot catch an
  off-by-throttle regression; this needs a behavioral assertion. I fold
  Auditor's "assert `.count` stays frame-start" into my D3 mitigation as a hard
  task edit, not advisory.

The agreement does **not** lower the severity (still Medium — silent gameplay
throttle change), but it does make the mitigation a **specified task rewrite**
rather than a "review carefully" note.

### React to: does anyone's order-of-operations make the determinism registry-dump diff (task 6.5) a hard merge-blocker?

Yes — and stronger than I framed it alone. Four personas converge on 6.5 as a
**non-negotiable merge gate**, not a post-hoc check:

- Auditor (`:101, :166`) — "do not merge C1 without it green... C1 is the only
  item that can corrupt existing saves — keep it last and gate it hard."
- Pragmatist (`:135-141`) — isolates C1-b into **Slice 3**, explicitly so a
  determinism regression "can't taint the safe wins already shipped," with the
  byte-identical diff as the ship-blocker.
- Architect (`:48-51, :145-154, :278`) — raises the gate's **strength**: 6.5 as
  written tests one chunk in isolation, but `spawnAmbientCrowd` reads
  `registry.byChunk(ctx.key)` (global registry state), so single-chunk
  byte-identity is *necessary but not sufficient* — the gate must diff a chunk
  built **with neighbors also mid-deferral**.
- Profiler (`:176-179`) — confirms the diff is "much harder to prove for C1-a,"
  reinforcing C1-b as the shape that makes the gate tractable.

So the order-of-operations **is** adequately a hard blocker — Pragmatist's
Slice-3 isolation is the cleanest mechanism (C1-b ships alone, after the diff
passes, so a regression is quarantined). **I adopt one amplification from
Architect that no sequencing yet captures:** the 6.5 diff as currently scoped
(one fixed seed, presumably one chunk) is **insufficient** because the deferred
queue is global while `registry.byChunk` is key-scoped. The gate must capture a
registry dump across a **multi-chunk load neighborhood with deferrals
interleaving**, diffed against the synchronous baseline — otherwise it passes
single-chunk and a cross-chunk interleaving still shifts a draw. This upgrades my
Round-1 C1 gate from "byte-identical registry-dump diff" to "byte-identical
across a multi-chunk concurrent-deferral dump." That is the one place the
collective order-of-operations is still a half-step short.

Architect's adjacent point (`:110-129`) — the spec contradiction "no collidable
footprint until complete" vs "structure synchronous, scatter deferred," resolved
by defining the phase boundary as **collider-registering = synchronous** — is a
correctness constraint I did not raise and fully concede. It directly hardens my
own "half-built chunk with live crowd" vuln: if the deferred phase is *defined*
to contain zero colliders, the "drive into a footprint that isn't there yet"
window closes by construction. I adopt it.

### Revised Verdict

- **Verdict**: **Proceed with mitigations** (unchanged).
- **What moved me**:
  - **F2 softened from BLOCK to Proceed/scope-capped.** Profiler's
    "flip `autoUpdate=false` after first good map" fully closes the empty-map
    trap, and the movement-keyed `needsUpdate` bounds the smear. But the smear is
    **not** eliminated during continuous driving — at boost the movement predicate
    fires nearly every frame, so F2's real win is **mid/high, near-stationary
    only**. F2 ships only if the design records that scope cap; sold as
    "smoother driving shadows" it reverts to BLOCK.
  - **D3 mitigation hardened, not changed.** Auditor's independent confirmation
    promotes "preserve the snapshot-vs-live split" from a review note to a
    specified task rewrite + an explicit `.count`-stays-frame-start assertion in
    2.3.
  - **C1 gate strengthened.** The collective Slice-3 isolation makes 6.5 a hard
    merge-blocker (good), but Architect's registry-coupling point means the diff
    must span a **multi-chunk concurrent-deferral** neighborhood, not one isolated
    chunk. Plus the collider-registering=synchronous phase boundary closes my
    half-built-chunk window by construction. Both adopted.
  - **Unmoved**: C1-b over C1-a (now unanimous); A1 stays gated behind
    `compileAsync`-after-`Sound.init()` + threeShim-keyed warm meshes; B0 first.
