# Deliberation Briefing: Perf fix plan for the "page unresponsive" hang

## Task

Stress-test the **fix approach** (not re-derive the diagnosis) for the live
game becoming unresponsive during play. Decide: **sequencing** (what order),
**what ships now vs. parks on ROADMAP**, and specifically **whether
`renderer.debug.checkShaderErrors = false` is safe to ship to the live GitHub
Pages production deploy, or must stay dev-only.**

The diagnosis is settled and evidence-backed — read it first, don't re-litigate
it: **`.claude/perf-unresponsive-diagnosis.md`**. Then form your position on the
proposed fixes below.

## Context

- **ROADMAP item**: `## Bugs` → "Game goes unresponsive during play" (links the
  diagnosis doc).
- **Subsystem(s)**: render-pipeline, crowd-ai, registry-collision, perf-tiers.
- **Diagnosis source**: three Chrome DevTools traces + one 160 s foreground
  perf-log (captured via the new `__dbg.recordPerf()` recorder, commit
  `ed57cc6`). Numbers are reproduced in the diagnosis doc.
- **Key files**: `src/threeShim.js` (the `'three'` importmap entry + tier-aware
  `MeshStandardMaterial` override), `src/main.js` (renderer construction + boot),
  `src/perf.js` (tiers, `PERF.contextLights` default off), `src/spatialGrid.js`
  (`forEachNear`, line 48), `src/crowd.js` (line 1015 per-NPC separation),
  `src/registry.js` (lines 112/117 collision/`closestBuilding` queries),
  `src/adaptiveQuality.js`, `src/debug.js`.
- **Relevant docs**: `CLAUDE.md` (tripwires), `.claude/rules/performance.md`,
  `.claude/rules/perf-pooling.md`, `ARCHITECTURE.md` (render pipeline, crowd AI,
  perf tiers), `.claude/perf-pass-4-plan.md` (prior perf-pass style).

## The diagnosis (settled — for grounding only)

Two independent root causes, both confirmed across all captures:

1. **The freezes** = synchronous shader compile/link stalls. Every main-thread
   task >150 ms is ~88 % `getProgramInfoLog`/`getShaderInfoLog` (three.js
   sync-waiting on the GPU to finish linking each new program). `checkShaderErrors`
   defaults to `true`, which is what forces that sync call per link. AND a
   **program-COUNT leak**: `prog` (`renderer.info.programs.length`) climbs
   54→691 over 160 s, monotonic, never recovers, each jump landing on an fMax
   spike (314/245/207 ms). Geometry disposal is healthy (`geo` oscillates
   4027↔9638). `heapMB` 97→416 with a rising GC floor; `tex` 44→147. The leak is
   **not** the color-keyed material pools (`tent.js`, `puppet.js`,
   `foodTruck.js` — color is a uniform → shared program) nor crowd/wook tie-dye
   (constant `customProgramCacheKey`). The mint-source of unbounded distinct
   shader cache-keys is **not yet identified**.

2. **The grind** = `forEachNear` (`spatialGrid.js:48`), the #1 CPU cost
   (15–22 %) in all three sessions, growing with resident entity count
   (~3000–4100 colliders). Callers: `crowd.js:1015` (per-NPC separation, every
   NPC every frame), `registry.js:112/117` (per-frame collision/closestBuilding).
   Query radius is `reach + _maxFp`/`_maxCol` — one oversized footprint widens
   every query's scanned cell block.

## The proposed fixes (what you are evaluating)

**Root cause 1:**
- **1a.** Set `renderer.debug.checkShaderErrors = false` after boot, gated
  behind the existing debug flag (keep it `true` on `?debug`). Kills the
  per-link sync stall. Claimed: highest leverage, lowest risk.
- **1b.** Hunt the program-count leak separately — dump
  `renderer.info.programs[].cacheKey` periodically, diff to find what mints
  unbounded distinct cache-keys (suspected: a `#define`-level variation —
  `flatShading`/`vertexColors`/map-presence/light-count — or an
  `onBeforeCompile` whose key varies).
- **1c (optional).** Material pooling / fix any mis-disposed shared materials;
  and/or `renderer.compileAsync(scene, camera)` pre-warm at boot.

**Root cause 2:**
- **2a.** Throttle/stagger per-NPC separation across frames; cull off-screen/far
  NPCs from the separation scan.
- **2b.** Audit `_maxFp`/`_maxCol` query-radius inflation; bucket colliders by
  size or cap query reach.

## Constraints (the tripwires — non-negotiable)

- No build step; a new `src/` module goes in the importmap in BOTH `index.html`
  AND `sandbox.html` (and `hub-sandbox.html`/`map-sandbox.html` where relevant).
- ES module namespaces are frozen — no `THREE.X = Y` after import; tier
  overrides go via `src/threeShim.js`.
- iOS audio inits synchronously inside the start gesture — no async hop before
  `Sound.init()`.
- **Determinism is load-bearing** — don't reorder/re-salt existing `rng()`
  calls; the worldgen self-test goldens (20/20) and layout snapshots must hold.
- Lakes omit `chunkKey` on purpose; shared pooled resources tagged
  `userData.shared = true` must not be disposed.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M;
  don't reflexively `castShadow = true`. The HUD budget markers are the gate.
- Sandbox-pass ≠ game-pass — the running game must boot clean at `?perf=low/mid/high`.
- The live deploy is observed by real players (GA4 wired); production safety counts.

## Your Output

Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your **Verdict**, **Key Concern**,
and 3 bullet points.

## Your Task (Round 1)

1. Propose your prioritized order of operations for these fixes.
2. Identify the risks/concerns from YOUR domain, grounded in the docs/code
   (cite `file:line` where you can — read the actual files, don't assume).
3. Answer the production question for 1a explicitly: ship `checkShaderErrors =
   false` to the live deploy, or dev-only? Why?
4. Give a Verdict (Proceed | Proceed with mitigations | Block).

You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that is handled later.
