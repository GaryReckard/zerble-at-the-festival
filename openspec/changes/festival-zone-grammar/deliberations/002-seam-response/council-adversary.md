## The Adversary's Position

I attacked the 4B.3 seam-RESPONSE plan from the determinism, load-order, and
lifecycle lenses. The 4B.1/4B.2 foundation (`0bc68c1`, `3f5cf73`) is genuinely
clean — pure, integer-gated, order-independent. **The danger is entirely in 4B.3,
where the plan stops being a pure read and starts *emitting a response into the
plan*.** That single change — making `festivalPlan(heart)` seam-aware — re-opens
the exact dead end that already cost 8s/plan + a stack overflow, and it opens a
new class of asymmetry bug the band-aids never had. Below, every claim is cited.

### Priority Sequence

1. **Decide the architecture question (briefing Q6) FIRST and correctly: the seam
   response must NOT live inside the recursive part of `festivalPlan`.** Everything
   else (determinism, perf, golden) is downstream of this. The trim/merge/buffer
   must be derivable from a *pure, non-recursive* substrate (the yielder's
   classified seam set), not from one hub calling its neighbour's full plan. See
   Vulnerability 1.
2. **Prove order-independence of the RESPONSE with a positive test, not by
   analogy to 4B.1.** 4B.1's pairs are order-independent; the *response emission*
   is a new surface. See Vulnerability 2.
