# Capability: sandbox-harness

> **Source:** `sandbox.html` (entity viewer), `hub-sandbox.html` (one 3D hub),
> `map-sandbox.html` (2D layout), `src/debug.js` (the backtick overlay + helpers),
> `src/worldgen/lint.js` (the layout linter), and `window.__dbg` (the running-game
> driving surface; full reference in `DEBUGGING.md` — cross-linked, not duplicated
> here). The no-build importmap rule is in `no-build.md`; the verification doctrine in
> `sandbox-and-testing.md`.
>
> Promotes the delta specs `worldgen-2d-sandbox`, `layout-debug-tools`,
> `layout-surfaces`, and `layout-linter`.

The agent verification surface. The contract: any model or system can be looked at in
isolation in seconds, not minutes. Three deep-linkable sandboxes, a backtick debug
overlay with live perf budgets, a one-door `__dbg` driving API for the running game, and
a headless layout linter.

## ADDED Requirements

### Requirement: Deep-linkable entity sandbox

`sandbox.html?entity=<name>` SHALL render a single entity on a plain ground plane with
a free-orbit camera, a time-of-day slider + Morning/Noon/Dusk/Midnight presets, an audio
panel with a per-entity "Hit it" SFX button, camera presets (1–6, R, L), and
`window.__sandbox` exposing `{ scene, camera, currentEntity }`. The `?entity=` parameter
SHALL select on load and `replaceState` the URL on dropdown change, so a view is
reproducible across iterations (`sandbox.html`, `sandbox-and-testing.md`).

#### Scenario: A model view is reproducible by URL

- **WHEN** an agent opens `sandbox.html?entity=foo`
- **THEN** it renders `foo` in isolation, and re-opening the same URL later shows the
  same view

### Requirement: Composite sandbox views over loading the game

When a model needs context (a lineup, a campsite configuration, a drum circle at two
ToD presets), the answer SHALL be to add a *composite* entity to the sandbox (e.g.
`puppet_lineup`, `campsite_small/medium/large`, `leaf_drum_circle_day/night`,
`lake_with_beach`) rather than loading the full game — extend the harness before
bypassing it (`sandbox-and-testing.md`).

#### Scenario: Context is added to the sandbox, not chased in-game

- **WHEN** a single model reads wrong in isolation
- **THEN** a composite sandbox entity is added so it can be evaluated in context by URL

### Requirement: Hub viewer builds a whole hub by construction

`hub-sandbox.html?seed=<s>&hub=<n>` SHALL build ONE complete festival hub on a flat
plane through the exact game path (`buildHubPreview` → the same `buildWorldgenKind`
dispatch the streaming world uses), so every festival POI kind renders by construction
with no per-kind sandbox case to maintain, with a registry diff-faithful to the game.
It SHALL offer orbit camera, ToD presets, a live `FESTIVAL_TUNING` slider panel that
rebuilds on release, and `?at=x,z` to land on the nearest hub (`hub-sandbox.html`,
`chunks.js:1334`, `CLAUDE.md` hub-viewer row).

#### Scenario: A new cluster kind appears in the hub viewer automatically

- **WHEN** a new worldgen cluster kind is added to the builders
- **THEN** it renders in the hub viewer without adding a per-kind sandbox case

### Requirement: 2D map sandbox for layout

`map-sandbox.html` SHALL render a 2D top-down view of the whole worldgen layout —
pan/zoom across km, a seed + live tuning sliders, layer toggles (hearts/roads/lakes/
forests/seams), a point inspector showing the `queryPoint` tuple, and an on-screen
determinism self-test — consuming `src/worldgen/` data only (no `three`)
(`map-sandbox.html`, `worldgen-2d-sandbox` delta).

#### Scenario: A point inspector shows the layout tuple

- **WHEN** the user clicks a point in the map sandbox
- **THEN** it shows that point's nearest heart, role tier, road/water state, and density

### Requirement: Backtick debug overlay with live perf budgets

`debug.js` SHALL provide a backtick-toggled overlay showing live `renderer.info`
(draws / triangles / geometries / textures / heap) against per-tier budgets (low 80 /
150k, mid 200 / 400k, high 400 / 1.2M) with `ok` / `!` / `!!` markers, plus opt-in
helpers `teleport`, `god`, `freezeNPCs`, `showColliders`, `pause`, and `step`. All
side-effects SHALL be opt-in; `shouldRunFrame` SHALL gate `tickBody` so pause/step
freeze the world while the camera stays live (`debug.js:1-115`).

#### Scenario: The budget panel flags an over-budget frame

- **WHEN** draws exceed the tier budget
- **THEN** the overlay shows the draw count with an `!!` over-budget marker

### Requirement: One-door __dbg driving surface

`window.__dbg` SHALL be the single door for driving the running game in local dev —
`start()` (boot past the title gesture), `camLock`/`camUnlock` (pin a fixed camera over
the chase cam), `fillSeats`/`rider`/`setJuice`/`tod`/`teleport` (nudge state), with
`__dbg.game` (live refs) and `__dbg.debug` (the backtick API) aliased onto it. The full
reference lives in `DEBUGGING.md` (`CLAUDE.md` Run + verify section).

#### Scenario: An agent screenshots a pinned close-up

- **WHEN** an agent calls `__dbg.start()` then `__dbg.camLock(...)`
- **THEN** the game boots and holds a fixed camera pose for a screenshot, overriding the
  chase cam

### Requirement: Headless rules-as-data layout linter

`worldgen/lint.js` SHALL lint the worldgen plan with rules-as-data (each rule has an id,
severity, mode, and a `check`), runnable headlessly from node in PLAN mode (analytic,
pure) and in REGISTRY mode over a built/captured registry (which wins where they
disagree). It SHALL import only `worldgen/` modules — never chunks/registry/lakes/models
(`lint.js:1-81`, `layout-linter` delta).

#### Scenario: A booth-on-road violation is reported

- **WHEN** the linter runs over a plan where a booth sits on a road
- **THEN** it emits a `booth-on-road` violation with its severity and location
