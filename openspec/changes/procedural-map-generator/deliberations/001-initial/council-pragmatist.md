# Pragmatist Deliberation — Procedural Map Generator

## The Pragmatist's Order of Operations

### Critical Path

The make-or-break question this whole change exists to answer is one sentence
from D9 and the proposal: **does a central-place heart hierarchy read as "real
geography" instead of a "lattice of festivals" when you zoom out to kilometers?**
Everything else — roads, water, density, roles, rivers — is downstream of that
answer being "yes." If hearts-at-macro-scale looks like a grid, the direction is
dead and no amount of road meandering or density shading saves it.

So the critical path to a LOOKABLE, direction-proving result is short and the
plan already has the bones of it:

```
1.1 queryPoint stub  ─┐
1.2 hash helpers      ├─► 2.1/2.2 hearts + ranks ─► 3.1/3.2 canvas+pan/zoom ─► 3.3 render dots ─► 3.4 EYEBALL IT
1.3 determinism test ─┘                                                                            (GO / NO-GO gate)
```

That is the longest *necessary* dependency chain to the first real decision.
Roads (§4) depend on hearts (§2). Density (§6) depends on hearts + water + roads.
Roles (§7) depend on all of the above. Rivers (§8) depend on lakes + roads. So
the dependency DAG fans out *from* hearts — which is exactly why hearts + the
2D shell must come first, and why the plan's choice to front-load §3 (harness)
before §4–8 is correct.

**The one re-sequencing I'd push:** §3 (the canvas shell) is currently listed
*after* §2 (hearts). In task-number order that reads as "build hearts, then
build the viewer." That's backwards for fastest feedback. You cannot eyeball a
heart field with no canvas. The harness has to be at least *minimally* alive
(3.1 + 3.2, blank pan/zoom canvas drawing a grid) before hearts give you
anything to look at. Interleave them: stand up the empty canvas (3.1, 3.2) in
parallel with the hearts math (2.1–2.3), then 3.3 wires the two together. The
project's own doctrine — "build the harness, then the feature"
(CLAUDE.md, sandbox-and-testing.md) — says the same thing. The harness is not
step 3; it's step 0-and-3.

### Priority Sequence

A pragmatic re-ordering of the ten task groups into shippable, eyeball-gated
slices:

1. **Foundation + empty harness, in parallel (§1.1, §1.2, §3.1, §3.2).** The
   `queryPoint`/`queryRegion` stub, the hash helpers, AND a blank Canvas-2D page
   that pans/zooms across kilometers drawing nothing but a coordinate grid. These
   have no dependency on each other and together they're the runway. Lift the
   sandbox.html hidden-tab tick pattern and `replaceState` URL sync verbatim
   (see Reuse Inventory) — that's an afternoon, not a new invention.

2. **Hearts + the determinism self-test (§2.1–2.3, §1.3, §3.3).** The heart math,
   the byte-identical reorder check, and the canvas layer that draws rank-colored
   dots. This is the first LOOKABLE result and the first determinism proof. Build
   the self-test here, not deferred to §9 — it's cheap (perf-pass-4 already did
   the byte-identical pattern) and it's most valuable while the layer is small.

3. **GO/NO-GO GATE — eyeball the macro distribution (§3.4).** Zoom out, look at
   kilometers of hearts. Tune the rarity/jitter/rank-weight constants until it
   reads as geography, not a grid. Capture the constants in session-log. **This
   is the deliberation's actual purpose. Stop and look here before building a
   single road.** If it can't be made to read right, the change pivots or dies
   cheap.

4. **Roads — arterials only (§4.1, §4.2, §4.4 partial).** Connect hearts to
   nearest neighbors, meander them, prove they're continuous across the seam as
   you pan. This is the second proof: "roads that lead somewhere." Collectors and
   footpaths (§4.3) are a refinement, not a proof — split them out (see
   Incremental Delivery).

5. **Lakes (§5).** Cheap, almost a direct port of lakes.js macrocell logic.
   Needed before density and before rivers.

6. **Roles + point inspector (§7.1, §7.2).** The structural fix for
   "stages-on-roads" (anchor off-road, face the road) is the *other* headline
   bug this change set out to solve, so it earns its place in the core. The point
   inspector (§7.2) is the debugging multiplier — it makes every later layer
   verifiable in one click — so it lands here, not at the end.

