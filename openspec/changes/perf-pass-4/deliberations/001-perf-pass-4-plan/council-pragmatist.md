## The Pragmatist's Position

### Critical Path

The single hard dependency in this plan is **B0 → everything measurement-gated**.
Right now `renderer.info.render.calls` reads `1` under the EffectComposer chain
(`design.md:5-8`), which means every draw-call/overdraw judgment is blind. B0 is
the force multiplier: until it ships, you cannot honestly decide which Tier-2
items are worth building, you cannot confirm F1/F2 actually moved a number, and
you cannot verify A1/A4 killed the program-link wall (the `progDelta` signal is a
B0 deliverable). **B0 unblocks the verification surface for the entire rest of the
change.** It must be first, full stop.

The second hard reality is from the briefing (line 38): **live perf/visual
verification only runs on Gary's real-GPU local machine — Codespaces has no
WebGL.** That inverts the normal "ship it, measure it" cadence. The agent can
write the code and prove *correctness* (boot-clean, determinism diff, no console
errors) but cannot prove *the number moved*. So the sequencing must front-load the
items whose value the agent CAN self-verify, and clearly flag the items that
require a Gary-side capture round-trip — because each of those is a stall in the
delivery pipeline, not a free continuation.

The third dependency: **A1 depends on A4, not the reverse.** Per `design.md:75-81`,
A4 (sliced reveal) is the *correctness guarantee* — it catches any program A1's
prewarm missed. A1 (prewarm) is a best-effort *reduction* of what A4 has to slice.
So A4 ships first and stands alone; A1 is an optimization layered on top. The
tasks.md ordering (5.1 A4 then 5.2 A1) is correct.

### Priority Sequence

1. **B0 (measurement).** The whole change's verification surface. Self-verifiable
   by the agent: open the backtick HUD, confirm `draws` reads tens-to-hundreds
   not `1`. No real-GPU dependency for the *correctness* of the readout (the
   number being plausible is checkable; whether it's "good" is a later judgment).
   The InfoCapturePass is a no-draw pass-through — low blast radius. **Ship now.**

2. **D3 (crowd allocation pooling).** Smallest, safest, highest-confidence item
   in the plan. The fix is hoisting one literal — `activePassengersRef: { count,
   add: () => activePassengers++ }` at `crowd.js:605` — out of the per-NPC loop.
   Verifiable by booting the game and confirming crowd behavior unchanged
   (passenger pickup works, no console errors) — that's agent-checkable without a
   real GPU. **One caveat (see Risks): the `add` closure mutates a loop-local;
   that's not a trivial hoist.** Still small. **Ship now, in the same slice as B0.**

3. **F2 (amortized shadow map).** Cheap, single-owner (only the sun casts —
   `proposal.md:96-97`), runtime-only. The empty-map trap is well-understood and
   the mitigation (`autoUpdate=false` + periodic `needsUpdate`, never skip-render)
   is sound. Correctness is agent-verifiable (shadows present, not blank, across a
   ToD cycle via screenshots at Noon + Midnight). **The FPS win needs Gary**, but
   the *safety* doesn't. **Ship now.**

4. **A4 (sliced reveal).** The correctness half of the shader-stall fix, and it
   stands alone. Agent can verify the reveal mechanism (meshes start `visible=false`,
   flip ≤1/frame) and boot-clean behavior. The proof that it killed the 137–343ms
   wall requires Gary's capture (`tasks.md:5.3` already names him the verification
   owner). **Ship now (code), gate the "it worked" claim on Gary.**

5. **A1 (prewarm).** Layer on top of A4. Sits in the iOS-audio tripwire zone, so
   it needs care, but it's additive — if prewarm warms nothing, A4 still catches
   everything. **Ship now, but A4 must land first so A1 is never load-bearing.**

6. **C1-b (phased deferral chunk-gen).** See my position below — recommend C1-b,
   reject C1-a. This is the most invasive correctness-critical item (determinism
   gate is mandatory). It is agent-verifiable for *correctness* (registry diff
   must be byte-identical), but the *hitch-flattening* needs Gary. **Ship as its
   own slice, after the determinism gate passes, gated behind that gate.**

7. **F1 (dynamic bloom gating).** Real value but value is **entirely
   measurement-dependent** — the win is "skip a full-screen pass when nothing's
   bright." Whether that's worth the triple-writer coordination complexity
   (`design.md:91-96`) depends on B0 showing bloom's per-frame cost is material.
   **Gate behind B0 numbers from Gary.** Do NOT ship the coordination refactor
   speculatively.

