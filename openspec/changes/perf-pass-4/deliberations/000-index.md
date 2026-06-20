# Deliberation — perf-pass-4

## Deliberation Index

- `001-perf-pass-4-plan/` — Tier-3 **debate-mode** council on the full plan
  (Architect + Adversary + Auditor + Pragmatist + Profiler + Mediator). Two rounds
  ran (Round 1 did not converge → Round 2 cross-examination). **Synthesis:
  `001-perf-pass-4-plan/results.md`.**

**Headline outcome:** Proceed with mitigations (unanimous). The debate surfaced a
real bug the design missed — **F2 (amortized shadow map) was built on a false
premise**: `world.js:139-141` re-anchors the sun's shadow frustum to the cart
every frame, so `shadowMap.autoUpdate=false` *smears* shadows off their casters
under motion rather than benignly staling them (verified independently by four
personas). F2 is **demoted + scope-capped** (mid/high, near-stationary only,
movement-gated `needsUpdate`, single-owner shadow cadence, B0-gated, cut if not
material) — pulled out of the first slice.

**Binding corrections folded into the plan:**
1. Re-cut slices: **Slice 1 = B0 + D3 only** (both agent-self-verifiable); Slice 2
   = shader wall (F1-refactor → A4 → A1 → F2-capped → F1-gate); Slice 3 = C1-b alone.
2. **C1-b** (phased deferral) over C1-a (full coroutine) — unanimous.
3. Determinism diff (task 6.5) is a **hard merge-blocker** testing a *multi-chunk
   concurrent-deferral* neighborhood, not a single isolated chunk.
4. Spec fix: "no collidable footprint until complete" → **collider-registering
   work is synchronous; deferred work is collider-free** (resolves the contradiction).
5. **D3** must re-snapshot `count` per-NPC (it is NOT frozen per frame) and keep
   `add()` mutating the live outer counter, or the boarding throttle breaks.
6. **A1 prewarm must never dispose** GPU-owning resources — tearing down meshes
   built through the real factories would free `userData.shared` pooled materials
   and storm recompiles.
7. **One shared per-frame governor** for C1-b deferred scatter + A4 reveal pump +
   E1 curtain pump (same GL-program-link budget); crowd-spawn is the last deferred
   stage. Per-slice CHANGELOG (each shipped slice's bullet travels in its commit).

Live perf / visual / iOS / boost-driving verification is the human's job
(Codespaces has no WebGL) — batched into ~3 Gary capture round-trips.

---

- `002-geometry-merge/` — Tier-3 council (Architect + Adversary + Profiler +
  Mediator) on a chunk-completion geometry-merge pass. **Synthesis:
  `002-geometry-merge/results.md`.**

**Headline outcome:** Premise falsified — the assumed "merge collapses thousands
of draws" was wrong: food-court/camp-village static decor is already pooled/
instanced, so a merge pass nets only ~2–4%. Camp-village merge **skipped**; the
scoped food-truck + sugar-shack merge is parked as low-priority infra. This
redirected the draw hunt to the real lever (deliberation 003).

---

- `003-forest-instancing/` — Tier-3 **debate-mode** council (Architect +
  Profiler + Adversary + Auditor + Pragmatist + Mediator). Two rounds (R1
  isolated → R2 cited cross-examination). **Synthesis:
  `003-forest-instancing/results.md`.** This is the option-(b) draw lever Gary
  greenlit after `drawCensus` named trees as ~half the scene's draws.

**Headline outcome:** Proceed with mitigations (unanimous). Trees are the single
biggest draw mass (`IcosahedronGeometry·240v` 2,637 + `ConeGeometry·35v` 2,120
draws, all un-instanced); instancing collapses ~344 draws/treed-chunk → ~5. Three
tensions resolved: **(T3, dispositive)** the shipped path is **worldgen v2**
(`DEFAULT_WORLDGEN_V2=true`, perf.js:42; v2 `return`s at chunks.js:405), so slice-1
must target `scatterWorldgenTrees` (chunks.js:1061), not the dead-by-default v1
`scatterForestTrees` — v1 rides the shared `buildForestTree` emitter for free;
chunk-trees deferred (shared `ctx.rng`), lakes excluded (chunkKey-omission). **(T1,
the crux)** `bin/layout-snapshot` is **blind** to the visual stream — `dumpRegistry`
(main.js:1505-1515) emits 9 placement fields, dropping scale/color/species/crown/
perches, so a same-count rng *reorder* regenerates forests + moves bird perches
with a byte-identical snapshot → a new agent-static `bin/test-forest-determinism`
golden-hash gate is mandatory (precondition: extend `node-three-shim.mjs` from
1→~7 THREE stubs); run BOTH gates. **(T2)** `instanceColor` + a cast/no-cast shadow
split = ~5 buckets/chunk, orthogonal and shadow-audit-faithful; green-bucketing
needs ~28 or it over-casts the 56-caster budget. Disposal already correct
(chunks.js:563); keep tree.js's Group-returning builders (sandbox calls them) and
add descriptor emitters additively. **Change Groups CG1–CG4** feed `tasks.md`; the
two hard ship-gates are the determinism diff and the `?perf=low` tri budget on
Gary's real GPU.
