# layout-debug-tools

> Revised after deliberation 001-initial: dump fields widened, draw-count
> canary added, marker `note?` restored, capture tooling specced (CG2/CG8).

## ADDED Requirements

### Requirement: `__dbg` layout verbs
The local-dev `window.__dbg` surface SHALL gain: `gotoHub(n)` (teleport to the
nth-nearest hub + canonical camLock facing its stage, printing the equivalent
hub-sandbox URL and — once the linter lands — that hub's violations),
`topDown(x?, z?, span)` (camera straight down from altitude via the existing
camLock plumbing), `showFootprints(on)` (registry footprints + dancefloor rects
as toggleable ground decals, fully disposed on toggle-off, never registered,
never tagged shared), and `dumpRegistry(bounds?)` (JSON-able array: kind, x, z,
footprint, collider radius, damage, attractor radius/weight, chunkKey — plus
per-cluster rng draw counts from the canary). All SHALL appear in
`__dbg.help()` and DEBUGGING.md in the same commit that adds them.

#### Scenario: One call frames a hub
- **WHEN** `__dbg.gotoHub(0)` is called in a booted `?worldgen=1` session
- **THEN** the player teleports to the nearest hub, the camera locks to a 3/4
  overhead view of its stage, and the console prints the matching
  hub-sandbox.html URL

#### Scenario: Footprint decals clean up
- **WHEN** `showFootprints(false)` is called after decals were shown
- **THEN** the decal group's geometries and materials are disposed and no decal
  entries remain in the registry or the scene

### Requirement: One-command layout-snapshot capture
The system SHALL provide `bin/layout-snapshot <seed> [out.json]` wrapping boot →
settle (loaded-chunk count stable for 60 frames, no driving) → `dumpRegistry()`
→ normalize (sort kind+x+z, round 1e-4) → write
`verification/snapshots/<seed>.json`, with `--diff a b` and `--seeds` modes,
under a pinned capture protocol (`?worldgen=1`, pinned `?perf=` tier). A
twice-capture self-diff of the same seed/tier SHALL be empty before any
refactor diff is trusted, and the dump SHALL include per-cluster draw counts so
added/dropped draws are caught even when positions are unchanged.

#### Scenario: Refactor gate in two commands
- **WHEN** `bin/layout-snapshot 1234 before.json` runs pre-refactor and
  `bin/layout-snapshot 1234 after.json && bin/layout-snapshot --diff before.json
  after.json` runs post-refactor
- **THEN** the diff is empty for a behavior-preserving change, and any
  position OR draw-count delta is reported with its cluster

#### Scenario: Instrument self-test
- **WHEN** the same seed/tier is captured twice with no code change between
- **THEN** the self-diff is empty (otherwise the instrument, not the code, is
  fixed first)

### Requirement: Playtest marker hotkey + touch affordance
During gameplay a single keypress — AND on touch devices a deliberately
awkward-to-trigger gesture (e.g. triple-tap a HUD corner) — SHALL append
`{seed, x, z, heading, tod, sessionTime, note?}` to a persistent localStorage
list with a brief on-screen toast; the debug overlay's MARKERS section SHALL
list markers with per-marker editable note, copy-JSON, clear, and teleport
actions, and a keyboard-free copy affordance SHALL exist so markers captured on
a phone can be handed to an agent session. (-> Q4 answered 2026-06-10: touch
support is in scope for v1 — Gary playtests the live deploy on his phone.) The
hotkey SHALL NOT collide with existing gameplay/debug keys, and neither hotkey
nor gesture SHALL appear in player-facing copy.

#### Scenario: Feedback as coordinates
- **WHEN** Gary taps the marker key when he sees a layout problem mid-drive
- **THEN** a marker with seed + position + heading lands in localStorage, he can
  attach a note from the overlay afterward, and a later agent session can copy
  the list and `__dbg.teleport` (or open `hub-sandbox.html?at=x,z`) for each
  marker

#### Scenario: Phone playtest produces coordinates too
- **WHEN** Gary triggers the touch gesture during a playtest of the live deploy
  on his phone
- **THEN** the marker lands in that device's localStorage with a confirming
  toast, and the keyboard-free copy affordance can export the list
