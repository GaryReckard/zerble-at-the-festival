# Festival polish + arrangement backlog (Gary playtest notes, 2026-06-07)

> **Status: SALVAGE v2 (decided). Not going back to `main`.** The world *structure*
> (deterministic hearts → roads → lakes → woods → crowd + the harness) is the upgrade
> Gary likes. The problem is concentrated in `festival.js`'s ARRANGEMENT logic — it
> places a heart's pieces (stage / arch / vendor rows / court / drum / camps) relative
> to the heart + roads INDEPENDENTLY, with no rule about how they relate, so they
> collide and face wrong (stage faces water, chairs in water, row through the stage,
> arch mid-row, court with stuff inside it). The fix is a **festival LAYOUT GRAMMAR**:
> decide a festival's "front" (away from water, toward the main approach road), then
> place every entity by a rule relative to that front-axis + the water + the road.
>
> **This is the next big work, to be done TOGETHER.** Recommended path: draft the
> layout-grammar spec → `/deliberate` it (stress-test "what IS a festival's layout")
> → rebuild `festival.js` around it → re-settle density after one festival reads right.
>
> Below: Gary's notes, organized + with technical hooks. Each is a real item to attend
> to "in due time." Nothing here is done yet unless marked.

## Current experimental config (in the working tree, UNCOMMITTED)

Gary tuned this live in the map-sandbox and likes the density direction:
`HEART_CELL 200`, `noneBelow 0.05` (5% empty), minor `{core 90, district 160}`,
major `{core 100, district 200}`, `LAKE_CELL 600`, `DENSITY_THRESHOLD 0.2`,
`LAKE_RING_BAND 160`. Likes the woods (0.2) + lake rings (160) especially.
- ⚠ Self-test is **23/24** at this config: the road negative-control loses its teeth on
  one seed (5% empty ≈ no road-sparse region → the test can't find a "window matters"
  sample). NOT a determinism break; the harness just can't fully self-verify this dense.
  When re-settling density: either keep ~15-20% empty (keeps teeth) OR move the
  negative-control sample points to guaranteed-sparse far-field. Decide deliberately.
- Goldens at this config: queryPoint `eddf8e50` / POI `6fa977c8` (node). Will move again
  as we tune — that's fine (v2 is flag-off).

---

## A. Festival arrangement grammar (THE core redesign — `festival.js`)

- [ ] **A1. Exactly ONE festival arch per world, at the START, by the main stage** (the
  wooden-roof one). Not one-per-heart, not mid-vendor-row. The arch marks the player's
  entrance to the *first/spawn* festival only. (Today: arch on every heart's primary road
  → arches everywhere, often mid-row.)
- [ ] **A2. Fix the arch banner** so "FESTIVAL" is not mirrored/backwards when viewed from
  behind. (`models/entranceArch.js` — likely a single-sided text plane or a flipped
  duplicate; needs a back-facing correctly-oriented copy or double-sided non-mirrored text.)
- [ ] **A3. Stage never has a road right in front of it.** Many stages sit just off a road
  with the road passing through the dancefloor. The stage's FRONT (dancefloor/audience
  side) must face open grounds, never a road corridor.
- [ ] **A4. Clear trees from directly in front of a stage** (~3 stage-lengths of dancefloor),
  while letting woods nestle the BACK/sides (great atmosphere — confirmed good with
  `DENSITY_THRESHOLD 0.2`). So: stage backs into woods, faces a cleared dancefloor.
  (Needs a stage-front clearing rule that `scatterWorldgenTrees` honors — a no-tree
  oriented rectangle in front of each stage.)
- [ ] **A5. Vendor rows straddle a STRAIGHT length of road**, and are NOT at/super-close to a
  stage (somewhat nearby OK). (`buildVendorRowAt` already aligns to a road; the redesign
  must pick a straight road segment AWAY from the stage, and keep the rows from crossing
  the stage.)
- [ ] **A6. Food courts also kept away from right-near a stage** (somewhat nearby OK).
- [ ] **A7. Food court center patch** — a circular-ish road-like clearing in the middle of a
  food-truck circle, big enough for 1-3 picnic tables (see C2), AND still leaving room for
  Zerble to drive *within* the circle. (`buildFoodCourtAt` — add a center plaza + keep the
  truck ring radius generous.)
- [ ] **A8. Per-big-entity porta-potty placement rules.** Stages, food-truck circles, the big
  drum circle each get sensible potty spots (e.g., off to one side at the margin, not inside
  the dancefloor / not inside the truck circle). Today potties attach generically.

## B. Missing entities (never seen in playtest — likely placement/gating bugs)

- [ ] **B1. Tent stage** never appears in v2. (v1 had a `tent_stage` theme; v2's
  `festival.js` only emits `main_stage`/`side_stage`. Add tent_stage to the festival
  catalog / heart-rank variety.)
- [ ] **B2. Big drum circle** (fire, dancers, drummers, benches — the `leafDrumCircle` +
  `tribalFigures`) never seen. v2 emits a `drum_circle` descriptor → `buildDrumCircleAt`,
  but verify it's actually the FULL LEAF drum circle (fire/dancers/drummers/benches +
  spatial music), not a stub. It's placed at a treed district spot; confirm it builds +
  is reachable. (Group F verified a `drum_circle` registry entry exists at (1034,-50) for
  the OLD config, but Gary hasn't *seen* the full visual in play — check the model wired.)
- [ ] **B3. Hammocks** never seen. **B4. Picnic blankets** never seen. (These were the
  parked D2.4 "filler scatter" — never implemented in v2. See C3 + G1.)

## C. New entities / features

- [ ] **C1. Hammocks between two close trees (NO posts).** When two trees are close enough to
  string a hammock between them, spawn a post-less hammock. (`models/hammock.js` currently
  has its own posts; needs a variant that uses tree trunks as anchors. Requires the woods
  scatter to expose nearby-tree pairs — a post-pass after `scatterWorldgenTrees` that finds
  trunk pairs within hammock-span.)
- [ ] **C2. NEW entity: picnic table.** Spawns within/around a food-truck circle (esp. the
  center patch, A7). Bonus: people SIT at them (crowd state → "seated at picnic table",
  like the stage-front / potty states). New `models/picnicTable.js` + sandbox entry +
  importmap×3 + crowd seating behavior.
- [ ] **C3. Tiki torches as boundary/edge markers.** Occasionally by ROADS; a handful setting
  a STAGE's boundaries; around FOOD COURTS; maybe vendor rows. (`models/campsite.js` has
  `buildTorchField` / tiki torches already — reuse. Emissive, nightness-gated.)

