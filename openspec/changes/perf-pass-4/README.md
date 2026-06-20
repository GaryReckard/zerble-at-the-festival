# Make the festival run smooth — kill the freezes and the hitches

> **Status:** <!--STATUS:LINE-->in progress · 17/48 tasks (35%)<!--/STATUS:LINE-->
>
> _Plain-language summary of this change. A non-engineer should understand it; a junior dev should grasp it; a senior dev should be able to build an accurate mental model from this file alone._

## TL;DR

Driving into a festival hub sometimes makes the game freeze for a third of a
second, and streaming new ground in causes lots of little stutters. This change
fixes both — without a build step — and first repairs a broken gauge so we can
actually *see* what the game is doing. A five-expert review (a "debate") stress-
tested the plan, caught a real bug in one of the ideas, and re-cut the work into
three safe slices.

## The Problem

A "hub" is one of the festival's busy squares — stages, food courts, vendors. The
first time you drive into one, the graphics card has to build ("compile") all the
new visual materials at once, and that blocks the game for **137–343 milliseconds**
— a visible freeze. Separately, the world streams in as 80-metre **chunks**; each
chunk is currently built in a single burst, causing frequent **30–60ms** stutters
as you drive. And our in-game performance gauge is lying to us: with the visual
post-processing turned on, it reports "1 draw call" no matter what, so we're
optimising blind.

Players feel the freezes and stutters. The next developer (or agent) can't tune
what they can't measure.

## Proposed Fix

Seven moves, shipped as three slices (measure first, then the two real problems):

- **Fix the gauge (B0):** read the real draw/triangle counts before the
  post-processing overwrites them, and flag which frames compiled new materials.
- **Stop the chunk stutters (C1):** build each chunk's *solid* parts (the bits you
  can crash into) instantly, then trickle in the decorations over the next few
  frames — so no single frame does all the work. Crucially, this produces the
  **exact same world** (the festival is generated from a fixed seed; we must not
  change what gets placed, only *when*).
- **Stop the hub freeze (A1 + A4):** warm up the materials during the title
  screen (dead time the player spends reading the start button), and for anything
  left over, reveal it one-material-at-a-time so the cost is spread thin.
- **Two cheap wins:** skip the glow effect when nothing's glowing (F1), and
  refresh the sun's shadows less often (F2 — *carefully*, see below).
- **Cut wasted memory churn (D3):** stop creating throwaway objects every frame
  in the crowd code.
- **A nice-to-have (E1):** a warm "arriving at the festival" bloom-and-whoosh that
  can hide any leftover freeze as if it were on purpose.

See `design.md` for the technical "how".

## Progress

<!--STATUS:AUTO-->
**in progress** — 17/48 tasks complete (35%) · current: 7.2.1

_Last updated: 2026-06-20_

| Group | Progress |
|---|---|
| 1. Slice 1 — B0 (true measurement) + D3 (crowd alloc pooling) | 6/6 ✅ |
| 2. Slice 2 — re-scoped by the 2026-06-19 round-trip-1 capture | 2/4 |
| 3. Slice 3 — C1-b time-sliced chunk generation (phased deferral) | 0/6 |
| 4. E1 — arrival curtain (gated on Slice-2 results) | 0/2 |
| 5. Draw-call reduction — JUSTIFIED by the round-trip-1 capture (the real lever) | 2/7 |
| 6. Docs + verification (per slice, not batched) | 4/4 ✅ |
| 7. Slice 4 — forest-tree instancing (the real draw lever) | 3/19 |
<!--/STATUS:AUTO-->

## Key Decisions

- **Measure before optimising.** The broken gauge (B0) is fixed first; it gates
  every later "is this worth it" decision.
- **Build chunks in phases, not as a paused coroutine.** The simpler "phased"
  approach keeps the world generation in the exact same order, so the festival
  stays identical — proven by an automated byte-for-byte check that *blocks the
  merge* if anything differs.
- **The shadow shortcut (F2) was nearly cut.** The debate found that the sun's
  shadows actually follow the cart every frame, so the naive shortcut would smear
  the shadows while driving. It survives only in a scoped-down form (helps when
  near-stationary on mid/high machines) and gets dropped if it doesn't measurably
  pay off.
- **Three safe slices.** Slice 1 (gauge + memory churn) can ship now and is
  fully checkable here; the shader and chunk work each get their own slice with
  the human verifying on a real machine.

## Risks & Watch-outs

- **Determinism (the world must not change):** the chunk work could accidentally
  regenerate the festival differently for anyone mid-game. Guarded by a hard
  byte-for-byte registry check across neighbouring chunks.
- **iOS audio / boot order:** the shader-warmup runs right next to the audio
  start; it must come *after* audio init or iPhones ship silent.
- **Shadow "empty map" bug:** the shadow shortcut must reuse the last good shadow,
  never a blank one (a documented past bug).
- **Glow on/off fighting:** three different bits of code currently control the
  glow effect; this change makes one of them the single owner so they don't fight.
- **We can't fully verify here.** Codespaces has no graphics card, so the actual
  frame-rate, visuals, iPhone behaviour, and "does driving look smooth" checks are
  the human's job — batched into about three quick capture round-trips.

## Open Questions

None blocking. The shape questions (full-coroutine vs phased; how much to
prewarm; which Tier-2 extras are worth it) were resolved by the deliberation or
deferred to the human's first performance capture.

## Where Things Live

- `proposal.md` — why this change exists
- `design.md` — the technical how (the seven moves, code-grounded)
- `tasks.md` — the implementation checklist (three slices; source of Progress)
- `specs/` — what the system must do (frame-budget, perceptual-lod, render-pipeline)
- `deliberations/001-perf-pass-4-plan/` — the five-expert debate (`results.md` is the synthesis)
- `reviews/` — post-implementation code review (added during/after apply)
- `session-log.md` — decisions, surprises, blockers (the "why" trail)
- `questions-for-human.md` — open questions for the human
- Background: `.claude/perf-brainstorm.md` — the full idea bank + critic ranking
