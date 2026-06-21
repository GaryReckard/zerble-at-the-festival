## The Profiler's Position

> Lens: per-tier draw/tri budgets (low 80/150k, mid 200/400k, high 400/1.2M),
> shadow-caster cost, instancing/pooling, allocation-vs-steady-state. Focus on
> briefing Q4 (seam buffer geometry) with a hard cross-cut into Q6/Q2 because the
> dominant perf risk in 4B.3 is **allocation-time (chunk-gen stall)**, not draws.

All numbers below are from headless probes I ran against the actual committed
4B.2 code (`git worktree add` of `3f5cf73`), or from triangle-count math on the
real geometry in `src/models/*.js` at that ref. Commands + outputs cited inline.

---

### Priority Sequence

1. **Solve the cold-plan stall BEFORE designing the buffer geometry.** The
   geometry is cheap; the *planner recursion that feeds it* is the cliff. This is
   the same wall the reverted "senior keep-out" experiment hit (session-log
   2026-06-14 "Playtest round 2": ~8 s/plan, would HANG chunk gen). My probe
   reproduces it at ~2.8 s for the first chunk into a fresh region — see below.
2. **Gate buffer props to mid/high; soft_buffer geometry must respect tier
   rules** (pooled geo/mat, `userData.shared`, no reflexive `castShadow`).
3. **Confirm merge/trim NET-REDUCE draws** (they do — quantified below) and treat
   that as the perf headroom that pays for the buffer add.
4. **Verify the backtick HUD at `?perf=low` and `?perf=mid`** after the seam pass
   lands — per `.claude/rules/performance.md` "Don't ship a perf change without
   checking `?perf=low` and `?perf=mid`."

---

### How many seams per chunk neighborhood (the Q4 count)

Probe: `seamPairsNear` / `classifySeamsNear` over windows across a ±1 km box, 10
seeds (`/tmp/zwt/probe-seam.mjs`):

```
seed        hearts/2km   pairs/chunk  classifiedSeams/chunk  pairs/neigh(560m)  seams/neigh
1234        157          305          31                     490                45
1139472710  162          320          32                     508                45
2718382314  166          331          28                     533                43
... (10 seeds, all within these bands)
```

Two very different "counts" matter and the design must not conflate them:

- **Classified seams touching a single 80 m chunk window: ~25–35.** But these are
  mostly *not* this chunk's geometry to build — a seam between hubs A and B has a
  midpoint that lands in exactly one chunk.
- **Seams whose MIDPOINT lands inside a single chunk: 1** (max across the whole
  ±700 m grid, seed 1139472710 — `/tmp/zwt/probe-cost.mjs`). So the **geometry a
  given chunk owns is ~1 seam-response, not 30.** This is the number the draw
  budget cares about.
- **Type mix (aggregated over the neighbourhood sweep, all 10 seeds):**
  `soft_buffer` ≈ 40–45%, `merged_court` ≈ 30–40%, `yield` ≈ 7–12%,
  `shared_street` ≈ 1–6%. **soft_buffer is the plurality and the only type that
  ADDS geometry.** merge/trim/yield all *remove*.

**Verdict on the draw budget for the buffer itself: SAFE.** A soft_buffer of
~6 trees + 1 hammock + 1 potty bank + 1 connector-path quad is ~**24 draws /
~1.0k tris** (math below), and a chunk owns ~1 of them. Against low's 80-draw /
150k-tri budget that's a ~30% draw bump on the *one* chunk that hosts a buffer
midpoint — meaningful but bounded, and it lands on a chunk that, post-merge/trim,
is *lighter* than before (see net-reduction). It is NOT a steady-state cost; once
built it just renders.

---

### Budget Estimate

