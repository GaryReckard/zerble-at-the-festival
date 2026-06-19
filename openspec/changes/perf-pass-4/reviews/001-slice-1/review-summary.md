# Code Review Summary — perf-pass-4 Slice 1 (B0 + D3)

## Review Metadata
- Diff Scope: unstaged working tree
- Reviewed Files: 5 — `src/main.js`, `src/debug.js`, `src/crowd.js`, `CHANGELOG.md`, `ROADMAP.md`
- OpenSpec Change: `openspec/changes/perf-pass-4`
- Specialists Used: review-rendering, review-performance, review-gameplay, review-sandbox, review-docs

## Intent Match
Yes. The diff does exactly what the CHANGELOG/plan claim: **B0** inserts an
`InfoCapturePass` at composer index 1 that taps `renderer.info.render` right after
the scene `RenderPass` (before bloom/trip/fxaa/output overwrite it to 1), exposes
it as `renderer.__sceneInfo`, and `debug.js` reads it in both the HUD and perf
sample with a live fallback; a `progDelta` field is added so shader-stall frames
self-identify. **D3** pools the per-NPC `activePassengersRef` closure into one
ref/frame with a per-NPC `count` re-snapshot. No scope creep.

## Findings

- [P3][low][review-docs] .claude/rules/no-build.md:9 — no-build relaxation was documented one-directionally.
  - Why: the ROADMAP *Out of scope* reframe said the checked-in `no-build.md` + CLAUDE.md guidance is "superseded only by this note," but the rule file still read "out of scope" with no back-pointer, so an agent loading it first wouldn't learn the constraint was relaxed.
  - Fix: **RESOLVED in this diff** — added a dated "constraint relaxed, conditionally" banner at the top of `.claude/rules/no-build.md` pointing to the ROADMAP status.
  - Duplicate-of: none

All other specialists returned **No actionable issues**:
- **review-rendering** — InfoCapturePass is transparent to the image (`needsSwap=false`, no draw/clear/setRenderTarget → bloom receives the same buffer); read timing vs `info.autoReset` is correct (reset fires at render *start*, so the post-RenderPass read holds scene totals); `renderer.__sceneInfo` is an instance-property write (no frozen-namespace/threeShim concern); `Pass` import valid at 0.160.0; no tier interaction; base `Pass.setSize()` no-op keeps the resize walk safe. Non-actionable note: capture correctness depends on the pass staying at index 1 right after RenderPass.
- **review-performance** — B0 adds a few property reads/writes per frame (below noise, zero GPU); D3 drops ~200–330 allocs/frame to 2 objects/frame; `progDelta`/`_prevProg` only run while recording; no draws/tris/budget movement.
- **review-gameplay** (highest-stakes) — D3 is semantically identical to the old two-channel closure: `count` re-snapshot at the same timing preserves the live per-frame total; no aliasing (read synchronously before any later NPC mutates; nothing persists the ctx); `MAX_PASSENGERS` throttle unchanged; determinism untouched (boarding uses `Math.random()`, not seeded rng).
- **review-sandbox** — both readers use the snapshot with sane per-surface fallback sentinels (`'-'` HUD / `-1` JSON); `fmtWithBudget` guards non-numbers so the budget marker is still correct; additive `prog`/`progDelta` keys are JSON-serialization-safe for the recorder/capture-bridge/localStorage; no module-load breakage; no new module → no importmap concern.

## Verification Gap
- **Static gates (agent-side): PASS** — 3 edited modules parse as ESM, `Pass` import resolves at unpkg 0.160.0, `bin/check-importmaps` OK, `bin/test-registry-grid` determinism PASS, README soft-gate fresh.
- **Live/visual: PENDING (Gary)** — Codespaces has no WebGL, so the running-game checks (HUD `draws`/`tris` now read realistic per-tier values not 1; crowd boarding unchanged; clean boot with no console errors) must run on real hardware. This is the one residual risk, by design — it's flagged in tasks 1.7/1.8 and the session log.
- Tiers: the change is tier-agnostic (capture pass runs identically on low/mid/high); still worth a `?perf=low` boot since low swaps to the threeShim Lambert path.

## Suggested Commit / CHANGELOG
CHANGELOG already written (2026-06-19: B0 Added/dev-workflow + D3 Performance).
Suggested commit subject when Gary commits:
`perf(hud+crowd): true draws under post-fx (B0) + pool per-frame crowd alloc (D3)` — perf-pass-4 Slice 1.

## Verdict
**Approve.** One P3 doc-direction nit, resolved in-diff. No P0/P1/P2. The
high-stakes D3 boarding semantics and the B0 buffer-transparency both verified
clean against the changed lines. Live HUD/boot confirmation remains Gary's on
real hardware before the slice is "done-done."
