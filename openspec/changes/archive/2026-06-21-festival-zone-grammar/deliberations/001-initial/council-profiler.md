## The Profiler's Position

> Domain: runtime cost on the target device, especially low/mid tiers. Lens:
> draws/tris vs per-tier budget, allocation-time stalls vs steady-state FPS,
> instancing/pooling, shadow casters. Grounded in `src/perf.js`, `src/crowd.js`,
> `src/chunks.js`, `src/worldgen/festival.js`, and `.claude/rules/performance.md`.

### Priority Sequence

From a perf standpoint the proposed task order (groups 1→8) is sound, but I'd
sharpen the *measurement gating* around two specific commits. My prioritized
order, framed as where perf attention must land:

1. **Establish the per-cluster draw-count canary as the perf gate BEFORE group 1
   touches a builder** (it already exists per design D1/tasks 1.1). The
   extraction is behaviour-preserving, so the *only* perf-relevant claim in
   groups 1–3 is "draws/tris are byte-identical." The canary is exactly the
   right instrument; confirm it counts draws AND tris, not just positions, so a
   silent geometry-segment change (e.g. a `CapsuleGeometry` radial-segment
   default drifting during a `pickParams`/`buildMesh` split) is caught. Tris are
   in the budget (low 150k) and a records refactor can perturb them without
   moving a single draw.

2. **Group 2 (crowd pre-roll) is the one place perf semantics genuinely change
   — gate it on a low-vs-high tier identical-layout capture (task 2.1) AND a
   draw-count read at `?perf=low`.** This is the highest-risk perf item in the
   change and I treat it as critical-path (analysis below).

3. **Group 4 (zone slotting + golden move) — verify zone-omit can only REDUCE
   draws, never add, and that the omit path is actually exercised at low tier.**
   Slotting adds no geometry by construction (design Risks §"Perf budget"); the
   net perf delta is ≤ 0 on content. The new cost is *cosmetic path records*
   (group 4.3) — small, but non-zero (analysis below).

4. **Group 7 (verify at low + high) is the real perf sign-off.** Tasks 7.1
   already mandates the backtick panel at both `?perf=low` and `?perf=high`.
   Insist on `?perf=mid` too — mid is where `crowdMax` jumps 180→320 and shadows
   turn on, so it's the tier most sensitive to the crowd change, and it is NOT
   in the current 7.1 wording ("both `?perf=low` and `?perf=high`").

### Budget Estimate

-   **Draw delta**: **0 from layout/slotting; ≈ +1–2 draws per emitted spur/drum
    access path record** (group 4.3), per hub, IF each path is a discrete mesh.
    Closest tier after: low (80-draw budget). A hub in the load neighborhood
    today already pushes stages + vendor rows + courts + camps + crowd (7
    InstancedMesh draws, `crowd.js:264`); adding 1–2 ribbon meshes per hub is
    within budget but must be **instanced or merged if multiple paths per hub**,
    not one `Mesh` per path-segment.
-   **Triangle delta**: **0 from slotting** (same meshes, repositioned). Path
    records add a flat ribbon (~2 tris/segment) — negligible against 150k. The
    real tri risk is **invisible drift during extraction** (group 1), not new
    content; the canary owns that.
-   **Cost type**: **Allocation stall** is the dominant exposure (chunk-spawn /
    hub-spawn builds the records→mesh). **Steady-state is flat-to-better**:
    zone-omit reduces content on sparse hubs; the crowd pre-roll removes nothing
    from the per-frame `_updateNpc` hot path (`crowd.js:611`). No new per-frame
    work is proposed.
-   **Low/mid-tier verdict**: **Safe, with two mitigations** — (a) path records
    must instance/merge per hub, not allocate per segment; (b) the crowd pre-roll
    must preserve `PERF.crowdMax` as the spawn-time hard cap (see below).

### Performance Risks Identified

