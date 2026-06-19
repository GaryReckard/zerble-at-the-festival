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
