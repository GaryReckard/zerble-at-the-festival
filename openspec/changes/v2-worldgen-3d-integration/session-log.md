---
change: v2-worldgen-3d-integration
status: in_progress
current_task: artifacts (proposal done; design/specs/tasks next)
blocked_by: null
open_questions: 0
started: 2026-06-06
last_updated: 2026-06-06
ref: procedural-map-generator change (2D generator + sandbox, complete); ROADMAP "World generation (procedural map)" → "Wire the generator into the live 3D world as v2 worldgen"
---

# Session Log: v2 Worldgen → 3D Integration

> **AGENT DIRECTIVE:** New session / after compaction — read this file + `tasks.md`
> and `HANDOFF.md` before doing anything else. Frontmatter → Current Status →
> latest Work Log entry. This change WIRES the 2D `src/worldgen/` generator (built
> by the `procedural-map-generator` change) into the live 3D game.

## Current Status
**Phase:** APPLY. Artifacts done (proposal/design/specs/tasks); `/deliberate` complete
(5 council + mediator, synthesis — all "Proceed with mitigations", 0 blocks; results.md
folded into tasks.md as Groups A–I). Group A (paperwork) done. Now implementing.
**Doing:** Group B DONE (scaffolding verified). Starting Group C (roads).
**Resolved delivery order:** A(paperwork ✓) → B scaffold ✓ → **C roads** → D placement →
E lakes → F forests → G crowd → H gates → I docs. Junction-merge DEFERRED to a 2D-only
fast-follow change.
**Flag:** `DEFAULT_WORLDGEN_V2 = false` in perf.js (legacy ships by default while building);
test v2 with `?worldgen=1`; flip default to true at landing (task I.0).
**Next:** Group C — chunk-clipped RAW arterial road ribbons (C.1 ROAD_MAT shared, C.2 clip+
ribbon replacing placePaths, C.3 single-branch + chunk-keyed road attractor, C.4 budget+seam).
**Blocked:** Nothing.
**Binding apply-gates (the 6 High/Critical risks):** R1 road source-of-truth=RAW (done in
design), R2 heart-anchor boot crash, R3 forest ~80/chunk cap, R4 (roleTier,rank) tuple key,
R5 lake winding sign, R6 ROAD_MAT userData.shared. See results.md Risk Register.

## Key Decisions
<!-- APPEND-ONLY. Number sequentially with D-prefix. Full rationale in design.md. -->
- **D1 — Chunk system stays as the streaming/LOD engine; only the content-selection
  layer is replaced.** `chunks.js` keeps its load ring + 1-chunk/frame budget +
  chunkKey lifecycle. `pickTheme`/`THEME_BUILDERS`/`+`-grid are replaced by a
  per-chunk worldgen sampler. Rationale: the streaming engine is good; the dice-roll
  content is the problem.
- **D2 — Ship behind a feature flag (`USE_WORLDGEN_V2`, `?worldgen=0` to disable).**
  Keeps the game bootable + gives a rollback during a world-regenerating break.
