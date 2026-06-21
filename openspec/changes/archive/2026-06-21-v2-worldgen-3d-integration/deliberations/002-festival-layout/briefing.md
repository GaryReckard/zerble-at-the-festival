# Deliberation Briefing: Festival Layout Redesign (v2-worldgen placement)

## Task

Stress-test, **before building**, the redesign of the v2-worldgen festival
**placement layer** from per-chunk random scatter to **structured, feature-anchored
clusters**. The full design is in
`openspec/changes/v2-worldgen-3d-integration/design.md` under
**"Festival Layout Redesign (D-K..D-Q)"**; the provisional tasks are **D2.1–D2.8**
in `tasks.md`. Read both before forming your position.

**Why the redesign exists:** Group D (commit `0ee3c7c`) wired v2 placement
end-to-end and boots clean, but its scatter is `10 random slots × per-role
probability` — mechanically correct (right prop kinds in the right role bands, off
road/water) but spatially **uncorrelated**: a confetti of single props. Solo sugar
shacks appear anywhere a "vendor" slot rolls; drum circles land on arbitrary grass;
nothing clusters. Gary saw it in the running game and asked for a proper redesign.

**The design under review (summary — read design.md D-K..D-Q for the full text):**
- **Principle (D-K):** nothing places per-point-random except sparse low-weight
  filler (a lone hammock/picnic). Every festival structure is a **cluster anchored
  to a worldgen feature** — a heart, one of its approach roads, or a lakeshore /
  causeway band. Port the *tuned legacy rules*, re-anchor them off the chunk grid.
- **New pure sub-layer (D-L):** `src/worldgen/festival.js` — `festivalPlan(heart)`
  **memoized per heart, gated on (seed, epoch)** → POI descriptors; `poisInBounds`
  / `campVillagesNear`. Fresh `SALT.poiLayout = 0x4D41_0B` (+ `0x4D41_0C` jitter);
  `cellRng(heart.cx,heart.cz,salt)` for heart-owned content, `pairRng(...)` for
  content living on a shared H↔neighbor road. Plus three **additive** worldgen
  exports (no reorder of existing draws): `roads.approachRoadsOf(heart)`,
  `hearts.nearestMajorHeart(x,z)`, `water.shoreBand(x,z,N)`.
- **Cluster catalog (D-M):** food court = de-overlapped truck **ring along an
  approach road**, sugar shack ONLY here; vendor row parallel to a road; **one
  guaranteed bubble vendor per heart**; drum circle in a treed off-road district
  cell; porta-bank attached to each cluster; arch + string lights on the primary
  road; **camp villages (12–20 packed, 50/35/15 size mix, 5.5 m spacing, 30 m
  envelope)** off the drag, preferring lakeshore/causeway bands; sparse filler only.
- **Ownership (D-N):** a cluster's **center chunk owns + builds the whole cluster**
  (chunk-keyed, spills into neighbors — as the legacy camp village already did). Per
  chunk, `placeChunkProps` enumerates relevant hearts (`heartsInBounds` widened by
  max POI reach), calls the memoized `festivalPlan`, keeps POIs whose center is in
  this chunk. District scatter re-derives from worldgen math, never a registry
  lookup of the possibly-unloaded anchor.
- **Spawn (D-O):** at boot, `nearestMajorHeart(0,0)` → relocate Zerble outside that
  heart's entrance arch facing the main stage; force extra intro jugs near spawn;
  a spawn-clearance rule replaces the legacy spawn-corridor hack.
- **Determinism (D-P):** quantize trig results before threshold compares; memoize
  gated; the `queryPoint` tuple is untouched so the self-test golden `63c8dea2`
  must stay; add a POI window-invariance check.
- **Perf (D-Q):** memoized plans keep the per-chunk sampler cheap; the build cost is
  the allocation spike when a heart-center / village chunk loads.

