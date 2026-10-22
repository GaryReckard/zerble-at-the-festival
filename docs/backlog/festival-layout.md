# Festival layout history and remaining work

[Documentation index](../README.md) · [Roadmap](../../ROADMAP.md)

This record preserves dated investigations and design decisions. Shipped slices
are context, and unchecked or parked work is not a new implementation request.
Verify source anchors against the current code before resuming. Commands assume
the repository root.

### Festival layout — the plan/build contract refactor *(diagnosed 2026-06-10)*

Two playtest rounds of "jumbled mess" feedback (trucks clipping vendor rows,
random porta potties, no discernible order) trace to ONE root cause, not N bugs:
`festival.js` plans the hub as **points with scalar clear-radii**
(`KIND_FOOTPRINT`, [festival.js:196](../../src/worldgen/festival.js#L196)) while the
`chunks.js` builders construct **oriented shapes that exceed those radii** (a
"16m" food court really spans ~20m+ of truck ring; a "12m" vendor row is an
~18-20m rectangle with camps behind) — so `resolveOverlaps` settles clusters at
separations that guarantee clipping, the 38m dancefloor rect only repels *trees*
(POIs never read it), builders place sub-components blind (the registry-check
discipline main's theme builders had was dropped), and nothing enforces
stage-vs-stage distance across hearts. Item-by-item regression fixes can't close
this; the contract can. The fix, in order: (1) ✓ **DONE** — hoist the ~34
scattered layout constants into one `FESTIVAL_TUNING` object both planner and
builders read (round-2 item J's prerequisite); *shipped 2026-06-11/12 via
`worldgen-layout-harness` group 2 + 2.4*. (2) descriptors carry **oriented bounding
shapes derived from the same constants the builder uses**, and overlap/road/
water/dancefloor checks run against shapes, (3) replace scatter-then-relax with
**zone slotting** per hub (stage + hard-reserved front wedge on F; vendor aisles
along roads with camps auto-reserved behind; courts off-road at a min stage
distance, optional spur road to center; potties attached to a parent zone's
edge), (4) restore per-sub-component `registry` clearance in builders as the
graceful-degradation backstop. One golden-moving batch, flag-off. Full
diagnosis + design: OpenSpec `festival-zone-grammar`. **Gate now MET** — the
harness's grammar-unblock milestone (groups 1+2+4 + the baseline, task 8.1)
landed 2026-06-13: the linter + `bin/lint` + `verification/baseline.md` (106
error / 92 warn across 10 seeds) are the verification gate the grammar rewrite
is graded against. (Harness groups 5/6/7 — map-sandbox overlay, hub viewer,
playtest markers — are in-change fast-follows, not grammar blockers.)
**In progress (2026-06-13): the LEAN path** (`festival-zone-grammar` D13) — steps
(2)(3)(4) above as a planner-only rewrite (true extents + zone slotting + arch
relocation + registry backstop), with ONE deliberate POI-golden move. The
behaviour-preserving builder extraction is split out to "Festival worldgen v2"
below (Gary: lean now, full scope eventually).

**Playtest follow-ups (Gary 2026-06-14, deferred — "document, don't fix now"):**
- ~~**Tree clipping a food truck.**~~ FIXED 2026-06-14. Root cause was the **lakeside
  forest ring** (`lakes.js`), not the in-chunk scatter (which already dodges trucks via
  the 7.48 m truck footprint): the lake ring checked only camp distance, so a hub's food
  truck by the water got a trunk through it. The ring now also dodges registered buildings
  (`closestBuilding`, v2-gated so v1 stays byte-identical) — see CHANGELOG. Load-order-
  dependent like the other build backstops.

Stage decks and their complete audience rectangles now exclude actual road
polylines, and light-pole endpoints independently reject road shoulders
(2026-10-14). This resolves road-through-dancefloor reports; cross-hub
cluster spacing below remains separate.

- **Cross-hub cluster overlap — food courts FIXED via sharing; drum/stage + rows remain.**
  Multiple playtest pins (Gary 2026-06-14, seeds 1139472710 / 2718382314): two food
  courts clipping (heart (2,-1)'s court vs (2,0)'s **~11–37 m apart** — ring overlap given
  ~31 m court extent), a drum circle clipping a neighbour's tent stage, a vendor row "too
  close to both." **Root cause (verified):** `HEART_CELL = 200` (hubs every 200 m) but
  festival clusters reach ~190 m, so a court walked ~190 m out from heart A lands ~10 m
  from heart B. The slotter (`festival.js _computePlan`) packs each heart's clusters
  against **only that heart's** `placed[]` — zero cross-hub view. **A cross-hub PACKER is
  out** (tried + reverted 2026-06-14): a per-heart "yield to senior neighbours" keep-out is
  (a) **too slow** — at 200 m spacing the 2×`MAX_POI_REACH` box holds ~162 hearts/~81
  seniors × ~80 ms base-plan (`nearestRoad`-dominated) → **~8 s per `festivalPlan`** (hangs
  chunk gen); AND (b) **wrong at this density** — nearly every minor hub has a senior
  cluster in reach, so it would OMIT most courts/rows, gutting the festival.
  **FOOD COURTS + DRUM-vs-STAGE shipped 2026-06-14 (Gary's call — SHARE/yield, don't relocate):**
  the build step now omits a food court whose ring reaches an already-built neighbour court
  (the neighbour's serves both), and omits a drum circle whose bench ring would clip a
  neighbour hub's stage deck (`stageDeckClips`, an order-independent heart-position test, so
  the stage anchor always wins). Builder-only, goldens frozen (CHANGELOG).
  **Still open** — cross-hub **vendor rows that sit too close** (Gary: "a vendor row tooooo
  close to both"). Rows are oriented rectangles, not rings, so the same center-distance trick
  is fuzzier; likely wants an OBB-vs-neighbour check or the curved-row work below. If a bigger
  structural change is ever wanted instead, the parked options are a hub-subset gate (sparser
  hubs) or a batched neighbourhood solver — both golden-moving.

- **Vendor row on a CURVED road — crossing FIXED (2026-06-14); curve-FOLLOWING still parked.**
  Seed 2718382314 @ (49,386): the straight booth line crossed a road that bent through its
  span. Shipped a builder-side fix — `buildVendorRowAt` skips booths that land on the road
  ribbon, so the row keeps a gap at the bend instead of crossing (CHANGELOG; golden-free).
  Still parked (nice-to-have): a booth line that *follows* the road polyline through a bend
  rather than gapping — a bigger builder change, and the planner could prefer seating rows
  where the road is locally straight (golden-moving).

- **Lint regression: drum-in-food_court via `nudgeOffDrum` *(found 2026-08-27, parked)*.**
  The 10-seed sweep is back to **1 ERROR** (from the 0 below): seed 256 puts a drum-circle
  center inside a `food_court` envelope (`hub-sandbox.html?seed=256&at=-610,-913`). Bisected
  to `ec76a82` (2026-06-16, the drum-off-road fix): `nudgeOffDrum` scans for the nearest
  spot that's merely off-road/off-lake, and the post-nudge re-validation checks tree density
  ONLY — not cluster envelopes — so a nudge can shove the drum into a neighbouring cluster.
  Fix shape: re-validate the FINAL spot against `clustersContaining` the same way density is
  re-checked, omit on failure (the established "omit, don't place" rule). Golden-moving
  (omission skips the drum's yaw draw → that hub's potties/bubble shift), so it wants its own
  small change with the usual snapshot ritual — deliberately NOT ridden along inside
  `festival-horizon`, whose own gate is "goldens must not move." Until fixed,
  `npm run lint:layout` exits 2; gates that want it green cite this bullet.

- **Burndown to ZERO errors *(2026-06-15)*.** The 10-seed plan-mode lint sweep is at **0
  ERRORs (from 375)** after the `nearestRoad` cache, no-festival-in-a-lake + dry spawn, the
  treeless-drum omit, two golden-free false-positive corrections (`spawn-arrival` rule premise +
  `porta_bank` extent), and the least-wet front-axis tiebreak that stopped dancefloors opening
  onto water (CHANGELOG). The remaining warns (224) are all `stage-spacing` — expected under the
  DENSE hub design, not defects. The whole worldgen-v2 festival was then booted in-game
  (`?worldgen=1`, agent-browser) and confirmed: clean boot/no errors, dry hero-arch spawn, lake
  hubs render as open water (no submerged festival), arches at non-spawn majors. The one-time
  `bubble_vendor × food_court` overlap WARN was settled by dumping the built registry — every
  bubble sits ≥ ~9 m clear of the nearest truck, confirming the filled-circle-vs-ring artifact;
  `bubble_vendor` is now excluded from the plan-mode overlap warn. Still browser/feel-gated for a
  future pass: ~~**4B.7** soft_buffer geometry~~ *(landed 2026-06-16 — soft_buffer seams now
  dress with a shrub hedge along the seam line via `seamHedgesNear` → `placeSeamHedges`;
  dress-not-delete, golden-neutral)*, the stage↔camp substrate (visual + per-tier perf
  budget), arch *style* variation, and Gary's 7.3 playtest gut-check (arrival density
  `ARCH_MAJOR_PCT`, the dry-spawn relocation distance).
