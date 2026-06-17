# Deliberation Summary — Procedural Map Generator

## Context
- **Task**: Stress-test (pre-implementation) the `procedural-map-generator`
  OpenSpec change — a deterministic, render-agnostic infinite-world *layout
  generator* (`src/worldgen/`) plus a dedicated **2D top-down Canvas sandbox**
  (`map-sandbox.html`) to develop and tune it. All 3D-game integration is
  explicitly deferred to a later change. Goal: surface tensions, validate or
  break the key design decisions (D1–D11), and produce unified Change Groups to
  fold back into `tasks.md`.
- **Personas Consulted**: Architect, Adversary, Maverick, Pragmatist,
  Anthropologist + Mediator. (Profiler + Auditor deselected for fit — Canvas-2D /
  no-three.js → low perf risk; no-build + CHANGELOG hygiene already in tasks.md.
  Architect absorbed module-boundary/hygiene; Pragmatist absorbed
  effort/critical-path + generator per-pixel cost.)
- **Date**: 2026-06-06
- **Verdict (all five)**: Proceed with mitigations. No persona blocked. The
  architecture (D1 render-agnostic pure module, D2 Canvas-2D, D3 central-place
  hearts, D4 edge/pair-seeding-not-forward-passing) is endorsed across the board.
  All friction is **scope, sequencing, contract-completeness, and
  determinism-proof rigor** — not architecture.

---

## Synthesized Plan

The plan reorganizes the existing 10-section `tasks.md` into **five Change
Groups** built around two hard gates that all five personas converged on. The
core insight: this is *one prototype change with a fat tail*, and the tail
(rivers §8, the mega 2×2 §2.2, footpaths §4.3, the empirical road-radius loop)
is where effort and determinism risk concentrate — downstream of an *unproven*
premise (does the heart field read as a festival, not a lattice?).

**Tripwire override applied up front:** Determinism (CLAUDE.md footgun #4) is the
cardinal constraint and it overrides every convenience argument below. Where the
Maverick's "go fast / minimal verification" instinct and the Adversary's
"prove-it-before-you-build-it" instinct collide, **determinism wins** — but the
Adversary's specific proofs are *retargeted to the layers being kept*, so rigor
doesn't gate throwaway work (the Pragmatist's timing point).

### Change Group 1: Contract + Determinism Foundation (do this on paper/stub FIRST)
**Scope**: Lock the output data contract and the *real* determinism primitives
and harness before any feature layer is written. This is the Architect's "lock
the tuple before building layers" and the Adversary's "prove the unhappy path on
a stub" merged. Rewrites tasks §1; pulls forward the teeth of §9.
**Estimated Effort**: ~1 day (mostly thinking + a known-pattern lift, not a sprint).
**Tasks**:
1. **(NEW, ahead of 1.1) Lock the `queryPoint` tuple + `queryRegion` feature
   contract as a written spec, with the 3D-port-survival fields present from day
   one** — `facing` (radians; the "stages-face-road" fix has no data without it),
   `noBuild` (composite inLake||onRiver||road-corridor), `footprint` (suggested
   clear-radius), a per-feature `lifecycle` tag (`persistent` = no chunkKey, like
   lakes / vs chunk-class props), and a **reserved** `groundY` (document
   "flat: always 0" — `rng.js terrainHeight()` returns 0 today; reserving is free,
   retrofitting is not). River-shaped fields (`onRiver`/`bridge`) stay in the
   contract as **always-false stubs** even though the river *layer* is cut (see
   CG5) — cut the layer, keep the contract slot. Make the contract **append-only**
   across the 2D→3D boundary (3D port may add fields, never reorder/re-salt the
   draws that produce existing ones).
