# Make the festival run smooth — kill the freezes and the hitches

> **Status:** <!--STATUS:LINE-->paused · 57/69 tasks (82%)<!--/STATUS:LINE-->
>
> _Plain-language summary of this change. A non-engineer should understand it; a junior dev should grasp it; a senior dev should be able to build an accurate mental model from this file alone._

## TL;DR

Driving into a festival hub sometimes makes the game freeze for a third of a
second, and streaming new ground in causes lots of little stutters. This change
fixes both — without a build step — and first repairs a broken gauge so we can
actually *see* what the game is doing. A five-expert review (a "debate") stress-
tested the plan, caught a real bug in one of the ideas, and re-cut the work into
three safe slices. It now also provides a bounded layout-capture path for
software WebGL and a local-first bridge for real phone and tablet performance
reports, so the remaining device checks arrive as evidence instead of anecdotes.

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
- **Make measurement dependable:** collect built layout truth without rendering
  pixels under software WebGL, tear browser sessions down on every exit path, and
  let a same-Wi-Fi phone or tablet post an opt-in performance report directly to
  the ignored local capture directory.
- **Act on the first real-device evidence:** low-tier Auto now starts with cheap
  bubbles instead of paying for a second transmissive scene render, streamed
  campsite tapestries release their unique textures, and future reports identify
  Trip, star-power, bloom, bubble-material, and pixel-ratio state so effect costs
  can be compared cleanly.

See `design.md` for the technical "how".

## Progress

<!--STATUS:AUTO-->
**paused** — 57/69 tasks complete (82%) · current: 3.3

_Last updated: 2026-08-25_

| Group | Progress |
|---|---|
| 1. Slice 1 — B0 (true measurement) + D3 (crowd alloc pooling) | 6/6 ✅ |
| 2. Slice 2 — re-scoped by the 2026-06-19 round-trip-1 capture | 4/4 ✅ |
| 3. Slice 3 — C1-b time-sliced chunk generation (phased deferral) | 2/6 |
| 4. E1 — arrival curtain (gated on Slice-2 results) | 0/2 |
| 5. Draw-call reduction — JUSTIFIED by the round-trip-1 capture (the real lever) | 9/9 ✅ |
| 6. Docs + verification (per slice, not batched) | 4/4 ✅ |
| 7. Slice 4 — forest-tree instancing (the real draw lever) | 17/23 |
| 8. Capture reliability + real-device telemetry | 10/10 ✅ |
| 9. Real-device round trip 1 findings | 5/5 ✅ |
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
- **Real devices still matter.** Automated capture can prove layout determinism,
  cleanup, report transport, and desktop-browser behavior, but only the actual
  phone or tablet can report its GPU, thermals, iOS browser lifecycle, and felt
  smoothness. The tokenized same-Wi-Fi bridge reduces that remaining gate to one
  play route plus a Send tap.

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