| Risk | Type | Severity | Trigger Condition |
| ---- | ---- | -------- | ----------------- |
| Tier-independent layout pre-rolls MORE NPC params than low tier's `crowdMax` can hold → wasted alloc OR (worse) a layout that assumes high-tier counts | SteadyState/Alloc | High | `?perf=low`: layout records pre-roll high-tier crowd counts; `crowd.spawn` early-returns at `free.length===0` (crowd.js:339) but the *records* were sized for high | 
| Extraction silently changes geometry segment counts (tris) while positions stay identical | Tris | High | A `pickParams`/`buildMesh` split that re-creates a geometry with a different default segment arg; canary catches it ONLY if it counts tris | 
| Spur/drum path records allocate one mesh per path → draw-count creep on dense hubs at low tier | Draws | Medium | Multiple courts + drum on one hub each get a discrete path Mesh instead of a merged/instanced ribbon | 
| `Math.random()` cosmetic sites in stage/court builders (chunks.js:2463-2464) NOT folded into pre-rolled records → layout still tier/order-sensitive in subtle ways | Alloc | Medium | Audience jitter uses `Math.random()`, not `ctx.rng`; D-C′ trap (task 1.4) says transcribe as-is — fine for determinism, but means crowd POSITIONS aren't fully data-driven | 
| Registry-clearance backstop (D5) adds `closestBuilding()` calls in the mesh half → spawn-time cost on dense hubs | Alloc | Low | Bounded retry/skip loop runs per sub-component during chunk gen; already the legacy pattern (chunks.js:2718), so within precedent | 

### Detailed Analysis

