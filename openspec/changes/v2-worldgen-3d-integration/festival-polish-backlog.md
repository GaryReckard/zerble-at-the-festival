# Festival polish + arrangement backlog (Gary playtest notes, 2026-06-07)

> **FRAMING (Gary, 2026-06-07): it is all ONE infinite festival.** Not many festivals,
> one per heart — a single, infinitely-large festival, with hubs/gathering areas
> (the "hearts") scattered through it and connected by roads. The gaps between hubs are
> still *the festival* (the chill/camping/wandering areas), just less dense. This is why
> density matters (it should feel continuous, not like discrete events with dead air) AND
> why arrangement matters (each hub is a coherent zone within the whole). **Language to
> update over time:** stop calling a heart "a festival"; it's a HUB / stage-area / gathering
> spot *within* the one festival. (`festivalPlan(heart)` → conceptually a "hub plan"; rename
> deferred to the redesign so we don't churn now.) The single entrance ARCH belongs to the
> whole festival, at the player's spawn — see A1.
>
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

- [x] **A1. DONE — exactly ONE arch in the entire world, at spawn, on the spawn hub's
  primary road** (`main.js` + `buildSpawnArch` in chunks.js; persistent, non-chunk-keyed).
  Original note: the entrance to the (one, infinite) festival, at the player's SPAWN.
  Confirmed (Gary): NOT per-hub, just the single grand entrance. Remove the arch from the
  per-heart plan entirely; build the one arch as part of the spawn setup (main.js spawn
  block already finds the spawn heart's stage — anchor the arch there). (Today: arch on
  every heart's primary road → arches everywhere, often mid-row. Delete that.)
- [x] **A2. DONE — arch banner reads "FESTIVAL" correctly from both sides.**
  `models/entranceArch.js`: replaced the single DoubleSide plane (mirrored from behind)
  with two back-to-back FrontSide planes (the back one rotated 180°). Verified in-game.
- [x] **A3. DONE (grammar) — stage faces +F, the widest DRY gap BETWEEN roads, so no road is in front by construction.** Stage never has a road right in front of it. Many stages sit just off a road
  with the road passing through the dancefloor. The stage's FRONT (dancefloor/audience
  side) must face open grounds, never a road corridor.
- [x] **A4. DONE (grammar) — `scatterWorldgenTrees` skips an oriented dancefloor rect in front of each stage (dancefloorRectsNear); woods nestle the back/sides.** Clear trees from directly in front of a stage (~3 stage-lengths of dancefloor),
  while letting woods nestle the BACK/sides (great atmosphere — confirmed good with
  `DENSITY_THRESHOLD 0.2`). So: stage backs into woods, faces a cleared dancefloor.
  (Needs a stage-front clearing rule that `scatterWorldgenTrees` honors — a no-tree
  oriented rectangle in front of each stage.)
- [x] **A5. DONE (grammar) — vendor rows sit on the drag (longest road), out past the dancefloor, parallel to the road; overlap guard keeps them off the stage.** Vendor rows straddle a STRAIGHT length of road, and are NOT at/super-close to a
  stage (somewhat nearby OK). (`buildVendorRowAt` already aligns to a road; the redesign
  must pick a straight road segment AWAY from the stage, and keep the rows from crossing
  the stage.)
- [x] **A6. DONE (grammar) — food courts on the drag, out past the dancefloor, away from the stage.** (somewhat nearby OK).
- [~] **A7. PARTIAL — the truck ring already leaves an open drivable center (the plaza); picnic tables in it land with C2 (deferred).** Food court center patch — a circular-ish road-like clearing in the middle of a
  food-truck circle, big enough for 1-3 picnic tables (see C2), AND still leaving room for
  Zerble to drive *within* the circle. (`buildFoodCourtAt` — add a center plaza + keep the
  truck ring radius generous.)
- [~] **A8. PARTIAL — portas attach per-cluster and the overlap guard pushes them to the margin (off the dancefloor / out of the truck ring); bespoke per-entity rules could refine further.** Per-big-entity porta-potty placement rules. Stages, food-truck circles, the big
  drum circle each get sensible potty spots (e.g., off to one side at the margin, not inside
  the dancefloor / not inside the truck circle). Today potties attach generically.

## B. Missing entities (never seen in playtest — likely placement/gating bugs)

- [x] **B1. DONE — minor hubs roll a tent stage ~35% (festival.js emits `tent_stage`; `buildTentStageTheme` parameterized to (cx,cz,yaw); legacy path byte-identical). Verified in-game.** Tent stage never appeared in v2. (v1 had a `tent_stage` theme; v2's
  `festival.js` only emits `main_stage`/`side_stage`. Add tent_stage to the festival
  catalog / heart-rank variety.)
- [x] **B2. DONE — the FULL leaf drum circle now builds at the worldgen drum spot** (fire, dancers, drummers, benches, spatial groove; `buildWorldgenDrumCircle` in forests.js). Verified in-game at night. (was: never seen.) v2 emits a `drum_circle` descriptor → `buildDrumCircleAt`,
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
- [x] **C3. DONE — tiki torches mark stage dancefloor corners + ring food-court perimeters (emissive, glow at night).** Tiki torches as boundary/edge markers. Occasionally by ROADS; a handful setting
  a STAGE's boundaries; around FOOD COURTS; maybe vendor rows. (`models/campsite.js` has
  `buildTorchField` / tiki torches already — reuse. Emissive, nightness-gated.)

