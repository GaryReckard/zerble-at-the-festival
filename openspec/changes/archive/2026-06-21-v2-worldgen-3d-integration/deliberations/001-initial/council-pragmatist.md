## The Pragmatist's Position

My lens: fastest path to a **bootable, visibly-worldgen-driven game**, sequenced so
that an autonomous multi-session run (HANDOFF + compact at ~75%) survives interruption
with something shippable already on disk. I care about the critical path, the biggest
visible win earliest, what reuses the existing harness/pools, and what is genuinely
parkable.

### Critical Path

The longest *hard* dependency chain to "a working new world map" is short, and it is
**not** the 11-group order as written. The true critical path is:

1. **Scaffolding** (CG3: flag + importmap-in-both-html + `placement.js` skeleton + seed
   routing confirmed). Nothing player-visible can land until the flag exists and every
   `src/worldgen/*` module is in the `mods` array of BOTH `index.html` and `sandbox.html`
   (proposal.md:42-43, the no-build tripwire). This is the gate for everything.
2. **Roads** (CG4) — the chunk-clipped arterial ribbons. This is the *single biggest
   visible win* and it is what proves the whole D-A sampler model (`queryRegion` over the
   chunk AABB → place clipped polylines). It replaces `placePaths` at `chunks.js:436`. The
   moment a player drives down a real arterial instead of the rigid `+`-grid, "the festival
   reads like a place" (proposal.md:6-12) is *demonstrated*, not promised.