7. **Tree-density field (§6).** Now that hearts/roads/water exist for it to
   subtract from. Visually confirms clearing-near-hearts, forest-in-outskirts.

8. **Determinism + proximity-graph acceptance sweep (§9).** The broad sweep over
   many seeds/points, the boundary-agreement check, the D6 lookup-radius
   validation, and the no-`three`/DOM import check. The *infrastructure* for this
   was built in slice 2 (§1.3); §9 is running it at scale and adding the
   graph-consistency variant.

9. **Rivers + bridges (§8).** Last, exactly as D7 says. Hardest, most coupled,
   and — see Deferred — the strongest candidate to cut from this change entirely
   if time/feel pressure shows up.

10. **Docs (§10).** CHANGELOG (new dev surface), ROADMAP (the three named
    follow-ups), the `worldgen/README` or `index.js` header documenting the
    pipeline + determinism contract. Per changelog-and-roadmap.md this travels in
    the same commits as the work, not a batch at the end.

### Deferred / Park on ROADMAP

The core question (slice 3) needs hearts. The secondary proof (slices 4, 6) needs
arterials + off-road anchoring. Beyond that, several planned tasks are
refinements that do **not** change the GO/NO-GO answer and can be parked without
undermining the prototype's purpose:

- **Rivers + bridges (§8 entirely).** D7 already calls them "the hardest element
  and the most coupled" and builds them last. The proposal itself flags
  rivers-in-3D as a separate follow-up. My push: consider deferring even the *2D*
  river work to a follow-up 2D change. Nothing about the heart/road/role
  skeleton's validity depends on rivers existing. The risk of keeping them in
  scope is that the meander-curve + route-around-cores + bridge-intersection math
  is a tar pit that eats the timeline *after* the real question is already
  answered — classic gold-plating the prototype. **What's NOT blocked by
  deferring:** the entire direction-proving exercise (hearts, roads, roles,
  density). Open Question Q4 explicitly asks this; my answer is "lean defer, and
  it's fine to ship the skeleton without them." Keep lakes (§5) in — they're
  cheap and density/roles read better against water.

- **Collector + footpath road tiers (§4.3).** Arterials connecting hearts prove
  "roads lead somewhere." The fine local web is tuning, gated on Open Question Q2
  ("how dense?") which is itself unanswered. Park the footpath density work until
  after the macro structure is locked. **What's NOT blocked:** the road-network
  hierarchy *concept* is proven by arterials alone.

- **Role-tier sandbox layer rendering (§7.3).** The role *computation* (§7.1) and
  the point inspector (§7.2) prove roles work. A dedicated color-shaded role
  overlay is nice-to-have visualization. Park if time-pressed. **What's NOT
  blocked:** roles are inspectable per-point without it.

- **Density shading polish (§6.2 beyond a first pass).** A first crude shading
  pass confirms the field clears/rises correctly. Pixel-perfect density
  visualization is tuning, not proof.

Net: the irreducible core that answers the change's reason-for-existing is
**§1 + §2 + §3 + §4.1/4.2 + §7.1/7.2 + a first pass of §5/§6 + §9 + §10.**
Rivers, footpaths, and the prettier overlays are genuinely parkable.

### Incremental Delivery Plan

