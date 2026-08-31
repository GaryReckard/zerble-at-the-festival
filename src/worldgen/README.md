# worldgen — the render-agnostic infinite-world layout generator

This is the **layout brain** for Zerble's procedural world. It is a pure,
deterministic function of `(seed, x, z)` that returns *data* — no `three`, no
DOM, no rendering. The 2D map sandbox draws it today; the 3D world and a future
in-game map view will consume the *same* generator (single source of truth).

> **Two near-identically-named sandboxes — don't confuse them:**
> `sandbox.html` = **one model in 3D** (entity viewer).
> `map-sandbox.html` = **the whole world layout in 2D top-down** (this thing).

## How to look at it (verify)

```
python3 .claude/serve_nocache.py 8765
# → http://127.0.0.1:8765/map-sandbox.html?seed=1234
```

- **TUNING · LIVE** (right panel): drag sliders → the map re-rolls instantly.
  `copy CONFIG` dumps your tuned values as JSON; `defaults` resets.
- **Layer toggles** (left): hearts / roads / water / tree-density / role tiers /
  grid — flip each on/off to inspect one layer in isolation.
- **Point inspector** (bottom-left): hover/click → the full layout tuple for
  that world coordinate, including a "would host" hint (see below).
- **self-test** button: runs the determinism harness and reports PASS/FAIL with
  the offending coordinate + golden hash. `runSelfTest()` returns
  `{ pass, teeth, results, goldenHash, poiGoldenHash }`: **`pass`** is the gate —
  generator CORRECTNESS (contract tests T1/T2/T4/T6), trustworthy as a green/red
  check; **`teeth`** is an advisory confirming the negative controls (T3/T5) found
  the contract tests non-vacuous (it never gates, so an under-sampled control can't
  paint `pass` red on a correct generator). Runnable headless:
  `node --input-type=module -e "import('./src/worldgen/selftest.js').then(m=>{const r=m.runSelfTest();console.log('pass',r.pass,'teeth',r.teeth)})"`
- `?seed=&cx=&cz=&zoom=&layers=` deep-links any view; `window.__mapSandbox`
  exposes `{ seed, view, config, queryPoint, queryRegion, setView, setSeed,
  setConfig, runSelfTest }` for scripted inspection.

## Glossary (what the terms mean)

- **Heart** — a festival *anchor*: a center that the world organizes around
  (think "a town" in real geography). Rare and rank-weighted. Everything near a
  heart orients to it; the empty space *between* hearts is the outskirts. This
  is the central-place idea that gives an infinite world intentional structure
  without any global plan.
  - **rank** — `minor` (a local cluster) or `major` (a big regional hub). *(The
    even-rarer `mega`, a 2×2-cell super-hub, is specced but cut from this change
    — it lands with the 3D integration.)*
  - **core** — the dense inner radius of a heart (the main action).
  - **district** — the looser outer radius (still "belongs to" the heart).
  - **influence** — a continuous `0..1` scalar: `1` at the heart center, fading
    to `0` at the district edge. Carried so a future 3D arrival-ramp / map
    shading is a read, not a re-derivation.
- **Heart cell** — the coarse macrocell grid hearts are seeded on (one candidate
  per cell, most cells empty). `HEART_CELL` is its size in meters.
- **Jitter** — how far a heart wanders off its cell center (fraction of a cell).
  Higher jitter fights the "grid of dots" look.
- **Role tier** — a location's job, derived from its nearest heart:
  `core` → `district` → `outskirts`. This is the **substrate** the theme layer
  reads (see below).
- **Arterial / collector / footpath** — the road hierarchy. *Arterials* connect
  hearts (the skeleton); *collectors* branch toward mid-tier clusters;
  *footpaths* are the fine local tier. (Arterials land at GATE 2; collectors +
  footpaths are parked to a follow-up.)
- **Lake** — a body of water on its own macrocell grid, with an elongated/lobed
  outline (oval, peanut, kidney — not just circles). `noBuild`/water.
- **Tree-density** — a continuous `0..1` field: high in the outskirts, cleared
  near heart cores and over water/roads. "Forest" is where it's high.
- **noBuild** — composite "nothing places here": `inLake || onRiver ||
  on a road corridor`.
- **footprint** — a suggested clear-radius (m) for a placement at this spot.
- **facing** — radians: which way a placement should face (toward the nearest
  road — the structural fix for the live "stages-on-roads" bug). Populated at
  GATE 2.