3. **Integerize the trim geometry before it gates booth existence** (Q1). The
   classifier's existence gate is already integer (`classifySeamsNear`); the
   *response* introduces new float-to-existence paths (trimmed row length → "can it
   seat 3 booths"). See Vulnerability 3.
4. **Re-record the golden, then run `node==browser` on the FULL self-test, then
   diff against a pre-removal snapshot of the band-aids' output** — in that order,
   one commit. See Vulnerabilities 4 and 6.
5. **Keep the band-aids until the planner equivalent is proven on the two pinned
   seeds**, then remove them in the same golden-move commit, not before.

### Vulnerabilities Found

-   **Recursion re-opens the 8s/stack-overflow dead end (Q6 / Q2)** — Critical.
    `classifySeamsNear` (`festival.js:355`) already calls
    `festivalPlan(seam.keeper)` and `festivalPlan(seam.yielder)`. For
    *classification* that is a safe pure read. But 4B.3 must **emit the response
    into the plan**, and the design names `festivalPlan` seam-aware (briefing Q6;
    D7 `design.md:143` "the decision belongs in the planner"). If `festivalPlan(A)`
    must trim itself based on neighbour B, then computing A's plan calls B's plan —
    and B's plan, to know whether IT trims, calls A's plan. That is the cycle the
    "senior keep-out" experiment already died on:
    `session-log.md:422-427` — "**Tried + REVERTED** … ~8 s per `festivalPlan` … the
    2×MAX_POI_REACH box holds ~162 hearts/~81 seniors × ~80 ms base-plan
    (nearestRoad-dominated) — would HANG chunk gen." The cost driver is real and
    still present: `_computePlan` calls `computeFrontAxis` → `approachRoadsOf`
    (`festival.js:551`, `roads.js:84-102`), which walks `neighborsOf` building
    arterials per heart. Memoization does NOT save you on a cold pan into new
    territory — the first plan in a region pays for the whole reach box. **The plan
    must specify a non-recursive substrate** (e.g. the yielder reads only
    `seamPairsNear` + `getHubPriority` + its OWN classified fronts, never the
    neighbour's full `_computePlan`). If 4B.3 doesn't name this explicitly, it will
    re-derive the dead end.

-   **Trim asymmetry: keeper and yielder can disagree on WHO trims (Q2)** — Critical.
    4B.1 guarantees both hubs agree on the *pair* and the *keeper/yielder roles*
    (`seamPairsNear`, `festival.js:288-289`, canonical (cx,cz) tiebreak). But the
    *response* is per-hub: hub A emits "I am keeper, I keep my row"; hub B emits "I
    am yielder, I trim my row." For that to be symmetric, B must compute the
    IDENTICAL keeper decision A did — which means B must run `getHubPriority` on A,
    not just itself. That is cheap and order-independent (good). **The latent bug is
    the front selection.** `nearestZoneToward` (`festival.js:327-335`) picks the
    front with strict `if (sq < bestSq)` — first-in-iteration-order wins exact ties.
    The iteration is over `plan` (the `out[]` array order from `_computePlan`). If
    the keeper's view of "which of the yielder's zones is the conflicting front" and
    the yielder's own view of "which of my zones do I trim" are computed from
    different plan-orderings or different distance references, they pick different
    zones and the merge/trim lands twice or not at all. The plan must specify that
    BOTH sides resolve the trimmed zone from the *same* deterministic key (the seam's
    `keeperZone`/`yielderZone` descriptors already in the 4B.2 output,
    `festival.js:368-369`), never each from its own re-scan.

-   **Float-to-existence in the trim length test (Q1)** — High. 4B.2's existence
    gate is correctly integer: `distSq > thr*thr` on integer squared-distance
    (`festival.js:362-364`). The RESPONSE adds a NEW existence decision the
    classifier never had: trim "skip only if the trimmed length can't seat 3 booths"
    (`design.md:138`, briefing line 46). That is a length comparison that decides
    whether a vendor row EXISTS — exactly footgun #4, the road-existence-flip class
    (`CLAUDE.md` tripwire #4; `design.md` D8 `:148-159`). The trimmed length is
    `road_length − overlap_clearance`, and `clusterExtent` is float
    (`tuning.js:332`), the overlap derives from float positions, and
    `approachRoadsOf` accumulates length via `Math.hypot` (`roads.js:98`) before
    `quantize` (`:99`). If the "≥ 3 booths" test compares a float trimmed-length
    against a float threshold, a seed can land one machine at "3 booths fit" and
    another at "skip the row" → the whole row exists on Chrome and vanishes on
    node (or iOS). **The trim length and the booth-count threshold must both be
    quantized to integer meters/booths before the compare**, mirroring
    `seamExtentInt` (`festival.js:316-322`).

-   **`quantize(.5)` boundary flip is in the INPUT, not `Math.round` (Q1)** — Medium.
    `Math.round` itself is engine-stable (rounds .5 toward +∞ on all JS engines),
    so `quantize` (`rng.js:106-108`) is safe *given an identical float input*. The
    risk is whether the float `v` reaching `quantize` is bit-identical node-vs-browser.
    The classifier is safe because its inputs are already-quantized heart/zone
    coordinates (`festival.js:281` "exact integer", `:331-332`). **The exposure 4B.3
    adds is any NEW float computed from `Math.atan2`/`Math.hypot`/`**` that is then
    quantized to gate the trim** — e.g. projecting a row onto its road axis to
    compute the trimmed segment. `atan2`/`hypot`/`sqrt` are NOT bit-identical across
    V8 forks (the design already accepts this — D6 "the accepted V8-fork caveat",
    `design.md:115`; the existing code defends it by quantizing bearings before use,
    `festival.js:30-38` header). If a new trim coordinate lands within ULPs of `x.5`
    before `quantize`, it flips the integer and the booth count, and that flips
    existence. **The plan must route any new trim geometry through the same
    "quantize-the-input-before-it-matters" discipline**, and the deliberate golden
    move's `node==browser` verify must specifically exercise a seed where a trim
    sits near a .5 boundary — a clean self-test on the two pinned seeds does NOT
    prove this class is absent.

-   **Removing `neighbourCourtHere` + `stageDeckClips` can regress the fixed pins (Q5)** —
    High. The band-aids are not no-ops; they currently FIX Gary's playtest pins.
    `neighbourCourtHere` (`chunks.js:1173-1183`) omits a food court whose ring
    overlaps a registered neighbour court — load-order-dependent but *currently
    catching the real clip* (the seed 1139472710 courts at 49m/37m gap that 4B.2
    classifies `merged_court`, per `3f5cf73` commit msg). `stageDeckClips`
    (`chunks.js:1201`) yields the drum vs a neighbour stage deck — the `c7581c3`
    fix. **The planner equivalent (merge/yield) must produce an output that covers
    every case the band-aid covered, or a previously-fixed pin reopens.** Two
    specific gaps: (a) the band-aids are registry/heart-position tests over the
    LIVE world (`neighbourCourtHere` reads `registry.byKind.get('truck')`,
    `chunks.js:1175`) — they catch conflicts the per-pair `seamPairsNear` enumeration
    might miss if a third hub's court reaches in (the band-aid sees ALL trucks in
    range; the seam pass sees only PAIRS). (b) `stageDeckClips` is also used in the
    hub viewer's exact-match acceptance path. The plan must include a **diff of the
    band-aid output vs the planner output across the 10 baseline seeds** (omitted-court
    set, yielded-drum set) and require it be a superset, BEFORE removal — not "remove
    and re-run the linter," because the linter grades clearance, not "did we drop the
    same things."

-   **The `out[]`-order vs proximity-order trap, restated for the response (Q2)** —
    High. The band-aids "already failed" precisely because they resolve in
    chunk-proximity order, not plan order (`chunks.js:1170-1172`: "which hub keeps the
    court depends on which chunk built first"). 4B.3's whole justification is that the
    planner is order-independent (`design.md:143-146`). **But the response is consumed
    in `placeWorldgenProps` / `buildHubPreview`, which iterate `festivalPlan(heart)`
    descriptors and build them as chunks stream in** (`chunks.js:1330`,
    `chunks.js:1322-1328`). If the trim/merge is encoded as a *descriptor mutation*
    that depends on which neighbour plans have been memoized at build time, you have
    re-created the load-order bug inside the planner. The response MUST be a pure
    function of (seed, the two heart cells) so that `festivalPlan(A)` returns the
    identical trimmed descriptor list whether B has ever been planned or not. The
    `_planCache` memo (`festival.js:490-520`) is keyed only on `(cx,cz)` under a
    `(seed,epoch)` gate — it has NO seam dimension, so a plan computed before its
    neighbour's seam-response is known would be cached STALE. **Either the response
    is fully self-contained per heart (no neighbour-plan dependence), or the cache
    key/invalidation must account for the seam — the current memo does neither.**

-   **Golden re-record without a band-aid-removal canary hides a real regression (Q3)** —
    Medium. The golden move re-records `POI 49ec28fc` (briefing line 38; D6
    `design.md:115`). But the golden snapshot is taken AFTER the band-aids are
    removed AND the planner response added — so a perfectly clean re-recorded golden
    proves only "node==browser on the new world," not "the new world is as correct as
    the old one + band-aids." A subtly-wrong merge (court placed where neither
    band-aid would have dropped it) re-records as the new truth silently. **Rollback
    (briefing Q3): if the snapshot diff is non-empty on this commit it is EXPECTED
    (the golden moves), so the snapshot gate is disabled for this one commit** — which
    means the snapshot gate is NOT your safety net here. The safety net must be the
    band-aid-superset diff (Vulnerability 5) plus Gary's 7.3 in-game playtest on the
    two pinned seeds. The plan should state the rollback as "revert the single
    golden-move commit; the band-aids return with it" — which is only possible if the
    band-aid removal and the response are in the SAME commit (they are, per
    `design.md:138`), so do not split them.

-   **Perf: per-seam buffer/path geometry + `userData.shared` + castShadow (Q4)** —
    Low-Medium. `soft_buffer` emits "trees, hammocks, shade seating, a potty bank, a
    connector path" (`design.md:130-131`); `merge`/`trim` emit a "mini spur" path
    record (`design.md:87`, `design.md:184`). The design says spurs stay *cosmetic
    path records* (`design.md:184`) — good, that avoids the road golden. But any NEW
    pooled geometry/material for buffer props must carry `userData.shared = true` or
    the first chunk-unload disposes it and storms shader recompiles
    (`CLAUDE.md` tripwire #6; `perf-pooling.md`). Buffers reuse existing pooled
    models (trees/hammocks/potties already pooled), so the risk is the *connector
    path mesh* if it is a new geometry. And do not reflexively `castShadow` the path
    or buffer props (`CLAUDE.md` tripwire #9). **Seam count per chunk neighborhood is
    bounded**: `seamPairsNear` over `SEAM_PAIR_REACH=420` (`festival.js:265`) at
    `HEART_CELL=200` yields ~a few pairs per region, and only conflicting ones emit —
    so steady-state draw cost is small, but verify the backtick panel at `?perf=low`
    (80 draws / 150k tris) anyway since buffers cluster geometry at the densest seams.

### Verdict

-   **Verdict**: Proceed with mitigations.
-   **Key Concern**: The architecture decision (Q6). The seam RESPONSE must be a
    pure, non-recursive function of (seed, the two heart cells) — emitted such that
    `festivalPlan(A)` is identical whether or not B has been planned. If 4B.3 makes
    `festivalPlan` call neighbours' full `_computePlan` to decide its trim, it
    re-derives the 8s/stack-overflow dead end (`session-log.md:422-427`) AND
    re-introduces the load-order asymmetry the band-aids already exhibit
    (`chunks.js:1170-1172`). Everything else is mitigable; this one is fatal if got wrong.
-   **Recommendation**: Lock the response as a pure per-heart computation over the
    `seamPairsNear` + `getHubPriority` substrate (never a neighbour-plan recursion);
    integerize the trim-length/booth-count existence test before it gates a row
    (Vuln 3/4); prove a band-aid-output superset across the 10 baseline seeds BEFORE
    removing `neighbourCourtHere`/`stageDeckClips` in the same golden-move commit
    (Vuln 5/7); and treat the re-recorded golden as a node==browser check, NOT a
    correctness check — the correctness gate is the superset diff plus Gary's pinned-seed
    playtest. Keep the band-aids and the response co-committed so rollback is one revert.
