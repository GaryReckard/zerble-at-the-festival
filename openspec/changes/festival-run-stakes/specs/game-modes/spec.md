# game-modes — delta

## ADDED Requirements

### Requirement: Two selectable modes on the title card

The title card SHALL offer two modes: **Festival Run** (stakes, scoring, leaderboard)
and **Just Cruisin'** (the pre-change sandbox). The last-picked mode SHALL persist to
`localStorage` and preselect next visit. Mode selection MUST NOT add any async hop
between the start tap and `Sound.init()`.

#### Scenario: Mode choice persists

- **WHEN** a player picks Festival Run, plays, and returns later
- **THEN** Festival Run is preselected on the title card

### Requirement: All stakes tuning flows through one mode-config object

Every stakes behavior (vendor pricing, jug availability, dry-death, vibe meter, combo,
day ramp, leaderboard reporting) SHALL read from a single mode-config module — the one
choke point, mirroring how `PERF` tiers gate features. Code MUST NOT scatter ad-hoc
mode conditionals, and global constants (e.g. `JUICE_STACK_MAX = Infinity`) MUST NOT
be edited to express mode differences.

#### Scenario: A new stakes knob has one home

- **WHEN** a stakes parameter needs a different value per mode
- **THEN** it is expressed as a mode-config field consumed at the behavior site

### Requirement: Just Cruisin' is behaviorally invariant

With Just Cruisin' selected, gameplay SHALL be observably identical to the pre-change
game: free vendor refills, unbounded jug stockpile, no deaths, no vibe meter, no
combo UI, no leaderboard traffic (local or network). Name toasts are the only
permitted new surface.

#### Scenario: Cruisin' player sees no stakes machinery

- **WHEN** a Just Cruisin' session runs dry, hits NPCs, and drives for an hour
- **THEN** no death, vibe warning, combo badge, day counter, or leaderboard call occurs

### Requirement: The resume snapshot carries mode and run state

The sessionStorage resume snapshot ("Apply & restart") SHALL additionally persist the
selected mode and, for Festival Run, the live run state (run clock, day number, score,
high-water mark, combo state, vibe meter, rescue-used flag, run token) so a settings
reload does not orphan or reset a run.

#### Scenario: Settings restart preserves a live run

- **WHEN** the player applies a settings change mid-run and the game reloads
- **THEN** the run resumes with the same day, score, high-water mark, and token
