---
change: festival-horizon
status: in_progress
current_task: "5.5 (blocked on Q1 sign-off)"
blocked_by: null
open_questions: 1
started: 2026-08-26
last_updated: 2026-08-27
ref: ROADMAP.md "Far-field festival depth / semantic LOD"
---

# Session Log: Festival Horizon

> **AGENT DIRECTIVE:** This log is the "why" trail. It is **event-driven**, not a
> per-task diary. Write an entry only when a decision is made, something unexpected is
> discovered, a blocker is hit, or a question is raised for the human. Per-task progress
> lives in `tasks.md` checkboxes; the human-readable summary lives in `README.md`. To
> recover context, read `README.md`, then this file's frontmatter plus Key Decisions and
> the latest Work Log entry, then `tasks.md`.

## Key Decisions

- **D1 (2026-08-26):** Effective enablement is `farFieldRequested &&
  USE_WORLDGEN_V2`; the disabled or legacy-forced path is a zero-allocation
  no-op. `?worldgen=0` is a live escape hatch, and v2 proxies over the v1 world
  would never hand off. (audit V2)
- **D2 (2026-08-26):** Memoized worldgen descriptors are immutable inputs.
  FarField copies them into its own compact records and never mutates cached
  arrays; `bin/test-far-field` hashes inputs pre/post rebuild. (audit V3)
- **D3 (2026-08-26):** One world-owned streaming deadline. Full chunks consume
  first, FarField gets the remainder; planning is incremental per coarse cell
  (never one monolithic ~1km² `queryRegion`); pending snapshots are versioned by
  requesting player cell so teleports supersede stale work. (audit V4)
- **D4 (2026-08-26):** One exported owner-cell helper from `placement.js` plus a
  narrow `ChunkManager.isLoaded(cx, cz)` predicate. Handoff is keyed to the
  named contract "required cluster props exist," not to `_generateWorldgen`
  currently being synchronous. (audit V5, V7)
- **D5 (2026-08-26):** Every committed pool rewrite recomputes affected bounds
  (or per-batch frustum culling is deliberately disabled); the road underlay
  sits at an explicit elevation in (0, 0.06) with opaque `depthWrite: true` and
  construction-time materials. (audit V6, V12)
- **D6 (2026-08-26):** Promotion is baseline-first. If a tier's flag-off
  baseline already exceeds its absolute HUD budget, that tier's gate re-keys to
  marginal delta + no-regression + explicit Gary sign-off. (audit V9)
- **D7 (2026-08-26):** The `worldgen-layout` persistence guarantee is narrowed
  via a delta spec to render-agnostic query tuples; festival cluster content is
  chunk-owned per `festival-composition`. Proposal now declares the modified
  capability. (audit V11)
- **D8 (2026-08-26):** Reduced motion is read live at handoff time (after
  `A11y.init()`), initial ownership snaps, and no planning happens at module
  evaluation. (audit V8)
- **D9 (2026-08-26):** The hub-sandbox far-field snapshot invalidates on the
  same worldgen tuning-epoch bump that rebuilds the hub. (audit V10)
- **D10 (2026-08-26):** The importmap task covers the three full pages only;
  `map-sandbox.html` is worldgen-only (`wg` + `rng`) per `bin/check-importmaps`.
  (audit V13)
- **D11 (2026-08-27):** ALL THREE tiers' flag-off baselines exceed their
  absolute HUD budgets (low 1,524-1,783 draws vs 80; mid 6,228-6,502 vs 200;
  high 5,908-6,362 vs 400; tris 3-4x over everywhere — the V9 scenario,
  confirmed by measurement). Per D6/task 5.5, the promotion gate on every tier
  is re-keyed to marginal delta (≤ +12 draws, ≤ +5k/+10k/+10k tris) +
  no-regression + explicit Gary sign-off. Full table + method + SwiftShader
  caveats in `verification/baseline-disabled.md`. (audit V9)
- **D12 (2026-08-27):** Per-batch frustum culling is DELIBERATELY DISABLED on
  every far-field batch (`frustumCulled = false`) — the sanctioned design-D2
  alternative — because the horizon rings the player (a batch almost never
  culls whole) and three r160 culls InstancedMesh against the BASE geometry's
  bounds, not the instances, which is exactly the stale-bounds vanishing-act
  D2 warns about. Owner-computed bounding spheres are still recomputed on
  every committed rewrite (manual min/max + extent, testable under the node
  stub) so bounds stay truthful for raycast/debug reads; `bin/test-far-field`
  locks enclosure after a distant teleport rewrite. Cost accounted: ≤ 6 always-
  submitted draws of tiny geometry.
