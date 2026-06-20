# council-profiler-r2.md — Round 2 (cited cross-examination)

> Re-verified against `src/` at file:line before writing. Two tensions to resolve:
> **T2** (bucket strategy × shadow discipline) and **T3** (which call path slice-1
> MUST target). My R1 lives in `council-profiler.md`; this appends the Round-2
> reactions and revises my recommendation where the others' actual arguments moved me.

## Round 2 — Reactions

### T3 — Which path is live by default? (the dispositive one)

This is the tension that, if gotten wrong, makes the whole slice measure **zero**.
I re-verified the default this round and the answer is now nailed down with a
file:line proof that wasn't fully pinned in R1.

- **Re: Architect — "`chunks.js:1061` (`scatterWorldgenTrees`) … This is the *dominant* draw bucket and the *real* lever — and it's NOT named in the briefing. Slice-1 target."** (`council-architect.md`, Structural Risk #1, site 2): **Agree, and this is now PROVEN, not asserted.** Verified chain:
  - `DEFAULT_WORLDGEN_V2 = true` (**perf.js:42**); `USE_WORLDGEN_V2` resolves to that default when no `?worldgen=` override is present (**perf.js:43-47**).
  - The generate path takes the v2 branch `if (USE_WORLDGEN_V2)` (**chunks.js:391**), runs `_generateWorldgen(ctx)` (**chunks.js:401**), and **`return`s at chunks.js:405** — short-circuiting before the v1 path ever runs.
  - `_generateWorldgen` calls **`scatterWorldgenTrees(ctx)` (chunks.js:485)**, whose `placeTree` builds `buildForestTree(rng)` per tree (**chunks.js:1061**), capped at `MAX_WORLDGEN_TREES = 80` (**chunks.js:1027**) × `PERF.forestTreeDensityMul` (**chunks.js:1040**, 0.7 on low per perf.js:66).
  - The v1 `getForestAt`/`scatterForestTrees` path sits **below the v2 `return`**, at chunks.js:412+ (`const forest = getForestAt(...)`, chunks.js:412) — it is **dead by default**, reachable only via `?worldgen=0` (perf.js:46).
- **Re: Pragmatist — "Slice 1 (foliage descriptors + instancing — the proof): … `scatterForestTrees` (forests.js:911) accumulates descriptors, then builds per-chunk InstancedMeshes …"** (`council-pragmatist.md`, Priority Sequence #2; Incremental Delivery "Slice 1"): **Rebut — this targets the wrong path and would ship a zero-delta capture.** Pragmatist's entire slice-1 instruments `scatterForestTrees` (the v1 forest, forests.js:911) and explicitly leaves `scatterTrees`/`scatterWorldgenTrees` for slice 2 (`council-pragmatist.md` Priority Sequence #3 only names `buildTree`/`scatterTrees` at chunks.js:1683, **never** `scatterWorldgenTrees`). Under `DEFAULT_WORLDGEN_V2 = true`, a live dense-hub `__dbg.drawCensus()` after Pragmatist's slice-1 would show the `IcosahedronGeometry·240v` + `ConeGeometry·35v` buckets **unchanged** — because the trees the player actually drives through are built by `scatterWorldgenTrees` (chunks.js:1061), which slice-1 never touched. The proof slice would "prove" nothing. **Note the stale comment trap:** chunks.js:385 reads "v2 worldgen path (USE_WORLDGEN_V2; default OFF while building → ?worldgen=1 to test)" — that comment is **stale**; the binding constant is `DEFAULT_WORLDGEN_V2 = true` (perf.js:42). An implementer who trusts the chunks.js:385 comment over the perf.js:42 constant will scope slice-1 to the wrong path. The comment must not be the source of truth here.
- **Re: Pragmatist — "Birds are decoupled from the mesh … `scatterForestTrees` keeps computing `perches`/`crown`"** (`council-pragmatist.md` opening #2): Agree on the *birds* conclusion, but it's framed entirely around `scatterForestTrees` (forests.js:929-930). The identical `perches`/`crown` wiring also exists on the **live** path at **chunks.js:1071-1072** — the slice that matters. The decoupling holds on both paths; just confirm it on the one that ships.

**T3 verdict (definitive):** Slice-1 MUST target **`scatterWorldgenTrees` (chunks.js:1036-1097), the per-chunk `placeTree` at chunks.js:1060-1075**. This is the path active under `DEFAULT_WORLDGEN_V2 = true` (perf.js:42). The v1 `scatterForestTrees` (forests.js:911) is dead code by default and instrumenting it **moves the production draw number by zero**. If we want both paths covered (for the `?worldgen=0` escape hatch), they share `buildForestTree(rng)` so a single descriptor-emitter refactor covers both — but **the live-capture gate must be run on the default (v2) path**, not the v1 one. The Architect's R1 is correct and the Pragmatist's slice-1 is mis-scoped; this is the single most important correction in the whole deliberation.

### T2 — Bucket count under color separation × shadow separation

I sharpened my R1 here against the Auditor's and Pragmatist's actual numbers. My R1 favored `instanceColor` (~3-5 buckets/chunk); Pragmatist favored green-bucket meshes reusing `_foliageMats` (~21). The Auditor introduced the constraint that resolves the tension: **shadow casting is all-or-nothing per InstancedMesh**, so the bucket boundary is forced to *include* the cast/no-cast split. Let me do the actual arithmetic both ways, grounded in the verified castShadow lines.

**Verified shadow facts (re-read tree.js this round):**
- Pine: trunk casts (**tree.js:167**); cones cast **only `i===0`** (**tree.js:185**).
- Oak: trunk casts (**tree.js:207**); main crown casts (**tree.js:217**); bumps **do not** cast (no castShadow set, tree.js:226-232).
- Birch: trunk casts (**tree.js:251**); crown puffs cast **only `i===0`** (**tree.js:271**).
- Geometry: cones are `ConeGeometry` (tree.js:183); oak/birch crowns are `IcosahedronGeometry` (tree.js:215/226/264) — **two distinct unit geos**. Trunks are cylinders, but pine/oak use `_forestTrunkMat` (tree.js:44) while birch uses `_birchTrunkMat` (tree.js:48) — **two trunk colors**.

**(a) Pragmatist's green-bucket meshes (no `instanceColor`):**
The color buckets come from `_foliageMats` = **7 entries** (FOREST_GREENS, tree.js:26/50). To preserve selective shadows you must *also* split each color bucket by cast/no-cast. The honest worst-case for foliage alone:
- Crowns (icosa): 7 greens × 2 shadow states = **14 instanced meshes** (oak-main-caster + birch-lowest-caster on one side; oak-bumps + birch-upper on the no-cast side — but they share the icosa geo, so the split is purely by the castShadow flag, still 7×2).
- Cones (pine): 7 greens × 2 shadow states = **14 instanced meshes** (lowest tier casts, upper tiers don't).
- That's **28 foliage instanced meshes/chunk** before trunks if you faithfully bucket by both color and shadow.
- In practice the green buckets are sparsely populated (80 trees ÷ 7 greens ≈ 11 trees/green, split across 3 species and 2 shadow states), so many of the 28 are empty and you'd skip allocating them — the *realized* count is lower, but the **bucket-key space is 28**, and you pay a draw for every non-empty one. Pragmatist's "~21 draws/chunk" (`council-pragmatist.md` references reusing the 7 buckets) **undercounts because it ignores the shadow split the Auditor flagged** — 7 greens × 3 shapes (crown/cone/trunk) = 21 only if you let shadows be uniform per shape, which over-casts (see below). With the shadow split it's up to 28 foliage + trunk buckets. **This is the real cost of "slice-1 simplicity."**

**(b) `instanceColor` (color folded into a per-instance attribute, no color buckets):**
Color stops being a bucket dimension entirely — one `MeshStandardMaterial` base, color via the `instanceColor` attribute. The *only* remaining bucket dimensions are **geo-type × shadow-flag**:
- Crowns (icosa): caster mesh + no-cast mesh = **2**.
- Cones (pine): caster mesh (lowest tier) + no-cast mesh (upper tiers) = **2**.
- Trunks (cylinder): all trunks cast (tree.js:167/207/251) → **1 caster mesh** — BUT birch trunk is a different color (`_birchTrunkMat`, tree.js:48) vs pine/oak (`_forestTrunkMat`, tree.js:44). With `instanceColor` that's still **1 mesh** (color is per-instance); without it, 2.
- **Total: 2 + 2 + 1 = ~5 instanced meshes/chunk**, all `castShadow`-correct, one extra cached program.

**Does `instanceColor` compose with selective shadow casting?** **Yes — they are orthogonal.** `castShadow` is a property of the *InstancedMesh object* (one boolean for the whole mesh), while `instanceColor` is a per-instance vertex attribute consumed by both the color pass and (irrelevant to) the depth/shadow pass. The shadow pass renders the depth of the geometry regardless of color, so an instance-colored mesh casts exactly as cleanly as a single-color one. There is **no interaction** — `instanceColor` does not constrain or expand the shadow-bucket count. The shadow split (2 crown buckets, 2 cone buckets) is forced by the all-or-nothing rule *whether or not* you use `instanceColor`; `instanceColor` only removes the **orthogonal 7× color multiplier** on top of it.

**T2 verdict — draws/chunk and the winner:**

| Strategy | Bucket key space | Realized draws/chunk (foliage+trunk) | Shadow-correct? | Extra programs |
| --- | --- | --- | --- | --- |
| (a) Green-bucket meshes (Pragmatist), shadow-faithful | 7 greens × (2 crown-shadow + 2 cone-shadow) + trunks = **~28** | up to ~21-28 (sparse buckets trim some) | Yes | 0 (one Standard program) |
| (a′) Green-bucket meshes, uniform shadow per shape (the "simple" version) | 7 × 3 = **21** | ~21 | **No — over-casts** (every bump/upper-tier puff casts) | 0 |
| (b) `instanceColor` + shadow split | 2 crown + 2 cone + 1 trunk = **~5** | **~5** | Yes | 1 (cached once, amortized) |

**Winner for slice-1: (b) `instanceColor` + 2-crown/2-cone/1-trunk shadow-split buckets (~5 draws/chunk).** Reasoning, citing the others:

- The Auditor's R1 is correct that the bucket boundary **must** be the cast/no-cast boundary (`council-auditor.md` §3: "This forces the bucket split to be the cast/no-cast boundary, not just geo-type. … ~5 instanced meshes/chunk, not 3"). The Auditor's ~5 figure assumes `instanceColor` already absorbs color — and it does. So the Auditor and I converge on **~5/chunk**.
- The Pragmatist's "reuse `_foliageMats`, no `instanceColor`, ~21 draws" (`council-pragmatist.md` Priority Sequence #2 + Deferred "instanceColor … not needed") trades 1 cached program for **4× the draws** (21 vs 5) AND, in its stated "simple" form (uniform shadow per shape, 21 buckets), **walks back the 56-caster shadow audit** by casting every oak bump and every upper pine/birch tier — exactly the regression `.claude/rules/performance.md` ("small detail meshes don't appear distinct in shadow anyway") and tripwire #9 forbid. To make the green-bucket route shadow-faithful you need ~28 buckets, which is strictly worse than the simple 21 *and* worse than `instanceColor`'s 5. **There is no version of green-bucketing that beats `instanceColor` once you honor the shadow discipline.**
- The one cost `instanceColor` carries — a single extra cached shader program (per my R1, `council-profiler.md` "Does `instanceColor` force a recompile") — is amortized across the whole session and is categorically not the recompile-storm footgun. The Auditor agrees it's "one extra vertex attribute, no extra draw" (`council-auditor.md` Quality Deficiencies, bucket-dimensions item).

**Concrete draws/chunk for the live path:** today `scatterWorldgenTrees` builds ~80 trees × ~4.3 meshes = **~344 draws/chunk** (per my R1 census math, unchanged). After (b): **~5 draws/chunk** (2 crown + 2 cone + 1 trunk). After (a′ simple): ~21 but shadow-broken. After (a faithful): ~21-28. **(b) is a ~69× per-chunk draw reduction and the only option that keeps the shadow audit intact.**

### Re: the Pragmatist's slice-0 free win (concede — it's good and orthogonal)

- **Re: Pragmatist — "Slice 0 (free win, ship immediately): chunk-tree material pooling at tree.js:107 + tree.js:124"** (`council-pragmatist.md` Priority Sequence #1): **Agree — ship it, but note it's on the v1 chunk-tree path (`buildTree`), which under `DEFAULT_WORLDGEN_V2 = true` is also largely dead.** `buildTree` is consumed by `scatterTrees` (the v1 chunk-tree path), not `scatterWorldgenTrees`. The per-tree `new MeshStandardMaterial` Pragmatist wants to pool (tree.js:107) is a real allocation win **only when v1 is active** (`?worldgen=0`). It's still worth banking (zero risk, it's correct hygiene), but its *production* (v2-default) impact is near-zero, same as the v1 instancing critique above. Don't let "we banked a free win" read as "we moved the production number" — only the `scatterWorldgenTrees` instancing does that.

### Re: Adversary's determinism gate (agree, with a profiler note)

- **Re: Adversary — "`bin/test-registry-grid` … never imports `tree.js`, never calls `buildForestTree` … the registry diff is blind to visuals by design"** (`council-adversary.md` Vuln 1): **Agree, and it matters to my budget gate too.** A silent species/size reshuffle wouldn't just break determinism for players — it would invalidate my tri-budget measurement, because tri-count/chunk depends on the species mix (pine ~86 tris vs oak ~310, per my R1). If the descriptor refactor reorders rng and the species blend shifts, a "passing" tri capture is measuring a *different forest* than ships. So the Adversary's golden-hash gate (`bin/test-forest-determinism`) is a **precondition for my tri-budget gate being meaningful**, not just for player-facing determinism. Run it first.

## Revised Verdict

- **New Verdict**: **Proceed with mitigations** (unchanged from R1) — but with one **hard correction to scope** that the Pragmatist's slice plan got wrong.
- **What moved me**: The Architect's R1 call-site map (`council-architect.md` Structural Risk #1) plus my own re-verification of `DEFAULT_WORLDGEN_V2 = true` (perf.js:42) → `chunks.js:391 return at :405` → `scatterWorldgenTrees` (chunks.js:485/1061). This **definitively resolves T3 against the Pragmatist's slice-1 target**: instrumenting `scatterForestTrees` (forests.js:911) measures zero because that path is dead under the shipped default. And the Auditor's all-or-nothing-shadow constraint (`council-auditor.md` §3) **resolves T2 in favor of `instanceColor` (~5 draws/chunk)** over green-bucketing (~21-28 to stay shadow-faithful) — `instanceColor` composes cleanly with selective shadow casting because the two are orthogonal.
- **Binding mitigations (profiler domain):**
  1. **Slice-1 MUST target `scatterWorldgenTrees` (chunks.js:1036, `placeTree` at chunks.js:1060)** — the live path under `DEFAULT_WORLDGEN_V2 = true` (perf.js:42). Treat the chunks.js:385 "default OFF" comment as stale. The live `__dbg.drawCensus()` gate runs on the **default (v2) build**, no `?worldgen=` flag. Cover v1 `scatterForestTrees` only as a free rider of the shared `buildForestTree` refactor — never as the *measured* slice.
  2. **Use `instanceColor`, not green-bucket meshes** — ~5 draws/chunk vs ~21-28, and the only option that keeps the 56-caster shadow audit intact. Bucket exactly as: crown-caster (icosa, castShadow=true: oak mains + birch lowest), crown-noshadow (icosa, false: oak bumps + birch upper), cone-caster (cone, true: pine lowest tier), cone-noshadow (cone, false: pine upper tiers), trunk (cylinder, true). That's the 2+2+1.
  3. **Tri-budget gate is downstream of the Adversary's determinism gate** — run `bin/test-forest-determinism` (golden hash) first so the `?perf=low`/`?perf=mid` tri capture is measuring the same species mix that ships.
  4. Carry forward my R1 mitigations unchanged: per-chunk bounding spheres (not per-block), keep `forestTreeDensityMul=0.7` on low, do **not** tag the per-chunk InstancedMeshes `userData.shared` (only the unit geo/mat), and gate done on a live low/mid draw+tri read (no WebGL in Codespaces — human's confirmation step).

### Budget Estimate (revised, live-path)

- **Draw delta**: **−~339 draws per fully-treed v2 chunk** (~344 → ~5 with `instanceColor` + shadow split). Resident worst case (49 chunks mid/high) collapses the `IcosahedronGeometry·240v` (2,637) + `ConeGeometry·35v` (2,120) census buckets toward low hundreds pre-frustum. **Closest budget after**: every tier's draw budget (low 80 / mid 200 / high 400) becomes reachable for the tree subsystem — trees stop being the dominant bucket.
- **Triangle delta**: unchanged from R1 — **not a reduction**; instancing defeats per-tree intra-chunk frustum cull. Worst case low ~100k tree tris in a dense-forest frame against the **150k low budget (~67%)**; mid ~216k/400k; high trivial. **Closest budget after**: low tris — the squeeze, must be live-verified (and only meaningful *after* the determinism golden-hash passes).
- **Cost type**: **Steady-state FPS** (draw-call reduction headline; lower shadow-pass cost on mid/high secondary, preserved by the cast/no-cast bucket split). Minor allocation change at chunk spawn (net improvement: ~5 InstancedMesh allocs + 80 matrix writes beats ~344 Mesh allocations).
- **Low/mid-tier verdict**: **Needs `instanceColor` + 5-bucket shadow split + per-chunk bounds + the v2-path live re-measure.** Draws: safe, big win, every tier. Tris: safe on mid/high, **at risk on low** until measured — and the measurement is only valid once the descriptor stream is proven byte-identical (Adversary's golden gate).
