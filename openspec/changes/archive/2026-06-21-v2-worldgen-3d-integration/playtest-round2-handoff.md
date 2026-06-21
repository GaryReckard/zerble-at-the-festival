# Playtest round-2 handoff (Gary, 2026-06-09)

> **Context:** after the layout-grammar redesign + the full A–H festival-polish backlog
> shipped (see `festival-polish-backlog.md` + the 2026-06-08/09 session-log entries),
> Gary playtested again at **seed `0xf7ef2a3c`** and gave a fresh batch of feedback —
> a mix of bugs, regressions from this session's work, model redos, and new features.
> **Status: documented + paused for a context compact.** Nothing below is started yet.
> All v2 is still flag-off (`?worldgen=1`; `DEFAULT_WORLDGEN_V2=false`). Tree is clean at
> commit `5a1b247`.
>
> Repro seed for everything here: **`0xf7ef2a3c`** (Gary's playtest seed).

Items are tagged **[BUG]** (broken now), **[REGRESSION]** (this session's work needs
fixing/refining), **[REDO]** (model/feature rework), **[NEW]** (net-new). Each has the
technical hook + my notes on approach. Roughly priority-ordered.

---

## A. Spawn + arch + the MAIN stage (the arrival, round 2) — [REGRESSION/REDO]

**Gary:** "Lets have zerble and festival arch spawn such that they are facing a stage… i
like zerble spawning on a road, that's nice. The stage zerble spawns at should be the
**MAIN STAGE, the one with the wood roof**. Wherever that is, there should be space in
front of it… use that to determine where zerble spawns, and festival arch is. and make
sure **no vendor booths are clipping zerble**."

What's wrong now (screenshots): Zerble spawns on a road facing the arch, but **not facing
a stage**, and a **vendor row is clipping right next to it**. The spawn hub is whatever
`nearestHeart(0,0)` returns — **any rank**, so it's often a minor with a side/tent stage,
not the wood-roof MAIN stage.

**Hooks + approach:**
- Spawn block: `main.js:217-260` (the `if (USE_WORLDGEN_V2)` block). Currently
  `nearestHeart(0,0)` (any rank) → spawn outside the arch on `roads[0]` facing inward.
- The MAIN stage (wood roof) = a **major** hub's `main_stage` (`buildStage(...,isMain=true)`).
  **Problem I already hit:** `nearestMajorHeart(0,0)` returns NULL at the dense config
  (major share 0.04, none near origin). So to spawn at a main stage we must EITHER
  (a) force-promote the nearest heart to origin to `major` as a spawn-only override, OR
  (b) expand `nearestMajorHeart`'s ring scan / guarantee a major near spawn. **My lean:
  (a)** — a deterministic "spawn hub is always a major" rule (the festival's front door
  should be the big stage). Needs care: the heart's rank feeds `festivalPlan` (main vs
  side stage) + `heartInfluence`; promoting it is a localized override at spawn-resolve.
- Arrival geometry: face the MAIN stage. The stage faces `+F` (its dancefloor). Gary wants
  Zerble + arch in the **cleared space IN FRONT of the stage** (the dancefloor, +F), on a
  road, facing the stage. So: arch at the front edge of the dancefloor (or where the
  primary road meets it), Zerble just outside facing the stage across the open dancefloor.
  This is closer to the *original* "dancefloor-front" arch idea than the "arch-on-road,
  stage-off-to-the-side" we shipped — Gary now wants **facing the stage** + on a road. The
  reconciliation: put the arch where the approach road enters the dancefloor, facing the
  stage, and spawn Zerble on that road just outside the arch, facing through it at the stage.
- **No vendor clipping:** add a spawn-clearance veto — no vendor_row / large cluster within
  N m of the spawn point (R27, never fully added). festival.js could keep the spawn hub's
  vendor rows off the spawn-front sector, or main.js could nudge spawn clear.

## B. String lights at stages (port the legacy look) — [NEW]

