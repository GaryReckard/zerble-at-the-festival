## Profiler's Position

Verdict up front: **Proceed with mitigations.** The draw-call lever is real and large; the trade is a steady-state triangle *increase* that must be checked against the low/mid budgets before this is called done. The plan as drawn also under-scopes the live code path.

### Priority Sequence

1. **Instance the foliage crowns first (the IcosahedronGeometry·240v + ConeGeometry·35v buckets).** These are the two largest tree buckets in the census (2,637 + 2,120 draws = 4,757 of the ~7,000 "tree" draws). This is exactly audit-order step 5 (InstancedMesh, `.claude/rules/performance.md`): "One draw call replaces N." Trunks (cylinders) are a secondary bucket — instance them in the same pass since they're already free-riding the same per-chunk descriptor accumulation.
2. **Cover the LIVE path, not just the legacy one.** The briefing names `scatterForestTrees` (forests.js:831) — that is the *v1 legacy* forest. The shipped default is **worldgen v2** (`DEFAULT_WORLDGEN_V2 = true`, perf.js:42; gated in chunks.js:391), whose tree scatter is `scatterWorldgenTrees` (chunks.js:1036), capped at `MAX_WORLDGEN_TREES = 80` (chunks.js:1027) and calling the same `buildForestTree(rng)` (chunks.js:1061). Both paths build identical trees. If the refactor only touches the v1 path, the production deploy gets zero draw savings. Both `placeTree` call sites must emit descriptors.
3. **Re-measure with `__dbg.drawCensus()` AND the backtick HUD tri marker on `?perf=low` and `?perf=mid`** before declaring done. Draws will plummet; tris will rise (see below). The win is only real if tris stay green/yellow at low (150k) and mid (400k).

### Is the ~7,000→~3-per-chunk draw estimate credible?

**Yes, the per-chunk direction is right; the resident-scene total is optimistic by ~2×.** Counting from source:

**Meshes per tree** (each is its own draw today — `uniq` geo, per the census):
- TallPine (45%, tree.js:156): 1 trunk + 3-4 cones (tiers `3 + floor(rng()*2)`, tree.js:176) = **4-5 meshes**
- Oak (35%, tree.js:196): 1 trunk + 1 main crown + 2-3 bumps (`2 + floor(rng()*2)`, tree.js:221) = **4-5 meshes**
- Birch (20%, tree.js:240): 1 trunk + 2-3 crown puffs (`2 + floor(rng()*2)`, tree.js:259) = **3-4 meshes**
- Blended average ≈ **4.3 draws/tree**.

**Trees per chunk** (v2, chunks.js:1027/1040): `80 × forestTreeDensityMul` → **80 on mid/high, 56 on low** (perf.js:66/82/97).

**Draws/chunk today**: 80 × 4.3 ≈ **344 draws** in a fully-treed chunk (mid/high); 56 × 4.3 ≈ **241** (low). That single number already exceeds the entire 200-draw mid budget and 80-draw low budget *for one chunk* — which is why this is the right lever.

**After instancing**: per chunk you submit the unit-geo InstancedMeshes. The plan says "~3" (crown icosa, pine cone, trunk cyl). Realistically it's **3 + N green buckets** if you go the multi-mesh route instead of `instanceColor` — `FOREST_GREENS` has 7 entries (tree.js:26), so worst case is ~3 shapes × up to 7 colour buckets ≈ **up to ~21 InstancedMeshes/chunk** if you bucket naively. With `instanceColor` it collapses back toward **~3/chunk**. Pick `instanceColor` (one program, see below) — it's the difference between ~3 and ~21 per chunk.