## D. Campsites

- [ ] **D1. Cluster near trees AND in fields** (both, not only lakeside). Today camp villages
  are district/outskirts + the lake camp ring. Add tree-adjacent + open-field clusters.
- [ ] **D2. Tent count ≈ crowd count (~1.5×).** Tie the number of campsites/tents to the
  number of roaming people (assume 1-2 sleep per tent). We have small/medium/large camps —
  scale total tents off the ambient-crowd count for a given area. (Cross-system: crowd count
  is `heartInfluence`-scaled per chunk in `chunks.js`; campsite count is festival.js villages
  + lake rings. Need a shared "how many people here" → "how many tents" relationship.)
- [ ] **D3. Vendor rows get campsites JUST BEHIND each vendor tent.** (`buildVendorRowAt` —
  after placing each tent, place a small campsite behind it, away from the road side.)

## E. Crowd

- [ ] **E1. People should tend to walk ALONG roads** (some draw to follow paths — wandering
  everywhere is good, but a road-follow tendency feels more real). This is a LEVER to tweak.
  (Group G already seeds `path_node` attractors every ~26m along roads so the crowd clusters
  along them — but it's apparently too weak. Strengthen: higher path_node attractor weight,
  tighter spacing, OR a gentle per-frame road-follow steering that's CHEAP — note `nearestRoad`
  is 215µs/call so per-NPC-per-frame is out; could cache a road-tangent per NPC at retarget.)
- [ ] **E2. [CODE QUESTION] Do all the people classes share a common 'class'?** Kids, wooks,
  hula-hoopers, zerble-riders, band members, etc. — map whether they're all the one `Crowd`
  NPC pool (`crowd.js`, the `npcs[]` with a `state`/personality) or separate systems
  (`obstacles.js` has KidGaggle / PuppetParade / BrassBand; wooks?). Document the taxonomy so
  future placement/behavior work knows what's shared vs bespoke. (Likely: Crowd is the ambient
  pool; kids/band/puppets/wooks are separate moving-obstacle systems. Confirm + write it down.)

## F. Woods / density / fields

- [ ] **F1. A tree or two even in the big empty fields.** Open fields shouldn't be totally
  bare — sprinkle the occasional lone tree. (Today `scatterWorldgenTrees` skips `treeDensity
  <= 0.05` → clearings are fully bare. Add a low-probability lone-tree pass for near-zero
  density cells, OR a small treeDensity floor in open areas.)
- [ ] **F2. Gary likes `DENSITY_THRESHOLD 0.2` + `LAKE_RING_BAND 160`** (more forest, fat lake
  tree-rings). Keep these in the density re-settle.

## G. Picnic blankets + chairs (sprinkle, don't carpet)

- [ ] **G1. Picnic blankets sprinkled like the chairs, NEAR STAGES** — NOT carpeted
  everywhere (v1 put them all over; Gary disliked that). A handful around each stage's
  grounds, same spirit as the stage-front chairs. (This is the tasteful version of the
  parked D2.4 filler.)

## H. Lurleen (love interest) — `lurleen.js`

- [ ] **H1. Lurleen must START a distance away** in a random direction (she's been spawning
  right next to Zerble in v2 respawns — wrong). **And re-spawn elsewhere if the player gets
  too far from her.** v1 had this right; migrate/update that logic for the worldgen spawn
  (which now relocates Zerble to a heart — `main.js` spawn block). (Find v1's Lurleen
  spawn/leash logic; re-anchor it off the new worldgen spawn point.)

---

## Suggested execution order (proposal — refine together)

1. **Festival layout grammar** (Section A) — the keystone. Spec → `/deliberate` → rebuild
   `festival.js`. Fixes the "zero thought into what entities are" core complaint. Pulls in
   A1-A8 + the stage-front tree clearing (A4) which `scatterWorldgenTrees` must honor.
2. **Missing-entity audit** (B1/B2) — get tent stages + the full drum circle actually
   appearing (variety in the heart catalog).
3. **Campsite rules** (D1-D3) + **tent-count-tied-to-crowd** (D2) — the camping layer.
4. **Filler + atmosphere**: picnic blankets near stages (G1), tiki torches (C3), lone field
   trees (F1), hammocks-between-trees (C1).
5. **NEW picnic table entity** (C2) + food-court center patch (A7) + people seating.
6. **Crowd road-follow** strengthening (E1) + the people-class taxonomy writeup (E2).
7. **Lurleen spawn/leash** migration (H1).
8. Re-settle **density** (Section "Current config") once a single festival reads right;
   resolve the 23/24 negative-control-teeth question.

Then the closing GATES that were already queued before this backlog: **H.2** cross-engine
road-EXISTENCE integer test (amplified by the denser world), **H.3** per-tier budget +
the **F.5 real-device draw check**, then **I landing** (flip `DEFAULT_WORLDGEN_V2`,
ARCHITECTURE.md rewrite, ROADMAP trim).