2. **(REWRITE 1.2) Add `cellHash`/`edgeHash`/`pairHash` as thin wrappers on
   `hash2`/`worldHash`/`mulberry32`** — prefer adding them to `rng.js` next to
   `chunkRng` (NOT a forked `worldgen/hash.js` with its own mixing constants — one
   determinism regime, footgun #4). Use **fresh salt offsets**; do NOT reuse
   lakes' `*17+91` or forests' `*73+13` literals (would spatially correlate hearts
   with existing lakes/forests).
3. **(NEW, hard rule) Integer-quantize every value before it reaches a hash input
   or a `<`/`===` threshold.** `Math.sin/cos/atan2/hypot/pow` are NOT bit-identical
   across V8 / JavaScriptCore (Safari) / SpiderMonkey — ECMA-262 permits
   implementation-defined results. Transcendental low-bits must never cross a
   quantize→hash or threshold boundary, or the layout forks per-engine (the
   sandbox-pass≠game-pass trap at world scale). Canonicalize edge ids as
   `(min(a,b), max(a,b))` so both sides hash identically.
4. **(NEW) Sort any candidate set (proximity graph, blue-noise accept/reject) by a
   total order — distance, then an integer-cell-id tiebreaker — never Map/object
   iteration order.** Insertion order is a hidden input on ties / "first-K" cuts.
5. **(REWRITE 1.3 + pull teeth from §9) Build the determinism harness with real
   teeth, not theater.** "Query twice in two orders, assert identical" proves
   nothing — `queryPoint` is already pure. The harness must assert: (a)
   **window-invariance** — same world point, different neighborhood-window origin
   AND size → identical tuple, **plus a negative control** (a window one cell
   smaller must FAIL, proving the bound is tight); (b) **boundary agreement to the
   exact bit** for a constructed region-seam crossing (no epsilon — epsilon hides
   the quantize-boundary fork); (c) **serialize→reparse round-trip** (catches `-0`
   vs `0`, NaN, float-formatting drift); (d) a **checked-in cross-engine golden
   hash** of N tuples × M seeds the future 3D port re-computes on Safari/Firefox.
6. **(NEW) Route the sandbox seed through `setSessionSeed()`** (the same door the
   live game uses from `?seed=`), echoing back the resolved 32-bit int. Do NOT add
   a parallel private seed parameter threaded through `queryPoint` — `worldHash`
   folds the module-global `SESSION_SEED`, and a parallel path means sandbox-tuned
   maps won't reproduce in the 3D game under the same seed, and the §9 self-test
   (generator vs itself) won't catch it.
7. **(NEW) `worldgen/constants.js`** — a single named-constant surface (heart cell
   size, rank weights, jitter, domain radii, road-neighborhood radius) imported by
   every layer, so the D9 multi-knob tuning loop and the session-log capture of
   chosen values stay coherent.

### Change Group 2: GATE 1 — Hearts + Minimal Sandbox Shell ("real, not a lattice")
**Scope**: The make-or-break knob and the *minimum* viewer needed to judge it by
eye. This is the kill-switch. Merges the Maverick/Pragmatist "two-gate"
reframing with the Anthropologist's harness-affordances. Reorders tasks §2 + §3;
interleaves the empty canvas with the hearts math.
**Estimated Effort**: ~1.5 days (heart field is a lakes.js copy-adapt; shell
affordances are sandbox.html lifts).
**Tasks**:
1. **(REORDER) Stand up the empty `map-sandbox.html` (3.1/3.2) in parallel with
   the hearts math (2.1–2.3)** — blank Canvas-2D, pan/zoom across kilometers,
   coordinate grid only. "Build the harness, then the feature" (CLAUDE.md). You
   cannot eyeball a heart field with no canvas; the harness is step 0-and-3, not
   step 3.
2. **(2.1, 2.3) `hearts.js`: coarse macrocell, jittered candidate, rank roll
   (minor/major only — see CG5 for the mega cut), `nearestHeart(seed,x,z)` over a
   bounded neighborhood.** Decide the neighborhood-search radius convention ONCE
   here and reuse it for the road graph in CG3 (two "how far do I look" constants
   in two files = two contracts at integration).
3. **(REQUIRED harness, §3.1) Preview-MCP keep-alive** — `if (document.hidden)
   setTimeout(tick,16); else requestAnimationFrame(tick)` (lift verbatim from
   `sandbox.html:2363-2367`), OR commit to a pure event-driven redraw with an
   explicitly-reachable "draw a frame for preview" path. Record the decision. Bare
   RAF freezes under the preview MCP (`document.hidden`) and the agent screenshots
   a blank canvas.
4. **(REQUIRED harness, §3.2) Deep-linkable camera state** — `?seed=&cx=&cz=&zoom=&layers=`
   + `replaceState` on view-change (mirror `sandbox.html:2113`). A bug at
   (12400,-8800) zoom 0.02 is worthless to report if the next agent can't navigate
   back to it.
5. **(REQUIRED harness, §3.1) `window.__mapSandbox = { seed, view, queryPoint,
   setView, runSelfTest }`** introspection handle for `preview_eval` (mirror
   `window.__sandbox`, `sandbox.html:719`) — so an agent scripts "seed 7, jump to
   (5000,5000), query, screenshot" in one eval instead of synthesizing mouse drags.
6. **(§3.2, per-pixel cost) Draw features as features, sample fields coarsely** —
   draw hearts/arterials/lakes from their dot/polyline/polygon representations
   directly; reserve per-pixel `queryPoint` sampling for the density field only,
   on a coarse grid (~1 query per 8–16 screen px) with Canvas interpolation. An
   explicit checkbox so per-pixel jank is handled by design, not discovered later.
7. **(§3.3) On-screen determinism toggle** that runs the CG1 harness and reports
   **WHERE it failed** (offending coordinate + diverging field + the two values),
   not just red/green. The 2D analog of the backtick budget HUD.
8. **(GATE — §3.4, kill-switch, NOT a same-weight checkbox) Zoom out to
   kilometers, tune rarity/jitter/rank-weights until it reads as geography, not a
   grid. Capture constants in session-log.** If a jittered macrocell grid can't
   escape the lattice, prototype **deterministic blue-noise / Poisson-disc heart
   placement** (Maverick Alternative A — same order-independence subtlety as the
   proximity graph, mitigated the same way; attacks the lattice *by construction*).
   **If hearts can't escape the lattice with either approach, STOP — pivot or kill
   before building a single road.**

### Change Group 3: GATE 2 — Arterials + Off-Road Anchoring (MVP festival map)
**Scope**: "Roads that lead somewhere" + the structural fix for the
stages-on-roads bug. The Maverick's "hearts + arterials = ~80% of the delight"
plus the second reason this change exists. Reorders: lakes BEFORE road routing
(per D10), roles' off-road anchor pulled into the core, footpaths/collectors
parked. Rewrites §4/§5 ordering; promotes §7.1/§7.2.
**Estimated Effort**: ~2 days (the proximity-graph radius is a *research* loop,
budget for iteration).
**Tasks**:
1. **(FIX ORDER — §5 before §4 routing) Implement `water.js` lakes
   (`lakeAt(seed,x,z)`) before road *routing*** — D10 says hearts → water → roads
   so roads route around water. tasks.md §4-before-§5 inverts the `roads→water`
   DAG edge. The road *connection graph* (which hearts pair up) can be prototyped
   against hearts-only first; the *meander routing* needs `lakeAt()`.
2. **(§4.1, before coding) Derive the proximity-graph lookup radius as a MATH
   BOUND, not "generous + eyeballed."** Cap edges at "nearest few neighbors,"
   then `ROAD_NEIGHBORHOOD_R = ceil(maxEdgeLen/HEART_CELL) + jitterPad`. "Verify
   empirically" cannot prove the *negative* (no farther config breaks it) — the
   sandbox can bless 100 seeds and fork on the 101st player seed. Concrete failure:
   two minor hearts RNG-connected, a major heart C in the lens 2.1 cells away; a
   2-cell window near A draws the arterial, a 2-cell window at the A–B midpoint
   sees C and suppresses it — same world point, two answers.
3. **(§4.1/§4.2) Arterials: proximity graph (candidates total-ordered per CG1),
   endpoint-pair-hash-seeded meander, perpendicular region-seam crossing.** Verify
   continuity across seams as you pan (no kinks).
4. **(§9.2, run NOW not at the end) Proximity-graph window-invariance check at the
   derived radius AND one cell smaller (the smaller MUST fail).** This is the real
   D6 test; fire it the moment roads land, on top of the CG1 harness.
5. **(§7.1) `roles.js` off-road, road-facing anchor** — offset a placement *off*
   the nearest road and `facing` it. Structurally kills the stages-on-roads bug
   (tent stage currently placed *at* chunk center on the path intersection). High
   payoff, cheap once hearts+roads exist. Populates the `facing` field from CG1.
6. **(§7.2) Point inspector** (click/hover → full tuple: nearest-heart+rank, role,
   road state+tier, water state, density). The debugging multiplier — makes every
   later layer verifiable in one click; lands here, not at the end.

### Change Group 4: Field Layers — Density + Roles Overlay + Acceptance Sweep
**Scope**: The field fills in; verify at scale. Tasks §6, §7.3, the broad §9 sweep.
**Estimated Effort**: ~1.5 days.
**Tasks**:
1. **(§6.1/§6.2) `density.js` continuous field** = woodland-noise − heart-core
   clearing − water/road footprint; render as coarse-sampled shading. Confirm it
   clears near hearts, rises in outskirts. Continuous by design (D8) — good.
2. **(§7.3) Role-tier overlay** (toggle). Lower priority than §7.1/§7.2 — park if
   time-pressed; roles are inspectable per-point without it.
3. **(PLAYER-FEEL probe, NEW) Player-scale traversal / drive-time ruler** — sample
   the tuple along a line between two hearts, show what you'd pass (road / open /
   forest / nothing). "Looks like geography from 2km up" and "is fun to drive at
   boost" are different questions; the macro view answers only the first. Ties to
   Q1's "drive time at boost" framing. The new failure mode is
   monotony-from-emptiness (dead air), discovered at the worst time (3D
   integration) without this. (Anthropologist priority; Pragmatist concedes it as
   a fast-follow if critical path is at risk — keep it in this CG or ROADMAP it
   explicitly, don't forget it.)
4. **(§9.1/§9.3, full sweep) Run the CG1 harness across many points/seeds; assert
   byte-identical; boundary-agreement check; confirm the generator imports with no
   `three`/DOM** (the structural proof D1's data-only boundary is real — no
   `import * as THREE`, no `THREE.Vector3`; use plain `{x,z}`).

### Change Group 5: Cuts, Spec Edits & Docs
**Scope**: Park the high-cost / low-delight / hardest-to-prove slices in the SPEC
(as the target) while cutting them from this implementation; document the harness.
**Estimated Effort**: ~0.5 day.
**Tasks**:
1. **(CUT from implementation, KEEP in spec) Rivers + bridges (§8 entirely).**
   Four-way determinism consensus to cut: highest coupling, hardest determinism
   (river-around-heart avoidance can depend on a mid-span heart *outside* the local
   window → non-deterministically violates the spec's own "rivers SHALL never pass
   through a heart core"; bridge = road×river is a float root-find compounding all
   the transcendental hazards). In 2D the payoff is "a blue squiggle" — the wow is
   a 3D thing (driving over a bridge), and 3D is out of scope. **The river-shaped
   contract fields stay (always-false stubs, per CG1.1).** Move the spec's "Lakes
   and rivers" river clauses + "Bridges" to a follow-up change; ROADMAP it.
2. **(CUT from implementation, KEEP in spec) Mega-heart rank + 2×2 suppression
   (§2.2).** Ship `minor/major` only this change. The 2×2 is the one place clean
   one-feature-per-cell determinism gets a multi-cell consensus special-case
   (three cells must order-independently know they're inside a mega's claim and
   yield) — exactly where order-dependence sneaks back in, and you can't *feel*
   bigness in a canvas of dots. Domain radius already scales with rank, so "major"
   gives hierarchy. Defer to the 3D-integration change where bigness lands and the
   suppression can be validated against real chunk lifecycle. Rank weight table is
   one constant — costs nothing to add later.
3. **(PARK on ROADMAP) Collector + footpath tiers (§4.3)** — gated on the
   unanswered Q2 (footpath density). Arterials alone prove the road-hierarchy
   concept. **(PARK) Role-overlay polish (§7.3 beyond a first pass), density
   shading polish (§6.2 beyond a first pass)** — tuning, not proof.
4. **(§10.1) CHANGELOG** — the new dev-workflow surface (`map-sandbox.html`
   generator + 2D viewer) under today's date, in the same commit as the work.
5. **(§10.2) ROADMAP** the three named follow-ups phrased as the v2-worldgen
   **replacement** (it RETIRES lakes.js/forests.js placement — not an *additive*
   fourth water system), the in-game map view (Q3), and rivers-in-3D — plus the
   river layer + mega-rank cut from CG5.1/CG5.2, the traversal-probe + continuous-
   influence scalar if not built, and the future-port reminder that every
   `src/worldgen/*` module must be added to BOTH `index.html` AND `sandbox.html`
   importmap arrays at wire-in time.
6. **(§10.3) `src/worldgen/README` (or `index.js` header) with a "How to look at
   it" Verify section** — the map-sandbox URL + param contract, the self-test
   button, the `window.__mapSandbox` handle, which layer to toggle for which
   symptom; the layered pipeline; the determinism contract; the single-source-of-
   truth intent. Plus a one-line addition to CLAUDE.md / DEBUGGING verify table
   distinguishing "entity sandbox = one model in 3D" from "map sandbox = whole
   world layout in 2D top-down" (two near-identically-named pages = cognitive-load
   snag).
