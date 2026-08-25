---
change: perf-pass-4
status: paused             # not_started | in_progress | blocked | paused | complete
current_task: 3.3          # remaining structural deferral work is parked
blocked_by: null            # no blocker
open_questions: 0           # count of unanswered questions in questions-for-human.md
started: 2026-06-19
last_updated: 2026-08-25
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

### D17 — Scoped model merging preserves each source mesh's shadow state
The extracted `mergeDecor.js` keeps the tent's legacy opaque/transparent defaults,
while food trucks and Sugar Shacks pass a callback that splits merged geometry by
the original `castShadow` bit. This retains the audited caster set instead of making
wheels, canopies, poles, stations, and supplies cast as collateral. The util also
skips texture-mapped meshes (the old helper only skipped emissive ones), because
Sugar Shack signage cannot be represented by its flat vertex-color material. The
deliberation's picnic-table call-site note was stale: the current table already
self-merges independently and imports nothing from `tent.js`. -> Task 5.2a-5.2c

### D18 — Sign faces and co-material windows should not pay per-face draws
The model-level sandbox capture proved the Sugar Shack at 72 scene draws and the
already-merged food truck at 7. Four Sugar Shack signs were still six-material
`BoxGeometry` meshes, which makes each box six render submissions even though only
the printed front needs an independent material. Each sign is now a shared open-front
shell that joins the existing static-color merge plus one mapped plane, saving exactly
20 scene draws with identical triangle count. The truck's two windows share one
emissive material and never move independently, so their transforms are baked into one
shared geometry for one further draw saved. -> Task 5.2e 5.2f

### D19 — The real-GPU gate is one deterministic suite, not a handwritten drive loop
Task 5.2d now has a local-only `?modelMerge=1` control that enables only the new
food-truck and Sugar Shack experiment, leaving the older tent merge unchanged. One
`?perfGate=suite` URL reloads through fixed-seed, fixed-camera low/mid/high pairs and
then five-cycle unmerged/merged lifecycle controls after the chunk-generation counter
settles. Exact merge create/dispose instrumentation proved the live merged geometry
count repeats at each location; the broader `renderer.info.memory.geometries` verdict
allows a one-percent post-warm-up window but remains independent because unrelated lazy
renderer resources continued warming in some software-rendered runs. The in-app browser exercises
the whole workflow, but its software-rendered draw deltas are diagnostic only; Gary's
hardware run remains the acceptance gate. -> Task 5.2d

### D20 — Real-GPU renderer counts reject both broad model merges
Gary's fixed-seed hardware suite measured merged minus unmerged renderer draws at
**+72 low, +358 mid, and +364 high**. That is a loss on every tier, despite the
isolated-model mesh reductions. The merged lifecycle also stopped advancing after
`court-3`; the old stability test repeated stale snapshots and falsely called that a
plateau. Production therefore defaults both broad merges OFF, with `?modelMerge=1`
retained only to reproduce the rejected experiment. The independent 21-draw window
and sign-shell cuts remain. The settle gate now requires `renderer.info.render.frame`
to advance, completion persists as `perfGateDone=1`, and a direct Midnight visual
route proved food-court lights intact. -> Task 5.2d

### D21 — Camera far plane is backdrop-bounded, not fog-wall-bounded
Fog ends at 520m, but a literal 520m far plane clips the recentered visual world:
sky radius 900m, stars 850m, ground corners ~990m, and worst-case randomized
mountain vertices ~1012m. The shortest safe value is therefore 1040m on every
tier; tier-specific shorter values are impossible while the backdrop is shared.
This still cuts the invisible tail of lakes retained to their 1500m unload radius.
On a fixed-registry 1.2km travel A/B/A, 1040m rendered 2595–2610 draws versus
2949–2960 at 1500m, roughly 350 draws and 12k triangles saved. Same-state Noon
frames were visually indistinguishable; Midnight and all three Start flows stayed
clean. -> Task 5.3

### D22 — Bloom's dynamic signal is world lighting, not camera-content scanning
Task 2.6 already shipped one deterministic predicate: `nightness > 0.08` or star
power active, ANDed with the tier, AdaptiveQuality, and player override. The older
Task 2.7/spec language still described per-frame stage/fire visibility and wrongly
claimed low had `PERF.bloom = false`; neither matches the code or current profiles.
Adding a registry/frustum scan would add CPU work and a second source of threshold
churn without a measured need, so the contract now matches the single shipped
writer. Live low/mid/high matrices all proved day off, dusk on, daytime star power
on, player-off wins at night, and 12 stable near-threshold samples; browser errors
were empty. -> Task 2.7

