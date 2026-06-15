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

## ✅ #1 PERF-PASS ITEM — seamed-festivalPlan cold chunk-gen stall (4B.3b → LARGELY RESOLVED 2026-06-15)

- **Symptom (in-game boot `?worldgen=1`):** first chunk (0,0) took **13s** to generate; chunks
  reaching into fresh territory 1–2s; warmed chunks 24–32ms (fine). The `[chunk slow]` console
  warnings are the tell. No JS errors — purely a stall, and it's on a FLAG-OFF feature, so it's
  perf-debt, NOT a ship blocker — but it IS a hard prerequisite before the `DEFAULT_WORLDGEN_V2`
  flip, and it makes interim 4B testing/playtest painful.
- **Root cause:** the seamed `festivalPlan(H)` must read every neighbour hub's seam-blind BASE
  plan within `SEAM_PAIR_REACH` to decide H's suppressions. Base plans (`_computePlan`) are the
  pre-existing expensive slotter (`approachRoadsOf`/`nearestRoad`-dominated). Cross-hub seams
  INHERENTLY need neighbour plans, so the spawn warms ~dozens of base plans synchronously on the
  chunk-gen critical path. Memoized after → steady-state is fine; the cost is the one-time cold
  first-touch per region.
- **THE FIX THAT LANDED (2026-06-15, golden-preserving): per-cell `arterialsNear` cache.** Profiling
  showed the base-plan cost wasn't `arterial()` computation (already cached) — it was `nearestRoad`
  re-walking the whole neighbourhood graph (`neighborsOf` + `edgeKey` Set-dedup over a (2·window+1)²
  cell block) on EVERY call. But `arterialsNear`'s output depends **only on the cell** the query
  point falls in (qx/qz are used solely to derive `ccx,ccz`), so it's a pure per-cell function.
  Hoisted into a cache keyed `(ccx,ccz,window)`, gated `(seed,epoch)` like `_arterialCache`
  (`roads.js`). Measured (node): `nearestRoad` over ±2km/50m grid **8051ms → 528ms (15.3×)**; cold
  `festivalPlan` over a 79-hub window **7252ms → 685ms (10.6×)**. Both goldens bit-identical
  (queryPoint `eddf8e50`, POI `c1920e52`). **Cold stall ~13s → ~1–2s; `bin/lint` >40s/seed → ~10s/seed.**
- **Also done earlier (cheap, golden-preserving):** `SEAM_PAIR_REACH` 420 → 300 (empirical max real
  clip = 259m across 5 seeds); double-padding fix (±2·reach → ±reach window).
- **NOT a lever (verified):** a "heart-restricted" seam pass (classify only H's pairs) does NOT
  help — both versions warm the same neighbour base plans (memoized once); classify is µs.
- **Remaining (perf pass, now nice-to-have not blocker):** FRAME-SPREAD the residual ~1–2s
  first-region warming off the chunk-gen critical path (warm a few base plans per frame within the
  1-chunk/frame budget — result identical, golden-safe). No longer a freeze, so it's parked as
  polish rather than a flag-flip prerequisite. Target if pursued: spawn < ~1s, no >100ms chunk stalls.
- **Selftest cost:** the POI-golden selftest had gone 145s → ~340s because every box heart resolves
  seams; the `arterialsNear` cache also speeds this materially (the same `nearestRoad` path). Still
  dev-diagnostic only (not game perf); the golden capture is a rare op.

## SPEC — on-device perf trace recorder ("flight recorder" + perf-marker) — queued for the perf pass

> Gary's idea (2026-06-15): record perf while playing on laptop/iPad/phone, hand the trace to the
> agent for analysis. **The value is real-device data the codespace agent CANNOT produce** (no
> target GPU): real frame-time, real-GPU tier behavior, the cold-stall as actually FELT on mobile,
> memory/thermal over a session. Build this FIRST in the perf pass so the pass is driven by real
> numbers, not codespace guesses. Self-contained, no-build, client-side; mirrors the `K`-marker UX.

**Gating (Gary's concern: don't slow regular players).** Dev-gated, default OFF — a `?perftrace=1`
URL flag and/or a toggle in the backtick overlay. When off, a single `if (!tracing) return` early-out
in the sampler = zero cost. When ON it's still near-free (see below), so the choice is about not
shipping dev UI to players (easter-egg rule) + not paying for export serialization, NOT about
frame cost. (Could even run the passive ring-buffer always — it's a couple numbers/frame — to be a
true black-box that's already capturing when jank hits; but default-off fully honors the concern and
means players pay nothing. Recommend default-off, flag-on.)

**What it records:**
- **Frame-time ring buffer** (fixed size, e.g. 600 = ~10s @60fps; one `performance.now()` delta +
  one array write per frame, no allocation → negligible). Report p50/p95/p99 (jank is the tail, not
  avg FPS) + a downsampled timeline.
- **`renderer.info`** snapshots (draws/tris/geometries/textures/programs) — the backtick HUD already
  computes these; sample a few/sec.
- **`[chunk slow]` events** — ALREADY logged today (chunks.js); capture them into the trace with ms +
  chunk coords instead of console-only.
- **Device fingerprint** (once at init): UA, `devicePixelRatio`, resolved PERF tier, screen size,
  WebGL `UNMASKED_RENDERER` (real GPU string), `performance.memory` heap if present.
- **Player position / seed / worldgen flag / session duration** for context.

**The killer feature — a perf-MARKER (twin of `K`).** A button / mobile triple-tap that, when it
*feels* janky, dumps the last ~10s of frame-times + state + location into the trace. Turns subjective
"laggy here" into an objective trace at that exact moment.

**Export (no backend — GitHub Pages):** mirror the `K`-marker — in-memory ring buffer + a "download
perf-trace.json" / "copy for agent" button, localStorage-backed. **NOT** GA4 (too coarse for traces).

**Caveats:** Safari lacks `performance.memory` (heap = Chrome/Android only); the GPU string can be
masked on some browsers; keep the overlay/copy strings out of player-facing view (easter-egg rule);
sampler must stay allocation-free in the hot path. Wire near the backtick overlay (`src/debug.js`),
the main loop (`src/main.js`), the existing `[chunk slow]` log, and the `K`-marker plumbing.

- **✅ The seamed plan tooling-block is CLEARED (2026-06-15).** `bin/lint` over a single seed had
  exceeded 40s (plan-mode lint walks every heart's seamed `festivalPlan`), which was blocking Group
  6's 10-seed sweep. The per-cell `arterialsNear` cache (above) cut it to **~10s/seed** (10-seed
  sweep ~105s) — the burndown sweep is now feasible and the recommendation to "pull a targeted
  plan-cost fix forward" was acted on. The targeted fix turned out NOT to be the region-level seam
  cache I'd guessed here — profiling showed the cost was `nearestRoad`'s per-call graph enumeration,
  not seam re-classification — but the effect is the same: verify steps are seconds, not minutes,
  and Group 6 / arrival iteration is unblocked.
