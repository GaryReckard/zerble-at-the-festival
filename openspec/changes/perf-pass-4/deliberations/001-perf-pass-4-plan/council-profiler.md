## Profiler's Position

I evaluate this plan against the per-tier draw/tri budgets (low 80/150k, mid
200/400k, high 400/1.2M), the shadow-priority perf doctrine, post-process gating,
instancing/pooling, AA/pixel-ratio, and — most importantly here — the
allocation-vs-steady-state model from `.claude/rules/performance.md`. The two
measured symptoms map cleanly onto that model: the 137–343ms hub stalls are
**allocation/first-render cost** (GL program link), and the 30–60ms chunk hitches
are **allocation cost** (synchronous `_generate`). Neither is steady-state FPS.
That framing drives my sequencing.

### Priority Sequence (impact ÷ effort, by cost type)

1. **B0 — info-capture pass (measurement first).** Rule #1 of `performance.md`:
   "you can't tune what you can't see." With `renderer.info.render` reading `1`
   under the composer (`debug.js:1029`, `:1609`), every draw/tri/overdraw decision
   in this plan — and every Tier-2 gate — is blind. Cheapest item, unblocks all
   others. Ships first, non-negotiable.

2. **C1-b — phased deferral of `_generate` (allocation stall, symptom B).** The
   most direct, determinism-safe fix for the 30–60ms hitches (`cgWorst` ~289ms,
   `cgSlow` 21→49). Main-thread, no worker/no-build risk. See my C1 position below.

3. **A1 + A4 — prewarm + sliced reveal (allocation stall, symptom A).** The
   principled fix for the worst-felt symptom. A4 is the load-bearing half — it
   *guarantees* ≤1 link/frame even for variants A1 misses; A1 is best-effort
   front-loading into dead title-screen time. Ship them together.

4. **F2 — amortized shadow map (steady-state, mid/high only).** Highest per-frame
   multiplier per the shadow-priority rule. **But note the tier asymmetry below:
   low tier has shadows OFF (`perf.js:57`), so F2 buys nothing on the squeeze tier.**

5. **F1 — dynamic bloom gating (steady-state, all tiers).** Bloom is ON at all
   three tiers (`perf.js:53/73/88`), so unlike F2 this helps low/mid too. A
   full-screen multi-tap pass skipped on bright-free daytime frames is real
   savings. Cheap; the gating pattern (Trip pass `enabled=false`) already exists.

6. **D3 — pool the crowd closure (GC churn, pure win).** `activePassengersRef: {
   count, add: () => activePassengers++ }` allocated per-NPC per-frame at
   `crowd.js:605` — a closure *and* an object literal, ~330×/frame. Zero behavior
   change, no downside. Cheap cleanup; ship whenever convenient.

7. **E1 — arrival curtain (perceptual mask).** Ships *after* A1/A4, not instead of
   them. It hosts residual compile cost; it is not a fix. Gate its own bloom-swell
   cost through the F1 predicate so the mask doesn't itself blow the bloom budget.

8. **Tier-2 — measurement-gated, mostly park.** Do NOT ship until B0's numbers
   justify each item on the tier in question. My read on which will move a HUD
   number is below.

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| ---- | ---- | -------- | ----------------- |
| B0 capture-pass placement reads bloom's own internal passes, not just scene | Draws | Medium | If capture pass lands at the wrong composer index, or autoReset interaction is misread → HUD shows scene+bloom-downsample draws, still wrong |
| F2 amortized shadow buys nothing on low (shadows off there) | Shadow/SteadyState | Low | Effort spent expecting a low-tier win; low never had shadow cost to amortize |
| F2 stale map smears as sun crawls / NPCs move under it | Shadow | Medium | `SHADOW_UPDATE_EVERY` too high; sun frustum is only 60–100m (`world.js:363`) so the player drives out from under a stale map fast |
| F1 + AdaptiveQuality + E1 triple-writer to `bloomPass.enabled` fight | SteadyState | High | Three independent writers (`main.js:147`, `adaptiveQuality.js:171`, F1 per-frame, E1 swell) without one resolved predicate → bloom flickers or AQ's load-shed gets overridden |
| A4 sliced reveal makes decor pop in over ~1s | (perceptual) | Low | Acceptable while moving; risk only if a static chunk reveals in the player's stationary view |
| A1 prewarm warms the wrong program (not threeShim-built) | Alloc | Medium | Warmed material's program key ≠ real draw's key (fog/shadow/tier/vertexColors defines) → stall still fires, title-time wasted |
| C1-b deferred scatter leaves a chunk visually/physically half-built for several frames | Alloc/correctness | Medium | Structure registers colliders but trees/props/crowd trickle in; player can drive into "empty" space that fills a few frames later |
| Tier-2 geometry merge disposes a `userData.shared` resource | Alloc (recompile storm) | High | A merge that folds a pooled material/geo and then disposes it on unload → shader-recompile storm (the ~200ms periodic stalls `performance.md` warns of) |
| Tier-2 crowd LOD/SoA work targets an unproven cost | SteadyState | Medium | Capture does NOT prove crowd CPU is the FPS limiter; broadphase already ~0.3ms. Building D1/D2/D6 before a crowd self-time readout = optimize-before-measure |

