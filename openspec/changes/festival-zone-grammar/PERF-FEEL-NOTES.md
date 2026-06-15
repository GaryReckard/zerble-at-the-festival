# Perf + feel notes — festival-zone-grammar (for the dedicated post-v2 perf pass)

> Running scratchpad of observations made WHILE building the seam grammar. Not tasks —
> raw notes for Gary's dedicated performance/feel pass once v2 is wrapped + working.
> Newest at the bottom.

## Seam grammar (Group 4B)

- **`soft_buffer` suppression volume is HIGH and needs a feel call (4B.3b).** The 4B.3a
  dark-emit probe shows ~40–43 `soft_buffer` responses per ±700m window (vs ~32 merged_court,
  ~1 trim) on every baseline seed — and the bare slice resolves each by SUPPRESSING the quieter
  front. At 200m hub density a stage's ~75m thr (deck+dancefloor extent + food_court extent +
  margin) reaches a neighbour's food court/vendor front constantly, so soft_buffer fires a lot.
  Suppressing all of them removes ~38% of festival zones in a window — risks the "gutted festival"
  failure the reverted senior-keep-out hit. **Decision deferred to 4B.3b (needs the 4B.0 visual
  overlay):** options are (a) tighten the soft_buffer existence thr so only true clips fire,
  (b) NUDGE the quieter zone outward instead of deleting (the slotter already walks zones out
  within a hub — extend cross-hub), or (c) treat soft_buffer as dress-only (4B.7 trees fill the
  gap, no removal) since a food-court-near-a-stage isn't a hard clip like two food courts. merge
  (food+food, ~32) and yield (drum vs stage, ~1–3) are clearly correct as suppress; soft_buffer
  is the one to rethink. NOTE this is perf-POSITIVE (suppression net-reduces draws) but feel-risky.

- **Seam-pass cold cost ~2.8s (deliberation 002, Profiler).** `classifySeamsNear`/`seamResponsesNear`
  warm ~60 neighbour `festivalPlan`s (~47ms each cold) on first touch of a fresh region — a
  synchronous chunk-gen stall in BOTH candidate architectures (it's in the shared substrate). When
  4B.3b wires this into chunks.js, the mitigation is: frame-spread first-touch warming within the
  1-chunk/frame budget + a proven-SUPERSET integer pre-filter before the festivalPlan fan-out
  (tighten SEAM_PAIR_REACH 420 → closer to the real ~190m reach). seam-lite plan PARKED (determinism
  trap). This is allocation cost (spawn stall), not steady-state — matches the perf.md model.

- **merge/trim/yield NET-REDUCE draws** (Profiler: merge −16, trim −~30, yield −whole cluster);
  only soft_buffer GEOMETRY (4B.7, deferred) ADDS (~+24 draws on the one host chunk per seam). So
  the seam grammar is net perf-positive worldwide; the one chunk to watch on the HUD is a
  soft_buffer-midpoint host at `?perf=low`.

## ⚠️ #1 PERF-PASS ITEM — seamed-festivalPlan cold chunk-gen stall (4B.3b, MEASURED)

- **Symptom (in-game boot `?worldgen=1`):** first chunk (0,0) took **13s** to generate; chunks
  reaching into fresh territory 1–2s; warmed chunks 24–32ms (fine). The `[chunk slow]` console
  warnings are the tell. No JS errors — purely a stall, and it's on a FLAG-OFF feature, so it's
  perf-debt, NOT a ship blocker — but it IS a hard prerequisite before the `DEFAULT_WORLDGEN_V2`
  flip, and it makes interim 4B testing/playtest painful.
- **Root cause:** the seamed `festivalPlan(H)` must read every neighbour hub's seam-blind BASE
  plan within `SEAM_PAIR_REACH` to decide H's suppressions. Base plans (`_computePlan`) are the
  pre-existing expensive slotter (`approachRoadsOf`/`nearestRoad`-dominated, ~tens-to-170ms cold).
  Cross-hub seams INHERENTLY need neighbour plans, so the spawn warms ~dozens of base plans
  synchronously on the chunk-gen critical path. Memoized after → steady-state is fine; the cost is
  the one-time cold first-touch per region.
- **Done now (cheap, golden-preserving):** `SEAM_PAIR_REACH` 420 → 300 (empirical max real clip =
  259m across 5 seeds; 420 warmed ~2× the hearts for zero extra clips). ~50% less warming.
- **NOT a lever (verified):** a "heart-restricted" seam pass (classify only H's pairs) does NOT
  help — both versions warm the same neighbour base plans (memoized once); classify is µs. Reach is
  the only knob on the warming set.
- **The real fix (perf pass):** (a) FRAME-SPREAD the neighbour base-plan warming off the chunk-gen
  critical path (warm a few per frame within the 1-chunk/frame budget — the result is identical so
  golden-safe; the deliberation's prescription); and/or (b) make `_computePlan`/`approachRoadsOf`
  cheaper (cache nearestRoad per heart; it's ~215µs×many per plan). (c) consider a coarse
  region-level seam-response cache so neighbouring hearts don't re-enumerate overlapping windows
  (saves classify, not warming — secondary). Target: spawn < ~1s, no >100ms chunk stalls.
- **Selftest cost:** the POI-golden selftest went 145s → ~340s because every one of ~855 box
  hearts now resolves seams (overlapping windows re-classify). Dev-diagnostic only (not game perf),
  but if it annoys, the region-level seam cache (c) would cut it. The golden capture is a rare op.

- **⚠️ The seamed plan also BLOCKS the burndown tooling (escalated 2026-06-15).** `bin/lint` over a
  single seed now exceeds 40s (was fast) because plan-mode lint walks every heart's seamed
  `festivalPlan`. So **Group 6's 10-seed lint sweep is effectively blocked until the plan cost is
  addressed** — the perf pass is no longer just a gameplay-polish item, it gates the change's own
  verification + iteration loop (lint, selftest, map-sandbox self-test all slowed). RECOMMENDATION:
  pull a TARGETED plan-cost fix forward (the region-level seam-response cache (c) so overlapping
  per-heart windows don't re-classify, + a `nearestRoad`-per-heart cache to cut the base-plan ~215µs
  hot spot) BEFORE the rest of the burndown/arrival iteration — otherwise every verify step is
  multi-minute. This is the strongest argument that the "perf pass after everything" ordering should
  become "cheap plan-cost fix next, full perf pass before flag flip."