- **D3 — Worldgen lakes/roads are persistent (no chunkKey, footgun #5); chunk-owned
  props keep chunkKey.** LakeManager keeps owning mesh/collider/lifecycle but READS
  positions/outlines from worldgen.
- **D4 — Contract tuple is append-only across the 2D→3D boundary** (existing rule).
- **D5 — Road junction-merge is a deterministic, window-bounded 2nd pass, worked out
  in the 2D sandbox first** (Gary 2026-06-06, the "lens" redundancy).
- **D6 — Road SOURCE-OF-TRUTH = RAW arterials (post-deliberation).** The 3D game consumes
  the raw per-edge arterial network for render + `noBuild`/`facing`/crowd gates;
  `nearestRoad`/`roadsInBounds` unchanged → self-test green by construction, golden stable,
  no merge math in the hot path. The junction-merge is DEFERRED to a separate 2D-only
  fast-follow change. (Adversary V1 / Architect #7 / Pragmatist; design.md "D-I REVISED".)

## Assumptions
| # | Assumption | Confidence | Status | Resolution |
|---|-----------|------------|--------|------------|
| A1 | Chunk-clipped worldgen sampling (vs a separate worldgen lifecycle manager) is the right integration shape | High | Open | Confirm in design + apply |
| A2 | `forests.js` 5x5 system is fully replaceable by per-chunk treeDensity scatter (no feature lost) | Med | Open | Verify drum-circle/campsite interiors still reachable |
| A3 | LakeManager can read worldgen lakes with only its placement logic swapped (mesh/collider/lifecycle untouched) | High | Open | Verify in CG lakes |
| A4 | Per-tier perf budgets hold with worldgen geometry (roads as ribbons, density trees) | Med | Open | Measure in backtick HUD at ?perf=low/mid |
| A5 | Crowd attractor/footprint contract needs no change — only what registers | High | Open | Verify crowd clusters at hearts |

## Dangling Threads
<!-- APPEND-ONLY. Strikethrough when resolved. -->
- Cross-engine golden already differs (Node vs browser) on lake `sin/cos`; the 3D
  path adds more transcendental-dependent road existence. Must re-verify golden on
  the game path + document; consider integer orientation test if it ever flips a
  collider's existence (not just cosmetics).
- Two lake macrocell sizes today (game 320m vs worldgen 1050m) — the worldgen one wins;
  confirm density/size feel in 3D vs the old lakes players have seen.

## Work Log
<!-- APPEND-ONLY. Newest at BOTTOM. -->

### 2026-06-06 — Kickoff: explore game world systems + scaffold the change
**Intent:** Wire src/worldgen/ into the 3D game (the ROADMAP "big one"). Gary green-lit
a full autonomous run through the OpenSpec pipeline. First understand what I'm replacing.
**Result:** Ran 4 parallel Explore sub-agents → full map of chunks.js (CHUNK_SIZE 80,
1/frame budget, pickTheme salt=1, THEME_BUILDERS, registry add() shape), lakes.js
(LakeManager, 320m cell, no-chunkKey colliders, WATER_MAT shared), forests.js (5x5 blocks,
getForestAt pure-hash, chunk-keyed), boot/render (buildWorld lakes-first→chunks, seed via
SESSION_SEED already reaches worldgen, threeShim Lambert swap, importmap mods/models in
index.html+sandbox.html), registry/crowd/collision (entry schema, 8m spatial hash,
attractor-clustering crowd, circle-circle collision). Wrote proposal.md + this log +
questions file. Architecture decision: chunk = streaming engine, replace content-selection.
**Changed:** openspec/changes/v2-worldgen-3d-integration/{proposal,session-log,questions-for-human}.md
**Refs:** -> D1..D5; continues procedural-map-generator/HANDOFF.md "OPEN/next" item 2.

### 2026-06-06 — Artifacts + Tier-3 deliberation; folded into tasks
**Intent:** Finish the OpenSpec artifacts and run `/deliberate` (the change brushes
determinism/lifecycle/threeShim/perf/boot-order) before any code.
**Result:** design.md (D-A..D-J), 2 specs (worldgen-3d-world, worldgen-road-junctions),
tasks.md written → apply-ready. Ran Tier-3 synthesis deliberation: 5 council personas
(Architect, Adversary, Profiler, Pragmatist, Auditor) + Mediator, all "Proceed with
mitigations", 0 blocks. Mediator's results.md resolved two tensions into one decision:
(1) road source-of-truth = RAW (-> D6), junction-merge deferred to a fast-follow;
(2) reorder to scaffold → roads → placement → lakes → forests → crowd → gates → docs.
Folded the 9 Change Groups (A–I) + 6 binding High/Critical mitigations into tasks.md.
Did Group A (paperwork): D-I REVISED in design.md, append-only/self-test-green reconfirmed.
**Verified:** `openspec status` 4/4 artifacts complete; deliberation folder has briefing +
5 council files + results.md.
**Changed:** design.md (D-I REVISED), tasks.md (rewritten as Groups A–I), session-log.md;
deliberations/001-initial/{briefing,council-*,results}.md.
**Refs:** -> D6; results.md Risk Register R1–R15 (R1–R6 are binding gates). Next: Group B.

### 2026-06-06 — Group B: scaffolding (flag + importmap + placement.js + empty-boot)
**Intent:** Land the force-multiplier scaffolding gate so all content groups have a clean,
flag-gated, boots-clean foundation (Group B; R2/R10/footgun #1/#4).
**Result:**
- B.1: added all 8 `src/worldgen/*` + `worldgen/placement` to the importmap `mods` array in
  BOTH index.html AND sandbox.html (was 0/8).
- B.2: `USE_WORLDGEN_V2` in perf.js — resolved once at module load; `DEFAULT_WORLDGEN_V2=false`
  (legacy ships by default while building; flip at landing I.0); `?worldgen=1`/`=0` override.
  Chose default OFF over the design's "default ON for dev" for production safety (the deploy is
  observed by real players; a half-empty v2 world must never ship by accident).
- B.3: `src/worldgen/placement.js` skeleton — pure + three-free (no `three`/`models` import),
  returns []; landed `isHeartCenterChunk` (R2/D-C) + `ROLE_THEME` (roleTier×rank) table stub
  with the R4 axis-collision warning in the header.
- B.4: reserved `SALT.placement = 0x4D41_0A` (fresh stream, footgun #4).
- B.5: restructured `chunks.js _generate` into a SINGLE `if (USE_WORLDGEN_V2)` branch (R10) →
  `_generateWorldgen(ctx)` (empty for now); legacy path fully under `else`.
**Verified:** syntax OK (perf/placement/chunks); worldgen self-test 20/20 green, golden
**63c8dea2 unchanged** (placement.js inert to the contract). Booted the REAL game:
`?worldgen=1` → v2 empty path, registry `chunkThemedPresent: []` (no stage/tent/truck/tree/
path_node/chair/drum/hammock/picnic), only LakeManager+obstacles+spawn-jugs; `?worldgen=0` →
full legacy world (stage 39, tent 65, tree 209, path_node 26, … 6748 entries). BOTH boot with
**zero console errors**. Screenshot captured.
**Changed:** index.html, sandbox.html, src/perf.js, src/worldgen/{constants,placement}.js,
src/chunks.js; openspec change docs (tasks B✓ + I.0, HANDOFF, session-log).
**Refs:** -> R2 (empty-boot gate passed), R10 (single branch), footgun #1/#4. Next: Group C roads.
