# festival-tuning

## ADDED Requirements

### Requirement: Single shared arrangement-constants module
The system SHALL provide one render-agnostic module (`src/worldgen/tuning.js`)
holding every festival *arrangement* constant (distances/counts/offsets between
placed things), imported by the planner (`festival.js`), the builders
(`chunks.js`), the linter, and the hub viewer. Model-internal dimensions SHALL
remain in their model files; where a model dimension feeds an arrangement
decision, tuning SHALL hold the derived value with a comment naming the source.

#### Scenario: Planner and builder read the same number
- **WHEN** the food-court ring radius is changed in `tuning.js`
- **THEN** `festival.js` cluster envelopes and `chunks.js` truck placement both
  reflect the new value with no other edit

#### Scenario: Hoist is behavior-preserving
- **WHEN** the hoist commit is applied and the game boots with `?worldgen=1` at a
  fixed seed
- **THEN** the registry layout snapshot diff against pre-hoist is empty and both
  determinism goldens (queryPoint + POI) are unchanged

### Requirement: Analytic extent helpers
The tuning module (or a pure sibling) SHALL export per-kind conservative
envelope computations (e.g. ring radius + member size → outer extent) usable by
the linter's plan mode, the map-sandbox overlay, and the future zone planner,
and SHALL be authored mutable-CONFIG + setter shaped from day one so the hub
viewer's sliders bind it without a retrofit. Where a tuning value derives from a
model export, chunks.js SHALL carry a localhost-gated drift assertion comparing
the derived value against the live model export.

#### Scenario: Plan-level true extent without building
- **WHEN** the linter's plan mode evaluates a food court descriptor
- **THEN** the extent helper returns the court's conservative outer envelope
  (ring + truck size) from tuning constants alone, with no three.js build

#### Scenario: Drift assertion catches a diverged derived value
- **WHEN** a model export changes such that a derived tuning value no longer
  matches (e.g. `14 * FOOD_TRUCK_SCALE`)
- **THEN** chunks.js logs a console warning on localhost naming both values

### Requirement: Live tuning surface
The hub viewer SHALL expose `FESTIVAL_TUNING` values as live sliders that rebuild
the displayed hub on change and SHALL provide a copy-CONFIG export of the current
values as JSON.

#### Scenario: Slider drag rebuilds one hub
- **WHEN** a tuning slider is dragged in the hub viewer
- **THEN** the displayed hub re-rolls with the new value without a page reload

#### Scenario: Export current tuning
- **WHEN** the user clicks copy CONFIG
- **THEN** the clipboard receives valid JSON of every non-default tuning value
