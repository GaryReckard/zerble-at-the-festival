# Code Review Summary

## Review Metadata
- Diff Scope: custom — commit `4e2cccc` only ("docs(openspec): establish canonical
  openspec/specs/ baseline (20 capabilities)"). Gary's later `9d941ab` / `136d02f`
  were explicitly excluded.
- Reviewed Files: 73 changed (23 new spec/companion files + ARCHITECTURE.md, CLAUDE.md,
  config.yaml, the .claude plan, and the two archived-change renames)
- OpenSpec Change: none (this commit *creates* the canonical `openspec/specs/` baseline;
  the two relevant changes were archived in the same commit)
- Specialists Used: review-docs, review-gameplay, review-rendering, review-performance,
  review-audio, review-sandbox (all 6, one parallel batch)
- Review kind: **spec-vs-code accuracy audit** — no source changed; specialists
  fact-checked each spec's claims against the code it cites.

## Intent Match
Yes. The commit does exactly what it says: 20 canonical capability specs in
Requirement/Scenario form, a CATALOG + NOTES + README index, the config.yaml
`specs_index` refresh, the two complete changes archived, and three narrative-doc drift
fixes. **All three drift fixes were independently verified correct** by review-docs +
review-performance: chunks DO unload via `disposeChunkByKey` (`chunks.js:354-360,540`);
worldgen v2 IS the default (`perf.js:42`); `pixelRatioCap` low IS `1.25` (`perf.js:52`).
The worldgen reconciliations (rivers/bridges stubs, mega rank cut, arterials-only,
junction-merge not promoted) were all confirmed against code.

## Findings

All five below are **FIXED in the follow-up commit.**

- [P1][high][review-rendering] render-pipeline/spec.md:60-63 — "Debug pause halts the
  world but not rendering" scenario was inverted.
  - Why: `composer.render()` is the last line of `tickBody` (`main.js:1113`), and
    `tick()` calls `tickBody` only when `shouldRunFrame` is true (`main.js:642`). When
    paused, `shouldRunFrame` returns false (`debug.js:129`), so rendering is skipped too
    and the canvas freezes on the last frame. The spec claimed rendering still runs.
    (The `debug.js` "keep camera live" comment is itself misleading — verified against
    code.)
  - Fix: Rewrote the requirement to state `composer.render()` lives at the end of
    `tickBody`, and the scenario to "pause freezes both the world and the render until a
    step/unpause."

- [P3][low][review-gameplay] world-streaming/spec.md:56 — chunk-key format wrong.
  - Why: spec said `"${cx}_${cz}"` (underscore); `chunkKey()` (`chunks.js:593`) returns
    `"${cx},${cz}"` (comma). Internal-only (never parsed), so no behavioral impact.
  - Fix: underscore → comma.

- [P3][low][review-audio] audio-synthesis/spec.md:22-23 — resume-handler wiring cited to
  the wrong file.
  - Why: handlers live in `main.js:624-634` and `Sound.resume` at `sound.js:566`; the
    cited `sound.js:219-321` is the unlock graph, not the handlers. Mechanism correct.
  - Fix: added the `main.js:624-634` + `sound.js:566` citations.

- [P3][low][review-audio] audio-synthesis/spec.md:80-83 — per-frame distance lowpass
  over-generalized to "each drum circle."
  - Why: the distance lowpass is implemented only on the forest drum circle
    (`main.js:836-846`); the plain stage `drum` style is a no-op stub
    (`sound.js:1843-1844`). Nightness gating is correct for both.
  - Fix: scoped the lowpass clause + scenario to the forest drum circle.

- [P3][low][review-rendering] special-modes/spec.md:49 — trip self-disable cite
  undershot.
  - Why: the `pass.enabled = envelope > 0.001` gate is at `trip.js:583`, outside the
    cited `:1-166`. Behavior claim correct; only the line citation was short.
  - Fix: added the `trip.js:583` citation.

Clean areas (no actionable issues): **review-docs** (cross-refs, README links, drift
fixes, Easter-egg non-leakage all verified), **review-performance** (every PERF-table
number + adaptive ladder confirmed against code), **review-sandbox** (budget numbers,
`__dbg`/`__debug` honesty, CATALOG hit-kinds, the 6-step model checklist all confirmed).

## Verification Gap
N/A in the usual sense — this is a doc-only change, so there is no sandbox/game-boot
verification to do. The *equivalent* verification is spec-vs-code accuracy, which this
review performed: 6 specialists cross-checked every numeric constant and behavioral
claim against the cited source. One factual error (the P1) and four citation/scoping
nits were found and fixed; everything else matched code. No tier-specific concern (no
runtime behavior changed).

Out-of-scope note (pre-existing, flagged by review-docs): `README.md:73` already
documents the `?perf=` flag, which CLAUDE.md's tone rule lists among "don't reveal"
items. Untouched by this commit — a candidate for a future README pass, not this review.

## Suggested follow-up commit + CHANGELOG entry
- Commit (the fixups): `docs(openspec): fix 5 spec-vs-code accuracy nits from smart-review
  (render-pause scenario inverted; chunk-key comma; 3 citation/scoping fixes)`.
- CHANGELOG: none — doc-only, on the skip list.

## Verdict
**Approve with changes** — the five accuracy issues are fixed; intent matches; all drift
fixes verified correct.
