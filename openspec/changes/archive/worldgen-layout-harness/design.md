# Design — worldgen-layout-harness

> Revised after deliberation 001-initial (see `deliberations/001-initial/results.md`).
> The headline change from the first draft: the dry-run layout extraction (old D-C)
> is **deferred to `festival-zone-grammar`** — built-truth capture is this change's
> data spine (D-C′). Change Groups CG1–CG8 are folded in below.

## Context

The festival's arrangement bugs (playtest rounds 1–2) live in the *built
composition* — sub-component positions the `chunks.js` builders scatter — which no
existing surface renders, asserts on, or exposes as data. `festival.js` plans in
points + scalar `KIND_FOOTPRINT` radii; builders construct oriented shapes that
exceed them. The queued `festival-zone-grammar` refactor will fix the contract;
this change builds the instruments to see and gate that work. Everything here is
dev surface — `?worldgen=1` behavior must be byte-identical before/after.

## Goals / Non-Goals

**Goals:**
- Make layout quality *measurable* (linter) and *visible* (overlay, hub viewer,
  footprint decals) without driving the game.
- Make **built truth capturable as data** (`dumpRegistry` + `bin/layout-snapshot`)
  so the linter, the overlay, and every behavior-preservation gate run on what the
  game actually constructs.
- Make Gary's playtest feedback arrive as coordinates (markers), and layout
  judgment cover distributions, not single seeds (gallery).
- Hand `festival-zone-grammar` its verification gate, the `FESTIVAL_TUNING`
  module, analytic extent helpers, and the full extraction design (D-C′) it will
  execute under its own (already-moving) golden.

**Non-Goals:**
- Fixing any layout violation the linter finds. Violations get *recorded* as the
  baseline; fixes are the grammar change's job. Zero placement-behavior change.
- **The dry-run layout extraction (`layouts.js`).** Deferred to
  `festival-zone-grammar` per deliberation 001 (D-C′ below carries the design
  forward). The council showed the extraction is the repo's riskiest refactor
  class and would produce only a *secondary* data source — the registry is the
  primary one and is exact by definition.
- The zone grammar itself, shape-aware `resolveOverlaps`, spur roads.
- CI plumbing (no CI in this repo — the linter is a runbook command like
  `selftest.js`).
- Moving either golden. This change is golden-frozen on both (`queryPoint` + POI).
- Deduping the four html files' inline importmap injectors into a shared
  bootstrap (parked — touches prod loading; Gary-call follow-up).

## Cross-change sequencing (CG3 — the gate must stand on settled ground)

