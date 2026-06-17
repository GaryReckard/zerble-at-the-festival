# Code Review Summary — procedural-map-generator (worldgen)

## Review Metadata
- Diff Scope: custom (uncommitted worldgen implementation; `.claude/**` toolkit edits excluded — they predate this work)
- Reviewed Files: `src/worldgen/{constants,hearts,water,roads,density,roles,index,selftest}.js`, `map-sandbox.html`, `src/rng.js` (worldgen primitives), `CHANGELOG.md`, `ROADMAP.md`, `src/worldgen/README.md`, `openspec/changes/procedural-map-generator/**`
- OpenSpec Change: `openspec/changes/procedural-map-generator/`
- Specialists Used: review-gameplay, review-performance, review-sandbox, review-docs (review-rendering + review-audio N/A — Canvas 2D, no three.js, no audio)
- Date: 2026-06-06

## Intent Match
Yes. The change builds exactly what the diff/CHANGELOG/spec describe: a
render-agnostic (no three.js/DOM), deterministic 2D world-layout generator
(hearts → arterials → lobed lakes → organic gap-fill forests) plus a Canvas-2D
dev sandbox with live tuning, and it does **not** touch the live 3D game.
Determinism design is sound (integer-quantized coords, exact-integer distance
compares with lexicographic tiebreaks, canonical edge ids, fresh non-colliding
salts, seed via `setSessionSeed`, transcendental risk confined to IEEE-correctly-
rounded `sqrt`). No `userData.shared` / `chunkKey` / tier-guard regressions
(N/A — not wired in). Intentional cuts (rivers/bridges stub, mega omitted,
hearts allowed lakeside) match the documented Q4 decision.

## Findings (all actionable items FIXED in this pass)

- [P2][high][review-performance] `src/worldgen/roads.js:137` — `roadsInBounds` O(cells × neighborsOf) melts when fully zoomed out (min zoom 0.004 → ~480km → ~28M scans), hard-stalling pans.
  - **Fixed:** raised sandbox zoom floor 0.004 → 0.02 (`map-sandbox.html`) and added a `>60000`-cell backstop in `roadsInBounds` + `heartsInBounds` (return `[]`). Verified: huge bounds → 0 features, normal view → 219 roads.

- [P2][medium][review-gameplay] `src/worldgen/density.js:65` — forest field used a 2-cell heart window; a major district (1000m) exceeds it, dropping the district tree-ramp near big hubs (visible discontinuity).
  - **Fixed:** `treeDensity` now uses the derived `heartNeighborhoodCells()`. Cheap per-pixel via the memo. Verified self-test still green.

- [P2][high][review-docs] `specs/world-layout-generator/spec.md` — spec asserted mega/rivers/bridges as hard `SHALL`s the code defers; task 5.1 promised an annotation that never landed.
  - **Fixed:** added `> Deferred this change` notes under the mega rank, the river clause, and the Bridges requirement (point to Q4 / Decision Record). Spec no longer overstates the code.

- [P3][high][review-docs] `session-log.md:6` — frontmatter `open_questions: 4` contradicted `questions-for-human.md` (`open: 2`).
  - **Fixed:** set to `open_questions: 2`.

- [P3][medium][review-docs] `tasks.md:5.6` — checked done, but the promised CLAUDE.md/DEBUGGING verify-table one-liner was never added (only the README half).
  - **Fixed:** added a `map-sandbox.html` row to the CLAUDE.md "Run + verify" table distinguishing it from the entity sandbox.

- [P3][medium][review-gameplay] `selftest.js:74` — T2 heart window-invariance had a near-field gate (<660m) that excluded the exact far-field case it claimed to prove.
  - **Fixed:** dropped the gate; T2 now asserts invariance across the full sample (passes by construction of the derived window).

- [P3][low][review-performance] memo Maps grew unbounded within a (seed,epoch) on long pans.
  - **Fixed:** added a 250k-entry clear in `heartInCell`/`lakeInCell`.

- [P3][low][review-performance] `density.js` walks the lake neighborhood twice per sample (`lakeAt` + `nearestLake`).
  - **Not fixed (intentional):** micro-cost on a memoized, screen-bounded field; below the dev-tool bar. Noted for later if the field ever feels laggy.

### Boundary notes for the 3D-port handoff (not bugs today)
- Lake outline vertices use `sin`/`cos` before `quantize`, so a shoreline vertex
  can land 1m differently across JS engines — and because an arterial is nulled
  if any vertex hits `lakeAt`, that can affect *whether a near-shore road exists*
  cross-engine, not just shading. Switch to an integer orientation test at
  wire-in if it matters (already noted in `water.js`). Re-run the golden hash on
  Safari/Firefox then.

## Verification Gap
- **Headless:** self-test PASS 20/20 across 4 seeds (round-trip, full-sample heart
  window-invariance, negative controls, road window-invariance + negative
  control); render-agnostic confirmed (no `three`/DOM import). Golden `3edcbf9a`.
- **Browser (Chrome via preview MCP):** renders clean, zero console errors,
  zoom-out backstop verified, tuning sliders + inspector + self-test button work.
- **Not applicable:** main-game boot (this is not wired into the game — by design;
  that smoke test belongs to the future 3D-integration change). No three.js tiers
  to test (Canvas 2D).

## Suggested Commit / PR Description + CHANGELOG
CHANGELOG entry already written (2026-06-06, "World-map sandbox"). Suggested
commit subject: `Add: 2D world-map generator + sandbox (procedural-map-generator)`.

## Verdict
**Approve.** Intent matches, determinism is sound and proven, no critical issues.
All actionable review findings were fixed in this pass and re-verified; remaining
items are documented deferrals (rivers/bridges/mega → 3D follow-up) and a
3D-port handoff note. Not wired into the game by design — the v2-worldgen wire-in
is the next change (ROADMAP).
