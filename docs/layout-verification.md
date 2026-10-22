# Layout verification

[Documentation index](README.md) · [Debugging reference](../DEBUGGING.md)

Run commands from the repository root. Read [browser safety and cleanup](browser-verification.md)
before automated capture. On Gary's Mac, use the manual recipe until the local
restriction on `bin/layout-snapshot capture` has been cleared by verification.
The automated commands below document the interface, not permission to bypass
that restriction. Use `mute=1` on every browser URL.

## Layout snapshots — capturing built truth

A **layout snapshot** is the registry, captured as data, normalized so two
captures can be compared byte for byte to answer whether the built world
changed. Determinism goldens in `selftest.js` cover the plan, while registry
snapshots cover its realized build. Use both when a change affects both layers.

Built truth lives in the **browser** (the registry is populated by `chunks.js`
running in a live scene — there is no headless *node* path). The dev server must
be running on `:8765` either way.

### The automated path (subject to local restrictions)

`bin/layout-snapshot capture <seed>` drives a headless browser via the globally
installed **`agent-browser`** CLI — boot → `__dbg.start()` → settle (poll the
registry count until stable) → dump → normalize → write, in one command:

```
bin/layout-snapshot capture 1234 --bounds 163,-186,403,54 --window spawn
# → verification/snapshots/1234.json   (omit --bounds for the whole world)
```

The twice-capture self-diff control is then just two runs + a diff:

```
bin/layout-snapshot capture 1234 verification/snapshots/1234.a.json --bounds 163,-186,403,54
bin/layout-snapshot capture 1234 verification/snapshots/1234.b.json --bounds 163,-186,403,54
bin/layout-snapshot --diff verification/snapshots/1234.a.json verification/snapshots/1234.b.json   # MUST be EMPTY
```

### Data-only mode and cleanup implementation

On a headless-only machine Chromium uses SwiftShader, and the full festival at
`perf=high` can consume every available CPU core before browser-control commands
get a turn. The capture command therefore opens a localhost-only
`?layoutCapture=1` mode. The ordinary update, chunk-streaming, registry, and
draw-count-canary paths still run on a yielding timer, but the composer skips
pixel rendering because pixels are not part of a layout snapshot.

The driver also owns one unique named browser session, uses a 320×180 viewport,
honors `--tier`, settles on the bounds-clipped registry count, and gives every
browser command a hard deadline. Its unconditional cleanup closes the named
session and compares exact automation PIDs against the pre-launch baseline. If
anything created by that invocation survives, it is terminated and the command
returns a cleanup failure instead of leaving a laptop-burning process behind.

Use `--command-timeout <ms>` to adjust the default 12-second command deadline
and `--settle-ms <ms>` to adjust the minimum five-second settle window. A
successful snapshot proves data determinism only; use the sandbox or full game
for pixels, draw/tris counters, lighting, and visual quality. If the installed
browser CLI is absent or genuinely broken, use the manual recipe below.

### The manual recipe (approved fallback if agent-browser is flaky/absent)

`bin/layout-snapshot --recipe <seed>` (or `--seeds` for the multi-seed playbook)
prints a browser-console recipe (older output may label the steps `preview_*`): boot `?worldgen=1&seed=<S>&perf=high&mute=1`,
`__dbg.start()`, settle (read `window.__dbg.dumpRegistry().length` until stable —
NO driving), then
`({entries: __dbg.dumpRegistry(B), drawCounts: __dbg.dumpDrawCounts(B)})`, save
to `verification/raw/<seed>.json`, and `bin/layout-snapshot <seed>` to normalize.

### What normalize guarantees

Either path, `bin/layout-snapshot` **drops the two moving kinds** (`lurleen`,
`hula_hoop`) — they're actors, not layout, and would make a self-diff differ
forever. It rounds coords to `1e-4` and sorts by `kind+x+z` so identical builds
serialize identically. Capture defaults to `perf=high` and records the selected
`--tier` because built truth is tier-dependent today (crowd draws from the
cluster rng stream). `--diff` exits
`0` (`EMPTY`) when layouts match, `1` with a per-kind report otherwise, and flags
per-cluster draw-count (canary) drift even when every position still matches.

## Layout linter — checking arrangement against rules

