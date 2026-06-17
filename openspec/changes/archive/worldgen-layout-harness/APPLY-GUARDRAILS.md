# APPLY GUARDRAILS — worldgen-layout-harness

> **Read this WHOLE file before touching code. It is one page on purpose.**
> It distills the traps from design.md + the deliberation so you don't have to
> re-derive them. If anything here contradicts your instinct, this file wins.
> If anything here contradicts CLAUDE.md, CLAUDE.md wins.

## Model routing (Gary-approved)

| Tasks | Tier | Why |
|---|---|---|
| 0.1 (v2 H.2 fix) | **Fable / strongest available** | Deliberately moves a determinism golden; tie-break geometry judgment |
| 6.1, 6.2 (hub viewer chunks.js surgery) | **Fable or careful Opus 4.8** | Live disposal-walk refactor + synthetic ctx; mistakes produce a viewer that lies plausibly |
| 1.x, 2.x, 4.x | Opus 4.8 | Gate-protected; mechanical with judgment edges |
| 5.x, 7.x, 8.x, 6.3–6.7 | Opus or Sonnet | Pattern-following with visual/scripted verification |

Run `/smart-review` (or a Fable session) at two milestones: after group 2
(the hoist) and after 8.1 (the baseline).

## The DO-NOT list (each of these has burned this repo or was council-flagged)

1. **Do NOT fix any layout violation the linter finds.** This change RECORDS the
   baseline; `festival-zone-grammar` fixes. Only linter rule bugs (false
   positives) are fixable here. If a violation looks "easy to fix" — it is not
   your task.
2. **Do NOT merge two constants just because they hold the same number.** The
   hoist inventory marks them "same number, two owners, do NOT merge yet."
   Unifying is a behavior change → snapshot-diff failure → your commit doesn't
   land.
