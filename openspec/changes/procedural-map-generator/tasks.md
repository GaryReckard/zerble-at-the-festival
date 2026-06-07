<!--
Reorganized 2026-06-06 from the original 10-section plan into the 5 Change Groups
synthesized by the Tier-3 council (deliberations/001-initial/results.md).
Decisions folded in: Q4 = cut rivers + mega from THIS change (keep in spec + contract
stubs); Q1 = build the tuner, medium default, decide spacing by eye at GATE 1.
Order is the implementation order: CG1 → GATE 1 → GATE 2 → CG4 → CG5.
-->

## 1. CG1 — Contract + Determinism Foundation (on a stub, FIRST)

- [x] 1.1 Lock the `queryPoint(seed,x,z)` tuple + `queryRegion(seed,bounds)` feature contract as a written spec, with 3D-port-survival fields present from day one: `facing` (radians — the §3.x off-road anchor consumes it THIS change), `noBuild` (composite: inLake || onRiver || road-corridor), `footprint` (suggested clear-radius), per-feature `lifecycle` tag (`persistent` = no chunkKey like lakes / vs chunk-class), reserved+documented `groundY` (flat: always 0 today), and a continuous `heartInfluence` scalar (CG5.7, cheap map-view/3D-ramp insurance). River-shaped fields `onRiver`/`bridge` stay as always-false stubs (layer cut, contract slot kept). Contract is append-only across the 2D→3D boundary.
- [x] 1.2 Add `cellHash` / `edgeHash` / `pairHash` as thin wrappers on `hash2`/`worldHash`/`mulberry32` in `rng.js` (one determinism regime — do NOT fork a `worldgen/hash.js` with its own mixing constants). Use fresh salt offsets; do NOT reuse lakes' or forests' salt literals (would spatially correlate hearts with existing water/woods).
- [x] 1.3 Hard rule: integer-quantize every value before it reaches a hash input or a `<`/`===` threshold (`Math.sin/cos/atan2/hypot/pow` are NOT bit-identical across V8 / JavaScriptCore / SpiderMonkey). Canonicalize edge ids as `(min(a,b), max(a,b))` so both sides hash identically. Add a `quantize()` helper.
- [x] 1.4 Sort any candidate set (proximity graph, blue-noise accept/reject) by a total order — distance, then an integer cell-id tiebreaker — never Map/object iteration order.
- [x] 1.5 Build the determinism harness with real teeth (NOT "query twice in two orders" — `queryPoint` is already pure). Assert: (a) window-invariance — same point, different neighborhood window origin AND size → identical tuple, PLUS a negative control (a window one cell smaller MUST fail); (b) boundary agreement to the exact bit for a constructed region-seam crossing (no epsilon); (c) serialize→reparse round-trip (catches -0/NaN/format drift); (d) a checked-in cross-engine golden hash of N tuples × M seeds the future 3D port re-computes on Safari/Firefox.
- [x] 1.6 Route the sandbox seed through `setSessionSeed()` (the same door `?seed=` uses); echo the resolved 32-bit int. NO parallel private seed param through `queryPoint`.
- [x] 1.7 `src/worldgen/constants.js` — single named-constant surface (heart cell size, rank weights, jitter, domain radii, road-neighborhood radius) imported by every layer, so the GATE-1 multi-knob tuning loop + session-log capture stay coherent.

## 2. CG2 — GATE 1: Hearts + Minimal Sandbox Shell ("real, not a lattice")

- [x] 2.1 Stand up empty `map-sandbox.html` (Canvas 2D) IN PARALLEL with the hearts math — blank canvas, pan/zoom across kilometers, coordinate grid only. Register any new `src/` module in this page's cache-buster list (no-build rule).
- [x] 2.2 `worldgen/hearts.js`: coarse macrocell, jittered candidate, rank roll (**minor/major only** — mega cut, see CG5), `nearestHeart(seed,x,z)` over a bounded neighborhood. Decide the neighborhood-search-radius convention ONCE here; reuse it for roads (CG3).
- [x] 2.3 REQUIRED harness — preview-MCP keep-alive: `if (document.hidden) setTimeout(tick,16); else requestAnimationFrame(tick)` (lift from `sandbox.html:2363-2367`), OR a pure event-driven redraw with a preview-reachable draw path. Record the decision. (Bare RAF screenshots blank under the preview MCP.)
- [x] 2.4 REQUIRED harness — deep-linkable view state: `?seed=&cx=&cz=&zoom=&layers=` + `replaceState` on view change (mirror `sandbox.html:2113`).
- [x] 2.5 REQUIRED harness — `window.__mapSandbox = { seed, view, queryPoint, setView, runSelfTest }` introspection handle for `preview_eval` (mirror `window.__sandbox`).
- [x] 2.6 Per-pixel cost: draw features as features (dots/polylines/polygons direct); reserve per-pixel `queryPoint` sampling for the density field only, coarse grid (~1 query / 8–16 px) with Canvas interpolation.
- [x] 2.7 On-screen determinism toggle that runs the CG1 harness and reports WHERE it failed (offending coordinate + diverging field + the two values), not just red/green.
- [x] 2.8 **GATE 1 (kill-switch):** zoom out to kilometers, tune rarity/jitter/rank-weights (medium default per Q1) until it reads as geography, not a grid. Capture chosen constants in session-log. If a jittered macrocell grid can't escape the lattice, prototype deterministic blue-noise / Poisson-disc heart placement. **If hearts can't escape the lattice with either approach, STOP — pivot or kill before building a single road.**

