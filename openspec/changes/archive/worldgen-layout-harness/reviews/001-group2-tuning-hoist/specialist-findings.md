# Specialist Returns — group-2 tuning-hoist review (`2ded863..26a540d`)

Raw per-specialist output, pre-synthesis. The canonical deduped findings live in
`review-summary.md`. Four specialists invoked in one parallel batch; review-rendering
and review-audio skipped (no models/materials/audio in the diff).

---

## review-gameplay

### Scope
- Reviewed: the full 832-line diff.patch, cross-checked against live
  src/worldgen/tuning.js, src/worldgen/festival.js, src/chunks.js, and the model
  exports in src/models/{foodTruck,sugarShack,portaPotty}.js.
- Notes:
  - **Determinism: clean.** Every substitution is value-identical — spot-checked all
    planner constants (dancefloor 38/17, stage-scale 1.15/0.25 + 1.0/0.5, walks
    86/66+28, 66/50+18, 55/40+20, drag fracs 0.45/0.34, perps 16/5, potty 9, counts
    2/1, drum 130/15/0.7/0.7, nudge 10/28/9, village 240/0.25, full KIND_FOOTPRINT)
    and all builder constants (food court 3+3/14×/0.35/2.5/4.4/0.4+3/1+3/0.45/3.2/5+6,
    vendor 5+3/5.0/7/0.4/6, camp 12+9/5.5/30/4/0.50+0.85) against FESTIVAL_TUNING
    defaults. No rng() call added/removed/reordered; no Math.random; no salt/hash2
    changes; SALT.*, ANGLE_BINS, DRY_PROBES, MAX_POI_REACH untouched.
  - **Setter:** setFestivalTuning has zero callers repo-wide — documented future-only
    surface for group 6.4. Fine.
  - **Drift guard:** one-shot, node-safe (typeof location guard), warn-not-throw, all
    four compared symbols already imported at chunks.js:33–37 — no boot-chain risk.
    MODEL_DIMS copies verified correct against live exports (1.7, 6.4, 8.0+1.0=9.0, 2.5).
  - **Dependency direction:** tuning.js contains zero import statements.
  - **Legacy guardrail:** 14*FOOD_TRUCK_SCALE (chunks.js:1744), spacing=5.0 (1966),
    12+Math.floor(...) (2246), MIN_SPACING=5.5 (2248) each survive exactly once, in
    legacy builders only, untouched.
  - **Registry/lifecycle:** no chunkKey/footprint/disposal/userData.shared changes.

### Findings
- [P1][medium] src/worldgen/festival.js:107 - New comment falsely claims buildStage
  reads FESTIVAL_TUNING.STAGE_SCALE_* — the builder twin was NOT rewired.
  (chunks.js:2310–2311 still literal; tuning.js:120 repeats the claim. Desync trap for
  the group-6.4 sliders against D3.3 plan/build agreement. Fix: rewire buildStage's
  scale draw — value-identical, first ctx.rng() call unchanged — or correct both
  comments. Rewire preferred before 6.4.)
  → **Confirmed by orchestrator against live files; upgraded to high confidence. Kept
  as canonical P1; folded into tasks.md as task 2.4.**
- [P3][low] src/chunks.js:1181 - Drift-guard hostname gate
  (/^(localhost|127\.0\.0\.1)$/) is narrower than map-sandbox.html's isLocal
  (172.16–31.x, claude-preview, happycog) — a forwarded/preview-host session silently
  disables the guard. Fix: reuse the isLocal predicate shape. → **Kept.**

---

## review-performance

### Scope
- Reviewed: full diff.patch; tuning.js complete; chunks.js drift-guard + builder
  hunks; festival.js rewired reads; callers of festivalPlan / dancefloorRectsNear /
  campVillagesNear in main.js and placement.js.
- Notes: charter limited to hot-path/allocation cost of changed code.
  1. assertTuningDrift sets _tuningDriftChecked=true before any work → all later calls
     are boolean-check + return; one-shot body allocates one 4-tuple and one regex; no
     new model imports (all four symbols pre-existing imports). Zero meaningful cost
     to the 1-chunk/frame budget.
  2. No per-frame exposure: festival.js reads sit behind the (seed, epoch) plan memo
     (once per heart per epoch); chunks.js reads run only in _generate at chunk spawn;
     remaining call sites are module-eval spawn placement + on-demand debug verbs.
     Rewired functions also cache `const T = FESTIVAL_TUNING;` locally.
  3. tuning.js module scope: zero imports, two plain object literals + two functions;
     clusterExtent has no game-code callers yet.
  - Claimed gates (EMPTY snapshot diff incl. draw canary, goldens, HUD budgets) are
    consistent with a value-identical hoist + one-shot dev guard.

### Findings
- `No actionable issues.`

---

## review-sandbox

### Scope
- Reviewed: diff.patch; importmap wiring in index.html / sandbox.html /
  map-sandbox.html (verified against live files); import-specifier resolution in
  chunks.js + festival.js.
- Notes:
  1. 'worldgen/tuning' present in index.html:90 (mods), sandbox.html:180 (mods),
     map-sandbox.html:26 (wg); each cache-buster loop covers it.
  2. "ALL FOUR html files" (task 2.2) vs three: repo-wide *.html glob returns exactly
     the three; hub-sandbox.html is future group-6 and the session-log records the
     scope decision. Nothing missed.
  3. No src/models/ file in the diff → new-model sandbox checklist does not apply.
  4. festival.js:45 imports './tuning.js', chunks.js:28 imports
     './worldgen/tuning.js' — both resolve to the same URL the importmap keys cover,
     matching sibling style; prod and dev both resolve.
  5. Game-boot evidence (both flag states, goldens, empty snapshot diffs) recorded in
     the session log — smoke-test obligation documented as met.

### Findings
- `No actionable issues.`

---

## review-docs

### Scope
- Reviewed: diff.patch (full) — CHANGELOG.md, openspec change docs (README,
  session-log, tasks), importmap touches, code hunks read only to verify doc claims;
  plus live ROADMAP.md and the change README.
- Notes:
  - CHANGELOG content check passed: both 2026-06-11 bullets verify against the code;
    voice matches the repo bar; date placement correct; 26a540d doc-only changelog
    skip correct.
  - OpenSpec hygiene clean: README edits entirely inside the STATUS markers and
    generated-consistent (15/38 = 39%); session-log append-only, event-driven, D8
    appended, frontmatter updated.
  - No-build cross-check satisfied; player-facing copy untouched; no Easter-egg
    leakage.

### Findings
- [P2][medium] ROADMAP.md:86 - "plan/build contract refactor" step (1) — the
  FESTIVAL_TUNING hoist — shipped in this diff but still reads as queued; the
  same-commit trim rule wanted it trimmed. Fix in a follow-up docs commit. → **Kept.**
- [P3][low] CHANGELOG.md:12 - Commit-A bullet names buildFoodPlaza (discovered only in
  commit B) — same-commit-discipline ambiguity, needs git to resolve.
  → **Resolved benign by orchestrator with git: commit A's bullet did NOT mention
  buildFoodPlaza (grep count 0 in `git show 4419cb3 -- CHANGELOG.md`); commit B
  amended it. Discipline held. Dropped.**
- [P3][low] tasks.md:186 (≈153) - Task 2.3 ticked but recorded gate outputs omit the
  "HUD budgets unchanged" observation. → **Kept.**
- [P3][low] ROADMAP.md:123 - Pre-existing: the __dbg additions bullet shipped with
  group 1 but still reads as queued. → **Kept (sweep with the P2).**
