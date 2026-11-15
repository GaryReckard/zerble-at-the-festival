# Horizon capture evidence, November 15

`attachHorizonCapture(ff, { now }?)` in `src/horizonCapture.js` installs a
capture-only probe on `ff.captureProbe`. It returns `null` for disabled or
disposed instances before creating state or reading a clock. Repeated attachment
returns the existing probe. The caller owns the `perfCapture=1&perfWorld=1` gate
and must attach before the first world update.

The plain `snapshot()` object contains these fields:

| Fields | Meaning |
| --- | --- |
| `ffPublishedAgeMs`, `ffPublishedCell` | Age and requested cell of the last successful `_commitApply`; both are null before the first observed publication. |
| `ffFirstPublicationMs`, `ffAwaitingFirstPublicationMs` | Attachment-to-first-publication delay, and elapsed waiting time while no publication has happened. |
| `ffFirstRequestToPublicationMs`, `ffAwaitingFirstRequestPublicationMs` | First planner request to first actual publication latency, and elapsed waiting time after that request until publication. Both are null before the first request; the waiting field becomes null after publication. These exclude idle time on the title before the first request, while attachment-based fields retain it. |
| `ffRequestedCell`, `ffRequestedCells`, `ffCellsSincePublication` | Latest requested player cell, cumulative cell-transition requests since attachment, and requests since the last publication. Revisits count; these are not unique-cell counts or distance traveled. |
| `ffPublications` | Actual completed publications since attachment. A planner commit never increments it. |
| `ffApplySuperseded`, `ffPlanSuperseded` | Existing cumulative counters, read from the renderer and planner respectively. |
| `ffSupersededStreak`, `ffSupersededStreakMax` | Number of abandoned plans plus abandoned apply jobs since the last publication, and its maximum since attachment. |
| `ffUnitMs`, `ffUnitKind` | Capture-lifetime maximum synchronous begin-publication, publish, or single-instance grounding unit. |
| `ffPreparationCallMs`, `ffRoadSliceMs` | Capture-lifetime maximum terrain-preparation or road-planning call duration. These calls can yield or contain multiple units and must not be described as indivisible terrain work. |
| `ffClockReadsTotal` | Monotonic capture clock-read count, including attachment, all unit hooks and the current snapshot's age/wait reading. It supports observer-overhead accounting and is not a per-frame count. |

The publication reset is tied to `_commitApply` returning successfully
(`src/horizonCapture.js:90`). Optional hooks around terrain preparation and
grounding read the capture clock only when the probe is present
(`src/farField.js:1019`). The probe does not change seeds, descriptors, deadlines,
or capacities. Instrumentation itself consumes time in capture mode and can
therefore affect where an existing deadline yields; it does not establish cheap
instrumentation on a physical iPad.

`probe.dispose()` restores the original own descriptors or deletes wrappers to
restore inherited methods, and `ff.dispose()` first detaches the probe
(`src/horizonCapture.js:20`, `src/horizonCapture.js:109`). Both are idempotent.

Verification performed:

- `node bin/test-horizon-capture` passed disabled/disposed gates, repeat attachment,
  plan and publication starvation, first-publication delay, publication reset,
  subsequent age, unit versus yielding-call maxima, failed-commit handling,
  receiver/argument/return preservation, exact own/inherited restoration, and
  zero further capture-clock reads after detachment.
- That test used installed Three.js and actual terrain/worldgen to compare four
  route anchors with capture on and off. Active descriptors and complete pool
  matrix/color/fade and road position/color/index typed-array bytes matched.
- `node bin/test-far-field` passed, including its existing bounded publication,
  supersession, eager/deferred terrain and reused/fresh-road regression gates.

This evidence covers Node behavior and published-buffer equivalence. Browser
integration, capture overhead and physical-device publication thresholds belong
to the parent capture verification and the subsequent device session.
