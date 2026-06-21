# Festival layout grammar — the hub redesign spec (DRAFT for Gary + /deliberate)

> **Status: DRAFT — design collaboration.** This is the spec to stress-test
> *before* rebuilding `festival.js`. It supersedes the independent-placement
> logic in `_computePlan` (festival.js:172) that caused the playtest disasters
> (stage facing water, vendor row punched through the stage, arch mid-row,
> court with a porta inside it). Read alongside `festival-polish-backlog.md`
> (the 18 notes) and design.md "Festival Layout Redesign (D-K..D-Q)".
>
> **Framing (Gary):** ONE infinite festival; "hearts" are HUBS / gathering
> areas within it. This doc says "hub" for what the code still calls a heart.

---

## 1. The diagnosis (why today's layout collides)

`_computePlan` places each piece against the heart + roads **independently**:

- Stage at heart center, facing *whatever* road is nearest (`queryPoint(...).facing`)
  → often faces water or a road corridor.
- Arch on `roads[0]`, courts on the longest roads, vendor rows on the longest
  roads, drum in a treed pocket — **each chosen without reference to the others**.
- No overlap guard → two clusters land on the same ground → "row through stage."

There is **no shared notion of which way the hub faces.** Everything downstream
of that is the bug. The fix is a single **front axis** that every piece obeys.

---

## 2. The core idea: a hub has a FRONT and a BACK

Every hub gets one computed **front axis `F`** (a world-space unit direction).
From `F` and the hub's roads + nearby water, *every* entity is placed by a rule.
Think of it as a stage-and-fairgrounds with a clear orientation:

```
                      BACK  (−F)
        woods stay · camps · drum circle (treed pocket)
                         │
            ┌────────────┴────────────┐
            │      ███ STAGE ███      │   ← stage at hub center,
            │      faces +F           │     FRONT (+Z) rotated to +F
            └────────────┬────────────┘
              ░░ DANCEFLOOR (cleared) ░░     ← A4: no trees, A3: no road,
              ░░  chairs + blankets   ░░       ~3 stage-lengths deep
                         │
                    ▛▀ ARCH ▀▜              ← (SPAWN hub only) at dancefloor
                         │                     front, facing the stage
                    · spawn · (player)
                         +F

   ── road ──●────────────────────────●──── road ──   ← the "drag": a road in a
        vendor row · food court (away from stage)         DIFFERENT angular sector
        camps tucked behind each vendor tent              than F → never crosses
                                                          the dancefloor
```

- **Front (`+F`)**: open, cleared dancefloor. Stage faces it. Arch + spawn here
  (spawn hub only). Tiki torches mark its edge. Chairs + a few picnic blankets.
- **Back / sides (`−F`)**: woods stay (we only clear the front), drum circle in
  a treed pocket, camp clusters.
- **The drag**: the hub's longest road, which by construction lives in a
  *different* angular sector than `F`. Vendor rows + food courts straddle a
  straight segment of it, set OUT past the dancefloor (away from the stage).

---

## 3. Computing the front axis `F` (the keystone)

`F` is what makes A3 ("no road in front of the stage") true *by construction*.

**Inputs:** `heart {x,z,core,district,rank}`, `roads = approachRoadsOf(heart)`
(each has an outward `bearing` + `lenQ`), nearby lake via `nearestLake`.

**Rule — "widest dry gap":**
1. If the hub has ≥1 road: take the road outward bearings, sort them, and find
   the **angular gaps** between consecutive roads (wrapping 360°). Candidate `F`
   directions = the **bisector of each gap**. (A gap is open ground *between*
   roads — so a dancefloor facing a gap never points down a road. A3 ✓.)
2. Score each candidate by: **gap width** (wider = roomier dancefloor) **minus a
   heavy water penalty** — walk out `core + dancefloorDepth` along the bisector;
   if the ray hits a lake or stays `noBuild`, penalize hard.
3. Pick the best; **quantize the chosen bearing** to a fixed grid before any
   downstream compare (determinism, footgun #4 — `sin/cos/atan2` aren't
   bit-identical cross-engine).
4. If the hub has **0 roads**: sample N=16 bearings, score each by dry open
   ground walked out `core` meters, pick the best (ties → lowest quantized
   bearing index).

**Result:** the dancefloor always faces open, dry ground in a gap between roads.
Stage backs into woods (we only clear the front). The drag is off to the side.

---

## 4. The placement rules (every entity, relative to `F` + road + water)