**Gary:** "the original world (worldgen=0) has the festival arch, and then like 3 or four
rows of the string lights. that was nice. that should be at the main stage. would be nice
to have those string lights at other stages too."

**Hooks + approach:**
- Legacy main-stage theme strings several pole-pairs of lights: `buildMainStageTheme`-ish
  path in chunks.js calls `placePolePair` in a loop (search `placePolePair(ctx, x - 18,
  ... s)` around chunks.js:1384 — the legacy `for (let s = -25; s <= 25; s += 16)` rows).
  `placePolePair` is at chunks.js:~2342.
- Port: in `buildStage` (or the spawn-arch setup for the main stage), add 3–4 rows of
  string-light pole-pairs across the dancefloor front. Do it for all stages (lighter for
  side stages). Emissive/nightness-gated already via placePolePair's light.

## C. Vendor rows are flipped + must straddle a road — [BUG]

**Gary:** "Vendor rows need to straddle a road, with the vendor booths facing the road.
your vendor row seems flipped, with the two vendor lines facing outward rather than toward
each other."

**Hooks + approach:**
- `buildVendorRowAt` (chunks.js:1213). Booth facing: `tent.rotation.y = yaw + (side < 0 ?
  -Math.PI/2 : Math.PI/2)` — the comment says "face the central aisle" but in-game they
  face OUT. **Flip the facing** (add π / swap the sign) so both rows face the central aisle.
- "Straddle a road": today festival.js places the vendor_row descriptor **offset to one
  side** of the road (`perpOff` in `_computePlan`), so the whole double-row sits beside the
  road, not over it. Gary wants the **central aisle to BE (or align to) the road**, booths
  on both sides facing in toward it. → Place the vendor_row **centered on a straight road
  segment** (drop the perpOff, or offset by half so the aisle lands on the road), booths
  ±`rowOffset` facing the road. Verify the aisle width ≈ road width so Zerble can drive the
  aisle. (festival.js vendor_row block + buildVendorRowAt together.)

## D. Drum circle must not be ON a road — [REGRESSION]

**Gary:** "i found a drum circle, nicely nestled in the woods, but a road went through the
middle of it. drum circle should not be ON the road."

**Hooks + approach:**
- `treedDistrictSpot` (festival.js). **This is a regression from this session's perf fix:**
  I swapped its `queryPoint(x,z).noBuild` test (which included roads) for cheap
  `treeDensity` + `lakeAt` to kill a 215µs/call cost — that **dropped the road-avoidance**.
- Fix cheaply: keep the 12-attempt loop on treeDensity/lakeAt, but add a **road check on
  the FINAL chosen spot only** (1 query, not 12) — `queryPoint(spot).noBuild` or
  `nearestRoad(spot).onRoad` — reject if on a road and fall back. Or sample a few points
  around the drum's footprint. Keep it to ≤1-2 road queries per drum (R7-safe).

## E. Torches never in the road — [BUG]

**Gary:** "the torches should never be IN the road. only ever to one side or the other."

**Hooks + approach:**
- Food-court torch ring (`buildFoodCourtAt`, the `courtTorches` loop) + the stage
  dancefloor-corner torches (`buildStage`, the `torchWorld` array). Neither checks roads.
- Add a `pointNearWorldgenRoad(x, z, ctx.region.roads, halfW)` (chunks.js:1028) reject per
  torch position before adding it to the field. Both builders have `ctx` → `ctx.region.roads`.

## F. Campsites behind vendors = FULL campsites — [REGRESSION]

**Gary:** "when i said put campsites behind the vendors, i meant like the existing
campsites you have… with tent, chairs, etc… not just tent."

