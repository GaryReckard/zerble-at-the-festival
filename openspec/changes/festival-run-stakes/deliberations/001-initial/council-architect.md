## Architect's Order of Operations

### Priority Sequence

1. **Nail down the jug-scarcity filter's exact injection point in `chunks.js` before any
   P2 code lands** (`src/chunks.js:2130` `scatterBubbleJugs`, and the separate
   `_placeSpawnJugs` call at `chunks.js:559-593`). This is the single riskiest structural
   seam in the whole plan and design.md D3 / task 6.2 leave it underspecified. See
   Structural Risk #1.
2. **Thread "current day" into `ChunkManager` explicitly as a new, documented input**
   before task 6.2 starts, with an agreed default for `hub-sandbox.html` /
   `map-sandbox.html` (Cruisin'-equivalent / unfiltered) so the existing verification
   surfaces stay stable. See Structural Risk #2.
3. **Build `src/runMode.js` and `src/scoring.js` (tasks 3.1, 4.1) before any call site
   is touched** — the plan already gets this right (D1/D2, mirroring the `PERF` tier
   pattern confirmed in `src/perf.js`), just flagging it as correctly sequenced: the
   choke-point module must exist and be import-map-registered before `main.js`/`crowd.js`
   wiring starts, or an implementing agent will backfill ad-hoc `if (mode === ...)`
   conditionals that the plan explicitly forbids.
4. **Resolve the two `bubble_jug` call sites' filter scope** (guaranteed intro jugs vs.
   the ~1-in-9-chunk scatter) before task 6.2, not during. See Structural Risk #3.
5. **Land the A/B invariance check (task 3.4) immediately after `runMode.js` exists**, not
   deferred to the end of P2 — it's cheap now and expensive to debug later once nine
   call sites read mode config.
6. **Verify the Lurleen tow-rescue's "nearest juice source" fallback for the
   sparse-jug case** (Day 5+, `keepFraction = 0.30`, load-radius-bounded chunk residency)
   before task 6.6 lands. See Structural Risk #4.
7. Everything else in the plan (scoring pipeline single-choke-point at task 4.2, HUD
   dirty-flagging reuse, `crowd.onZerbleHit` hook reuse, sessionStorage resume extension)
   is architecturally sound and correctly reuses existing patterns — no reordering needed
   there.

### Structural Risks Identified

- **Jug-scarcity filter's rng-stream boundary is not pinned down precisely enough
  for a code-writing agent to get right on the first pass.** `scatterBubbleJugs`
  (`chunks.js:2130-2148`) consumes `ctx.rng()` THREE distinct ways before it ever reaches
  `registry.add`: the `ctx.rng() > 0.11` chunk-gate, then up to 8 attempts of
  `ctx.rng()`-driven x/z candidates. Critically, `scatterWorldgenCampsites`
  (`chunks.js:2158`, comment at line 2156) explicitly depends on `ctx.rng()` being called
  the *same number of times* immediately after the jug scatter for its own determinism.
  Design D3's language ("keeps a jug iff `worldHash(x,z,JUG_FILTER_SALT)` < keepFraction")
  is the right shape — `worldHash` is an existing, already-imported utility
  (`chunks.js:19`) used elsewhere for position-keyed lookups independent of the `ctx.rng()`
  stream, so precedent exists in this codebase for exactly this pattern. But the plan
  never states the constraint explicitly: **the mode/day filter check MUST happen strictly
  after all `ctx.rng()` draws for that jug complete, gating only the final
  `buildBubbleJug()`/`ctx.group.add`/`registry.add` triplet — never short-circuiting the
  candidate search early.** Get this wrong and Festival Run's chunk content diverges from
  Cruisin's beyond just jugs (campsites and anything after in the same builder desyncs too)
  — a determinism break with no RNG-draw-count test catching it, exactly the failure mode
  the charter's Non-Negotiable #1 and the Adversary persona notes warn about. Task 6.2
  should be rewritten with this as an explicit acceptance line, not left implicit in
  design.md prose.