7. **(DATA-MODEL carry-forward, NEW) Carry a continuous "nearest-heart influence"
   scalar in the tuple now** (not just a discrete core/district/outskirts label +
   hard radius), so the eventual 3D arrival-ramp and the map view's shading (Q3)
   are a *read*, not a re-derivation. Same continuity thinking as the D8 density
   field. Cheapest possible Q3 insurance.

## Final Recommendation
**Proceed with mitigations.** Implement in Change Group order: lock the contract +
real determinism harness (CG1) before any layer, then run the two hard gates
(CG2 hearts, CG3 arterials+off-road anchor) as kill-switches before committing to
the field layers (CG4). Cut rivers and the mega 2×2 from *this* implementation
(keep them in the spec + contract stubs), and park footpaths/overlay polish. The
architecture is sound and the scope cut is exactly what lets the change ship its
reason-for-existing — a lookable, tunable, deterministic, contract-complete
heart+road+role skeleton — without being held hostage by its hardest, most-
coupled, least-demonstrable layer.

---

## Convergence Points
- **All five: Proceed with mitigations.** No blocks. The core architecture
  (D1 render-agnostic pure module, D2 Canvas-2D-not-three.js, D3 central-place
  hearts, D4 edge/pair-seeding rejecting forward-passing, D11 module split) is
  endorsed unanimously. Canvas-2D over three.js-ortho drew explicit praise (sidesteps
  threeShim/material-tier/shadow-budget tripwires for zero gain) — "no notes."