A **layout snapshot** captures *what* the world built; the **linter**
(`src/worldgen/lint.js`, run via `bin/lint`) checks whether that arrangement is
*good* — nothing clipping, dancefloors clear, booths off the road, stages spaced.
It's the detector that used to be "Gary driving around noticing things." Two
modes (design D-D — **registry is the authority**):

| Mode | Over what | Needs | Precision |
|---|---|---|---|
| **plan** | the worldgen PLAN's analytic cluster extents | nothing — pure node | approximate (cluster-center circles) |
| **registry** | EXACT built sub-component positions in a snapshot | a `bin/layout-snapshot` file | exact |

```
bin/lint --seeds 10                                  # plan-mode sweep, 10 seeds, headless
bin/lint --seed-list 1234,0xf7ef2a3c --bounds -1000,-1000,1000,1000
bin/lint verification/snapshots/0xf7ef2a3c.spawn.json # registry mode (PRIMARY) — no game needed
bin/lint <snap.json> --json                          # raw violations payload
```

Exit code: `0` clean, `2` if any **error**-severity rule fired (CI-friendly).
Every violation carries the full **eyes pipeline** — a 2D `map-sandbox` link, a
3D `hub-sandbox` link (`?at=x,z`; the viewer lands in group 6, the link is
forward-compatible today), and a paste-ready `__dbg.teleport(x,z)` snippet — so a
finding is one click from a look in any surface.

**The link seed is decimal, on purpose.** Both `main.js` and `map-sandbox.html`
resolve `?seed=` as `/^-?\d+$/.test(raw) ? Number(raw) : FNV(raw)`. A decimal
string round-trips to the exact same `SESSION_SEED`; a `0x…` hex string would
fall to the FNV path and open a *different* world. So links emit the decimal
session seed even though findings *display* the `0x…` form.

Rules (registry mode): `overlap` (exact collider interpenetration > 0.5 m, minus
an allowed-pairs table of same-cluster adjacencies — stage-deck tiles, the
arch's segments, a drum circle's firepit-in-bench-ring), `water-clear`,
`dancefloor-clear`, `booth-on-road`, `potty-attached`, `amenity-bundle` (every
high-intensity node — a stage deck, a food-truck court — must have >= 3 of the 5
welfare classes within `AMENITY_BUNDLE_RADIUS`: toilets / water / shade-seating /
info / special service), `camp-welfare` (a camp village — a campsite cluster at or
above `CAMP_WELFARE_MIN_SITES` pitches, which excludes the 3-5 site wild-camping
scatter — needs a porta-potty within `CAMP_WELFARE_RADIUS`), `truck-off-road`,
`drum-in-trees` (the woodland drum circle must sit in a treed pocket and not inside
another cluster's envelope — Gary saw one inside a food-truck circle), and
`arch-placement` (the spawn arch must be over a road, outside dancefloors, and
≥ `ARCH_MIN_STAGE_DIST` from the stage). Scenery (`forest_tree`, `lake_edge`,
`shore`, `path_node`, `lamppost`) is excluded so the report is festival clutter,
not 1000-tree forest density. Plan mode adds the cross-hub `stage-spacing` and
`spawn-arrival` rules, plus an approximate `drum-in-trees` (density-field proxy).
Plan mode also runs its own `amenity-bundle`, counting classes analytically off the
`welfare_post` tiers. **The seed a snapshot stores is the raw `?seed=` text**, and
registry mode resolves it the way `main.js` does (digits-only -> number, else FNV) —
before that fix every geometric registry rule silently reasoned about a different
world than the entries were captured from.
The `drum-in-trees` / `arch-placement` thresholds (`DRUM_TREE_RADIUS`,
`DRUM_TREE_MIN`, `DRUM_TREE_MIN_DENSITY`, `ARCH_MIN_STAGE_DIST`) are tunable in
`FESTIVAL_TUNING`.

The original baseline predates the shipped `festival-zone-grammar` change.
Compare against the baseline appropriate to the change being tested, investigate
new violations, and distinguish a real layout problem from a false-positive rule.

`__dbg.gotoHub(n)` prints the plan-mode violations for the hub it teleports to,
so touring hubs surfaces their findings inline.