- **lifecycle** — `persistent`: worldgen features carry **no `chunkKey`** (like
  `lakes.js`). The 3D port must register them so they survive a host chunk
  unloading (footgun #5).
- **groundY** — reserved; always `0` (terrain is flat today).
- **seed** — set once via `setSeed` (→ `rng.setSessionSeed`, the same door
  `?seed=` uses in the game). Same seed → same world, everywhere.

## How food trucks / vendor rows / porta-potties / campsites are represented

> **UPDATE (2026-06):** the festival POI layer below has since SHIPPED —
> `festival.js` (`festivalPlan` + `campVillagesNear`) now emits stages / courts /
> vendor rows / bubble vendors / drum circles / welfare posts / camp villages, and
> `placement.js` filters them per-chunk for `chunks.js` to build. See "The
> festival layer + harness modules" at the bottom. The skeleton description below
> is still accurate; the "theme layer at 3D integration time" framing is now the
> shipped `festival.js`/`placement.js` path.

**They are not (yet) features the generator emits.** The generator produces the
*skeleton* — hearts, roles, roads, water, tree-density. The actual prop
*themes* (food-truck clusters, vendor rows, porta-potty banks, campsites) are
placed by the **theme layer at 3D integration time**, *guided by* this skeleton:

| Location's substrate | Theme layer would place |
|---|---|
| **major core** | main stage · food-truck court · vendor rows |
| **minor core** | side stage · food trucks · vendor tents |
| **major district** | campsites · drum circles · porta-potty banks |
| **minor district** | campsites · small vendors · porta-potties |
| **outskirts** | open field / forest |
| **in lake / on road** | nothing (`noBuild`) |

Each placement reads `roleTier` + heart `rank` (what to place), `facing` (which
way — toward the road), `footprint` (how much clear space), and `noBuild`
(can't place here). The map sandbox's inspector shows this mapping as the "would
host" line so you can see it while tuning. The actual prop builders already
exist in the live game (`chunks.js` theme builders); the integration change
rewires them to be placed by this generator instead of the current per-chunk
dice roll.

## Layered pipeline (generation order)

```
hearts → water (lakes; rivers cut, contract-stubbed) → roads (arterials; CG3)
       → tree-density → per-location role + off-road anchor → queryPoint tuple
```

## Determinism contract (footgun #4)

- Everything is a hash of integer coordinates (`rng.js` `cellHash`/`edgeHash`/
  `pairHash`, all built on `hash2`/`worldHash`). **Reuse these — never fork the
  seeding scheme.**
- **Quantize** any float before it reaches a hash input or a `<`/`===`
  threshold (`Math.sin/cos/atan2/hypot/pow` are not bit-identical across JS
  engines). Edge ids are canonical `(min,max)` so both sides agree.
- The tuple is **append-only** across the 2D→3D boundary: the 3D port may add
  fields, never reorder or re-salt the draws that produce existing ones.
- `selftest.js` has real teeth: window-invariance + negative control + bit-exact
  boundary + serialize round-trip + a checked-in cross-engine golden hash.

## The festival layer + harness modules

Beyond the skeleton, `worldgen/` now owns the festival's **arrangement** and the
tooling that verifies it (the `worldgen-layout-harness` change):

- **`festival.js`** — the POI layer. `festivalPlan(heart)` is a memoized,
  `(seed,epoch)`-gated, deterministic list of cluster descriptors (stage / food
  court / vendor row / bubble vendor / drum circle / welfare post) anchored off a
  heart + its approach roads; `campVillagesNear(bounds)` adds the back-of-festival
  camps on a coarse grid. `placement.js` (`placeChunkProps`) filters by
  cluster-center ownership so a chunk builds the clusters whose center it owns.
- **`tuning.js`** — `FESTIVAL_TUNING`, the single mutable surface for the
  distances *between* placed things (ring radii, row spacing/offset, dancefloor
  bases, walk distances, cluster counts, `KIND_FOOTPRINT`) + a few linter
  thresholds. `MODEL_DIMS` copies a handful of model dimensions the node linter
  can't import; `chunks.js` drift-asserts them. `clusterExtent(kind, scale)` is
  the analytic outer-radius the plan-mode linter + map overlay use.
- **`lint.js`** — the quality linter (`bin/lint`). **Plan mode** reasons over
  `festivalPlan` + `clusterExtent` (headless, approximate, multi-seed);
  **registry mode** (the authority) reasons over the *exact* built sub-components
  in a `bin/layout-snapshot` capture. Every violation carries 2D/3D/teleport
  links. See `verification/baseline.md` for the pre-grammar baseline counts.

### Built-truth substrate

The generator's *plan* is covered by the determinism goldens; the *built* world
(what `chunks.js` actually constructs) is captured as data by
`__dbg.dumpRegistry` + `bin/layout-snapshot` → `verification/snapshots/`. That's
what registry-mode lint audits and what behaviour-preservation refactors diff
against. The **hub viewer** (`hub-sandbox.html` → `buildHubPreview` in
`chunks.js`) renders one whole hub through the exact build path for 3D iteration.

### The two binding rules

- **Dependency direction.** `worldgen/` imports **nothing outward** — never
  `chunks.js` / `registry.js` / `lakes.js` / `models/*`. That's what lets the
  node linter and the map sandbox import it freely. Arrows point *into*
  `worldgen/`, never out. (`constants.js` / `tuning.js` import nothing at all.)
- **Environment injection.** Where layout logic needs a world query the pure
  layer can't own (is this point in water? blocked?), the *caller* injects it:
  the game passes its `isPointInLake` closure, the linter/overlay pass worldgen
  `lakeAt`. A shoreline divergence between the two is tagged informational, not a
  determinism bug.

### Deferred: the dry-run builder extraction

Making the `chunks.js` builders express their sub-component layouts as pure data
(descriptor in → positions/radii out, no `three`) was **deferred to
`festival-zone-grammar`** (deliberation 001 / design D-C′) — it has to land under
that change's already-moving golden, because the builders' cosmetic `rng` draws,
the tier-dependent `crowd.spawn`, and `registry.closestBuilding` guards can't be
extracted without touching draw order. This harness change built the *eyes* (hub
viewer, overlay) and the *ruler* (linter + baseline) that the extraction is
measured against.