- **D13 (2026-08-27):** All six batches (road, canopy, peak, truss, warm,
  beacon) land together in task 2.1 rather than staging trusses/night markers
  behind a later measurement: worst-case triangle counts AT FULL CAPS are ~3.8k
  (low) / ~7.5k (mid/high), inside the D11 marginal caps (+5k/+10k) by
  construction, so the "only while caps stay green" condition is satisfiable
  up front. The 5.4 measured A/B can still drop trusses/markers if reality
  disagrees.
- **D14 (2026-08-27):** The road underlay selects polylines by NEAREST-FIRST
  within radius + one coarse cell, not discovery order. `roadsInBounds` pads
  its query by `ROAD_MAX_EDGE_CELLS` heart cells (600m), so the coarse-cell
  sweep discovers arterials far beyond the horizon; unfiltered, they consumed
  the low-tier road buffer in discovery order and clipped 332 nearby polylines
  in the first live capture. With the deterministic distance filter + sort
  (stable tie-break on first-point coords), the same scene fills 656/2048
  verts with zero clips. Also: the streaming remainder is measured immediately
  after lakes+chunks — time-of-day is not streaming work and must not starve
  the horizon's budget (the first live run starved exactly that way).

## Assumptions

| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | `ChunkManager.loaded.has()` implies "fully built" only while `_generateWorldgen` stays synchronous; perf.js and chunks.js already announce future intra-chunk splitting | High (today), fragile (future) | Mitigated | Handoff specced against the `isLoaded` completion contract (-> D4); any future chunk-splitting change must preserve "fully built" semantics |

## Dangling Threads

## Work Log

### 2026-08-26 -- Post-audit artifact revision

- **Event:** decision
- **What:** Deliberation 001 concluded "Proceed with mitigations" but its
  amendments were never folded into the executable artifacts; adversarial audit
  001 blocked on exactly that (V1) and added findings V7, V9, V10, V12-V14.
  Revised `proposal.md`, `design.md`, `specs/festival-horizon/spec.md`, and
  `tasks.md` in one sitting, added the `specs/worldgen-layout/spec.md` delta,
  and recorded decisions D1-D10 plus assumption A1. Task group 1 was
  restructured (now 1.1-1.5: contract helpers first, tests, flag resolution,
  importmaps, disabled baselines). No application code touched; implementation
  remains not_started.
- **Refs:** `deliberations/001-initial-plan/results.md`,
  `adversarial-audit-001.md`, -> D1..D10, -> A1

### 2026-08-27 -- Phase 0 shakedown: verify loop rebuilt, lint regression parked, push gate

- **Event:** surprise + decision
- **What:** Pre-implementation tool shakedown on Gary's headless Linux box.
  (1) *Surprise:* no browser on the machine can create a WebGL context (desktop
  preview pane: ANGLE `BindToCurrentSequence failed`; snap Firefox: SWGL
  framebuffer mapping failure), killing the whole `__dbg` verify loop. Fixed
  per "build the harness, then the feature": new `bin/verify-headless` drives
  SwiftShader Chromium (Playwright runtime lives outside the repo in
  `~/.zerble-verify`); full game + entity sandbox + hub sandbox all verified
  clean through it. This is the surface Group 1.5 baselines and Group 5 gates
  will run on here. SwiftShader caveat for those captures: software raster, so
  wall-clock/FPS numbers are meaningless — only draws/tris/geo/tex counters
  and console cleanliness transfer.
  (2) *Surprise + decision:* `npm run lint:layout` is red — 1 error, seed 256,
  drum center inside a food_court envelope. Bisected to `ec76a82` (2026-06-16):
  `nudgeOffDrum` re-validates tree density but not cluster envelopes after a
  nudge. Gary deferred it (parked on ROADMAP with the fix shape); it's
  golden-moving, so it must NOT ride inside this change. Task 5.1's
  `lint:layout` gate is therefore "no NEW findings vs this recorded baseline
  (1 pre-existing error)," not "exit 0."
  (3) *Decision (Gary):* pushes are gated permanently — never push unless
  explicitly asked in the moment (push on main = Pages deploy). Local commits
  at sensible points remain pre-approved.
- **Refs:** ROADMAP "Lint regression: drum-in-food_court", CHANGELOG
  2026-08-27, DEBUGGING.md "When no browser here can do WebGL at all"

### 2026-08-27 -- Task group 1 landed (1.1/1.3/1.4/1.5; 1.2 nearly)

