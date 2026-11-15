# Orchestrator pre-deliberation thinking (Fable 5.2, 2026-11-15)

> Written before the council ran, and deliberately kept OUT of the council
> briefing so the personas reasoned independently. Handed to the Mediator only.
> These are hypotheses from reading the evidence, not measurements.

## TL/DR

The iPad has two separate problems, and the project has spent most of its
effort on the one that is now probably fixed. The big stalls (120–424 ms) were
the far-field horizon rewrite, which was fixed on November 11 but has not been
re-run on the device. The other problem is the steady frame rate (25–40 FPS at
the lowest quality rung), and the evidence says that one is **main-thread
JavaScript outside rendering and world streaming**, which nothing shipped so
far has targeted and which nobody has broken down on the device.

## How I read the device numbers

Sources: `verification/performance/2026-11-07-ipad/` and
`2026-11-08-ipad-child-density/`.

1. **Typical iPad frame work is about 22–31 ms**, of which world streaming is
   about 1 ms and CPU-side rendering is 5–9 ms. That leaves roughly 13 ms or
   more per frame in the game update (crowd, kids, physics, bubbles, HUD,
   audio scheduling). The backlog's own last row says exactly this and marks it
   unattributed. This is the largest known unexplained cost on the device.
2. **Vsync quantization explains the 30 FPS.** Safari presents at 60 Hz, so a
   frame that needs 23 ms of work lands on the 33 ms boundary. The game sits
   near 30 FPS while driving and drifts toward 40 when parked because the work
   hovers around the 16.7 ms line. Getting typical work under about 14 ms on
   the device would roughly double the delivered frame rate; shaving 3 ms off a
   23 ms frame would deliver nothing visible. The goal is a threshold, not a
   percentage.
3. **Auto is spending resolution to fix a CPU problem.** The governor drove the
   iPad to `pixel-50` (675×462) and the frame rate did not recover. The October
   22 phone pair points the same way: `pixel-50` and 1.09–1.25 DPR delivered
   57 versus 58 FPS. If the device is CPU-bound, the picture is being blurred
   for nothing, and the governor has no rung that sheds CPU work.
4. **Low-tier draw counts are 470–1,270**, against a HUD budget of 80. The
   budgets are fiction, and 5–9 ms of CPU render time for that many draws on an
   old A-series chip is plausible. The November 7 desktop probes showed that
   fewer draws did not reduce desktop render work, but that says little about
   an old iPad's driver overhead per draw.
5. **The exact iPad model is still unknown.** An A9/A10 device and an A12
   device differ by more than 2× in single-thread speed. One trip to
   Settings > General > About resolves it.

## What I think would significantly move iPad performance, in order

1. **One device session that answers three questions at once.** Re-run the
   fixed autopilot route on current `main` to confirm the far-field fix, with
   the existing people-frame trace enabled to break down the ~13 ms game
   update, and with a locked-quality pair (`pixel-50` versus full Low
   resolution) to prove whether the device is CPU-bound or GPU-bound.
   Everything below is gated on this, and it costs Gary about fifteen minutes.
2. **Simulation level-of-detail for people.** If the trace confirms crowd/kid/
   physics update cost, then update distant and off-screen people at a reduced
   rate (staggered by index so the cost is even per frame), skip limb animation
   writes for people outside the frustum, and cap physics substeps. This is the
   only candidate that attacks the suspected dominant cost directly, and it
   preserves population (which the November 7 investigation required).
3. **A CPU-aware quality governor.** Teach Auto to tell "work time is over
   budget" apart from "GPU is slow", so it stops dropping resolution when
   resolution is not the constraint, and give it CPU rungs (people update rate,
   active crowd count, far-field caps). Pair it with stable 30 FPS pacing as
   the fallback rung, because an even 30 feels better than a 25–40 wobble.
4. **Cheaper render submission on Low.** Render straight to the canvas when
   bloom and Trip are off (the lowest rung still pays for the composer's
   half-float target, FXAA and the output pass), and freeze the transforms of
   static chunk subtrees (about 7,700 nodes re-walked every frame).
5. **Stop the horizon at the fog limit.** More than half of the kept Low
   horizon instances sat beyond the fog-opaque radius. Culling them removes
   their draws and the remaining 15–30 ms terrain-grounding tail that the
   November 11 fix only spread out.
6. **A worker for world planning, only if the device still shows a tail.** The
   October probe proved byte-identical worldgen in a module worker. It is the
   structural answer to cold festival/woodland plans, but it carries the most
   lifecycle risk, so it should wait for device evidence.

## What I think is NOT worth more effort

- More desktop-only micro-optimization. Four desktop comparisons in a row
  ended in "no detectable primary frame-delivery change", and the device is
  where the problem is.
- More draw-merging of models (rejected by the real-GPU gate on July 15).
- Resolution or bloom tuning on the iPad, since that ladder is already
  exhausted.

## Process observation

The evidence discipline in this repo is excellent, but the device loop is the
bottleneck: three shipped optimizations (October 22, November 5, November 6)
and the November 11 fix all still say "pending iPad verification". The
highest-value process change is making one device run cheap enough that it
happens after every change rather than accumulating a queue.

## Correction after Round 2 (2026-11-15)

Point 3 above ("Auto is spending resolution to fix a CPU problem") did not
survive the debate. The Maverick grouped the raw capture windows by quality
rung inside a single parked phase, where draw count and JavaScript work were
steady, and the median frame interval fell as resolution dropped (about 41 to
31 ms on November 8, and 36.5 to 27 ms on November 7). The "29 to 26 FPS"
comparison I relied on mixed two different scenes. The iPad is therefore at
least partly GPU- or compositor-bound, and a guard that holds resolution would
have cost frame time. Treat points 2 and 3 as hypotheses the next device run
must settle (main-thread work AND the wall-minus-work gap), not as findings.
The Adversary also showed that the November 8 baseline build already
contained the October 22, November 5 and November 6 changes, so my "three
answers from one run" framing overstated what one run can accept.
