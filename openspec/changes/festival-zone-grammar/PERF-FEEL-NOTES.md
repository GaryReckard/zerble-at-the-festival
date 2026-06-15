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