## 3. CG3 — GATE 2: Arterials + Off-Road Anchoring (MVP festival map)

- [x] 3.1 FIX ORDER (D10): implement `worldgen/water.js` lakes (`lakeAt(seed,x,z)`) BEFORE road routing — roads route around water. (The road connection graph can sketch against hearts-only first; the meander routing needs `lakeAt()`.) Lake feature carries an `outline` matching `lakes.js`'s registered shape for future verbatim perimeter reuse.
- [x] 3.2 Derive the proximity-graph lookup radius as a MATH BOUND, not "generous + eyeballed": cap edges at "nearest few neighbors," then `ROAD_NEIGHBORHOOD_R = ceil(maxEdgeLen / HEART_CELL) + jitterPad`. (Empirical can't prove the negative.)
- [x] 3.3 `worldgen/roads.js` arterials: proximity graph (candidates total-ordered per 1.4), endpoint-pair-hash-seeded meander, perpendicular region-seam crossing. Verify continuity across seams while panning (no kinks). `roadAt(seed,x,z)` → on-road state + tier.
- [x] 3.4 Run the proximity-graph window-invariance check at the derived radius AND one cell smaller (the smaller MUST fail) — the real D6 test, fired the moment roads land, on top of the CG1 harness.
- [x] 3.5 `worldgen/roles.js` off-road, road-facing anchor — offset a placement OFF the nearest road and `facing` it (structurally kills the live stages-on-roads bug). Populates the `facing` field from 1.1.
- [x] 3.6 Point inspector in the sandbox (click/hover → full tuple: nearest-heart+rank, role, road state+tier, water state, density, influence).
- [x] 3.7 **GATE 2:** confirm "hearts + roads that lead somewhere + things set off the road" reads as a festival map. This is the MVP — ~80% of the delight.

## 4. CG4 — Field Layers: Density + Roles Overlay + Acceptance Sweep

- [x] 4.1 `worldgen/density.js` continuous field = woodland-noise − heart-core clearing − water/road footprint; render as coarse-sampled shading (toggle). Confirm it clears near hearts, rises in outskirts.
- [x] 4.2 Role-tier overlay (toggle). Lower priority — park if time-pressed (roles are inspectable per-point without it).
- [~] 4.3 (PARKED → ROADMAP) Player-scale traversal / drive-time ruler — sample the tuple along a line between two hearts; show what you'd pass (road / open / forest / nothing). Answers "fun to drive at boost," not just "looks like geography from 2km up." Ties to Q1's drive-time framing; guards the dead-air risk.
- [x] 4.4 Full determinism sweep: run the CG1 harness across many points/seeds; assert byte-identical; boundary-agreement; confirm the generator imports with NO `three`/DOM (the structural proof D1's data-only boundary is real — no `import * as THREE`, plain `{x,z}`).

## 5. CG5 — Cuts, Spec Edits & Docs

- [x] 5.1 CUT rivers + bridges from implementation (keep contract stubs `onRiver`/`bridge`/`noBuild` always-false; keep the spec clauses as the target). Move the spec's river/bridge requirements to a follow-up; ROADMAP them. (Per Q4.)
- [x] 5.2 CUT mega-heart rank + 2×2 suppression from implementation (minor/major only this change). Keep the mega in the spec as the target; the rank-weight table is one constant, trivially re-addable in the 3D change. (Per Q4.)
- [x] 5.3 PARK on ROADMAP: collector + footpath tiers (gated on Q2); role-overlay polish beyond a first pass; density-shading polish beyond a first pass.
- [x] 5.4 CHANGELOG: add the new dev-workflow surface (`map-sandbox.html` generator + 2D viewer) under today's date, same commit as the work.
- [x] 5.5 ROADMAP: the three named follow-ups phrased as the v2-worldgen REPLACEMENT (retires `lakes.js`/`forests.js` placement — not an additive 4th water system), the in-game map view (Q3), rivers-in-3D + mega-heart; plus the future-port reminder that every `src/worldgen/*` module must be added to BOTH `index.html` AND `sandbox.html` importmap arrays at wire-in time.
- [x] 5.6 `src/worldgen/README` (or `index.js` header) with a "How to look at it" Verify section (map-sandbox URL + param contract, self-test button, `window.__mapSandbox`, which layer to toggle for which symptom; the layered pipeline; the determinism contract; single-source-of-truth intent). Plus a one-line CLAUDE.md / DEBUGGING verify-table distinction: "entity sandbox = one model in 3D" vs "map sandbox = whole world layout in 2D top-down."