- **Event:** phase-change + discovery
- **What:** Contract helpers, flag resolution, importmaps, the pure planning
  core, the focused test suite, and the disabled baselines are in.
  Notable beyond the checkboxes:
  (1) `ownerCellCoord` was proven behavior-neutral three ways before landing —
  50,904-case brute-force equivalence vs the old inChunk comparisons (0
  diffs), worldgen snapshot hashes byte-identical vs unmodified HEAD
  (`dd6c3f13`/`4e580ed7`), lint findings unchanged (234). `placeChunkProps`
  and ChunkManager's player cell now DELEGATE to it, so the rule exists once.
  (2) *Discovery (test-agent review):* `heart.rank` is a string enum
  ('major'/'minor'); the first `copyHeartRecords` did `d.rank | 0` → always 0,
  silently erasing rank from the palette. Fixed to an explicit major=1/minor=0
  mapping; `bin/test-far-field` re-run green.
  (3) *Discovery:* `perf.js` cannot be imported by plain node (`rawDetect()`
  touches `window` unguarded at module load) — `bin/test-far-field` shims a
  minimal window/navigator locally rather than touching perf.js. Pre-existing
  wart, left alone.
  (4) Baselines: all six captures (3 tiers x Noon/Midnight, fixed pose
  244,-179, seed 1234, zero console errors) → -> D11 all-tier gate re-key,
  `verification/baseline-disabled.md`.
  (5) *Sequencing note:* task 1.2 stays UNTICKED until the two pool-dependent
  tests it names (bounds enclosure after a second distant rewrite, pool
  disposal idempotence) land with task 2.1 — the pools don't exist yet; the
  shell-level disposal/no-op contracts ARE already locked. Everything else in
  1.2 is green in `bin/test-far-field` (wired into `npm run check`).
- **Refs:** -> D11, -> Task 2.1, `verification/baseline-disabled.md`,
  CHANGELOG 2026-08-27

### 2026-08-27 -- Task group 2 landed (renderer: pools, road underlay, planning, ToD)

- **Event:** phase-change + decisions
- **What:** `farField.js` now contains the full bounded renderer behind the
  same gate: fixed-capacity `InstancedMesh` pools for all six batches (-> D13),
  the one-draw preallocated road underlay at `ROAD_UNDERLAY_Y` (opaque,
  `depthWrite: true`, materials at construction time, whole-polyline
  deterministic capacity skip), incremental coarse-cell planning driven by 80m
  player-cell crossings (hearts deduped across the padded `heartsInBounds`
  window by the SAME owner-cell rule at coarse size; road polylines deduped per
  snapshot by cached-array identity), and shared-material Noon→Midnight
  behavior with night markers hidden by day (1/64-quantized latch, zero
  steady-state work). Capacity selection anchors to the PLAYER CELL CENTER,
  not raw position, so committed pool contents are byte-stable per cell.
  Frustum culling is deliberately off per batch with owner-maintained bounds
  (-> D12). Node testability: `bin/test-far-field` now registers
  `bin/node-three-shim.mjs` (extended with BufferGeometry/BufferAttribute/
  Sphere/Octahedron/dispose counters) before import — the two pool-dependent
  1.2 cases (bounds enclosure after a distant rewrite, disposal idempotence)
  landed with it, so -> Task 1.2 is now ticked along with 2.1-2.4. Suite green
  (10 gates), flag-off boot verified headless (`?perf=low`, `__dbg.start()`,
  0 console errors). Not yet reachable from any page — world wiring is Group 3.
- **Refs:** -> D12, -> D13, -> Task 1.2, -> Tasks 2.1-2.4, CHANGELOG 2026-08-27

### 2026-08-27 -- Task group 3 landed (world wiring, dither handoff, shared budget) — first live horizon

- **Event:** phase-change + discoveries
- **What:** The horizon is now live end-to-end behind `?farField=1`: `world.js`
  owns one FarField beside the chunk/lake managers (isLoaded predicate +
  nightness + live reduced-motion each frame), planning spends only the
  remainder of the world streaming wall, and proxies dissolve through the
  per-instance Bayer-dither envelope when their owner chunk completes (and
  reappear on unload). `__dbg.horizon()` (read-only stats — the 4.2 surface,
  landed early because verification needed it) confirmed on this box, live in
  the real game: first plan commit (280 active / 656 road verts / 0 clips on
  low, seed 1234), envelope handoffs firing as chunks load mid-replan
  (handoffs: 2 after a 160m teleport), `?worldgen=0&farField=1` and default
  flag-off both resolving to no group + `{enabled: false}`, and clean consoles
  on every run. Discoveries: the two D14 issues (budget starvation via ToD in
  the measured window; road buffer eaten by out-of-radius arterials) were both
  caught by the live captures, not the unit gates — the sandbox/game split
  earning its keep. SwiftShader note: planning is frame-rate-bound (~1 coarse
  cell/frame), so first commit takes ~15s (low, 49 cells) to ~2min (high, 81
  cells) here; on a real 60fps device the same plan is ~1-1.5s. maxColdStepMs
  measured 6-16ms on this box (software raster, cold caches) vs the 2ms tier
  gate — judge that gate on real-device numbers at 5.4, per the baseline doc's
  SwiftShader caveat.