- **All five: hearts (§2) + the minimal viewer is the critical path; everything
  else is downstream.** The make-or-break knob (D9) is heart distribution.
- **Four (Maverick, Pragmatist, Architect, Anthropologist): the harness/empty
  canvas must come BEFORE or BESIDE hearts**, not after (the §2-then-§3 task order
  is backwards). "Build the harness, then the feature."
- **Four (Maverick, Pragmatist, Adversary, Architect): rivers + bridges (§8) are
  the cut/defer candidate** — hardest, most-coupled, lowest 2D-delight, last in
  the plan's own order for good reason.
- **All five: §3.4 (eyeball the macro distribution) is a GO/NO-GO GATE, not a
  same-weight checkbox** — it decides whether the next 6 sections are worth writing.
- **Three (Architect, Adversary, Pragmatist): §1.3 "query twice in two orders"
  proves nothing** — `queryPoint` is already pure. The self-test needs real teeth.
- **Three (Architect, Maverick, Anthropologist): the data model must carry what
  the 3D port needs now** (facing/angle, footprint, lifecycle, influence scalar) —
  "render-agnostic means doesn't render, not doesn't anticipate what renderers need."
- **All five: reuse `rng.js`, don't fork the seeding scheme** (footgun #4). The
  macrocell+jitter pattern (lakes.js / forests.js) is the recognized house pattern
  to copy-adapt.