## D. Campsites

- [x] **D1. DONE (existing systems) — grid villages scatter across district fields AND tree-adjacent spots (woods scatter wraps them); not lakeside-only.** Cluster near trees AND in fields (both, not only lakeside). Today camp villages
  are district/outskirts + the lake camp ring. Add tree-adjacent + open-field clusters.
- [x] **D2. DONE — village tent count scales with local heart-influence (~6+influence*16, 5-22), tracking the per-chunk crowd (~1.5 people/tent).** Tent count ≈ crowd count (~1.5×). Tie the number of campsites/tents to the
  number of roaming people (assume 1-2 sleep per tent). We have small/medium/large camps —
  scale total tents off the ambient-crowd count for a given area. (Cross-system: crowd count
  is `heartInfluence`-scaled per chunk in `chunks.js`; campsite count is festival.js villages
  + lake rings. Need a shared "how many people here" → "how many tents" relationship.)
- [x] **D3. DONE — a camper tent tucks behind ~40% of vendor stalls (back side, away from the aisle).** Vendor rows get campsites JUST BEHIND each vendor tent. (`buildVendorRowAt` —
  after placing each tent, place a small campsite behind it, away from the road side.)

## E. Crowd

- [ ] **E1. People should tend to walk ALONG roads** (some draw to follow paths — wandering
  everywhere is good, but a road-follow tendency feels more real). This is a LEVER to tweak.
  (Group G already seeds `path_node` attractors every ~26m along roads so the crowd clusters
  along them — but it's apparently too weak. Strengthen: higher path_node attractor weight,
  tighter spacing, OR a gentle per-frame road-follow steering that's CHEAP — note `nearestRoad`
  is 215µs/call so per-NPC-per-frame is out; could cache a road-tangent per NPC at retarget.)
- [ ] **E2. MAP the people taxonomy + write it down.** Gary's hunch (confirmed worth checking):
  the various people classes each have their OWN logic — he's seen changes to one not transfer
  to others when he expected them to. Kids, wooks, hula-hoopers, zerble-riders, band members,
  drum-circle figures, etc. — document which are the one ambient `Crowd` pool (`crowd.js`,
  `npcs[]` + state/personality) vs separate bespoke systems (`obstacles.js`: KidGaggle /
  PuppetParade / BrassBand; the drum-circle `tribalFigures`; wooks — find where). Produce a
  clear taxonomy (what's shared, what's bespoke, why) so future behavior/placement work knows
  what a change will and won't propagate to. Gary's hunch is probably right — likely several
  independent systems, not one base class. Just a doc/understanding task for now.

## F. Woods / density / fields

- [x] **F1. DONE — lone trees dot the open fields (scatterWorldgenTrees lone pass, capped under R3).** A tree or two even in the big empty fields.** Open fields shouldn't be totally
  bare — sprinkle the occasional lone tree. (Today `scatterWorldgenTrees` skips `treeDensity
  <= 0.05` → clearings are fully bare. Add a low-probability lone-tree pass for near-zero
  density cells, OR a small treeDensity floor in open areas.)
- [ ] **F2. Gary likes `DENSITY_THRESHOLD 0.2` + `LAKE_RING_BAND 160`** (more forest, fat lake
  tree-rings). Keep these in the density re-settle.

## G. Picnic blankets + chairs (sprinkle, don't carpet)

- [x] **G1. DONE — a handful of pooled picnic blankets sprinkled in each stage's chair band (buildStage).** Picnic blankets sprinkled like the chairs, NEAR STAGES — NOT carpeted
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
