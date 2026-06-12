# Layout snapshot baseline — worldgen-layout-harness (tasks 1.3 + 1.5)

Pre-refactor "built-truth" baseline the hoist (group 2) and the future
`festival-zone-grammar` extraction are gated against: the built world must not
change (empty `--diff`, including the per-cluster draw-count canary). These are
**layout snapshots**, NOT determinism goldens — see DEBUGGING.md "Layout
snapshots" for the vocabulary distinction.

Capture protocol (all files): `?worldgen=1&seed=<S>&perf=high`, crowd on, **no
driving**. Captured 2026-06-10 with `bin/layout-snapshot capture` (agent-browser
one-command path). Tier is pinned `high` — snapshots are only comparable at the
same tier (crowd-pool draws are tier-dependent).

## Baseline windows (task 1.5)

Three 300 m windows (±150 m) per seed. Window size is bounded so the high-tier
5×5 chunk load ring (a ±200 m square) fills the whole window from a single jump.
Non-spawn windows are reached with `--at x,z` (a `__dbg.teleport` jump — a debug
relocation, not driving); the player auto-relocates to the spawn hub at start, so
the spawn window needs no `--at`.

| File | seed | window | tier | bounds (minX,minZ,maxX,maxZ) | at (teleport) | entries | clusters |
|---|---|---|---|---|---|---|---|
| `1234.spawn.json` | 1234 | spawn | high | `111,-246,411,54` | — (spawn hub) | 794 | 15 |
| `1234.shore.json` | 1234 | shoreline | high | `-844,-31,-544,269` | `-694,119` | 578 | 7 |
| `1234.dense.json` | 1234 | dense | high | `-30,-950,270,-650` | `120,-800` | 553 | 9 |
| `0xf7ef2a3c.spawn.json` | 0xf7ef2a3c | spawn | high | `-444,-394,-144,-94` | — (spawn hub) | 514 | 11 |
| `0xf7ef2a3c.shore.json` | 0xf7ef2a3c | shoreline | high | `-502,-858,-202,-558` | `-352,-708` | 803 | 7 |
| `0xf7ef2a3c.dense.json` | 0xf7ef2a3c | dense | high | `-470,630,-170,930` | `-320,780` | 314 | 23 |
| `0xf7ef2a3d.spawn.json` | 0xf7ef2a3d | spawn | high | `-583,323,-283,623` | — (spawn hub) | 318 | 16 |
| `0xf7ef2a3d.shore.json` | 0xf7ef2a3d | shoreline | high | `-498,-445,-198,-145` | `-348,-295` | 713 | 14 |
| `0xf7ef2a3d.dense.json` | 0xf7ef2a3d | dense | high | `-630,-390,-330,-90` | `-480,-240` | 612 | 24 |

Seeds: `1234` (canonical), `0xf7ef2a3c` (round-2 playtest — the trucks-clipping-
vendor-rows seed, kept for the group-4 linter acceptance case), `0xf7ef2a3d` (the
"+1 fresh" third). Defined in `bin/layout-snapshot` `DEFAULT_SEEDS`.

### Noon/Midnight screenshot pairs (cosmetic catch)

Registry snapshots are positions only — they don't see color, emissive, or
lighting. One spawn-hub pair per seed catches cosmetic regressions the `--diff`
can't (`verification/screenshots/`), 3/4 elevated camLock on the spawn hub,
Noon = `tod(0.30)` / Midnight = `tod(0.75)`:

- `1234.spawn.{noon,midnight}.png`
- `0xf7ef2a3c.spawn.{noon,midnight}.png`
- `0xf7ef2a3d.spawn.{noon,midnight}.png`

## Twice-capture self-diff control (task 1.3)

The capture pipeline must be deterministic before any refactor diff is trusted:
two independent cold headless boots of the same seed/window/tier must produce a
byte-identical normalized snapshot (`--diff` EMPTY, canary included). Proven for
all three seeds on a **teleported** window (the riskiest path — teleport forces
spawn chunks to unload and a fresh vicinity to load):

| seed | control window | result |
|---|---|---|
| 1234 | shoreline (`--at -694,119`) | `EMPTY — layouts identical (578 entries, tier=high)` |
| 1234 | dense (`--at 120,-800`) | `EMPTY — layouts identical (553 entries, tier=high)` |
| 0xf7ef2a3c | dense (`--at -320,780`) | `EMPTY — layouts identical (314 entries, tier=high)` |
| 0xf7ef2a3d | dense (`--at -480,-240`) | `EMPTY — layouts identical (612 entries, tier=high)` |

Reproduce any control: capture the same `(seed, --bounds, --at, --tier)` twice
into two files, then `bin/layout-snapshot --diff a b` → exit 0 / `EMPTY`.

## How the windows were located (reproducible)

Windows are derived from the **worldgen plan in node** (deterministic), not
eyeballed in map-sandbox — more rigorous and re-runnable. For each seed, after
`setSeed(seed)`:

- **spawn** = 300 m box centered on `nearestMajorHeart(0,0)` — the game's
  spawn-relocation target (main.js:232). The player is already there at start.
- **shoreline** = 300 m box centered on the heart (within 1000 m of origin)
  whose center is closest to a lake outline (gap > 5 m, < 1 lake radius) — puts a
  hub and a lakeshore in the same frame for the `water-clear` rule.
- **dense** = 300 m box (20 m grid search within ±800 m of origin) maximizing the
  count of heart centers — the overlap-prone multi-hub case.

The exact centers/bounds above are the resolved output; re-run the finder (see
the session-log Work Log 2026-06-10 capture-pass entry) to regenerate them.

> The earlier unbounded `1234.json` (546 entries, hand-picked window, no recorded
> bounds → not reproducible) is **superseded** by `1234.spawn.json` and removed.