### D23 — Nine cluster kinds are structural; only camp-village is wholly defer-safe
The `buildWorldgenKind` call graph shows that main/side/tent stages, arches, food
courts, vendor rows, bubble vendors, porta banks, and drum circles all register
colliders directly or through helpers. `camp_village` registers steering footprint
and attractor data but no collider, making it the only whole cluster builder that
can move into the deferred phase. The drum access path is also collider-free, but
its paired circle is structural. The dispatcher now records this binding boundary.
The outer streaming loop separately moved from one chunk/frame to tier-aware 3/4/5ms
walls while preserving eager boot; splitting a single dense chunk remains Task 3.3.
-> Tasks 3.1, 3.2

### D24 — The planned whole-stage deferral moves the wrong 3% of chunk time
`__dbg.chunkStages()` now measures v2 generation only under `?debug=1`, with no
production timestamps. On a fixed-seed low-tier 800m jump (nine new chunks), the
repeatable split was roughly **144–177ms trees + 86–111ms props**, versus only
**~6–8ms total** for crowd, jugs, campsites, and hedges. Within those hot stages,
instanced-tree visual materialization was just **0.3–0.6ms**, while three vendor
rows consumed **57–71ms**. Therefore the original whole-stage C1-b queue would
leave about 97% of measured work synchronous and cannot flatten the hitch it was
designed to solve. Two one-variable tree-planning attempts were rejected and fully
removed: an exact-equivalent precomputed density-neighborhood sampler measured
150ms before versus 157ms after, and transient-vector reuse also failed to improve
the same route. Task 3.3 is re-scoped to descriptor-first splitting of a genuinely
hot structural builder (vendor rows) or a separately measured tree-planning cut;
no deferral ships until it moves material time and preserves rng/registry identity.
-> Task 3.3

### D25 — Park the remaining structural deferral work
Gary parked the remaining performance move on 2026-07-15. The tier-aware chunk
generation wall and debug stage profiler remain shipped, while Task 3.3's
descriptor-first vendor-row or tree-planning split stays recorded for a future
performance pass rather than continuing by inertia.
-> Task 3.3

### D26 — Capture is a data workload; mobile telemetry stays local-first
The 2026-08-25 audit reproduced `bin/layout-snapshot capture` hanging under
Playwright's SwiftShader software WebGL and leaving two `chrome-headless-shell`
GPU workers at roughly 200% and 750% CPU. The installed `agent-browser` is 0.9.1,
which lacks the `skills` and `--init-script` capabilities assumed by the parked
manual workaround. Layout capture does not need a rendered frame: built truth is
the registry populated by the ordinary update/streaming loop. The durable fix is
therefore a localhost-only data capture mode that keeps the yielding timer loop
but skips `composer.render()`, plus a driver that owns a unique named session,
hard timeouts, unconditional close, and a baseline-delta orphan assertion. For
real-device profiling, reuse the shipped localStorage perf ring and capture sink
through an explicit tokenized LAN server mode; begin recording only after the real
Start tap and after synchronous `Sound.init()`. A public collector for remote
players remains a separate hosting/privacy decision.
-> Task 8.1 -> Task 8.2

### D27 — Low-tier Auto must avoid transmission; unique streamed textures own disposal
Gary's first real-device report ran for 215.1 seconds on iPhone Safari/WebGL 2
with an Apple GPU and traversed roughly 808m. The clean adjacent
`pixel-75` -> `cheap-bubs` samples held registry, chunk count, and position nearly
steady while draws fell 1,795 -> 867 and triangles 708,458 -> 361,371. A single
transmissive bubble InstancedMesh was forcing three.js's scene transmission
pre-pass, so low-tier Auto now starts cheap and its ladder omits low-tier rungs
that cannot change effective state. Detailed bubbles On remains an explicit
player override. The same report's geometry count both rose and fell with chunk
residency, but textures climbed monotonically 6 -> 126. Every campsite tapestry
owned a unique CanvasTexture, while material disposal never disposed its map.
The texture now listens to its owning material's disposal event, covering chunk,
lake, and sandbox teardown without touching cached/shared textures.
Gary then clarified that the run included a Wook trip. Trip is a full-screen
ShaderPass while its envelope is open, but the v1 report did not record its
state. Future samples now include the Trip envelope/progress/pass plus star power,
bloom, bubble material, and pixel ratio. The two identified fixes remain valid:
InfoCapturePass records scene draws/tris before the Trip pass, so the adjacent
bubble-material delta cannot come from the psychedelic effect, and texture
ownership is independent of frame cost. Live verification also caught the pass
starting enabled until its first update and the early fade-in scalars rounding to
zero. Trip now initializes disabled and those two scalars keep three decimals; a
fresh report showed idle `tripPass: false`, then an enabled pass at envelope 0.004.
-> Task 9.1 -> Task 9.2 -> Task 9.3 -> Task 9.5

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | `renderer.info.render.calls` reads 1 because EffectComposer fullscreen passes overwrite it each pass | high | unverified | confirm in postprocessing.js / main render call |
| A2 | The 137–343ms stalls are GL program compile/link, correlated with `prog` jumps | high | observed | from 2026-06-19 capture |
| A3 | `_generate` builds a chunk synchronously in one frame (allocation cost = the hitch) | high | unverified | confirm in chunks.js |

