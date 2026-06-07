## Architect's Position

Scope reviewed: design.md D-K..D-Q (and D-A..D-J for compliance), tasks.md D2.1–D2.8,
`src/worldgen/{index,constants,hearts,roads,placement}.js`, `src/chunks.js` v2 path
(`_generateWorldgen` / `placeWorldgenProps` / `buildWorldgenKind`) + the legacy cluster
builders (`buildFoodCourtAt`, `buildCampVillage`, `placeCampsiteClump`, `pickPottyAnchor`,
`scatterPortaPotties`, `buildStage`), `src/registry.js` (`byChunk`/`removeChunk`/`closestBuilding`),
`src/lakes.js` (lakeside ring + no-chunkKey rationale), and the importmap arrays in
`index.html` / `sandbox.html` / `map-sandbox.html`.

### Priority Sequence

The redesign is well-grounded structurally — the thesis ("port the tuned rules, re-anchor
off the chunk grid") is exactly the right architectural correction, and the proposed shape
(D-N) is genuinely D-A compliant (see below). My ordering optimizes for *proving the
contract boundaries before pouring content through them*, so a determinism or lifecycle
break is caught while one file is in flight, not after all eight tasks land.

1. **D2.2 first — the three additive worldgen exports, with the self-test as the gate.**
   `approachRoadsOf`, `nearestMajorHeart`, `shoreBand` are the new substrate the whole
   redesign stands on. They MUST be append-only — adding functions, never reordering or
   re-salting an existing `rng()` draw (footgun #4; the contract header in `index.js:11`).
   `approachRoadsOf` is a *compose* of existing pure functions (`neighborsOf` + `arterial`
   + `heartProxy`) — verify it introduces zero new draws and reuses `SALT.roadPair` reads
   only. Run `worldgen/selftest.js` and confirm 20/20 + golden `63c8dea2` *before* writing
   a line of `festival.js`. If an export accidentally consumes a stream, you want to know
   now, not after the POI layer is seeded off it.

2. **D2.1 + D2.7 (determinism half) together — `festival.js` as a pure, gated, bounded
   cache that mirrors the existing worldgen caches *exactly*.** The memo gate, the map
   bound, and the trig-quantize discipline are not separable from writing the module —
   they ARE the module's correctness. Copy the `hearts.js:20`/`roads.js:182-189` pattern
   verbatim (gate string `seed + ':' + epoch`, `_cache.clear()` on gate flip, `size >
   limit` evict). Fresh `SALT.poiLayout = 0x4D41_0B`; quantize every bearing-derived
   coordinate (`Math.cos/sin/atan2` results) before any threshold compare or before it
   becomes a stored POI coordinate.

3. **D2.5 — wire the per-chunk filter through `placeChunkProps`, content still empty.**
   Prove the *ownership* plumbing (enumerate hearts widened by max-POI-reach → memoized
   `festivalPlan` → keep POIs centered in this chunk) boots clean and the self-test stays
   green, before any cluster builder fires. This is where the "is it still a sampler"
   question is answered structurally (see Structural Risks #1).

4. **D2.3 + D2.4 — the cluster build half in `chunks.js`.** Re-anchor the tuned numbers.
   This is mechanical re-parameterization of builders that already exist and are already
   chunk-keyed (`buildFoodCourtAt`, the camp-village packing loop, `buildStage`,
   `buildDrumCircleAt`, `buildVendorAt`, `buildPottyBankAt`). The one genuinely-new bug to
   fix is the truck-ring overlap guard (D-M, `chunks.js:1041` has no inter-truck check).

5. **D2.6 — spawn relocation in `main.js`/`world.js`.** Pure game-side query off
   `nearestMajorHeart`; layout untouched. Sequence it after clusters exist so the arch +
   stage it relocates the player to actually render.

6. **D2.8 — boot the REAL game at four region types, both ToD, all three perf tiers.**
   Non-negotiable: sandbox-pass ≠ game-pass. The `{group,...}` vs bare-`Group`
   return-shape footgun is live here — `buildWorldgenKind` (`chunks.js:957`) already has
   per-builder extraction comments precisely because that class of bug crashed a prior
   change at world generation. Any new cluster builder must declare its return shape.

### Structural Risks Identified

- **The memoized `festivalPlan` is structurally a per-chunk sampler, NOT a heart lifecycle
  manager — *provided* one rule holds: the plan is a pure DATA function, and `chunks.js`
  still owns build + ownership + disposal.** This is the load-bearing question (open Q2)
  and my read is it PASSES D-A, but the boundary is thin. D-A's rejected alternative was a
  `HeartManager` that "builds a whole heart's worth of geometry on distance"
  (`design.md:67-71`) — i.e. a thing that *owns meshes and a load/unload lifecycle*.
  `festivalPlan(heart)` owns neither: it returns `[{kind,x,z,yaw,...}]` descriptors (same
  category as `placeChunkProps`'s current return), the chunk that contains a POI's *center*
  builds and chunk-keys it (D-N, exactly the legacy `buildCampVillage` pattern at
  `chunks.js:1849`), and `registry.removeChunk(key)` still sweeps by `chunkKey` identity
  (`registry.js:59`) with zero heart-awareness. The memo is a *compute cache* gated on
  `(seed, epoch)` — categorically the same as `hearts.js:_cache` and `roads.js:_arterialCache`
  — not a *content cache* tracking what's loaded. **The drift risk is in the implementation,
  not the design:** if `festival.js` ever holds a `Set` of "built" POIs, a reference to a
  THREE object, or anything that mutates as chunks load/unload, it has become a lifecycle
  manager by the back door and breaks D-A + the module-purity rule (`placement.js:4`, no
  `three`/`models` import). Mitigation: assert in D2.1 that `festival.js` imports nothing
  from `three`/`models/*`, holds only `(seed,epoch)`-gated immutable plans, and is
  re-runnable headlessly in node (the determinism harness already proves this for the
  other worldgen modules).

- **Cluster-spill disposal is sound for chunk-keyed clusters but has TWO concrete failure
  modes the design must call out.** (a) **The whole cluster must be chunk-keyed to its
  OWNER and parented to the owner's `ctx.group`** — exactly as `buildCampVillage` does
  ("although the campsite groups visually extend into 3 neighbor chunks, they stay parented
  to THIS chunk's group so they unload as a unit," `chunks.js:1846`). A food-court ring or
  village whose meshes get added to a *neighbor* chunk's group, or registered with a
  *neighbor's* chunkKey, will leak or vanish-mid-game. The design says "spills into
  neighbors" (D-N) — verify in D2.5 that "spills" means *geometry extends past the cell
  boundary*, NOT *registers under a different chunkKey*. (b) **`shack.userData.cookEntry.chunkKey`
  must be stamped to the OWNER chunk** — `buildFoodCourtAt:1052` and `buildVendorAt:997`
  already do this; the redesign must preserve it or the sugar-shack cook patrol leaks on
  unload (the cook is swept in `removeChunk`'s companion sweep at `chunks.js:385`).

- **`region.hearts` is too narrow for the new ownership scan and the design under-specifies
  the fix.** `_generateWorldgen` calls `queryRegion` with the chunk's 80m AABB
  (`chunks.js:510`), and `heartsInBounds` pads by only **1 cell** (`hearts.js:84-88`). A
  major heart's district is 1000m (`constants.js:17`) and its road-courts sit "100+ m from
  its center chunk" (briefing Q4). D-N's "enumerate the relevant hearts (`heartsInBounds`
  widened by the max POI reach)" is the right instinct, but **the widened scan must NOT go
  through the existing `region` field** — `placeChunkProps` currently reads `region.hearts`
  (`placement.js:117`), which is the *narrow* AABB result. The redesign needs a SEPARATE,
  wider heart enumeration for ownership (e.g. `heartsInBounds` over `[center ± maxPOIReach]`)
  while keeping the existing 80m `queryRegion` for roads/scatter. Conflating them either
  misses a cluster whose center is in this chunk (under-scan → silent missing food court)
  or balloons the per-chunk cost past the 8ms R7 gate (over-scan → frame stall). This is an
  explicit boundary the design leaves to "widened by max POI reach" without naming the
  reach value or which code path carries it. Recommend D2.5 pin the reach to a named
  constant derived from the catalog (court ≤120m, D-M) and document that the ownership scan
  is distinct from the AABB `queryRegion`.

- **Window-invariance is a REAL determinism trap here, not a formality, because POIs are
  seeded off a heart but FILTERED by a moving chunk window.** D2.7's "POI window-invariance
  sanity check" is correctly identified. The danger class: chunk A computes `festivalPlan(H)`
  and keeps POI p because p's center is in A; chunk B (which can see H in its wider scan)
  must compute the *identical* plan and agree p is NOT in B. If the heart-enumeration window
  is asymmetric, or if `festivalPlan` ever reads anything window-relative (it must be a pure
  function of `heart` + seed only), two chunks disagree on a cluster's existence — exactly
  the T2/T4 catch (`design.md:274`). Mitigation: `festivalPlan(heart)` takes ONLY the heart
  (no bounds, no cx/cz-of-the-querying-chunk), is seeded `cellRng(heart.cx, heart.cz,
  SALT.poiLayout)`, and the window only ever *filters* its output. The road-shared content
  must use `pairRng(H, nb, SALT.poiLayout)` so both hearts independently agree (the
  `arterialPolyline:127` trick) — never `cellRng` on one endpoint for content that lives on
  a shared street.

- **Importmap maintenance spans THREE html files for this module, and the design names two.**
  `festival.js` is a worldgen module. The tripwire (no-build.md) says add to `index.html` AND
  `sandbox.html`. But it is ALSO a candidate for `map-sandbox.html`'s `wg` array
  (`map-sandbox.html:26-28`) — the 2D world-layout sandbox is the primary verification
  surface for a pure POI layer (briefing line 95: "verified via map-sandbox + booted game").
  If `festival.js` is to be visualized/tuned in map-sandbox (it should be — that's where the
  cluster READ gets eyeballed before the game), it needs the `wg` entry too, or its edits
  won't hot-reload there. Three files, not two. Minor but it's a silent-bite footgun.

- **The new mesh builders need sandbox cases; the pure layer does not.** `festival.js` is
  DATA (no sandbox entity). But D2.3/D2.4 re-anchor builders, and if any produces a *new*
  composite (e.g. a "food_court ring" as a distinct entity, or a re-shaped camp village),
  the sandbox-and-testing rule applies: a new model isn't done without a sandbox entry +
  the `loadEntity` switch case + importmap `models` entry. The existing builders
  (`buildStage`, `buildFoodCourtAt`, etc.) already have sandbox coverage via their
  underlying models; verify nothing genuinely-new escapes that net. The composite-sandbox
  doctrine (a village reads only as a village in a clump) means a `camp_village` or
  `food_court` composite sandbox case is the right verification surface for D2.8's "villages
  clump / no solo shacks" check — extend the harness rather than only booting the game.

- **Module-boundary check on `festival.js` imports passes the design, but watch the
  `roles`/`density` couplings.** D-L permits `festival.js` to import `hearts/roads/water/
  density/roles`. That's clean (all pure data). The one thing to forbid: `festival.js` must
  not import `placement.js` or vice-versa in a cycle, and must not import `chunks.js`
  (build half) — the data→build direction is one-way (`placement.js:4-6`). The catalog
  decision (D-M, what kinds/counts) lives in the pure layer; the build (`buildX` →
  `THREE.Group` at origin → caller positions) stays in `chunks.js`. That is the correct
  model-returns-Group / caller-positions boundary and the redesign keeps it.

- **Spawn-clearance replacing the spawn-corridor hack is a structural improvement, but it
  moves a guarantee from layout-time to query-time.** The legacy `cx===0,cz===1` corridor
  special-case (`chunks.js:572`) existed because the dice could stamp a deck at spawn. D-O
  replaces it with a spawn-clearance rule (no large collider within N m of the relocated
  spawn). Structurally cleaner — but the clearance must be enforced as a *placement
  veto* the owning chunk honors, not a post-hoc removal (removing a registered collider
  after the fact would orphan its mesh and break the `byChunk` sweep accounting). Verify
  D2.6 implements clearance as "don't place a large-collider POI within N m of spawn"
  (a `festivalPlan` filter or a `placeChunkProps` reject), not "delete it after."

### Verdict

- **Verdict**: **Proceed with mitigations**
- **Key Concern**: The widened heart-ownership scan (D-N) is under-specified at the code
  boundary — it must be a SEPARATE wider `heartsInBounds` enumeration sized to a named
  max-POI-reach constant, distinct from the existing 80m `queryRegion` that
  `placeChunkProps` reads today (`placement.js:117`, `chunks.js:510`). Conflating them
  either silently drops clusters whose center is in the chunk or blows the 8ms R7 per-chunk
  gate. Pin the reach value and document the two-scan distinction in D2.5 before building.
- **Recommendation**: The architecture is sound and the thesis is correct — `festivalPlan`
  is a per-chunk DATA sampler (D-A compliant), not a lifecycle manager, *as long as* it
  imports no `three`/`models`, holds only `(seed,epoch)`-gated immutable plans, and
  `chunks.js` retains build + chunk-key ownership + disposal exactly as `buildCampVillage`
  already proves. Proceed once these mitigations are baked into the tasks: (1) the two-scan
  ownership-vs-AABB distinction with a named reach constant; (2) `festival.js` purity +
  gated-bounded cache mirroring `hearts.js`/`roads.js`; (3) clusters chunk-keyed to their
  owner and parented to the owner's group, `cookEntry.chunkKey` preserved; (4) `pairRng` for
  road-shared content, window only filters; (5) importmap in all three html files; (6)
  spawn-clearance as a placement veto, not a post-hoc removal. Sequence per the Priority
  Sequence so the additive exports + self-test gate clear before any content flows.