**1. The crowd pre-roll vs. `PERF.crowdMax` — the one to get right (D2).**
Today `crowd.spawn` draws 8–9 `rng()` values per NPC from the cluster stream
(`crowd.js:343-381`) and early-returns drawing *nothing* when `this.free.length
=== 0` (`crowd.js:339`). `MAX_NPCS = PERF.crowdMax` (`crowd.js:30`), which is
**180/320/500** for low/mid/high (`perf.js:62,80,94`). So today, when a low-tier
pool saturates, later clusters' `spawn()` calls consume zero rng and the built
layout *diverges by tier* — exactly the harness R2 finding the design cites
(D2). The fix (pre-roll count + per-NPC seeds into layout records so `buildMesh`
consumes them without drawing) is correct and removes the tier-dependence in the
*record stream*. But two perf cautions:

  - **`PERF.crowdMax` exists for a reason and must remain the spawn-time hard
    cap.** It is a steady-state FPS lever: 500 instanced NPCs each touch
    `_updateNpc` every frame (`crowd.js:581`), plus a separation broadphase
    rebuild (`crowd.js:577`), plus per-frame `stage_front` scans
    (`crowd.js:623`). The instanced *draw* cost is fixed (7 draws regardless of
    count, `crowd.js:264`), so `crowdMax` is purely a CPU/per-frame guard, not a
    draw guard. The design's tier-INDEPENDENT *layout* is the right call —
    layout should be deterministic across tiers so the baseline (pinned
    `perf=high`, tasks 0.2) matches shipped low/mid worlds. **But pre-rolling
    tier-independent params must NOT mean spawning tier-independent NPC counts.**
    The records can carry the full (high-tier) roster; `crowd.spawn` must still
    honor `free.length===0` and drop the surplus at low/mid. Confirm task 2.1's
    "IDENTICAL normalized layout" means the *plan/record* layout, not the live
    NPC population — the live population MUST still be capped by `crowdMax` or
    low tier regresses on per-frame cost.

  - **Watch the allocation cost of pre-rolling counts that low tier discards.**
    Pre-rolling 500 NPC param sets per hub when low can only realize 180 is
    cheap (it's just rng draws + small objects), but if the records hold cloned
    `Vector3`/`Color` per NPC, that's GC pressure at hub-spawn — an allocation
    stall, the exact symptom `.claude/rules/performance.md` warns about. Keep
    pre-rolled params as flat scalars/seeds (the design says "count + per-NPC
    seeds" — good), not pre-built THREE objects.

**2. Zone slotting adds no draws; zone-omit only reduces — verified.** Slotting
repositions the same descriptors that scatter-then-`resolveOverlaps` produces
today (`festival.js:331-456`); the mesh half is unchanged in group 4. A zone
that can't fit is omitted (D4), which removes its `buildMesh` call entirely →
fewer draws, fewer tris, fewer crowd spawns on that hub. The design's claim
(Risks §"Perf budget": "slotting adds no geometry... zone-omit can only reduce
draws") is **correct**. The only caveat: omit changes *which* hubs are dense, so
the worst-case draw count is a hub where *everything* fits — that case must be
the one screenshotted at `?perf=low` in task 7.1, not an average hub.

**3. The cosmetic path records (group 4.3) are the only new geometry.** Spur
roads + drum access paths are emitted as path records, rendered by builders. Per
hub that's typically 0–2 courts needing a spur + 0–1 drum path = up to ~3
ribbons. Perf asks: render them as ONE merged ribbon geometry per hub (or an
InstancedMesh keyed on a unit segment), tagged `userData.shared` if the geometry
is pooled, NOT one `Mesh` per path. At ~2 tris each they're tri-negligible, but
draw-call discipline matters at the low 80-draw budget where a busy hub
neighborhood is the squeeze. Also: a flat ground ribbon should be **opaque with
`alphaTest` if it has a masked edge, never `transparent`** (performance.md
"Avoid transparent. Prefer alphaTest."), and **must not `castShadow`** (it's
flat ground; nothing to read).

**4. Extraction tri-drift is the sneaky one (group 1).** The behaviour-preserving
split is the repo's riskiest refactor class (design D1). A `buildMesh(records)`
that re-instantiates a geometry can silently change a segment count — e.g. a
`CylinderGeometry(r, r, h, 8)` losing its `8` and defaulting to 32 radial
segments. Positions stay identical (canary's position check passes) but tris
balloon. **Confirm the draw-count canary also asserts triangle count**, or add
that assertion. This is cheap insurance against a class of bug the snapshot diff
won't see if it only normalizes positions/yaw.

**5. Registry-clearance backstop (D5) is within precedent.** The
`closestBuilding()` retry/skip already runs at chunk-gen for spawn jugs
(`chunks.js:489-505`) and ambient crowd (`chunks.js:2718`); restoring it
per-sub-component in the mesh half is allocation-time cost on dense hubs, not
steady-state. Bounded retry (the design says "bounded retry/skip") keeps it from
becoming a spiral. Low severity — just don't make the retry count unbounded.

**6. What MUST be checked at `?perf=low` and `?perf=mid`.**
  - Backtick HUD draws < 80 (low) / 200 (mid), tris < 150k / 400k, on the
    DENSEST reachable hub (everything-fits case), with crowd on (task 0.2's
    capture protocol). High-tier hides this (performance.md "High tier hides
    regressions").
  - At `?perf=low`: the live NPC count is still capped at 180 even though the
    layout records hold the high-tier roster (the D2 caution above).
  - At `?perf=mid`: shadows are ON (`perf.js:81`) and `crowdMax` is 320 — the
    crowd InstancedMeshes `castShadow = PERF.shadows` (`crowd.js:266`). The
    crowd-pre-roll change touches `spawn` not shadow flags, so this should be
    inert, but mid is the tier where a steady-state regression from a larger
    realized crowd would first bite. 7.1 must include mid, not just low+high.
  - Confirm path-record meshes default `castShadow = false`.

### Verdict

-   **Verdict**: **Proceed with mitigations**
-   **Key Concern**: The crowd pre-roll (D2) must make the *layout/record stream*
    tier-independent WITHOUT making the *realized NPC population* tier-independent
    — `PERF.crowdMax` is a steady-state per-frame CPU guard (180/320/500) and
    must remain the hard spawn cap at low/mid, or low tier regresses on
    `_updateNpc` cost. Task 2.1's "IDENTICAL normalized layout" must mean the
    plan, not the live crowd.
-   **Recommendation**: The change is perf-safe by construction — slotting adds
    no geometry, zone-omit only reduces, and no new per-frame hot-path work is
    introduced. Proceed, conditioned on: (1) the draw-count canary asserts
    triangle count as well as draws/positions (catches extraction tri-drift);
    (2) cosmetic path records render as a merged/instanced opaque, no-shadow
    ribbon per hub, not per-segment meshes; (3) the crowd pre-roll preserves
    `crowdMax` as the live spawn cap; (4) task 7.1 verification includes
    `?perf=mid` and uses the densest everything-fits hub, not an average one.