-   **Draw delta (per chunk that owns a seam-response):**
    - soft_buffer: **+~24 draws** (6 trees × 2 + hammock 5 + potty 6 + path 1).
      Closest tier after: low ~104/80 on a worst-case chunk that ALSO has dense
      base content — but realistically the host chunk is a hub *edge*, not a hub
      core, so base draws there are low. Watch it on the HUD; don't assume.
    - merged_court: **−~16 draws** (removes one whole 4-truck court vs two
      adjacent — `FOOD_COURT_COUNT_BASE 3 + SPAN 3` = 3–5 trucks, tuning.js:172).
    - trim (shared_street): **−~30 draws** if 6 of ~12 booths trimmed
      (`VENDOR_ROW_COUNT_BASE 5 + SPAN 3` per side × 2 sides ≈ 12, tuning.js:184).
    - yield: **−(whole lower-priority loud zone)** — a drum circle or side stage
      removed entirely. Largest single reduction.
-   **Triangle delta:** soft_buffer **+~1.0k tris**; merged_court **−~1.6k**;
    trim **−~1.8k**; yield **−several k**. **Net across the world: strongly
    negative.** The buffer is the only add and it's the smallest term.
-   **Cost type:** The *geometry* is **allocation-time** (built once at chunk
    spawn, then static). The **planner recursion is also allocation-time and is
    the real cost** — see the stall section. Neither is steady-state.
-   **Low/mid-tier verdict:** **Buffer geometry — Safe with pooling + a
    mid/high-only gate.** **Planner cost — At risk; needs the cold-plan fix
    before this can ship at all.**

---

### THE risk I own: cold `festivalPlan` recursion = a multi-second chunk-gen stall

This is briefing Q4's "plan-time cost of making festivalPlan call neighbours'
plans" and it dwarfs every geometry concern.

`classifySeamsNear` already calls `festivalPlan(seam.keeper)` and
`festivalPlan(seam.yielder)` for every pair (festival.js:358–359). 4B.3's
response (trim/merge/buffer) must run *inside or alongside* the per-heart plan,
which means a hub's plan now depends on its neighbours' plans. The cost:

Probe (`/tmp/zwt/probe-cost.mjs`, seed 1139472710 / 424242):

```
cold festivalPlan x75 hearts          = 3520 ms  => 46.9 ms/plan
warm festivalPlan (cache hit)         = 0.0008 ms/plan
classifySeamsNear(1 chunk, COLD)      = 2028 ms  -> 22 seams
classifySeamsNear(1 chunk, WARM)      = 0.86 ms
```

And the warming fan-out (`/tmp/zwt/probe-warm.mjs`):

```
one chunk window -> 265 seam pairs -> 60 distinct hearts whose festivalPlan
must be computed (cold) => 60 x ~47ms = ~2.8 s for the FIRST chunk into a
fresh region
```