1. **H.2 (v2 change's cross-engine road-existence fix) lands as commit zero.**
   It deliberately moves the `queryPoint` golden; re-record + re-verify
   node==browser, *then* capture this change's pre-refactor snapshots. Never
   mid-stream.
2. **`DEFAULT_WORLDGEN_V2` flip is re-sequenced to after `festival-zone-grammar`**
   (-> Q2 in questions-for-human). The v2 HANDOFF's "Group I landing next" order
   predates the playtest verdict; executing it ships the jumble to the live
   deploy. Corrected order: H.2 → this harness → festival-zone-grammar →
   H.3/F.5 + I landing. Written into the v2 HANDOFF once Gary confirms.
3. **Tuning freeze during the hoist window** (-> Q5): no live `constants.js` /
   worldgen tuning while group-2 commits are in flight (~1–2 commits post-pivot).

## Decisions

### D-A — Build the capture instrument FIRST, and make it one command

The hoist (the one remaining golden-frozen refactor) and every future grammar
commit are gated on built-truth comparison. Goldens cover the *plan*; nothing
covers the *build*. So the first tasks ship:

- **`__dbg.dumpRegistry(bounds?)`** → JSON array of registry entries
  (`kind, x, z, footprint, colliderR, damage, attractorR, attractorW, chunkKey`).
- **`bin/layout-snapshot <seed> [out.json]`** (precedent: `bin/readme-sync`):
  one command wrapping boot → `__dbg.start()` → settle (loaded-chunk count
  stable for 60 frames, no driving — registry state is path-dependent) →
  `dumpRegistry()` → normalize (sort kind+x+z, round 1e-4) → write
  `verification/snapshots/<seed>.json`. Plus `--diff a b` and a `--seeds` loop.
  The copy-paste preview-MCP recipe lands in DEBUGGING.md in the same commit.
  Rationale: the gate ritual repeats; **a tedious gate is a skipped gate**, and
  this one is a determinism control.
- **Pinned capture protocol:** `?worldgen=1&seed=S&perf=high`, crowd on
  (-> Q3 ANSWERED 2026-06-10: high confirmed). Built truth is tier-dependent
  today (`crowd.spawn` draws from the cluster stream with a tier-sized pool and
  a zero-draw early return when full), so snapshots and the baseline are only
  valid at the pinned tier. The underlying nondeterminism is accepted for this change; the real fix
  (crowd pre-rolled params) is named in D-C′ and lands with the grammar change.
- **Twice-capture self-diff control:** capture the same seed/tier twice
  pre-refactor; an empty self-diff is required before any refactor diff is
  trusted (catches frame-spread/settle nondeterminism in the instrument itself).
- **Draw-count canary:** wrap each cluster's rng in a counting closure and emit
  per-cluster draw counts in the dump — catches added/dropped/conditional draws
  that happen to produce identical positions. Built now; load-bearing for the
  grammar change's extraction.
- **Deliberate snapshot windows:** the spawn ring + at least one shoreline hub +
  one dense multi-hub window (locate via map-sandbox), and/or a `gotoHub(0..9)`
  sweep per seed, so water-rejection and guard branches are actually exercised.
  Keep one hub's Noon/Midnight screenshot pair per seed as the cosmetic catch
  (registry snapshots don't see colors).

(Vocabulary: these are **layout snapshots**, not "goldens" — the goldens are the
two determinism hashes. "Golden" is a known confusion point; keep the terms apart
in all docs.)

### D-B — `src/worldgen/tuning.js`: render-agnostic, slider-ready, with a hard in/out rule

The shared constants module must be importable by `festival.js` (pure worldgen),
`chunks.js` (3D), the linter (node), and the hub viewer's sliders — so it lives in
`src/worldgen/` and imports nothing.

**In:** arrangement constants — distances *between* placed things. Ring radius,
booth spacing/row offset/camper-tent offset, dancefloor depth/halfwidth bases,
`KIND_FOOTPRINT`, cluster walk distances, potty bank offsets, court/vendor counts.
**Out:** model-internal dimensions (a truck's own width, tent canopy radius as a
*mesh* property). Models own their bodies; tuning owns the space between bodies.
Where a model dimension feeds an arrangement decision, tuning holds the *derived*
value with a comment naming the source — plus **dev-only drift assertions** in
chunks.js (which legally imports both): compare each derived value against the
live model export (`14 * FOOD_TRUCK_SCALE`, `POTTY_SPACING`, …) and
`console.warn` on mismatch, localhost-gated.

Hardening from deliberation:
- **Mutable-CONFIG + setter shape from day one** (the group-6 sliders bind it
  like map-sandbox `setConfig`; don't retrofit).
- **Inventory rule:** near-duplicate constants used by planner AND builder under
  different names are marked **"same number, two owners, do NOT merge yet"** —
  unifying is a behavior change and a snapshot-diff failure. Merging is grammar-
  change work.
- **Analytic extent helpers:** tuning.js (or a pure sibling) exports per-kind
  conservative envelope computations (ring radius + member size → outer extent).
  Under the pivot this is the grammar zone-planner's true-extent source, and the
  overlay/linter plan-mode consume it too.
- Importmap entries in **all four** consuming html files (index, sandbox,
  map-sandbox; hub-sandbox when it lands).

Same values, same names where practical, zero rng-order impact. One or two
commits, gated by D-A.

### D-C′ — Built-truth capture now; the extraction is the grammar change's early task

The first draft's D-C ("pure layout fns own ALL rng draws, mesh halves rng-free")
is **not implementable at this change's scope** — deliberation 001, Adversary
findings 1–3, verified against the code:

1. **Cosmetic draws live inside ~8 model builders** (`buildTent(ctx.rng)`
   mid-loop in the vendor row, `buildCampChair(ctx.rng)`, foodTruck/sugarShack/
   stage/picnicTable/torch-field/potty/bubble-vendor/drum-figures) — true
   extraction means param surgery across those files
   (`pickTentParams(rng)` pure / `buildTentMesh(params)` splits).
2. **`crowd.spawn` draws from the cluster rng** with a tier-sized pool
   (`PERF.crowdMax`) and a zero-draw early return when full — built layouts are
   *already* tier-dependent; the extraction must hand crowd pre-rolled params
   (which also fixes the pool-full nondeterminism).
3. **`registry.closestBuilding` sits inside draw loops** (camp village, potty
   banks, the cluster guard) — draws are conditioned on the *live registry*, so
   the dry-run env must widen to **`{ waterAt, blockedAt }`**, and headless
   camp-villages stay approximate by construction; registry-audit remains
   authoritative.
4. **The `Math.random()` sites in buildStage are intentionally outside the
   deterministic stream** — any extractor must transcribe them as
   `Math.random()`, never "fix" them into `rng()` (that would inject draws into
   the cluster stream).

All four points are handed forward as binding design guidance for
`festival-zone-grammar`, which performs the extraction while its builders are
being rewritten anyway and its POI golden is already moving — gated by THIS
harness (snapshot diffs + draw-count canary + linter baseline). What the grammar
change's planner needs on day one is true extents, which the analytic helpers
(D-B) provide without per-record data.

### D-D — `src/worldgen/lint.js`: registry mode is primary, plan mode is the fast sweep

Pure module, node CLI (`bin/lint` wrapper) + browser import. Two explicitly
partitioned context modes:

- **Plan mode (headless node, multi-seed in seconds):** rules computable from
  `festivalPlan` + tuning analytic extents + road/water queries —
  `stage-spacing`, `spawn-arrival`, hub-level `water-clear`, and approximate
  `overlap` / `truck-off-road` on analytic envelopes (labeled approximate in
  output).
- **Registry mode (primary, exact):** the same rules plus `dancefloor-clear`,
  `booth-on-road`, `potty-attached` at sub-component granularity, run against
  `dumpRegistry` payloads / snapshot files. **Where the two modes disagree,
  registry mode is authoritative.**

Rules are data (`{id, severity, mode, check}`) with stable ids (the table from
the first draft stands: `overlap`, `dancefloor-clear`, `booth-on-road`,
`truck-off-road`, `potty-attached`, `stage-spacing`, `spawn-arrival`,
`water-clear`). **Every violation emits the full eyes pipeline:** map-sandbox 2D
deep-link AND hub-sandbox 3D link (`?at=x,z`) AND a paste-ready
`__dbg.teleport(x, z)` snippet. `gotoHub(n)` prints that hub's violations once
lint lands (first-draft open question: resolved yes).

**Baseline (task 8.1) records from registry mode** at the pinned tier via
`bin/layout-snapshot --seeds` across ≥10 seeds, with plan-mode counts alongside
so the headless-vs-built gap is itself a tracked number the grammar change
watches. **Baseline format is Gary-legible:** rule | severity | total | worst
seed | 2D link | 3D link, plus 2–3 hub-viewer screenshots of the worst
offenders. The grammar change's proposal must pin the archived path or copy the
baseline forward. The known trucks-clipping-vendor-rows seed `0xf7ef2a3c`
(playtest round 2) is the linter's own acceptance case.

### D-E — Hub viewer: `hub-sandbox.html`, building through the REAL builders

A third page (precedent: `map-sandbox.html`). It imports `chunks.js` and calls a
new exported `buildHubPreview(scene, heart, opts)` that runs the real
`festivalPlan` → `buildWorldgenKind` path on a flat ground plane with the
sandbox's lighting/ToD presets and OrbitControls. `?seed=&hub=n` deep-links;
**`?at=x,z` resolves to the nearest heart** (then `replaceState`s the canonical
URL) — coordinates are how lint violations and Gary's markers actually arrive.
The viewer displays the heart's world coords + rank; `gotoHub(n)` prints the
equivalent hub-sandbox URL.

Integrity requirements (deliberation CG7):
- **Synthetic ctx is specced, not improvised:** `{cx, cz, key, cxWorld, czWorld,
  rng, group, region, crowd}` — the same shape `_generateWorldgen` builds.
  **Crowd disposition: a real Crowd instance or a draw-faithful stub — never
  omitted** (omitting skips draws and the viewer shows different chair layouts
  than the game). **Acceptance test:** diff hub-sandbox sub-component positions
  against a game `dumpRegistry` at the same seed/hub/tier.
- **Register the hub's worldgen lakes into the page registry before building**
  (a fresh page has no lakes, so water rejection never fires), or label
  shoreline hubs approximate.
- **Teardown = the shared by-key unload walk.** Extract chunks.js's existing
  dispose walk (registry.removeChunk + `forestAnimatables`/`forestDrumCircles`/
  music by-key splices + contextLights deregistration + `userData.shared`-
  respecting dispose) into one exported helper that both `_disposeChunk` and the
  hub viewer's rebuild call — the two can't drift, and slider-drag rebuilds
  can't leak registry entries that feed back into `closestBuilding` and change
  hub N+1's layout.
- **The page's importmap maps `'three'` → `src/threeShim.js` — copy
  INDEX.HTML's mapping (index.html:101), NOT sandbox.html's.** Verified
  2026-06-10: the entity sandbox deliberately points `'three'` straight at
  unpkg with no shim (sandbox.html:176 comment) — fine for isolated models,
  wrong for a viewer whose acceptance test diffs against the tier-aware game.
  Tripwire #2 applies either way. The page never runs `Sound.init()`; verify
  no builder calls Sound synchronously at build.
- Slider rebuild on drag-end or rAF-throttle (decided at build).
- `buildHubPreview` stays in chunks.js for this change; extracting the dispatch
  module is the grammar change's early task. **Dependency-direction rule**
  (stated here and in tuning.js/lint.js headers): `chunks.js → worldgen/` only;
  worldgen modules never import `src/chunks.js`, `src/registry.js`,
  `src/lakes.js`, or `src/models/*`.

The `FESTIVAL_TUNING` slider panel (round-2 item J) lives here, mirroring
map-sandbox's TUNING·LIVE: drag → rebuild the one hub → `copy CONFIG` exports
JSON.

### D-F — `__dbg` additions: smallest thing that works

- `gotoHub(n=0)` — nth-nearest heart teleport + canonical 3/4 overhead camLock
  facing the stage; prints the equivalent hub-sandbox URL (+ lint violations
  once D-D lands).
- `topDown(x?, z?, span=160)` — **perspective** top-down via existing camLock
  plumbing (camera at height `span / (2·tan(fov/2))`). Ortho is a parked upgrade.
- `showFootprints(on=true)` — one toggle group: ring line-loops per registry
  footprint + dancefloor rects. Plain materials, never tagged shared, never
  registered, disposed fully on toggle-off.
- `dumpRegistry(bounds?)` — see D-A (widened field set).

All registered in `__dbg.help()`, localhost-gated, documented in DEBUGGING.md in
the same commit.

### D-G — Playtest markers: localStorage + overlay panel

Keypress drops `{ seed, x, z, heading, tod, sessionTime, note? }` into
`localStorage` (`zerble_markers`) with a toast; the debug overlay's MARKERS
section lists markers with per-marker **editable note**, copy-JSON, clear, and
teleport. Key: `m` if free (verify against input.js/debug.js/touch.js maps; fall
back to `k`). **Mobile (-> Q4 ANSWERED 2026-06-10): ships WITH a touch
affordance** — a deliberately awkward-to-accident gesture (e.g. triple-tap a HUD
corner) drops the marker, and a keyboard-free copy affordance gets the list off
the device — because Gary playtests the live deploy on his phone and the
flagship scenario must work there. Hotkey + gesture stay out of player-facing
copy (Easter-egg rule).

### D-H — Map-sandbox: overlay from two sources, gallery as a mode

- **True-extent overlay consumes (a) captured snapshot JSON**
  (`verification/snapshots/<seed>.json`, fetch or file-drop) — exact built truth
  for captured seeds — **and (b) analytic tuning envelopes** — live for any
  seed, labeled approximate. Per-record hover works on both.
- `?gallery=N` contact sheet: per-tile seed render centered on the spawn hub,
  seed label; **lint counts use plan mode** (no boots) and render progressively
  (tile paints first, count fills in). Click → full map deep-link.
- map-sandbox.html's `wg` importmap array gains `worldgen/tuning` +
  `worldgen/lint` (+ extent helpers) — it is the **fourth** importmap file.

## Risks / Trade-offs

(Deliberation 001's full Risk Register: `deliberations/001-initial/results.md`
R1–R14. The load-bearing ones:)

- **[R2 — built truth is tier-dependent today]** → pinned tier for all captures
  + baseline (-> Q3); accepted for this change; real fix (crowd pre-rolled
  params) named in D-C′, lands with grammar.
- **[R3 — H.2 or live tuning lands mid-freeze]** → CG3 sequencing: H.2 = commit
  zero; tuning freeze agreement; freeze window is now ~2 commits, not ~10.
- **[R4/R5 — hub viewer lies or leaks]** → lakes registered first; crowd never
  omitted; acceptance test = diff vs game dump; shared by-key unload walk
  (extracted, not reinvented).
- **[R6 — importmap drift across FOUR files]** → consistency-checker script
  (node, regex-extracts all four module arrays, diffs against `src/`
  contents, fails loudly) + no-build.md correction.
- **[R7 — capture ritual skipped under fatigue]** → `bin/layout-snapshot`; only
  ~2 gated commits remain post-pivot.
- **[R8 — gate blind spots: registry-invisible draws, unexercised branches]** →
  draw-count canary + shoreline/dense windows + Noon/Midnight screenshot pair.
  Primarily protects the grammar change; the instrument is built now.
- **[R1 — analytic extents drift from built truth]** → baseline records the
  plan-vs-registry gap as a tracked number; registry mode authoritative.
- **[Scope creep: fixing violations the linter reveals]** → hard rule: baseline
  records, grammar fixes. The one exception: a linter RULE bug (false positive)
  is fixable here.

## Migration Plan

No world regeneration: constants keep their values, rng draw order untouched
(the extraction that would have risked it is deferred), salts untouched, both
goldens byte-identical. The one golden-frozen refactor is the group-2 hoist,
gated by D-A snapshots. `?worldgen=0` untouched except shared imports. If a
layout-snapshot diff shows non-empty, the commit does not land — no "accept the
drift" option exists in this change.

## Open Questions

**All six answered 2026-06-10** (see `questions-for-human.md` Answered section):
Q1 pivot CONFIRMED · Q2 flip re-sequenced (v2 HANDOFF corrected same day) ·
Q3 tier pinned HIGH · Q4 markers ship with the touch affordance · Q5 tuning
freeze agreed (we ping at open/close) · Q6 importmap dedupe parked on ROADMAP.
Remaining build-time calls (not Gary-gated): marker key binding (`m` vs `k`),
gallery default tile count, slider drag-end vs rAF-throttle.
