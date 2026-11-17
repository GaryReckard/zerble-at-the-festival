## ADDED Requirements

### Requirement: Curated playable history
The archive SHALL show dated player-facing chapters with exact source references and links only to published snapshots.

#### Scenario: Browse development history
- **WHEN** a visitor opens the archive root
- **THEN** they can read milestones in either date order and launch a published version or the current game.

### Requirement: Ephemeral archive state
Historical code MUST run after memory-only storage is installed and MUST NOT submit production scores. Existing analytics and archive starts SHALL include exact game_version and game_channel values, and archive analytics cookies MUST remain memory-only.

#### Scenario: Start a fresh play
- **WHEN** an archived page reloads or another snapshot is opened
- **THEN** localStorage, sessionStorage and IndexedDB start empty, with previous native storage untouched.

### Requirement: Repeatable publishing
Milestone tags and manual commit selection SHALL resolve exact commits and publish complete snapshots through trusted tools.

#### Scenario: Add another version
- **WHEN** a new snapshot is published
- **THEN** all previous snapshot URLs remain unchanged, the timeline updates, and the current game's deployment is unaffected.

#### Scenario: Reject an unsafe or conflicting build
- **WHEN** extraction, build, checksums or publication checks fail
- **THEN** no partial archive deployment or replacement of an existing snapshot is published.