- **The mega 2×2 (§2.2) is flagged as a determinism hot-spot by three** (Maverick,
  Pragmatist, Adversary) — Maverick + the synthesis cut it; Pragmatist + Adversary
  flag it as the one spot determinism sneaks into the "easy" heart layer.

## Conflicts Resolved
| Conflict | Position A | Position B | Resolution | Rationale |
| -------- | ---------- | ---------- | ---------- | --------- |
| **Cut rivers/bridges from this change?** | Maverick / Pragmatist / Adversary: cut entirely (defer even 2D work) | Architect: cut the *layer*, keep the contract slot; design.md Q4 default = "in scope, built last" | **CUT the layer, KEEP the contract stub fields (`onRiver`/`bridge`/`noBuild`).** | 4-of-5 cut consensus; the river-around-heart-over-infinite-plane determinism bug is *fully present in 2D* and is the single hardest thing, with 2D payoff of "a blue squiggle." But the Architect is right that the contract must stay stable — so cut the *implementation*, not the *contract slot*. Tripwire-driven: rivers' avoidance can non-deterministically violate the spec's own "never through a heart core." |
| **Cut the mega-heart 2×2?** | Maverick: cut (gimmick in 2D — can't feel bigness in dots; gnarliest determinism special-case) | Architect/Pragmatist/Adversary: flag it as a determinism hot-spot to *prove*, don't necessarily cut | **CUT from this implementation (minor/major only); keep in spec for the 3D change.** | Cutting risk beats proving risk when the feature isn't earning its place — the payoff (driving into a huge hub) is a deferred-3D thing, and removing the one multi-cell-consensus special-case keeps the make-or-break gate's seeding model maximally clean. Rank table is one constant; trivially re-addable. Determinism tripwire tips the tie toward the cut. |
| **Headless asserts vs in-sandbox UI for determinism verification** | Maverick: headless `selftest.js`, zero pixels — math needs no UI | Anthropologist: rigor must live in the sandbox UI where the tuning loop happens, or it won't get run | **BOTH — a shared harness, surfaced two ways.** The teeth (window-invariance + negative control + bit-exact boundary + round-trip + cross-engine golden hash) live in a re-runnable module; an on-screen one-click toggle runs it and **localizes the failure** (coordinate + field + the two values). | Genuine synthesis, not a tiebreak: the math doesn't need pixels to *run*, but the regressions are *born* in the tight tuning loop, so the same assertions must be glanceable like the backtick budget HUD. Legible failure is the Anthropologist's version of the Adversary's rigor. |
| **Lock the full data contract first vs. don't over-build for an imaginary 3D consumer** | Architect: lock the tuple (incl. facing/noBuild/footprint/lifecycle/groundY) BEFORE building layers — it IS the deliverable | Pragmatist: you can't know 3D-port fields until a 3D port exists; speccing now is guessing; keep it an extensible plain object | **Lock the contract first, but only the fields with a *named present consumer or a known codebase lesson*.** facing (the §7.1 anchor consumes it THIS change), lifecycle (the lakes chunkKey lesson — designed-in now because the 2D sandbox literally can't surface it), noBuild/footprint (the placer's one question), groundY reserved+documented. NOT speculative 3D-only fields. | The Architect is right that the contract is the deliverable (D1) and a wrong shape forces a 3D rewrite — *but* the Pragmatist's guard against speccing for an imaginary consumer is honored by gating each field on a concrete justification. facing has a consumer *in this change*; lifecycle encodes a lesson the codebase already paid for. Both pass. Pure guesses don't. |
| **Front-load adversarial determinism rigor vs. don't gate the eyeball behind an exhaustive sweep** | Adversary: derive the radius bound, build window-invariance + negative-control + cross-engine canary BEFORE building hearts | Pragmatist: don't gate Slice-1 GO/NO-GO behind an exhaustive sweep; harden what you keep, not what you might throw away | **Front-load the *harness construction* and the *per-layer* invariance check (CG1 + run at each gate); defer the *broad multi-seed sweep* (§9 at scale) to CG4.** | The harness is cheap (a lift of the proven perf-pass-4 byte-identical pattern, not net-new) so building it early costs little and prevents tuning the make-or-break knob on an unproven `nearestHeart` window. But running it exhaustively across many seeds is a Slice-3/CG4 activity — "harden what you've decided to keep." Determinism tripwire keeps the *harness* early; pragmatism defers the *scale*. |
| **Blue-noise hearts vs jittered macrocell grid** | Maverick: prototype deterministic blue-noise — jitter softens the lattice, doesn't escape it | (implicit plan): jittered macrocell + rank variation | **Try jittered grid first (simplest); if rows show at zoom-out, blue-noise is the escape (prototype both in the §3.4 gate, pick by eye).** Not mandatory. | Pragmatist flags blue-noise as added critical-path risk; Maverick frames it as "prototype both, pick by eye." Blue-noise carries the *same* (not a new) order-independence subtlety as the proximity graph, mitigated the same way — so it's a safe fallback if the gate fails, not a required up-front bet. |
| **§4/§5 task ordering** | tasks.md: roads (§4) → lakes (§5) | design.md D10: hearts → water → roads | **Build lakes (`lakeAt`) before road *routing*; the road connection *graph* can sketch against hearts-only first.** | Pure internal inconsistency (Architect caught it). The DAG edge is `roads→water` (roads route around water). The graph doesn't need water; the meander routing does. |

## Risk Register
| Risk | Severity | Mitigation | Owner |
| ---- | -------- | ---------- | ----- |
| **`nearestHeart` window truncation → wrong-but-stable answer** (locally stable, globally inconsistent; every downstream layer inherits the disagreement) | **CRITICAL** | Prove the window bound against jitter (+ mega if kept) immediately after hearts; window-invariance test with a negative control (one-cell-smaller window must FAIL). Not caught by "query twice" (a point always truncates the same way). | Adversary |
| **River-around-heart avoidance depends on hearts OUTSIDE the local window** → non-deterministically violates spec's "rivers SHALL never pass through a heart core" | **CRITICAL** (river layer) | **Cut the river layer from this change** (keep contract stubs). Resolves the risk by removal. If ever un-cut, gate behind a river×heart window-invariance test §9 does not currently contain. | Adversary |
| **`Math` transcendental divergence across engines** (sin/cos/atan2/hypot NOT bit-identical V8 vs Safari vs Firefox) — invisible in a single-engine sandbox; the sandbox-pass≠game-pass trap at world scale | **HIGH** | Hard rule (CG1.3): integer-quantize before every hash/threshold so low-bits never fork the layout. Checked-in cross-engine golden hash the 3D port re-computes on target browsers. | Adversary |
| **"Generous + eyeballed" road lookup radius is a latent ship-blocker** — empirical verification can't prove the negative; forks a road across a seam on an untested seed | **HIGH** | Derive `ROAD_NEIGHBORHOOD_R = ceil(maxEdgeLen/HEART_CELL)+jitterPad` from the edge-length cap; §9.2 asserts agreement at that radius AND one smaller (smaller must fail). | Adversary |
| **Float non-associativity in meander summation** at seams (different `t0`/walk direction → last-ULP diff crosses a quantize boundary) | **HIGH** | Quantize sample params to integers; assert boundary agreement **to the exact bit** (no epsilon — epsilon hides the fork). | Adversary |
| **Data contract finalized too late (§7.2) / omits 3D-port fields** → 2D detour produces something the 3D port must rewrite (violates D1's whole point) | **HIGH** | Lock contract first (CG1.1) with facing/noBuild/footprint/lifecycle + reserved groundY; append-only across the 2D→3D boundary. | Architect |
| **chunkKey lifecycle absent from the data model** — macrocell features (hearts/arterials/rivers) registered with a chunkKey vanish when a host chunk unloads (the lakes lesson); the 2D sandbox CANNOT surface this | **HIGH** | Per-feature `lifecycle:'persistent'` tag in `queryRegion`, designed-in on paper now; lake feature shape carries `outline` matching lakes.js's registered shape for verbatim perimeter-sealing reuse. | Architect |
| **§1.3/§9 self-test is theater** — "query twice in two orders" proves only purity; will be cited as "determinism proven" when it has proven nothing | **HIGH** | Rewrite with real teeth (window-invariance + negative control + bit-exact boundary + serialize-round-trip + cross-engine golden hash) — CG1.5. | Adversary |
| **6 layers built downstream of an UNPROVEN premise** (heart field reads as a lattice) → river/bridge/density/role/mega budget spent before learning hearts fail | **HIGH** | §3.4 is a hard kill-switch GATE (CG2.8), not a checkbox; blue-noise fallback if jitter can't escape the lattice; STOP before roads if it can't. | Maverick |
| **Player-feel: sparsity reads as DEAD AIR** (monotony-from-emptiness) — the macro view answers "looks like geography" but not "fun to drive at boost"; discovered at the worst time (3D integration) | **MEDIUM** | Player-scale traversal / drive-time probe in the sandbox (CG4.3); ties to Q1's "drive time at boost." | Anthropologist |
| **`?seed` reproducibility forks** — sandbox parses URL seed as Number, game passes raw string (or vice-versa) → same visible seed, two `SESSION_SEED`s, two maps | **MEDIUM** | Route sandbox seed through the identical `setSessionSeed` path; echo back the resolved 32-bit int (CG1.6). | Adversary |
| **Forked seeding scheme** — a `worldgen/hash.js` with its own mixing constants = two determinism regimes forever | **MEDIUM** | `cellHash`/`edgeHash`/`pairHash` as thin wrappers on `hash2`/`worldHash`, prefer adding to `rng.js`; fresh salt offsets (not lakes'/forests' literals). | Architect |
| **Mega 2×2 suppression order-dependence** — three cells must order-independently know they're inside a mega's claim and yield | **MEDIUM** | **Cut the mega from this change** (CG5.2); minor/major only. Resolves by removal. | Maverick / Pragmatist |
| **JS Map/object iteration order leaks into proximity-graph "nearest few" / tie cuts** | **MEDIUM** | Sort candidates by a total order (distance, then integer-cell-id tiebreaker); never rely on Map iteration order (CG1.4). | Adversary |
| **Preview-MCP keep-alive missing** — bare RAF freezes under `document.hidden`; agent screenshots a blank canvas and blames the generator | **MEDIUM** | `document.hidden → setTimeout(tick,16)` (lift sandbox.html:2363-2367) OR explicit event-driven redraw with a preview-reachable draw path; record the decision (CG2.3). | Anthropologist |
| **Per-pixel generator cost** — naive `for each pixel: queryPoint()` over a zoomed-out km view janks | **MEDIUM** | Draw features as features; sample fields coarsely (~1 query / 8–16 px) with Canvas interpolation (CG2.6, explicit checkbox). | Pragmatist |
| **No re-openable macro view** — agent can't navigate back to a bug at a specific coordinate/zoom | **MEDIUM** | `?seed=&cx=&cz=&zoom=&layers=` + `replaceState` on view-change (CG2.4). | Anthropologist |
| **No `preview_eval` introspection handle** — agent stuck synthesizing pan/zoom mouse events the MCP handles poorly | **LOW** | `window.__mapSandbox = { seed, view, queryPoint, setView, runSelfTest }` (CG2.5). | Anthropologist |
| **Bare red/green self-test failure** — determinism bug the agent can't localize is one that ships | **LOW** | Report offending coordinate + diverging field + the two values (CG2.7). | Anthropologist |
| **v2-worldgen wired in *additively* instead of as a replacement** → generator's rivers AND lakes.js's lakes both own water | **LOW** (future change) | Migration plan + ROADMAP phrase the follow-up as a REPLACEMENT that retires lakes.js/forests.js placement (CG5.5). | Architect |
| **Two near-identical sandbox pages** (`sandbox.html` 3D vs `map-sandbox.html` 2D) → cognitive-load confusion | **LOW** | One-line CLAUDE.md/DEBUGGING verify-table distinction + README clarity (CG5.6). | Anthropologist |

**Critical risks: 2** (`nearestHeart` window truncation; river-around-heart
non-determinism — the latter resolved by the river-layer cut). Both are the
determinism cardinal sin (footgun #4) wearing different disguises; both are
addressed by CG1's hardened harness + CG5's river cut.

## Verdicts Summary
| Persona | Key Concern | Verdict |
| ------- | ----------- | ------- |
| Architect | Data-tuple/feature-output contract (the real deliverable) finalized too late (§7.2) and omits facing / noBuild+footprint / per-feature lifecycle (the lakes chunkKey lesson) / reserved groundY | Proceed with mitigations |
| Adversary | Determinism holds at the *seeding* layer (D4) but is unproven at the *numeric/windowing* layer; the §1.3/§9 "query twice" self-test is theater because `queryPoint` is already pure | Proceed with mitigations |
| Maverick | A 10-section waterfall builds 6 layers downstream of an unproven premise; §3.4 must be a hard kill-switch gate; rivers + mega 2×2 are lowest-delight/highest-complexity/hardest-to-prove | Proceed with mitigations |
| Pragmatist | Clean low-risk core but a deceptively expensive tail (rivers §8, the empirical road-radius loop); risk is the timeline eaten gold-plating a prototype after the question is answered | Proceed with mitigations |
| Anthropologist | The sandbox IS the deliverable and has unstated agent-experience gaps the 3D sandbox.html already solves (keep-alive, deep-link state, `__mapSandbox` handle, legible self-test failure); plus the dead-air player-feel risk | Proceed with mitigations |
