# Proposal — worldgen-layout-harness

## Why

Every existing verification surface checks the *plan* (map-sandbox draws POI points +
scalar footprint circles), an *entity* (sandbox.html shows one model), *determinism*
(selftest goldens), or *perf* (the backtick HUD) — **none checks the built
composition**, which is where every arrangement bug from playtest rounds 1 and 2
lives (trucks clipping vendor rows, porta potties stranded, courts in dancefloors).
Today the only detector for layout-quality bugs is Gary driving around — the
project's most expensive sensor. The queued `festival-zone-grammar` refactor
(ROADMAP "Festival layout — the plan/build contract refactor") cannot be verified
without this harness; per the project's own doctrine ("build the harness, then the
feature"), this change lands first and is the grammar work's gate.

## What Changes

- **`FESTIVAL_TUNING` hoist** — the ~34 scattered layout constants in the
  `chunks.js` builders (ring radii, row spacing/offsets, camp offsets, dancefloor
  depths) and `festival.js` (`KIND_FOOTPRINT`, cluster distances) move into one
  importable module both planner and builders read. Behavior-preserving: same
  values, same rng draw order, goldens unchanged.
- **Built-truth capture** *(revised per deliberation 001 — replaces the
  first-draft "dry-runnable builder layouts," which is deferred to
  `festival-zone-grammar`; see design D-C′)* — `__dbg.dumpRegistry` plus a
  one-command `bin/layout-snapshot` (boot → settle → dump → normalize → JSON,
  with `--diff` and `--seeds` modes, pinned tier) make the game's actual built
  composition the data source for the linter, the overlay, and every
  behavior-preservation gate. Includes a per-cluster rng draw-count canary so
  added/dropped draws are caught even when positions are unchanged.
- **Layout linter** — a headless node script in the `selftest.js` mold that
  asserts *quality* invariants (not determinism) across N seeds × every hub:
  no footprint overlaps (minus an allowed-pairs table), nothing in a dancefloor
  wedge but its allowed kinds, vendor booths straddle + face a road, no truck on a
  road corridor, every porta bank within reach of a parent POI, stage-vs-stage
  minimum distance, spawn on a road with arch + stage ahead. Outputs violations
  with seed + coordinates + a map-sandbox deep-link. Also browser-runnable so it
  can audit the live game's registry (closing the sandbox-pass/game-fail class for
  layout).
- **True-extent map-sandbox overlay** — a new layer that draws every actual
  truck/booth/tent/potty from the dry-run layouts instead of (alongside) the
  cluster footprint circles, so clipping is visible at a glance in 2D.
- **Hub viewer** — a new page (working name `hub-sandbox.html`): builds ONE
  complete hub (real `festivalPlan` + real builders) on a flat plane, free-orbit
  camera, ToD presets, deep-linkable `?seed=&hub=`, rebuild-on-demand. The missing
  middle between the one-entity sandbox and the full streaming game.