Each slice is independently lookable in the sandbox and leaves the repo in a
shippable state (the live game is untouched throughout — that's the whole
isolation premise, so "boot the game clean" here means "the new page loads and
the old game still loads," a much lower bar than a chunks.js change).

- **Slice 1 (ship first) — "blank kilometers + a heart field you can judge."**
  §1.1, §1.2, §1.3, §3.1, §3.2, §3.3, §2.1–2.3, §3.4. Includes: the pure
  generator stub + hash helpers, the determinism self-test wired to an on-screen
  pass/fail toggle, the Canvas-2D pan/zoom page, and the heart layer. Enables:
  **the GO/NO-GO decision** — the only thing that proves or kills the direction.
  Verify: open `map-sandbox.html?seed=...`, zoom out to kilometers, confirm
  hearts read as geography not a grid; flip the determinism toggle and confirm
  green; reload with the same seed and confirm identical, change seed and confirm
  different. This slice alone justifies the change if it lands.

- **Slice 2 (ship after Slice 1) — "roads that lead somewhere + off-road
  anchoring."** §4.1, §4.2, §4.4, §5, §7.1, §7.2. Depends on Slice 1's heart
  field and point-query. Includes: arterials connecting hearts (meandered,
  seam-continuous), lakes, the off-road-facing role anchor logic, and the
  click-to-inspect point inspector. Enables: proving the *second* headline bug
  ("stages-on-roads") is structurally fixed and that roads connect destinations.
  Verify: pan across seams (no kinks), inspect points on/off roads, confirm a
  core-tier point anchors off the nearest road and faces it.

- **Slice 3 (ship after Slice 2) — "the field fills in."** §6, §7.3, §9 (full
  sweep). Depends on hearts/roads/water existing. Includes: tree-density shading,
  role-tier overlay, the broad determinism + proximity-graph acceptance sweep.
  Enables: the full layout tuple is visualizable and verified at scale. Verify:
  density clears near hearts and rises in outskirts; §9 self-tests pass across
  many seeds.

- **Slice 4 (optional / candidate for follow-up change) — "water that flows."**
  §8 rivers + bridges. Depends on lakes + roads. **This is the slice to cut first
  if the timeline tightens** — see Deferred. Verify: rivers avoid heart cores,
  bridges appear at road×river crossings, nothing spawns on the river corridor.

Docs (§10) ride along in each slice's commits, not batched.

### Effort Reality Check

**Is this one change or three?** Honestly it's *one prototype change with a
fat tail.* The core (Slices 1–2) is a coherent, bounded effort: it's a parallel,
isolated module set with no live-game integration and no three.js, so the usual
zerble effort-multipliers (material tiers, shadow budgets, iOS audio gesture
chain, chunk lifecycle, importmap-in-two-pages) almost all evaporate — the
briefing and D2 correctly note this. That's a genuinely favorable effort profile
for zerble; most changes here pay a "five sandbox-wiring steps" tax that this one
skips because it *is* the sandbox.

Where the optimism hides:

- **Rivers (§8) are the tail that could double the change.** Deterministic
  meander curves that (a) connect specific lake pairs, (b) route around heart
  cores without an order-dependent solver, (c) expose a clean `noBuild(x,z)`
  point query, and (d) produce deterministic road×river intersection points — that
  is four coupled sub-problems, each with a determinism trap. D7 is right that
  it's last; I'd go further and say it's the part most likely to blow an estimate.
  Treat it as a separate slice with its own go/no-go.

- **The proximity-graph "generous lookup radius" (§4.1, D6, §9.2) is a
  research task, not a coding task.** "Read a deliberately generous macrocell
  neighborhood" has no a-priori-correct radius — the plan says it's "verified
  empirically in the sandbox" (D6) and validated by computing the graph from
  several window origins (§9.2). That empirical loop could be a few iterations or
  a frustrating afternoon of "still inconsistent at this radius, widen it,
  recheck." Budget for iteration here; don't estimate it as a single write.

- **The determinism self-test (§1.3 / §9) is NOT net-new effort — it's a lift.**
  This is a key force-multiplier and a reason to be optimistic. Perf-pass-4
  already shipped exactly this discipline: CHANGELOG.md:132-133 records verifying
  a refactor was "byte-identical to the old full scan across all 500 NPCs (max
  diff 8e-15)." The byte-identical-under-reordering harness is a known, recently-
  exercised pattern in this repo. Building it for worldgen is *applying* that
  pattern, not inventing it. Half a day, and it pays for itself the first time it
  catches a float-non-associativity regression.