**Open questions worth your scrutiny (these are questions, not predetermined answers):**
1. Determinism: is quantize-before-compare + fresh salt + (seed,epoch)-gated memo
   sufficient, or are there cross-engine / window-truncation traps in seeding a
   per-heart layout off `cellRng`/`pairRng` and along trig-derived road points?
2. D-A compliance: a memoized per-heart `festivalPlan` filtered per chunk — is that
   still a "per-chunk sampler" (D-A's endorsed shape), or has it become a heart
   lifecycle manager by the back door (the thing D-A explicitly rejected)?
3. Perf / allocation: a village is 12–20 campsites and a food court is a truck ring
   — both built in one `_generate`. How bad is the single-chunk-load spike, and how
   does it interact with the forest tree-count budget (R3) once Group F lands?
4. Cluster ownership across chunks: a major heart's district is 1000 m, so its
   road-courts can be 100+ m from its center chunk. How wide must each chunk scan
   for hearts so it doesn't miss a cluster whose center is in it — without blowing
   the per-chunk sampler cost (R7, the 8 ms gate)?
5. Player feel: does this actually read as a *designed* festival? (The legacy
   camp_village took three framings to get right precisely because the chunk grid
   was the wrong anchor — CHANGELOG 2026-05-28, `f0c763a`.)
6. Regression: the git history surfaced hard-won fixes the redesign must not break —
   nothing in water; Zerble never spawns inside/in-front-of a structure; stages face
   out (not back-deck-at-spawn); stage music attaches once at build; pooled materials
   tagged `userData.shared`; salt independence; people don't shove a parked Zerble.

## Context
- **OpenSpec Change**: `openspec/changes/v2-worldgen-3d-integration/`
- **ROADMAP item**: "Wire the generator into the live 3D world as v2 worldgen."
- **Subsystem(s)**: world-streaming, models, registry-collision, crowd-ai, perf-tiers, sandbox-harness.
- **Files Affected**: NEW `src/worldgen/festival.js`; edits to `src/worldgen/{roads,hearts,water}.js`
  (additive exports), `src/worldgen/placement.js` (per-chunk filter), `src/chunks.js`
  (cluster build half + the existing yaw-aware `buildStage`/`buildDrumCircleAt`/
  `buildFoodCourtAt`/`buildVendorAt`/`buildPottyBankAt`), `src/main.js`/`src/world.js`
  (spawn relocation). Reference: legacy `chunks.js` theme builders, `lakes.js` lakeside ring.
- **ARCHITECTURE.md sections relevant**: world chunks/forests/lakes, registry, collision, crowd AI, perf tiers.
- **Prior deliberation**: `deliberations/001-initial/results.md` (Risk Register R1–R15; this
  redesign is the rework of Change Group D). Group A/B/C done; D wired; E–I pending.

## Constraints (the tripwires — non-negotiable)
- No build step; a new `src/` module goes in the importmap in BOTH `index.html` AND `sandbox.html`.
- ES module namespaces are frozen — no `THREE.X = Y` after import; tier overrides via `src/threeShim.js`.
- iOS audio inits synchronously inside the start gesture — no async hop before `Sound.init()`.
- Determinism is load-bearing — don't reorder/re-salt existing `rng()` calls; quantize before hash/compare;
  the worldgen self-test must stay 20/20 with golden `63c8dea2`.
- Lakes omit `chunkKey` on purpose; shared pooled resources tagged `userData.shared = true` must not be disposed.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M; don't reflexively `castShadow = true`.
- A new model is not done until it has a sandbox entry; `festival.js` is pure DATA (verified via map-sandbox + booted game), but any NEW mesh builder needs a sandbox case.
- Sandbox-pass ≠ game-pass — the running game must boot clean at a heart-center chunk (anchors are sandbox-invisible).

### Your Output
Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (Round 1)
1. Propose your prioritized order of operations for this redesign.
2. Identify the risks/concerns from YOUR domain, grounded in the docs/code.
3. Give a Verdict (Proceed | Proceed with mitigations | Block).
You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that's handled later.