**On B0 correctness (the briefing's specific question — "is B0 correctly
measuring scene draws?"):** Yes, *if* placed correctly. three.js resets
`info.render.calls` at the **start** of each `renderer.render()`/fullscreen pass
(autoReset default true). The composer runs RenderPass first, then bloom (which
internally does down/upsample renders), Trip, FXAA, OutputPass — each resets and
re-accumulates. The design's choice — a no-op `Pass` at **composer index 1**,
immediately after RenderPass, copying `info.render.calls/triangles` into
`lastSceneInfo` before the next pass overwrites it — captures exactly the scene
draw count. This is the right call, and it's correctly chosen over
`autoReset=false` (which would *sum* every fullscreen pass and over-count). One
watch-out: the capture pass must read **before** UnrealBloom's first internal
render resets the counter, and must itself issue **no draw** (pure read +
read-buffer passthrough), or it adds +1 to the very number it reports. The design
says "no draw of its own" — hold the implementation to that.

**On F2 (the briefing's question — "does amortized shadow actually win on the
tiers where shadows are on?"):** Partially. Shadows are on only on **mid and
high** (`perf.js:77/92`; low is off at `:57`). So F2 is a mid/high-only win — it
does nothing for the low tier, which is "the squeeze." The win on mid/high is
real (one shadow re-render is the highest per-frame multiplier), but two caveats:
(a) the sun shadow frustum is only 60m (mid) / 100m (high) wide (`world.js:363`),
and at boost ~28 m/s the player traverses that in ~2–3.5s — so a stale map that
isn't refreshed often enough will visibly lag the cart's own shadow. Tie
`needsUpdate` to camera/sun movement, not just a frame counter. (b) F2 is
orthogonal to AdaptiveQuality's `castShadow`-walk (`adaptiveQuality.js:210`) —
good, the design notes this — but the implementation must set
`shadowMap.autoUpdate=false` only **after the first real frame renders a good
map**, or the first N frames sample an empty map (the exact bug AQ's comment at
`:197-209` documents).

**On F1 vs AdaptiveQuality (the briefing's question — "does F1 bloom gating
conflict with AdaptiveQuality?"):** It *will* conflict unless the design's "single
resolved predicate" is actually enforced. Today there are two writers
(`main.js:147` boot, `adaptiveQuality.js:171` on level change). F1 adds a
per-frame third, and E1's swell is effectively a fourth. The correct shape (which
the design states) is: AQ sets a **flag** `bloomAllowed` instead of writing
`bloomPass.enabled`, and exactly one site computes
`bloomPass.enabled = PERF.bloom && aq.bloomAllowed && brightInFrame()`. This is a
hard requirement, not a nicety — if AQ has shed bloom under load and F1 re-enables
it because a fire came into frame, F1 has overridden the adaptive load-shed and
defeated its purpose. The spec's "AND of (tier) ∧ (AQ) ∧ (bright)" is correct;
enforce it as the *only* writer.

**On allocation-vs-steady-state attribution (the briefing's question):** The
plan's attribution is correct and disciplined. A (shader stalls) and B (chunk
hitches) are both allocation/first-render costs — fixed by slicing, prewarm,
deferral. F1/F2 are the only genuine steady-state items, and D3 is GC-churn
(allocation-adjacent). The plan correctly does **not** pretend crowd CPU is a
proven steady-state limiter — it gates D1/D2/SoA behind B0/measurement. That
matches the rule's warning: "pooling does almost nothing for steady-state FPS."
The one place to stay honest: the 17–25ms steady-state frame avg is **unattributed**
— it may well be GPU/fill (post-processing overdraw) rather than JS. B0 will tell
us. Don't let anyone read the steady-state number as "crowd CPU" before B0 ships.

**Which Tier-2 items will actually move a HUD number (the briefing's question):**
- **Static-decor geometry merge** — likely moves *draws* materially (the
  vendor-booth merge already showed −36% meshes per CHANGELOG). Highest-confidence
  Tier-2 draw win. Gate behind B0 confirming draws are hot; honor `userData.shared`
  disposal (this is the High-severity risk above).
- **Fog-as-far-cull** — moves draws/tris on open daytime frames by dropping far
  chunks from the frustum. Cheap; verify it doesn't fight `chunkUnloadRadius`.
- **Crowd LOD / offscreen freeze** — moves a *CPU* number, not a HUD draw number,
  and only if crowd CPU is proven hot. Gate hardest. Likely **does not** move the
  budget panel at all.
- **Billboard light shafts / faked lake reflections / adaptive sparkle** — these
  are charm-positive and cheap, but they *add* draws (billboards, sprites). They
  don't reduce a HUD number; they're mood, not perf. Only "adaptive sparkle" is a
  perf lever (it *sheds* count under load). Don't book these as perf wins.

### Budget Estimate

- **Draw delta**: B0 capture pass = +0 draws (no-op). F1 gating = **−bloom passes**
  on bright-free frames (a reduction). F2 = no draw delta, removes a shadow
  re-render on most frames (mid/high). E1 curtain = +0 sustained (uses existing
  bloom). Net of the shipped slice: **neutral-to-negative draw delta** — this plan
  removes per-frame work, doesn't add geometry. Tier-2 merge would push draws
  *down* further; Tier-2 atmosphere fakes would push draws *up* (book separately).
- **Triangle delta**: ~0 from the core slice. F2/F1 don't touch tri count. Tier-2
  geometry merge is tri-neutral (same tris, fewer draws); impostor far-field
  (if ever pursued) would cut tris.
- **Cost type**: This plan attacks **allocation stalls** (C1, A1/A4) and
  **steady-state FPS** (F1, F2), plus **GC churn** (D3). Correctly matched fixes
  to symptoms per the doctrine.
- **Low/mid-tier verdict**: **Safe.** The core slice removes work rather than
  adding it. Caveat: the squeeze tier (low) benefits from C1, A1/A4, F1, D3 but
  **not F2** (shadows already off). Verify the backtick panel at `?perf=low` and
  `?perf=mid` after every render-touching task (B0/F1/F2/E1) — high tier hides
  regressions. E1's bloom swell and any Tier-2 atmosphere fake are the only
  budget-*adding* items; gate both through F1's predicate and re-check low.

### C1-a vs C1-b — Position (perf grounds)

**I support C1-b (phased deferral).** On perf grounds specifically:

- Both shapes solve the symptom — they convert one 49ms frame into several
  ~8ms frames. The *perf delta* between them is small; the difference is blast
  radius and determinism safety, where C1-b clearly wins (every inline
  `registry.add` in C1-a becomes a resumable yield point — that's where a
  determinism regression or a half-registered collider hides).
- C1-b's **structure-first** ordering is the perf-correct call: it registers
  collidable footprints synchronously (the chunk is immediately *playable*), then
  trickles the *cheap-to-defer, expensive-to-build* scatter (trees, ambient props,
  crowd) under the ms budget. That matches the allocation-cost model — you defer
  the work that doesn't gate correctness.
- **One perf caveat on C1-b:** the deferred scatter is exactly the geometry that
  mints new GL programs, so C1-b's spawn cost and A4's reveal pump are pulling on
  the same rope. Make sure the C1-b scatter queue and the A4 reveal pump share one
  per-frame ms/program budget — otherwise a dense hub could defer 40 props (C1-b
  budget) *and* try to link them (A4 budget) and you've just moved the stall, not
  removed it. They must compose under a single frame budget.
- I'd reject **C1-a** not on perf (it smooths marginally better) but because its
  determinism surface — making every `rng()`-driven `registry.add` a coroutine
  resume point — is a high-risk way to buy a small marginal smoothing over C1-b.
  The `frame-budget` spec's "byte-identical" scenario is much harder to *prove*
  for C1-a.

### Verdict

- **Verdict**: **Proceed with mitigations.**
- **Key Concern**: The bloom-pass writer collision (F1 + AdaptiveQuality + E1).
  Without a single enforced resolved predicate (`PERF.bloom && aq.bloomAllowed &&
  brightInFrame()` as the *only* writer), F1 will override AdaptiveQuality's
  load-shed and the gating becomes a regression instead of a win.
- **Recommendation**: Ship **B0 first** (it's the gate for everything, including
  Tier-2). Then C1-b → A1/A4 (sharing one frame budget) → F2 (mid/high only,
  tie `needsUpdate` to sun/camera movement, flip `autoUpdate=false` only after the
  first good map) → F1 (single resolved predicate) → D3 → E1. Hold every Tier-2
  item behind B0's per-tier numbers — geometry merge and fog-cull are the likely
  draw wins; crowd LOD is unproven; the atmosphere fakes are mood, not perf, and
  *add* draws. Verify the backtick panel at `?perf=low` and `?perf=mid` after each
  render-touching task. No budget-busting risk in the core slice — it removes
  per-frame work rather than adding geometry.

## Round 2 — Reactions

- **Re: Adversary — "the shadow ortho frustum is pinned to the cart so shadows render no matter how far Zerble drives... the cached shadow map is positioned for an old player location, so shadows smear/offset/drift off their casters" (council-adversary.md, F2 vulnerability)**: **Conceded — the mechanism is real and I verified it.** `world.js:139-141` runs unconditionally every frame: `sun.position.x += playerPos.x`, `sun.position.z += playerPos.z`, `sun.target.position.set(playerPos.x, 0, playerPos.z)`. The directional light's shadow view-projection matrix therefore *moves with the cart continuously*, and the frustum is only `shadowD` 60m (mid) / 100m (high) per side (`world.js:363`). My R1 caveat already said "tie `needsUpdate` to camera/sun movement, not just a frame counter" — but having now seen the *continuous-recenter* mechanism, that mitigation **collapses**: to keep the depth map registered with a frustum that translates every frame, you'd have to force `needsUpdate` on essentially every motion frame. That means F2 amortizes **only while the player is ~stationary**, and buys *nothing* during boost driving — which is the exact moment the chunk-gen hitches (C1's target) fire and the frame budget is tightest. So F2's win and the worst-felt symptom don't overlap. My R1 ordering placed F2 at #4; that was too high given the win is confined to parked frames.

- **Re: Adversary — "AQ's `_setShadowsOn` ... sets `renderer.shadowMap.needsUpdate = true` (line 233) to flush. With `autoUpdate = false` globally, AQ's restore-shadows path now depends on F2's `needsUpdate` plumbing" (council-adversary.md, F2 AQ-coordination)**, reinforced by **Architect — "Once F2 sets `autoUpdate = false`, the 'next render repopulates' assumption on the AQ raise path breaks" (council-architect.md, F2 co-ownership)**: **Conceded and sharpened with a detail both under-state.** I read `adaptiveQuality.js:194-233`. AQ's stale-shadow defense is built *specifically because* `renderer.shadowMap.enabled = false` "stops the shadow map from being re-rendered... Result: frozen shadows frozen exactly where they last drew" (comment `:197-202`). AQ deliberately avoids the no-re-render path and instead walks `castShadow` off so the **next render writes a clean empty map** (`:203-208`, `:233`). F2's entire mechanism — `autoUpdate = false` — *is* the "stop re-rendering the map" state AQ was engineered to never enter. So F2 doesn't merely race AQ's one-shot `needsUpdate`; it reintroduces the exact frozen-shadow failure class AQ's design comment documents and rejects. This is stronger than my R1 framing (I called the AQ interaction "orthogonal — good, the design notes this"). It is **not** orthogonal. F2 must become the single owner of shadow cadence *and* re-implement AQ's empty-map flush through its own `needsUpdate`, or the two defeat each other.

- **Quantifying the win at stake if F2 is cut/constrained**: Small, and tier-confined. Shadows are on only mid/high (`perf.js`; low is off at `:57`). The saved work per skipped frame is **one depth-only re-render** of the resident shadow casters (the audited ~56) from the sun's POV into a single 512² (mid) / 1024² (high) map — not 56 separate main-view draws. It is the highest *per-frame multiplier* per the shadow doctrine, but the absolute cost is one extra depth pass, and it is **zero on the squeeze tier (low)**. Constrained to "amortize only while stationary," F2 reduces to: skip the depth re-render on parked frames at a hub. That is a genuine but narrow steady-state win (watching a stage, parked in camp) and contributes nothing to the boost-driving frames. **My revised verdict on F2: downgrade to "amortize-while-stationary only," gate it behind B0 proving the depth pass is a measurable mid/high line item, and treat it as the lowest-priority shipped item — not #4.** If B0 shows the shadow depth pass isn't material on mid/high, **cut F2 entirely**; the win doesn't justify owning shadow cadence and re-implementing AQ's flush. I do not call it a hard Block (it's salvageable as stationary-only), but the Adversary's "Block until the frustum-follow is handled" is the correct gate, and I align with it.

- **Re: my own R1 caveat — "the C1-b deferred scatter and A4's reveal pump must share ONE per-frame budget" — do others reinforce or complicate it?** **Reinforced, and the picture is now more constrained than I framed it.** Three reads converge on the same seam from different angles:
  - **Adversary (council-adversary.md, C1 half-built vulnerability)**: `spawnAmbientCrowd` injects into the *live* `this.crowd` system (`chunks.js:456/492`), so "crowd spawn must be the LAST deferred stage, or the deferred batch atomic per chunk." That *orders* the deferred queue — and crowd spawn is also program-minting work, so the A4 pump and the C1-b queue aren't just sharing a ms budget, they're contending for the **same final stage**.
  - **Architect (council-architect.md, C1 spec contradiction)**: the phase boundary must be *collider-registering = synchronous, decor/crowd = deferred*. That fixes *what* goes in the deferred queue, which is the population my shared-budget governs.
  - **Pragmatist (council-pragmatist.md, effort reality)**: confirms `_generateWorldgen` is *already phased at function granularity* (`chunks.js:477-501`) — so the deferred queue is a handful of closures, not statement-level yields. That makes a single shared frame budget *tractable* to implement (one queue, function-granular entries), which my R1 caveat needed but didn't establish.
  So my caveat holds and strengthens: there must be **one per-frame governor** that owns (a) C1-b's deferred-scatter closures, (b) A4's ≤1-program-link/frame reveal pump, and (c) E1's elevated pump rate during the curtain — because all three pull on the same rope (GL program links + ms budget) and a dense hub could otherwise defer 40 props *and* try to link them in the same frames, relocating the stall instead of removing it. This is now a concrete design constraint, not just a watch-out: the reveal pump and the chunk-defer queue are the **same budgeted resource**, ordered with crowd-spawn last.

- **Re: Auditor — "A1 warm-scene teardown must honor the `userData.shared` skip ... some may be module-scope `userData.shared` pooled materials (`SHACK_MATS` etc.). Disposing the warm scene must run the same `userData.shared` skip or A1 will dispose a shared material and storm recompiles" (council-auditor.md, deficiency 2)**: **Agree — and this is squarely my domain (the recompile-storm risk I flagged in R1's risk table).** I had A1's risk as "warms the wrong program (key mismatch)"; the Auditor surfaces the *inverse and worse* failure: A1 warming *through the real factories* (which it must, to match program keys) means it touches the actual pooled `userData.shared` materials — and a naive teardown then **disposes them**, triggering the periodic ~200ms recompile stalls `performance.md` warns of. That's a perf regression masquerading as a perf fix. A1's warm pass should prefer `renderer.compileAsync(scene, camera)` (which links programs without requiring the agent to dispose anything) over building+tearing-down throwaway meshes, precisely to avoid ever calling `dispose()` on a shared resource. Folding this in.

### Revised Verdict

- **New Verdict**: **Proceed with mitigations** (unchanged headline) — but with **F2 demoted and constrained**, moved by the Adversary's verified player-anchored-frustum mechanism (`world.js:139-141`) and the AQ stale-shadow-defense collision (`adaptiveQuality.js:197-233`).
  - **F2 reordering**: drop F2 from R1 position #4 to **lowest-priority shipped item**, scoped to **amortize-while-stationary only**, single-owner of shadow cadence (re-implementing AQ's empty-map flush through its own `needsUpdate`), and **B0-gated** — cut entirely if B0 shows the mid/high shadow depth pass isn't a measurable line item. The win at stake is narrow (one depth re-render on parked mid/high frames; zero on low; zero during boost), so it does not justify a hard Block but fully justifies the Adversary's gate.
  - **C1-b + A4 + E1 share ONE per-frame governor** (program-links + ms), with crowd-spawn ordered last per the Adversary — now a written design constraint, not a caveat.
  - **A1 prewarm via `compileAsync`, never dispose**, to dodge the shared-material recompile storm (Auditor).
  - Unchanged from R1: **B0 strictly first**; F1's single resolved bloom predicate (`PERF.bloom && aq.bloomAllowed && brightInFrame()`) as the only writer remains my Key Concern; C1-b over C1-a; verify the backtick panel at `?perf=low` and `?perf=mid` after every render-touching task.
