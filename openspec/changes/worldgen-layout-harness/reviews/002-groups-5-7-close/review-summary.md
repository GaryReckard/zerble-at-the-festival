# Code Review Summary — worldgen-layout-harness groups 5 + 7 + close-out

## Review Metadata
- Diff Scope: `4d5f035..HEAD` (custom — this session's three commits: 6accc00 group 5, 7bdad3e group 7, 0dea8fe close-out)
- Reviewed Files: 8 (code: `src/debug.js`, `map-sandbox.html`; docs: `CHANGELOG.md`, `ROADMAP.md`, `DEBUGGING.md`, openspec tasks/session-log/README)
- OpenSpec Change: `openspec/changes/worldgen-layout-harness`
- Specialists Used: review-sandbox, review-gameplay, review-docs (rendering/performance/audio not invoked — no three.js/material/hot-path/audio surface in the diff)

## Intent Match
Yes. The diff delivers exactly what the CHANGELOG/commits claim:
- **Group 5** (`map-sandbox.html`, canvas-2D dev surface): `extent` layer drawing exact built colliders from a fetched/drag-dropped layout snapshot (seed-gated via side-effect-free `seedNumOf`) + live analytic `clusterExtent` envelopes; point-inspector record naming for both sources; `?gallery=N` contact sheet with progressive plan-mode `runLint` badges + tile-click deep-link.
- **Group 7** (`src/debug.js`): `K` global hotkey + bottom-left triple-tap → `{seed,x,z,heading,tod,sessionTime,note,ts}` to `localStorage['zerble_markers']` + toast; overlay "Markers" section (editable note, per-marker `tp`/`×`, `copy JSON`, `clear`).
- **Close-out**: ROADMAP harness section trimmed to SHIPPED + 3 genuine follow-ups; both flags boot-smoked clean at perf=low.

## Findings
- [P3][low][review-sandbox] src/debug.js — 44px touch-zone overlay element could swallow corner taps on a small phone
  - Why: the original `#marker-touch-zone` div had `pointer-events:auto` over the game canvas; a thumb-rest/orbit-drag landing in the bottom-left 44px square would hit-test to the (listener-less for that gesture) zone instead of the canvas. Low: the thumbstick sits ~68px from the corner and start is centered, and 3 taps/700ms are required.
  - Fix: **APPLIED** — replaced the overlay element with a `document`-level `pointerup` listener filtered to the bottom-left 44px corner (touch/pen only; mouse uses `K`). Cannot swallow input. Re-verified: 3 corner touch-taps drop a marker; mouse-in-corner and center-touch do not; console clean.
  - Duplicate-of: none

Non-blocking observations (no action taken, by design):
- review-gameplay: the `e.target.matches('input,textarea,select')` guard on the new `K` handler mirrors the **pre-existing** `T` handler one line above; a synthetic event whose target is `document`/`window` (lacking `.matches`) would throw, but real keydowns are safe. Not a regression introduced here; left consistent with the existing pattern.
- review-docs: `README.md:73` documents the `?perf=` URL flag in player-facing copy, which contradicts CLAUDE.md's "do not reveal `?perf=`" tone rule — but that line is **pre-existing** and untouched by this diff. Flagged for a possible separate README pass, not this change.

## Verification Gap
- **map-sandbox.html**: verified headless (agent-browser, canvas-2D so no SwiftShader issue) — extent overlap at `0xf7ef2a3c`, inspector naming, `?gallery=12` tiles + progressive lint badges + tile-click nav, analytic-only fallback. No game-boot risk (never loads three.js / the chunk pipeline).
- **src/debug.js**: loads in the real game — booted `?worldgen=1` AND `?worldgen=0` at seed 1234, **perf=low** (the quiet tier), zero error-level console lines; K-drop, triple-tap drop, teleport-to-marker (0 m), and the hardened corner filter all exercised live. HUD budget healthy (draws 1/80 [ok]).
- Goldens unchanged across the whole change (`eddf8e50` / `4825fd0b`) — markers add no rng/draws; map-sandbox is off the game path.

## Suggested CHANGELOG entry
Already landed per-commit (CHANGELOG 2026-06-13: "Map-sandbox: true-extent overlay + seed gallery" + "Playtest markers"). The review's touch-zone hardening is a same-day refinement of the group-7 entry — no behavior change to the documented feature, so it rides under the existing bullet (a one-line note added).

## Verdict
**Approve with changes** — the single P3 was applied + re-verified this session. No P0/P1/P2. Ready for archive (deferred per the broader plan: archive after `festival-zone-grammar` lands, since the harness baseline is referenced live by the grammar work).