**Resident-scene total**: resident chunks aren't `(2·LOAD+1)²`; unload uses the larger `UNLOAD_RADIUS` with hysteresis (chunks.js:361). Worst-case resident set is `(2·UNLOAD+1)²`: low = 5×5 = **25**, mid/high = 7×7 = **49**. Not every resident chunk is fully treed (roads/hubs/clearings are treeDensity~0), but for a worst-case dense-woods drive:
- Today: 49 chunks × ~344 = **~16,800 tree draws** pre-frustum — consistent with the census's 14,359 *whole-scene* figure (trees dominate but aren't 100% of it).
- After: 49 × 3 = **~150 tree draws** (instanceColor) pre-frustum; frustum-culled live to far less.

So "~7,000 tree draws → ~3 per chunk" is **directionally correct and conservative on the win** — the real pre-frustum tree-draw count is higher (~16k), so the savings are *larger* than advertised. The "halves total scene draws" claim is credible and probably understated for dense-forest framing.

### The tris-vs-draws trade — worst case quantified

This is the part the plan hand-waves and the part I most want gate-tested. **Instancing does not reduce triangles; it can increase resident triangles** because a per-chunk InstancedMesh submits ALL its instances whenever the chunk's bounding sphere is visible — there is no per-tree frustum cull within the chunk (briefing risk #3 is correct). Today, individual tree meshes each frustum-cull independently; tomorrow, one visible corner of a chunk pulls in all 80 trees' tris.

**Per-tree triangle budget** (geometry verified, three.js r160):
- Icosahedron detail-1 = **80 tris** (240v — matches census bucket name).
- Cone radialSegments-8 = 8 side + 8 cap = **16 tris** (35v — matches census).
- Trunk cylinder, 7-8 radial = **~28-32 tris**.

**Tris per tree** (blended, using mesh counts above):
- Pine: trunk ~30 + 3.5 cones × 16 ≈ **86 tris**
- Oak: trunk ~30 + 3.5 icosa × 80 ≈ **310 tris**
- Birch: trunk ~30 + 2.5 icosa × 80 ≈ **230 tris**
- Blended (0.45/0.35/0.20): **~180 tris/tree**.

**Tris per fully-treed chunk**: 80 × 180 ≈ **14,400 tris** (mid/high); 56 × 180 ≈ **10,100** (low).

**Worst-case resident steady-state tris** if instancing forces all-instances-when-visible and the player faces a wall of dense forest:
- Low: how many *treed* chunks fall in the frustum at once? With a forward-facing camera over 5×5 resident chunks, realistically ~6-10 chunks of woods in view. 10 × 10,100 ≈ **~101k tris from trees** against the **150k low budget** — that's 67% of the *entire* low budget consumed by tree foliage alone, before crowd/hub/HUD. **This is the risk.** Today those same trees frustum-cull per-mesh, so the back half of each chunk's trees (facing away / occluded) don't all submit. Instancing removes that fine-grained cull.
- Mid: ~15 treed chunks × 14,400 ≈ **216k** against **400k** — comfortable (54%).
- High: trivially fine against 1.2M.

**Net read**: the draw win is unambiguous and large at every tier. The triangle picture is *fine on mid/high* but **tight on low** — instancing can move low-tier tris up because it defeats per-tree culling inside a chunk. Two mitigations make this safe:
1. **Per-chunk bounding spheres (plan step 3) are mandatory, not optional.** They keep whole off-screen chunks culled. The plan already says this — good. Without it, low-tier tris blow out.
2. **Keep `forestTreeDensityMul = 0.7` on low (perf.js:66)** — it's already there and it's load-bearing for the tri budget now. Do not let "we instanced it, draws are cheap" tempt anyone into raising low-tier density. Draws got cheap; tris did not.

If a live `?perf=low` measurement shows tree tris pushing past ~110-120k in a dense-forest frame, the fallback is an LOD/detail-0 icosahedron (20 tris instead of 80) for distant instanced chunks — but that's a follow-up, not a blocker, and it's already a parked ROADMAP item (LOD on distant trees). Don't pre-build it.

### Does `instanceColor` force a shader recompile / extra program?