| Entity | Rule | Backlog |
|---|---|---|
| **Stage** | Hub center (nudged off `noBuild`). Yaw so FRONT (+Z) = `+F`. Major → main stage; minor → side stage. | A3 |
| **Dancefloor clearing** | Oriented no-tree rect in front of the stage along `+F`, ~3 stage-lengths deep × ~stage-width+margin. `scatterWorldgenTrees` must skip trees inside it. Woods nestle the back/sides. | A4 |
| **Chairs + picnic blankets** | Sprinkled in the chair band behind the dancefloor + a few blanket clumps near the stage grounds — NOT carpeted. | G1 |
| **Arch** | **Removed from the per-hub plan.** Built ONCE, at the player's spawn hub only, ON the primary approach road (see §6 — Gary's call). | A1, A2 |
| **The drag** | Hub's longest road (`roads[0]`). Pick the straightest reachable sub-segment OUT past the dancefloor depth (`core + 20..70`, clamped to `MAX_POI_REACH` + road length). | A5 |
| **Vendor rows** | Parallel to the drag (yaw = road tangent), offset off the corridor, on the drag — away from the stage. Major 1–2, minor 0–1. | A5 |
| **Food court** | Truck **ring** along the drag, offset off the corridor, away from the stage. **Center plaza** cleared for picnic tables + Zerble room; generous ring radius. Sugar shacks ONLY here. | A6, A7 |
| **Picnic tables** (NEW) | In the food-court center plaza; people can sit. New `models/picnicTable.js`. | C2 |
| **Bubble vendor** | One guaranteed refuel per hub (court edge or a quieter roadside). | — |
| **Drum circle** | A destination in a **treed pocket**, BACK/side of the hub, off the drag. Verify it builds the FULL leaf circle (fire/dancers/drummers/benches/music). | B2 |
| **Tent stage** (variety) | Add to the catalog so some hubs get a tent stage, not always main/side. | B1 |
| **Porta-banks** | Per big entity, at the **margin** — off to one side, outside the footprint. Never in the dancefloor or inside the truck ring. | A8 |
| **Tiki torches** | Mark the dancefloor edge; a few along the drag near the hub; ring the food-court perimeter. | C3 |
| **Camps** | BACK of the hub (`−F`), tree-adjacent + open-field clusters; small camp tucked behind each vendor tent (road-far side). Tent count ≈ crowd count (~1.5×). | D1, D2, D3 |
| **Hammocks** | Between two close trees (no posts) — a post-pass over `scatterWorldgenTrees` trunk pairs within hammock span. | C1 |
| **Lone field trees** | Sprinkle the occasional tree in near-zero-density open fields (don't leave them totally bare). | F1 |

---

## 5. The overlap guard (the safety net)

The sectoring (front = dancefloor, drag = rows/courts, back = camps + drum)
*should* keep clusters apart — but add a final pass as insurance: each cluster
carries a footprint radius; if a later cluster's circle overlaps an
already-placed one, push it outward along its placement ray until clear, or drop
it if it can't clear within budget. This is what structurally prevents "vendor
row through the stage" even if two rules happen to aim at the same ground.

---

## 6. The one arch, at spawn (A1) — **on the approach road** (Gary's call)

Exactly ONE arch in the whole world: the grand entrance to the (one, infinite)
festival, at the player's spawn. Built in the spawn block (`main.js`), NOT in
any hub's plan:

- Spawn hub = `nearestMajorHeart(0,0)` (already wired, D-O).
- Place the arch **straddling the spawn hub's primary approach road**, out from
  the hub center toward the road's outward end, **facing back along the road at
  the hub** (the road threads through the arch into the festival).
- Spawn Zerble just OUTSIDE the arch on the road, facing inward → drive along
  the road, through the arch, into the hub. Because the stage faces the widest
  dry *gap* (§3, not down a road), the **stage reads off to the side** as you
  arrive — a "main gate at the end of the street," not a head-on stage shot.
  (Gary chose this over the dancefloor-front option deliberately.)
- The intro jugs seed near this spawn (keep the 25–60 m ring; "more jugs").
- Fix the banner so "FESTIVAL" reads correctly from both sides (A2).

---

## 7. Determinism + must-not-regress (unchanged from D-P)

- Fresh `SALT.poiLayout` already in use; **quantize every trig result** (the
  front-axis bearing especially) before a threshold compare.
- `festivalPlan(heart)` stays memoized, gated on `(seed, epoch)`, seeded ONLY
  off the heart (window-invariance).
- POI layer does not touch the `queryPoint` tuple → `queryPoint` golden stable;
  the POI golden WILL move (that's expected — flag-off).
- Invariants: nothing in water; stage never back-deck-at-spawn; stage music
  attaches once; `userData.shared` on pooled mats; no reorder of existing draws;
  people don't shove a parked Zerble.

---

## 8. Decision forks — RESOLVED (Gary, 2026-06-07)

1. **Front-axis rule → "widest dry gap between roads."** Dancefloor faces open
   ground between roads; A3 holds by construction. (§3.)
2. **Arch at spawn → "on the approach road."** Drive in along the street through
   the arch; stage reads off to the side. (§6.)
3. **Process → `/deliberate` the spec first**, fold in the Change Groups, then
   rebuild `festival.js`.

---

## 9. Build order once approved (proposal)

1. Front-axis `F` + the §3 scoring (pure, in `festival.js`; unit-checkable).
2. Re-anchor stage/court/row/drum/bubble/porta to `F` + the §4 rules + §5 guard.
3. Dancefloor clearing rects exposed → `scatterWorldgenTrees` honors them (A4).
4. Arch → spawn only (A1/A2); delete the per-hub arch.
5. Boot + verify one hub reads right (noon + midnight, low + default tier).
6. THEN the rest of the backlog (B/C/D/G) + re-settle density.
</content>
</invoke>
