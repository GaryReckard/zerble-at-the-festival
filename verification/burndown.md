# Festival zone-grammar — layout burndown

What the zone-slotting grammar (`festival-zone-grammar`, group 4 + playtest fixes)
did to the layout-lint numbers. **Before** = the harness baseline
([baseline.md](baseline.md)); **after** = registry-mode `bin/lint` (the authority,
design D-D) on hubs built through the live game.

> Determinism: queryPoint (road/water existence) golden stays **FROZEN `eddf8e50`**.
> The POI golden moved in two deliberate flag-off steps — `4825fd0b → a0edfaea`
> (slotter) → `49ec28fc` (playtest fixes). See `src/worldgen/selftest.js`.

## The headline: the "trucks clipping vendor rows" disaster is gone

The baseline's defining failure was solid clusters interpenetrating by **5.8–7.5 m**
(`overlap`, the root-cause bug two playtest rounds reported as "a jumbled mess").
The oriented zone-slotter eliminates it:

| seed (registry, spawn neighbourhood) | overlap (error) | water-clear | arch-placement | drum-in-trees | notes |
|---|---|---|---|---|---|
| 1234            | **0** | 0 | 0 | 0 | clean |
| 1390463068      | **0** | 0 | 0 | 0 | clean |
| 1399551401      | **1 (1.1 m)** | 0 | 0 | 0 | one *grazing* tent×arch on a curved approach (was 5.8–7.5 m clips at baseline) |

Plan-mode sweep (10 seeds, approximate) corroborates the drum win:
`drum-in-trees` **80 → 7** after the "omit a treeless drum" rule (Gary 2026-06-14).

## What changed (per rule)

- **`overlap` (error) — effectively eliminated.** Oriented `clusterShapes` packing
  with omit-on-no-fit replaced the scatter-then-scalar-push that guaranteed clipping.
  Registry overlap is 0 on 2/3 sampled seeds; the lone residual is a **1.1 m grazing**
  contact (vs multi-metre penetrations before).
- **`arch-placement` (error) — 0.** The one arch is a planner-owned gateway on a road
  ≥ 2 dancefloor-lengths from the stage; it reads as a threshold, not a clip.
- **`drum-in-trees` (error) — collapsed.** Treeless drums are omitted entirely
  (plan-mode 80 → 7; the residual 7 are density-field edge cases near the 0.2 cutoff).
- **`water-clear` (error) — 0 on sampled hubs**, but the broad plan-mode sweep still
  reports ~368/10-seeds: **pre-existing** stages on lake-hearts + dancefloor mouths over
  water (HEAD had the same). Not regressed; the lake-heart fix is a group-6 follow-up.
- **`booth-on-road` (warn) — REFINED 16–27 → 6–8/seed.** Vendor booths sit at
  `±VENDOR_ROW_OFFSET` (7 m) = exactly the `±ROAD_WIDTH` noBuild *corridor* edge, but the
  VISIBLE ribbon is only ±ROAD_WIDTH/2; so a straddling booth is on the cleared *shoulder*,
  not the drive lane. The rule now measures `nearestRoad().dist` against the ribbon
  half-width (+grazing margin) instead of the generous `onRoad` corridor — so by-design
  straddling no longer flags, and the residual 6–8/seed are booths that genuinely drifted
  onto the visible surface on a curve (a per-booth builder onRoad-skip would zero them, but
  it costs a `nearestRoad` per booth — deferred for perf).
- **`dancefloor-clear` (warn) — 2–4/seed.** A booth at a vendor row's end swings into the
  stage clearing on a curved approach (outside the straight OBB the planner models).
  Group-5 builder backstop territory.

## Builder backstop (group 5, partial)

Added `registry.closestBuilding` clearance to `buildVendorRowAt` — a booth that would clip
an already-built solid (stage deck, neighbour truck) is skipped. Builder-only (chunk-gen,
clusterSeed stream) → both goldens unaffected. It's a *graceful-degradation* guard: in the
streaming game chunks build in proximity order, so it catches within-/already-loaded-chunk
clips, not every cross-chunk case (the residual tent×arch above is one it can't reach).

## Remaining for a full group-6 burndown (not yet zero)

1. **Full 10-seed registry re-capture** — this is a 3-seed sample; the baseline was 10.
2. **`water-clear` lake-hearts** — omit/relocate a stage whose heart sits in a lake
   (the biggest remaining error class, pre-existing).
3. ~~`booth-on-road` linter refinement~~ — DONE (measures the visible ribbon, not the
   ±ROAD_WIDTH corridor). Residual 6–8/seed are real curve-drift; a per-booth builder
   onRoad-skip would zero them (deferred for the `nearestRoad`-per-booth cost).
4. **The 1.1 m tent×arch grazing** on curved approaches — needs the planner to model the
   vendor-row curve (or widen the arch's row-clearance) rather than a build-order backstop.
5. **Re-baseline `baseline.md`** against the group-3 linter (the "106" headline undercounts;
   real all-rules total ≈ 136/92) so before/after share one ruler.