**No recompile storm, and it's the right choice over green-bucket meshes.** `InstancedMesh.instanceColor` (a `THREE.InstancedBufferAttribute`) flips the `USE_INSTANCING_COLOR` define and compiles **one** program variant for instanced-color Standard material — compiled **once**, the first frame an instance-colored mesh renders, then cached and reused for every chunk's crown/cone/trunk meshes. This is categorically different from the footgun in `.claude/rules/performance.md` ("a mis-disposed shared material storms shader recompiles 50+/frame"): that's *repeated* recompiles of the *same* program from disposal churn. `instanceColor` is *one* extra program, amortized across the whole session.

Contrast the green-bucket alternative: 7 `FOREST_GREENS` (tree.js:26) × 3 shapes = up to 21 InstancedMeshes/chunk, 21 draws/chunk instead of 3 — and it still uses the *same single* Standard program (no extra recompile either), it just burns 7× the draws. **So `instanceColor` wins on draws (3 vs ~21/chunk) at the cost of exactly one extra cached program — take it.** One caveat: per the threeShim material-tier swap (CLAUDE.md #2), low tier swaps Standard→Lambert; confirm the instanced path renders correctly under the Lambert variant too (Lambert also supports instancing + instanceColor in r160, but this is a live-verify item the agent can't check in Codespaces).

### Shadow cost under instancing

**This is a clean win and preserves the audit discipline — with one caveat.** An `InstancedMesh` with `castShadow = true` renders **one shadow draw covering all instances**, not one per tree. Today each shadow-casting mesh is a separate caster:
- Per the per-tier shadow rules, trees already cast selectively: pine only lowest cone tier (tree.js:185, `i === 0`), oak trunk + main crown but *not* bumps (tree.js:220 comment), birch only lowest puff (tree.js:271). That discipline (cut 115→56 casters in pass 1) is exactly right.

Under instancing you get **one shadow draw per shadow-casting InstancedMesh per chunk** instead of per tree — a large per-frame shadow-pass saving on mid/high (shadows on; low has shadows off entirely, perf.js:57). **Caveat to preserve the discipline**: the descriptor model must keep the *selective* casting — i.e., the trunk+lowest-tier-crown InstancedMeshes get `castShadow = true`, the bump/upper-tier InstancedMeshes get `castShadow = false`. If the refactor collapses all foliage into one crown InstancedMesh, you lose the "only lowest tier casts" subtlety and either over-cast (every puff casts) or under-cast (no crown casts). Mitigation: bucket instances into a **shadow-casting crown mesh** and a **non-casting crown mesh**, matching today's per-mesh `castShadow` decisions. That's one extra InstancedMesh per shape (so ~4-5/chunk, not 3) — still a massive draw win, and it keeps the 56-caster discipline intact.

### Per-FOREST-BLOCK (3×3) vs per-chunk instancing

**Per-chunk is correct. Reject per-block.** Per-block (3×3 = 240m span) instancing would cut draws further (1 set of InstancedMeshes per 9 chunks instead of per chunk → ~3 draws per 9 chunks), but it **destroys frustum-cull granularity**: a 240m bounding sphere is almost always intersecting the frustum, so you'd submit all ~720 trees' instances (9 × 80) whenever any corner of the block is visible. That's ~130k tris from a single block, blowing the low budget on its own. The draw delta between per-chunk (~150 resident tree draws) and per-block (~17 resident tree draws) is **already far under the 80/200/400 budgets either way** — there is no budget pressure left to justify trading away cull granularity. Per-chunk's small bounding spheres (plan step 3) are the right granularity: cheap enough on draws, tight enough on tris. The v1 path's forest-block structure (forests.js, 3×3 pin) is a tempting hook for per-block, but resist it.

### Allocation vs steady-state

- **Steady-state**: this is primarily a steady-state draw-call fix (audit step 5) — it lowers baseline draws while parked in/near woods. That's the symptom the census flags (3,750 median draws against a 400 budget). Correct lever for the symptom.
- **Allocation**: building per-chunk InstancedMeshes at chunk-spawn is an *allocation* cost — you allocate fresh instanceMatrix/instanceColor `Float32Array`s per chunk on every chunk load. That's bounded (80 instances × 16 floats = small) and respects the 1-chunk/frame budget, but it's **not** zero — verify chunk-spawn frame-time on `?perf=low` doesn't regress vs the current per-tree-build path (it should *improve*: 3 InstancedMesh allocs + 80 matrix writes beats 344 Mesh allocations).
- **Disposal/leak (briefing risk #2 — resolved in code)**: the disposal walk **already handles InstancedMesh** — chunks.js:563 calls `obj.dispose()` when `obj.isInstancedMesh`, and the header comment (chunks.js:552) confirms "InstancedMesh.dispose frees only its own instance buffers." Unit geos tagged `userData.shared` are correctly skipped (chunks.js:556). **So there is no leak as long as the per-chunk InstancedMeshes are NOT tagged `userData.shared`** (only the unit geo/mat are shared; the per-chunk InstancedMesh wrapper and its instance buffers must be disposable). The plan's "module-shared unit geos" is right; do **not** let the InstancedMesh objects themselves inherit `shared`, or their instance buffers leak across the session.

### Budget Estimate

- **Draw delta**: roughly **−340 draws per fully-treed chunk** (344 → ~4-5 with selective-shadow buckets, or ~3 without). Resident-scene worst case: ~16,800 tree draws → ~150-250 (instanceColor). **Closest budget after**: even mid (200) and low (80) are now reachable for the tree subsystem — trees stop being the dominant bucket. Net scene draws plausibly halve (census claim credible, likely understated for dense woods).
- **Triangle delta**: **+ (slightly higher resident tris)**, NOT a reduction. Geometry per tree is unchanged (~180 tris/tree); instancing removes per-tree intra-chunk frustum cull, so more tree tris stay resident when a chunk is partially visible. Worst case low: ~100k tree tris in a dense-forest frame against the **150k low budget (≈67%)**; mid ~216k/400k (54%); high trivial. **Closest budget after**: low tris — the squeeze. Must be live-verified.
- **Cost type**: **Steady-state FPS** (draw-call reduction is the headline win; lower shadow-pass cost on mid/high secondary). Minor allocation change at chunk spawn (net improvement expected).
- **Low/mid-tier verdict**: **Needs the per-chunk bounding sphere + `instanceColor` + selective-shadow buckets + a live `?perf=low`/`?perf=mid` tri+draw re-measure.** Draws: safe and a big win at every tier. Tris: safe on mid/high, **at risk on low** until measured — the per-chunk cull granularity and the existing `forestTreeDensityMul=0.7` are what keep it green.

### Verdict

- **Verdict**: **Proceed with mitigations.**
- **Key Concern**: Instancing trades fine-grained per-tree frustum culling for coarse per-chunk culling, which can *raise* low-tier resident triangles (worst case ~67% of the 150k budget from trees alone) even as it slashes draws. The draw win is unconditional; the tri budget at low is the thing to gate-test.
- **Recommendation**: Ship it — the draw lever is the single biggest item in the census and instancing is exactly the prescribed fix (audit step 5). Required mitigations: (1) cover the **live v2 path** `scatterWorldgenTrees` (chunks.js:1036), not just legacy `scatterForestTrees`; (2) use **`instanceColor`** (one cached program, ~3 draws/chunk) over green-bucket meshes (~21/chunk); (3) **per-chunk** granularity with small bounding spheres — reject per-block; (4) preserve **selective shadow casting** by bucketing into shadow / no-shadow InstancedMeshes so the 56-caster discipline survives; (5) keep `forestTreeDensityMul=0.7` on low and do **not** tag the per-chunk InstancedMeshes `userData.shared` (only the unit geo/mat) so their instance buffers dispose; (6) gate on a live `__dbg.drawCensus()` + backtick HUD tri/draw read at `?perf=low` and `?perf=mid` — the agent cannot measure WebGL in Codespaces, so this is the human's confirmation step and the definition of done.