- **"Simple model" trap, worldgen edition:** the heart field looks like the easy
  part (it's macrocell + jitter + rank roll, almost a copy of lakes.js). The
  *hard* part hiding inside it is §2.2 — the mega-heart 2×2 block that
  "suppresses lesser hearts within its footprint." Suppression means a cell's
  heart depends on whether a *neighbor* cell rolled a mega — i.e. it's a
  bounded-neighborhood lookup, and if you get the bound wrong it's order-dependent
  or it pops at view edges. This is the one spot in the "easy" heart layer where
  determinism can sneak back in. Flag it; it's not a one-liner.

**Generator-cost / per-pixel concern (Profiler's deselected lane):** the briefing
asks me to absorb this. It is a **real task, not hand-waved**, but it's small and
the plan names it (§3.2: "render-on-demand for the visible extent (sampled
resolution / simple tile cache)" and Risks: "render at sampled resolution / tile
cache in the sandbox; this is a sandbox-rendering concern, not a generator
concern"). The right framing: a naive `for each pixel: queryPoint()` over a
zoomed-out kilometer view is millions of bounded-neighborhood queries per frame
and will jank. The fix is cheap and standard — draw the macro layers (hearts,
arterials, lakes) from their *feature* representations (dots, polylines,
polygons) directly, NOT by per-pixel field sampling; reserve per-pixel sampling
for the density field only, and there sample on a coarse grid (e.g. one query per
8–16 screen px) and let Canvas interpolate. So: it's one explicit task inside
§3.2 ("draw features as features; sample fields coarsely"), it's bounded, and
it's not a generator-architecture risk. I'd make it an explicit checkbox so it
isn't discovered as jank later.

### Reuse Inventory

Strong reuse story here — this is a force multiplier, not greenfield:

- **`rng.js` — `hash2` / `worldHash` / `mulberry32` (src/rng.js:40-71).** The
  seeding contract is done. `worldHash(x, y, salt)` already supports stacking
  independent streams on the same coordinate via `salt` — exactly what
  edge/pair/cell seeding needs (different salt per layer). §1.2's `cellHash` /
  `edgeHash` / `pairHash` are *thin wrappers* over these, not a new scheme. The
  tripwire (don't fork the seeding scheme, footgun #4) is satisfied by building on
  these. Worth noting: `hash2` truncates inputs with `x | 0` — so edge/pair IDs
  must be composed into integers carefully (e.g. canonicalize an edge as
  `min(a,b), max(a,b)` so both sides hash identically; this is the boundary-
  agreement guarantee in spec scenario "Boundary feature agrees from both sides").

- **`lakes.js` macrocell pattern (src/lakes.js:32-33, 86-102, 271-295) is the
  direct template for hearts.** `LAKE_CELL = 320`, `worldHash(mcx*17+91,
  mcz*13+31)` per cell, `mulberry32(seed)` stream, jitter the feature inside the
  cell with margin clearance, scan a bounded neighborhood `mcxMin..mcxMax` around
  the player. `hearts.js` is structurally the same code with a rank roll added and
  a wider neighborhood scan. This is a copy-adapt, not a design-from-scratch.
  **Reference, don't import** — the proposal correctly keeps the new module
  isolated; lakes.js is the pattern, not a dependency.

- **`forests.js` block-to-cell mapping (src/forests.js:73-98)** is a worked
  example of "which coarse cell does this fine coordinate belong to, and is its
  center near origin" — directly relevant to the mega-heart 2×2 block math (§2.2)
  and the ORIGIN_SAFE_BLOCKS idea (keep mega-hearts away from the (0,0) spawn).

- **`sandbox.html` hidden-tab tick (sandbox.html:2363-2367)** lifts verbatim:
  `if (document.hidden) setTimeout(tick, 16); else requestAnimationFrame(tick);`.
  This is the line that lets the Preview MCP screenshot the page while the tab is
  backgrounded — without it, agent verification of `map-sandbox.html` silently
  fails (RAF throttles to ~0fps when hidden). **This must be in §3.1.** It's a
  one-liner but it's load-bearing for the whole agent-verification loop the
  project depends on.

- **`sandbox.html` deep-linkable URL (sandbox.html:2113)**
  `history.replaceState(null, '', ...)` — lift for the seed param (§3.2). Same
  re-openable-view discipline the entity sandbox uses; the map sandbox should be
  `map-sandbox.html?seed=...&x=...&z=...&zoom=...` so an agent can re-open the
  exact macro view across iterations.

- **Perf-pass-4 byte-identical verification (CHANGELOG.md:132-133)** is the
  template for §1.3/§9, covered in the Effort section. Reuse the *discipline*
  (assert byte-identical under reordering, report the max float diff), not code.

Bottom line on reuse: the determinism primitives, the macrocell pattern, the
hidden-tab tick, the URL-sync, and the byte-identical-check discipline are all
already in the repo. The genuinely new invention is the proximity-graph road
connection rule and the river meander math — and those are correctly sequenced
last.

### Anticipated Tensions

- **Tension with Maverick (over-cutting):** Maverick will likely argue to cut
  even harder — possibly axing the determinism self-test as "premature," or
  shipping hearts-only as the whole change, or treating the 2D sandbox as
  throwaway. I diverge on the self-test: footgun #4 (determinism is load-bearing)
  is a non-negotiable tripwire, and the self-test is *cheap* because perf-pass-4
  already proved the pattern (CHANGELOG.md:132-133). Cutting it doesn't save real
  time and it removes the one guardrail on the cardinal sin. I'd also resist
  "hearts-only is the whole change" — the off-road anchoring fix (§7.1) is the
  *second* reason this change exists (the stages-on-roads bug, proposal line 8-9
  / D10), and it's cheap once hearts exist. Where I agree with Maverick: rivers
  (§8) and footpaths (§4.3) are genuinely cuttable, and I'd back deferring rivers
  even in 2D.

- **Tension with Architect (over-building the data model before it's lookable):**
  Architect will (rightly) want the `queryPoint` tuple shape, the module
  boundaries (D11), and the data contract nailed down so the future 3D port
  inherits a clean single-source-of-truth. My friction: don't let "design the
  complete tuple for a future 3D consumer that doesn't exist yet" block Slice 1.
  The briefing's tension #2 is real — the 3D port may need heights, collider
  radii, facing — but you *cannot know which fields the 3D port needs until you
  have a 3D port*, and speccing them now is guessing. Pragmatic stance: design the
  tuple for what the 2D sandbox can *display and verify today* (the §7.2 inspector
  fields), keep `queryPoint` returning a plain extensible object so adding fields
  later is non-breaking, and let the macro eyeball test (Slice 1) happen before
  the data model is "finished." A perfect data contract for an imaginary consumer
  is the over-build risk. Q3's default ("keep map-view-ready, don't build the UI")
  is the right altitude — match it for the 3D port too: keep it *possible*, don't
  *architect* for it.

- **Tension with Adversary (over-hardening before a lookable result exists):**
  Adversary will hunt for every determinism corner — float non-associativity in
  curve tangents at seams, proximity-graph edges depending on a third point
  outside the window, suppression-at-view-edges popping. These are *real* (I
  flagged the mega-suppression one myself in Effort), and §9.1/§9.2 plus the
  boundary-agreement scenario in the spec are the right home for them. My
  divergence is purely about *timing*: don't gate Slice 1 (the GO/NO-GO eyeball)
  behind an exhaustive adversarial determinism sweep. The cheap reorder self-test
  (§1.3) is enough to ship Slice 1 with confidence; the exhaustive multi-origin /
  boundary sweep (§9) belongs in Slice 3, after the direction is proven worth
  hardening. Harden what you've decided to keep — not what you might throw away.

- **Tension with Anthropologist (feel/"reads as real"):** Mostly alignment — the
  Anthropologist's "does it feel like geography" *is* my Slice-1 GO/NO-GO gate
  (D9). The only friction: if the Anthropologist wants rivers/footpaths in scope
  because "real festivals have winding paths and water everywhere," I'd counter
  that the macro *hierarchy* (hearts + arterials + sparsity-between) carries 80%
  of the "reads as real" feel, and rivers/footpaths are the last 20% polish that
  can ship in a follow-up without the prototype feeling fake.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The change has a clean, low-risk core (hearts + harness +
  determinism self-test → the GO/NO-GO eyeball) but a deceptively expensive tail
  (rivers §8, and the empirical proximity-graph-radius loop §4.1/§9.2). The risk
  isn't that the direction is wrong — it's that the timeline gets eaten polishing
  rivers and footpaths *after* the direction is already proven, gold-plating a
  prototype. Front-load the lookable result; treat rivers as a cuttable Slice 4.
- **Recommendation**: Proceed, with three re-sequencing mitigations: (1)
  interleave §3.1/§3.2 (blank canvas) with §2 (hearts) so the harness is alive
  before hearts exist to draw — the project's own "build the harness first"
  doctrine; (2) pull the determinism self-test (§1.3) and the point inspector
  (§7.2) *earlier* than their task numbers suggest — both are debugging
  multipliers that make every later slice cheaper to verify, and the self-test is
  a lift of the proven perf-pass-4 byte-identical pattern, not new effort; (3)
  hard-gate at §3.4 — zoom out, eyeball the macro heart distribution, and make the
  explicit keep/pivot/kill call there *before* building roads. Park rivers (§8),
  footpaths (§4.3), and the role-overlay/density-polish as Slice 3-4 / follow-up
  so the change can ship its reason-for-existing (a lookable, tunable,
  deterministic heart+road+role skeleton) without being held hostage by its
  hardest, most-coupled, most-deferrable layer. Add one explicit checkbox in §3.2
  for "draw features as features, sample fields coarsely" so the per-pixel
  generator cost is handled by design, not discovered as jank.
