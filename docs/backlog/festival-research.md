# Festival realism research

[Documentation index](../README.md) · [Roadmap](../../ROADMAP.md)

This record preserves dated investigations and design decisions. Shipped slices
are context, and unchecked or parked work is not a new implementation request.
Verify source anchors against the current code before resuming. Commands assume
the repository root.

### Festival realism research — validation + new ideas *(2026-06-14)*

Two independent deep-research passes (ChatGPT + Gemini, drawing on real festival
safety/planning literature — HSE crowd-design, Manchester acoustics, Sonoma/
Sacramento vendor-row + fire-lane geometry, Bonnaroo/Glastonbury/Electric Forest
district patterns) live in `openspec/changes/festival-zone-grammar/research/` (moved
out of repo root 2026-06-14).

**Headline: they VALIDATE the current direction — do not pivot.** Both converge,
independently, on "sectorize first, place content second; corridors + service
layers + landmarks, never asset-scatter" — which is exactly the
`festival-zone-grammar` plan/build-contract refactor + zone slotting we're mid-build
on. Specific alignments already in our plan: stages as edge anchors with a clear
front bowl + cross-hub spacing (our front-axis F + dancefloor reservation +
`stage-spacing` linter rule); vendor rows straddling roads vs food *courts* getting
their own off-road pockets (Gary's intent + the grammar); drum circles/hammocks as
"found" content just off main desire lines in forest (Gary's drum-in-clearing intent
+ the `drum-in-trees` rule). The research is reassurance that the in-flight effort
isn't wasted, not a course correction.

**Genuinely-new ideas worth parking (NOT now — after the grammar fix lands):**

- ~~**Welfare/amenity bundles attached to hubs.**~~ SHIPPED 2026-08-31 (see CHANGELOG):
  tiered `welfare_post` bundles (minimal / standard / plaza) replace the lone porta-bank
  attachments, the bubble vendor is the plaza tier's water amenity, the new
  `models/infoKiosk.js` covers the shade + info classes, and an `amenity-bundle` lint rule
  scores the research's "3 of 5 at every high-intensity node" in both plan and registry mode.
  **Follow-ups that fell out of it:**
  * ~~**Camp villages have no welfare.**~~ SHIPPED 2026-08-31 (same day, follow-up commit):
    every village emits its own minimal welfare post, a single bank or a double past 12
    tents, sited past the pitch square's edge on the road side. Guarded by the new
    `camp-welfare` registry lint rule. The deep-outskirts wild-camping scatter
    (`scatterWorldgenCampsites`, 3–5 sites) deliberately stays unserviced — that's the
    point of camping in the woods.
  * **Cross-hub welfare duplication.** Posts are slotted per hub with no cross-hub view,
    same structural limit as the still-open vendor-row overlap above. Two neighbouring
    hubs can each site a station at the seam between them. The seam grammar already types
    `soft_buffer` seams — a "shared amenity court" response (R3's seam type (b)) is the
    principled fix, and it would also let the shade table double as the seam's dressing.
  * **The committed `verification/snapshots/*.json` are stale** (captured June, ~842 entries
    vs today's ~734) and now also predate the welfare bundles. They are a verification
    artifact that currently lies. Worth one deliberate refresh pass — but it should be its
    own commit so months of accumulated drift doesn't get attributed to whatever change
    happens to be in flight.
- **Return-home landmarks + the player-facing map.** Infinite scale is only
  tolerable if every major hub has a legible "you are here / home base" marker
  (Bonnaroo's numbered balloons, Glastonbury's fixed info points). We already carry
  stable hub identity + `heartInfluence`; pair a tall from-far-visible landmark per
  major hub with the **in-game map view** already on ROADMAP (keyed off stable hub
  IDs). Highest-leverage *legibility* add for the infinite world.
- **Voronoi clearing-excavation for drum/hammock pockets.** A concrete algorithm for
  the v1 "clearing in dense trees with a Zerble-width access path" composition Gary
  wants back: Voronoi over the local tree field → excavate a large cell → nest the
  drum circle/campfire at its center, hammocks between boundary trees, carve one path
  in. Feeds `festival-zone-grammar`'s drum work (added to its DRAFTING-BRIEF).
  *(Mostly landed 2026-06-16 via the cheap version: woods have density-modulated impassable
  thicket cores + drivable fringes, posted hammocks + shrub undergrowth scatter, drum circles
  sit in tree-cleared pockets (`drumClearingsNear`) biased behind the stage, AND now a winding
  access footpath runs from the nearest road into each drum clearing (`buildDrumAccessPath`,
  ports v1 `buildForestPath`). What's left of the Voronoi item is the true excavation polish —
  a deliberately-carved large cell with hammocks between boundary trees — vs. the current
  emergent density gradient + per-POI clearing. Lower priority now that the composition reads.)*
- **"Quiet behind, loud in front" zoning** (symmetric to dancefloor-front-clear):
  push camps/drum/quiet content *behind* a stage or behind a tree buffer, out of its
  front audio cone — a cheap explicit rule, partly implied by our front-axis F.
- **Cheap acoustic *flavor* (not a sim):** dynamically duck a stage's music volume by
  the tree density between it and the player (Gemini's idea, shrunk to a one-liner).
  Nice-to-have, not direction-changing — we already have spatial audio.
- **Road-feel guards when collector/footpath tiers land** (already queued above):
  loop-closure / no-dead-ends, and a min turning radius on road splines so bends fit
  the cart. Borrow when the tiers ship; not before.

**Explicitly DON'T adopt (incompatible with our infinite + deterministic + no-build
constraints — recorded so nobody's tempted later):**

- **Force-directed / domain-warped hub layout.** Both docs recommend it; it's *wrong
  for us.* It requires seeing all hubs at once and iterating to equilibrium — which
  breaks window-invariance (footgun #4) and can't run on an infinite world evaluated
  in 80m windows. Our jittered-macrocell deterministic hearts are the correct model;
  the cross-hub overlap issues are solved by yield/share rules (shipped 2026-06-14),
  not a global solver.
- **Cellular-automata forest seeding.** Stateful/iterative grid over time; our
  continuous `treeDensity(x,z)` pure-hash field is better for infinite + deterministic
  + window-invariant. Don't swap.
- **Parish-Müller L-system road networks.** Built for bounded city grids; our
  hearts→arterials model is deterministic and windowable. Overkill + determinism-hostile.
- **Full acoustic-propagation simulation** (delay towers, sound-across-water modeling).
  Big sim system for a stylized game; the spatial audio we ship is enough. (The cheap
  tree-duck flavor above is the only morsel worth a look.)

The common thread: the research assumes a *bounded, planned-once* site; our magic is
an *infinite, streamed, deterministic* one. Take their layout-grammar wisdom (which we
already are); leave their global-solver algorithms.

**Rounds 2–4 (2026-06-14, docs in `festival-zone-grammar/research/`):** ChatGPT R3
deep research is the keeper — a Lynch-grounded catalog of LOCAL encodable rules with
cited numbers + a 6-lint priority list (gateway-before-stage, border-frontage-seam,
market-row-continuity, amenity-bundle, transition-path, drum-clearing) and cross-hub
framed as SEAM-TYPING (shared street / shared court / soft buffer + orientation-away).
Gemini converged (R2≈R3≈R4) on the geometry layer (OBB/SAT, vendor-row trimming,
hub-priority hash, SDF clearing). Full keepers + caveats captured in the
`festival-zone-grammar` DRAFTING-BRIEF, not duplicated here.
Gemini re-engaged within our constraints this time and produced concrete *windowable*
candidates — the keepers + caveats are captured in the `festival-zone-grammar`
DRAFTING-BRIEF ("Candidate rules + numbers"), not duplicated here. Headline keepers:
deterministic sugar-shack % (`hash(hub)%10<3`), bubble-vendor sparsity (junction
valence ≥3 / arch-stage midpoint, ~500m spacing), lake-ring camp band (3–15m), camps
15–30m behind merch rows, arch ~100m back over the road, an SDF winding-path drum
clearing, and a cross-hub **OBB-slot-priority** protocol (the candidate fix for the
still-open vendor-row overlap). **Two standing caveats:** (1) the numbers are
model-invented, not cited — tune in the hub viewer, expect conflicts with our values;
(2) the OBB-overlap boolean + SDF threshold are float compares that can flip
cross-engine — quantize before they gate existence (footgun #4). Full reconciliation
into tasks waits for the ChatGPT round-2 result (one consolidated pass).
