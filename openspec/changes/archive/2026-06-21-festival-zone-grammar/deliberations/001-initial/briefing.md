# Deliberation Briefing: festival-zone-grammar — the festival layout fix

## Task

The procedural festival reads as "a jumbled mess" (two playtest rounds): trucks
clip vendor rows, porta-potties scatter, a drum circle spawned inside a
food-truck ring, the arch sits beside the dancefloor instead of out on the road.
The `worldgen-layout-harness` change (now complete) proved this is ONE root
cause: `festival.js` plans each hub as *points with scalar clear-radii*
(`KIND_FOOTPRINT`) while the `chunks.js` builders construct *oriented shapes that
exceed those radii*, so `resolveOverlaps` settles centers at separations that
guarantee clipping. The harness also built the gate: `verification/baseline.md`
records **106 error / 92 warn** across 10 seeds (worst clip: a booth inside a
truck by 7.5 m), a linter (`bin/lint`, the executable spec), a hub viewer
(`hub-sandbox.html`), and a map overlay.

**This change is the fix.** Decide whether the planned approach is sound, what
order to execute in, and where it will break. The full plan is in
`openspec/changes/festival-zone-grammar/` — read `proposal.md`, `design.md`
(decisions D1–D6), and `tasks.md` (groups 0–8). In brief, the plan is:

1. **Builder layout/mesh extraction** (carries forward harness design D-C′): split
   each `chunks.js` worldgen builder into a pure `layout(rng, env) → records[]`
   (positions/radii/yaw/cosmetic params, no three.js) and `buildMesh(records)`.
   Behaviour-preserving, one builder per commit, snapshot-diff-EMPTY-gated.
2. **Crowd pre-rolled params**: the layout half pre-rolls crowd count + per-NPC
   seeds into records so `crowd.spawn` stops drawing from the cluster rng with a
   tier-sized pool (today built layouts differ by perf tier — harness R2).
3. **True oriented extents**: promote the harness's approximate `clusterExtent`
   into per-kind oriented shapes (court = ring, vendor row = rect incl.
   camps-behind, stage = directional wedge), derived from the SAME
   `FESTIVAL_TUNING` constants the builder reads.
4. **Zone slotting** replaces scatter-then-`resolveOverlaps`: per hub, place
   non-overlapping oriented zones in priority order on the front axis F (stage +
   hard-reserved front wedge → road-straddling vendor aisles with camps behind →
   off-road courts ≥ min stage distance + optional mini spur road → forest-clearing
   drum circle with a drivable access path → potties attached to a parent zone
   edge → threshold arch out on the road → probabilistic bubble vendors). A zone
   that can't fit clear is OMITTED (graceful degradation), not nudged into a clip.
5. **The POI determinism golden moves exactly ONCE** — at the slotting commit —
   re-recorded, node==browser re-verified; the queryPoint (road/water) golden
   stays frozen. Spur roads + drum access paths are emitted as COSMETIC PATH
   RECORDS by the planner, NOT new arterials in roads.js (to keep queryPoint frozen).
6. **Registry-clearance backstop**: restore per-sub-component
   `registry.closestBuilding()` checks with bounded retry/skip in the mesh half
   (main's theme builders had it; v2 dropped it).

Success is numeric (every error-severity linter rule → 0 across the 10 baseline
seeds) AND Gary-judged (in-game 3D screenshots via the hub viewer + playtest
markers). `DEFAULT_WORLDGEN_V2` stays flag-OFF; the flip is a separate later change.

## Context

- **OpenSpec Change**: `openspec/changes/festival-zone-grammar/`
  (proposal.md, design.md, tasks.md, specs/festival-zone-grammar/, specs/builder-layout-extraction/)
- **Gated by**: `openspec/changes/worldgen-layout-harness/` (complete) — its
  `verification/baseline.md` is the measuring stick; its `design.md` **D-C′** is
  the extraction design handed forward; its `deliberations/001-initial/results.md`
  is the prior council round (the PIVOT that deferred this extraction here).
- **ROADMAP item**: "Festival layout — the plan/build contract refactor".
- **Subsystem(s)**: world-streaming (`src/worldgen/festival.js` planner +
  `chunks.js` worldgen builders), registry/collision, crowd-ai (`crowd.spawn`),
  models (`src/models/*` builders touched by the layout/mesh split), perf-tiers.
- **Files Affected**: `src/worldgen/festival.js`, `src/worldgen/tuning.js`,
  `src/chunks.js` (buildWorldgenKind + buildStage/buildVendorRowAt/
  buildFoodCourtAt/buildCampVillageAt + potty/drum/bubble builders),
  `src/crowd.js`, `src/worldgen/lint.js` (graded by, not changed), several
  `src/models/*`.
- **ARCHITECTURE.md sections relevant**: world chunks/forests/lakes, registry,
  collision model, crowd AI, perf tiers.

## Constraints (the tripwires — non-negotiable)
- No build step; a new src/ module goes in the importmap in BOTH index.html AND sandbox.html (and hub-sandbox.html + map-sandbox.html — four files; `bin/check-importmaps` guards it).
- ES module namespaces are frozen — no THREE.X = Y after import; tier overrides via src/threeShim.js.
- iOS audio inits synchronously inside the start gesture — no async hop before Sound.init().
- Determinism is load-bearing — don't reorder/re-salt existing rng() calls. THIS change deliberately moves the POI golden ONCE (re-recorded, node==browser re-verified); the queryPoint golden stays frozen; every other commit keeps both frozen and is gated by an EMPTY normalized snapshot diff + the per-cluster draw-count canary.
- Worldgen layer is a leaf — `src/worldgen/*` must NOT import chunks/registry/lakes/models; water/blocked lookups arrive via injected `env = {waterAt, blockedAt}`.
- Lakes omit chunkKey on purpose; shared pooled resources tagged userData.shared = true must not be disposed.
- Per-tier perf budgets: low 80 draws/150k tris, mid 200/400k, high 400/1.2M; don't reflexively castShadow = true.
- Sandbox-pass ≠ game-pass — the running game must boot clean at both flags and both low/high tiers.

### Your Output
Write your full Round-1 position to: `[OUTPUT_PATH]`
Return a brief summary to the orchestrator: your Verdict, Key Concern, and 3 bullet points.

### Your Task (Round 1)
1. Propose your prioritized order of operations for this task.
2. Identify the risks/concerns from YOUR domain, grounded in the docs/code.
3. Give a Verdict (Proceed | Proceed with mitigations | Block).
You are working in isolation. Do NOT speculate about what other personas think,
and do NOT write an "Anticipated Tensions" section — that's handled later.
