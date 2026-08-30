# Specialist "checked out clean" notes (kept for the record)

Findings are consolidated in review-summary.md; these are the notable clean
verifications each specialist performed — useful the next time someone asks
"was X ever checked?"

## review-gameplay (Opus)
- Salt audit: `JUG_FILTER_SALT 0x1B9DFA33` collides with none of: `STYLE_SALT
  0xC4FE7B2A`, `SPAWN_JUG_SALT 0x5A17B0BB`, `POTTY_SALT 0x9E3779B1`, `0x9A7`
  (chunks), `0x0D40C1C7` (forests), `0x5A7B19D3` (lurleen), `0x50A70F17`
  (photographer), `SALT.* 0x4D41_01…0F` (worldgen/constants).
- The `return`-not-`continue` jug-filter gate is draw-count-neutral by
  construction (unfiltered path also returns after one jug).
- No new `Math.random()` reaches a seeded path (day-toast pick + rescue angle
  are runtime-only).
- Registry/`chunkKey` rules unchanged; no lake gained a chunkKey.

## review-performance (Opus)
- No THREE.* construction, mesh, material, light, or castShadow anywhere in
  the diff — the "no budget re-measure needed" rationale holds.
- HUD dirty-flagging verified: setDay (floored compare), setSputter (per-second
  ceil compare), setVibe (0.01 frac gate) all match the existing setCombo shape.
- Heartbeat throttle genuinely caps at ~1 request/10s worst case; every
  setTimeout cleared in finally; pagehide listener one-shot; no retry loops.
- Cruisin' pays two property reads/frame for the run layer (plus the CSS
  animation finding, now consolidated in the summary).

## review-sandbox (Opus)
- Importmaps hand-counted: 43 mods listed vs 43 src files, `runState` present
  in all three game pages; map-sandbox correctly exempt; bin/check-importmaps
  walks all four pages.
- workers/ never appears in any importmap; package.json gained no runtime deps;
  wrangler.toml carries no secrets; no-build stance intact.
- hud.js is imported only by main.js — sandbox pages can't crash on the new
  DOM lookups, and every new element access is null-guarded anyway.
- iOS start path verified synchronous end-to-end to Sound.init() (the
  leaderboard token kick is fire-and-forget, unawaited).
- Could not verify executable bits on new bin/ scripts (no shell) — orchestrator
  note: `npm run check` runs them directly and passes, so they're set.

## review-docs (Opus)
- CHANGELOG dates/grouping/voice correct; doc-only group-7 commit correctly
  skipped the changelog.
- ROADMAP consumption verified against code (`JUICE_STACK_MAX = Infinity`
  matches the corrected "unlimited" text).
- No Easter-egg leakage in README/title card (Wook trip, t menu, ?perf=,
  backtick, __dbg, zerble-board-url all absent from player-facing copy);
  "Bring the bubbles, collect the smiles" intact.
- The leaderboard privacy disclosure required by specs/leaderboard/spec.md is
  satisfied verbatim on the title card.
- OpenSpec hygiene passes: real deliberation artifacts, front-door status
  synced, event-driven session log, questions frontmatter consistent.