## Dangling Threads

- ~~**Dense-food-court real-GPU gate.**~~ RESOLVED: Gary's suite rejected the broad
  merges on all three tiers; they are scoped out and the final Midnight view is now
  direct, durably marked complete, and browser-verified.
- ~~**CG3 trunk-instancing taper approximation.**~~ RESOLVED in CG3: went with the
  2-trunk-bucket split (pine 0.55 / broadleaf 0.7), so trunk RADII are EXACT — no
  taper approximation. Only the segment count unifies 7→8 (imperceptible). Cost is
  one extra InstancedMesh/chunk (6 buckets, still "~5").
- ~~**Game boot + all GPU verification is Gary's** (no WebGL here).~~ RESOLVED for
  functional verification: the in-app browser now supplies WebGL and has booted the
  full low/mid/high game plus the capture suite. Gary's hardware is still authoritative
  for performance acceptance. **Correctness path was also source-verified against
  three 0.160** (2026-06-21): `setColorAt` auto-allocs
  instanceColor (also proven by starPower.js shipping it); InstancedMesh defines
  `boundingSphere=null` so `Frustum.intersectsObject` calls its INSTANCE-AWARE
  `computeBoundingSphere()` → per-chunk frustum culling works, trees won't vanish
  off-origin (the highest-risk visual bug, cleared). So Gary's remaining checks are
  quality + numbers, not correctness: boot-clean confirmation, draw-census win,
  `?perf=low/mid` tris, instanceColor green fidelity under the Lambert swap, shadow
  read, geo-leak drive-in/out, bird perching.

## Work Log

### 2026-07-15 -- one-URL food-court gate proves lifecycle ownership locally
**Event:** phase-change
**What:** Added a measurement-only unmerged control, fixed-camera draw sampler, settled
chunk-generation wait, and paired five-cycle lifecycle controls. The first automated
run correctly falsified the naive exact-total-memory check: unrelated lazy GPU resources
were still warming. The unmerged control then plateaued, and merge-specific create/dispose
instrumentation proved every merged geometry unloads, with the live count repeating
exactly at both locations. The final reporter separately judges total renderer geometry
within a one-percent post-warm-up window and keeps merge ownership exact; the former still
varied in the software-rendered browser because unrelated lazy resources continued to
appear. The in-app browser completed the full self-reloading suite and wrote all eight
captures; `npm run check` remains green. **Pending Gary / Task 5.2d:** run the same one-URL suite on the real GPU,
then visually confirm Midnight emissive glow and two-frame animation.
**Refs:** -> D19 -> Task 5.2d

### 2026-07-15 -- sandbox scene counter exposes another 21 model draws to remove
**Event:** phase-change
**What:** Added a permanent sandbox readout that captures real scene draws and triangles
immediately after `RenderPass`, before post-processing overwrites `renderer.info`, plus
live geometry/texture counts. Entity teardown now honors the production
`userData.shared` contract and frees InstancedMesh instance buffers; two repeated
food-truck/Sugar Shack switch cycles plateaued at the same resource counts with no
console errors. The baseline named two one-variable cuts: Sugar Shack 72 → 52 scene
draws at the same 6,431 triangles by replacing four six-material sign boxes with shared
open-front shells plus mapped planes, and food truck 7 → 6 at the same 344 triangles by
premerging its co-material windows. Both models are visually clean at Noon + Midnight,
and the full game boots/runs console-clean on forced low/mid/high. Static gates remain
green: importmaps, model dimensions, registry grid, and forest determinism.
**Refs:** -> D18 -> Task 5.2e 5.2f -> next 5.2d

