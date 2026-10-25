## ADDED Requirements
### Requirement: Persistent local passport
The game SHALL keep versioned browser-local all-time counters, records and stamps independent of GA, plus counters for the current visit. Corrupt or blocked storage MUST NOT break play. Existing lifetime smiles SHALL migrate once.
#### Scenario: Save reload
- **WHEN** a player reloads after collecting smiles and traveling
- **THEN** all-time totals and stamps survive, this-visit counters reset, and migrated smiles are not added again.
### Requirement: Honest measurements
Distances SHALL be planar from the actual initial entrance; driven distance SHALL include only simulation movement and exclude relocation. Raw smiles, successful bubble emissions, damaging bonks, boardings and unique seed-qualified stages SHALL be counted. Hidden/title/intro/passport/game-over simulation MUST NOT grow counters.
#### Scenario: Travel and return
- **WHEN** a player drives away and returns to the entrance
- **THEN** current distance drops, farthest remains, and driven distance includes both legs.
#### Scenario: Restart and teleport
- **WHEN** settings restarts a visit or a debug/tow relocation occurs
- **THEN** settings preserves the entrance/visit and relocation does not inflate driven distance or exploration records.
#### Scenario: A jump followed by driving
- **WHEN** an external relocation is detected
- **THEN** the visit cannot earn exploration records, stages or exploration stamps afterward, while later actual movement and other counters remain measurable.

### Requirement: Player presentation
The passport SHALL provide This visit and All time views, clear stat units and stamp criteria, storage scope/failure wording, keyboard/touch access, Escape close, focus restoration and modal focus containment.
#### Scenario: Inspect stats
- **WHEN** a player opens the passport
- **THEN** gameplay simulation is paused, gameplay input is cleared on both transitions, and stats and earned/unearned stamps are readable without analytics.
### Requirement: Incremental analytics
GA SHALL receive whitelisted, name/coordinate-free progress increments every 60 active seconds and on hide, and once-only earned stamps. Delivery failure MUST NOT affect progression. Gauge values SHALL be named distinctly from increments.
#### Scenario: Repeated hide
- **WHEN** a tab hides repeatedly without further gameplay
- **THEN** additive counts are not resent.
