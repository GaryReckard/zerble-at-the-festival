---
change: procedural-map-generator
status: complete       # 2D prototype done; 3D wire-in is a future change (not archived)
current_task: null
blocked_by: null
open_questions: 2          # Q1/Q4 answered; Q2 (footpaths) + Q3 (map view) parked
started: 2026-06-06
last_updated: 2026-06-06
ref: /opsx:explore thread "more sensible festival paths" (no CHANGELOG/ROADMAP entry yet)
---

# Session Log: Procedural Map Generator

> **AGENT DIRECTIVE:** New session / after compaction — read **`HANDOFF.md`
> first** (the consolidated catch-up doc), then this file's Current Status +
> latest Work Log entry, then `tasks.md`.

## Current Status
**Phase:** COMPLETE — full pipeline run: `/opsx:ff` → `/deliberate` (tier-3) →
`/opsx:apply` (CG1–CG5) → `/opsx:verify` → `/smart-review` (Approve; all fixes
applied + re-verified). The 2D prototype is done.
**Doing:** Nothing — back to Gary. Tunable live via the sandbox sliders.
Latest landing (2026-06-06): lake-heart roads converge on a single shore proxy +
route AROUND lakes (Gary's asks 1+2), and forests render as green tree-dots not a
wash (ask 3). See the newest Work Log entry + -> D-road-proxy.
**Next (future CHANGE, not this one):** wire the generator into the live 3D game as
v2 worldgen (ROADMAP). Optional: more by-eye tuning.
**Blocked:** Nothing. Not archived (the 3D wire-in is the next change). Rivers/mega/
drive-time-probe parked to ROADMAP; hearts may sit lakeside (Gary 2026-06-06).

### 2026-06-06 — Fix: on-lake hearts were orphaned (no roads)
**Intent:** Gary found on-lake hearts had zero roads (every arterial nulled by the
lake-crossing guard). His fix: connect roads to a dry proxy off the lake.
**Result:** Added `landingPoint(h, towardX, towardZ)` in roads.js — for a heart
in water, the road endpoint is a dry shore point reached by walking from the heart
TOWARD the connecting neighbor until clear of the lake (+25m margin), quantized.
arterialPolyline now uses each heart's landing on the shore facing the OTHER heart
(directional, per-edge), so a road always approaches from the neighbor's side and
never crosses water. Added `lakeContaining()` to water.js. Verified seed 1234:
**22/22 on-lake hearts now connected, 0 isolated** (was orphaning them); the
specific heart from the screenshot (8113,-8853) went 0 → 40 on-road points nearby
(nearest 180m). Self-test 20/20, golden 8c951da5.
**Known nuance (noted to Gary):** for a heart near a lake EDGE whose neighbor is
across the water, the road lands on the neighbor-facing shore (across the lake from
the dot), not hugging the stage's own shore. Connected ✓, but the landing can be on
the far shore. The polish — roads that ROUTE AROUND a lake to land on the heart's
own shore — is a future option (added to the candidate list).
**Changed:** src/worldgen/roads.js, water.js.

### 2026-06-06 — Gary feedback + HANDOFF.md (context-budget checkpoint)
**Intent:** Gary flagged context budget (~65%) and asked for a consolidated
handoff so a new session can continue without losing the thread. Plus 3 new
observations.
**Result:** Wrote `HANDOFF.md` (the new "read first" doc — origin, run/verify,
file map, decisions, done, prioritized open items, tripwires, artifact pointers).
Gary's 3 new items, captured as the top open priorities:
1. **Lake-heart road landing is wrong-shaped.** Current per-neighbor directional
   landings end at scattered edge points; Gary wants ONE convergence proxy on the
   lake edge representing the heart, with roads converging there — which requires
   route-around-the-lake routing (he said: work it out in 2D first). SUPERSEDES the
   current interim directional landing.
2. **Two hearts on opposite shores of a lake don't connect** — straight arterial
   crosses water → nulled (no bridges/routing yet). Same route-around fix.
3. **Forest viz illegible** — the green density wash means nothing to a human;
   render scattered green TREE-DOTS instead (sandbox-render change).
   (Confirmed to Gary: yes, forest GENERATION was reworked — organic gap-fill +
   lakeshore rings; the issue is only the viz, not the data.)
**Did NOT start** these — handed off intact per Gary's budget concern. Route-around
is now near-term (in 2D), not deferred to 3D.
**Changed:** HANDOFF.md (new); session-log directive.

## Key Decisions
<!-- APPEND-ONLY. Full rationale + alternatives live in design.md. -->
- **D-load-bearing — Determinism via edge/pair-seeded shared features, NOT
  forward-passing.** Shared features (road crossing a chunk edge, river between
  lakes) are seeded by the feature's own identity so both sides compute identically.
  The explored "neighbor generates first and hands ports forward" idea was rejected
  as order-dependent (breaks on approach direction, unload/reload, `?seed`). See
  design.md D4.
- **D-structure — Central-place hierarchy** (rare rank-weighted hearts; everything
  orients to nearest heart; sparsity = space between). design.md D3.
- **D-harness — 2D Canvas sandbox, render-agnostic generator, single source of
  truth** for future 3D world + in-game map view. design.md D1/D2/D11.
- **D-scope — This change ships the generator + 2D sandbox ONLY.** No live-game
  changes; the v2-worldgen integration (the breaking step) is a follow-up. proposal
  Impact + design Non-Goals.
- **D-road-proxy — A lake-heart's roads converge on ONE shore proxy; roads route
  AROUND water instead of being nulled** (Gary 2026-06-06, supersedes the prior
  per-neighbor directional `landingPoint`). The proxy is the heart pushed radially
  out from its lake's center to just past the shore (`heartProxy`), so it's a
  single deterministic point independent of which neighbor is asking. When the
  direct proxy→proxy line crosses a lake, `arterial` bends around the blocking
  lake on an arc at `maxR + ROAD_LAKE_DETOUR` (guaranteed outside the whole
  outline), short way, pair-hash tiebreak for opposite shores; if even the detour
  can't find a dry path the road is still nulled (bridges stay cut). NOTE: this
  extends road *existence*'s dependence on the lake-outline `sin/cos` — reinforces
  the existing "re-verify the golden on Safari/Firefox at 3D wire-in" caveat
  (within-engine determinism holds; cross-engine golden already differed). New
  salts: `SALT.roadProxy` (dead-centre fallback), `SALT.roadSide` (detour tiebreak).
- Full set D1–D11 in design.md.

## Assumptions
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | Canvas 2D (not three.js) is the right sandbox renderer | High | Open | Confirm during apply |
| A2 | Rivers belong in this change's 2D scope, built last | Med | Open | -> Q4 |
| A3 | A small `src/worldgen/` module set (vs one file) is the right shape | High | Open | Confirm during apply |
| A4 | Reusing `rng.js` seeding (not a new scheme) keeps future 3D integration single-contract | High | Open | Verify in §1.2 |

## Dangling Threads
<!-- APPEND-ONLY. Strikethrough when resolved. -->
- Proximity-graph (D6) consistency radius is empirical — must be validated by the
  §9.2 multi-origin check, not assumed.
- Generator cost when the sandbox draws kilometers — sampled-resolution/tile-cache is
  a sandbox concern; confirm the point-query stays bounded-neighborhood cheap.

## Work Log
<!-- APPEND-ONLY. Newest at BOTTOM. -->

### 2026-06-06 — /opsx:ff artifact creation
**Intent:** Fast-forward all spec-driven artifacts to apply-ready for
procedural-map-generator, capturing the /opsx:explore design thread.
**Result:** Created proposal.md, specs/world-layout-generator/spec.md,
specs/worldgen-2d-sandbox/spec.md, design.md (D1–D11 + risks + open questions),
tasks.md (10 groups, harness-early, rivers last, determinism acceptance gate).
Initialized this log + questions-for-human.md (Q1–Q4). Also fixed two pre-existing
YAML syntax bugs in openspec/config.yaml (multi-line list items with inline colons)
that were breaking the CLI; two harmless leftover warnings remain
(`implementation`/`verification` rule blocks for a non-active schema).
**Changed:** openspec/changes/procedural-map-generator/* ; openspec/config.yaml.
**Refs:** -> Q1–Q4; design.md D1–D11; proposal Scope Check.

### 2026-06-06 — Tier-3 council deliberation (001-initial)
**Intent:** Stress-test the plan before implementation, per Gary's chained
`/deliberate`. Selected 5 personas (Architect, Adversary, Maverick, Pragmatist,
Anthropologist) + Mediator; Profiler/Auditor deselected for fit (Canvas-2D → low
perf risk; hygiene already in tasks).
**Result:** Unanimous **Proceed with mitigations**; architecture (D1–D4, D11)
endorsed across the board. Mediator synthesized **5 Change Groups** around 2 hard
gates. **21 risks, 2 CRITICAL** — (1) `nearestHeart` window truncation
(wrong-but-stable), (2) river-around-heart non-determinism. Key recommended scope
cuts: **CUT rivers+bridges and mega-heart 2×2 from THIS implementation** (keep in
spec + contract stubs; defer to 3D follow-up). Other mitigations folded regardless:
lock data contract first (facing/noBuild/footprint/lifecycle/reserved groundY),
real determinism teeth (window-invariance + negative control + bit-exact boundary +
serialize round-trip + cross-engine golden hash + integer quantization before every
hash/threshold), fix §4/§5 ordering (lakes before road routing), promote §3.4 to a
hard GO/NO-GO gate, 4 harness affordances (preview-MCP keep-alive, deep-link URL,
`window.__mapSandbox`, failure-localizing self-test), route seed via
`setSessionSeed`, one seeding regime via thin `cellHash`/`edgeHash`/`pairHash`
wrappers in rng.js.
**Changed:** deliberations/001-initial/{briefing,council-architect,council-adversary,
council-maverick,council-pragmatist,council-anthropologist,results}.md.
**Refs:** -> Q1, -> Q4; results.md CG1–CG5 + Risk Register. Paused for Gary's
decision before apply.

### 2026-06-06 — Apply: CG1 + CG2 (to GATE 1)
**Intent:** Build the contract + determinism foundation (CG1), then hearts + the 2D
sandbox shell (CG2) to reach GATE 1 and verify determinism + spacing.
**Result:** Implemented `rng.js` worldgen primitives (`quantize`, `cellHash`,
`cellRng`, `edgeHash`/`pairHash` canonical `(min,max)`, `pairRng`); `src/worldgen/`
modules — `constants.js`, `hearts.js` (minor/major, integer-quantized distance
compare + lexicographic tiebreak), `water.js` (lakes; rivers = always-false stubs),
`roads.js` (stub → GATE 2), `roles.js` (roleTier; off-road anchor → GATE 2),
`density.js` (continuous field), `index.js` (the locked tuple contract +
queryPoint/queryRegion), `selftest.js` (real teeth). `map-sandbox.html` — Canvas 2D
viewer with pan/zoom, deep-link URL, layer toggles, point inspector, on-screen
self-test, preview-MCP keep-alive, `window.__mapSandbox`.
**Verified:** (a) Headless Node — modules import with NO three/DOM (CG4.4 render-
agnostic proven); self-test PASS across seeds 0/1/1234/0x95128419 (round-trip,
window-invariance, negative-control-with-teeth); golden hash **4968ba30**. (b)
In-browser (preview MCP, Chrome) — self-test PASS, golden **4968ba30** (matches
Node). Screenshot taken. Spacing measured: ~3 hearts/km² (≈580m / ~21s all; majors
~930m / ~33s) — in the medium target.
**Chosen constants (GATE-1 starting point):** HEART_CELL=480, jitter=0.40,
P(none/minor/major)=0.55/0.34/0.11, domains minor 95/230, major 165/430.
**Honest read:** hearts-alone render as a fairly UNIFORM scatter — the council's
mild lattice tendency. Intentional "centers in open country" structure won't fully
read until arterials connect them (GATE 2). Determinism/spacing are solid; the
by-eye "feel" call is Gary's at the gate.
**Changed:** src/rng.js; src/worldgen/{constants,hearts,water,roads,roles,density,
index,selftest}.js; map-sandbox.html; tasks.md (CG1 + CG2.1–2.7 checked).
**Refs:** -> Q1 (spacing by eye); tasks CG2.8 (GATE). Golden 4968ba30 = V8; the
cross-engine guard (Safari/Firefox recompute) is the 3D-port's job.

### 2026-06-06 — GATE-1 enhancement: live tuning sliders (Gary's request)
**Intent:** Gary asked at the gate for sliders/levers to tweak key variables and
see the map change live, instead of me guess-and-rescreenshot.
**Result:** Refactored `constants.js` from frozen `const`s to a mutable `CONFIG`
object (layers read `CONFIG.*` per-call; `SALT` stays immutable; `roadNeighborhoodCells()`
helper). Added a "TUNING · LIVE" panel to `map-sandbox.html` — 11 sliders bound to
CONFIG (heart cell, jitter, empty-cells %, major-share %, minor/major core+district,
lake prob, lake cell, density cell) with live value readouts, a "copy CONFIG" button
(JSON to clipboard for capture), and a "defaults" reset. `window.__mapSandbox.config`
/ `setConfig()` exposed.
**Verified:** headless self-test still PASS, golden **4968ba30 UNCHANGED** (refactor
preserved determinism exactly); live mutation confirmed (HEART_CELL 480→900 drops
hearts-in-6km 110→42). Browser reload: 11 sliders render, map draws, **zero console
errors** on the map page (the [chunk slow] warnings are the main game from an earlier
preview load, not this page).
**Changed:** src/worldgen/constants.js (CONFIG), hearts/water/density/selftest.js
(read CONFIG per-call), map-sandbox.html (tuning panel).
**Next:** Gary tunes by eye → bake chosen CONFIG into constants.js defaults +
capture here → GATE 2 (arterials) → CG4 → CG5 docs → /opsx:verify → /smart-review.

### 2026-06-06 — Gary's tuned CONFIG + lobed lakes + glossary + GATE 2 (arterials)
**Intent:** Apply Gary's tuned CONFIG, address his asks (term definitions; how
themes are represented; lake-shape diversity), and push through GATE 2 without
stopping at the soft gate.
**Result:**
- **Baked Gary's CONFIG** as defaults (HEART_CELL 440, none/minor 0.48/0.96 →
  ~48% empty/48% minor/4% major, minor 95/290, major 350/1000, LAKE_PROB 0.60,
  LAKE_CELL 1050, DENSITY_CELL 230).
- **Correctness fix:** major district 1000m > the old fixed 2-cell scan window →
  derived `heartNeighborhoodCells()` from max district (= 4 cells now) so big
  hubs can't be truncated out (the council's CRITICAL window-truncation risk,
  now actually triggered by Gary's domains). density.js uses an explicit small
  window (2) for cheap per-pixel clearing.
- **Lobed lakes:** water.js now makes elongated/peanut/oval/kidney outlines
  (ellipse stretch + 2/3-lobe perturbation + jitter; 12% stay circular),
  containment switched to integer point-in-polygon. Verified elongation ratios
  2–4×.
- **Glossary:** `src/worldgen/README.md` — all terms defined + "how to look at
  it" + the role→theme mapping table (how food trucks/vendors/potties/campsites
  are represented: as role-tier substrate the future theme layer reads, NOT as
  generator features). Added a "would host" line to the sandbox inspector.
- **GATE 2 — arterials:** roads.js connects hearts via a symmetric K-nearest
  proximity graph (edges capped at ROAD_MAX_EDGE_CELLS, candidates total-ordered),
  each arterial a pair-hash-seeded meander computed end-to-end (no seam halves →
  no kink). `nearestRoad` drives onRoad/roadTier + the off-road `facing` field
  (fixes stages-on-roads structurally). selftest gained T4 road window-invariance
  + T5 negative control.
**Verified:** headless self-test **PASS, 20/20 checks** incl. road invariance +
negative control (0.9s); golden **bbeed058**. Browser: arterials connect hearts
into a real network (396 arterials / 126 hearts / 41 lobed lakes in a 6km box),
onRoad+facing fire, zero errors. Screenshots captured.
**Changed:** src/worldgen/{constants,hearts,water,density,roles,roads,index,
selftest}.js; src/worldgen/README.md; map-sandbox.html; tasks.md (CG3 + 5.6 checked).
**Next:** CG4 (role overlay polish + drive-time probe + full sweep) → CG5
(CHANGELOG/ROADMAP) → /opsx:verify → /smart-review.

### 2026-06-06 — Lake avoidance + lakeside hearts + forest rework + CG5 docs
**Intent:** Gary's refinements: prevent roads from crossing lakes; ALLOW hearts
near/on lakes (lakeside stages, per real LEAF); rework forests to be derived
AFTER structure (organic gap-fill, not circular, lakeshore rings, paths within).
**Result:**
- Added (seed,epoch) memo caches to heartInCell + lakeInCell (perf + a
  `bumpWorldgen()` epoch the sliders bump on change).
- Roads now skip any arterial that would cross a lake (`arterial()` returns null
  if the meander hits water; bridges are cut). Verified 0/2387 road vertices in
  water.
- Hearts deliberately do NOT avoid lakes (reverted an earlier suppression) — a
  lakeside/on-lake heart is allowed; the per-point inLake/noBuild keeps actual
  structures off water (a 3D-placement detail). Verified 2 lakeside hearts render.
- density.js reworked into an organic, gap-filling forest field: domain-warped
  2-octave noise (irregular blobs, not circles), cleared at heart cores +
  ramping through districts, tree-ring hugging each lobed lakeshore with ~30%
  causeway gaps. Exposed forest threshold + lakeshore-ring as live sliders;
  bolder forest render; deep-forest → "drum-circle clearing" inspector hint.
- CG5 docs: CHANGELOG (2026-06-06, the map sandbox), ROADMAP (new "World
  generation (procedural map)" section — v2-worldgen wire-in, rivers+bridges,
  mega-heart, in-game map view, footpath tiers, drive-time probe, forest-drum
  clearings). README already covered the glossary + theme mapping.
**Verified:** self-test PASS 20/20 (golden 2289a163 pre-forest-tweak, re-rolls
with forest-threshold default); browser: organic forests read well, roads avoid
lakes, lobed lakes, lakeside hearts, zero console errors. Screenshots captured.
**Changed:** src/worldgen/{constants,hearts,water,density,roads}.js; map-sandbox.html;
CHANGELOG.md; ROADMAP.md; tasks.md (CG4/CG5 + GATE checks).
**Next:** /opsx:verify → /smart-review.

### 2026-06-06 — Lake-heart road convergence + route-around + forest tree-dots
**Intent:** Gary's post-handoff asks: (1) a heart in a lake should pick ONE proxy
point on the shore where its roads converge (not the scatter of per-neighbor
directional landings); (2) route arterials AROUND a lake so far-side neighbors —
and two hearts on opposite shores — connect instead of being nulled; (3) render
forests as green tree-DOTS, not the unreadable density wash. Work it out in 2D
first (-> D-road-proxy).
**Result:**
- `heartProxy(h)` replaces the directional `landingPoint`: a lake-heart's single
  shore proxy = heart pushed radially out from the lake center past the waterline
  (hash-stable fallback angle if dead-centre). `arterialPolyline` + `arterial`
  draw between proxies, so ALL of a heart's roads converge on that one point
  (verified: a major lake-heart's 3 arterials all start at the same point, 0.0 m).
- `arterial` now routes around water: if the direct proxy→proxy line crosses a
  lake, bend around it on an arc at `maxR + ROAD_LAKE_DETOUR` outside the shore
  (`arcAround`), short way with a pair-hash tiebreak for ~opposite shores; try the
  other side, else null (bridges still cut). Also: if only the *meander* dips into
  a shore (not the direct line), just drop the meander. `crossesWater` now samples
  densely BETWEEN vertices (a straight run can't skip a small lake anymore).
- Forest render in map-sandbox.html: world-anchored jittered tree-dot scatter,
  probability ∝ `treeDensity`, spacing tracks zoom, sampled off a coarse density
  grid + batched into one fill. Generation (density.js) UNCHANGED — render only.
- New: `CONFIG.ROAD_LAKE_DETOUR`, `SALT.roadProxy`, `SALT.roadSide`.
**Verified:** headless self-test **PASS 20/20** (golden 63c8dea2, re-rolled —
road output legitimately changed); in-browser self-test PASS 20/20 (golden
a527d31e — differs cross-engine = the KNOWN, pre-existing lake-outline sin/cos
wobble, now reinforced; see -> D-road-proxy). Stats at seed 1234: 18 km box ->
**0/90,026** densely-sampled road points in water; 11/11 lake-hearts have roads;
113 around-the-lake detours, all of them straddle-a-lake connections that were
previously nulled. Browser screenshots captured (major lake-heart 3-road
convergence + detour; two-hearts-across-a-lake link; tree-dot forests w/ lakeshore
rings); zero console errors. Game NOT booted — worldgen has no importmap entry in
index.html (by design) and no game file was touched, so the boot-check precondition
isn't met.
**Changed:** src/worldgen/{constants,roads}.js; map-sandbox.html; CHANGELOG.md;
HANDOFF.md; session-log.md.
**Next:** back to Gary. Remaining open items: parked ROADMAP set (rivers+bridges,
mega-heart, in-game map view, footpath tiers, drive-time probe) + THE BIG ONE
(wire generator into the live 3D game as v2 worldgen).