### 2026-07-15 -- scoped food-truck + Sugar Shack merge implemented; GPU gate remains
**Event:** phase-change
**What:** Extracted the shipped tent merge primitive into neutral `src/mergeDecor.js`,
hardened it against InstancedMesh template collapse and texture loss, and applied it at
the end of `buildFoodTruck` + `buildSugarShack` without consuming rng. Food trucks now
collapse seven non-emissive pieces into two caster-state buckets (10 total meshes → 5);
Sugar Shack structural color meshes collapse while staff, textured signs, emissive
fixtures, instanced string bulbs, and lights remain live. Noon/Midnight sandbox checks
for truck/shack plus the tent regression are console-clean; the full game boots and runs
console-clean on forced low/mid/high. Importmaps, parse, model dims, registry grid, and
forest determinism are green. `bin/lint` still reports its existing world-layout finding
(drum circle inside a food-court envelope); the rng-free merge cannot affect it. The
legacy `layout-snapshot capture` driver hung before returning a dump, so no snapshot pass
is claimed. **Pending Gary / Task 5.2d:** dense-food-court before/after draws by tier,
geometry baseline after unload/reload, and in-game cook motion.
**Refs:** -> D17 -> Task 5.2a 5.2b 5.2c -> next 5.2d

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

### 2026-06-21 -- CG5: lakeside trees instanced (Slice 4 follow-up, Gary-greenlit)
**Event:** phase-change
**What:** Gary drove the shipped instancing, confirmed forest trees look good, and his
drawCensus named the next lever: lake trees were still per-mesh (icosa·240v·uniq 749 +
cone·35v·uniq 532) because CG3 excluded them (lake lifecycle ≠ chunk). A lake plants
90-140 shore-ring trees + 0-2 island trees. Instanced them with the SAME
`buildForestInstanced`, extended with an optional per-instance uniform `scale` (lakes do
`tree.scale.set(s)`; chunk forest passes none → defaults 1 → golden unchanged, verified).
`buildLake` now accumulates island+shore descriptors into one per-lake list, flushed into
the lake group before return; the lake disposal walk already frees InstancedMesh buffers.
rng order + the `forest_tree` collider registration untouched → layout byte-identical.
Lake trees carry no perches, so birds are unaffected. Also shipped (separate commit
447f4c4): debug-gated the AdaptiveQuality transition toast (was dev jargon center-screen
in the player notice lane) + logged 4 census-review items to ROADMAP (campsite
intra-layout clipping, stray stage-tent spacing, v2 tri-budget recalibration, the pinned
?perf=low fMax-9029ms freeze). **Static-verified** (golden + registry + parse + importmaps
+ model-dims green; node harness proved the scale path buckets correctly, 516/516).
**Pending Gary:** lakeside render + draw drop + lake load/unload geo-leak (-> Task 7.5.4).
**Refs:** -> Task 7.5.1-7.5.4 -> reuses D16 -> CHANGELOG 2026-06-21

### 2026-08-25 -- capture harness repaired and the local-device bridge shipped
**Event:** phase-change
**What:** Reproduced the software-WebGL failure against the installed
`agent-browser` 0.9.1 surface, then replaced the unsupported init-script workaround
with a data-only local capture mode and a bounded, named, self-cleaning driver. Two
seed-1234 captures each normalized 731 entries and self-diffed EMPTY; a forced
500ms timeout left no new daemon or `chrome-headless-shell` PID. Added an explicit
tokenized LAN server and opt-in real-device reporter. Server tests returned 200 for
loopback, 403 for an untokenized LAN Host, and 200 for a tokenized LAN Host. The
in-app browser then posted a nine-sample manual report with the real Metal renderer
and a separate three-sample `pagehide` beacon report. The remaining gate is Gary's
actual iPhone/iPad route and background/foreground cycle.
**Refs:** -> D26 -> Task 8.1.1-8.1.5 -> Task 8.2.1-8.2.5 -> DEBUGGING "Phone/iPad performance capture"

### 2026-08-25 -- first real iPhone report converted directly into two fixes
**Event:** phase-change
**What:** Gary completed the same-Wi-Fi round trip with a 215.1-second,
208-sample iPhone Safari report, including one background/foreground cycle. The
capture isolated the transmissive bubble scene pre-pass as the largest immediate
low-tier cost and exposed a monotonic campsite-tapestry texture leak. Low-tier
Auto now begins with cheap bubbles and skips its inert quality rungs; a dedicated
real-module test locks the five-rung ladder and player override. Each unique
tapestry texture now disposes with its material. Five sandbox load/unload cycles
returned `renderer.info.memory.textures` from 4-5 loaded to the same 3-texture
baseline every time. A real low-tier main-game boot stayed at baseline quality,
posted a three-sample report, and logged no browser errors.
**Refs:** -> D27 -> Task 8.2.5 -> Task 9.1-9.5 -> CHANGELOG 2026-08-25
