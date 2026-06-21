---
change: perf-pass-4
status: in_progress        # not_started | in_progress | blocked | paused | complete
current_task: 7.4.1         # CG3 instancing code shipped + statically gated; CG4 GPU gates (7.4.1-7.4.5) are Gary's
blocked_by: null            # CG3 boot/census/tri/visual confirmation pending on Gary's real GPU — not a hard blocker
open_questions: 0           # count of unanswered questions in questions-for-human.md
started: 2026-06-19
last_updated: 2026-06-21
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

### D15 — Tree descriptor schema is the shared rng-order contract (CG2)
The CG2 refactor routes every forest builder through `describe*(rng)` → a plain
descriptor, with `build*` as thin consumers. The descriptor is BOTH consumers'
truth: the Group builder (`buildForestFromDescriptor`, exact) and CG3's instanced
path (unit-geo + per-instance scale). Schema (tree.js): `{ type, trunkMat, greenIdx,
colorHex, trunk:{rTop,rBot,h,seg}, foliage:[{shape:'cone'|'icosa', x,y,z, radius,
height?, cast}], crown, perches }`. CG3 maps each `foliage` part → a bucket by
`shape+cast` (crown/cone × caster/noshadow) + the `trunk` bucket = the 5 buckets
(-> Task 7.3.2), `radius`/`height` → instance scale, `colorHex` → `instanceColor`.
`worldPerches`/`worldCrown` now dual-read (Group `.userData` OR a raw descriptor),
so CG3 can register perches without a per-tree Group. **buildTree (chunk scatter,
shared `ctx.rng`) left untouched** — it's the deferred path, not a CG3 target, so no
descriptor risk taken there. Byte-identical: golden `badb6efd125e…` unchanged. -> D14

### D16 — CG3 instancing: 6 buckets, exact trunks, instanceColor, per-chunk
`buildForestInstanced(instances)` (tree.js) collapses a chunk's woods into up to 6
`InstancedMesh`es: `trunk_pine`, `trunk_broad`, `cone_caster`, `cone_noshadow`,
`crown_caster`, `crown_noshadow`. **Two trunk buckets, not one** (resolves the taper
dangling thread): a unit cylinder bakes ONE rTop/rBot ratio, and pine (0.55) differs
from oak/birch (0.7), so splitting keeps radii EXACT — only segments unify 7→8
(imperceptible). Foliage/cone buckets follow the per-mesh cast lines verbatim
(-> Task 7.3.2) so the 56-caster audit holds. **Color via `instanceColor` over one
white base material per family** (foliage, trunk) — depth/shadow pass ignores color, so
it's orthogonal to the cast split; one cached `USE_INSTANCING_COLOR` program, not a
recompile storm (-> Task 7.3.3). Instance matrix = `T(x,0,z)·Ry(rotY)·T(local)·S(scale)`
so off-centre parts (oak bumps, birch puffs) get the yaw applied to their offset,
matching the per-mesh Group. **Per-chunk, added to `ctx.group`** (origin-anchored → the
matrices use absolute world coords; three auto-computes the bounding sphere so
off-screen chunks frustum-cull as a unit, -> Task 7.3.6). Disposal already correct:
InstancedMesh `.isMesh` is true, shared unit geos + base mats carry `userData.shared`
(skipped), `obj.dispose()` frees the instance buffers (chunks.js:563). Net: ~344
per-tree draws/chunk → ~5–6, plus a memory win (4 shared unit geos vs fresh geometry
per tree). -> D15

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
- ~~**CG3 trunk-instancing taper approximation.**~~ RESOLVED in CG3: went with the
  2-trunk-bucket split (pine 0.55 / broadleaf 0.7), so trunk RADII are EXACT — no
  taper approximation. Only the segment count unifies 7→8 (imperceptible). Cost is
  one extra InstancedMesh/chunk (6 buckets, still "~5").
- **Game boot + all GPU verification is Gary's** (no WebGL here). CG2 byte-identical
  + CG3 statically gated (golden unchanged, parse clean, bucket-count↔fill proven
  under node), but the longest-call-chain boot
  (`buildWorld→_generate→_generateWorldgen→scatterWorldgenTrees→buildForestInstanced`)
  and every visual/perf number can only run on the real GPU. **Correctness path now
  source-verified against three 0.160** (2026-06-21): `setColorAt` auto-allocs
  instanceColor (also proven by starPower.js shipping it); InstancedMesh defines
  `boundingSphere=null` so `Frustum.intersectsObject` calls its INSTANCE-AWARE
  `computeBoundingSphere()` → per-chunk frustum culling works, trees won't vanish
  off-origin (the highest-risk visual bug, cleared). So Gary's remaining checks are
  quality + numbers, not correctness: boot-clean confirmation, draw-census win,
  `?perf=low/mid` tris, instanceColor green fidelity under the Lambert swap, shadow
  read, geo-leak drive-in/out, bird perching.

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

### 2026-06-21 -- CG2 shipped: descriptor extraction, byte-identical
**Event:** phase-change
**What:** Routed the forest builders through `describe*(rng)` → plain descriptor →
`buildForestFromDescriptor` (the descriptor schema is -> D15). Verified byte-identical:
the golden gate still reads `badb6efd125e…` after the rewrite, tree.js parses clean,
check-model-dims + check-importmaps green. All consumers intact — chunks.js/forests.js
still get a collidable Group + `worldPerches`/`worldCrown` (now dual-read Group-or-
descriptor); lakes.js still gets a scalable Group; sandbox's 5 forest cases + bird_in_tree
unchanged. No CHANGELOG entry — pure internal refactor, no observable change (the rule's
explicit skip case). Committed standalone so CG3's instancing diff stays focused.
**Refs:** -> Task 7.2.1 7.2.2 7.2.3 -> D15 -> next CG3 (-> Task 7.3.1)

### 2026-06-21 -- CG3 + CG4-static shipped: forest instancing (the win), GPU gates pending
**Event:** phase-change
**What:** Instanced both production forest paths off the CG2 descriptors (design -> D16).
`scatterWorldgenTrees` (v2, the shipped default) + `scatterForestTrees` (v1 free-rider)
now accumulate `{d,x,z,rotY}` per chunk and call `buildForestInstanced` → up to 6
per-chunk InstancedMeshes; lakes + chunk-scatter trees stay per-mesh (excluded). Kept
rng order + registration identical, so the golden `badb6efd125e…` and tree positions are
unchanged — only the scene graph differs. Fixed the stale chunks.js:385 "default OFF"
comment (v2 IS the default). Added sandbox `forest_patch_instanced` composite (-> Task
7.4.6) + CHANGELOG Performance entry + ROADMAP trim (-> Task 7.4.7).
**Static verification done (all I can do here):** golden gate unchanged; registry gate
green after extending the shim with Matrix4/Color/InstancedMesh no-op stubs; tree.js/
chunks.js/forests.js parse clean; check-importmaps + check-model-dims green; and a node
harness drove `buildForestInstanced` on a 300-tree mixed batch proving bucket-count ==
fill-count (1281/1281), all 6 buckets present, needsUpdate + instanceColor set, empty-in
→empty-out. **Pending Gary (real GPU, -> Task 7.4.1-7.4.5):** clean game boot (highest
priority — runtime InstancedMesh API can't run here), draw-census win, `?perf=low/mid`
tri budget, ToD visual fidelity, geo-leak drive-in/out, forest birds perching. See
Dangling Threads.
**Refs:** -> Task 7.3.1-7.3.6 7.4.6 7.4.7 -> D16 -> Gary gates 7.4.1-7.4.5