- **`FESTIVAL_TUNING` live sliders** (round-2 backlog item J) — a tuning panel in
  the hub viewer (mirroring map-sandbox's TUNING·LIVE pattern) with copy-CONFIG
  export; single-hub rebuild on drag is instant where a world reload is not.
- **`__dbg` additions** — `gotoHub(n)` (teleport to nth-nearest heart + canonical
  camLock), `topDown(x, z, span)` (orthographic snapshot), `showFootprints()`
  (registry footprints + dancefloor rects as ground decals, sibling of
  `showColliders`), `dumpRegistry(bounds)` (JSON of built truth).
- **Playtest marker hotkey** — during a run, one key drops `{seed, x, z, heading,
  tod, note?}` to a localStorage list with a copy-out in the debug overlay, so
  playtest feedback arrives as teleportable coordinates instead of prose.
- **Seed-gallery mode** — map-sandbox `?gallery=N` renders an N-seed contact-sheet
  montage; layout quality is a distribution property and single-seed verification
  keeps missing the tail.

Nothing here is **BREAKING**: all of it is additive dev surface plus two
behavior-preserving refactors (hoist, dry-run split) explicitly gated on
byte-identical world output.

## Capabilities

### New Capabilities
- `festival-tuning`: one shared module of festival layout constants consumed by
  planner + builders, with analytic extent helpers and a live-slider surface in
  the hub viewer.
- `layout-linter`: quality-invariant checker with two partitioned modes — plan
  mode (headless, multi-seed) and registry mode (built truth, authoritative);
  violations carry seed, coordinates, rule id, and 2D + 3D + teleport links.
- `layout-surfaces`: true-extent overlay (snapshot + analytic sources) +
  seed-gallery mode in map-sandbox, and the new hub viewer page.
- `layout-debug-tools`: the `__dbg` layout additions, the `bin/layout-snapshot`
  capture tooling, and the playtest marker hotkey.

*(The first draft listed a fifth capability, `layout-dry-run` — pure layout
functions per builder. Deliberation 001 deferred it to `festival-zone-grammar`,
which performs the extraction under its own already-moving golden, gated by
this harness. Design D-C′ hands the full extraction design forward.)*

### Modified Capabilities
(none — `openspec/specs/` is empty today; all capabilities here are new)

## Impact

- **Subsystems touched:** sandbox harness (primary), world streaming
  (`chunks.js` builder refactor — structure only, not behavior), worldgen
  (`festival.js` reads the tuning module), debug surface (`main.js` `__dbg`,
  `debug.js` overlay), registry (read-only dump).
- **Files:** `src/chunks.js` (tuning rewire, `buildHubPreview` export, shared
  unload helper), `src/worldgen/festival.js` + new `src/worldgen/tuning.js` +
  new `src/worldgen/lint.js`, new `bin/layout-snapshot` + `bin/lint` +
  importmap-checker scripts, `map-sandbox.html`, new `hub-sandbox.html`,
  `src/main.js`, `src/debug.js`, `DEBUGGING.md`, `CLAUDE.md` (Run+verify row),
  `src/worldgen/README.md`, `.claude/rules/sandbox-and-testing.md`,
  `.claude/rules/no-build.md`.
- **Tripwires brushed (explicit):**
  - **Determinism (#4)** — the hoist touches code whose rng draw order produces
    existing worlds. Gate: `queryPoint` + POI goldens unchanged AND an empty
    layout-snapshot diff (pinned tier, 3 seeds, draw-count canary) before/after
    each refactor commit. The capture instrument is built FIRST. (The riskier
    dry-run extraction moved to `festival-zone-grammar` per deliberation 001.)
  - **Importmap across FOUR html files (#1)** — `index.html`, `sandbox.html`,
    `map-sandbox.html` (it has its own `wg` array and becomes a consumer of the
    new modules), and the new `hub-sandbox.html`. A node consistency-checker
    script guards the drift; no-build.md gets the corrected count.
  - **Perf budget** — hub viewer is a dev page, not the game; `showFootprints`
    decals are localhost-only debug geometry and must dispose cleanly on toggle.
  - NOT touched: threeShim, iOS audio, chunk/lake lifecycle semantics (dump is
    read-only), `userData.shared` (no new pooled resources beyond decal cleanup).
- **Player-visible effect:** none — this is dev-workflow only. Per
  changelog-and-roadmap.md, dev-workflow changes DO get CHANGELOG entries; the
  ROADMAP "Layout-work agent harness" section gets trimmed as pieces ship.
- **Dependency:** `festival-zone-grammar` consumes this change's tuning module
  (+ analytic extent helpers), the linter, and the capture tooling — and
  performs the dry-run extraction itself, gated by this harness. The
  grammar-unblock milestone (tasks groups 1 + 2 + 4 + the 8.1 baseline) must
  land before the grammar rewrite starts. Cross-change sequencing: v2's H.2
  golden-mover lands as commit zero; the `DEFAULT_WORLDGEN_V2` flip is
  re-sequenced to after the grammar change (-> Q2).

## Scope Check

- **Constants live in more places than chunks.js/festival.js?** Searched: model
  files own *model-internal* dimensions (e.g. `FOOD_TRUCK_SCALE` is imported by
  chunks.js from `foodTruck.js`). Model-internal sizes stay put; only
  *arrangement* constants (distances between things) hoist. Documented as the
  in/out rule in design.md.
- **Sandbox checklist parallel:** the new-model checklist
  (sandbox-and-testing.md) covers `sandbox.html`; the hub viewer adds an
  analogous "new POI kind → hub viewer renders it via the dry-run path
  automatically" property — no per-kind registration, by construction. Noted in
  design.
- **Existing overlay precedent:** map-sandbox already has the layer-toggle +
  TUNING·LIVE + inspector patterns; the true-extent layer and gallery mode extend
  that file's existing conventions rather than inventing new ones.
- **`__dbg` precedent:** additions follow the existing localhost-gate + `help()`
  registration pattern in `main.js`; DEBUGGING.md's "one door" doc gets the new
  verbs in the same commit.
- **Marker hotkey vs existing hotkeys:** backtick (overlay) and `t` (trip menu)
  are taken; the marker key must be added to the debug-overlay help and avoid
  gameplay keys (Space/Shift/G/Y). Exact key chosen in design.
