---
change: procedural-map-generator
open: 4
answered: 0
last_question: Q4
last_answer: null
---

# Questions for Human: Procedural Map Generator

> **AGENT DIRECTIVE:** Check this file when resuming work. If `open > 0`, present
> each unanswered question to the user before starting new work.

## Open Questions
<!-- Newest first. Move to Answered when resolved. Each has a default so work isn't blocked. -->

### Q4: Rivers in this change's 2D scope, or defer entirely?
**Date:** 2026-06-06
**Context:** Rivers are the hardest, most-coupled element (bridges, no-build
corridors). You wanted them in the 2D concept.
**Question:** Build rivers+bridges in this change's 2D prototype (last, behind the
skeleton), or defer even the 2D river work to a follow-up?
**Impact:** Whether task group §8 runs in this change.
**Default if unanswered:** In scope, built last (per the exploration).

### Q3: Is the in-game map view a near-term follow-up?
**Date:** 2026-06-06
**Context:** The generator is architected as a single source of truth so a future map
view can reuse it.
**Question:** Is the in-game map view a real near-term follow-up (worth keeping
front-of-mind), or someday-maybe?
**Impact:** How hard we hold the render-agnostic line; whether to note it prominently
on ROADMAP.
**Default if unanswered:** Keep the generator map-view-ready; don't build the UI.

### Q2: Footpath density — "midway" or denser web?
**Date:** 2026-06-06
**Context:** The fine road tier can be sparse (a midway with frontage) or a denser
organic web.
**Question:** Which feel do you want for the local footpaths?
**Impact:** Tuning of the footpath tier (§4.3) and overall "busy vs open" read.
**Default if unanswered:** Lean sparser — footpaths only where they earn it.

### Q1: Heart spacing / rarity target?
**Date:** 2026-06-06
**Context:** Heart distribution is the single make-or-break knob for "reads as real"
vs "lattice of festivals."
**Question:** Roughly how far apart should hearts feel — i.e. how much driving
between major hearts (seconds at boost ≈ 28 m/s)? And how rare should a mega-heart be?
**Impact:** The §2 heart constants and the §3.4 by-eye tuning target.
**Default if unanswered:** Major heart every few hundred meters, mega rare; tune by
eye in the sandbox.

## Answered Questions
<!-- Newest first. -->
