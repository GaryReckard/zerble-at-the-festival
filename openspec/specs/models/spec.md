# Capability: models

> **Source:** `src/models/**` (each a `buildX()` returning a `THREE.Group`),
> the per-frame animatables updater in `main.js`, the sandbox registration contract
> in `sandbox.html` (`ENTITY_HIT_KIND` `:825`, `ENTITY_MUSIC_STYLE` `:799`), and the
> importmap rule in `index.html`/`sandbox.html`. See `CATALOG.md` (beside this file)
> for the per-model inventory. Pooling/dispose-safety is shared with
> `world-streaming`; collision kinds with `registry-collision`.

Models are pure geometry builders: each returns a `THREE.Group` anchored at the
origin, and the caller positions and rotates it. Animated models attach an updater
that a central per-frame walker drives. Every model is registered in the sandbox so it
can be verified in isolation.

## ADDED Requirements

### Requirement: buildX returns an origin-anchored Group

Each model file SHALL export one or more `buildX(...)` functions returning a
`THREE.Group` anchored at `(0,0,0)`; callers SHALL own positioning and rotation. A
builder MAY return a richer object (e.g. `{ group, color, footprint }`) — callers MUST
extract `.group` accordingly (the mismatch here once crashed world generation)
(`ARCHITECTURE.md:297-308`, the sandbox-vs-game footgun).

#### Scenario: A model anchors at origin

- **WHEN** `buildTent()` is called
- **THEN** it returns a Group centered at the origin, ready for the caller to place

### Requirement: Animatables driven by a central updater

A model with animated parts (firepit flicker, tiki flame, tapestry sway, tribal-figure
motion, performer dance) SHALL attach an updater closure or expose an `anim` object on
its Group, and SHALL register into an animatables list owned by its host (chunk
`forestAnimatables`, lake `lakeAnimatables`, or `forestDrumCircles`). A central
per-frame updater in `main.js` SHALL walk those lists. The lists are chunkKey-tagged so
they're swept on unload (`ARCHITECTURE.md:301`, the `_unload` animatables sweep at
`chunks.js:589-595`).

#### Scenario: A flickering firepit animates without per-model wiring

- **WHEN** a campsite with a firepit is built into a chunk
- **THEN** its animatable registers in the chunk's list and the central updater ticks
  it each frame

### Requirement: Pooled shared resources are dispose-safe

A model that hoists geometry/materials to module scope for reuse across calls SHALL
tag them `userData.shared = true`, so the chunk/lake disposal walk skips them and a
chunk unload can't free a resource other chunks still reference. Variant color
differences SHALL be expressed as a small set of pooled materials (color buckets), and
high-count per-instance variation SHALL use `InstancedMesh` with
`instanceMatrix.needsUpdate = true` after writes (`perf-pooling.md`,
`ARCHITECTURE.md:360`).

#### Scenario: A pooled material survives unload

- **WHEN** a chunk holding a model's `userData.shared` material unloads
- **THEN** the disposal walk leaves that material intact

### Requirement: castShadow discipline

New model meshes SHALL default `castShadow = false`; only meshes whose shadow shape
reads distinctly on the ground (tent roofs, main walls, large body capsules, banners,
tree crowns, the cart chassis/wheels) SHALL cast. Small detail (poles, brackets, limbs,
chair parts, firepit stones, raffia, mustache hairs) SHALL NOT cast
(`perf-pooling.md`, the 56-caster audit).

#### Scenario: A new prop ships with shadows off by default

- **WHEN** a new small detail mesh is added
- **THEN** it does not set `castShadow = true`

### Requirement: A model is not done without sandbox registration

Adding a file to `src/models/` SHALL include: the bare module name in the importmap
`models` array of BOTH `index.html` AND `sandbox.html`; an `<option>` in the sandbox
entity `<select>`; a `case` in `loadEntity()`; an `ENTITY_HIT_KIND` entry if it has a
collision kind; and an `ENTITY_MUSIC_STYLE` entry if it plays music. `bin/check-importmaps`
SHALL pass after the change (`sandbox-and-testing.md`, `no-build.md`).

#### Scenario: The sandbox can show the new model by URL

- **WHEN** a new model is added per the checklist
- **THEN** `/sandbox.html?entity=<key>` loads it in isolation and `bin/check-importmaps`
  reports no drift

### Requirement: Collision kind maps to a hit SFX

A model with a collision kind SHALL map to a registry `kind` that the audio layer
recognizes (e.g. `tent`/`truck`/`stage`/`arch`/`kid`/`puppet`/`brass`/`wook`/
`lake_edge`/`firepit`/`lamppost`/`porta_potty`/`forest_tree`), so the collision SFX and
the sandbox "Hit it" button fire the right one-shot synth (`sandbox.html:825-845`,
`audio-synthesis`).

#### Scenario: Hitting a food truck plays the truck SFX

- **WHEN** the player collides with a `truck`-kind model
- **THEN** the metallic-clang truck collision SFX fires