3. **Do NOT convert `Math.random()` to `rng()`** — the sites in `buildStage`
   ([chunks.js:2342](../../../src/chunks.js#L2342) area) are *intentionally*
   outside the deterministic stream. "Fixing" them injects draws into the
   cluster stream and silently regenerates every player's world.
4. **Do NOT reorder, add, or remove any `ctx.rng()` / `cctx.rng()` call** in
   game-path code, ever, for any reason in this change. (The extraction that
   legitimately touches draws was deferred to the grammar change.)
5. **Do NOT set `castShadow = true` on anything new** (decals, viewer ground,
   markers). The shadow-caster count is audited (~56).
6. **Do NOT tag harness-created materials `userData.shared`**, and do NOT
   register decals/viewer scaffolding in the registry. `showFootprints` and the
   hub viewer must dispose fully on toggle/rebuild.
7. **Do NOT touch lake/road registry entries' chunkKey semantics** (lakes omit
   chunkKey on purpose — footgun #5). `dumpRegistry` is READ-ONLY.
8. **Importmap = FOUR files**: [index.html](../../../index.html) `mods` array
   (~line 89), [sandbox.html](../../../sandbox.html) (~line 179),
   [map-sandbox.html](../../../map-sandbox.html) `wg` array (~line 28), and
   `hub-sandbox.html` when it exists. Every new `src/worldgen/*` module goes in
   every file that can load it. Forgetting one = your edits silently stop
   reloading on local dev.
9. **`'three'` mapping in hub-sandbox.html: copy INDEX.HTML's**
   ([index.html:101](../../../index.html#L101) → `threeShim.js`), **NOT
   sandbox.html's** — the entity sandbox deliberately uses raw unpkg three
   ([sandbox.html:176](../../../sandbox.html#L176) comment), but the hub viewer
   must match the GAME's tier-aware materials or its acceptance test can never
   pass. (Earlier drafts of design/specs said "sandbox.html's mapping" — that
   was corrected 2026-06-10; this file is right.)
10. **Do NOT run group-2 commits while Gary is live-tuning** worldgen constants
    (freeze agreed, -> Q5). Announce window open/close in the session.

## The gate ritual (every golden-frozen commit — group 2, and task 6.1)

Run ALL of these. Paste the outputs into the commit message or session notes.

```
1. node selftest:  node --input-type=module -e "import('./src/worldgen/selftest.js').then(m=>{const r=m.runSelfTest();console.log(r.pass, r.goldenHash, r.poiGoldenHash)})"
   → pass must be true; BOTH hashes unchanged from HEAD.
2. bin/layout-snapshot --diff <pre-captured>.json <fresh-capture>.json   (per seed: 1234, 0xf7ef2a3c, +1)
   → diff must be EMPTY, including draw-count canary fields. Capture protocol: ?worldgen=1&perf=high, crowd on, no driving.
3. Boot http://127.0.0.1:8765/?worldgen=1 AND ?worldgen=0 — title card → start → ~3s →
   preview_console_logs clean (no TypeError/ReferenceError/shader errors) on BOTH.
4. Backtick HUD: draws/tris budgets unchanged in-game (harness adds no game-path geometry).
```

**If ANY gate fails: STOP. Revert or report. Do not rationalize a diff, do not
"accept" a moved golden, do not retry with tweaks until it passes by accident.**
There is no acceptable drift in this change. A failed gate is information, not
an obstacle.

## Stop-and-report conditions (beyond gate failures)

- The hub-viewer acceptance test (6.3) shows position diffs vs the game dump
  you cannot explain line-by-line. (Explaining = naming the exact code-path
  difference, not "probably the crowd.")
- You find yourself wanting to edit `src/rng.js`, any salt constant, or
  `festival.js` placement logic. None of that is in this change (the one
  exception: the comment-only fix in task 1.10).
- A task needs a pattern this file doesn't anchor and you can't find the
  precedent in 10 minutes.

## Key anchors (verified 2026-06-10 — patterns to copy, not reinvent)

| Need | Copy from |
|---|---|
| `__dbg` verb shape + help() registration | [main.js:1307](../../../src/main.js#L1307) (`window.__dbg = {`), `camLock` at [main.js:1328](../../../src/main.js#L1328) |
| Chunk unload walk to extract (task 6.1) | [chunks.js:~340–400](../../../src/chunks.js#L340): shared-respecting dispose → `registry.removeChunk` (367) → crowd/stagePerformers/stageMusic/lenses/beams/cooks/forestAnimatables (388)/forestDrumCircles (392)/forestDrumMusic sweeps |
| Worldgen build path (what the viewer must reuse) | `_generateWorldgen` calls at [chunks.js:515-516](../../../src/chunks.js#L515), dispatch `buildWorldgenKind` at [chunks.js:1159](../../../src/chunks.js#L1159), guard at [chunks.js:1137-1149](../../../src/chunks.js#L1137) |
| Cluster envelope table (hoist target) | `KIND_FOOTPRINT` [festival.js:196](../../../src/worldgen/festival.js#L196); `stageScaleOf` [festival.js:105](../../../src/worldgen/festival.js#L105); `dancefloorRect` [festival.js:173](../../../src/worldgen/festival.js#L173) |
| Dancefloor consumption (linter rule reference) | [chunks.js:1009](../../../src/chunks.js#L1009) (`dancefloorRectsNear`) + point-in-rect test below it |
| Tuning-slider panel pattern (group 6.4) | map-sandbox.html: `TUNING · LIVE` h1 (~98), `syncTune` (~526), `setConfig` (~577) |
| CLI shape for bin/lint + selftest style | HANDOFF-documented: `node --input-type=module -e "import('./src/worldgen/selftest.js')..."` |
| Keydown handling (marker key, task 7.1) | [input.js:27](../../../src/input.js#L27) (gameplay keys) + [debug.js:727](../../../src/debug.js#L727) (overlay keys) — check BOTH before claiming `m` |
| Registry query semantics | `closestBuilding(pos, radius, excludeKinds)` [registry.js:143](../../../src/registry.js#L143); `removeChunk` [registry.js:59](../../../src/registry.js#L59) |
| Crowd draw dependency (why tier is pinned) | crowd.spawn early-return ~[crowd.js:338](../../../src/crowd.js#L338); call site ~[chunks.js:2333](../../../src/chunks.js#L2333) |

## Definition of done, globally

A task is done when its "done =" line in tasks.md passes, the relevant gates
pass, DEBUGGING.md/docs were updated in the same commit where the task says so,
the CHANGELOG entry travels in the same commit (dev-workflow changes count),
and the main game boots clean on both flag states. Sandbox-pass ≠ game-pass.
