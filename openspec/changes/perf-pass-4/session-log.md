---
change: perf-pass-4
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: 7.2.1         # CG1 (shim+determinism gate) shipped; CG2 descriptor extraction is next
blocked_by: null            # "Q3" | "dependency X" | null
open_questions: 0           # count of unanswered questions in questions-for-human.md
started: 2026-06-19
last_updated: 2026-06-20
ref: .claude/perf-brainstorm.md  # the idea bank + critic ranking this picks up
---

# Session Log: Performance pass 4 — steady-state + stall reduction

> **AGENT DIRECTIVE:** This log is the "why" trail — it is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`.

## Key Decisions

- **D1 — Scope = the non-build Tier-0/1/2 ideas from `.claude/perf-brainstorm.md`.**
  Build-step/bundler/worker/texture-compression ideas are deliberately excluded and
  parked on ROADMAP for a later date (Gary, 2026-06-19). The build decision is
  orthogonal and measurement-gated; see [[no-build-constraint-relaxed]].
- **D2 — Ordering is gated on measurement.** B0 (fix draw/tri measurement under
  post-processing) ships FIRST because every batching/cull decision downstream is
  blind until `renderer.info` reads true again. Tier-2 draw-reduction work
  (geometry merge, fog-cull) is explicitly gated behind B0's numbers.
- **D3 — C1-b (phased deferral) over C1-a (full coroutine).** Unanimous across the
  Tier-3 debate council. C1-b runs the same `rng()` calls in the same order (just
  deferred), so the determinism gate is a clean pass/fail; C1-a turns every inline
  `registry.add` into a resumable yield across the most determinism-delicate call
  chain. -> deliberations/001-perf-pass-4-plan/results.md
- **D4 — F2 demoted + scope-capped (was nearly Blocked).** The debate found the
  design's premise false: `world.js:139-141` re-anchors the sun shadow frustum to
  the cart EVERY frame, so `autoUpdate=false` *smears* shadows under motion, not
  benign staleness. F2 now requires movement-gated `needsUpdate` co-located with
  the sun-follow, single-owner shadow cadence, mid/high-stationary-only scope cap,
  B0-gating, and is CUT if B0 shows the depth pass isn't material. Pulled out of
  Slice 1. -> deliberations/001-perf-pass-4-plan/council-adversary.md
- **D5 — Re-cut into 3 ship slices.** Slice 1 = B0 + D3 only (agent-self-verifiable);
  Slice 2 = shader wall + F2 (F1-refactor → A4 → A1 → governor → F2 → F1-gate);
  Slice 3 = C1-b alone behind the hard determinism gate. E1 + Tier-2 default PARK.
- **D6 — Determinism gate is a multi-chunk merge-blocker.** The deferred queue is
  global while `registry.byChunk` is key-scoped, so the byte-identical registry-dump
  diff must span a concurrent-deferral neighborhood, not one isolated chunk.
- **D8 — Round-trip-1 capture: DRAWS are the steady-state ceiling.** With B0 now
  reporting true numbers, the 2026-06-19 capture shows draws = **median ~3,750,
  max 9,232** vs the 400 high-tier budget (12–23× over), tris ~1.4M. `progDelta`
  ~0 and `fMax` median 33ms → the 137–343ms shader stall did NOT fire this run.
  steady-state CPU fine (avoidMs 0.1–0.3). **Conclusion: the real perf lever is
  draw-call reduction (geometry merge / instancing), not the shader wall.**
  Slice 2 re-scoped accordingly. B0 paid for itself — it pointed at the real wall.
- **D9 — F2 (amortized shadows) CUT.** Its own gate ("cut if B0 shows the depth
  pass isn't material") triggered: `fMax` is fine, no shadow-driven spikes. Not
  worth its verified smear-under-motion risk. -> D4
- **D10 — F1 (bloom gate) shipped; A1/A4 deferred.** F1 is the one Slice-2 item
  the GPU-bound data supports (shedding a full-screen pass in daylight). A1/A4
  (shader prewarm/reveal) deferred until a hub-stress capture reproduces the
  stall (progDelta ~0 this run). Geometry-merge promoted to primary next work
  (-> Task 5.2), needs Gary's go-ahead + its own deliberation.
- **D11 — Geometry-merge reframe (deliberation 002).** The assumed "merge takes
  9,000 draws → hundreds" is FALSE. Food-court/camp-village are mostly already
  pooled (`userData.shared` food trucks) / instanced (campsite torches) / self-
  merged (picnic tables) — three.js already batches them. Realistic merge win ≈
  **50–150 draws (~2–4%)** from the unique-geometry models only (food-truck,
  sugar-shack). Camp-village SKIP. Per-MODEL not per-cluster. **The 12–23× draw
  overage needs a BIGGER lever — LOD / cross-cluster instancing of distant
  clusters, and an honest look at whether the 400-draw budget is realistic for v2
  worldgen.** -> deliberations/002-geometry-merge/results.md -> Task 5.2a-d
- **D7 — Three non-obvious correctness traps captured.** (a) D3's `activePassengersRef`
  is two-channel: `count` re-snapshots per NPC (not frozen per frame), `add()`
  mutates the live outer counter — a naive hoist breaks the boarding throttle.
  (b) A1's prewarm must NEVER dispose — tearing down factory-built meshes frees
  `userData.shared` pooled materials → recompile storm. (c) One shared per-frame
  governor for scatter + reveal-pump + E1; crowd-spawn last.
- **D12 — The real draw lever is TREES, not geometry-merge (drawCensus, 2026-06-20).**
  `__dbg.drawCensus()` (new harness, shipped) at a dense hub: 14,359 pre-frustum
  draws, top buckets `IcosahedronGeometry·240v` = 2,637 (oak/birch crowns) +
  `ConeGeometry·35v` = 2,120 (pine tiers) + a big share of ~3,700 cylinder draws
  (trunks) — all un-instanced. tree.js pools foliage *materials* but allocates
  *geometry* per tree. Trees ≈ half the scene and static → the cleanest instancing
  target (~344 draws/treed-chunk → ~5). This is the "bigger lever" D11 called for.
  -> Section 7 (Slice 4) -> deliberations/003-forest-instancing/results.md
- **D13 — Slice-4 must target worldgen v2 (deliberation 003, T3).** `DEFAULT_WORLDGEN_V2
  = true` (perf.js:42); the v2 branch `return`s at chunks.js:405, so the live tree
  path is `scatterWorldgenTrees`/`buildForestTree` (chunks.js:1036/1061), and v1
  `scatterForestTrees` (forests.js:911) is dead-by-default (`?worldgen=0` only).
  Instrumenting v1 moves the production census by zero. Both paths share
  `buildForestTree`, so one descriptor refactor covers both (v1 rides free). The
  chunks.js:385 "default OFF" comment is STALE. Defer chunk-trees (chunks.js:1696,
  shared `ctx.rng` → reorder desyncs pottys/crowd/bubble-jugs); exclude lakes
  (chunkKey-omission + scale-coupled collider).
- **D14 — Determinism needs a NEW gate; layout-snapshot is visual-blind (deliberation
  003, T1 — the crux).** `dumpRegistry` (main.js:1505-1515) emits 9 placement
  fields, dropping scale/color/species/crown/perches — so a same-count rng *reorder*
  regenerates every forest + moves bird perches with a byte-identical snapshot, all
  gates green. Mitigation: build `bin/test-forest-determinism` (golden-hash the
  descriptor stream via the node-three-shim loader; extend the shim 1→~7 stubs
  first), capture the golden from `main` before refactoring, run BOTH gates. Plus:
  `instanceColor` + ~5 cast/no-cast buckets (orthogonal, keeps the 56-caster audit);
  keep the Group-returning builders + add `describe*` siblings (sandbox/lakes call
  them); disposal already correct (chunks.js:563). -> Section 7

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | `renderer.info.render.calls` reads 1 because EffectComposer fullscreen passes overwrite it each pass | high | unverified | confirm in postprocessing.js / main render call |
| A2 | The 137–343ms stalls are GL program compile/link, correlated with `prog` jumps | high | observed | from 2026-06-19 capture |
| A3 | `_generate` builds a chunk synchronously in one frame (allocation cost = the hitch) | high | unverified | confirm in chunks.js |

## Dangling Threads

- Live perf/visual verification (FPS, stall removal, ToD screenshots) can only run on
  Gary's real-GPU local machine — Codespaces has no WebGL. Agent-side verify is limited
  to syntax / importmap / determinism gate / code review.

## Work Log

### 2026-06-19 -- Change scaffolded
**Event:** phase-change
**What:** Created perf-pass-4 from the zerble schema to carry the non-build perf work
from the brainstorm. Proposal → specs → design → tasks to follow, then a tier-3
deliberation debate before apply.
**Refs:** -> .claude/perf-brainstorm.md

### 2026-06-19 -- Tier-3 debate deliberation ran (both rounds)
**Event:** decision
**What:** 5-persona debate (Architect/Adversary/Auditor/Pragmatist/Profiler +
Mediator). Round 1 did not converge; Round 2 cross-examination found a real bug
(F2 shadow smear under motion) and corrected the plan. Verdict: Proceed with
mitigations. Folded 7 binding corrections into tasks.md + fixed the frame-budget
spec contradiction (collider-registering = synchronous phase). Tasks re-cut into
3 slices. -> deliberations/001-perf-pass-4-plan/results.md -> D3 D4 D5 D6 D7

### 2026-06-19 -- Slice 1 implemented (B0 + D3)
**Event:** phase-change
**What:** Shipped the agent-verifiable slice. B0: `InfoCapturePass` at composer
index 1 taps `renderer.info.render.calls/triangles` post-RenderPass → `renderer
.__sceneInfo`; debug.js HUD + perf sample read it (live fallback); added
`progDelta`. D3: pooled the per-NPC `activePassengersRef` closure to one ref/frame
with per-NPC `count` re-snapshot. Touched main.js, debug.js, crowd.js. CHANGELOG
+ ROADMAP updated (ROADMAP now carries the full perf-pass-4 set + the parked
build-step cluster; Bundler out-of-scope note reframed per Gary's no-build relax).
**Refs:** -> Task 1.1-1.6, 6.1-6.4
**Verify limit:** No WebGL in Codespaces — static gates only (ESM parse, Pass
import resolves @0.160.0, check-importmaps OK, registry determinism PASS). Live
draws-read + boarding + boot are Gary's (see Dangling Threads).

### 2026-06-19 -- Slice 2/3 deliberately NOT implemented
**Event:** decision
**What:** Per the deliberation re-cut (D5), the shader wall (A1/A4/F1/F2) and
C1-b chunk slicing are gated behind Gary's real-GPU capture round-trips and stay
unimplemented. Building them now would be exactly the sandbox-pass≠game-pass /
optimize-before-measure trap the council flagged. Slice 1's first capture decides
F1's brightness gate, Tier-2 go/no-go, and the steady-state attribution.

### 2026-06-19 -- Round-trip-1 capture in → Slice 2 re-scoped + F1 shipped
**Event:** discovery
**What:** Gary's capture confirmed B0 works (draws now real) and revealed draws
are the steady-state ceiling (med ~3,750 / max 9,232 vs 400 budget); the shader
stall barely fired (progDelta ~0). Acted on it: shipped F1 (bloom gate, single
per-frame owner over AdaptiveQuality) — adaptiveQuality.js + main.js; CUT F2;
DEFERRED A1/A4; promoted geometry-merge to the primary next lever (Task 5.2,
needs Gary go-ahead + deliberation). Static gates green (ESM parse, importmaps,
determinism). F1 live-verify (bloom off in bright day, on at dusk/star power, no
flicker) is Gary's. -> D8 D9 D10

### 2026-06-20 -- drawCensus named the lever → forest-instancing deliberation (003) → Slice 4 tasks built
**Event:** decision
**What:** Shipped the `__dbg.drawCensus()` harness (scene draw-call composition by
geometry/material) to scope the draw lever D11 called for. Gary ran it at a dense
hub: TREES are ~half the scene's draws, all un-instanced (-> D12). Ran a Tier-3
debate-mode deliberation (003-forest-instancing: Architect/Profiler/Adversary/
Auditor/Pragmatist + Mediator, both rounds) — verdict "proceed with mitigations,"
three tensions resolved (-> D13 target v2 not v1; -> D14 new golden-hash gate +
instanceColor/5-bucket shadow split). Folded CG1–CG4 into tasks.md as **Section 7
(Slice 4)**, fully self-contained with file:line citations so it executes without
re-reading the deliberation. Also back-filled the missing 002 entry in the
deliberation index. Slice 4 is the new primary draw lever; Section 5 geometry-merge
stays parked (~2–4%, D11). NOTHING coded yet — CG1 (shim + determinism gate) is the
agent-static starting point, no Gary round-trip needed.
**Refs:** -> Section 7 (7.1-7.4) -> deliberations/003-forest-instancing/results.md
-> D12 D13 D14

### 2026-06-20 -- CG1 shipped: forest-determinism gate captured the golden from main
**Event:** phase-change
**What:** Built the visual-stream determinism gate BEFORE touching any builder, so
the golden is `main`'s. Extended `node-three-shim.mjs` from a Vector3-only stub to
also stub `Group`/`Mesh` (property-bag Object3Ds with `.add`/`.position`/`.userData`/
`.castShadow`) + `CylinderGeometry`/`IcosahedronGeometry`/`ConeGeometry`/`BoxGeometry`
+ `MeshStandardMaterial` as no-ops — enough for the REAL `tree.js` to import and run
under node. `bin/test-forest-determinism` wraps rng in a recording proxy and
golden-hashes the full raw draw sequence + `userData.crown`/`perches` over 4000 seeds
(all three forest species + both buildTree branches asserted via coverage guards).
Chose to hash the RAW rng draw stream rather than derived descriptor fields: it's
strictly stronger (every descriptor value is a deterministic fn of the draws) AND it
works against current `main` with zero builder changes, which is the point of CG1 —
capture before refactor. Golden = `badb6efd125e…4928337a`. Falsification-checked:
injected a leading `greenIdx` draw into a throwaway `buildOak` copy (the exact -> Task
7.2.3 trap) and confirmed the hash moved. Registry gate still green after the shared
shim change. CHANGELOG dev-workflow entry added (matches the `bin/test-registry-grid`
precedent). This converts the load-bearing determinism check from a Gary round-trip
into an agent-static gate that runs every slice from here.
**Refs:** -> Task 7.1.1 7.1.2 7.1.3 -> D14 -> next CG2 (-> Task 7.2.1)
