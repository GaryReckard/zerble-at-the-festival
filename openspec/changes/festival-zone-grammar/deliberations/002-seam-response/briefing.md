# Deliberation Briefing — festival-zone-grammar Group 4B.3 (cross-hub seam RESPONSE)

> **Mode:** debate (two-phase). **Tier:** 3 (full council).
> Same briefing to every persona. Write your position in isolation from your own
> domain lens. Cite file:line / command output / git ref for every project-specific
> claim (cite-or-cut — the repo's house rule). Do NOT speculate about what other
> personas will say.

## The decision under deliberation

Design the **4B.3 seam RESPONSE** for the DENSE & SEAMED festival grammar, and
decide the architecture + build order. This is the single riskiest commit in the
change: it **moves the POI determinism golden a second time** and **removes two
shipped builder-side band-aids**.

## Where the context lives (read these first)

- `openspec/changes/festival-zone-grammar/design.md` — D7 (seam grammar), D8
  (integer-only determinism), D9 (emergent arrival), and the revised D6 (golden moves).
- `openspec/changes/festival-zone-grammar/session-log.md` — Key Decisions **D19–D23**
  (the Gary-grill design-lock, 2026-06-14) + the latest Work Log entries.
- `openspec/changes/festival-zone-grammar/tasks.md` — **Group 4B** (the seam pass).
- `CLAUDE.md` + `.claude/rules/*.md` — the tripwires (determinism, threeShim/material
  tier, chunk/lake lifecycle + disposal, perf budgets, iOS audio, importmap-in-4-html).
- `openspec/changes/festival-zone-grammar/research/festival-layout-chatgpt-round3-deep-research.md`
  — the seam-typing framing (Lynch districts/edges/nodes).

## What's already BUILT + committed (golden-frozen, verify at these refs)

- `0bc68c1` — **4B.1**: `getHubPriority(cx,cz)` (integer `cellHash`+`SALT.hubPriority`)
  + `seamPairsNear(bounds)` (canonical (cx,cz) pair order, integer squared-distance
  gate, `edgeHash`+`SALT.seam`, keeper=higher-priority). Pure, order-independent.
  See `src/worldgen/festival.js` (search `getHubPriority` / `seamPairsNear`).
- `3f5cf73` — **4B.2**: `classifySeamsNear(bounds)` + `SEAM_CATEGORY` / `seamExtentInt`
  / `nearestZoneToward` / `classifySeamType`. Integer existence gate (integer
  center-distance vs quantized conservative extent). Validated: seed 1139472710's two
  food-court pins → `merged_court`. Both goldens frozen (`queryPoint eddf8e50` /
  `POI 49ec28fc`), proven by the full `runSelfTest` at this file state.

## What 4B.3 must design (the response)

Modify the planner so seams resolve to designed places:
- **merge** — food+food → ONE shared court serving both hubs (not two adjacent).
- **trim** — commerce+commerce → shared street: trim the lower-priority vendor row
  along its road axis to clear the conflict; skip only if the trimmed length can't
  seat 3 booths (Gemini R4 — gentler than whole-row omit).
- **soft_buffer** — loud↔quiet (stage↔camp) → trees/hammock/shade/potty/connector path.
- **yield** — loud+loud (drum vs stage) → the lower-priority loud zone yields.
- **REMOVES** the builder-side band-aids `neighbourCourtHere` + `stageDeckClips`
  (`src/chunks.js`) — their blind, load-order-dependent forms of merge + yield.

## Stress-test these specifically (the questions Gary wants answered)

1. **Integer-only determinism of the RESPONSE.** `clusterExtent` is float (used only
   as a quantized integer in 4B.2). When merge/trim emit *different descriptors per
   seam*, does the output stay bit-identical node-vs-browser? Is there ANY float that
   gates existence (footgun #4 — the road-existence-flip class)? Where exactly does a
   `quantize()` boundary (.5) risk flipping cross-engine?
2. **Load-order / order-independence.** Both hubs of a seam must derive the IDENTICAL
   response with NO communication, in the streaming game where chunks build in
   PROXIMITY order, not `out[]` order — this is exactly where the band-aids failed.
   Does emitting the response inside the memoized per-heart `festivalPlan(heart)`
   preserve that, or does it re-introduce asymmetry (hub A's plan vs hub B's plan
   disagreeing on who trims)?
3. **The second golden move.** Acceptable to move it again? How to gate (re-record +
   `node==browser` verify; the accepted V8-fork caveat)? What's the rollback if a
   snapshot diff is non-empty?
4. **Perf.** New buffer/path geometry per seam: `userData.shared` + dispose-safety,
   `castShadow` discipline, per-tier draw/tri budgets (low 80/150k, mid 200/400k,
   high 400/1.2M). Allocation vs steady-state cost. How many seams per chunk neighborhood?
5. **Regression risk.** Does removing `neighbourCourtHere`/`stageDeckClips` risk
   regressing the already-fixed playtest pins, and how do we prove it doesn't?
6. **Architecture.** Is making the memoized per-heart `festivalPlan` seam-aware the
   right home, vs a separate post-plan reconciliation pass? `festivalPlan` is currently
   PURELY per-heart + memoized (gated on seed+epoch). A seam-aware plan must call
   neighbours' plans (recursion / cache-warming concerns — the earlier "senior keep-out"
   experiment hit 8s/plan + stack overflow; see session-log Work Log 2026-06-14
   "Playtest round 2" for that dead end).

## Hard constraints (non-negotiable — these OVERRIDE any persona preference)

- No bundler / no-build; importmap in all 4 html files; new src module ⇒ 4 importmaps.
- No `THREE.X = Y` after import (Safari module-freeze); tier override via `threeShim.js`.
- Determinism is load-bearing; any float that gates EXISTENCE must be integerized.
- `userData.shared = true` on pooled geometry/materials or chunk-unload disposes them.
- Don't reflexively `castShadow = true`.
- The golden may move ONCE here, deliberately, gated + re-verified.

## Deliverable from each persona

A position from your lens: the risks you own, where the proposed 4B.3 is wrong or
under-specified, and what you'd change — concrete, cited. The Mediator will synthesize
into Change Groups (a build plan) after Round 2.