**Hooks + approach:**
- `buildVendorRowAt` D3 block (chunks.js, the `if (ctx.rng() < 0.4)` that builds
  `buildCampTent(ctx.rng).group`). Replace the single camper tent with a **full
  `buildCampsite(ctx.rng, 'small')`** (tent + chairs + fire + maybe a torch). NOTE
  `buildCampsite` returns `{ group, animatables, ... }` (NOT a bare Group — R2 return-shape!)
  and its animatables must be pushed to `forestAnimatables` (chunkKey'd) like
  `buildCampVillageAt`/`buildCampsiteAt` do (chunks.js:2068). Register the camp's collider(s).
- Probably drop the per-stall rate (a full camp per ~40% of stalls is a lot) — maybe 1-2
  full camps behind the whole row, set back from the booths.

## G. No trees inside a tent-stage tent — [REGRESSION]

**Gary:** "no trees should appear within a tent stage tent!"

**Hooks + approach:**
- Trees grow inside the tent because the dancefloor clearing (`dancefloorRectsNear`,
  festival.js) only clears a rect IN FRONT (+F) of the stage — the **tent body extends to
  the sides/back**, which the rect doesn't cover.
- Fix: for `tent_stage` (and arguably any stage), clear the **stage footprint itself**, not
  just the front dancefloor. Add a clearing circle/rect at the stage center sized to the
  tent footprint (tent is ~stageWidth×stageDepth + canopy overhang). Either extend
  `dancefloorRect` to include a back/side margin for tent stages, or add a second
  `stageClearings` query the tree scatter honors (mirrors `dancefloorRectsNear`).
- The tent footprint dims live in `buildTentStage` (`tent.width`/`tent.depth`) — the
  worldgen side needs an approximate footprint (stage scale × a constant) since it can't
  build the model. Size the clearing generously to cover the canopy.

## H. Picnic table — wrong model + too small — [REDO]

**Gary:** sent a reference photo (classic **A-frame** picnic table: angled A-frame leg
pairs, cross-beam, plank top, attached benches) vs the current one (flat top + 2 floating
bench planks on **4 vertical posts** — looks wrong). Also: "picnic tables should be big
enough that **at least two people can sit on each side comfortably**."

**Hooks + approach:**
- `models/picnicTable.js`. Rebuild as a proper **A-frame**: two angled leg-pairs (each a
  shallow "A" — legs splay out from under the tabletop down to the bench ends), a lengthwise
  cross-beam under the top, a plank top, two bench planks resting on the splayed leg ends.
  Keep the **pre-merge into one BufferGeometry** (one draw, shared/userData.shared) — the
  shape is fixed, so merge the A-frame the same way.
- **Bigger:** ~2.6–3.0 m long so 2 people fit per side (4 seats/side total → at least 2).
  Update `_SEATS` to 4 per bench (8 total) or 2/side, and the food-court spacing
  (buildFoodCourtAt: the 3.2m min-spacing + ring*0.45 placement) to fit the larger table.
- Re-verify in the sandbox (`?entity=picnic_table`) after — see item K.

## I. Rewrite people-taxonomy.md as a neutral reference — [REDO/DOC]

**Gary:** "rewrite `.claude/people-taxonomy.md` to be standalone… not referencing 'Gary's
hunch' or a question/answer, but just stating how things work."

**Approach:** drop the "Why this exists / Gary's hunch / the one-sentence answer to Gary's
question" framing. State it as architecture reference: "Zerble has one shared ambient crowd
pool and N independent figure systems…", the table of systems, the model-pool landscape,
and the practical "what a change propagates to" guidance — all in neutral voice.

## J. A festival tuning UI (live sliders + export) — [NEW, big]

**Gary:** "Might be neat to have some interface/method for me to see the values of certain
variables (like how many picnic tables in a food court area) and change them… instantly
reflect in the game if possible, otherwise fine… then a way to copy/export the values I've
changed so I can paste them to you, and you edit the code. A new UI to open with tons of
sliders/inputs, well-organized but exhaustive."

**Hooks + approach:**
- The pattern already exists in **`map-sandbox.html`** (the TUNING·LIVE panel: live sliders
  bound to the worldgen `CONFIG` object + a "copy CONFIG" button). The blocker for the
  *festival/entity* values is that they're **hardcoded constants scattered in chunks.js +
  festival.js** (table count, torch count/spacing, vendor counts, dancefloor depth,
  WAYPOINT_*, drum band, village tent formula, etc.), not a single tunable object.
- Approach: hoist the festival BUILD/LAYOUT tunables into a single mutable object (e.g.
  `FESTIVAL_TUNING` in a new `src/festivalConfig.js` or extend `worldgen/constants.js`),
  have the builders read it per-call, and build an in-game debug overlay (toggle key) of
  grouped sliders/number inputs bound to it + a "copy values" button (JSON to clipboard,
  like map-sandbox's copy CONFIG). Live-reflect what's cheap (re-roll on change forces a
  chunk regen — or apply on next chunk load). This is a real harness feature — scope it as
  its own slice; it pays for itself across all the remaining tuning.
- Exhaustive-but-organized: group by system (Spawn/Arch, Stages, Vendor rows, Food courts,
  Drum circles, Camps, Crowd, Woods, Torches/Blankets). Each value labeled + ranged.

## K. Sandbox completeness — [PROCESS]

**Gary:** "make sure any new entities and entity updates make it into the sandbox.html!"

**Checklist for the above work:**
- Redone picnic table → re-verify `?entity=picnic_table` (already wired; confirm the new
  A-frame renders + the bench count).
- **`buildTreeHammock`** (C1, this session) has **no sandbox entry** — add one
  (`tree_hammock` option + loadEntity case) showing the post-less sling between two stand-in
  trunks.
- Full campsite-behind-vendor uses `buildCampsite` (already in sandbox).
- The new festival-tuning UI (item J) is map-sandbox-adjacent but in the GAME — keep it
  consistent with the map-sandbox panel's copy/export idiom.
- Re-run the new-model checklist (importmap ×2/×3, dropdown, loadEntity, hit kind, music)
  for anything new.

---

## My notes / suggested order (Claude)

1. **Spawn + main-stage rework (A)** is the headline — it's the first thing every player
   sees and it's currently wrong (no stage faced, vendor clip). Pair it with **B (string
   lights)** since both live at the main stage, and with the **C vendor-facing fix** (the
   clipping + flipped booths are the same screenshot). Do these together against seed
   `0xf7ef2a3c`.
2. **Quick regressions next: D (drum-on-road), E (torches-in-road), G (trees-in-tent).**
   These are all "X landed on/in a road/tent because a clearing/road-check is missing or was
   dropped." D + E are literally the road check; G is a clearing. Small, high-value.
3. **F (full camps behind vendors)** + **H (picnic table redo + bigger)** — model/build
   reworks. H needs a sandbox re-verify (K).
4. **I (taxonomy doc rewrite)** — quick, do anytime.
5. **J (tuning UI)** — biggest; do last (or first if you want the lever for all the tuning
   above). It requires hoisting the scattered constants into one object — worth it.
6. Then the **original closing gates** still pending from before this round: **H.2**
   cross-engine road-existence integer test (I had just started reading `roads.js:198` —
   the `Math.abs(ccw - Math.PI) < 0.05` float tie-break that can flip road existence per
   engine; quantize `ccw` to an integer orientation, re-record the queryPoint golden, verify
   node==browser); **H.3 + F.5** real-device draw/tri budget (needs Gary's hardware — the
   throttled preview reads `renderer.info` as 1/1); then **I-landing** (flip
   `DEFAULT_WORLDGEN_V2`, ARCHITECTURE.md rewrite). **Do NOT flip the flag without Gary's
   explicit go** — it ships v2 to the live GitHub Pages deploy.

**Determinism reminders for all of the above:** festival.js plan changes (vendor straddle,
drum road-reject, spawn rank override) move the **POI golden** (currently `3b9fc6b6` node) —
expected, flag-off, re-record the selftest.js comment. Build-side changes (torch road-check,
camp model, table model, string lights) don't touch the golden. The **queryPoint golden
`eddf8e50`** must stay unless H.2 deliberately moves it. Quantize any new trig before a
threshold compare. After ANY chunk-builder edit, **boot the real game** (the `buildCampTent`
`{group,...}` crash this session is the standing reminder that import/sandbox tests pass while
`buildWorld` crashes).
