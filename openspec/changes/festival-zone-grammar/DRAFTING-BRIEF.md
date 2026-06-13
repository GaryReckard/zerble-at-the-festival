# DRAFTING BRIEF — festival-zone-grammar

> **For the session that drafts this change's artifacts.** This change is
> deliberately empty until the `worldgen-layout-harness` grammar-unblock
> milestone lands (linter + `verification/baseline.md`). This brief captures
> the context that would otherwise live only in the 2026-06-10 planning
> conversation. Draft with the strongest model available (the artifact-writing
> IS the judgment-dense part); expect a `/deliberate` round (this change moves
> the POI golden + regenerates the world — the determinism signature fires by
> design); finish with a delegation/guardrails pass like the harness got
> (see APPLY-GUARDRAILS.md there as the template).

## What this change is

The actual layout fix. The harness built the eyes (hub viewer, overlay) and
the ruler (linter + baseline); this change redesigns `festival.js` placement +
the `chunks.js` builders so the festival reads as intentionally arranged, and
drives the baseline's violation counts toward zero. Success is numeric
(per-rule counts vs `worldgen-layout-harness/verification/baseline.md`) AND
Gary-judged (in-game 3D screenshots — he does not judge from 2D overlays).

## Read first (the durable inputs, in order)

1. ROADMAP "Festival layout — the plan/build contract refactor" — diagnosis +
   the 4-step direction (shapes-not-points, zone slotting, builder clearance
   discipline, spur roads).
2. `../worldgen-layout-harness/design.md` **D-C′** — the deferred extraction's
   full design (model param splits across ~8 files, crowd pre-rolled params —
   which also fixes today's tier-dependent layouts, `env={waterAt,blockedAt}`,
   the Math.random transcribe-as-is trap). That extraction is THIS change's
   early work, under this change's deliberately-moving golden.
3. `../worldgen-layout-harness/deliberations/001-initial/results.md` — CG1
   hands the guidance forward; "Dissents preserved" records what was deferred
   vs rejected (nothing was rejected).
4. `../worldgen-layout-harness/session-log.md` — Key Decisions D1–D8 +
   discovery entries this change inherits: the registry mover-exclusion list
   (lurleen, hula_hoop), the tier-dependent crowd draws, and **D8's
   "two owners, do NOT merge" constants map** — those merges become LEGAL (and
   wanted) here, where world drift is expected and gated.
5. `../worldgen-layout-harness/verification/baseline.md` (once it exists) —
   the measuring stick. The proposal should cite its worst offenders.
6. `openspec/changes/v2-worldgen-3d-integration/festival-polish-backlog.md` —
   Gary's round-1/round-2 playtest notes (the raw feel feedback).

## Gary's design intent (2026-06-10 conversation — the part not written elsewhere)

Verbatim-distilled from his brief; treat as requirements for the zone rules:

- **Arrival:** Zerble spawns ON a road, close to the MAIN stage (wood roof),
  festival arch some distance ahead framing the view, main stage beyond it in
  the distance. (Round-2 landing ② got partway; spawn-on-road vs face-the-stage
  was left as an open tradeoff — resolve it in this grammar.)
- **Vendor rows STRADDLE roads** (booths both sides facing the aisle), with
  **FULL campsites behind them** (not bare tents).
- **Food courts a respectful distance from stages** — never right up on one. A
  road MAY pass through a court but never through trucks — or the circle sits
  off-road, ideally with a **mini spur road leading to its center**.
- **Sugar Shack = a percentage of food-truck clusters** (exists today: courts
  only). Future: per-truck customization within a cluster (currently generic).
- **Bubble vendors sprinkled SPARINGLY in places that make sense** — today
  they're GUARANTEED 1 per hub (festival.js "1 guaranteed"), which is too
  many. Make presence a tunable probability.
- **Stage types:** main stage (wooden roof), tent stages (large covered areas),
  side stages. **Stages must not be too close to other stages** (today there is
  NO cross-hub stage-spacing rule at all).
- **Stage fronts:** a mostly-clear dance area — no trees in it; trees CAN
  thicken further back/behind the stage. (Harness made the dancefloor rect a
  tree-repellent only; this change makes it a hard reservation against ALL
  placement, and unifies the planner's ~38m dancefloor with buildStage's
  internal 9m one — a known two-owners pair.)
- Porta potties should read as SERVING something (attached to a stage / court /
  vendor row edge, facing it) — not random scatter.

## What made `main`'s world feel ordered (re-borrow these mechanisms)

From the 2026-06-10 comparative analysis of the pre-worldgen game (verified
against `main` then; re-verify line numbers before relying):

1. **One theme per 80m chunk** = mutual exclusion by construction (a plaza
   could never clip a stage). The zone grammar is this idea at hub scale:
   non-overlapping zones, each owning its interior.
2. **Fixed slot layouts inside each theme builder** (vendor row = two parallel
   lines at exact 5m spacing; plaza = even ring) — props couldn't drift.
   Slots > scatter.
3. **Registry discipline**: nearly every prop checked
   `registry.closestBuilding()` before placing, with bounded retry loops, and
   SKIPPED if no clear spot (main:src/chunks.js ~1509-1522 camp spacing was
   the exemplar). The v2 builders dropped this; restore it as the
   graceful-degradation backstop even after zones land.
4. **The path grid as visual anchor** — props clustered around a legible
   skeleton. v2's roads already provide the skeleton; the grammar must make
   placement visibly RELATE to it (straddle, face, set back).

Root cause being fixed, with the numbers: festival.js plans points + scalar
`KIND_FOOTPRINT` (food_court:16, vendor_row:12) while builds span ~20m+ (ring
14·scale + truck ~4.8) and ~18-20m oriented rectangles (booth rows + campers
behind) — `resolveOverlaps` separates centers by 16+12+2=30m where reality
needs ~40m. Plus: dancefloor repels only trees; builders place sub-components
blind; no cross-hub awareness.

## Shape of the work (suggested, not binding)

1. Extraction first (D-C′), one builder per commit, gated by the harness
   instrument (snapshot diffs + draw-count canary — the POI golden moves ONCE,
   deliberately, re-recorded + node==browser re-verified).
2. Then the zone grammar in `festival.js` planning on true extents (the
   harness's analytic extent helpers + the now-extracted layout records),
   iterating in the hub viewer + map-sandbox overlay, linted per commit.
3. Baseline burndown tracked per-rule in a Gary-legible before/after table;
   final judgment = Gary playtest with the marker hotkey.
4. `DEFAULT_WORLDGEN_V2` flip only AFTER this change lands (Gary-confirmed
   sequencing, written into the v2 HANDOFF 2026-06-10).
