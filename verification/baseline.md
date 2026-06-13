# Layout baseline — pre-grammar violation counts

> **Generated 2026-06-13** by the group-4 linter (`src/worldgen/lint.js`) over
> 10 built-truth snapshots captured at `?worldgen=1&perf=high`, spawn-hub
> window per seed (boot → `__dbg.start()` → settle → `dumpRegistry()`). This is
> **task 8.1** — the number `festival-zone-grammar` must drive DOWN.
>
> **RECORD, do NOT fix.** Every count below is a *known* pre-grammar problem. The
> harness change ships the measurement; the grammar change ships the fix. A firing
> rule here is the instrument working (guardrail #1).

## How to read this

Two linters look at the same world. **Registry mode** (the authority) reads the
EXACT built sub-components from each snapshot. **Plan mode** reasons over the
planner's analytic cluster circles — approximate, but it needs no capture. The
gap between them (last section) is itself a tracked number: where plan says
"fine" but registry says "clipping," the planner is blind to a build-half extent.

Reproduce: `bin/lint verification/snapshots/baseline/<seed>.json` (registry) or
`bin/lint --seed-list <seed>` (plan). Every row links to a 2D map view and a 3D
hub view (the `hub_preview` viewer lands in group 6; the links are live then).

**Window caveat:** the first 3 seeds (`1234`/`0xf7ef2a3c`/`0xf7ef2a3d`) were
captured over the full load-ring (more hubs in view); the other 7 over a tight
±280 m spawn-hub box. So compare cross-seed via the **per-seed solid counts**
(exposure), not raw violation totals. The **worst-offenders** list below is sorted
by collider penetration and is exposure-independent — the most actionable view.

## Registry mode (the authority) — per-rule totals

Across 10 seeds, 1295 festival solids.

| Rule | Severity | Total | Worst seed (count) | See it (2D / 3D) |
|---|---|---:|---|---|
| `water-clear` | error | 58 | `256` (0x2bdb2f22) ×29 | [2D](map-sandbox.html?seed=735784738&cx=262&cz=-265&zoom=2) · [3D](sandbox.html?entity=hub_preview&seed=735784738&at=262,-265) |
| `overlap` | error | 48 | `99` (0x14fea6f7) ×12 | [2D](map-sandbox.html?seed=4257489661&cx=342&cz=-38&zoom=2) · [3D](sandbox.html?entity=hub_preview&seed=4257489661&at=342,-38) |
| `booth-on-road` | warn | 74 | `0xC0FFEE` (0xd51c4320) ×30 | [2D](map-sandbox.html?seed=3575399200&cx=609&cz=-321&zoom=2) · [3D](sandbox.html?entity=hub_preview&seed=3575399200&at=609,-321) |
| `dancefloor-clear` | warn | 10 | `0xC0FFEE` (0xd51c4320) ×5 | [2D](map-sandbox.html?seed=3575399200&cx=698&cz=-90&zoom=2) · [3D](sandbox.html?entity=hub_preview&seed=3575399200&at=698,-90) |
| `potty-attached` | warn | 8 | `0xf7ef2a3d` (0x65dfa05f) ×2 | [2D](map-sandbox.html?seed=3575399200&cx=725&cz=-162&zoom=2) · [3D](sandbox.html?entity=hub_preview&seed=3575399200&at=725,-162) |

**Totals: 106 error, 92 warn.**

## Per-seed registry breakdown

| Seed | World hash | Solids | Violations | Heaviest rule |
|---|---|---:|---:|---|
| `0xC0FFEE` | 0xd51c4320 | 161 | 45 | booth-on-road ×30 |
| `0xf7ef2a3c` | 0x62df9ba6 | 111 | 18 | booth-on-road ×13 |
| `0xf7ef2a3d` | 0x65dfa05f | 61 | 10 | booth-on-road ×6 |
| `1001` | 0x2397cc57 | 73 | 10 | booth-on-road ×5 |
| `1234` | 0xfdc422fd | 142 | 14 | booth-on-road ×7 |
| `256` | 0x2bdb2f22 | 140 | 37 | water-clear ×29 |
| `31337` | 0x1e2aa9d0 | 154 | 14 | booth-on-road ×9 |
| `42` | 0x87e38583 | 80 | 3 | overlap ×2 |
| `7` | 0x320ca3f6 | 119 | 3 | overlap ×3 |
| `99` | 0x14fea6f7 | 254 | 44 | water-clear ×28 |

## Worst offenders — the deepest clips

The single worst arrangement failures (by collider interpenetration). These are
the hubs to point a non-engineer at — "see, that booth is inside that truck."

| # | Seed | Penetration | What | Teleport |
|---|---|---:|---|---|
| 1 | `1234` | 7.5m | tent × truck colliders overlap by 7.5m | `__dbg.teleport(342, -38)` |
| 2 | `31337` | 6.8m | tent × truck colliders overlap by 6.8m | `__dbg.teleport(12, -68)` |
| 3 | `0xf7ef2a3d` | 6.7m | truck × truck colliders overlap by 6.7m | `__dbg.teleport(-469, 589)` |
| 4 | `42` | 6.4m | campsite × truck colliders overlap by 6.4m | `__dbg.teleport(971, 788)` |
| 5 | `0xC0FFEE` | 6.2m | campsite × truck colliders overlap by 6.2m | `__dbg.teleport(816, -327)` |
| 6 | `0xf7ef2a3c` | 5.8m | tent × truck colliders overlap by 5.8m | `__dbg.teleport(-377, -262)` |
| 7 | `256` | 5.6m | tent × truck colliders overlap by 5.6m | `__dbg.teleport(175, -111)` |
| 8 | `99` | 5.4m | campsite × truck colliders overlap by 5.4m | `__dbg.teleport(121, 71)` |

Screenshots of the top 3 (in-game `topDown` + `showFootprints` at the seed/coords
above; the group-6 hub viewer will render these natively once it lands):

- `baseline-offender-1234.png` — seed 1234, tent × truck 7.5m @ (342,-38)
- `baseline-offender-31337.png` — seed 31337, tent × truck 6.8m @ (12,-68)
- `baseline-offender-0xf7ef2a3d.png` — seed 0xf7ef2a3d, truck × truck 6.7m @ (-469,589)

## Plan-mode counts + the headless-vs-built gap

Plan mode over the same per-seed windows (approximate; no capture needed):

| Rule | Severity | Plan total |
|---|---|---:|
| `water-clear` | error | 72 |
| `spawn-arrival` | error | 4 |
| `overlap` | warn | 632 |
| `stage-spacing` | warn | 29 |

**The gap that matters** (shared rules, plan vs registry):

| Rule | Plan (approx) | Registry (exact) | Reading |
|---|---:|---:|---|
| `overlap` | 632 | 48 | plan circles over-count (stage clearings); registry is the real clip count |
| `water-clear` | 72 | 58 | cluster-center vs every sub-component in water |
| `truck-off-road` | 0 | 0 | court-center vs every individual truck stranded |

Plan mode is a cheap early-warning that needs no capture; registry mode is what
the grammar change is graded against. When they disagree, registry wins (D-D).

