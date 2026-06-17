# Hub viewer acceptance (task 6.3)

Diff the hub viewer's built sub-components against a game `dumpRegistry` at the
same seed/hub/tier, and account for every difference. Seed `1234`, spawn hub
`(1,-1)` @ (318,-93), tier `high`.

## Method

- **Game side:** the committed `verification/snapshots/1234.spawn.json` (the
  spawn-hub window, bounds `168,-243,468,57`, captured from the running game).
- **Viewer side:** `hub-sandbox.html?seed=1234&hub=0` →
  `window.__hubSandbox.dumpRegistry({minX:168,minZ:-243,maxX:468,maxZ:57})`.
- Compared chunkKey-agnostic (the viewer keys the whole hub `hub:1,-1`; the game
  spreads it across chunk keys) and normalized 1e-4 like `bin/layout-snapshot`.

## Result — the anchor is byte-perfect

**The spawn hub's main-stage deck: 21/21 viewer tiles exactly match a game tile**
(position + colliderR + damage). The stage is built from `mulberry32(clusterSeed)`,
which is chunk-independent, so the viewer (one hub at once) and the game (spread
across chunks) produce the identical deck. This is the load-bearing proof that
`buildHubPreview` reuses the real build path faithfully.

Across all festival kinds: **81 sub-components matched.**

## Every difference, explained (no STOP condition)

**only-in-game (75):** the game side is a 300×300 m *window*, not a *hub*, so it
contains things one isolated hub doesn't:
- **neighbour-hub clusters** whose centres fall in the window (other hearts' food
  courts / vendor rows / bubble vendors / a drum circle's `bench_ring`);
- **the spawn `arch`** (2 colliders at ~292,-79 / 298,-69) — built by
  `main.js buildSpawnArch`, NOT by `festivalPlan`, so the viewer *correctly* does
  not build it (festival.js emits no arch — "exactly one arch in the world");
- **camp villages** from coarse-grid cells outside this hub's `MAX_POI_REACH`.

**only-in-viewer (3):** `beach` + 2 lakeside `campsite`s at the hub's edge
(~185,-191). The viewer's `LakeManager.update(heart)` force-loads the hub's lakes
(+ their beach/camp decoration); the game hadn't streamed that lake in at the
moment the spawn snapshot was captured. Lake-load *timing*, not a build
difference.

**Not in the registry diff at all:** the crowd. NPCs aren't registry entries, so
crowd-pool state (the tier-dependent draw-order from D6) doesn't appear here —
and the stage deck matching 21/21 shows the crowd's rng draws during `buildStage`
landed identically for this hub.

## 10-rebuild leak check

`window.__hubSandbox.rebuild()` ×10, counting the windowed registry after each:

```
172, 172, 172, 172, 172, 172, 172, 172, 172, 172
```

Identical every time — `disposeChunkByKey` (task 6.1) tears the hub down cleanly,
no registry/side-list leak feeding back into `closestBuilding`.

## Verdict

Faithful. The anchor matches exactly; every diff is the window-vs-hub scope, the
main.js-owned arch, or lake-load timing — all expected, none a build divergence.
The hub viewer is trustworthy for grammar-change iteration.