3. **Themes/props** (CG7) — placement.js drives anchors + scatter. This is what
   structurally kills stages-on-roads via `noBuild` (spec worldgen-3d-world, "No structures
   on roads or in water"). It's the headline correctness win.

Lakes (CG5), Forests (CG6), and Crowd (CG8) hang **off** that spine but do not block it —
they are independently shippable slices behind the same flag. Determinism/perf gate (CG9),
review (CG10), docs (CG11) are the closing sequence.

The junction-merge (CG1) is **NOT on the critical path to a bootable v2 world.** See the
hazard section — I'd reorder it.

### Priority Sequence

1. **CG3 Scaffolding first (flag + dual importmap + placement.js skeleton + seed-route
   confirm).** This is the force multiplier: one task that unblocks all five content
   slices. The boot smoke test in 3.4 (flag ON renders *something* or no-ops cleanly; flag
   OFF = today's world) must pass before any content lands. Concretely: with the flag ON
   but no placement wired, `chunks._generate` (chunks.js:403) should early-return or place
   nothing rather than crash — get the game booting clean in *both* flag states before
   touching content. That state is a safe HANDOFF point.

2. **CG4 Roads — the biggest visible win, ship it second.** Replacing the `+`-grid
   (`placePaths`, chunks.js:606) with chunk-clipped arterials is the clearest "this is a new
   world" screenshot and it exercises the entire D-A sampler contract (`queryRegion` for the
   AABB, clip polylines to the cell, reuse `buildCurvedPath` + the shared dirt material per
   D-D). Verify in BOTH surfaces: `map-sandbox.html` confirms the arterial geometry is
   right in 2D, then the running game confirms the 3D ribbon + the seam join (D-D's
   no-kink claim is the thing to prove with a screenshot straddling a chunk boundary). Roads
   are passable (no collider) so there's zero collision-regression surface here — low risk,
   high visible payoff.

3. **CG7 Themes/props — placement.js drives anchors + scatter.** This delivers the
   correctness headline (stages no longer on roads, nothing in water). Sequence it third,
   not sixth, because it's where the *point* of the change lives, and because it shares the
   exact return-shape footgun the briefing flags (briefing:86, the `{group,...}` vs `Group`
   crash). Wire and verify in the sandbox per-entity FIRST (anchors are existing models —
   `buildStage`, `buildFoodTruck` etc. — so they already have sandbox entries), then boot
   the game and watch `buildWorld → ChunkManager.update → _generate → placement` (the
   longest call chain, briefing:84-86). This is the highest crash-risk group; do it while
   context is freshest, not at hour 6.

4. **CG5 Lakes — swap placement source only (D-E).** Minimal blast radius
   (proposal.md:106): LakeManager keeps mesh/colliders/beaches/lifecycle, only reads
   `lakesInBounds` instead of its own macrocell rng. Sequence after roads/props because
   it's lower-visible-impact and the lake-feel tuning (1050m lobed vs 320m round) is
   eyeball work that can iterate without blocking anything. The one must-verify: the
   no-chunkKey invariant (task 5.2, footgun #5) — a lake collider that picks up a chunkKey
   vanishes mid-drive.

5. **CG6 Forests — per-chunk treeDensity scatter (D-F).** Reuses `models/tree.js` pools
   entirely (proposal.md:108-114), so it's model-free work — just placement + count math.
   The real risk is perf (tree count × density, task 6.3), not correctness. Sequence here
   because it's the easiest slice to *defer the polish on* (see Deferred) while still
   shipping a baseline scatter.

6. **CG8 Crowd weighting + road attraction.** Contract is unchanged (proposal.md:35) — only
   counts and the path-attraction source change. Pure tuning. Genuinely deferrable to a
   baseline (see Deferred).

7. **CG1 Junction-merge (2D-first), folded in HERE or parked.** Moved DOWN from position 1.
   It's a 2D-sandbox-only refinement (D-I) that the 3D road renderer *can* consume but does
   not *require* to ship a coherent world. Tackle it after the 3D spine is proven, or park
   the polish entirely (see Deferred). Doing it first spends the freshest context-budget on
   the one piece that produces zero in-game pixels.

8. **CG9 Determinism + cross-engine + perf gate**, then **CG10 verify/review**, then
   **CG11 docs**. Standard closing sequence. CHANGELOG travels with each content commit
   (same-commit discipline, changelog-and-roadmap.md), not batched at the end.

**CG2 (run /deliberate)** is this exercise — it's complete when this council reports.

### Deferred / Park on ROADMAP

These are the things the plan can ship a *baseline* of and defer the polish, OR cut
entirely from this change without blocking "a working new world map":

- **Junction-merge polish / the "lens" fix (CG1, D-I):** Can wait. The lens is a *2D
  cosmetic redundancy* (two near-parallel roads into one heart). Shipping the 3D world with
  raw per-edge arterials produces a fully coherent, drivable, structured world — the lens is
  a "that road's a bit redundant" nitpick, not a "the world is broken" defect. NOT blocked
  by deferring it: roads still render, seams still join, crowd still drifts. **Recommendation:
  ship 3D v2 with raw arterials; land junction-merge as a fast-follow** (it's pure 2D
  generator work + a sandbox viz, verifiable entirely in `map-sandbox.html` with the
  seed-1234 screenshot, task 1.3 — no game-boot dependency). The append-only contract field
  it would add (`queryRegion` returning merged roads, index.js:82-87) is the only thing the
  3D consumer needs, and that can be a no-op passthrough until the merge pass exists.

- **Forest-interior POIs / "drum-circle nested in dense forest" (task 6.2, D-F):** Park the
  re-homing. Baseline treeDensity scatter delivers forests; the nested-POI is a discovery
  Easter-egg-grade nicety. Not blocked: forests still render, density still reads. Re-home it
  as a fast-follow once the scatter baseline is proven. (Assumption A2 in design.md already
  flags forest feature-parity as a known trade-off.)

- **Crowd road-attraction tuning (task 8.2):** Ship baseline heart-influence weighting (8.1)
  — that's the visible "more people near hearts" win. The continuous-road attraction *tuning*
  (8.2, weight balancing vs heart dominance) is iteration that can A/B post-ship. Not blocked:
  NPCs still spawn and cluster at hearts with just 8.1.

- **Lake-feel tuning (task 5.3, the 1050m-lobed vs 320m trade-off):** The *swap* (5.1) must
  ship; the by-eye CONFIG tuning is iteration that doesn't block boot. Park aggressive tuning
  to a fast-follow A/B against `?worldgen=0`.

- **Old-path code removal:** Explicitly a Non-Goal of this change (design.md:59-60) — the old
  `THEME_BUILDERS`/`forests.js`/`lakes.js` placement stays behind the flag, retired in a
  follow-up once v2 is proven in production. Don't let "boil the ocean" pull cleanup into this
  change; the flag's whole job (D-G) is to make that deferral safe.

Everything else — scaffolding, roads, the noBuild/facing correctness, lake/forest placement
swap, baseline crowd weighting, the perf gate, the boot smoke tests — is **must-ship** for an
honest "working new world map."

### Incremental Delivery Plan

Each slice ends **bootable behind the flag** and is a clean HANDOFF point. Migration plan
(design.md:162-175) is right that each phase ends bootable; I'm reordering it so the
visible win lands earlier and the no-pixels work parks.

- **Slice 0 (the gate — ship first):** CG3 scaffolding. Flag + dual-importmap + placement.js
  skeleton + seed-route confirm. **Verify:** `?worldgen=1` boots clean (placeholder/no-op
  content is fine), `?worldgen=0` is byte-for-byte today's world. This is the cheapest
  possible HANDOFF-safe checkpoint and it unblocks everything. Boot smoke test (title → start
  → 2.5s → `preview_console_logs` clean) in both flag states.

- **Slice 1 (biggest visible win — ship second):** CG4 roads. Chunk-clipped arterials replace
  the `+`-grid. **Enables:** the first real "new world" screenshot; proves the D-A sampler
  end-to-end. **Verify:** `map-sandbox.html` for the 2D arterial network, then the running
  game for the 3D ribbon + a screenshot straddling a chunk seam (proves D-D no-kink), at
  `?perf=low` and `?perf=mid` for draws/tris in the HUD. Depends on Slice 0.

- **Slice 2 (the correctness headline — ship third):** CG7 placement.js anchors + scatter.
  **Enables:** stages-off-roads, nothing-in-water (the *reason* for the change). **Verify:**
  anchors in `sandbox.html` per-entity first, then game boot watching the placement call
  chain; A/B vs `?worldgen=0`; HUD budget; watch the return-shape footgun (briefing:86).
  Depends on Slice 0; reads roads from Slice 1 for `facing`.

- **Slice 3 (placement swaps — ship after the spine):** CG5 lakes, then CG6 forests. Each
  independently bootable; lakes verify the no-chunkKey invariant, forests verify the perf
  budget under tree-count×density. Both reuse existing pools/models (no new sandbox entries
  needed unless a new mesh appears). Depend on Slice 0; independent of each other.

- **Slice 4 (tuning + close — ship last):** CG8 baseline crowd weighting; CG9 determinism +
  golden re-check + full per-tier perf gate; CG10 verify/review; CG11 docs/CHANGELOG/ROADMAP/
  ARCHITECTURE/HANDOFF.

- **Fast-follow (separate change, post-v2-proven):** junction-merge polish (CG1, 2D-only),
  forest-interior POI re-home, lake-feel + crowd-road-attraction tuning, old-path removal.

### Delivery Risks / Sequencing Hazards

1. **The 11-group order front-loads the no-pixels work (CG1 junction-merge) at position 1 —
   not the fastest safe path.** CG1 is a 2D-sandbox-only generator refinement (D-I,
   tasks.md:1-6) that produces zero in-game pixels and zero progress toward "bootable v2
   world." Spending the freshest session context on it, before the flag/scaffold even exists,
   risks burning the first compaction window on a deferrable nicety. **Mitigation:** reorder —
   scaffold first, roads second; do junction-merge after the 3D spine is proven, or park it as
   a fast-follow. The only coupling is the append-only `queryRegion` road field, which can ship
   as a no-op passthrough.

2. **The biggest-visible-win is CG4 roads, and it should land as early as the gate allows.**
   The proposal's "the festival never reads like a *place*" (proposal.md:5-7) is *fixed
   visibly* the moment arterials replace the `+`-grid. Anchors (CG7) make it *correct*; roads
   make it *look* like the new world. Landing a visible win by Slice 1 de-risks the whole
   autonomous run — if something derails at hour 4, there's already a shippable "new roads"
   screenshot on disk behind the flag.

3. **CG7 (placement) is the highest crash-risk group and it sits at position 6 in the
   plan.** The briefing explicitly names the return-shape footgun (briefing:86): a prior
   change crashed in exactly this call chain on `{group,...}` vs `Group`. The longest, bug-
   hiding call chain (`buildWorld → _generate → placement`, briefing:84) runs only when the
   real game boots, not in the sandbox (sandbox-and-testing.md). **Mitigation:** do CG7 *third*,
   while context is freshest, and make the per-chunk `_generate` placement path defensive
   about model return shapes from the start. Boot the game (not just the sandbox) on every
   placement commit.

4. **The feature flag (D-G) earns its keep — keep it; don't let it rot into dual-running
   debt.** For a *world-regenerating break* observed by real players (CLAUDE.md: production
   is observed), an instant `?worldgen=0` rollback is exactly the right insurance, and it's
   what makes every slice independently shippable. WHERE it adds overhead: the flag must gate
   `chunks.js` content-selection AND `lakes.js` placement source (D-G), so there are two
   branch points to keep honest, and the old `THEME_BUILDERS`/`forests`/`lakes-placement` code
   stays live behind it for the duration. That's acceptable *if* old-path removal is a real
   tracked follow-up (it is — design.md:59-60) and not a forever-fork. **Hazard to watch:** the
   flag check must be cheap and read once per chunk, not per-placement-point, or it becomes
   per-frame branch noise. Worth confirming `USE_WORLDGEN_V2` is resolved once at module load
   (const + `?worldgen=0` override, task 3.1), not re-parsed.

5. **Lakes-first boot order is load-bearing and must survive the placement-source swap.**
   `world.js:59-64` runs `lakeManager.update()` BEFORE `chunkManager.update()` specifically so
   chunks can see lake footprints (design.md:32-34). CG5 swaps the lake placement source to
   worldgen. **Hazard:** if `lakesInBounds` (worldgen) and the chunk's `queryPoint(...).inLake`
   ever disagree at a boundary, a chunk could place a structure in water the lake manager
   thinks is dry (or vice versa). Both read the same generator, so they *should* agree — but
   the cross-engine `sin/cos` divergence (footgun, briefing:76; design.md risk) is exactly the
   kind of thing that flips a shore boundary. **Mitigation:** the design's own guard (task 9.2:
   integer orientation test if it flips a *collider's* existence, not just cosmetic shore
   wobble) is the right call — make sure that check runs as part of CG9, not skipped.

6. **iOS audio gesture chain is brushed by boot-order changes (CG3).** `Sound.init()` must
   stay synchronous inside the start gesture, no async hop before it (CLAUDE.md tripwire #3,
   briefing:73). The scaffolding work touches `world.js` boot order. **Mitigation:** the
   worldgen sampler is synchronous (it's pure math over `queryPoint`/`queryRegion`), so there's
   no reason to introduce an `await` — but the boot-order task (3.4) must explicitly NOT insert
   one between the title tap and `Sound.init()`. Cheap to verify on a real mobile browser once.

7. **Frame-stall on heart-anchor chunk load (design.md:148-150).** D-C puts the whole anchor
   (main/side stage + court + arch) on one chunk's frame. The 1-chunk/frame budget
   (chunks.js:292-316) means that one chunk can be heavy. Design says anchors are ~1 per ≥440m
   so they're rare. **This is a real but bounded risk** — accept minor first-load stalls
   (existing behavior), and only split the anchor build across frames if the HUD shows a stall.
   Don't pre-optimize it (performance.md: don't optimize before you measure). Parkable as a
   tuning follow-up if it doesn't show.

8. **Determinism gate is non-negotiable but should not block the visible slices from
   landing.** The self-test staying 20/20 green (task 9.1) and the golden re-check (9.2) are
   real gates, but they gate the *junction-merge* (which changes generator logic) more than the
   *3D consumption* (which only reads the contract). **Sequencing win:** because the 3D wire-in
   doesn't change worldgen logic (D-H: WHAT comes from the unchanged generator; only per-chunk
   scatter jitter uses fresh salts), the self-test stays green by construction through Slices
   1-3. The golden only genuinely moves when CG1's junction pass changes `roads.js`. This
   *reinforces* deferring CG1: keep the determinism-affecting work in one isolated, late slice.

### Verdict

- **Verdict**: **Proceed with mitigations**
- **Key Concern**: The 11-group task order front-loads the one piece that produces no in-game
  pixels (CG1 junction-merge, a 2D-sandbox-only refinement) and back-loads the biggest visible
  win (CG4 roads) and the highest crash-risk group (CG7 placement) to positions 4 and 6.
  Reorder to: scaffold → roads → placement → lake/forest swaps → crowd/perf/docs, and **defer
  the junction-merge to a fast-follow** so the freshest context lands a bootable, visibly-new
  world early and the autonomous run is resilient to mid-stream compaction.
- **Recommendation**: The architecture is sound and the flag (D-G) is the right insurance for a
  world-regenerating break observed by real players. The fastest *safe* path is to treat
  scaffolding as the single force-multiplier gate, ship roads as the first visible proof of the
  D-A sampler, land the noBuild/facing correctness next while context is freshest (it's the
  crash-prone, point-of-the-change group), and park the genuinely-deferrable polish
  (junction-merge, forest POIs, crowd/lake tuning, old-path removal) as fast-follows. Every
  slice ends bootable behind the flag with a CHANGELOG entry traveling in the same commit — that
  cadence is what makes a multi-session autonomous run survivable.
