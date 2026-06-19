# Deliberation Briefing: perf-pass-4 — steady-state + stall reduction

## Task

Stress-test the implementation plan for `perf-pass-4` before coding begins. The
plan attacks two measured performance symptoms from a 2026-06-19 instrumented
capture and a measurement gap. Read these plan artifacts in full before forming a
position:

- `openspec/changes/perf-pass-4/proposal.md` — the why + the ordered item list
- `openspec/changes/perf-pass-4/design.md` — the technical how + risk analysis
- `openspec/changes/perf-pass-4/tasks.md` — the implementation checklist
- `openspec/changes/perf-pass-4/specs/{frame-budget,perceptual-lod,render-pipeline}/spec.md`
- Background idea bank + critic ranking: `.claude/perf-brainstorm.md`

The plan items (short codes):
- **B0** — true draw/tri measurement under post-processing (info-capture pass after RenderPass).
- **C1** — time-slice chunk `_generate` under a per-frame ms budget. Design proposes two shapes: **C1-a full generator coroutine** vs **C1-b phased deferral** (build structure synchronously, defer heavy scatter to a per-chunk queue). The design recommends C1-b.
- **A1 + A4** — shader prewarm (`renderer.compileAsync` at the title tap, after `Sound.init()`) + sliced reveal (≤1 new GL program linked per frame).
- **F2** — amortized shadow map (`shadowMap.autoUpdate = false` + periodic `needsUpdate`, reusing the last good map).
- **F1** — dynamic bloom gating (a single resolved predicate coordinating tier + AdaptiveQuality + brightness-in-frame).
- **D3** — pool per-frame crowd allocations (the `activePassengersRef` closure, crowd.js:605).
- **E1** — "arriving at the festival" bloom curtain to host residual compile cost.
- **Tier-2 (measurement-gated)** — geometry merge at chunk completion, crowd LOD + offscreen freeze, fog-as-far-cull, billboard light shafts / faked lake reflections / adaptive sparkle.

Already shipped (do NOT re-propose): the `checkShaderErrors` sync-stall fix
(main.js:127), the spatial-grid broadphase grind fix, the oversized-footprint
partition.

## Context

- **OpenSpec Change:** `openspec/changes/perf-pass-4/`
- **Background:** `.claude/perf-brainstorm.md` (idea bank + critic tiers),
  `.claude/rules/performance.md`, `.claude/rules/perf-pooling.md`.
- **Subsystem(s):** render-pipeline, world-streaming, crowd-ai, lighting-and-time-of-day, perf-tiers, sandbox-harness.
- **Files affected:** `src/main.js` (composer/passes ~139-167, render ~1131, boot/title-tap ~540, shadow ~110), `src/chunks.js` (`update`/`_generate` ~304-401, BUDGET_PER_FRAME ~319), `src/crowd.js` (~605), `src/debug.js` (info readout ~1029 + ~1609), `src/world.js` (sun shadow ~349-357), `src/adaptiveQuality.js` (bloom/shadow ownership ~167-178), possibly `src/perf.js`, `src/lakes.js`, `src/forests.js`.
- **ARCHITECTURE.md sections relevant:** render pipeline, world chunks/forests/lakes, registry/collision, crowd AI, perf tiers.
- **Measured facts:** 137–343ms single-frame stalls correlate exactly with three.js `prog` count jumping (new-program GL compile/link on hub entry); 30–60ms chunk-gen hitches (cgSlow 21→49, cgWorst ~289ms); `renderer.info` reads `draws=1` under the EffectComposer chain; steady-state CPU broadphase already fixed (~0.3ms). Live perf/visual verification can only run on the human's real-GPU local machine — Codespaces has no WebGL.

## Constraints (the tripwires — non-negotiable)

- No build step; a new src/ module goes in the importmap in BOTH index.html AND sandbox.html (this plan expects NO new modules — verify with `bin/check-importmaps` if that changes).
- ES module namespaces are frozen — no THREE.X = Y after import; tier overrides via src/threeShim.js. Prewarmed materials (A1) must be built through the real threeShim-backed factories or the warmed program won't match the real draw.
- iOS audio inits synchronously inside the start gesture — no async hop before Sound.init(). A1's compileAsync must be kicked AFTER Sound.init() and must not block the boot.
- Determinism is load-bearing — don't reorder/re-salt existing rng() calls. C1 must produce a byte-identical world (same rng() draw order) or it regenerates existing chunks differently mid-game.
- Lakes omit chunkKey on purpose; shared pooled resources tagged userData.shared = true must not be disposed. C1's half-built/cancelled chunks and Tier-2 geometry merge must honor this.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M; don't reflexively castShadow = true. AdaptiveQuality already disables shadows via a castShadow-walk (NOT shadowMap.enabled) because disabling the render leaves an EMPTY shadow map (adaptiveQuality.js:198-205) — F2 must avoid reintroducing that bug.
- A new model is not done until it has a sandbox entry (importmap x2 + dropdown + loadEntity + hit kind + music style).
- Sandbox-pass ≠ game-pass — the running game must boot clean (buildWorld → ChunkManager.update → _generate → theme builder is the longest call chain and where boot bugs hide).

### Your Output

Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (Round 1)

1. Propose your prioritized order of operations for this plan (what ships first, what to gate, what to cut or park).
2. Identify the risks/concerns from YOUR domain, grounded in the docs/code. Where you have a position on C1-a (full coroutine) vs C1-b (phased deferral), state it and why.
3. Give a Verdict (Proceed | Proceed with mitigations | Block).

You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that's handled later.