8. **E1 (arrival curtain).** This is a *cosmetic mask for residual stall*, not a
   fix. Its entire justification is "if A1/A4 leave a leftover stall, dress it up."
   That's only knowable AFTER A1/A4 ship and Gary captures whether a residual
   stall remains. Building E1 before knowing there's a stall to mask is building a
   solution for a problem that may not exist (`design.md` itself frames it as
   hosting "any residual compile cost"). **Park until A1/A4 results are in.**

9. **Tier-2 (everything in perceptual-lod).** Explicitly measurement-gated by the
   spec's own header. **Park on ROADMAP. Pull individual items back only when B0 +
   a Gary capture name a specific cost worth the work.**

### Deferred / Park on ROADMAP

- **E1 (arrival curtain):** Nothing downstream is blocked by deferring it. It's a
  mask for a stall that A1/A4 are supposed to eliminate. If A1/A4 succeed, E1 may
  be unnecessary; if they partially fail, E1's *requirements* (which residual,
  how big) are defined by that failure. Building it first is speculative. It's
  also the one item with player-facing *charm* requirements (audio swell,
  warm-grade, "reads as cinematic") that need Gary's taste call — so it's doubly
  Gary-gated. Park until A1/A4 land and a residual is measured.

- **F1 (dynamic bloom gating):** Park the *decision*, not necessarily the work.
  The triple-writer coordination (boot + AdaptiveQuality + new per-frame gate, all
  fighting over `bloomPass.enabled`) is genuine complexity in a touchy subsystem.
  Don't pay that complexity tax until B0 proves bloom's full-screen multi-tap cost
  is a real line item on the target tier. What's NOT blocked: F2 is the
  independent, lower-risk GPU win; ship that and let F1 wait for evidence.

- **All Tier-2 / perceptual-lod (geometry merge, crowd LOD, fog-cull, atmosphere
  fakes):** The spec already gates these on B0 numbers (`perceptual-lod/spec.md:5`).
  Parking them blocks nothing — they're additive cost reductions, each
  independently shippable later. Crowd LOD in particular is a behavior-changing
  refactor (round-robin update + offscreen freeze + extrapolation) that risks the
  near-crowd feel; it deserves its own change once a number justifies it, not a
  rushed tail-end task on this one.

### Incremental Delivery Plan

This change is **too big to ship as one landing**, but it cleaves cleanly into
three slices, each independently shippable and each booting the game clean.

- **Slice 1 — "Measure + cheap safe wins" (ship first):**
  B0 + D3 + F2. All three are low-blast-radius, single-owner, and the agent can
  self-verify *correctness* without a real GPU (boot-clean, behavior-unchanged,
  shadows-not-blank). B0 lights up the HUD so Gary's first capture round produces
  the numbers that gate everything downstream. This slice ships value (smoother
  crowd GC, cheaper shadows) AND unblocks the rest. CHANGELOG entry covers it.
  **Verify:** backtick HUD shows real `draws`; boot game, drive, check
  `preview_console_logs` clean; Noon+Midnight screenshots for shadows.