- **Refs:** -> D12, -> D13, -> D14, -> Tasks 3.1-3.3, screenshots in scratch
  (g3-on-low-noon-horizon / g3-on-low-midnight), CHANGELOG 2026-08-27

### 2026-08-27 -- Task group 4 landed (hub-sandbox far-field mode, __dbg controls, test completion)

- **Event:** phase-change
- **What:** The iteration harness is complete. `hub-sandbox.html` grew a Far
  field panel driving the REAL FarField around the built hub: Proxy only /
  Real only / Handoff modes, a composition-only tier select (backed by the new
  read-only `FAR_FIELD_TIERS` export from perf.js), a simulated-player-distance
  slider whose ownership ring dissolves the hub's proxies through the live
  envelope (verified: sliding 600→0 flipped 11 owner cells, envelopes
  completed, fades hit 0), Force replan, and a live stats readout (pool
  counts, overflow, road verts/clips, handoffs, coldStep, renderer
  draws/tris/geo/tex/programs). D9 invalidation falls out structurally: every
  hub rebuild path funnels through `build()`, which recreates FarField, so a
  tuning-epoch bump can never render a pre-bump snapshot against a post-bump
  hub. `__dbg.horizon(mode)` gained the deterministic forcing controls
  ('proxy'/'real'/'live' snap ownership, 'replan' drops the snapshot),
  documented in DEBUGGING.md with the SwiftShader first-plan-latency caveat.
  `bin/test-far-field` completed per 4.3: 12-crossing long-travel plateau
  (same mesh/buffer refs, zero disposals, caps held, 12 rebuilds), registry
  off-on identity, forcing-control snaps + byte-identical forced replan,
  opaque/depthWrite material invariants, and the no-builder/no-light/
  no-shadow/no-registry contract pinned as a source-level scan. Sandbox
  alignment screenshot: proxy vendor-peak strips sit on the real booth rows.
- **Refs:** -> D9, -> Tasks 4.1-4.3, `g4-sandbox-proxy.png` (scratch),
  CHANGELOG 2026-08-27

### 2026-08-27 -- Task group 5 gates run: all measurable gates PASS; promotion awaits sign-off (-> Q1)

- **Event:** phase-change + discovery + question
- **What:** Full acceptance matrix on the SwiftShader rig (method + numbers in
  `verification/gates-flag-on.md`). Headlines: far-field marginal cost is
  **6 draws / ≤3.7k tris (low, measured) and ~6.6k/~7.8k tris (mid/high,
  derived from cap-saturated pools)** — inside every D11 cap; rng draw-count
  canary and layout-normalized registry are **byte-identical off vs on**;
  long-travel resource growth is byte-identical to the flag-off control
  (retained-lakes-by-design, not a leak); zero console errors across all 20+
  legs including real title click, mobile viewport + reduced motion, and both
  kill switches. *Method discovery:* unfrozen scene-level A/B is USELESS for a
  ≤12-draw gate — dynamic crowd/birds swing draws ±270–700 in both directions
  across runs; the gate evidence is the frozen-NPC A/B plus direct
  always-submitted-batch measurement (both recorded). Two numbers can only be
  judged on a real device: planning cold-step vs the 2ms gate, and worst-frame.
  5.1/5.3/5.4 ticked; 5.2 pending a screenshot eyeball (captures taken; a
  transient Read-tool outage delayed review); 5.5 blocked on -> Q1 (Gary
  sign-off, per D11 on every tier). Default remains OFF.
- **Refs:** -> Q1, -> D11, `verification/gates-flag-on.md`, -> Tasks 5.1-5.4

### 2026-08-27 -- Session close-out: docs landed, hygiene done, two tasks wait on humans/tools

- **Event:** phase-change
- **What:** 6.1 docs shipped (ARCHITECTURE far-field section, DEBUGGING
  `__dbg.horizon` reference, perf-pooling "instance-owned pools" pattern,
  gates + baselines records under `verification/`); ROADMAP far-field bullet
  narrowed to "shipped behind flag, promotion pending" with the Wook Trip
  bullet preserved; README front door + status synced. Process audit: no
  task-created browser/GPU processes remain (verify-headless closes its
  Chromium per run); the dev server was stopped at session end. Remaining
  open: **5.2** (captures all taken with clean consoles + pixel-diff evidence;
  the final screenshot eyeball was blocked by a host-side tool outage that
  killed image reads late in the session — shots staged in
  `.claude/captures/g5-shots/` for review) and **5.5 / 6.2 final form**
  (blocked on -> Q1, Gary's promotion sign-off per D11). Default remains OFF.
- **Refs:** -> Q1, -> Tasks 5.2/5.5/6.1-6.3, `.claude/captures/g5-shots/`