- **Live run state (day counter) has no existing path into `ChunkManager`/`_generate`,
  and this is architecturally new.** `_generate(cx, cz)` (`chunks.js:397-428`) builds
  `ctx` fresh per call with no mode or day field; the only existing cross-cutting import
  chunks.js takes is `PERF` (`chunks.js:21`), which is a **session-immutable** device
  profile resolved once at boot — nothing in chunks.js today reads a value that changes
  *during* a run. The day-ramp keepFraction is exactly that: a live, monotonically
  strictening value. Since chunks generate lazily on first visit and rebuild from scratch
  on re-entry after unload (not memoized across the unload/reload cycle), a jug spot's
  fate is decided against whatever day it happens to be re-generated on — meaning a
  previously-jug-rich area a player backtracks into late in a run will read as thinned out
  relative to their first visit. That's plausibly fine as flavor ("the well's drying up")
  but it's an emergent side effect the plan never states, and it requires `ChunkManager`
  to gain a new mutable input (day/mode) that must default sanely for
  `hub-sandbox.html`'s `buildHubPreview` (`chunks.js:1415`) and `map-sandbox.html`'s
  worldgen queries — neither of which the tasks or design mention. Left unaddressed, an
  implementing agent could thread mode state via a module-level mutable read (a `let`
  outside the class, à la a lighter version of the `nightness`-poll pattern) which would
  work but should be a *documented* decision, not an accident of implementation order,
  given how deliberately this codebase separates session-scoped config (`PERF`) from
  live game state.
- **The plan doesn't say which `bubble_jug` registry.add call site the scarcity filter
  applies to.** There are two: `_placeSpawnJugs` (`chunks.js:559-593`, the guaranteed
  intro jugs "ring[ed]... at the gate" per `main.js:334`) and `scatterBubbleJugs`
  (`chunks.js:2130`, the ambient ~1-in-9-chunk pickups). Design D3 and spec
  `festival-run/spec.md` "Jug availability is a runtime filter" both say "jug entries"
  generically. If an implementing agent filters both uniformly, Day 1's "tutorial-soft"
  framing (spec: "Day 1 SHALL play tutorial-soft... availability ≈ today's") is
  contradicted the moment a player who spawns on Day 2+ (via resume) or whose intro jugs
  land in a not-yet-generated chunk gets a thinned welcome ring; if it applies to neither,
  the ramp table's jug-keep column (`design.md` D6, 1.0 → 0.30) has nothing to bite on
  for the majority of resident jugs players actually rely on mid-drive. This needs one
  explicit line in `design.md` before task 6.2, not left to whichever call site the
  implementing agent notices first.
- **Lurleen tow-rescue's "nearest juice source" has no stated fallback when no jug is
  chunk-resident.** `carts/spec.md` requires the rescue to complete "or safely abort to
  normal play" under chunk churn — good — but doesn't address the more basic case: at
  Day 5+ (`keepFraction = 0.30`) combined with the load-radius-bounded chunk residency
  (`UNLOAD_RADIUS` 2–3 chunks per `CLAUDE.md` §5), it's plausible zero `bubble_jug`
  registry entries exist within any reasonable tow distance at the exact moment a rescue
  fires. `festival-run/spec.md` says "teleport-adjacent staging is acceptable" for the
  destination, which implies awareness of this, but neither spec states what happens when
  literally none is registry-resident (spawn one? grant the "minimal refill" with no tow
  animation? fall through to normal `ran_dry` death, silently burning the once-per-run
  rescue on a no-op?). This is a real code path an implementing agent will hit in
  playtesting (task 6.8's `__dbg` rescue-path drill) and should be decided before, not
  during.

### Verdict

- **Verdict**: Proceed with mitigations
- **Key Concern**: The jug-scarcity filter (D3) is the right architectural shape in
  principle — it reuses an existing, already-imported position-hash utility
  (`worldHash`) instead of touching the seeded `ctx.rng()` stream — but the plan doesn't
  pin down *where exactly* in `scatterBubbleJugs`'s multi-step rng-consuming flow the
  filter gates, nor how a live, run-mutable "day" value reaches `ChunkManager._generate`
  for the first time in this codebase. Both are answerable in an hour of design work, but
  getting either wrong produces a determinism regression (chunk content desyncing between
  modes/players) with no test in the current suite that would catch it — exactly the
  failure class the charter's Non-Negotiable #1 exists to prevent.
- **Recommendation**: Add one concrete paragraph to `design.md` D3 pinning the filter's
  code location relative to `ctx.rng()` draws, one line resolving which of the two
  `bubble_jug` call sites is in scope, and one line specifying how `ChunkManager` receives
  the live day value (plus its default for `hub-sandbox.html`/`map-sandbox.html`) — then
  proceed. Everything else in the plan (module boundaries, the mode-config single choke
  point mirroring `PERF`, the scoring pipeline consolidation, the `crowd.onZerbleHit`
  reuse for vibe/scare-off which is already selectively gated to `kind === 'person'` and
  won't accidentally fire on prop hits, the sessionStorage resume extension) is
  architecturally sound and correctly reuses this codebase's established patterns.
