## Adversary's Position

I read the plan against the code. The plan is unusually well-armored — the
harness deliberation already absorbed my findings 1–4 (D-C′) and built the
exact instruments (snapshot diff + draw-count canary + node==browser re-verify)
that defuse the worst determinism risks. So this is not a Block. But the plan
makes several *load-bearing assumptions about engine reality* that the code only
partly supports, and the failure modes are silent — a passed gate that still
shipped a desync, or a sandbox-green hub that crashes the streaming game. Below
is where it breaks.

### Priority Sequence

1. **Precondition 0.1 is a hard gate, and it is currently failing.** The
   briefing and `tasks.md:14-16` say "confirm `bin/lint
   verification/snapshots/baseline/<seed>.json` matches baseline.md" and the
   proposal pins `verification/baseline.md` as the measuring stick
   (proposal.md:3, design.md:6). **That file does not exist on this branch.** I
   searched `openspec/` — there is no `baseline.md` and no
   `verification/snapshots/` under `worldgen-layout-harness`
   (`ls worldgen-layout-harness/` shows only deliberations/ reviews/ specs/ +
   the artifact md files; no `verification/`). The harness change is cited as
   "complete" but its data spine is not in the tree this council can see. **Do
   group 0 for real before anything else** — if the "before" is not
   reproducible, every "diff EMPTY" claim in groups 1–4 is unfalsifiable and the
   burndown-to-zero in group 6 has no denominator. This is the single thing that
   could quietly invalidate the whole gate.

2. **Crowd pre-roll (group 2) BEFORE the extraction it claims to enable, or
   accept that group 1's "diff EMPTY" is a lie on the stage builder.** See
   Vulnerability 1 — the order in `tasks.md` (1.4 buildStage split, *then* 2.1
   crowd pre-roll) cannot both move the golden zero times AND remove the
   tier-dependence. Resolve the sequencing explicitly.

3. **Extraction, easy→hard, one builder per commit, each snapshot-EMPTY-gated**
   (group 1) — agreed with D1, with the caveats below on the variable-draw
   builders.

4. **True extents read-only (group 3)** before slotting consumes them (group 4)
   — agreed; extents-not-yet-consumed keeps the golden frozen.

5. **The single golden move (group 4), then registry backstop (group 5), then
   burndown (group 6)** — agreed. But verify the `path_node`/scenery-exclusion
   assumption (Vulnerability 4) is true *before* relying on spur records being
   golden-neutral.

6. **Boot the real game at both flags and both tiers (group 7) is not the last
   step — it is a gate after EVERY commit that touches `chunks.js`.** Sandbox-
   pass ≠ game-pass is a named tripwire and this change rewrites the longest call
   chain in the repo.

### Vulnerabilities Found

-   **[Crowd's variable draw count makes "pre-roll into records" a draw-order
    change, not a transcription]** — `crowd.spawn` (`crowd.js:338-381`) does NOT
    draw a fixed number of `rng()` per NPC. It draws a `for (let tries = 0;
    tries < 4; tries++)` retry loop (`crowd.js:377-379`) that consumes 1–4
    extra draws *conditioned on a color self-match*, gated behind a
    `rng() < TIE_DYE_FRACTION` branch (line 373), and it `return null` with
    ZERO draws when the pool is exhausted (line 339). So the number of cluster-
    rng draws a stage's audience consumes depends on (a) tie-dye outcomes, (b)
    color collisions, and (c) how full the pool already was. D2's promise that
    `buildMesh` "consumes pre-rolled params without drawing" means the pre-roll
    half must reproduce that *exact variable draw sequence* in `layout()`, or the
    cluster stream desyncs for every draw after the crowd. This is not a clean
    "count + per-NPC seed" pre-roll as `tasks.md:2.1` implies — per-NPC seed
    isolates the NPC's internal randomness but does NOT preserve how many draws
    were taken from the *cluster* stream. **The only golden-frozen way to
    extract buildStage (1.4) is to first land the crowd change (2.1) so the
    cluster stream no longer feeds `crowd.spawn` at all.** As written, 1.4
    "diff EMPTY incl. canary" and 2.1 "tier-dependence gone" are mutually
    exclusive in that order. — Severity: **High**

-   **[buildStage interleaves `Math.random()` and `ctx.rng()` across the crowd
    call — the transcribe trap is worse than it looks]** — At
    `chunks.js:2463-2464`, `buildStage` draws `Math.random()` for audience `u`/`v`
    jitter, then *immediately* at line 2466 calls `ctx.crowd.spawn({ rng:
    ctx.rng })` inside the same `for` loop, then after the loop draws
    `ctx.rng()` again for clump count (line 2489). The D-C′ trap (transcribe
    `Math.random()` as-is, never fold into the seeded stream — `tasks.md:1.4`)
    is correctly flagged, but the *interleaving* means an extractor splitting
    this into pure-layout / mesh must preserve: Math.random draws stay in the
    mesh half (they're cosmetic, non-deterministic by design), while the
    `ctx.rng()` draws move to layout — and the crowd draws (variable, per above)
    sit *between* them. Get the partition wrong by one draw and the canary
    catches the count but a human still has to reason about three interleaved
    streams to fix it. This is the single highest-risk builder; it deserves its
    own commit and its own careful before/after draw-count table, not a shared
    "groups 1.4 + 1.5" pass. — Severity: **High**

-   **[The existing planner already has conditional/variable-count rng draws
    that the slotting rewrite must account for — the golden move is bigger than
    "scatter → slot"]** — `festival.js` is not a fixed-draw planner today.
    `nudgeOff` (`festival.js:252-263`) early-returns with **0 draws** when a
    spot is already off-road, and ring-scans (consuming `rng()` only for the
    base angle, then deterministic) otherwise. `treedDistrictSpot`
    (`festival.js:272-300`) loops up to 12 times drawing 2 `rng()` per attempt
    and `break`s early on a treed hit — a *variable* count — and the code
    comment at lines 296-300 explicitly states the drum is placed LAST
    "because a variable final [draw count]" would desync anything after it.
    The slotting rewrite (group 4) deletes `resolveOverlaps` and these nudge
    paths and replaces them with zone tests. That is fine — the golden moves
    once by design — BUT the re-record (4.2) must be done with full awareness
    that the OLD stream had data-dependent draw counts, so "node==browser on the
    new poi hash" only proves the *new* planner is cross-engine stable; it does
    NOT prove the new planner is a superset/subset of the old behavior. There is
    no automated check that the golden move didn't *also* silently change which
    hubs get a drum circle vs. omit one. Mitigation: capture a before/after POI
    *inventory* (per-seed kind counts), not just the hash, so the deliberate
    move is auditable beyond "it changed." — Severity: **Medium**

-   **[Spur-roads-as-cosmetic-path-records: the claim that they don't touch the
    queryPoint golden is TRUE only if the planner emits them as a kind the lint
    overlap rule excludes AND the builder doesn't register them as colliders]** —
    Design D4.3 / risk register say spur roads + drum access paths are
    "cosmetic path records … NOT new arterials in roads.js" so `queryPoint`
    stays frozen. I verified `queryPoint` lives in `index.js` and is driven by
    `roads.js` (`nearestRoad`, `roadAt`) — `festival.js` only *reads* it
    (`festival.js:47`), so as long as the spur records never flow into
    `roads.js`, the road-existence golden is genuinely untouched. The subtle
    part: the lint `overlap` rule excludes `SCENERY_KINDS`, which already
    contains `'path_node'` (`lint.js:295`). So spur/access records emitted as
    `path_node`-family kinds will be invisible to `overlap` — good for not
    tripping the linter, but it also means a spur path that physically crosses a
    truck ring will NOT be flagged. The assumption "cosmetic = harmless" hides a
    real failure: a drum access path the planner believes is "drivable" but that
    clips a tent, because the path record is extent-exempt. **The access-path
    drivability claim (D4.4: "wide enough to drive in") is unverified by any
    error-severity rule.** If the path record carries a collider, it can also
    surprise the registry backstop (D5) into skipping legitimate placements.
    Decide explicitly: do path records carry colliders (then they ARE layout and
    need an extent check) or not (then nothing guarantees they're drivable, and
    `truck-off-road`/spur interplay needs a rule). — Severity: **Medium**

-   **[Sandbox-pass / game-crash: hub-sandbox builds the whole hub at once;
    the streaming game builds it spread across chunks with a SHARED, partially-
    drained crowd pool]** — `buildHubPreview` (`chunks.js:1248`) is explicit
    that a *fresh* crowd matches a *fresh* hub load, and that where the game's
    pool was "already drained by neighbours, the diff is explainable"
    (`chunks.js:1238-1242`). After the crowd pre-roll change (group 2), this
    explainability assumption shifts: if pre-rolled crowd params are baked into
    layout records, the hub viewer and the game *should* finally agree
    regardless of pool state (that's the whole point of D2). But the 6.3
    acceptance test (diff hub-sandbox vs game `dumpRegistry`) is the ONLY thing
    that proves it, and the game path crosses chunk boundaries the viewer never
    exercises. The named historical failure (camp-chair clump: sandbox used a
    different constructor path, `buildCampChair` returns `{group,color,footprint}`
    not a Group, game crashed at world-gen) is exactly the class of bug the
    layout/mesh split reintroduces risk for — every builder now has TWO entry
    shapes (records → mesh) and the sandbox case may exercise only one. **Mandate
    the full boot (group 7's checklist) after every `chunks.js`-touching commit
    in groups 1, 4, 5 — not just at the end.** A boot-time `TypeError` in
    `buildWorldgenKind → buildMesh` hangs the title card and is worse than any
    layout bug. — Severity: **High**

-   **[Lifecycle/disposal in the split: the mesh half owns `userData.shared`
    tagging and the by-key unload walk — the records half must not strand it]** —
    Tripwire #6 + the harness D-E teardown design require that pooled resources
    stay tagged `userData.shared = true` and that `disposeChunkByKey` skips them.
    The layout/mesh split moves the *layout* decisions out of the builder but
    leaves geometry/material creation in `buildMesh`. Risk: a refactor that
    hoists a per-record helper accidentally creates a NEW pooled material/geometry
    that nobody tags shared, and the first chunk unload after that cluster
    disposes it → shader recompile storm (silent, shows as ~200ms periodic
    stalls, not a crash — `.claude/rules/performance.md`). The plan mentions this
    (design.md:126-127) but as a one-liner. Add an explicit per-builder check in
    groups 1/5: enumerate the pooled resources each builder touches and confirm
    the tag survives the split. The draw-count canary will NOT catch this — it's
    a disposal-time bug, not a generation-time one. — Severity: **Medium**

-   **[Zone-omit graceful degradation can NaN nothing but can starve a hub into
    "boots clean, reads empty" — and the game-path consumer of an omitted zone
    must tolerate the gap]** — D4 says a zone that can't fit is OMITTED, not
    nudged. Good for clipping; but every downstream consumer (crowd attractors
    keyed to `stage_front`, the arch-as-threshold `spawn-arrival` rule, potties
    "attached to a parent zone" — D4.5) assumes its parent exists. If the stage
    omits (it shouldn't, it's index 0/anchor — `resolveOverlaps` comment
    `festival.js:326-328` calls index 0 the never-moving anchor) the whole hub
    is incoherent; if a vendor row omits, its "camps auto-reserved behind" and
    any potty attached to it must also drop, or you get an orphaned potty bank
    floating where its parent isn't. There is no NaN risk (omit = absent, not
    stub input to `zerble.update`), but there IS a "potty attached to nothing"
    correctness gap. The `potty-attached` warn rule (`lint.js`, severity warn)
    will catch the orphan AFTER the fact in registry mode — verify the slotting
    code drops dependents transactionally rather than relying on the linter to
    notice. — Severity: **Low**

-   **[The leaf-layer import rule + injected env must hold under the new env
    fields]** — Constraint: `src/worldgen/*` must NOT import
    chunks/registry/lakes/models; water/blocked arrive via `env = {waterAt,
    blockedAt}`. `festival.js` today imports `lakeAt` from `./water.js`,
    `treeDensity` from `./density.js`, `queryPoint` from `./index.js`
    (`festival.js:47-51`) — all *within* the worldgen leaf, which is legal. The
    plan widens the dry-run env to `{waterAt, blockedAt}` (group 2.2,
    grep-clean done-criterion). The risk is the inverse: a slotting rewrite that
    needs `registry.closestBuilding` (D5 backstop) is correctly placed in the
    *mesh* half (chunks.js), NOT the planner — design D5 says this explicitly
    (design.md:100-102). Confirm during group 4 that no zone-fit test in
    `festival.js` reaches for the live registry; if it does, the leaf rule
    breaks and `bin/check-importmaps` won't catch it (it checks importmaps, not
    import-direction). The grep in 2.2 is the only guard — make it part of the
    group-4 done-criterion too, not just group 2. — Severity: **Low**

### Verdict

-   **Verdict**: **Proceed with mitigations**
-   **Key Concern**: The crowd's *variable* cluster-rng draw count
    (`crowd.js:377-379` retry loop + `:339` zero-draw early return) means the
    buildStage extraction (`tasks.md:1.4`) and the crowd pre-roll
    (`tasks.md:2.1`) cannot both keep the golden frozen in the order listed.
    Land the crowd change first (or in the same commit as the stage split), and
    do buildStage as its own isolated commit with an explicit before/after draw-
    count table — the canary will tell you it broke, but only the ordering fix
    prevents it.
-   **Recommendation**: The plan correctly internalized the determinism
    instrumentation (this is why it's not a Block). Required mitigations before
    apply: (1) **Make group 0 real** — `verification/baseline.md` and its
    snapshots are not in the tree; reproduce the "before" or the entire gate is
    unfalsifiable. (2) **Re-sequence crowd-pre-roll vs buildStage-split** so the
    cluster stream stops feeding the variable-draw `crowd.spawn` before (or as)
    the stage builder is split. (3) **Capture a per-seed POI kind *inventory*
    across the golden move (4.2), not just the hash**, so "it changed
    deliberately" is auditable. (4) **Decide whether spur/access path records
    carry colliders** and add an error-severity drivability/clearance check if
    they're meant to be drivable — "cosmetic = exempt from `overlap`" currently
    hides a real clip. (5) **Boot the real game at both flags / both tiers after
    every `chunks.js`-touching commit**, not only at group 7 — the two-entry-
    shape (records → mesh) split is exactly the sandbox-pass/game-crash signature
    that bit the camp-chair builder. (6) **Per-builder `userData.shared` audit**
    in the split — the draw-count canary cannot see disposal-time recompile
    storms.