- **Slice 2 — "Kill the shader wall" (ship after Slice 1):**
  A4 then A1. Depends on B0's `progDelta` from Slice 1 to *confirm* the wall is
  gone (Gary-side). A4 is the standalone correctness guarantee; A1 layers prewarm
  on top in the iOS-audio-sensitive boot path. Hard gate: A1's `compileAsync` must
  be kicked AFTER `Sound.init()` with no async hop before it (`design.md:125-128`,
  CLAUDE.md tripwire #3). **Verify:** agent confirms reveal mechanism + boot-clean
  + iOS gesture chain intact; Gary captures hub-entry frames to confirm ≤1
  program/frame and the 137–343ms stall is gone. E1's go/no-go is decided HERE,
  from whether a residual stall survives.

- **Slice 3 — "Flatten the chunk hitch" (ship after determinism gate):**
  C1-b alone. The determinism registry-diff gate (`tasks.md:6.5`) is the
  ship-blocker — byte-identical or it does not merge. Keep this isolated from
  Slices 1–2 so a determinism regression can't taint the safe wins already
  shipped. **Verify:** `__dbg.dumpRegistry` diff byte-identical old-vs-new path
  (agent-checkable, no GPU needed); then Gary confirms `cgWorst`/`fMax` hitches
  flatten and no collider appears before its chunk is coherent.

- **Deferred (own future changes, evidence-gated):** F1, E1, all Tier-2.

### Effort Reality Check

- **C1 is the effort sink, and C1-a would be a trap.** The proposal frames C1 as
  one item, but C1-a (full generator coroutine) is a different order of magnitude
  from C1-b. Per `design.md:54-56`, C1-a makes "every inline `registry.add` a
  resumable step" — there are **~15+ `registry.add` call sites** in chunks.js
  alone (grep: lines 533, 759, 996, 1065, 1398, 1430, 1489, 1508, 1554, 1572,
  1622, 1701, +more), threaded through `buildWorldgenKind` dispatch and multiple
  scatter functions. Turning that into a yield-driven coroutine while preserving
  exact `rng()` order is a high-risk rewrite of the longest call chain in the
  codebase. The estimate that hides here is enormous.

- **C1-b is genuinely low blast-radius — confirmed by reading the code.**
  `_generateWorldgen` (`chunks.js:477-501`) is *already phased*: one structural
  call (`placeWorldgenRoads`) then six scatter calls (`placeWorldgenProps`,
  `scatterWorldgenTrees`, `spawnAmbientCrowd`, `scatterBubbleJugs`,
  `scatterWorldgenCampsites`, `placeSeamHedges`). C1-b's "build structure sync,
  defer scatter to a per-chunk queue" maps onto these existing seams almost
  directly — you queue closures at function granularity, not statement
  granularity. The `rng()` order is trivially preserved because each deferred
  closure runs the same call in the same sequence, just later. **This is the
  difference between a week and a day.** The code already did the hard part of
  drawing the phase boundaries.

- **D3 is not as trivial as "hoist a literal."** The `add` field is a closure that
  increments a loop-local (`activePassengers++` via `add: () => activePassengers++`).
  Hoisting the object to module scratch means the closure must mutate a *shared
  counter object* reset per crowd frame, not a stack variable — `design.md:98-99`
  notes this ("pass `count` by a shared counter object"). Small, but it's a
  semantics change, not a copy-paste. Worth a careful read so the active-passenger
  count doesn't silently break passenger pickup.

- **F1's cost is coordination, not the gate itself.** The `brightInFrame()`
  predicate is cheap (reuse the attractor query). The effort is making three
  writers agree on `bloomPass.enabled` without regression — and that's a
  subsystem-touching refactor whose payoff is unmeasured. Underestimating this as
  "just add a per-frame check" ignores the AdaptiveQuality coordination surface.

- **The agent-can't-verify-live reality stretches every measurement-gated item by
  a Gary round-trip.** A1/A4-worked, C1-flattened-the-hitch, F1-is-worth-it,
  every Tier-2 go/no-go — none can close in a single agent session. The honest
  plan sequences so each Gary capture answers the *maximum* number of open gates
  at once: Slice 1's capture should produce the B0 numbers that decide F1 + every
  Tier-2 item simultaneously, not one at a time.

### Verdict

- **Verdict**: Proceed with mitigations.
- **Key Concern**: Scope. This is three changes wearing one change's clothes
  (measure+safe-wins / shader-wall / chunk-slice), plus a speculative tail
  (E1, F1, Tier-2) that should not be built before B0 + a Gary capture justify
  them. Shipping it as one big-bang landing risks a determinism regression in C1
  tainting the safe, high-confidence wins (B0/D3/F2) that could ship today.
- **Recommendation**: Split into the three slices above; ship Slice 1 (B0+D3+F2)
  immediately as the force multiplier that unblocks measurement. Adopt **C1-b over
  C1-a** — the code confirms `_generateWorldgen` is already phased, so phased
  deferral is low-risk and determinism-trivial while the full coroutine is a
  high-risk rewrite of the codebase's longest, most determinism-delicate call
  chain. Gate F1, E1, and all Tier-2 behind B0 numbers from Gary's real-GPU
  capture; do not build them speculatively. The agent-can't-verify-live constraint
  is the reason to front-load the self-verifiable safe wins and treat every
  Gary capture as a batched decision point.

## Round 2 — Reactions

-   **Re: Adversary — "F2's amortized shadow map is built on a false premise — the shadow frustum is player-anchored and re-centered every frame (`world.js:139-141`), so `autoUpdate = false` smears shadows during movement" (council-adversary.md, Verdict + F2 vulnerability, Severity High; BLOCK)**: **Conceded, and it re-cuts my Slice 1.** I verified the code: `world.js:135-142` re-sets `sun.position.x/z += playerPos.x/z` and `sun.target.position` to the player **every frame** — the comment at `:130-134` is explicit that the frustum "stays on top of where the action is." That is exactly the case where `autoUpdate = false` breaks: the depth map isn't re-rendered, but receivers still sample it through the light's *moved* view-projection, so shadows offset/drift under motion. My Round-1 Slice 1 (B0 + D3 + F2) put F2 in the "cheap safe win" bucket on the strength of the design's "sun crawls slowly, casters are static" claim. That claim is false during a boost. F2 is NOT a cheap safe win — it needs the movement-tracking work (force `needsUpdate` when the player crosses a threshold) before it is safe, and the Profiler independently flags the same 60–100m frustum traversed in ~2–3.5s at boost (council-profiler.md, F2 table row). **F2 comes out of Slice 1.**

-   **Re: Architect — "Land the AdaptiveQuality flag-setter refactor (task 4.1) as its own step and verify parity *before* adding `brightInFrame()` gating (task 4.2). Don't ship the new behavior on top of an un-refactored ownership model." (council-architect.md, Priority Sequence #4)**: **Agree, and it sharpens my F1 stance — but does not move it off the gate.** I verified there are exactly two direct writers today: boot (`main.js:147`) and AQ (`adaptiveQuality.js:171`); F1's per-frame predicate would be a third, and the Profiler adds E1's swell as a latent fourth (council-profiler.md, Key Concern). So the Architect is right that the refactor is load-bearing and must precede the feature. But this *reinforces* my Round-1 "gate F1 behind a capture" rather than overturning it: the refactor (4.1) is now an additional cost stacked *in front of* a win whose magnitude is still unmeasured. The correct read is two-stage: **the 4.1 flag-setter refactor is a pure-correctness change the agent can self-verify (bloom parity at all tiers, no GPU number needed) and is worth landing whenever F1 is touched; the 4.2 `brightInFrame()` gating — the part that actually skips a pass — stays gated behind B0 proving bloom's per-frame cost is material.** I am NOT convinced to build 4.2 speculatively. If anything the Architect's "refactor first" makes F1 *more* expensive to ship, which strengthens "don't pay for it until a number justifies it."

-   **Re: Adversary / Auditor / Profiler — all three independently make the C1 byte-identical registry-dump diff a hard merge-blocker (council-adversary.md C1 "Critical if ungated"; council-auditor.md "do not merge C1 without it green"; council-profiler.md C1-b position)**: **Agree without reservation — this was already my Slice 3 gate; the three-way convergence makes it non-negotiable, and the Architect adds a constraint I missed.** The Architect's point (council-architect.md, C1 caveat + Risk "rng coupling") that `spawnAmbientCrowd` reads `registry.byChunk(ctx.key)` (chunks.js:2950) before drawing `ctx.rng()` means the determinism gate must diff a chunk built *with neighbors also mid-deferral*, not one chunk in isolation — single-chunk byte-identity is necessary but not sufficient. The Adversary's mitigating fact narrows the blast radius usefully: each chunk has its own per-chunk-seeded `ctx.rng`, so there is no *cross-chunk* stream contamination (council-adversary.md, C1 vulnerability) — the risk is purely *intra*-chunk (carry the live `ctx.rng` instance, don't re-create it) plus the *registry-read* coupling the Architect names. Both fold into one gate design, below.

-   **Re: Auditor / Adversary — D3 carries a two-channel semantic, not a trivial hoist (council-auditor.md Key Concern, Severity High; council-adversary.md D3 vulnerability, Severity Medium)**: **Agree, and it confirms my Round-1 caveat with precise line evidence I under-specified.** The Auditor pins it exactly: `count` is a frame-start snapshot read by value at the boarding gate (`crowd.js:779` `.count < MAX_PASSENGERS`), while `add()` mutates a *separate* live accumulator (`crowd.js:788`). A naive single-scratch hoist that did `scratch.count++` would let the gate see live increments mid-frame and change the boarding throttle. My Round-1 flagged "it's a semantics change, not a copy-paste" but didn't name the failure mode; the Auditor's required assertion — `.count` must remain the frame-start value — is the right acceptance criterion. D3 stays in Slice 1 (it's still contained, no GPU, no determinism), but task 2.3's "passenger pickup still works" is too coarse; it needs the explicit snapshot-vs-live assertion.

### Re-cut Slice 1 (the minimal, correct version)

With F2 pulled, Slice 1 = **B0 + D3** only. Both are agent-self-verifiable for *correctness* without a real GPU (B0: HUD reads realistic tens-to-hundreds, not `1`; D3: boot-clean + the snapshot-vs-live `.count` assertion + passenger pickup unchanged), and both boot the game clean. B0 still lights up the HUD so Gary's first capture produces the numbers that gate everything downstream — that force-multiplier property is unchanged. D3 is the safe GC-churn bank. F2 moves into Slice 2 *behind* its movement-tracking fix, alongside the other items that genuinely need a Gary capture, because F2's whole value (and now its safety) can only be confirmed under motion on a real GPU — exactly the unhappy path no sandbox screenshot catches (council-adversary.md "Sandbox-pass ≠ game-pass for C1/F2").

### Minimal Gary round-trip sequence (capture batching)

Three personas want live verification but it's Gary-only and Codespaces has no WebGL, so each round-trip is a pipeline stall. Batch them so Gary captures the *maximum* open gates per trip:

-   **Round-trip 1 — after Slice 1 (B0 + D3) merges.** Gary boots `?perf=low/mid/high`, opens the backtick HUD, and captures one number set per tier (draws/tris/programs + the `progDelta` B0 now exposes). **This single capture answers, simultaneously:** (a) is B0 reading realistic scene draws; (b) is bloom's per-frame cost material enough to justify F1's 4.2 gating; (c) which Tier-2 items name a real cost (geometry-merge draw win vs. crowd-LOD unproven — the Profiler's split, council-profiler.md "Which Tier-2 items move a HUD number"); (d) is the 17–25ms steady-state avg GPU/fill or JS (council-profiler.md "stay honest" note). One trip, four gates resolved. The agent should hand Gary an exact capture script (URLs + which HUD fields to screenshot) so it's a 5-minute pass, not a hunt.

-   **Round-trip 2 — after Slice 2 (A4 → A1, then F2-with-movement-fix) merges.** Gary drives a **boost run across ≥2 hubs** (not a stationary screenshot — council-adversary.md, council-profiler.md both insist) watching: shadows tracking under the cart (F2 movement fix), ≤1 program/frame at hub entry, the 137–343ms wall gone (A1/A4), and AQ-shadow-transition flicker (the Architect's F2/AQ co-ownership risk, council-architect.md). **This trip also decides E1's go/no-go** — does a residual stall survive A1/A4 worth a curtain? One trip resolves F2-safety + A4/A1-worked + E1-needed.

-   **Round-trip 3 — after Slice 3 (C1-b) passes the determinism gate.** The byte-identical registry-dump diff is **agent-checkable with no GPU** (`__dbg.dumpRegistry` old-path vs new-path, including the multi-chunk-mid-deferral case the Architect requires) — so the agent closes the merge-blocker *before* Gary touches it. Gary's trip is then only the perceptual confirmation: boost across hubs, watch `cgWorst`/`fMax` hitches flatten and confirm no collider appears before its chunk is coherent. One trip, and it's the cheapest because the hard gate already passed locally.

Net: three Gary round-trips for the whole change, each batched to close the most gates. F1's 4.2 decision and every Tier-2 go/no-go ride on Round-trip 1's numbers — they do not each need their own trip.

### Revised Verdict

-   **New Verdict**: Proceed with mitigations (unchanged stance, re-cut slices). The Adversary's verified `world.js:139-141` finding **moved me to pull F2 out of Slice 1** — my Round-1 had it as a cheap safe win on a premise the code falsifies. Minimal Slice 1 is now **B0 + D3**; F2 joins Slice 2 behind its player-anchored-frustum movement fix and an explicit F2/AQ single-owner shadow-cadence contract (the Architect's mitigation #3). F1's 4.1 ownership refactor is a self-verifiable correctness prerequisite worth landing with any F1 work, but 4.2 gating stays behind B0's Round-trip-1 numbers. C1-b's determinism gate is a hard merge-blocker — three-way concurrence plus the Architect's multi-chunk-deferral requirement — and is agent-closable before Gary's trip. The three-round-trip batching above is the delivery-cost-minimal path given the Gary-only live-verification constraint.