**~47 ms per cold `festivalPlan`** (nearestRoad-dominated, exactly the
session-log's "~80 ms base-plan" class). A single chunk crossing into virgin
territory would warm ~60 neighbour plans = **~2.8 s of synchronous work on the
chunk-gen path** — a hard freeze, and the same failure mode that killed the
senior-keep-out experiment (session-log: "would HANG chunk gen").

This is purely an **allocation-cost** bug per `.claude/rules/performance.md`
("frame stalls when something spawns … fixed by … budgeting (1 chunk/frame)").
The project already runs a 1-chunk-per-frame generation budget (CLAUDE.md
tripwire #5 / design.md "Spur roads"), so the question is whether ONE chunk's gen
can afford ~2.8 s. It cannot.

**Mitigations, in order of preference:**

1. **Memoize aggressively and warm lazily, never recursively.** `festivalPlan` is
   already memoized + bounded (`_planCache`, festival.js:490–521). The seam
   response must be a *read* over already-or-cheaply-computed neighbour plans, and
   the cold cost amortizes: after the region's hearts are planned once, every
   later chunk in that region is the 0.86 ms warm path. The stall is a
   *first-touch* spike, not steady-state. So the fix is **spreading the
   first-touch cost across frames**, not eliminating it.
2. **Reduce cold `festivalPlan` cost itself.** 47 ms/plan is dominated by
   `approachRoadsOf` / `nearestRoad` (roads.js) — the session-log already fingered
   nearestRoad. If the seam response only needs each hub's *front zone position*
   (which `nearestZoneToward` already extracts, festival.js:327), consider a
   cheaper "seam-lite" plan that computes only the front zones, not the full
   potty/arch/bubble slotting. A 5–10× cheaper lite-plan turns 2.8 s into
   ~0.3–0.5 s — still spread over frames, but survivable.
3. **Keep `SEAM_PAIR_REACH` honest.** It's 420 m (festival.js:265) vs the actual
   ~190 m cluster reach. That over-bound means `seamPairsNear` enumerates ~265
   pairs / ~60 hearts for ONE chunk when the genuinely-conflicting set is far
   smaller. The comment admits it's "over-bounded a touch so enumeration never
   MISSES a pair" and "4B.2 prunes to the actual oriented-extent overlaps." But
   the *cold-plan cost is paid on enumeration* (every pair calls two
   `festivalPlan`s at festival.js:358–359), BEFORE the prune at line 364. **The
   prune happens too late to save the expensive work.** Tightening
   SEAM_PAIR_REACH toward ~260–300 m, or gating the `festivalPlan` calls behind a
   cheap integer pre-filter (heart-center distance vs a coarse extent bound)
   before calling the full plan, directly cuts the 60-heart fan-out.

I am **not** asserting the architecture must change to a batched solver — that's
Q6 and another persona's call. From the perf lens, the only hard requirement is:
**the per-chunk synchronous cost of resolving a seam must be bounded to something
the 1-chunk/frame budget can absorb (single-digit ms), with first-touch warming
spread across frames.** As written (full festivalPlan × 60 hearts cold), it isn't.

---

### Buffer geometry: pooling + dispose-safety + castShadow (the Q4 checklist)

The design names the buffer props as "trees, hammocks, shade seating, a potty
bank, a connector path." I checked the existing builders for each:

- **Trees are the pooling landmine.** `buildTree` (tree.js:96) pools the trunk geo
  + mat (`_trunkGeo`/`_trunkMat`, tagged `userData.shared`, tree.js:32–37) BUT
  allocates a **fresh `IcosahedronGeometry` AND a fresh `MeshStandardMaterial`
  per leaf, per call** (tree.js:105–112) — same for the conifer cone
  (tree.js:122–124). Those are **not** pooled and **not** tagged `userData.shared`.
  Consequence per `.claude/rules/perf-pooling.md`: each buffer tree = its own
  draw call (no batching across trees) AND a fresh material upload at spawn. At
  ~6 trees/buffer that's ~6 extra materials + 6 geometries allocated per
  seam-response. **If the seam pass spawns trees via `buildTree` as-is, it
  inherits this.** Recommendation: route buffer trees through an `InstancedMesh`
  (the audit-order #5 win — "Use it when the same geometry repeats per
  chunk/per cluster," `.claude/rules/performance.md`) OR a bucketed pool of
  ~3–4 leaf-radius variants tagged `userData.shared`. The forest path may
  already do this; reuse it, don't call the per-tree allocator.
- **Hammock** also allocates a fresh `postMat` `MeshStandardMaterial` and per-call
  `BufferGeometry` slings (hammock.js:10, :56, :114) — not pooled. Low count
  (1/buffer) so lower priority, but if a buffer is the *only* place hammocks spawn
  at scale, pool the post material.
- **`castShadow` discipline:** `buildTree` sets `castShadow = true` on trunk AND
  leaf AND cone (tree.js:100, :115, :128). Tree crowns are on the approved
  caster list (`.claude/rules/perf-pooling.md` "Cast shadows for: … Tree
  crowns"), so the leaf/cone shadow is legitimate. The trunk is borderline (a
  thin shaft — "Don't cast for … lamppost shafts"), but it's pre-existing and not
  this change's job to relitigate. **The hard rule for 4B.3: the connector path
  quad, shade seating, and potty bank must default `castShadow = false`** — a
  flat path casts nothing useful; potty banks and chairs are exactly the "small
  detail that won't read as a distinct shadow" the audit cut from 115→56.
- **Dispose-safety:** any NEW pooled geo/mat the buffer introduces must be tagged
  `userData.shared = true` (CLAUDE.md tripwire #6; `.claude/rules/perf-pooling.md`).
  The seam buffer is, by construction, a *cross-hub* thing whose host chunk can
  unload while a neighbour chunk still shows the same hub's content — exactly the
  scenario where a mis-disposed shared material storms shader recompiles
  (~200 ms periodic stalls, `.claude/rules/performance.md` footgun). This is the
  highest-leverage correctness item after the cold-plan stall.

One emissive note per the doctrine: if the buffer wants ambiance (string lights,
a chill-zone glow), prefer **emissive (additive-final), not a new `PointLight`**
(`.claude/rules/performance.md` "One light per cluster"; "Emissive doesn't cast
shadows"). A green buffer does not need its own light.

---

### Does merge/trim NET-REDUCE draws? (the briefing's explicit Q4 sub-question)

**Yes, decisively.** Removing the band-aids and replacing them with planner-side
merge/trim/yield is a net draw *reduction* across the world:

- **merge:** one shared court instead of two adjacent. The current band-aid
  `neighbourCourtHere` (chunks.js:1173–1183) already *omits* the second court at
  build time — so merge preserves that −16 draws and just makes it
  order-independent. No regression; the win is correctness, not new savings here.
- **trim:** the band-aids had **no** vendor-row trim — rows clipped or got
  whole-skipped at booth granularity (chunks.js:1404–1408 skips individual booths
  that clip). Planner trim removing ~half a row is **−~30 draws** per conflicted
  street, a genuine new reduction.
- **yield:** `stageDeckClips` (chunks.js:1195–1201) already omits a clipping
  drum. Planner yield preserves that, order-independently. −whole-cluster.
- **soft_buffer** is the ONLY add (+~24 draws) and it replaces *nothing* the
  band-aids built (there was no buffer before — clashing zones just overlapped).

Net per seam-neighbourhood: the ~40% of seams that are `merged_court` and the
trim/yield seams all subtract; the ~43% `soft_buffer` seams each add ~24 draws on
ONE host chunk. Because adds and subtracts land on *different* chunks, the right
way to read this against the per-tier budget is **per-chunk worst case**, and the
worst case is a chunk hosting a soft_buffer midpoint (+24). That's the chunk to
watch on the HUD at `?perf=low`. Everywhere else, the change is flat or lighter.

The design.md risk note "slotting adds no geometry … zone-omit can only *reduce*
draws" (design.md:186–187) is **correct for merge/trim/yield but WRONG for
soft_buffer** — soft_buffer is the documented exception and must be perf-checked
on its host chunk, not waved through under "slotting adds no geometry."

---

### Verdict

-   **Verdict:** **Proceed with mitigations.**
-   **Key Concern:** The cold-`festivalPlan` fan-out. Resolving a seam by warming
    ~60 neighbour plans at ~47 ms each is **~2.8 s of synchronous chunk-gen work
    on first touch of a fresh region** (probe: `/tmp/zwt/probe-cost.mjs`,
    `/tmp/zwt/probe-warm.mjs`) — the same wall the reverted senior-keep-out
    experiment hit. The buffer *geometry* is cheap and safe; the *planner
    recursion that feeds it* is the cliff.
-   **Recommendation:** Ship 4B.3 only with (1) a bound on per-chunk seam-resolve
    cost — spread first-touch warming across frames within the existing
    1-chunk/frame budget, and/or a cheaper "seam-lite" front-zone-only plan, and a
    tighter `SEAM_PAIR_REACH` / integer pre-filter so `festivalPlan` isn't called
    for the ~60-heart over-bound set before the prune; (2) buffer trees routed
    through an InstancedMesh or a `userData.shared`-tagged bucketed pool (NOT the
    per-leaf-allocating `buildTree`); (3) `castShadow = false` on path/seating/
    potty buffer props; (4) any new pooled buffer resource tagged
    `userData.shared = true`; (5) a backtick-HUD check at `?perf=low` and
    `?perf=mid` on a chunk that hosts a soft_buffer midpoint before declaring
    done. With those, the draw/tri budget is comfortably net-negative and the only
    real exposure — the spawn stall — is contained.
